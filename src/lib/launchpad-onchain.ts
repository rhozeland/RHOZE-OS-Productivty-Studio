/**
 * Launchpad on-chain client — Step 4b runtime.
 *
 * Source of program ID:
 *   1. localStorage("launchpad-program-id") — runtime override
 *   2. import.meta.env.VITE_LAUNCHPAD_PROGRAM_ID
 *
 * Source of IDL: see `launchpad-idl-store.ts`. As soon as both are present,
 * `isLaunchpadOnChainEnabled()` flips to true and the trade buttons execute
 * real Anchor instructions via the connected wallet adapter.
 *
 * The instruction-name resolver matches both snake_case and camelCase
 * variants (`create_launch` / `createLaunch`, `buy`, `sell`) so any IDL
 * matching the spec in `.lovable/launchpad-program-spec.md` works as-is.
 */
import {
  PublicKey,
  Connection,
  clusterApiUrl,
  type ConfirmOptions,
} from "@solana/web3.js";
import { AnchorProvider, Program, BN, type Idl } from "@coral-xyz/anchor";
import {
  getCachedIdl,
  loadLaunchpadIdl,
  getOverrideProgramId,
} from "./launchpad-idl-store";

const ENV_PROGRAM_ID = (import.meta.env.VITE_LAUNCHPAD_PROGRAM_ID as string | undefined)?.trim();

export const LAUNCHPAD_NETWORK: "devnet" | "mainnet-beta" =
  (import.meta.env.VITE_LAUNCHPAD_NETWORK as "devnet" | "mainnet-beta" | undefined) ?? "devnet";

const SOL_LAMPORTS = 1_000_000_000;
const TOKEN_DECIMALS_DEFAULT = 6;
const TOKEN_BASE_DEFAULT = 10 ** TOKEN_DECIMALS_DEFAULT;

const safePubkey = (raw: string | null | undefined): PublicKey | null => {
  if (!raw) return null;
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
};

const resolveProgramId = (): PublicKey | null => {
  const override = getOverrideProgramId();
  return safePubkey(override) ?? safePubkey(ENV_PROGRAM_ID);
};

export const getLaunchpadProgramId = (): PublicKey | null => resolveProgramId();

export const getLaunchpadConnection = (): Connection =>
  new Connection(clusterApiUrl(LAUNCHPAD_NETWORK), "confirmed");

export const isLaunchpadOnChainEnabled = (): boolean =>
  resolveProgramId() !== null && getCachedIdl() !== null;

/** Kick off IDL load (idempotent). Call from app boot or any consumer. */
export const initLaunchpadIdl = (): Promise<Idl | null> => loadLaunchpadIdl();

export const deriveLaunchPda = (workId: string): PublicKey | null => {
  const pid = resolveProgramId();
  if (!pid) return null;
  const hex = workId.replace(/-/g, "");
  if (hex.length !== 32) return null;
  const bytes = Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("launch"), bytes], pid)[0];
};

export const explorerUrl = (address: string): string =>
  `https://solscan.io/account/${address}${LAUNCHPAD_NETWORK === "devnet" ? "?cluster=devnet" : ""}`;

export type OnChainResult<T> =
  | { enabled: false }
  | { enabled: true; ok: true; data: T }
  | { enabled: true; ok: false; error: string };

// ---------- Anchor program plumbing ----------

interface WalletLike {
  publicKey: PublicKey | null;
  signTransaction?: AnchorProvider["wallet"]["signTransaction"];
  signAllTransactions?: AnchorProvider["wallet"]["signAllTransactions"];
}

let activeWallet: WalletLike | null = null;

/** Called from a top-level component (e.g. AppLayout) with the wallet adapter. */
export const setLaunchpadWallet = (wallet: WalletLike | null): void => {
  activeWallet = wallet;
};

const buildProgram = async (): Promise<
  { ok: true; program: Program<Idl>; provider: AnchorProvider } | { ok: false; error: string }
> => {
  const pid = resolveProgramId();
  if (!pid) return { ok: false, error: "Program ID not configured." };
  const idl = getCachedIdl() ?? (await loadLaunchpadIdl());
  if (!idl) return { ok: false, error: "Launchpad IDL not loaded. Paste it in Settings → Launchpad." };
  if (!activeWallet?.publicKey || !activeWallet.signTransaction) {
    return { ok: false, error: "Connect your Solana wallet first." };
  }

  const connection = getLaunchpadConnection();
  const opts: ConfirmOptions = { commitment: "confirmed", preflightCommitment: "confirmed" };
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: activeWallet.publicKey,
      signTransaction: activeWallet.signTransaction.bind(activeWallet),
      signAllTransactions:
        activeWallet.signAllTransactions?.bind(activeWallet) ??
        (async (txs) => {
          const out = [] as Awaited<ReturnType<NonNullable<WalletLike["signTransaction"]>>>[];
          for (const tx of txs) out.push(await activeWallet!.signTransaction!(tx));
          return out;
        }),
    },
    opts,
  );

  // Anchor 0.32 reads program ID from idl.address; we override to honour env/override.
  const idlWithAddress = { ...(idl as object), address: pid.toBase58() } as Idl;
  const program = new Program<Idl>(idlWithAddress, provider);
  return { ok: true, program, provider };
};

/** Find an instruction by any of the provided name aliases (camel/snake). */
const findIxName = (idl: Idl, aliases: string[]): string | null => {
  const set = new Set(aliases.map((a) => a.toLowerCase().replace(/_/g, "")));
  for (const ix of (idl as unknown as { instructions: Array<{ name: string }> }).instructions) {
    if (set.has(ix.name.toLowerCase().replace(/_/g, ""))) return ix.name;
  }
  return null;
};

// ---------- Public API ----------

export const onChainCreateLaunch = async (args: {
  workId: string;
  ticker: string;
  name: string;
  uri: string;
  lpLockMonths: number;
}): Promise<OnChainResult<{ signature: string; launchPda: string }>> => {
  if (!resolveProgramId()) return { enabled: false };
  const built = await buildProgram();
  if (built.ok === false) return { enabled: true, ok: false, error: built.error };
  const { program } = built;

  const ixName = findIxName(program.idl, ["create_launch", "createLaunch", "initialize_launch"]);
  if (!ixName) return { enabled: true, ok: false, error: "IDL has no `create_launch` instruction." };

  const launchPda = deriveLaunchPda(args.workId);
  if (!launchPda) return { enabled: true, ok: false, error: "Could not derive launch PDA." };

  try {
    const sig = await (program.methods as Record<string, (...a: unknown[]) => { rpc: () => Promise<string> }>)
      [ixName](args.ticker, args.name, args.uri, new BN(args.lpLockMonths))
      .rpc();
    return { enabled: true, ok: true, data: { signature: sig, launchPda: launchPda.toBase58() } };
  } catch (e) {
    return { enabled: true, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export const onChainBuy = async (args: {
  launchPda: string;
  solIn: number;
  minTokensOut: number;
}): Promise<OnChainResult<{ signature: string }>> => {
  if (!resolveProgramId()) return { enabled: false };
  const built = await buildProgram();
  if (built.ok === false) return { enabled: true, ok: false, error: built.error };
  const { program } = built;

  const ixName = findIxName(program.idl, ["buy", "buy_tokens", "swap_in"]);
  if (!ixName) return { enabled: true, ok: false, error: "IDL has no `buy` instruction." };

  try {
    const lamportsIn = new BN(Math.floor(args.solIn * SOL_LAMPORTS));
    const minOut = new BN(Math.floor(args.minTokensOut * TOKEN_BASE_DEFAULT));
    const sig = await (program.methods as Record<string, (...a: unknown[]) => { rpc: () => Promise<string> }>)
      [ixName](lamportsIn, minOut)
      .rpc();
    return { enabled: true, ok: true, data: { signature: sig } };
  } catch (e) {
    return { enabled: true, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export const onChainSell = async (args: {
  launchPda: string;
  tokensIn: number;
  minSolOut: number;
}): Promise<OnChainResult<{ signature: string }>> => {
  if (!resolveProgramId()) return { enabled: false };
  const built = await buildProgram();
  if (built.ok === false) return { enabled: true, ok: false, error: built.error };
  const { program } = built;

  const ixName = findIxName(program.idl, ["sell", "sell_tokens", "swap_out"]);
  if (!ixName) return { enabled: true, ok: false, error: "IDL has no `sell` instruction." };

  try {
    const tokensIn = new BN(Math.floor(args.tokensIn * TOKEN_BASE_DEFAULT));
    const minOut = new BN(Math.floor(args.minSolOut * SOL_LAMPORTS));
    const sig = await (program.methods as Record<string, (...a: unknown[]) => { rpc: () => Promise<string> }>)
      [ixName](tokensIn, minOut)
      .rpc();
    return { enabled: true, ok: true, data: { signature: sig } };
  } catch (e) {
    return { enabled: true, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

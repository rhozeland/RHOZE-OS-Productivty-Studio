/**
 * Launchpad on-chain client — Step 4b scaffold.
 *
 * Until the Anchor program from `.lovable/launchpad-program-spec.md` is
 * deployed and `VITE_LAUNCHPAD_PROGRAM_ID` is set, every helper here returns
 * `{ enabled: false }` and callers fall back to the Step 4a simulated curve
 * (`simulate_coin_trade` RPC).
 *
 * Once you deploy:
 *   1. Run `anchor keys list` and copy the program ID.
 *   2. Add `VITE_LAUNCHPAD_PROGRAM_ID=<id>` to your environment.
 *   3. Drop the IDL JSON at `src/lib/launchpad-idl.json`.
 *   4. Replace the `TODO` blocks below with real Anchor calls.
 */
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";

const PROGRAM_ID_RAW = (import.meta.env.VITE_LAUNCHPAD_PROGRAM_ID as string | undefined)?.trim();

// Devnet first per the audit roadmap. Flip to "mainnet-beta" only after audit.
export const LAUNCHPAD_NETWORK: "devnet" | "mainnet-beta" =
  (import.meta.env.VITE_LAUNCHPAD_NETWORK as "devnet" | "mainnet-beta" | undefined) ?? "devnet";

let cachedProgramId: PublicKey | null = null;
if (PROGRAM_ID_RAW) {
  try {
    cachedProgramId = new PublicKey(PROGRAM_ID_RAW);
  } catch {
    // eslint-disable-next-line no-console
    console.warn(
      `[launchpad] VITE_LAUNCHPAD_PROGRAM_ID is set but not a valid Pubkey: "${PROGRAM_ID_RAW}". Falling back to simulated curve.`,
    );
    cachedProgramId = null;
  }
}

export const isLaunchpadOnChainEnabled = (): boolean => cachedProgramId !== null;

export const getLaunchpadProgramId = (): PublicKey | null => cachedProgramId;

export const getLaunchpadConnection = (): Connection =>
  new Connection(clusterApiUrl(LAUNCHPAD_NETWORK), "confirmed");

/**
 * PDA derivation matching the spec — safe to call client-side even before
 * deploy (it just hashes seeds). Returns null if the program ID is unset.
 */
export const deriveLaunchPda = (workId: string): PublicKey | null => {
  if (!cachedProgramId) return null;
  // workId is a UUID string — encode as 16 raw bytes per the spec.
  const bytes = Uint8Array.from(workId.replace(/-/g, "").match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("launch"), bytes],
    cachedProgramId,
  )[0];
};

export const explorerUrl = (address: string): string =>
  `https://solscan.io/account/${address}${LAUNCHPAD_NETWORK === "devnet" ? "?cluster=devnet" : ""}`;

/**
 * Stubs for future Anchor calls. Each returns `{ enabled: false }` today so
 * the UI can branch cleanly. Replace internals after the program ships.
 */
export type OnChainResult<T> =
  | { enabled: false }
  | { enabled: true; ok: true; data: T }
  | { enabled: true; ok: false; error: string };

export const onChainCreateLaunch = async (
  _args: { workId: string; ticker: string; name: string; uri: string; lpLockMonths: number },
): Promise<OnChainResult<{ signature: string; launchPda: string; mint: string }>> => {
  if (!cachedProgramId) return { enabled: false };
  // TODO(4b-deploy): construct + send Anchor `create_launch` ix with wallet adapter signer.
  return { enabled: true, ok: false, error: "Anchor program deployed but client wiring not yet implemented." };
};

export const onChainBuy = async (
  _args: { launchPda: string; solIn: number; minTokensOut: number },
): Promise<OnChainResult<{ signature: string }>> => {
  if (!cachedProgramId) return { enabled: false };
  return { enabled: true, ok: false, error: "Anchor program deployed but client wiring not yet implemented." };
};

export const onChainSell = async (
  _args: { launchPda: string; tokensIn: number; minSolOut: number },
): Promise<OnChainResult<{ signature: string }>> => {
  if (!cachedProgramId) return { enabled: false };
  return { enabled: true, ok: false, error: "Anchor program deployed but client wiring not yet implemented." };
};

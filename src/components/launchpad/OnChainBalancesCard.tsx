/**
 * OnChainBalancesCard — live SOL + SPL token balances for the launch's
 * vault PDAs, with copy + Solscan links. Auto-refreshes every 15s.
 *
 * PDA derivation uses the program ID + canonical seeds from
 * `.lovable/launchpad-program-spec.md`:
 *   - launch        ["launch", work_id_bytes]
 *   - sol vault     ["sol-vault", launch]
 *   - token vault   ["token-vault", launch]
 *
 * Data is fetched via the lightweight Solana JSON-RPC connection — no
 * Anchor account decoding required, so this works the moment a program is
 * deployed even if the IDL hasn't been pasted yet.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, RefreshCw, Loader2, Coins, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  LAUNCHPAD_NETWORK,
  deriveLaunchPda,
  deriveSolVaultPda,
  deriveTokenVaultPda,
  getLaunchpadConnection,
  getLaunchpadProgramId,
  solscanClusterSuffix,
} from "@/lib/launchpad-onchain";
import { PublicKey } from "@solana/web3.js";
import { cn } from "@/lib/utils";

interface Props {
  workId: string;
  ticker: string;
  /** Optional: explicit token mint from DB. Falls back to RPC-derived vault decimals. */
  mint?: string | null;
}

interface BalanceState {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  solLamports: number | null;
  tokenAmount: number | null;     // human-units
  tokenDecimals: number | null;
  vaultExists: { sol: boolean; token: boolean };
  fetchedAt: number | null;
}

const INITIAL: BalanceState = {
  loading: true,
  refreshing: false,
  error: null,
  solLamports: null,
  tokenAmount: null,
  tokenDecimals: null,
  vaultExists: { sol: false, token: false },
  fetchedAt: null,
};

const LAMPORTS_PER_SOL = 1_000_000_000;

const OnChainBalancesCard = ({ workId, ticker, mint }: Props) => {
  const programId = getLaunchpadProgramId();
  const launchPda = useMemo(() => deriveLaunchPda(workId), [workId]);
  const solVault = useMemo(() => deriveSolVaultPda(workId), [workId]);
  const tokenVault = useMemo(() => deriveTokenVaultPda(workId), [workId]);

  const [state, setState] = useState<BalanceState>(INITIAL);

  const fetchBalances = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!solVault || !tokenVault) {
        setState({ ...INITIAL, loading: false, error: "Program ID not configured." });
        return;
      }
      setState((s) => ({
        ...s,
        loading: mode === "initial",
        refreshing: mode === "refresh",
        error: null,
      }));
      try {
        const conn = getLaunchpadConnection();
        // SOL vault — just a SystemAccount, lamports field is the whole balance.
        const [solInfo, tokenInfo] = await Promise.all([
          conn.getAccountInfo(solVault, "confirmed"),
          // Token vault is an SPL token account; getTokenAccountBalance returns
          // {amount,decimals,uiAmount}. Wrap to swallow the "could not find
          // account" error pre-initialization.
          conn
            .getTokenAccountBalance(tokenVault, "confirmed")
            .then((r) => ({ ok: true as const, value: r.value }))
            .catch(() => ({ ok: false as const, value: null })),
        ]);

        setState({
          loading: false,
          refreshing: false,
          error: null,
          solLamports: solInfo?.lamports ?? 0,
          tokenAmount:
            tokenInfo.ok && tokenInfo.value
              ? Number(tokenInfo.value.uiAmountString ?? tokenInfo.value.uiAmount ?? 0)
              : null,
          tokenDecimals: tokenInfo.ok && tokenInfo.value ? tokenInfo.value.decimals : null,
          vaultExists: {
            sol: !!solInfo,
            token: tokenInfo.ok,
          },
          fetchedAt: Date.now(),
        });
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          refreshing: false,
          error: e instanceof Error ? e.message : "Failed to load balances.",
        }));
      }
    },
    [solVault, tokenVault],
  );

  // Initial load + 15s polling
  useEffect(() => {
    if (!programId) {
      setState({ ...INITIAL, loading: false, error: null });
      return;
    }
    void fetchBalances("initial");
    const id = window.setInterval(() => void fetchBalances("refresh"), 15_000);
    return () => window.clearInterval(id);
  }, [programId, fetchBalances]);

  if (!programId) {
    return (
      <Card className="bg-card/40 backdrop-blur">
        <CardContent className="p-4 space-y-2">
          <Header ticker={ticker} />
          <p className="text-xs text-muted-foreground py-2">
            Set the launchpad program ID in Settings → Verified IP to see live on-chain
            balances for this launch.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/40 backdrop-blur">
      <CardContent className="p-4 space-y-3">
        <Header
          ticker={ticker}
          fetchedAt={state.fetchedAt}
          refreshing={state.refreshing}
          onRefresh={() => void fetchBalances("refresh")}
        />

        {state.error && (
          <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5">
            {state.error}
          </p>
        )}

        <BalanceRow
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="SOL vault"
          pda={solVault}
          loading={state.loading}
          exists={state.vaultExists.sol}
          value={
            state.solLamports !== null
              ? `${(state.solLamports / LAMPORTS_PER_SOL).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })} SOL`
              : null
          }
          subValue={
            state.solLamports !== null
              ? `${state.solLamports.toLocaleString()} lamports`
              : null
          }
        />

        <BalanceRow
          icon={<Coins className="h-3.5 w-3.5" />}
          label="Token vault"
          pda={tokenVault}
          loading={state.loading}
          exists={state.vaultExists.token}
          value={
            state.tokenAmount !== null
              ? `${state.tokenAmount.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })} $${ticker}`
              : null
          }
          subValue={
            state.tokenDecimals !== null ? `${state.tokenDecimals} decimals` : null
          }
        />

        {launchPda && (
          <div className="pt-1 mt-1 border-t border-border/40">
            <PdaCaption label="Launch PDA" pda={launchPda} />
            {mint && <PdaCaption label="Mint" pda={new PublicKey(mint)} kind="token" />}
          </div>
        )}

        {!state.loading && !state.vaultExists.sol && !state.vaultExists.token && !state.error && (
          <p className="text-[11px] text-muted-foreground italic pt-1">
            Vault accounts not found on {LAUNCHPAD_NETWORK}. They appear once the launch is
            initialized on-chain via <span className="font-mono">create_launch</span>.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const Header = ({
  ticker,
  fetchedAt,
  refreshing,
  onRefresh,
}: {
  ticker: string;
  fetchedAt?: number | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}) => (
  <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold">On-chain balances</h2>
      <Badge variant="outline" className="text-[10px] uppercase font-mono">
        {LAUNCHPAD_NETWORK}
      </Badge>
    </div>
    <div className="flex items-center gap-2">
      {fetchedAt && (
        <span className="text-[10px] text-muted-foreground">
          Updated {timeAgo(fetchedAt)}
        </span>
      )}
      {onRefresh && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh balances"
        >
          {refreshing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  </div>
);

interface BalanceRowProps {
  icon: React.ReactNode;
  label: string;
  pda: PublicKey | null;
  loading: boolean;
  exists: boolean;
  value: string | null;
  subValue: string | null;
}

const BalanceRow = ({ icon, label, pda, loading, exists, value, subValue }: BalanceRowProps) => {
  const address = pda?.toBase58() ?? null;
  const url = address ? `https://solscan.io/account/${address}${solscanClusterSuffix()}` : null;
  const copy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    toast.success(`${label} address copied`);
  };
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
          {!loading && !exists && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 ml-1">
              not initialized
            </Badge>
          )}
        </div>
        {address && (
          <div className="flex items-center gap-1">
            <button onClick={copy} className="text-muted-foreground hover:text-foreground" aria-label={`Copy ${label} PDA`}>
              <Copy className="h-3 w-3" />
            </button>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Open ${label} on Solscan`}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className={cn("font-mono text-base font-semibold", !exists && "text-muted-foreground")}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : value ?? "—"}
        </div>
        {subValue && <div className="text-[10px] font-mono text-muted-foreground">{subValue}</div>}
      </div>
      {address && (
        <div className="font-mono text-[10px] text-muted-foreground/80 truncate" title={address}>
          {address}
        </div>
      )}
    </div>
  );
};

const PdaCaption = ({
  label,
  pda,
  kind = "account",
}: {
  label: string;
  pda: PublicKey;
  kind?: "account" | "token";
}) => {
  const address = pda.toBase58();
  const url = `https://solscan.io/${kind}/${address}${solscanClusterSuffix()}`;
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-[10px]">
      <span className="uppercase tracking-wide text-muted-foreground">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 min-w-0"
      >
        <span className="truncate">{address.slice(0, 8)}…{address.slice(-8)}</span>
        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
      </a>
    </div>
  );
};

const timeAgo = (ts: number): string => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

export default OnChainBalancesCard;

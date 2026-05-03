/**
 * DropCoinCard — compact card for a coin drop, showing live price + market cap
 * in $RHOZE. Used on profile drops catalog, Space detail, and Event detail.
 *
 * No bonding-curve goal, no progress bar — drops are simulated buy/sell only.
 */
import { Link } from "react-router-dom";
import { Coins, ArrowRight, Calendar, Building2 } from "lucide-react";

export interface DropCoin {
  id: string;
  ticker: string;
  name: string;
  image_url: string | null;
  status: string;
  mint_address?: string | null;
  virtual_sol_reserves: number | string;
  virtual_token_reserves: number | string;
  total_supply: number | string;
  events?: { title?: string | null } | null;
  studios?: { name?: string | null } | null;
}

const fmtPrice = (p: number) => {
  if (!isFinite(p) || p <= 0) return "—";
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.0001) return p.toFixed(6);
  const s = p.toFixed(20);
  const m = s.match(/^0\.0*(?=\d)/);
  if (!m) return p.toString();
  const zeros = m[0].length - 2;
  const sig = s.slice(m[0].length, m[0].length + 4);
  const sub = String(zeros).split("").map((d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]).join("");
  return `0.0${sub}${sig}`;
};

const fmtMcap = (n: number) => {
  if (!isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
};

interface Props {
  coin: DropCoin;
  /** Hide context chip when already shown in the page header. */
  hideContext?: boolean;
}

const DropCoinCard = ({ coin, hideContext }: Props) => {
  const vSol = Number(coin.virtual_sol_reserves) || 0;
  const vTok = Number(coin.virtual_token_reserves) || 1;
  const supply = Number(coin.total_supply) || 0;
  // 1 SOL ≈ 100 $RHOZE in simulation.
  const priceRhoze = (vSol / vTok) * 100;
  const mcapRhoze = priceRhoze * supply;

  const ctx = !hideContext && coin.events?.title
    ? { icon: Calendar, label: coin.events.title }
    : !hideContext && coin.studios?.name
      ? { icon: Building2, label: coin.studios.name }
      : null;

  return (
    <Link
      to={`/coin/${coin.mint_address || coin.ticker}`}
      className="group block rounded-2xl border border-border bg-card hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all p-4"
    >
      <div className="flex items-start gap-3 mb-3">
        {coin.image_url ? (
          <img src={coin.image_url} alt={coin.name} className="h-11 w-11 rounded-md object-cover shrink-0" />
        ) : (
          <div className="h-11 w-11 rounded-md bg-gradient-to-br from-emerald-500/30 to-fuchsia-500/30 flex items-center justify-center shrink-0">
            <Coins className="h-5 w-5 text-emerald-500" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-sm group-hover:text-emerald-500 transition-colors">${coin.ticker}</span>
            {coin.status === "graduated" && (
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500">
                Grad
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{coin.name}</p>
          {ctx && (
            <p className="text-[10px] text-muted-foreground/80 truncate flex items-center gap-1 mt-0.5">
              <ctx.icon className="h-2.5 w-2.5" />
              {ctx.label}
            </p>
          )}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
      </div>
      <div className="flex items-end justify-between gap-3 pt-1 border-t border-border/50">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Price</p>
          <p className="text-xs font-mono font-semibold text-foreground">
            {fmtPrice(priceRhoze)} <span className="text-muted-foreground font-normal">$RHOZE</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Mkt cap</p>
          <p className="text-xs font-mono font-semibold text-foreground">
            {fmtMcap(mcapRhoze)} <span className="text-muted-foreground font-normal">$RHOZE</span>
          </p>
        </div>
      </div>
    </Link>
  );
};

export default DropCoinCard;

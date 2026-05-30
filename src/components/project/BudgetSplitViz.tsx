/**
 * BudgetSplitViz — live visual breakdown of a USD project budget.
 *
 * Shown directly under the budget number input. No slider, no min/max — just
 * the number the user typed plus a stacked bar that makes the Rhozeland fee
 * + creator take instantly readable. Flat 10% fee (A&R upgrade is handled
 * separately inside the project workspace).
 */
import { motion } from "framer-motion";

interface Props {
  budget: number;
  feePct?: number; // 0.10 default
  className?: string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const BudgetSplitViz = ({ budget, feePct = 0.10, className }: Props) => {
  const safe = Number.isFinite(budget) && budget > 0 ? budget : 0;
  const fee = Math.round(safe * feePct * 100) / 100;
  const creatorCut = Math.max(0, safe - fee);
  const creatorPctLabel = safe > 0 ? Math.round((creatorCut / safe) * 100) : 0;
  const feePctLabel = safe > 0 ? Math.round((fee / safe) * 100) : 0;

  return (
    <div className={["rounded-xl border border-border bg-card/60 p-4 space-y-3", className].filter(Boolean).join(" ")}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total budget</p>
          <p className="font-display text-2xl text-foreground tabular-nums">{fmt(safe)}</p>
        </div>
        {safe > 0 && (
          <p className="text-[10px] text-muted-foreground text-right">
            Flat 10% Rhozeland fee.<br />No hidden math.
          </p>
        )}
      </div>

      {/* Stacked bar */}
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
        <motion.div
          className="h-full bg-foreground"
          initial={{ width: 0 }}
          animate={{ width: `${creatorPctLabel}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${feePctLabel}%` }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-foreground" />
            <span className="text-muted-foreground">To creator</span>
          </div>
          <p className="font-semibold text-foreground tabular-nums">{fmt(creatorCut)}</p>
        </div>
        <div className="space-y-0.5 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Rhozeland fee</span>
          </div>
          <p className="font-semibold text-foreground tabular-nums">{fmt(fee)}</p>
        </div>
      </div>
    </div>
  );
};

export default BudgetSplitViz;

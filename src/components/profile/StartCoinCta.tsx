/**
 * StartCoinCta — v11 Tier 1 owner-only card on Profile.
 *
 * Renders when the profile owner is viewing their own profile and has NOT
 * yet linked a pump.fun token (`profiles.token_mint_address` is null).
 * The pump.fun create flow is the primary action; "Already have one?" links
 * to Settings → token submission where the existing approval gate lives.
 *
 * This is the single most-promoted CTA in the v11 framing: "Start a coin"
 * is the musician-first invitation. Once a token is approved, ProjectTokenCard
 * takes over this slot.
 */
import { useState } from "react";
import { Coins, ArrowUpRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import LaunchCoinFlowModal from "@/components/launchpad/LaunchCoinFlowModal";

interface Props {
  /** Display name used in the headline copy. */
  creatorName?: string | null;
  className?: string;
}

export default function StartCoinCta({ creatorName, className }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <section
      className={[
        "relative overflow-hidden rounded-2xl border border-foreground/20",
        "bg-gradient-to-br from-amber-500/[0.08] via-fuchsia-500/[0.06] to-violet-500/[0.10]",
        "p-5",
        className ?? "",
      ].join(" ")}
    >
      {/* decorative blur */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-3xl"
      />
      <div className="relative space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0">
            <Coins className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              <Sparkles className="h-3 w-3" />
              Artist coin · v11
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground leading-tight">
              Start {creatorName ? `${creatorName}'s` : "your"} artist coin
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Launch a $TICKER on pump.fun. Fans discover and trade it from
              your profile — every release adds fuel to the curve.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button
            size="lg"
            className="w-full rounded-full gap-2"
            onClick={() => setOpen(true)}
          >
            Launch on pump.fun
            <ArrowUpRight className="h-4 w-4" />
          </Button>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => navigate("/why-coin")}
              className="text-[11px] text-foreground/80 hover:text-foreground underline-offset-4 hover:underline text-center font-medium"
            >
              Why launch a coin? See the full pitch &rarr;
            </button>
            <button
              type="button"
              onClick={() => navigate("/settings#token")}
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-4 hover:underline text-center"
            >
              Already have a coin? Link it &rarr;
            </button>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/70 leading-relaxed pt-1">
          Rhozeland never custodies your token. We embed a read-only chip so
          fans can see price, volume, and trade on pump.fun in one tap.
        </p>
      </div>

      <LaunchCoinFlowModal open={open} onOpenChange={setOpen} project={null} />
    </section>
  );
}

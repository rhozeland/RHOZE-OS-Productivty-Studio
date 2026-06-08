import { useState } from "react";
import { Link } from "react-router-dom";
import { Coins, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import LaunchCoinFlowModal from "@/components/launchpad/LaunchCoinFlowModal";

interface TokenizeProjectCtaProps {
  projectId: string;
  projectTitle: string;
  projectDescription?: string | null;
  linkedTokenId?: string | null;
}

/**
 * Owner-facing nudge encouraging artists to turn a release into a coin
 * with Rhozeland's hands-on help. Hidden once a token is already linked.
 */
const TokenizeProjectCta = ({
  projectId,
  projectTitle,
  projectDescription,
  linkedTokenId,
}: TokenizeProjectCtaProps) => {
  const [open, setOpen] = useState(false);

  if (linkedTokenId) return null;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-fuchsia-500/10 via-amber-500/5 to-rose-500/10 p-5 md:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-amber-400/20 blur-3xl"
        />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-foreground/5 backdrop-blur flex items-center justify-center">
              <Coins className="h-5 w-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Tokenize this project
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-foreground">
                  <Sparkles className="h-2.5 w-2.5" /> With Rhozeland
                </span>
              </div>
              <h3 className="mt-1 font-display text-lg font-semibold text-foreground">
                Turn "{projectTitle}" into a coin
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                Let fans back this release on-chain. Earn 5bps creator rewards on every trade
                and unlock a token-gated feed for holders — our A&R team helps you ship it right.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 md:shrink-0">
            <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
              Get help launching <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/why-coin">Why a coin?</Link>
            </Button>
          </div>
        </div>
      </div>

      <LaunchCoinFlowModal
        open={open}
        onOpenChange={setOpen}
        project={{ id: projectId, title: projectTitle, description: projectDescription ?? null }}
        backHref={`/projects/${projectId}`}
      />
    </>
  );
};

export default TokenizeProjectCta;

/**
 * FlowGuestCTA
 * ─────────────────────────────────────────────────────────────────────────
 * Shared "Browsing as guest" call-to-action for Flow Mode.
 *
 * Mounted once inside the FlowModePage layout so it appears consistently
 * across every entry/navigation path — calibration screen, swipe view,
 * browse view, and the empty-feed state — without duplicating markup.
 *
 * Visibility is gated on `user === null` (an unauthenticated session).
 * Authenticated users see nothing and the component renders no DOM.
 *
 * Two visual variants:
 *   • "card"  → full bordered card, used inline on the calibration screen
 *               where there's vertical room and the CTA is the primary
 *               next-step suggestion.
 *   • "floating" → compact pill anchored to the bottom of the viewport for
 *                  the swipe / browse views, where space is at a premium
 *                  and the CTA must not occlude content cards.
 */
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { trackGuestCTAClick } from "@/lib/guest-cta-analytics";

type FlowGuestCTAProps = {
  variant?: "card" | "floating";
  className?: string;
};

const FlowGuestCTA = ({ variant = "card", className }: FlowGuestCTAProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Hide entirely for signed-in users — no placeholder, no spacing.
  if (user) return null;

  // Centralised click handler so analytics fires on both variants without
  // duplicating the surface/variant payload at each call-site.
  const handleSignUpClick = () => {
    trackGuestCTAClick("flow-guest-cta", variant);
    navigate("/auth");
  };

  if (variant === "floating") {
    return (
      <div
        className={cn(
          // Pin to the bottom of the Flow viewport. `pointer-events-none` on
          // the wrapper lets swipe gestures continue to register everywhere
          // except on the pill itself.
          "pointer-events-none fixed bottom-20 left-1/2 z-30 -translate-x-1/2 px-4 sm:bottom-6",
          className,
        )}
        data-testid="flow-guest-cta-floating"
      >
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/50 bg-card/80 px-3 py-1.5 shadow-lg backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs text-foreground/90">
            <span className="font-medium">Browsing the global feed</span>
            <span className="hidden sm:inline text-muted-foreground">
              {" "}· sign up to post, save & earn $RHOZE
            </span>
          </span>
          <Button
            size="sm"
            variant="default"
            onClick={handleSignUpClick}
            className="h-7 rounded-full px-3 text-xs"
          >
            Sign up free
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40 bg-card/60 p-4 text-left backdrop-blur-sm",
        className,
      )}
      data-testid="flow-guest-cta-card"
    >
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
        Browsing as guest
      </p>
      <p className="mb-3 text-sm leading-relaxed text-foreground/90">
        You can browse the full global feed — swipe, scroll, and discover work
        from creators across Rhozeland — no account needed.
      </p>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        To <span className="font-medium text-foreground/80">post</span> your
        own work, <span className="font-medium text-foreground/80">save</span>{" "}
        what you love, and{" "}
        <span className="font-medium text-foreground/80">earn $RHOZE</span> for
        contributing, you'll need a free account.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate("/auth")}
        className="w-full rounded-full"
      >
        Sign up free
      </Button>
    </div>
  );
};

export default FlowGuestCTA;

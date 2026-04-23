/**
 * FlowGuestCTA
 * ─────────────────────────────────────────────────────────────────────────
 * Shared "Browsing as guest" call-to-action for Flow Mode.
 *
 * Mounted once inside the FlowModePage layout so it appears consistently
 * across every entry/navigation path — calibration screen, swipe view,
 * browse view, and the empty-feed state — without duplicating markup.
 *
 * Visibility is gated on:
 *   1. `user === null` (an unauthenticated session), AND
 *   2. the visitor hasn't dismissed this variant in localStorage.
 *
 * Authenticated users see nothing and the component renders no DOM.
 *
 * Two visual variants:
 *   • "card"  → full bordered card, used inline on the calibration screen
 *               where there's vertical room and the CTA is the primary
 *               next-step suggestion.
 *   • "floating" → compact pill anchored to the bottom of the viewport for
 *                  the swipe / browse views, where space is at a premium
 *                  and the CTA must not occlude content cards.
 *
 * Dismissal is persisted per-variant so dismissing the floating pill does
 * NOT also hide the calibration card (different intent, different surface).
 * Storage key: `rhz.guest_cta_dismissed.v1` → { card?: number; floating?: number }
 * Value is the dismissal timestamp (ms) so we can later add an expiry if
 * we want to re-show the CTA after a cool-down period.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { trackGuestCTAClick } from "@/lib/guest-cta-analytics";

type FlowGuestCTAProps = {
  variant?: "card" | "floating";
  className?: string;
};

const DISMISS_STORAGE_KEY = "rhz.guest_cta_dismissed.v1";

type DismissalMap = Partial<Record<"card" | "floating", number>>;

const readDismissals = (): DismissalMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissalMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeDismissal = (variant: "card" | "floating") => {
  if (typeof window === "undefined") return;
  try {
    const current = readDismissals();
    current[variant] = Date.now();
    window.localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* localStorage unavailable — fall through, in-memory state still hides it for this session */
  }
};

const FlowGuestCTA = ({ variant = "card", className }: FlowGuestCTAProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Initialise from storage synchronously so we never flash the CTA on
  // mount for visitors who already dismissed it on a previous visit.
  const [dismissed, setDismissed] = useState<boolean>(
    () => Boolean(readDismissals()[variant]),
  );

  // Re-check storage if the variant prop changes (e.g. same surface
  // re-mounted with a different variant) so dismissal stays accurate.
  useEffect(() => {
    setDismissed(Boolean(readDismissals()[variant]));
  }, [variant]);

  // Hide entirely for signed-in users or anyone who dismissed this variant.
  if (user || dismissed) return null;

  // Centralised click handler so analytics fires on both variants without
  // duplicating the surface/variant payload at each call-site.
  const handleSignUpClick = () => {
    trackGuestCTAClick("flow-guest-cta", variant);
    navigate("/auth");
  };

  const handleDismiss = () => {
    writeDismissal(variant);
    setDismissed(true);
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
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss sign-up prompt"
            className="ml-0.5 -mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border/40 bg-card/60 p-4 pr-10 text-left backdrop-blur-sm",
        className,
      )}
      data-testid="flow-guest-cta-card"
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss sign-up prompt"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3.5 w-3.5" />
      </button>
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
        onClick={handleSignUpClick}
        className="w-full rounded-full"
      >
        Sign up free
      </Button>
    </div>
  );
};

export default FlowGuestCTA;

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type FlowScope = "all" | "preferred";

interface FlowScopeToggleProps {
  scope: FlowScope;
  onScopeChange: (scope: FlowScope) => void;
  /**
   * When false, the toggle is hidden (e.g. user hasn't calibrated preferences,
   * or their picks already cover every category so "For You" === "All").
   */
  visible: boolean;
  /**
   * Optional className override for the outer pill container so callers can
   * tweak responsive visibility without re-implementing the styling.
   */
  className?: string;
}

/**
 * The "For You" / "All" feed scope pill that sits above the Flow Mode deck.
 * Rendered identically in both Swipe and Browse views so the user can flip
 * scopes without losing their place in either mode.
 *
 * Extracted as a standalone component so it can be unit-tested in isolation
 * (the parent FlowModePage has too many runtime dependencies — auth, supabase,
 * react-query, framer-motion — to render in a test environment).
 */
export function FlowScopeToggle({
  scope,
  onScopeChange,
  visible,
  className,
}: FlowScopeToggleProps) {
  if (!visible) return null;

  return (
    <div
      data-testid="flow-scope-toggle"
      className={cn(
        "hidden sm:flex items-center gap-0.5 rounded-full bg-card/60 backdrop-blur-sm border border-border/30 p-0.5",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onScopeChange("preferred")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              scope === "preferred"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={scope === "preferred"}
            aria-label="Show only your preferred categories"
          >
            For You
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-center">
          Curated to the categories you picked during onboarding — a tighter,
          personalized feed.
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onScopeChange("all")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              scope === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={scope === "all"}
            aria-label="Show every category"
          >
            All
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-center">
          Every category from across Rhozeland — broader discovery beyond your
          saved picks.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

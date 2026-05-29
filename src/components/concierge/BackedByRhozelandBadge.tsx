/**
 * BackedByRhozelandBadge — public trust mark for projects that came in
 * through the Concierge SKU (intake_tier='concierge').
 *
 * Render anywhere a Concierge-tier project surfaces to communicate that
 * Rhozeland scoped, curated, and stands behind the engagement. Visual
 * goal: small, editorial, not loud — a quiet credibility chip.
 *
 * Usage:
 *   <BackedByRhozelandBadge />               // pill (default)
 *   <BackedByRhozelandBadge variant="seal" /> // larger circular seal
 */
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  variant?: "pill" | "seal";
  className?: string;
}

const TOOLTIP_COPY =
  "On the Rhozeland Roster — scoped and managed by our A&R team, with escrowed milestones and on-chain proof of work.";

export default function BackedByRhozelandBadge({
  variant = "pill",
  className,
}: Props) {
  if (variant === "seal") {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "inline-flex flex-col items-center justify-center rounded-full",
                "h-16 w-16 border border-foreground/15 bg-gradient-to-br from-foreground/[0.04] to-primary/[0.06]",
                "text-foreground shadow-sm",
                className,
              )}
              aria-label="On the Rhozeland Roster"
            >
              <Sparkles className="h-3.5 w-3.5 mb-0.5 opacity-70" />
              <span className="text-[8px] font-semibold uppercase tracking-widest leading-tight text-center px-1">
                Rhozeland<br />Roster
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            {TOOLTIP_COPY}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
              "border-foreground/20 bg-gradient-to-br from-foreground/[0.04] to-primary/[0.06]",
              "text-[10px] font-medium uppercase tracking-widest text-foreground",
              "cursor-default",
              className,
            )}
          >
            <Sparkles className="h-3 w-3 opacity-70" />
            On the Rhozeland Roster
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          {TOOLTIP_COPY}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

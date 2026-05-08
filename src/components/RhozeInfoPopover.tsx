/**
 * RhozeInfoPopover — small "?" icon that explains $RHOZE in 3 lines.
 *
 * Use <RhozeInfoPopover /> standalone, or <RhozeLabel /> to render
 * "$RHOZE" text followed by the help icon. Reusable anywhere $RHOZE
 * is mentioned so users can always learn what it is in-context.
 */
import { HelpCircle, Coins, Sparkles, Wallet, Heart } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const RhozeInfoPopover = ({
  className,
  size = 12,
}: {
  className?: string;
  size?: number;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        aria-label="What is $RHOZE?"
        className={cn(
          "inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors align-middle",
          className,
        )}
      >
        <HelpCircle style={{ width: size, height: size }} strokeWidth={2} />
      </button>
    </PopoverTrigger>
    <PopoverContent
      side="bottom"
      align="start"
      className="w-72 p-4 space-y-3 font-body"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        <Coins className="h-3.5 w-3.5 text-primary" />
        <p className="text-sm font-semibold text-foreground">What is $RHOZE?</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Rhozeland's currency — earned by creating, attending events, and
        collaborating.
      </p>
      <div className="flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <div className="text-xs leading-relaxed">
          <span className="text-foreground font-medium">How to earn more: </span>
          <span className="text-muted-foreground">
            Post work · Attend events · Complete collabs · Maintain streaks
          </span>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Wallet className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <div className="text-xs leading-relaxed">
          <span className="text-foreground font-medium">What to spend it on: </span>
          <span className="text-muted-foreground">
            Rhozeland services · Hold to level up · Cash out to wallet
          </span>
        </div>
      </div>
    </PopoverContent>
  </Popover>
);

export const RhozeLabel = ({
  className,
  iconClassName,
  iconSize = 12,
}: {
  className?: string;
  iconClassName?: string;
  iconSize?: number;
}) => (
  <span className={cn("inline-flex items-center gap-1", className)}>
    $RHOZE
    <RhozeInfoPopover className={iconClassName} size={iconSize} />
  </span>
);

export default RhozeInfoPopover;

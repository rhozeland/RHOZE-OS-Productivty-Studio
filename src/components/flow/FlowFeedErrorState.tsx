/**
 * FlowFeedErrorState
 * ─────────────────────────────────────────────────────────────────────────
 * User-facing error UI for Flow Mode when the feed loader (or its
 * downstream `profiles_public` lookup) fails hard.
 *
 * Kept deliberately framework-light (no React Query coupling) so we can:
 *   • render it from both swipe + browse views with the same component
 *   • unit-test it standalone with a stubbed `onRetry`
 *
 * Tone: friendly, blame-free. The underlying error message is shown in a
 * subtle muted line so power users / support can repro without scaring
 * casual visitors.
 */
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FlowFeedErrorStateProps = {
  /** The underlying error from the feed loader. Used only for the muted detail line. */
  error?: unknown;
  /** Triggered when the user clicks "Try again". */
  onRetry?: () => void;
  /** True while a retry attempt is in flight — disables the button + shows a hint. */
  isRetrying?: boolean;
  className?: string;
};

const FALLBACK_MESSAGE = "Unknown error";

const extractMessage = (error: unknown): string => {
  if (!error) return FALLBACK_MESSAGE;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || FALLBACK_MESSAGE;
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return FALLBACK_MESSAGE;
};

const FlowFeedErrorState = ({
  error,
  onRetry,
  isRetrying = false,
  className,
}: FlowFeedErrorStateProps) => {
  const detail = extractMessage(error);

  return (
    <div
      role="alert"
      data-testid="flow-feed-error-state"
      className={cn(
        "mx-auto flex max-w-sm flex-col items-center justify-center px-4 text-center",
        className,
      )}
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 backdrop-blur-sm">
        <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
      </div>
      <h2 className="mb-2 font-display text-xl font-bold text-foreground">
        We couldn't load the feed
      </h2>
      <p className="mb-1 text-sm leading-relaxed text-muted-foreground">
        Something went wrong fetching Flow posts. This is usually temporary —
        check your connection and try again.
      </p>
      <p
        className="mb-5 text-xs text-muted-foreground/70"
        data-testid="flow-feed-error-detail"
      >
        Details: {detail}
      </p>
      {onRetry && (
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          className="rounded-full px-6"
          data-testid="flow-feed-error-retry"
        >
          <RotateCcw
            className={cn("mr-2 h-4 w-4", isRetrying && "animate-spin")}
            aria-hidden="true"
          />
          {isRetrying ? "Retrying…" : "Try again"}
        </Button>
      )}
    </div>
  );
};

export default FlowFeedErrorState;

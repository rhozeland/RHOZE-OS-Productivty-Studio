/**
 * NoteBubble — the floating thought bubble that hovers above an avatar.
 *
 * Used on profile pages and on the BuddyNotesRow in the DM inbox.
 * Pure presentational — doesn't fetch anything; pass in `body`.
 */
import { cn } from "@/lib/utils";

interface Props {
  body: string;
  /** "sm" sits inline above tiny avatars (DM row); "md" floats over a profile avatar. */
  size?: "sm" | "md";
  className?: string;
}

export const NoteBubble = ({ body, size = "sm", className }: Props) => {
  const isMd = size === "md";
  return (
    <div
      className={cn(
        "relative inline-flex max-w-[140px] items-center justify-center rounded-2xl bg-card text-foreground shadow-md ring-1 ring-border/60",
        isMd ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[10px]",
        className,
      )}
      aria-label="Status note"
    >
      <span className="line-clamp-2 leading-snug font-medium">{body}</span>
      {/* speech-bubble tail */}
      <span
        aria-hidden
        className={cn(
          "absolute left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-card ring-1 ring-border/60",
          isMd ? "-bottom-2.5" : "-bottom-1.5"
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-card ring-1 ring-border/60",
          isMd ? "-bottom-4" : "-bottom-3"
        )}
        style={{ marginTop: 4 }}
      />
    </div>
  );
};

export default NoteBubble;

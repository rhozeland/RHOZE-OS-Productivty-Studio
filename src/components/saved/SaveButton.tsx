/**
 * SaveButton — bookmark toggle for creators, works, and listings.
 *
 * Two visual variants:
 *   - "icon" (default): pill-style icon button — for cards, tiles, action bars.
 *   - "chip": labelled chip with "Save" / "Saved" — for hero / detail headers.
 */
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSavedItems, type SavedItemType } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGate } from "@/components/auth/useAuthGate";

type Props = {
  type: SavedItemType;
  id: string;
  variant?: "icon" | "chip";
  className?: string;
  size?: "sm" | "md";
  /** Stops parent click handlers (cards, etc.). Default true. */
  stopPropagation?: boolean;
};

const SaveButton = ({
  type,
  id,
  variant = "icon",
  className,
  size = "md",
  stopPropagation = true,
}: Props) => {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const { isSaved, toggle, isPending } = useSavedItems();
  const saved = !!user && isSaved(type, id);

  const handle = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    e.preventDefault();
    if (!user) {
      requireAuth("save items", () => toggle(type, id));
      return;
    }
    toggle(type, id);
  };

  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={isPending}
        aria-pressed={saved}
        aria-label={saved ? "Remove from Saved" : "Save"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
          saved
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30",
          isPending && "opacity-60 cursor-not-allowed",
          className,
        )}
      >
        <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-current")} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <button
      type="button"
      onClick={handle}
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from Saved" : "Save"}
      title={saved ? "Remove from Saved" : "Save"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border transition-all backdrop-blur-sm",
        dim,
        saved
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border/70 bg-card/80 text-muted-foreground hover:text-foreground hover:border-foreground/30",
        isPending && "opacity-60 cursor-not-allowed",
        className,
      )}
    >
      <Bookmark className={cn(icon, saved && "fill-current")} />
    </button>
  );
};

export default SaveButton;

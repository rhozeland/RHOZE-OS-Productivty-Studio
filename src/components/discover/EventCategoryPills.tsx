/**
 * EventCategoryPills — horizontal pill row for filtering events by category.
 * Compact replacement for the old StreamCategorySection tile grid.
 */
import { cn } from "@/lib/utils";

interface EventCategoryPillsProps {
  defs: ReadonlyArray<{ slug: string; label: string; accent: string }>;
  activeCategory: string | null;
  counts?: Record<string, number>;
  onSelect: (category: string | null) => void;
}

const EventCategoryPills = ({ defs, activeCategory, counts, onSelect }: EventCategoryPillsProps) => {
  const totalCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0",
          activeCategory === null
            ? "bg-foreground text-background shadow-sm"
            : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20",
        )}
      >
        All
        {typeof totalCount === "number" && totalCount > 0 && (
          <span className={cn("text-[10px]", activeCategory === null ? "text-background/70" : "text-muted-foreground")}>
            {totalCount}
          </span>
        )}
      </button>
      {defs.map((def) => {
        const active = activeCategory === def.slug;
        const count = counts?.[def.slug] ?? 0;
        return (
          <button
            key={def.slug}
            type="button"
            onClick={() => onSelect(active ? null : def.slug)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0",
              active
                ? "text-white shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20",
            )}
            style={active ? { background: def.accent } : undefined}
          >
            {def.label}
            {count > 0 && (
              <span className={cn("text-[10px]", active ? "text-white/70" : "text-muted-foreground")}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default EventCategoryPills;

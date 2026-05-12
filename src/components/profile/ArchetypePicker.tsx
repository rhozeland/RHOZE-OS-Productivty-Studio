/**
 * ArchetypePicker — tile-style chooser for the v9.2 archetype branches.
 * Used in Settings → Profile and the onboarding flow.
 */
import { ARCHETYPES, type Archetype } from "@/lib/archetypes";
import { cn } from "@/lib/utils";

interface Props {
  value: Archetype | null;
  onChange: (next: Archetype) => void;
  size?: "sm" | "md";
}

const ArchetypePicker = ({ value, onChange, size = "md" }: Props) => {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-2.5")}>
      {ARCHETYPES.map((a) => {
        const Icon = a.icon;
        const active = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            className={cn(
              "group relative text-left rounded-xl border bg-card/40 transition-all",
              size === "md" ? "p-3.5" : "p-2.5",
              active
                ? a.chipClass + " ring-2 ring-offset-1 ring-offset-background"
                : "border-border hover:border-foreground/40 hover:bg-card/70",
            )}
            style={
              active
                ? ({ "--tw-ring-color": `hsl(var(--${a.token}))` } as React.CSSProperties)
                : undefined
            }
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                  active ? "" : "bg-muted",
                )}
                style={
                  active
                    ? {
                        backgroundColor: `hsl(var(--${a.token}) / 0.18)`,
                        color: `hsl(var(--${a.token}))`,
                      }
                    : undefined
                }
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className={cn("font-semibold text-sm", active ? "" : "text-foreground")}>
                {a.label}
              </span>
            </div>
            <p className={cn("text-[11px] leading-snug", active ? "opacity-90" : "text-muted-foreground")}>
              {a.tagline}
            </p>
          </button>
        );
      })}
    </div>
  );
};

export default ArchetypePicker;

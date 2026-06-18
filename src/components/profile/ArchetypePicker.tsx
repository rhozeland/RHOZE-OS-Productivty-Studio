/**
 * ArchetypePicker — tile-style chooser for archetype branches.
 * Supports single OR multi-select (Settings allows multiple creator types).
 */
import { ARCHETYPES, type Archetype } from "@/lib/archetypes";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type SingleProps = {
  multi?: false;
  value: Archetype | null;
  onChange: (next: Archetype) => void;
  size?: "sm" | "md";
};

type MultiProps = {
  multi: true;
  value: Archetype[];
  onChange: (next: Archetype[]) => void;
  size?: "sm" | "md";
};

type Props = SingleProps | MultiProps;

const ArchetypePicker = (props: Props) => {
  const size = props.size ?? "md";
  const isActive = (id: Archetype) =>
    props.multi ? props.value.includes(id) : props.value === id;

  const handleClick = (id: Archetype) => {
    if (props.multi) {
      const set = new Set<Archetype>(props.value);
      if (set.has(id)) {
        if (set.size === 1) return; // keep at least one
        set.delete(id);
      } else {
        set.add(id);
      }
      const next = ARCHETYPES.map((a) => a.id).filter((k) => set.has(k));
      (props.onChange as (n: Archetype[]) => void)(next);
    } else {
      (props.onChange as (n: Archetype) => void)(id);
    }
  };

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-2.5")}>
      {ARCHETYPES.map((a) => {
        const Icon = a.icon;
        const active = isActive(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => handleClick(a.id)}
            aria-pressed={active}
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
            {props.multi && active && (
              <span
                className="absolute top-1.5 right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full"
                style={{ backgroundColor: `hsl(var(--${a.token}))`, color: "white" }}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
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

/**
 * ArchetypeFilter — Discover triad pills (All · Artists · Builders · Influencers).
 *
 * Lightest-touch surface for the v9.2 creator-branches model: lets people
 * narrow the creators feed by archetype without forcing anyone to identify.
 * Profiles without an archetype set still appear under "All".
 */
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ARCHETYPES, type Archetype } from "@/lib/archetypes";

interface Props {
  value: Archetype | "all";
  onChange: (next: Archetype) => void;
  className?: string;
}

const ArchetypeFilter = ({ value, onChange, className }: Props) => {
  const items: Array<{ id: Archetype; label: string; icon: LucideIcon; tagline?: string; dotToken?: string }> =
    ARCHETYPES.map((a) => ({
      id: a.id,
      label: a.plural,
      icon: a.icon,
      tagline: a.tagline,
      dotToken: a.token,
    }));

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = value === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onChange(it.id)}
              title={it.tagline}
              className={[
                "group relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all",
                active
                  ? "border-foreground bg-foreground text-background shadow-sm"
                  : "border-border/65 bg-card/60 text-foreground/80 hover:border-foreground/45 hover:text-foreground",
              ].join(" ")}
              aria-pressed={active}
            >
              {it.dotToken && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: `hsl(var(--${it.dotToken}))` }}
                  aria-hidden
                />
              )}
              <Icon className="h-3.5 w-3.5" />
              {it.label}
              {active && (
                <motion.span
                  layoutId="archetype-filter-active"
                  className="absolute inset-0 -z-10 rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ArchetypeFilter;

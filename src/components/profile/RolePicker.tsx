import { useMemo, useState } from "react";
import { CREATOR_ROLES, ROLE_BY_ID, SKILL_OPTIONS } from "@/lib/creator-roles";
import { Check, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RolePickerProps {
  selectedRoles: string[];
  onChangeRoles: (next: string[]) => void;
  selectedSpecialties: string[];
  onChangeSpecialties: (next: string[]) => void;
  maxRoles?: number;
}

/**
 * Deterministic accent color per role id. Replaces the old emoji-led chips
 * with a color dot + clean label so the UI feels editorial, not childish.
 */
const ROLE_ACCENTS: Record<string, string> = {
  "music-producer": "bg-rose-500",
  musician: "bg-fuchsia-500",
  "visual-artist": "bg-amber-500",
  illustrator: "bg-orange-500",
  designer: "bg-emerald-500",
  photographer: "bg-sky-500",
  filmmaker: "bg-indigo-500",
  "3d-artist": "bg-cyan-500",
  writer: "bg-yellow-500",
  "fashion-designer": "bg-pink-500",
  developer: "bg-violet-500",
  creator: "bg-teal-500",
  curator: "bg-purple-500",
  performer: "bg-red-500",
};
const accentFor = (id: string) => ROLE_ACCENTS[id] ?? "bg-foreground/40";

export const RolePicker = ({
  selectedRoles,
  onChangeRoles,
  selectedSpecialties,
  onChangeSpecialties,
  maxRoles = 3,
}: RolePickerProps) => {
  const toggleRole = (id: string) => {
    if (selectedRoles.includes(id)) {
      const remaining = selectedRoles.filter((r) => r !== id);
      onChangeRoles(remaining);
      const stillValid = new Set(
        remaining.flatMap((r) => ROLE_BY_ID.get(r)?.specialties ?? []),
      );
      onChangeSpecialties(selectedSpecialties.filter((s) => stillValid.has(s)));
    } else if (selectedRoles.length < maxRoles) {
      onChangeRoles([...selectedRoles, id]);
    }
  };

  const specialtyPool = useMemo(() => {
    const set = new Set<string>();
    selectedRoles.forEach((id) =>
      ROLE_BY_ID.get(id)?.specialties.forEach((s) => set.add(s)),
    );
    return Array.from(set);
  }, [selectedRoles]);

  const toggleSpecialty = (s: string) => {
    if (selectedSpecialties.includes(s)) {
      onChangeSpecialties(selectedSpecialties.filter((x) => x !== s));
    } else {
      onChangeSpecialties([...selectedSpecialties, s]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-medium text-muted-foreground mb-2">
          Pick up to {maxRoles} that describe you
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CREATOR_ROLES.map((role) => {
            const active = selectedRoles.includes(role.id);
            const disabled = !active && selectedRoles.length >= maxRoles;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => toggleRole(role.id)}
                disabled={disabled}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs border transition-all flex items-center gap-1.5",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground/70 hover:text-foreground hover:border-foreground/30",
                  disabled && "opacity-40 cursor-not-allowed",
                )}
              >
                <span
                  aria-hidden
                  className={cn("h-1.5 w-1.5 rounded-full", accentFor(role.id))}
                />
                {role.label}
                {active && <Check className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </div>

      {specialtyPool.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-2">
            Style, genre or medium (optional)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {specialtyPool.map((s) => {
              const active = selectedSpecialties.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecialty(s)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] border transition-all",
                    active
                      ? "border-foreground bg-foreground/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                  {active && <Check className="inline h-2.5 w-2.5 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface SkillPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}

/**
 * Searchable skill picker — type to filter the curated list. Selected
 * skills surface as removable chips above. Custom skills can still be
 * added when the search returns no match.
 */
export const SkillPicker = ({ value, onChange, max = 12 }: SkillPickerProps) => {
  const [query, setQuery] = useState("");

  const add = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed || value.includes(trimmed) || value.length >= max) return;
    onChange([...value, trimmed]);
    setQuery("");
  };
  const remove = (s: string) => onChange(value.filter((x) => x !== s));

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const pool = SKILL_OPTIONS.filter((s) => !value.includes(s));
    if (!q) return pool.slice(0, 0); // show nothing until user types
    return pool.filter((s) => s.toLowerCase().includes(q)).slice(0, 12);
  }, [q, value]);

  const exactExists =
    SKILL_OPTIONS.some((s) => s.toLowerCase() === q) ||
    value.some((s) => s.toLowerCase() === q);

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <span
              key={s}
              className="rounded-full bg-foreground text-background px-2.5 py-1 text-[11px] flex items-center gap-1"
            >
              {s}
              <button
                type="button"
                onClick={() => remove(s)}
                className="opacity-70 hover:opacity-100"
                aria-label={`Remove ${s}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              if (matches[0] && matches[0].toLowerCase().startsWith(q)) {
                add(matches[0]);
              } else if (!exactExists) {
                add(query);
              }
            }
          }}
          placeholder="Search skills — e.g. mixing, color grading, copywriting…"
          className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-xs"
          maxLength={30}
          disabled={value.length >= max}
        />
      </div>

      {q && matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {q && matches.length === 0 && !exactExists && value.length < max && (
        <button
          type="button"
          onClick={() => add(query)}
          className="inline-flex items-center gap-1 text-[11px] text-foreground/80 hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add custom skill "{query.trim()}"
        </button>
      )}

      <p className="text-[10px] text-muted-foreground">
        {value.length}/{max} skills
      </p>
    </div>
  );
};

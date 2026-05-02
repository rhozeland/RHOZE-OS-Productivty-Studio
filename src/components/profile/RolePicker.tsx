import { useMemo, useState } from "react";
import { CREATOR_ROLES, ROLE_BY_ID, SKILL_OPTIONS } from "@/lib/creator-roles";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RolePickerProps {
  selectedRoles: string[];
  onChangeRoles: (next: string[]) => void;
  selectedSpecialties: string[];
  onChangeSpecialties: (next: string[]) => void;
  maxRoles?: number;
}

/**
 * Two-step picker — pick up to N roles, then pick specialties from the union
 * of those roles. Replaces the free-form "headline" + "mediums" inputs so we
 * get clean, matchable data on every profile.
 */
export const RolePicker = ({
  selectedRoles,
  onChangeRoles,
  selectedSpecialties,
  onChangeSpecialties,
  maxRoles = 3,
}: RolePickerProps) => {
  const toggleRole = (id: string) => {
    if (selectedRoles.includes(id)) {
      onChangeRoles(selectedRoles.filter((r) => r !== id));
      // Also drop any specialties that only belong to the removed role.
      const remaining = selectedRoles.filter((r) => r !== id);
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
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground/70 hover:text-foreground hover:border-foreground/30",
                  disabled && "opacity-40 cursor-not-allowed",
                )}
              >
                <span aria-hidden>{role.emoji}</span>
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
                      ? "border-accent bg-accent/15 text-foreground"
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
 * Multi-select skill chips. We still allow a free-form add (some skills are
 * niche), but the curated list does most of the work.
 */
export const SkillPicker = ({ value, onChange, max = 12 }: SkillPickerProps) => {
  const [custom, setCustom] = useState("");

  const toggle = (s: string) => {
    if (value.includes(s)) onChange(value.filter((x) => x !== s));
    else if (value.length < max) onChange([...value, s]);
  };

  const addCustom = () => {
    const trimmed = custom.trim();
    if (!trimmed || value.includes(trimmed) || value.length >= max) return;
    onChange([...value, trimmed]);
    setCustom("");
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <span
              key={s}
              className="rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] flex items-center gap-1"
            >
              {s}
              <button
                type="button"
                onClick={() => toggle(s)}
                className="hover:text-foreground"
                aria-label={`Remove ${s}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {SKILL_OPTIONS.filter((s) => !value.includes(s)).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            disabled={value.length >= max}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add a custom skill…"
          className="flex-1 h-8 rounded-md border border-input bg-background px-2.5 text-xs"
          maxLength={30}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim() || value.length >= max}
          className="h-8 rounded-md border border-border bg-card px-2.5 text-xs flex items-center gap-1 hover:border-foreground/30 disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {value.length}/{max} skills
      </p>
    </div>
  );
};

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ActiveRole = "fan" | "creator";

export const ROLE_STORAGE_KEY = "rhz_active_role";
export const ROLE_CHANGE_EVENT = "rhz:role-change";
export const ROLE_HOME: Record<ActiveRole, string> = {
  fan: "/discover",
  creator: "/home",
};

const readStored = (): ActiveRole => {
  try {
    const v = localStorage.getItem(ROLE_STORAGE_KEY);
    return v === "creator" ? "creator" : "fan";
  } catch {
    return "fan";
  }
};

/**
 * Shared role hook. Source of truth = `profiles.user_type`; localStorage is
 * a same-session cache so unrelated components don't flicker. A custom
 * window event keeps the sidebar nav and the role pill perfectly in sync
 * without an extra Context provider.
 */
export const useActiveRole = (): [ActiveRole, (next: ActiveRole) => void] => {
  const { user } = useAuth();
  const [role, setRole] = useState<ActiveRole>(readStored);

  // Cross-component sync (same tab + other tabs).
  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<ActiveRole>).detail;
      if (detail === "fan" || detail === "creator") setRole(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === ROLE_STORAGE_KEY) setRole(readStored());
    };
    window.addEventListener(ROLE_CHANGE_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ROLE_CHANGE_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Hydrate from the server-of-truth once.
  useQuery({
    queryKey: ["active-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("user_id", user!.id)
        .maybeSingle();
      const next = ((data as any)?.user_type as ActiveRole | null) ?? null;
      if (next && next !== role) {
        setRole(next);
        try { localStorage.setItem(ROLE_STORAGE_KEY, next); } catch {}
      }
      return next;
    },
  });

  const update = async (next: ActiveRole) => {
    setRole(next);
    try { localStorage.setItem(ROLE_STORAGE_KEY, next); } catch {}
    window.dispatchEvent(new CustomEvent(ROLE_CHANGE_EVENT, { detail: next }));
    if (!user) return;

    // When switching to Musician, default a missing archetype so the
    // profile actually surfaces in Discover's Musician section.
    let archetypePatch: { archetype?: string } = {};
    if (next === "creator") {
      const { data: existing } = await supabase
        .from("profiles")
        .select("archetype")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!(existing as any)?.archetype) archetypePatch = { archetype: "musician" };
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(
        { user_id: user.id, user_type: next, ...archetypePatch } as any,
        { onConflict: "user_id" },
      );
    if (error) console.warn("[useActiveRole] persist failed", error);
  };

  return [role, update];
};

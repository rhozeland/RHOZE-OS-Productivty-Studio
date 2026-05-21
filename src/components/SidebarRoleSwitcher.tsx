import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Role = "fan" | "creator";

const STORAGE_KEY = "rhz_active_role";
const ROLE_HOME: Record<Role, string> = {
  fan: "/discover",
  creator: "/dashboard",
};

/**
 * Compact Fan / Creator toggle pill that lives between the Rhozeland logo
 * and the EXPLORE label in the sidebar. Persists the selection on the user's
 * profile (`profiles.user_type`) and mirrors it in localStorage so the last
 * active role survives a return visit before the network round-trip resolves.
 *
 * Tapping the inactive side updates the role and navigates to that role's
 * home — no full page reload, just a router push.
 *
 * Hidden when the sidebar is in icon-only collapsed mode (no room for a pill).
 */
const SidebarRoleSwitcher = ({ collapsed }: { collapsed: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Read persisted role from the profile. Falls back to localStorage, then "fan".
  const { data: profileRole } = useQuery({
    queryKey: ["sidebar-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("user_id", user.id)
        .maybeSingle();
      return ((data as any)?.user_type as Role | null) ?? null;
    },
  });

  const [role, setRole] = useState<Role>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Role | null;
      return stored === "creator" ? "creator" : "fan";
    } catch {
      return "fan";
    }
  });

  // Sync with the server-of-truth once it lands.
  useEffect(() => {
    if (profileRole && profileRole !== role) {
      setRole(profileRole);
      try { localStorage.setItem(STORAGE_KEY, profileRole); } catch {}
    }
  }, [profileRole]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || collapsed) return null;

  const switchTo = async (next: Role) => {
    if (next === role) return;
    setRole(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    // Fire-and-forget DB sync — UI doesn't wait on it.
    supabase
      .from("profiles")
      .update({ user_type: next } as any)
      .eq("user_id", user.id)
      .then(() => qc.invalidateQueries({ queryKey: ["sidebar-role", user.id] }));
    navigate(ROLE_HOME[next]);
  };

  return (
    <div className="px-3 pt-3 pb-1">
      <div
        role="tablist"
        aria-label="View as role"
        className="relative grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1"
      >
        {(["fan", "creator"] as Role[]).map((r) => {
          const active = role === r;
          return (
            <button
              key={r}
              role="tab"
              aria-selected={active}
              onClick={() => switchTo(r)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all duration-200",
                active
                  ? "sidebar-active-gradient text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 px-1 text-[10px] text-muted-foreground/70">
        Viewing as {role === "creator" ? "Creator" : "Fan"}
      </p>
    </div>
  );
};

export default SidebarRoleSwitcher;

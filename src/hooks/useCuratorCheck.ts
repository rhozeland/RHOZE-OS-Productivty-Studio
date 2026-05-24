/**
 * useCuratorCheck — returns true if the signed-in user has `curator` OR
 * `admin` role. Used to gate the Concierge inbox (`/curator`) so trusted
 * Verified Pros can triage briefs without full admin access.
 *
 * Conversion to a paid project (the 25% fee lock) remains admin-only and is
 * enforced server-side in `convert_concierge_request`.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCuratorCheck() {
  const { user } = useAuth();
  const [isCurator, setIsCurator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsCurator(false);
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const [adminRes, curatorRes] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "curator" as any }),
      ]);
      if (!alive) return;
      const admin = !adminRes.error && adminRes.data === true;
      const curator = !curatorRes.error && curatorRes.data === true;
      setIsAdmin(admin);
      setIsCurator(admin || curator);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  return { isCurator, isAdmin, loading };
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ProjectRole = "owner" | "admin" | "member" | null;

/**
 * Resolves the current user's role on a project (owner | admin | member | null).
 * Convenience booleans:
 *   - canManage  → owner OR admin (edit settings, manage team, upload moodboard, etc.)
 *   - canView    → any role (RLS already enforces this server-side)
 *   - isOwner    → only the project creator
 */
export function useProjectRole(projectId?: string) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["project-role", projectId, user?.id],
    enabled: !!projectId && !!user?.id,
    queryFn: async (): Promise<ProjectRole> => {
      const { data, error } = await supabase.rpc("project_member_role", {
        _project_id: projectId!,
        _user_id: user!.id,
      });
      if (error) throw error;
      return (data as ProjectRole) ?? null;
    },
    staleTime: 30_000,
  });

  const role = (query.data ?? null) as ProjectRole;

  return {
    role,
    isLoading: query.isLoading,
    isOwner: role === "owner",
    isAdmin: role === "admin",
    isMember: role === "member",
    canManage: role === "owner" || role === "admin",
    canView: role !== null,
  };
}

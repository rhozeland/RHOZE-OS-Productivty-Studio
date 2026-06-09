/**
 * Backers section for the Team tab — lists supporters who cheered this project.
 * Hidden entirely when there are zero backers (no empty state).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

interface Props {
  projectId: string;
}

const ProjectBackers = ({ projectId }: Props) => {
  const { data: backers } = useQuery({
    queryKey: ["project-backers", projectId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("project_cheers")
        .select("user_id, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (!rows?.length) return [] as any[];
      const ids = rows.map((r) => r.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      return rows.map((r) => ({ ...r, profile: profs?.find((p) => p.user_id === r.user_id) }));
    },
  });

  if (!backers || backers.length === 0) return null;

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        <Heart className="h-3.5 w-3.5" /> Backers
        <span className="text-muted-foreground/60 normal-case tracking-normal">· {backers.length}</span>
      </h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {backers.map((b: any) => (
          <li key={b.user_id}>
            <Link
              to={`/profile/${b.profile?.username ?? b.user_id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors"
            >
              {b.profile?.avatar_url ? (
                <img src={b.profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-foreground">
                  {b.profile?.display_name ?? b.profile?.username ?? "Fan"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Backed{" "}
                  {b.created_at &&
                    new Date(b.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ProjectBackers;

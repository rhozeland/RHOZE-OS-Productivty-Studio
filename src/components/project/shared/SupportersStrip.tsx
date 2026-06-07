/**
 * Team + Supporters column for the Overview tab. Team uses
 * project_collaborators; Supporters uses project_cheers (no $ amount today,
 * just the list of fans who cheered the public release). Recent activity is a
 * thin feed mixing milestone completions + cheers, newest first.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Heart, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  projectId: string;
  ownerId: string;
  owner: { display_name?: string | null; username?: string | null; avatar_url?: string | null } | null;
  team: Array<{ user_id: string; project_role?: string | null; profile?: any }> | null | undefined;
  milestones?: Array<{ id: string; title: string; status?: string | null; updated_at?: string | null }> | null;
}

const SupportersStrip = ({ projectId, ownerId, owner, team, milestones }: Props) => {
  const { data: cheers } = useQuery({
    queryKey: ["project-cheerers", projectId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("project_cheers")
        .select("user_id, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(12);
      if (!rows?.length) return [] as any[];
      const ids = rows.map((r) => r.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      return rows.map((r) => ({ ...r, profile: profs?.find((p) => p.user_id === r.user_id) }));
    },
  });

  const recentMs = (milestones ?? [])
    .filter((m) => m.status === "approved" || m.status === "released")
    .slice(-3)
    .reverse();

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Team
        </h3>
        <ul className="space-y-1.5">
          <li>
            <Link
              to={`/profile/${owner?.username ?? ownerId}`}
              className="flex items-center gap-2 rounded-lg p-2 -mx-2 hover:bg-card"
            >
              {owner?.avatar_url ? (
                <img src={owner.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{owner?.display_name ?? owner?.username ?? "Artist"}</div>
                <div className="text-[10px] text-muted-foreground">Owner</div>
              </div>
            </Link>
          </li>
          {(team ?? []).map((t) => (
            <li key={t.user_id}>
              <Link
                to={`/profile/${t.profile?.username ?? t.user_id}`}
                className="flex items-center gap-2 rounded-lg p-2 -mx-2 hover:bg-card"
              >
                {t.profile?.avatar_url ? (
                  <img src={t.profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">
                    {t.profile?.display_name ?? t.profile?.username ?? "Collaborator"}
                  </div>
                  <div className="text-[10px] text-muted-foreground capitalize">{t.project_role ?? "Member"}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Heart className="h-3 w-3" /> Supporters
        </h3>
        {!cheers?.length ? (
          <p className="text-[11px] text-muted-foreground">No supporters yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {cheers.map((c: any) => (
              <li key={c.user_id} className="flex items-center gap-2 rounded-lg p-1.5 -mx-1.5 hover:bg-card">
                {c.profile?.avatar_url ? (
                  <img src={c.profile.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted" />
                )}
                <span className="text-[11px] font-medium truncate flex-1">
                  {c.profile?.display_name ?? c.profile?.username ?? "Fan"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {c.created_at && new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recentMs.length > 0 && (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Recent activity
          </h3>
          <ul className="space-y-2">
            {recentMs.map((m) => (
              <li key={m.id} className="flex items-start gap-2 text-[11px]">
                <span className="mt-0.5 h-4 w-4 rounded-full bg-emerald-500/15 grid place-items-center shrink-0">
                  <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.title}</div>
                  <div className="text-muted-foreground text-[10px]">Milestone completed</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default SupportersStrip;

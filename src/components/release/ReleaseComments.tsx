/**
 * ReleaseComments — public comment thread for a release page.
 * Reads/writes `project_comments`. Anyone can read; signed-in users post.
 */
import { useState, forwardRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

interface Row {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface Props {
  projectId: string;
}

const ReleaseComments = forwardRef<HTMLDivElement, Props>(({ projectId }, ref) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["release-comments", projectId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("project_comments")
        .select("id, user_id, body, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
      const authors = new Map<string, Row["author"]>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", ids);
        (profs ?? []).forEach((p: any) =>
          authors.set(p.user_id, {
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url,
          }),
        );
      }
      return (data ?? []).map((r: any) => ({ ...r, author: authors.get(r.user_id) ?? null }));
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to comment");
      const trimmed = body.trim();
      if (trimmed.length < 1) throw new Error("Write something first");
      const { error } = await supabase
        .from("project_comments")
        .insert({ project_id: projectId, user_id: user.id, body: trimmed });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["release-comments", projectId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not post"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["release-comments", projectId] }),
    onError: (e: any) => toast.error(e?.message ?? "Could not delete"),
  });

  return (
    <section ref={ref} id="comments" className="space-y-4 scroll-mt-20">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <MessageCircle className="h-4 w-4" /> Comments
        <span className="text-xs text-muted-foreground font-normal">({rows.length})</span>
      </h2>

      {!user && (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="underline">Sign in</Link> to view the conversation.
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Be the first to comment.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const name = r.author?.display_name ?? r.author?.username ?? "Supporter";
            const handle = r.author?.username ? `/profile/${r.author.username}` : `/profile/${r.user_id}`;
            const mine = user?.id === r.user_id;
            return (
              <li key={r.id} className="flex gap-3 rounded-xl border border-border bg-card/30 p-3">
                <Link to={handle} className="shrink-0">
                  {r.author?.avatar_url ? (
                    <img src={r.author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-[10px] font-bold text-muted-foreground">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <Link to={handle} className="font-semibold hover:underline truncate">{name}</Link>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                    {mine && (
                      <button
                        onClick={() => remove.mutate(r.id)}
                        className="ml-auto text-muted-foreground hover:text-destructive"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap leading-relaxed">{r.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
});

ReleaseComments.displayName = "ReleaseComments";
export default ReleaseComments;

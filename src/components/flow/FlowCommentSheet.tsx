/**
 * FlowCommentSheet — bottom sheet thread for a Flow item.
 *
 * Replaces the old "Save to Smartboard" pop-up. Slides up from bottom,
 * shows comments + a compose box. Public read; auth required to post.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface FlowCommentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowItemId: string | null;
  itemTitle?: string | null;
}

const initials = (n?: string | null) =>
  (n ?? "·").split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();

const FlowCommentSheet = ({ open, onOpenChange, flowItemId, itemTitle }: FlowCommentSheetProps) => {
  const { user } = useAuth();
  const { isAdmin } = useAdminCheck();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data: comments, isLoading } = useQuery({
    queryKey: ["flow-comments", flowItemId],
    enabled: open && !!flowItemId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("flow_comments")
        .select("id, body, created_at, user_id")
        .eq("flow_item_id", flowItemId!)
        .order("created_at", { ascending: false })
        .limit(100);
      const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
      const profiles = ids.length
        ? (await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids)).data ?? []
        : [];
      const pmap = new Map(profiles.map((p: any) => [p.user_id, p]));
      return (rows ?? []).map((r: any) => ({ ...r, profile: pmap.get(r.user_id) }));
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      const trimmed = body.trim();
      if (!trimmed || !user || !flowItemId) throw new Error("Sign in to comment");
      const { error } = await supabase.from("flow_comments").insert({
        flow_item_id: flowItemId, user_id: user.id, body: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["flow-comments", flowItemId] });
    },
    onError: (e: any) => toast.error(e.message || "Couldn't post"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flow_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flow-comments", flowItemId] }),
    onError: (e: any) => toast.error(e.message || "Couldn't delete"),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[75vh] rounded-t-3xl bg-card/95 backdrop-blur-xl border-t border-border/60 flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-base">
            Comments {itemTitle && <span className="text-muted-foreground font-body font-normal">· {itemTitle}</span>}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-3 space-y-3 min-h-[120px]">
          {isLoading && (
            <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          )}
          {!isLoading && comments?.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Be the first to say something.</p>
          )}
          {comments?.map((c: any) => {
            const canDelete = user && (c.user_id === user.id || isAdmin);
            return (
              <div key={c.id} className="flex gap-3 group">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={c.profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {initials(c.profile?.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {c.profile?.display_name || "User"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words mt-0.5">{c.body}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => remove.mutate(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border/60 -mx-6 px-6 pt-3 flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={user ? "Add a comment…" : "Sign in to comment"}
            disabled={!user || post.isPending}
            rows={1}
            className="flex-1 resize-none rounded-2xl text-sm min-h-[40px] max-h-[120px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (body.trim()) post.mutate();
              }
            }}
          />
          <Button
            size="sm"
            disabled={!user || !body.trim() || post.isPending}
            onClick={() => post.mutate()}
            className="rounded-full h-10 px-4"
          >
            {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FlowCommentSheet;

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Trash2, Search, Loader2, Send, AlertTriangle, ExternalLink, Film, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type FlowItem = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  content_type: string | null;
  user_id: string;
  created_at: string;
  file_url: string | null;
  link_url: string | null;
  creator_name: string | null;
};

const isVideo = (item: FlowItem) =>
  (item.content_type || "").startsWith("video") ||
  /\.(mp4|webm|mov|m4v)(\?|$)/i.test(item.file_url || "");

/**
 * AdminFlowModeration
 * ─────────────────────────────────────────────────────────────
 * Dedicated admin moderation surface for Flow items. Replaces the
 * in-card Remove/Delete affordances on FlowCard. Surfaces a media
 * thumbnail, creator, and quick Warn / Remove actions.
 */
const AdminFlowModeration = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [deleteTarget, setDeleteTarget] = useState<FlowItem | null>(null);
  const [warningTarget, setWarningTarget] = useState<{ userId: string; displayName: string; reason: string } | null>(null);
  const [warningMessage, setWarningMessage] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-flow-moderation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_items")
        .select("id, title, description, category, content_type, user_id, created_at, file_url, link_url, creator_name")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as FlowItem[];
    },
  });

  const userIds = useMemo(() => [...new Set((items || []).map((i) => i.user_id))], [items]);
  const { data: profiles } = useQuery({
    queryKey: ["admin-flow-mod-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.rpc("get_profiles_by_ids", { _ids: userIds });
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const getName = (uid: string, fallback?: string | null) => {
    const p = (profiles as any[])?.find((pr: any) => pr.user_id === uid);
    return p?.display_name || fallback || uid.slice(0, 8);
  };

  const deleteItem = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      const { error } = await supabase.from("flow_items").delete().eq("id", deleteTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-flow-moderation"] });
      toast.success(`Removed "${deleteTarget?.title}"`);
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendWarning = useMutation({
    mutationFn: async () => {
      if (!warningTarget) return;
      const { error } = await supabase.from("notifications").insert({
        user_id: warningTarget.userId,
        title: "⚠️ Content Warning from Rhozeland",
        body:
          warningMessage ||
          `Your Flow post "${warningTarget.reason}" has been flagged for review. Please ensure your posts follow community guidelines. Repeated violations may result in account suspension.`,
        type: "warning",
        link: "/settings",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Warning sent to ${warningTarget?.displayName}`);
      setWarningTarget(null);
      setWarningMessage("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = items || [];
    const q = search.trim().toLowerCase();
    return list.filter((i) => {
      if (filter === "image" && isVideo(i)) return false;
      if (filter === "video" && !isVideo(i)) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q) ||
        (i.creator_name || "").toLowerCase().includes(q)
      );
    });
  }, [items, filter, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">Flow Moderation</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and remove Flow items. Replaces the in-card Remove action.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{(items || []).length} total</Badge>
          <Badge variant="outline">{filtered.length} shown</Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, description, or creator…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs">
          {(["all", "image", "video"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full capitalize transition-colors ${
                filter === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No flow items match.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item) => {
            const video = isVideo(item);
            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[9/16] bg-muted">
                  {item.file_url ? (
                    video ? (
                      <video
                        src={item.file_url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img src={item.file_url} alt={item.title} className="h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      {video ? <Film className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    <Badge variant="secondary" className="text-[9px] gap-1">
                      {video ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                      {video ? "Video" : "Image"}
                    </Badge>
                    {item.category && (
                      <Badge variant="outline" className="text-[9px] capitalize bg-background/70">
                        {item.category}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="p-3 space-y-2 flex-1 flex flex-col">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    by {getName(item.user_id, item.creator_name)} · {format(new Date(item.created_at), "MMM d, yyyy")}
                  </p>
                  {item.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                  <div className="mt-auto flex items-center gap-1.5 pt-2">
                    {item.link_url && (
                      <a
                        href={item.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" /> Link
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto h-7 text-[10px] gap-1"
                      onClick={() => {
                        setWarningTarget({
                          userId: item.user_id,
                          displayName: getName(item.user_id, item.creator_name),
                          reason: item.title,
                        });
                        setWarningMessage("");
                      }}
                    >
                      <Send className="h-3 w-3" /> Warn
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Remove Flow Item
            </DialogTitle>
            <DialogDescription>
              Permanently remove "{deleteTarget?.title}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteItem.mutate()}
              disabled={deleteItem.isPending}
              className="gap-1.5"
            >
              {deleteItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning dialog */}
      <Dialog open={!!warningTarget} onOpenChange={(o) => !o && setWarningTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Send Warning
            </DialogTitle>
            <DialogDescription>
              Send a warning notification to {warningTarget?.displayName} about "{warningTarget?.reason}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={warningMessage}
              onChange={(e) => setWarningMessage(e.target.value)}
              placeholder="Leave blank for default warning message…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarningTarget(null)}>Cancel</Button>
            <Button onClick={() => sendWarning.mutate()} disabled={sendWarning.isPending} className="gap-1.5">
              {sendWarning.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Warning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFlowModeration;

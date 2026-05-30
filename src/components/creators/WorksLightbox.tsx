/**
 * WorksLightbox — modal grid of a user's uploaded works.
 *
 * Opens from the "Works" stat on the Creator Pass card. Shows every work the
 * user has uploaded with a filter between **All** (everything, incl. Flow
 * posts marked `is_unverified`) and **Verified** (provenance-anchored works,
 * `is_unverified=false`). Cover thumbnails fall back to a tinted gradient
 * when the file isn't an image.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, FileText, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { SubscriberLock } from "@/components/profile/SubscriberLock";
import WorkTokenChip from "@/components/works/WorkTokenChip";
import AttachCoinToWorkButton from "@/components/works/AttachCoinToWorkButton";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

type Filter = "all" | "verified";

const WorksLightbox = ({ open, onOpenChange, userId }: Props) => {
  const [filter, setFilter] = useState<Filter>("all");
  const { user } = useAuth();
  const isOwner = user?.id === userId;

  const { data: works = [], isLoading } = useQuery({
    queryKey: ["works-lightbox", userId, user?.id ?? "anon"],
    enabled: open && !!userId,
    queryFn: async () => {
      // RLS auto-filters to: public + (owner OR subscriber). Subscribing
      // automatically unlocks any private/subscriber-only rows on next fetch.
      const { data } = await supabase
        .from("works")
        .select("id, title, file_url, mime_type, kind, visibility, is_unverified, anchored_at, created_at, user_id, linked_token_mint")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(120);
      return data ?? [];
    },
  });

  // How many subscriber-only posts the viewer can't see — drives the upsell.
  const { data: lockedCount = 0 } = useQuery({
    queryKey: ["works-locked-count", userId, user?.id ?? "anon"],
    enabled: open && !!userId && !isOwner,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "count_locked_works_for_creator",
        { _creator_id: userId },
      );
      if (error) return 0;
      return (data as number) ?? 0;
    },
  });

  // Creator handle for the lock card upsell copy.
  const { data: creator } = useQuery({
    queryKey: ["lightbox-creator", userId],
    enabled: open && !!userId && !isOwner && lockedCount > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
  });

  const filtered = filter === "verified"
    ? works.filter((w: any) => w.is_unverified === false)
    : works;

  const verifiedCount = works.filter((w: any) => w.is_unverified === false).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Works</DialogTitle>
        </DialogHeader>

        {/* Filter chips */}
        <div className="flex items-center gap-2 -mt-2">
          {([
            { id: "all" as Filter, label: "All", count: works.length },
            { id: "verified" as Filter, label: "Verified", count: verifiedCount },
          ]).map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === chip.id
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted",
              )}
            >
              {chip.id === "verified" && <ShieldCheck className="h-3 w-3" />}
              {chip.label}
              <span className="opacity-60 tabular-nums">· {chip.count}</span>
            </button>
          ))}
        </div>

        {/* Subscriber-only posts upsell — auto-disappears once subscribed
            (RLS unlocks them and lockedCount drops to 0). */}
        {!isOwner && lockedCount > 0 && (
          <div className="mt-3">
            <SubscriberLock
              creatorId={userId}
              creatorName={creator?.display_name ?? undefined}
              creatorUsername={creator?.username ?? undefined}
              unlockLabel={`${lockedCount} ${lockedCount === 1 ? "post" : "posts"}`}
            >
              {/* Children never render for non-subs; placeholder kept for type. */}
              <span />
            </SubscriberLock>
          </div>
        )}


        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {filter === "verified"
              ? "No verified works yet — register one in Verified IP."
              : "No works uploaded yet."}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2">
            {filtered.map((w: any) => {
              const isImage = (w.mime_type || "").startsWith("image/");
              const verified = w.is_unverified === false;
              return (
                <Link
                  key={w.id}
                  to={`/credits?tab=works`}
                  onClick={() => onOpenChange(false)}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-muted border border-border hover:border-foreground/40 transition-colors"
                >
                  {isImage && w.file_url ? (
                    <img src={w.file_url} alt={w.title} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-fuchsia-500/20 to-amber-400/20 flex items-center justify-center">
                      <FileText className="h-8 w-8 text-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  {verified && (
                    <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 text-white text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold">
                      <ShieldCheck className="h-2.5 w-2.5" /> Verified
                    </div>
                  )}
                  {w.linked_token_mint && (
                    <div className="absolute top-2 left-2" onClick={(e) => e.preventDefault()}>
                      <WorkTokenChip mint={w.linked_token_mint} variant="compact" />
                    </div>
                  )}
                  <div className="absolute inset-x-2 bottom-2 text-white">
                    <p className="text-[11px] font-semibold leading-tight line-clamp-2 drop-shadow">{w.title}</p>
                    <p className="text-[9px] opacity-80 mt-0.5">
                      {format(new Date(w.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  {isOwner && (
                    <div
                      className="absolute bottom-2 right-2"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    >
                      <AttachCoinToWorkButton
                        workId={w.id}
                        workOwnerId={w.user_id}
                        currentMint={w.linked_token_mint}
                      />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border/50 mt-2">
          <Link
            to="/credits?tab=works"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Open Verified IP <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorksLightbox;

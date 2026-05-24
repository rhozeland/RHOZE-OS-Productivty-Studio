/**
 * SubscribedFeed — v10.3 Home merge.
 *
 * The "subscribed creators first" rail that sits at the top of /discover's
 * Feed when the viewer is signed in and subscribed to ≥1 creator. Renders
 * up to 12 recent works from those creators as a compact horizontal strip,
 * with a link into Flow Mode for the fullscreen swipe experience.
 *
 * If the viewer has no subs (or is a guest), the component renders nothing
 * so the Fresh feed below stays the default. No skeleton, no empty state —
 * silent fallthrough keeps the page honest.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, ArrowRight } from "lucide-react";

const SubscribedFeed = () => {
  const { user } = useAuth();

  const { data: works } = useQuery({
    queryKey: ["subscribed-feed", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      // 1. Which creators am I actively subscribed to?
      const { data: subs } = await supabase
        .from("creator_subscriptions")
        .select("creator_id")
        .eq("subscriber_id", user!.id)
        .eq("status", "active");
      const creatorIds = (subs ?? []).map((s: any) => s.creator_id);
      if (!creatorIds.length) return [];

      // creator_subscriptions.creator_id → profiles.id. Map back to user_id
      // because works.user_id is the auth user id.
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, username, avatar_url")
        .in("id", creatorIds);
      const profByUser = new Map(
        (profs ?? []).map((p: any) => [p.user_id, p]),
      );
      const userIds = (profs ?? []).map((p: any) => p.user_id);
      if (!userIds.length) return [];

      const { data: w } = await supabase
        .from("works")
        .select("id, user_id, title, thumbnail_url, file_url, created_at")
        .in("user_id", userIds)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(12);

      return (w ?? []).map((row: any) => ({
        ...row,
        creator: profByUser.get(row.user_id),
      }));
    },
  });

  // Guests have a dedicated "members get" strip above — stay silent here.
  if (!user) return null;

  // Signed-in but no subs yet: show a soft prompt instead of vanishing,
  // so people understand what subscribing unlocks on /discover.
  if (!works || works.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border/60 bg-gradient-to-br from-primary/[0.04] via-background to-accent/[0.04] p-5 flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Your private feed is empty
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground max-w-md">
            Back a creator from $5/mo and their behind-the-scenes works, drops, and
            DMs land here first.
          </p>
          <Link
            to="/profiles"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:gap-1.5 transition-all"
          >
            Find creators to back <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-foreground/70" />
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            From creators you back
          </h3>
        </div>
        <Link
          to="/flow"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Open Flow <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
        {works.map((w: any) => {
          const c = w.creator;
          const name = c?.display_name ?? c?.username ?? "Creator";
          const cover = w.thumbnail_url || w.file_url;
          return (
            <Link
              key={w.id}
              to={c ? `/profiles/${c.user_id}` : "/discover"}
              className="group relative shrink-0 w-[180px] h-[240px] rounded-2xl overflow-hidden border border-border bg-card snap-start hover:border-foreground/40 transition-colors"
            >
              {cover ? (
                <img
                  src={cover}
                  alt={w.title ?? ""}
                  className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-muted to-background" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-white space-y-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Avatar className="h-5 w-5 ring-1 ring-white/40">
                    <AvatarImage src={c?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] font-medium truncate">{name}</span>
                </div>
                {w.title && (
                  <p className="text-xs font-semibold leading-tight line-clamp-2">
                    {w.title}
                  </p>
                )}
                <p className="text-[10px] text-white/60">
                  {formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default SubscribedFeed;

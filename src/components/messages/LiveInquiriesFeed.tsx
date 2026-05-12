/**
 * LiveInquiriesFeed — a live two-lane feed of active listings.
 *
 * Lane A (Yours): your own active listings, with a real-time pending-
 * inquiries count badge and quick CTAs (Open inquiries, View listing).
 *
 * Lane B (From other creators): the freshest live listings posted by
 * everyone else on the platform, with quick CTAs to either DM the creator
 * directly or jump to the listing detail page (which carries the
 * pre-built "Send inquiry" form).
 *
 * Both lanes subscribe to `listing_inquiries` realtime events so badges
 * stay current without a manual refresh.
 */
import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Store, MessageSquare, Send, Inbox, ArrowRight, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  userId: string;
}

const LiveInquiriesFeed = ({ userId }: Props) => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Lane A: my own active listings
  const { data: myListings } = useQuery({
    queryKey: ["live-feed-mine", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id, title, category, price, credits_price, cover_url, image_url, created_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const myIds = useMemo(() => (myListings ?? []).map((l: any) => l.id), [myListings]);

  // Pending inquiry counts per listing
  const { data: pendingCounts } = useQuery({
    queryKey: ["live-feed-pending", myIds],
    enabled: myIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_inquiries")
        .select("listing_id")
        .eq("receiver_id", userId)
        .eq("status", "pending")
        .in("listing_id", myIds);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of data ?? []) {
        map.set(r.listing_id, (map.get(r.listing_id) ?? 0) + 1);
      }
      return map;
    },
  });

  // Lane B: live listings from other creators
  const { data: othersListings } = useQuery({
    queryKey: ["live-feed-others", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id, user_id, title, category, price, credits_price, cover_url, image_url, created_at, listing_type")
        .neq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ownerIds = useMemo(
    () => [...new Set((othersListings ?? []).map((l: any) => l.user_id))],
    [othersListings],
  );

  const { data: ownerProfiles } = useQuery({
    queryKey: ["live-feed-owners", ownerIds],
    enabled: ownerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profiles_by_ids", { _ids: ownerIds });
      if (error) throw error;
      return data ?? [];
    },
  });

  const ownerMap = new Map(
    (ownerProfiles ?? []).map((p: any) => [
      p.user_id,
      { name: p.display_name, avatar: p.avatar_url },
    ]),
  );

  // Realtime: keep pending badges + new-listings lane fresh
  useEffect(() => {
    const ch = supabase
      .channel("live-inquiries-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listing_inquiries" },
        () => qc.invalidateQueries({ queryKey: ["live-feed-pending"] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "marketplace_listings" },
        () => {
          qc.invalidateQueries({ queryKey: ["live-feed-mine"] });
          qc.invalidateQueries({ queryKey: ["live-feed-others"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const priceLabel = (l: any) =>
    l.credits_price
      ? `${l.credits_price} $RHOZE`
      : l.price
        ? `$${Number(l.price).toFixed(0)}`
        : "Inquire";

  return (
    <div className="space-y-5">
      {/* Lane A — Your active listings */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Store className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Your active listings</h3>
          <span className="text-[11px] text-muted-foreground">Live count of new inquiries.</span>
        </div>

        {!myListings?.length ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              You have no live listings yet. Post one to start receiving inquiries.
            </p>
          </div>
        ) : (
          <ScrollArea>
            <div className="flex gap-3 pb-2">
              {myListings.map((l: any) => {
                const pending = pendingCounts?.get(l.id) ?? 0;
                const cover = l.cover_url || l.image_url;
                return (
                  <div
                    key={l.id}
                    className="surface-card w-[240px] shrink-0 overflow-hidden flex flex-col"
                  >
                    <div className="relative h-24 bg-gradient-to-br from-primary/15 to-primary/5">
                      {cover ? (
                        <img src={cover} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Store className="h-6 w-6 text-primary/40" />
                        </div>
                      )}
                      {pending > 0 && (
                        <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground border-0 gap-1">
                          <Inbox className="h-3 w-3" /> {pending} new
                        </Badge>
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground line-clamp-1">
                          {l.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{priceLabel(l)}</p>
                      </div>
                      <div className="mt-auto flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant={pending > 0 ? "default" : "outline"}
                          className="h-7 px-2.5 rounded-full text-xs gap-1 flex-1"
                          onClick={() => {
                            const el = document.getElementById("inquiries-section");
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          <Inbox className="h-3 w-3" />
                          {pending > 0 ? "Open inquiries" : "View"}
                        </Button>
                        <Link to={`/marketplace/${l.id}`} title="Open listing">
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </section>

      {/* Lane B — From other creators */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">From other creators</h3>
          <span className="text-[11px] text-muted-foreground">Fresh listings — start a conversation.</span>
        </div>

        {!othersListings?.length ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center">
            <p className="text-xs text-muted-foreground">No live listings from other creators right now.</p>
          </div>
        ) : (
          <ScrollArea>
            <div className="flex gap-3 pb-2">
              {othersListings.map((l: any) => {
                const owner = ownerMap.get(l.user_id);
                const cover = l.cover_url || l.image_url;
                return (
                  <div
                    key={l.id}
                    className="surface-card w-[240px] shrink-0 overflow-hidden flex flex-col"
                  >
                    <div className="relative h-24 bg-gradient-to-br from-amber-500/15 to-amber-500/5">
                      {cover ? (
                        <img src={cover} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Store className="h-6 w-6 text-amber-500/50" />
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 text-[10px] font-medium bg-background/90 text-foreground rounded-full px-2 py-0.5">
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="p-3 flex-1 flex flex-col gap-2">
                      <div className="space-y-0.5">
                        <Link
                          to={`/marketplace/${l.id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary line-clamp-1"
                        >
                          {l.title}
                        </Link>
                        {owner && (
                          <Link
                            to={`/profiles/${l.user_id}`}
                            className="text-[11px] text-muted-foreground hover:text-foreground line-clamp-1"
                          >
                            by {owner.name || "Creator"}
                          </Link>
                        )}
                        <p className="text-[11px] text-foreground/80">{priceLabel(l)}</p>
                      </div>
                      <div className="mt-auto flex items-center gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 px-2.5 rounded-full text-xs gap-1 flex-1"
                          onClick={() =>
                            navigate(
                              `/marketplace/${l.id}?inquire=1`,
                            )
                          }
                        >
                          <Send className="h-3 w-3" /> Inquire
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 rounded-full text-xs gap-1"
                          onClick={() =>
                            navigate(
                              `/messages?to=${l.user_id}&listing=${encodeURIComponent(l.title)}`,
                            )
                          }
                          title="Message creator"
                        >
                          <MessageSquare className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </section>
    </div>
  );
};

export default LiveInquiriesFeed;

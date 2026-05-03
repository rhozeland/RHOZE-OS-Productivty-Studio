/**
 * EventDetailPage — Luma-style 2-column public detail view at /spaces/events/:id.
 *
 * Left column: cover, title, host, description, manifest/anchor proof.
 * Right column (sticky on lg+): when/where card + ticket tiers + buy CTA.
 * Hosts of paid events see a small note that the platform fee scales
 * with their tier (Spark/Bloom 15% · Glow 10% · Play 7%) — no reserve.
 */
import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  CalendarDays,
  MapPin,
  Globe2,
  Ticket,
  Sparkles,
  ArrowLeft,
  Settings,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Clock,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { shortHash } from "@/lib/content-hash";
import TicketCheckoutDialog from "@/components/events/TicketCheckoutDialog";
import EventInviteBanner from "@/components/events/EventInviteBanner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const EventDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [checkoutTier, setCheckoutTier] = useState<any | null>(null);

  const { data: ev, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: tiers } = useQuery({
    queryKey: ["event-tiers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_ticket_tiers")
        .select("*")
        .eq("event_id", id!)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: myTicket } = useQuery({
    queryKey: ["event-my-ticket", id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tickets")
        .select("*")
        .eq("event_id", id!)
        .eq("holder_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: isCollaborator } = useQuery({
    queryKey: ["event-is-collab", id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_collaborators")
        .select("id")
        .eq("event_id", id!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: hostProfile } = useQuery({
    queryKey: ["event-host-profile", ev?.host_id],
    enabled: !!ev?.host_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .eq("user_id", ev!.host_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: coHosts = [] } = useQuery({
    queryKey: ["event-cohosts", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("event_collaborators")
        .select("user_id, role")
        .eq("event_id", id!)
        .eq("status", "accepted");
      const ids = (rows ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      return (rows ?? []).map((r: any) => ({ ...r, profile: map.get(r.user_id) }));
    },
  });

  const { data: goingData } = useQuery({
    queryKey: ["event-going", id],
    enabled: !!id,
    queryFn: async () => {
      const { count } = await supabase
        .from("event_tickets")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id!)
        .in("status", ["issued", "checked_in"]);
      const { data: recent } = await supabase
        .from("event_tickets")
        .select("holder_id")
        .eq("event_id", id!)
        .in("status", ["issued", "checked_in"])
        .order("created_at", { ascending: false })
        .limit(8);
      const holderIds = (recent ?? []).map((r: any) => r.holder_id);
      let avatars: any[] = [];
      if (holderIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", holderIds);
        avatars = profs ?? [];
      }
      return { count: count ?? 0, avatars };
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: async (tierId: string) => {
      if (!user) throw new Error("Sign in to RSVP");
      const qr_token = `tk_${crypto.randomUUID().replace(/-/g, "")}`;
      const { data, error } = await supabase
        .from("event_tickets")
        .insert([{
          event_id: id!,
          holder_id: user.id,
          tier_id: tierId,
          qr_token,
          purchase_currency: "free",
          amount_paid: 0,
          status: "issued",
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (ticket) => {
      toast.success("You're in", { description: "Your ticket is ready." });
      qc.invalidateQueries({ queryKey: ["event-my-ticket", id] });
      navigate(`/tickets/${ticket.id}`);
    },
    onError: (err: unknown) => {
      toast.error("RSVP failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (!ev) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Event not found</h1>
        <Link to="/discover?view=events">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Events
          </Button>
        </Link>
      </div>
    );
  }

  const isHost = user?.id === ev.host_id;
  const canManage = isHost || isCollaborator;
  const start = new Date(ev.starts_at);
  const end = new Date(ev.ends_at);
  const hasPaidTier = (tiers ?? []).some(
    (t: any) => (Number(t.price_usd) || 0) > 0 || (Number(t.price_rhoze) || 0) > 0
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/discover?view=events"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All events
        </Link>
        {canManage && (
          <Link to={`/spaces/events/${ev.id}/manage`}>
            <Button variant="outline" size="sm" className="rounded-full gap-1.5">
              <Settings className="h-3.5 w-3.5" /> Manage Event
            </Button>
          </Link>
        )}
      </div>

      <EventInviteBanner eventId={ev.id} eventTitle={ev.title} />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 items-start">
        {/* LEFT — small cover + presenter + hosts + going (Luma style) */}
        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5 min-w-0 lg:sticky lg:top-20"
        >
          {/* Square cover */}
          <div className="rounded-2xl overflow-hidden border border-border bg-card">
            <div className="aspect-square bg-muted relative overflow-hidden">
              {ev.cover_url ? (
                <img src={ev.cover_url} alt={ev.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/10">
                  <CalendarDays className="h-14 w-14 text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute top-3 left-3 rounded-full bg-background/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium capitalize">
                {ev.category}
              </div>
            </div>
          </div>

          {/* Hosted By */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Hosted By</h2>
            <div className="h-px bg-border" />
            <div className="space-y-2 pt-1">
              {hostProfile && (
                <Link
                  to={`/profiles/${hostProfile.user_id}`}
                  className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={hostProfile.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(hostProfile.display_name ?? hostProfile.username ?? "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium truncate">
                    {hostProfile.display_name ?? hostProfile.username ?? "Host"}
                  </p>
                </Link>
              )}
              {coHosts.map((c: any) => (
                <Link
                  key={c.user_id}
                  to={`/profiles/${c.user_id}`}
                  className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={c.profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(c.profile?.display_name ?? c.profile?.username ?? "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium truncate">
                    {c.profile?.display_name ?? c.profile?.username ?? "Co-host"}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* Going */}
          {(goingData?.count ?? 0) > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">{goingData!.count} Going</h2>
              <div className="h-px bg-border" />
              <div className="flex items-center gap-2.5 pt-1">
                <div className="flex -space-x-2">
                  {goingData!.avatars.slice(0, 5).map((p: any) => (
                    <Avatar key={p.user_id} className="h-7 w-7 border-2 border-background">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(p.display_name ?? p.username ?? "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {goingData!.avatars
                    .slice(0, 2)
                    .map((p: any) => p.display_name ?? p.username ?? "Someone")
                    .join(", ")}
                  {goingData!.count > 2 && ` and ${goingData!.count - 2} others`}
                </p>
              </div>
            </section>
          )}
        </motion.aside>

        {/* RIGHT — title, date/place, registration, about */}
        <div className="space-y-6 min-w-0">
          {/* Title block */}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-medium">
              {format(start, "EEEE, MMMM d")} · {format(start, "h:mm a")}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-[1.1]">
              {ev.title}
            </h1>
          </div>

          {/* When / Where */}
          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted/50 flex flex-col items-center justify-center shrink-0">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">
                  {format(start, "MMM")}
                </span>
                <span className="text-base font-bold leading-none mt-0.5">
                  {format(start, "d")}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{format(start, "EEEE, MMM d")}</p>
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(start, "h:mm a")} – {format(end, "h:mm a")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                {ev.is_online ? (
                  <Globe2 className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                {ev.is_online ? (
                  <>
                    <p className="text-sm font-medium">Online</p>
                    <p className="text-xs text-muted-foreground">Link shared after RSVP</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium truncate">{ev.venue_name ?? "Venue TBA"}</p>
                    {ev.venue_address && (
                      <p className="text-xs text-muted-foreground truncate">{ev.venue_address}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {ev.capacity && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
                <Ticket className="h-3.5 w-3.5" /> Capacity {ev.capacity}
              </div>
            )}
          </div>

          {/* Registration */}
          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            <h3 className="font-display text-sm font-bold tracking-tight uppercase tracking-[0.15em] text-muted-foreground">
              Registration
            </h3>

            {myTicket && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <p className="text-xs font-medium truncate">You have a ticket</p>
                </div>
                <Link to={`/tickets/${myTicket.id}`}>
                  <Button size="sm" variant="outline" className="rounded-full h-7 text-xs">
                    View
                  </Button>
                </Link>
              </div>
            )}

            <div className="space-y-2">
              {(tiers ?? []).map((t: any) => {
                const isFree =
                  (Number(t.price_usd) || 0) === 0 && (Number(t.price_rhoze) || 0) === 0;
                const soldOut =
                  t.quantity_total != null && t.quantity_sold >= t.quantity_total;
                return (
                  <div
                    key={t.id}
                    className="rounded-xl bg-muted/30 border border-border p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isFree
                            ? "Free RSVP"
                            : `${t.price_usd ? `$${t.price_usd}` : ""}${
                                t.price_usd && t.price_rhoze ? " · " : ""
                              }${t.price_rhoze ? `${t.price_rhoze} $RHOZE` : ""}`}
                          {t.quantity_total != null && (
                            <> · {Math.max(0, t.quantity_total - t.quantity_sold)} left</>
                          )}
                        </p>
                      </div>
                    </div>
                    {myTicket ? (
                      <Button size="sm" disabled className="w-full rounded-full h-8 text-xs">
                        Already registered
                      </Button>
                    ) : soldOut ? (
                      <Button size="sm" disabled className="w-full rounded-full h-8 text-xs">
                        Sold out
                      </Button>
                    ) : isFree ? (
                      <Button
                        size="sm"
                        className="w-full rounded-full h-8 text-xs"
                        disabled={!user || rsvpMutation.isPending}
                        onClick={() => rsvpMutation.mutate(t.id)}
                      >
                        {!user ? "Sign in to RSVP" : "RSVP"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full rounded-full h-8 text-xs"
                        disabled={!user}
                        onClick={() => setCheckoutTier(t)}
                      >
                        {!user ? "Sign in to buy" : "Get ticket"}
                      </Button>
                    )}
                  </div>
                );
              })}
              {(tiers ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No ticket tiers yet.
                </p>
              )}
            </div>

            {isHost && hasPaidTier && (
              <div className="text-[11px] text-muted-foreground pt-2 border-t border-border inline-flex items-start gap-1.5">
                <Wallet className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  Platform fee scales with your tier — <strong className="text-foreground">Spark/Bloom 15% · Glow 10% · Play 7%</strong>.
                  The rest settles to your wallet. Hold more $RHOZE, keep more.
                </span>
              </div>
            )}
          </div>

          {/* About */}
          {ev.description && (
            <div className="space-y-2">
              <h2 className="font-display text-lg font-bold tracking-tight">About Event</h2>
              <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                {ev.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {checkoutTier && (
        <TicketCheckoutDialog
          open={!!checkoutTier}
          onOpenChange={(o) => !o && setCheckoutTier(null)}
          event={{ id: ev.id, title: ev.title, host_id: ev.host_id }}
          tier={checkoutTier}
          onIssued={() => {
            qc.invalidateQueries({ queryKey: ["event-my-ticket", id] });
            qc.invalidateQueries({ queryKey: ["event-tiers", id] });
          }}
        />
      )}
    </div>
  );
};

export default EventDetailPage;

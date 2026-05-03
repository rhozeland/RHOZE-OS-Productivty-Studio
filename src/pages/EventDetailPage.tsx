/**
 * EventDetailPage — public detail view for an event at /spaces/events/:id.
 *
 * Shows the event manifest summary, anchored proof, ticket tiers, and an
 * RSVP / claim button per tier. Free tiers issue a ticket immediately;
 * paid tiers display price and a "coming soon" hint until checkout lands.
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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { shortHash } from "@/lib/content-hash";
import TicketCheckoutDialog from "@/components/events/TicketCheckoutDialog";

const EventDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [checkoutTier, setCheckoutTier] = useState<any | null>(null);

  const { data: ev, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id!)
        .single();
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

  const rsvpMutation = useMutation({
    mutationFn: async (tierId: string) => {
      if (!user) throw new Error("Sign in to RSVP");
      const qr_token = `tk_${crypto.randomUUID().replace(/-/g, "")}`;
      const { data, error } = await supabase
        .from("event_tickets")
        .insert([
          {
            event_id: id!,
            holder_id: user.id,
            tier_id: tierId,
            qr_token,
            purchase_currency: "free",
            amount_paid: 0,
            status: "issued",
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (ticket) => {
      toast.success("You're in", {
        description: "Your ticket is ready. Anchor your attendance after the event.",
      });
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
        <Link to="/discover">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Discover
          </Button>
        </Link>
      </div>
    );
  }

  const isHost = user?.id === ev.host_id;
  const canManage = isHost || isCollaborator;
  const start = new Date(ev.starts_at);
  const end = new Date(ev.ends_at);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/events"
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

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-card border border-border overflow-hidden"
      >
        <div className="aspect-[16/7] bg-muted relative overflow-hidden">
          {ev.cover_url ? (
            <img src={ev.cover_url} alt={ev.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/10">
              <CalendarDays className="h-14 w-14 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute top-4 left-4 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium capitalize">
            {ev.category}
          </div>
          {ev.status !== "published" && (
            <div className="absolute top-4 right-4 rounded-full bg-foreground text-background px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider">
              {ev.status}
            </div>
          )}
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              {format(start, "EEEE, MMMM d, yyyy")} · {format(start, "h:mm a")} –{" "}
              {format(end, "h:mm a")}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {ev.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {ev.is_online ? (
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="h-4 w-4" /> Online
              </span>
            ) : (
              ev.venue_name && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {ev.venue_name}
                  {ev.venue_address ? ` · ${ev.venue_address}` : ""}
                </span>
              )
            )}
            {ev.capacity && (
              <span className="inline-flex items-center gap-1.5">
                <Ticket className="h-4 w-4" /> {ev.capacity} cap
              </span>
            )}
          </div>

          {/* Hosted by — links to host profile (mirrors Studio detail) */}
          {hostProfile && (
            <Link
              to={`/profiles/${hostProfile.user_id}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:bg-muted/40 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm overflow-hidden shrink-0">
                {hostProfile.avatar_url ? (
                  <img src={hostProfile.avatar_url} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  hostProfile.display_name?.[0]?.toUpperCase() ?? "?"
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  Hosted by {hostProfile.display_name ?? hostProfile.username ?? "Creator"}
                </p>
                <p className="text-xs text-muted-foreground">View profile →</p>
              </div>
            </Link>
          )}

          {ev.description && (
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
              {ev.description}
            </p>
          )}

          {/* Anchor / manifest */}
          {ev.manifest_hash && (
            <div className="rounded-xl bg-muted/40 border border-border p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Manifest:</span>
                <code className="font-mono text-foreground">
                  {shortHash(ev.manifest_hash)}
                </code>
              </div>
              {ev.solana_signature ? (
                <a
                  href={`https://solscan.io/tx/${ev.solana_signature}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Anchored on Solana <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Pending anchor
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Tickets */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold tracking-tight">Tickets</h2>

        {myTicket && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">You have a ticket</p>
                <p className="text-xs text-muted-foreground">
                  Show your QR at the door.
                </p>
              </div>
            </div>
            <Link to={`/tickets/${myTicket.id}`}>
              <Button size="sm" className="rounded-full">
                View ticket
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
                className="rounded-xl bg-card border border-border p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isFree
                      ? "Free RSVP"
                      : `${t.price_usd ? `$${t.price_usd} USD` : ""}${
                          t.price_usd && t.price_rhoze ? " · " : ""
                        }${t.price_rhoze ? `${t.price_rhoze} $RHOZE` : ""}`}
                    {t.quantity_total != null && (
                      <>
                        {" · "}
                        {Math.max(0, t.quantity_total - t.quantity_sold)} left
                      </>
                    )}
                  </p>
                </div>
                {myTicket ? (
                  <span className="text-xs text-muted-foreground">Already in</span>
                ) : soldOut ? (
                  <span className="text-xs text-muted-foreground">Sold out</span>
                ) : isFree ? (
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={!user || rsvpMutation.isPending}
                    onClick={() => rsvpMutation.mutate(t.id)}
                  >
                    {!user ? "Sign in to RSVP" : "RSVP"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={!user}
                    onClick={() => setCheckoutTier(t)}
                  >
                    {!user ? "Sign in to buy" : "Buy ticket"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {checkoutTier && (
        <TicketCheckoutDialog
          open={!!checkoutTier}
          onOpenChange={(o) => !o && setCheckoutTier(null)}
          event={{ id: ev.id, title: ev.title }}
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

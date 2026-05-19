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
  ArrowLeft,
  Settings,
  Loader2,
  CheckCircle2,
  Clock,
  Wallet,
  CalendarPlus,
  ExternalLink,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import EventCheckoutSheet from "@/components/events/EventCheckoutSheet";
import EventInviteBanner from "@/components/events/EventInviteBanner";
import EventMediaCarousel from "@/components/events/EventMediaCarousel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EventNotFound } from "@/components/events/EventNotFound";
import { downloadIcs } from "@/lib/ics-export";

const EventDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [checkoutTier, setCheckoutTier] = useState<any | null>(null);

  const { data: ev, isLoading, error: evError } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    retry: false,
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
      const { data: rows, count } = await supabase
        .from("event_tickets")
        .select("holder_id, tier_id, status, checked_in_at, created_at", { count: "exact" })
        .eq("event_id", id!)
        .in("status", ["issued", "checked_in"])
        .order("created_at", { ascending: false });
      const all = rows ?? [];
      const holderIds = Array.from(new Set(all.map((r: any) => r.holder_id))).slice(0, 12);
      let profMap = new Map<string, any>();
      if (holderIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", holderIds);
        profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      }
      const avatars = holderIds.map((uid) => profMap.get(uid)).filter(Boolean);
      const tierCounts = new Map<string, number>();
      let checkedIn = 0;
      for (const r of all as any[]) {
        if (r.tier_id) tierCounts.set(r.tier_id, (tierCounts.get(r.tier_id) ?? 0) + 1);
        if (r.status === "checked_in") checkedIn += 1;
      }
      return {
        count: count ?? 0,
        avatars,
        tierCounts: Object.fromEntries(tierCounts),
        checkedIn,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (!ev || evError) {
    return (
      <EventNotFound
        badId={id}
        message={
          evError
            ? "We couldn't load this event. It may have been removed or the link is invalid."
            : "This event may have been removed, or the link is invalid."
        }
      />
    );
  }

  const isHost = user?.id === ev.host_id;
  const canManage = isHost || isCollaborator;
  const start = new Date(ev.starts_at);
  const end = new Date(ev.ends_at);
  const hasPaidTier = (tiers ?? []).some(
    (t: any) => (Number(t.price_usd) || 0) > 0 || (Number(t.price_rhoze) || 0) > 0
  );

  // Hero registration CTA — pick the cheapest available tier as the
  // primary action. If the user already holds a ticket, show their
  // registered state instead. Mirrors the per-tier CTA logic below so
  // the big button always tracks reality.
  const activeTiers = (tiers ?? []).filter((t: any) => t.is_active !== false);
  const availableTiers = activeTiers.filter(
    (t: any) => t.quantity_total == null || (t.quantity_sold ?? 0) < t.quantity_total,
  );
  const cheapestTier = [...availableTiers].sort(
    (a: any, b: any) => (Number(a.price_usd) || 0) - (Number(b.price_usd) || 0),
  )[0];
  const heroPrice = cheapestTier ? Number(cheapestTier.price_usd) || 0 : 0;
  const heroCurrency = cheapestTier?.currency_code || (ev as any).currency_code || "USD";
  const heroIsFree =
    cheapestTier &&
    (Number(cheapestTier.price_usd) || 0) === 0 &&
    (Number(cheapestTier.price_rhoze) || 0) === 0;
  const heroLabel = myTicket
    ? "Registered ✓"
    : !cheapestTier
    ? activeTiers.length > 0 ? "Sold out" : "RSVP Free"
    : heroIsFree
    ? "RSVP Free"
    : `Get Ticket · ${new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: heroCurrency,
        maximumFractionDigits: heroPrice % 1 === 0 ? 0 : 2,
      }).format(heroPrice)}`;
  const heroDisabled = !!myTicket || (activeTiers.length > 0 && !cheapestTier);
  const heroVariant: "default" | "outline" | "secondary" = myTicket
    ? "outline"
    : "default";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-12 md:px-6">
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

      {/* Hero registration CTA — the largest, most prominent action on the page. */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[24px] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 md:p-7"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {format(start, "EEE, MMM d · h:mm a")}
            </p>
            <h2 className="font-display text-2xl font-bold leading-tight text-foreground md:text-3xl line-clamp-2">
              {ev.title}
            </h2>
          </div>
          {myTicket ? (
            <Link to={`/tickets/${myTicket.id}`} className="shrink-0">
              <Button
                size="lg"
                variant="outline"
                className="h-16 rounded-2xl px-8 text-lg font-bold border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Registered ✓ · View ticket
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              variant={heroVariant}
              disabled={heroDisabled}
              onClick={() => cheapestTier && setCheckoutTier(cheapestTier)}
              className="h-16 rounded-2xl px-8 text-lg font-bold shadow-lg shrink-0 md:min-w-[260px]"
            >
              <Ticket className="h-5 w-5 mr-2" />
              {heroLabel}
            </Button>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() =>
              downloadIcs({
                uid: ev.id,
                title: ev.title,
                description: ev.description ?? undefined,
                starts_at: ev.starts_at,
                ends_at: ev.ends_at,
                url: typeof window !== "undefined" ? window.location.href : null,
                location: ev.venue_name ?? ev.venue_address ?? (ev.is_online ? "Online" : null),
              })
            }
          >
            <CalendarPlus className="h-4 w-4 mr-1.5" />
            Add to calendar
          </Button>
        </div>
      </motion.section>

      {/* Gallery (images + videos) — hoisted above the fold, hides when empty */}
      <EventMediaCarousel eventId={ev.id} />




      <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* LEFT — compact poster + host rail */}
        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-0 space-y-5 md:sticky md:top-20"
        >
          {/* Poster */}
          <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-sm">
            <div className="relative aspect-[3/4] overflow-hidden bg-muted">
              {(ev.cover_url_poster || ev.cover_url) ? (
                <img src={ev.cover_url_poster || ev.cover_url} alt={ev.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-accent/10">
                  <CalendarDays className="h-14 w-14 text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium capitalize backdrop-blur-sm">
                {ev.category}
              </div>
            </div>
          </div>

          {/* Hosted By */}
          <section className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Presented by</p>
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              {hostProfile && (
                <Link
                  to={`/profiles/${hostProfile.user_id}`}
                  className="flex items-center gap-3 transition-opacity hover:opacity-80"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={hostProfile.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(hostProfile.display_name ?? hostProfile.username ?? "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {hostProfile.display_name ?? hostProfile.username ?? "Host"}
                    </p>
                    <p className="text-xs text-muted-foreground">Host</p>
                  </div>
                </Link>
              )}
              {coHosts.map((c: any) => (
                <Link
                  key={c.user_id}
                  to={`/profiles/${c.user_id}`}
                  className="flex items-center gap-3 transition-opacity hover:opacity-80"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={c.profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(c.profile?.display_name ?? c.profile?.username ?? "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.profile?.display_name ?? c.profile?.username ?? "Co-host"}
                    </p>
                    <p className="text-xs text-muted-foreground">Co-host</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Going */}
          {(goingData?.count ?? 0) > 0 && (() => {
            const capacity = (tiers ?? []).reduce((acc: number | null, t: any) => {
              if (acc === null) return null;
              if (t.quantity_total == null) return null;
              return acc + Number(t.quantity_total);
            }, 0 as number | null);
            const pct = capacity && capacity > 0
              ? Math.min(100, Math.round(((goingData!.count) / capacity) * 100))
              : null;
            const tierBreakdown = (tiers ?? [])
              .map((t: any) => ({
                name: t.name,
                count: (goingData as any)!.tierCounts?.[t.id] ?? 0,
              }))
              .filter((x) => x.count > 0);
            const myTier = myTicket
              ? (tiers ?? []).find((t: any) => t.id === (myTicket as any).tier_id)
              : null;
            return (
              <section className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">{goingData!.count} Going</h2>
                  {capacity != null && (
                    <span className="text-[11px] text-muted-foreground">
                      of {capacity}
                    </span>
                  )}
                </div>
                <div className="h-px bg-border" />

                {pct != null && (
                  <div className="space-y-1.5 pt-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/80 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {pct}% full
                      {(goingData as any).checkedIn > 0 && (
                        <> · {(goingData as any).checkedIn} checked in</>
                      )}
                    </p>
                  </div>
                )}

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

                {tierBreakdown.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tierBreakdown.map((b) => (
                      <span
                        key={b.name}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        <span className="font-semibold text-foreground">{b.count}</span>
                        {b.name}
                      </span>
                    ))}
                  </div>
                )}

                {myTier && (
                  <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Your tier
                      </p>
                      {(myTicket as any).status === "checked_in" && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Checked in
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground">{myTier.name}</p>
                    {myTier.description && (
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                        {myTier.description}
                      </p>
                    )}
                  </div>
                )}
              </section>
            );
          })()}

        </motion.aside>


        {/* RIGHT — title, details, registration, about */}
        <div className="min-w-0 space-y-7">
          {/* Title block */}
          <div className="space-y-5">
            <div className="inline-flex w-fit items-center rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {ev.category}
            </div>
            <h1 className="font-display text-3xl font-bold leading-[1.06] tracking-tight md:text-4xl xl:text-[3.3rem]">
              {ev.title}
            </h1>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-card">
                  <span className="text-[9px] leading-none uppercase tracking-wider text-muted-foreground">
                    {format(start, "MMM")}
                  </span>
                  <span className="mt-0.5 text-base font-bold leading-none">{format(start, "d")}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold">{format(start, "EEEE, MMMM d")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {format(start, "h:mm a")} – {format(end, "h:mm a")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
                  {ev.is_online ? (
                    <Globe2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  {ev.is_online ? (
                    <>
                      <p className="text-base font-semibold">Online event</p>
                      <p className="mt-1 text-sm text-muted-foreground">Link shared after registration</p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-semibold">{ev.venue_name ?? "Venue TBA"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {ev.venue_address ?? "Address shared after registration"}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Registration */}
          <div className="overflow-hidden rounded-[22px] border border-border bg-card">
            <div className="border-b border-border bg-muted/30 px-5 py-3">
              <h3 className="text-sm font-semibold text-foreground">
                Registration
              </h3>
            </div>

            <div className="space-y-4 p-5">

              {myTicket && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <p className="text-xs font-medium truncate">You have a ticket</p>
                </div>
                <Link to={`/tickets/${myTicket.id}`}>
                  <Button size="sm" variant="outline" className="h-8 rounded-full text-xs">
                    View
                  </Button>
                </Link>
              </div>
            )}

              <div className="space-y-3">
                {(tiers ?? []).map((t: any) => {
                const isFree =
                  (Number(t.price_usd) || 0) === 0 && (Number(t.price_rhoze) || 0) === 0;
                const soldOut =
                  t.quantity_total != null && t.quantity_sold >= t.quantity_total;
                const cur = t.currency_code || (ev as any).currency_code || "USD";
                const price = Number(t.price_usd) || 0;
                return (
                  <div
                    key={t.id}
                    className="space-y-3 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isFree
                            ? "Free RSVP"
                            : `${new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: price % 1 === 0 ? 0 : 2 }).format(price)} · or pay with $RHOZE`}
                          {t.quantity_total != null && (
                            <> · {Math.max(0, t.quantity_total - t.quantity_sold)} left</>
                          )}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const tk = (t.tier_kind ?? (isFree ? "free_rsvp" : "paid")) as string;
                      const cta =
                        tk === "free_rsvp" ? "RSVP" :
                        tk === "request" ? "Request to join" :
                        "Get ticket";
                      if (myTicket) {
                        const pending = (myTicket as any).status === "pending_approval";
                        return (
                          <Button size="sm" disabled className="h-10 w-full rounded-full text-xs">
                            {pending ? "Request pending" : "Already registered"}
                          </Button>
                        );
                      }
                      if (soldOut) {
                        return (
                          <Button size="sm" disabled className="h-10 w-full rounded-full text-xs">
                            Sold out
                          </Button>
                        );
                      }
                      return (
                        <Button
                          size="sm"
                          className="h-10 w-full rounded-full text-xs"
                          onClick={() => setCheckoutTier(t)}
                        >
                          {cta}
                        </Button>
                      );
                    })()}
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
                <div className="inline-flex items-start gap-1.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
                  <Wallet className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>
                    Platform fee scales with your tier — <strong className="text-foreground">Spark/Bloom 15% · Glow 10% · Play 7%</strong>.
                    The rest settles to your wallet. Hold more $RHOZE, keep more.
                  </span>
                </div>
              )}
              {ev.capacity && (
                <div className="inline-flex items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
                  <Ticket className="h-3.5 w-3.5" /> Capacity {ev.capacity}
                </div>
              )}
            </div>
          </div>

          {/* About */}
          {ev.description && (
            <div className="space-y-3 border-t border-border pt-5">
              <h2 className="font-display text-lg font-bold tracking-tight">About Event</h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/85">
                {ev.description}
              </p>
            </div>
          )}

        </div>
      </div>

      {checkoutTier && (
        <EventCheckoutSheet
          open={!!checkoutTier}
          onOpenChange={(o) => !o && setCheckoutTier(null)}
          event={{ id: ev.id, title: ev.title, host_id: ev.host_id, currency_code: (ev as any).currency_code, cover_url: ev.cover_url, starts_at: ev.starts_at, venue_name: ev.venue_name }}
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

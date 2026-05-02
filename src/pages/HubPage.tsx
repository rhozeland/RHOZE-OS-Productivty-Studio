/**
 * HubPage — the digital network in Rhozeland's "Spaces" model.
 *
 * Rhozeland v5 pivot ("Spaces"):
 *   Hub = the *digital* space. Studios = the *physical* space.
 *   Hub no longer contains "storefronts" or a "Physical" rail — that lives
 *   in /studios. Hub now organizes around four lanes:
 *
 *     1. Conversations  — Flow drops + community pulse
 *     2. Offerings      — services & digital goods (renamed from storefronts)
 *     3. Opportunities  — open calls, briefs, gigs, collabs
 *     4. Works          — anchored creative IP browsable as a feed
 *
 * No DB schema changes — Offerings reuses `marketplace_listings`
 * (filtered to service/digital/collaboration), Opportunities reuses the
 * `project_request` listing type, and Works reuses `contribution_proofs`
 * with a `solana_signature` (anchored).
 *
 * URL: ?q=... pre-fills search · ?lane=... pre-selects tab.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGate } from "@/components/AuthGateDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Sparkles,
  Plus,
  Briefcase,
  Megaphone,
  MessageCircle,
  Shield,
  Flame,
  ArrowRight,
  Coins,
  CalendarDays,
  Building2,
  MapPin,
  Globe2,
} from "lucide-react";
import ListingCard from "@/components/marketplace/ListingCard";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import StreamComposer, { type StreamPostType } from "@/components/stream/StreamComposer";

type Lane = "conversations" | "offerings" | "opportunities" | "works";

const LANES: { key: Lane; label: string; icon: typeof Briefcase; tagline: string }[] = [
  { key: "conversations", label: "Conversations", icon: MessageCircle, tagline: "Live drops from the community." },
  { key: "offerings",     label: "Offerings",     icon: Briefcase,    tagline: "Services & digital goods." },
  { key: "opportunities", label: "Opportunities", icon: Megaphone,    tagline: "Open calls, briefs, gigs." },
  { key: "works",         label: "Works",         icon: Shield,       tagline: "Verified IP — anchored on Solana." },
];

const HubPage = () => {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const initialLane = (params.get("lane") as Lane) || "conversations";
  const [lane, setLane] = useState<Lane>(initialLane);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [createOpen, setCreateOpen] = useState(false);

  // Keep URL in sync (so back-button + sharing land on the same lane)
  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("lane", lane);
    if (search.trim()) next.set("q", search.trim());
    else next.delete("q");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lane, search]);

  // ─── Conversations: Flow feed ───────────────────────────────────────
  const { data: flowItems, isLoading: loadingFlow } = useQuery({
    queryKey: ["hub-conversations", search],
    queryFn: async () => {
      let q = supabase
        .from("flow_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(18);
      if (search.trim()) {
        const term = search.trim();
        q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: lane === "conversations",
  });

  // ─── Conversations sub-strip: upcoming Events ────────────────────────
  // v7 phase 2 — Spaces lanes are inlined into the social Stream rather
  // than living as a separate pillar. We surface a thin strip of
  // upcoming/published events so people see "what's happening" without
  // leaving the feed.
  const { data: upcomingEvents } = useQuery({
    queryKey: ["stream-upcoming-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, cover_url, starts_at, category, venue_name, is_online, manifest_hash")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
    enabled: lane === "conversations",
  });

  // ─── Conversations sub-strip: featured Spaces (studios) ─────────────
  const { data: featuredSpaces } = useQuery({
    queryKey: ["stream-featured-spaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studios")
        .select("id, name, cover_image_url, city, country")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
    enabled: lane === "conversations",
  });

  // ─── Offerings: services + digital goods + collaboration ─────────────
  const { data: offerings, isLoading: loadingOfferings } = useQuery({
    queryKey: ["hub-offerings", search],
    queryFn: async () => {
      let q = supabase
        .from("marketplace_listings")
        .select("*")
        .eq("is_active", true)
        .in("listing_type", ["service", "digital_product", "collaboration"])
        .order("created_at", { ascending: false })
        .limit(60);
      if (search.trim()) {
        const term = search.trim();
        q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: lane === "offerings",
  });

  const offeringIds = useMemo(() => offerings?.map((l: any) => l.id) ?? [], [offerings]);
  const { data: offeringMedia } = useQuery({
    queryKey: ["hub-offering-media", offeringIds],
    queryFn: async () => {
      if (offeringIds.length === 0) return [];
      const { data } = await supabase
        .from("listing_media")
        .select("*")
        .in("listing_id", offeringIds)
        .order("sort_order");
      return data ?? [];
    },
    enabled: offeringIds.length > 0,
  });
  const getMediaForListing = (id: string) =>
    offeringMedia?.filter((m: any) => m.listing_id === id) ?? [];

  // ─── Opportunities: project_request listings (open calls / gigs) ─────
  const { data: opportunities, isLoading: loadingOpps } = useQuery({
    queryKey: ["hub-opportunities", search],
    queryFn: async () => {
      let q = supabase
        .from("marketplace_listings")
        .select("*")
        .eq("is_active", true)
        .eq("listing_type", "project_request")
        .order("created_at", { ascending: false })
        .limit(40);
      if (search.trim()) {
        const term = search.trim();
        q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: lane === "opportunities",
  });

  // ─── Works: anchored contribution proofs (Verified IP feed) ─────────
  const { data: works, isLoading: loadingWorks } = useQuery({
    queryKey: ["hub-works"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribution_proofs")
        .select("id, action_type, metadata, solana_signature, anchored_at, created_at, user_id")
        .not("solana_signature", "is", null)
        .order("anchored_at", { ascending: false, nullsFirst: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
    enabled: lane === "works",
  });

  const workOwnerIds = useMemo(
    () => Array.from(new Set((works ?? []).map((w: any) => w.user_id))),
    [works],
  );
  const { data: workOwners } = useQuery({
    queryKey: ["hub-work-owners", workOwnerIds],
    queryFn: async () => {
      if (workOwnerIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles_public")
        .select("user_id, display_name, avatar_url, username")
        .in("user_id", workOwnerIds);
      return data ?? [];
    },
    enabled: workOwnerIds.length > 0,
  });
  const workOwnerMap = new Map(workOwners?.map((p: any) => [p.user_id, p]) ?? []);

  // ─── Coins: live + recently graduated bonding-curve launches ────────
  const { data: coins, isLoading: loadingCoins } = useQuery({
    queryKey: ["hub-coins", search],
    queryFn: async () => {
      let q = supabase
        .from("coin_launches")
        .select(
          "id,ticker,name,description,image_url,status,real_sol_reserves,graduation_sol_target,creator_id,created_at",
        )
        .in("status", ["live", "graduated"])
        .order("real_sol_reserves", { ascending: false })
        .limit(30);
      if (search.trim()) {
        const term = search.trim();
        q = q.or(`ticker.ilike.%${term}%,name.ilike.%${term}%,description.ilike.%${term}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: lane === "works",
  });

  // Reuse Coins inside Works (Verified IP → optional bonding-curve coin).
  // Coins live alongside Works only — they're not surfaced in the
  // Conversations / Offerings / Opportunities lanes.

  const activeLane = LANES.find((l) => l.key === lane)!;

  // ─── Lane-aware "post" CTA ──────────────────────────────────────────
  const handlePost = () => {
    if (!requireAuth("Sign up to post to the Hub.")) return;
    if (lane === "works") {
      navigate("/works");
      return;
    }
    setCreateOpen(true);
  };

  // Map active lane → default composer type so the primary CTA matches
  // what the user is most likely to want to drop in that lane.
  const composerDefault: StreamPostType =
    lane === "offerings"     ? "offering"
    : lane === "opportunities" ? "opportunity"
    : lane === "works"         ? "work"
    : "text";

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-pink-500/5 via-background to-amber-500/5 p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(320_80%_60%/0.15),transparent_55%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_85%,hsl(30_90%_55%/0.12),transparent_55%)] pointer-events-none" />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">
            The Stream
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground tracking-tight">
            What&rsquo;s happening.
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-md">
            Drops, offerings, calls, events, spaces, works — one feed.
          </p>
        </div>
      </header>

      {/* ─── Lane-aware composer (the new "Drop" surface) ─────────────── */}
      <StreamComposer defaultType={composerDefault} />

      {/* ─── Lane tabs ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {LANES.map((l) => {
            const Icon = l.icon;
            const active = lane === l.key;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => setLane(l.key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all ${
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {l.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground italic">{activeLane.tagline}</p>
      </div>

      {/* ─── Search ─────────────────────────────────────────────────── */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${activeLane.label.toLowerCase()}…`}
          className="pl-10 h-11 rounded-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════
          LANE: Conversations sub-strip — Happenings (events + spaces)
          ════════════════════════════════════════════════════════════════
          v7 phase 2: Spaces + Events live inline as a thin "Happenings"
          strip above the Conversations grid so users see what's coming
          up without leaving the Stream. */}
      {lane === "conversations" && (
        ((upcomingEvents?.length ?? 0) > 0 || (featuredSpaces?.length ?? 0) > 0) && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  Happenings
                </p>
                <h2 className="font-display text-xl text-foreground">
                  Events &amp; Spaces, on the calendar.
                </h2>
              </div>
              <div className="flex gap-1.5">
                <Link to="/spaces/events/new" className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  Host event <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Upcoming events */}
            {(upcomingEvents?.length ?? 0) > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {upcomingEvents!.map((ev: any, i: number) => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to={`/spaces/events/${ev.id}`}
                      className="group block rounded-2xl border border-border bg-card hover:border-foreground/30 hover:-translate-y-0.5 transition-all overflow-hidden h-full"
                    >
                      <div className="relative aspect-video bg-muted overflow-hidden">
                        {ev.cover_url ? (
                          <img
                            src={ev.cover_url}
                            alt={ev.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-pink-500/10">
                            <CalendarDays className="h-8 w-8 text-foreground/30" />
                          </div>
                        )}
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
                          <CalendarDays className="h-2.5 w-2.5" /> Event
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                          {format(new Date(ev.starts_at), "EEE, MMM d · h:mm a")}
                        </p>
                        <h3 className="font-display font-semibold text-foreground text-sm group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                          {ev.title}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 truncate">
                          {ev.is_online ? (
                            <><Globe2 className="h-3 w-3 shrink-0" /> Online</>
                          ) : ev.venue_name ? (
                            <><MapPin className="h-3 w-3 shrink-0" /> {ev.venue_name}</>
                          ) : null}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Featured spaces */}
            {(featuredSpaces?.length ?? 0) > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {featuredSpaces!.map((s: any, i: number) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to={`/studios/${s.id}`}
                      className="group block rounded-xl border border-border bg-card hover:border-foreground/30 hover:-translate-y-0.5 transition-all overflow-hidden"
                    >
                      <div className="relative aspect-square bg-muted overflow-hidden">
                        {s.cover_image_url ? (
                          <img
                            src={s.cover_image_url}
                            alt={s.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500/15 to-cyan-500/10">
                            <Building2 className="h-7 w-7 text-foreground/30" />
                          </div>
                        )}
                        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-medium text-foreground shadow-sm">
                          <Building2 className="h-2.5 w-2.5" /> Space
                        </span>
                      </div>
                      <div className="p-2.5">
                        <h3 className="font-display font-semibold text-foreground text-xs group-hover:text-primary transition-colors line-clamp-1">
                          {s.name}
                        </h3>
                        {(s.city || s.country) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {[s.city, s.country].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )
      )}

      {/* ════════════════════════════════════════════════════════════════
          LANE: Conversations
          ════════════════════════════════════════════════════════════════ */}
      {lane === "conversations" && (
        <section>
          {loadingFlow && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="aspect-[3/4] bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          )}
          {!loadingFlow && (flowItems?.length ?? 0) === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
              <Flame className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                The feed is quiet. Be the first to drop something.
              </p>
              {user && (
                <Button
                  onClick={() => navigate("/projects")}
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-full"
                >
                  Open a project
                </Button>
              )}
            </div>
          )}
          {!loadingFlow && (flowItems?.length ?? 0) > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {flowItems!.map((item: any, i: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-card border border-border cursor-pointer hover:-translate-y-0.5 transition-transform"
                  onClick={() => navigate("/projects")}
                >
                  <FlowThumbnail
                    fileUrl={item.file_url}
                    linkUrl={item.link_url}
                    title={item.title}
                    description={item.description}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                    <p className="text-[11px] uppercase tracking-wider text-white/70 mb-0.5">
                      {item.category}
                    </p>
                    <p className="text-sm font-display font-semibold text-white line-clamp-1">
                      {item.title}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════
          LANE: Offerings (was "storefronts" — same data, new framing)
          ════════════════════════════════════════════════════════════════ */}
      {lane === "offerings" && (
        <section>
          {loadingOfferings ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-72 bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : !offerings || offerings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
              <Briefcase className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium">
                {search ? "No offerings match your search." : "No offerings yet."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Post a service, a digital good, or open a collab.
              </p>
              <Button onClick={handlePost} className="mt-4 rounded-full">
                <Plus className="mr-1.5 h-4 w-4" /> Post Offering
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {offerings.map((listing: any, i: number) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  media={getMediaForListing(listing.id)}
                  reviewStats={null}
                  index={i}
                  isOwner={listing.user_id === user?.id}
                  onInquire={() => {
                    if (!requireAuth("Sign up to message creators and send inquiries.")) return;
                    navigate(
                      `/messages?to=${listing.user_id}&listing=${encodeURIComponent(listing.title)}`,
                    );
                  }}
                  onClick={() => navigate(`/marketplace/${listing.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════
          LANE: Opportunities (open calls / gigs)
          ════════════════════════════════════════════════════════════════ */}
      {lane === "opportunities" && (
        <section>
          {loadingOpps ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : !opportunities || opportunities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
              <Megaphone className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium">
                {search ? "No opportunities match." : "No open calls right now."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Got a brief? Post it — creators will reach out.
              </p>
              <Button onClick={handlePost} className="mt-4 rounded-full">
                <Plus className="mr-1.5 h-4 w-4" /> Post Opportunity
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {opportunities.map((opp: any, i: number) => (
                <motion.div
                  key={opp.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to={`/marketplace/${opp.id}`}
                    className="group block rounded-2xl border border-border bg-card hover:border-foreground/30 hover:-translate-y-0.5 transition-all p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                          {opp.category} · Open Call
                        </p>
                        <h3 className="font-display font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {opp.title}
                        </h3>
                      </div>
                      {(opp.price || opp.credits_price) && (
                        <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-1 shrink-0">
                          {opp.credits_price
                            ? `${opp.credits_price} ◊`
                            : `$${Number(opp.price).toFixed(0)}`}
                        </span>
                      )}
                    </div>
                    {opp.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {opp.description}
                      </p>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground mt-3 group-hover:gap-2 transition-all">
                      Apply <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════
          LANE: Works (anchored creative IP)
          ════════════════════════════════════════════════════════════════ */}
      {lane === "works" && (
        <section>
          {loadingWorks ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-44 bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : !works || works.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
              <Shield className="h-10 w-10 text-emerald-500/40 mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium">No anchored Works yet.</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Anchor a contribution to Solana and it shows up here as Verified IP — the
                community can see the proof and explore the receipt.
              </p>
              <Button
                onClick={() => navigate("/works")}
                className="mt-4 rounded-full"
                variant="outline"
              >
                Open my Works vault
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {works.map((w: any, i: number) => {
                const owner = workOwnerMap.get(w.user_id);
                const desc =
                  (w.metadata as Record<string, unknown>)?.description as string | undefined;
                return (
                  <motion.div
                    key={w.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-2xl border border-border bg-card p-4 hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                        {w.action_type}
                      </span>
                      <VerifiedIPBadge signature={w.solana_signature} size="xs" />
                    </div>
                    {desc && (
                      <p className="text-sm text-foreground line-clamp-2 leading-relaxed mb-3">
                        {desc}
                      </p>
                    )}
                    <Link
                      to={owner ? `/profiles/${owner.user_id}` : "#"}
                      className="flex items-center gap-2 mt-2 group"
                    >
                      {owner?.avatar_url ? (
                        <img
                          src={owner.avatar_url}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                          {(owner?.display_name || owner?.username || "?")[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground group-hover:text-foreground truncate">
                        {owner?.display_name || owner?.username || "Anonymous"}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground/60">
                        {w.anchored_at
                          ? new Date(w.anchored_at).toLocaleDateString()
                          : new Date(w.created_at).toLocaleDateString()}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════
          Coins sub-strip — shown inside the Works lane only.
          Coins are derived from Verified IP, so they belong with Works.
          ════════════════════════════════════════════════════════════════ */}
      {lane === "works" && (loadingCoins || (coins && coins.length > 0)) && (
        <section className="space-y-3 pt-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                Creator coins
              </p>
              <h2 className="font-display text-xl text-foreground">Back the artist.</h2>
            </div>
          </div>

          {loadingCoins ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {coins!.slice(0, 6).map((c: any, i: number) => {
                const progress = Math.min(
                  100,
                  (Number(c.real_sol_reserves) / Number(c.graduation_sol_target)) * 100,
                );
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to={`/profiles/${c.creator_id}?tab=coin`}
                      className="group block rounded-2xl border border-border bg-card hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all p-4 h-full"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        {c.image_url ? (
                          <img
                            src={c.image_url}
                            alt={c.name}
                            className="h-11 w-11 rounded-md object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-md bg-gradient-to-br from-emerald-500/30 to-fuchsia-500/30 flex items-center justify-center shrink-0">
                            <Coins className="h-5 w-5 text-emerald-500" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-sm">${c.ticker}</span>
                            {c.status === "graduated" && (
                              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500">
                                Grad
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{c.name}</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                        <span>{Number(c.real_sol_reserves).toFixed(2)} SOL</span>
                        <span>{c.graduation_sol_target} SOL goal</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-fuchsia-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default HubPage;

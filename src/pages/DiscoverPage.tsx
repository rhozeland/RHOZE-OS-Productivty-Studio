/**
 * Discover — v6 front door (Phase 2).
 * ─────────────────────────────────────────────────────────────────────────
 * Feed-led page that surfaces, top-to-bottom:
 *   1. Featured artist (editorial slot — newest active public profile
 *      with an avatar; admin override TODO via `featured_profiles` table)
 *   2. Trending creators (by recent flow_items activity, last 14 days)
 *   3. Fresh works (verified IP first, then anchored, then recent)
 *   4. Live & upcoming events
 *   5. Coins moving today (active coin_launches by recent updated_at)
 *
 * All five sources are publicly readable per RLS, so guests get the
 * full feel before being asked to sign up.
 */
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import TrendingArtistsLane from "@/components/discover/TrendingArtistsLane";
import RegionChip from "@/components/profile/RegionChip";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import { MARKETS, type RegionMarket } from "@/lib/regions";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Compass, Sparkles, Calendar as CalendarIcon, Coins,
  Flame, TrendingUp, MapPin, Music, FileText, Image as ImageIcon, Globe2,
} from "lucide-react";
import { format } from "date-fns";

// ─── Tiny helpers ────────────────────────────────────────────────────────
const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

const categoryIcon = (cat?: string | null) => {
  if (cat === "music") return Music;
  if (cat === "writing") return FileText;
  return ImageIcon;
};

const DiscoverPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [marketFilter, setMarketFilter] = useState<RegionMarket | "All">("All");

  // ─── 1. Featured artist (newest public profile w/ avatar + bio) ───
  const { data: featured } = useQuery({
    queryKey: ["discover-featured-artist"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, headline, bio, avatar_url, banner_url, location, mediums, region_code")
        .eq("is_public", true)
        .not("avatar_url", "is", null)
        .not("bio", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // ─── 2. Trending creators (most flow posts in the last 14 days) ───
  const { data: trendingCreators } = useQuery({
    queryKey: ["discover-trending-creators"],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: items } = await supabase
        .from("flow_items")
        .select("user_id")
        .gte("created_at", since)
        .limit(500);
      const counts = new Map<string, number>();
      (items ?? []).forEach((i: any) => {
        if (!i.user_id) return;
        counts.set(i.user_id, (counts.get(i.user_id) ?? 0) + 1);
      });
      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id]) => id);
      if (topIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, headline, avatar_url, mediums")
        .in("user_id", topIds)
        .eq("is_public", true);
      // Re-sort to match counts order
      return topIds
        .map((id) => (profiles ?? []).find((p: any) => p.user_id === id))
        .filter(Boolean) as any[];
    },
  });

  // ─── 3. Fresh works (verified first, then recent) ───
  const { data: works } = useQuery({
    queryKey: ["discover-fresh-works"],
    queryFn: async () => {
      const { data } = await supabase
        .from("flow_items")
        .select("id, title, description, file_url, link_url, category, content_type, verification_status, work_id, user_id, creator_name, solana_signature, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      const order = (s?: string | null) =>
        s === "verified" ? 0 : s === "pending" ? 1 : s === "fingerprinted" ? 2 : 3;
      return (data ?? [])
        .sort((a: any, b: any) => order(a.verification_status) - order(b.verification_status))
        .slice(0, 8);
    },
  });

  // ─── 4. Live & upcoming events ───
  const { data: events } = useQuery({
    queryKey: ["discover-upcoming-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, slug, title, cover_url, starts_at, venue_name, is_online, category")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(6);
      return data ?? [];
    },
  });

  // ─── 5. Coins moving today ───
  const { data: coins } = useQuery({
    queryKey: ["discover-coins"],
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select("id, ticker, name, image_url, status, virtual_sol_reserves, real_sol_reserves, creator_id, updated_at")
        .in("status", ["active", "graduated"])
        .order("updated_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-12">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="pt-2"
      >
        <p className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
          <Compass className="h-3 w-3" /> Discover
        </p>
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl leading-[1.1] text-foreground">
          Get discovered.{" "}
          <span
            className="inline-block"
            style={{
              backgroundImage:
                "linear-gradient(to right, hsl(330 81% 60%), hsl(292 84% 61%), hsl(38 92% 50%))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Get supported.
          </span>
        </h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl">
          Independent artists, the people who care, and the on-chain rewards
          that keep both sides showing up. {user ? "Pick a thread." : "Have a look around."}
        </p>
      </motion.header>

      {/* ─── 1. Featured artist ─────────────────────────────────────── */}
      {featured && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Featured artist
            </h2>
          </div>
          <Link
            to={`/profiles/${featured.user_id}`}
            className="group relative block overflow-hidden rounded-3xl border border-border/60 bg-card hover:border-foreground/30 transition-colors"
          >
            {featured.banner_url && (
              <div
                className="absolute inset-0 opacity-30 group-hover:opacity-40 transition-opacity"
                style={{
                  backgroundImage: `url(${featured.banner_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
            <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start min-h-[220px]">
              <Avatar className="h-24 w-24 border-2 border-border shadow-lg shrink-0">
                <AvatarImage src={featured.avatar_url ?? undefined} />
                <AvatarFallback className="text-2xl font-bold">
                  {initials(featured.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
                  {featured.display_name || "Untitled artist"}
                </h3>
                {featured.headline && (
                  <p className="text-sm text-muted-foreground mt-1">{featured.headline}</p>
                )}
                {featured.bio && (
                  <p className="text-sm text-foreground/80 mt-3 line-clamp-3 max-w-2xl">
                    {featured.bio}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {featured.region_code && <RegionChip code={featured.region_code} size="sm" showLabel />}
                  {featured.location && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {featured.location}
                    </span>
                  )}
                  {(featured.mediums ?? []).slice(0, 3).map((m: string) => (
                    <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                  ))}
                </div>
                <span className="mt-5 inline-flex items-center text-xs font-medium text-primary gap-1 group-hover:gap-2 transition-all">
                  Open profile <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </Link>
        </motion.section>
      )}

      {/* ─── 2. Trending creators ───────────────────────────────────── */}
      {trendingCreators && trendingCreators.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Trending this week
            </h2>
            <Link to="/hub" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {trendingCreators.slice(0, 4).map((c: any) => (
              <Link
                key={c.user_id}
                to={`/profiles/${c.user_id}`}
                className="group flex flex-col items-center text-center rounded-2xl border border-border/60 bg-card p-4 hover:border-foreground/30 transition-colors"
              >
                <Avatar className="h-16 w-16 mb-3 border border-border">
                  <AvatarImage src={c.avatar_url ?? undefined} />
                  <AvatarFallback>{initials(c.display_name)}</AvatarFallback>
                </Avatar>
                <p className="text-sm font-semibold text-foreground truncate w-full">
                  {c.display_name || "Untitled"}
                </p>
                {c.headline && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 w-full">
                    {c.headline}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── 3. Fresh works ─────────────────────────────────────────── */}
      {works && works.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" /> Fresh works
            </h2>
            <Link to="/flow" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {works.map((w: any) => {
              // Audio/video uploads can have either a playable file or just a
              // link (Spotify, SoundCloud, YouTube). FlowThumbnail handles all
              // three: direct image file_url → YouTube poster → og:image →
              // typographic fallback. This matches Hub behavior so cards
              // don't read as "missing image" on Discover only.
              const isVideo =
                w.file_url &&
                (w.category === "video" || w.content_type === "video");
              return (
                <button
                  key={w.id}
                  onClick={() => navigate(`/profiles/${w.user_id}?tab=works`)}
                  className="group text-left rounded-xl border border-border/60 bg-card overflow-hidden hover:border-foreground/30 transition-colors"
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    {isVideo ? (
                      <video
                        src={w.file_url}
                        className="h-full w-full object-cover"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <FlowThumbnail
                        fileUrl={w.file_url}
                        linkUrl={w.link_url}
                        title={w.title || "Untitled"}
                        description={w.description}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                  </div>
                  <div className="p-3 space-y-1.5">
                    <p className="text-xs font-medium text-foreground truncate">{w.title || "Untitled"}</p>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-muted-foreground truncate">
                        {w.creator_name ?? "—"}
                      </span>
                      {w.solana_signature && (
                        <VerifiedIPBadge signature={w.solana_signature} size="xs" showLabel={false} />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── 4. Upcoming events ─────────────────────────────────────── */}
      {events && events.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" /> Showing up soon
            </h2>
            <Link to="/spaces?tab=events" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {events.map((e: any) => (
              <Link
                key={e.id}
                to={`/events/${e.slug || e.id}`}
                className="group rounded-xl border border-border/60 bg-card overflow-hidden hover:border-foreground/30 transition-colors"
              >
                {e.cover_url ? (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img src={e.cover_url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    <CalendarIcon className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{e.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{format(new Date(e.starts_at), "MMM d · h:mm a")}</span>
                    {e.is_online ? (
                      <Badge variant="outline" className="text-[9px]">Online</Badge>
                    ) : e.venue_name ? (
                      <span className="truncate">· {e.venue_name}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── Trending Verified Artists (fan→artist swap funnel) ────── */}
      <TrendingArtistsLane />

      {/* ─── 5. Coins moving today ──────────────────────────────────── */}
      {coins && coins.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Coins moving today
            </h2>
            <Link to="/launchpad" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {coins.map((c: any) => (
              <Link
                key={c.id}
                to={`/launchpad/${c.id}`}
                className="group rounded-xl border border-border/60 bg-card p-3 hover:border-foreground/30 transition-colors text-center"
              >
                <div className="aspect-square rounded-lg bg-muted overflow-hidden mb-2">
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Coins className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-foreground truncate">${c.ticker}</p>
                <p className="text-[10px] text-muted-foreground truncate">{c.name}</p>
                {c.status === "graduated" && (
                  <Badge variant="secondary" className="text-[9px] mt-1">Graduated</Badge>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── Empty state / sign-up nudge ────────────────────────────── */}
      {!featured && !trendingCreators?.length && !works?.length && (
        <section className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-2">
            Quiet day
          </p>
          <p className="text-sm text-foreground max-w-md mx-auto">
            The feed will fill up as artists share work, host events, and launch
            coins. Come back soon.
          </p>
        </section>
      )}

      {!user && (featured || works?.length) && (
        <section className="text-center pt-4 space-y-2">
          <Link to="/auth">
            <Button size="lg" className="rounded-full gap-1.5">
              Join the network <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="text-[11px] text-muted-foreground">
            Free to start. Built for independent artists.{" "}
            <Link
              to="/rewards"
              className="underline-offset-2 hover:underline text-foreground/70"
            >
              How rewards work →
            </Link>
          </p>
        </section>
      )}
    </div>
  );
};

export default DiscoverPage;

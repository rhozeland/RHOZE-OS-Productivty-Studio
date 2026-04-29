/**
 * HubPage — Rhozeland's editorial discovery surface.
 *
 * Replaces /marketplace, /flow, and /creators as a top-level destination.
 *
 * Layout:
 *   1. Hero — "The Hub" wordmark + intent line.
 *   2. Discovery feed (top) — recent flow_items rendered as an editorial
 *      masonry. Acts as inspiration / brand drops surface.
 *   3. Storefronts grid (below) — marketplace_listings grouped by creator,
 *      rendered as gradient cards. The actual marketplace.
 *
 * No DB schema changes — this is purely a new page that reuses existing
 * tables. Legacy /marketplace, /flow, /creators routes redirect here.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGate } from "@/components/AuthGateDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Sparkles,
  Plus,
  Store,
  ShoppingBag,
  ExternalLink,
  Briefcase,
  Handshake,
  Flame,
  TrendingUp,
} from "lucide-react";
import ListingCard from "@/components/marketplace/ListingCard";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";
import FlowThumbnail from "@/components/flow/FlowThumbnail";

type IntentKey = "all" | "service" | "project_request" | "collaboration" | "digital_product" | "physical_product";

const INTENTS: { key: IntentKey; label: string; icon: typeof Briefcase }[] = [
  { key: "all", label: "Everything", icon: Sparkles },
  { key: "service", label: "Services", icon: Briefcase },
  { key: "project_request", label: "Gigs", icon: ShoppingBag },
  { key: "collaboration", label: "Collabs", icon: Handshake },
  { key: "digital_product", label: "Digital", icon: Store },
  { key: "physical_product", label: "Physical", icon: Store },
];

const HubPage = () => {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const [intent, setIntent] = useState<IntentKey>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // ─── Discovery feed (Flow-style top section) ───────────────────────────
  const { data: flowItems, isLoading: loadingFlow } = useQuery({
    queryKey: ["hub-flow-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ─── Storefronts grid ──────────────────────────────────────────────────
  const { data: listings, isLoading: loadingListings } = useQuery({
    queryKey: ["hub-listings", intent, search],
    queryFn: async () => {
      let q = supabase
        .from("marketplace_listings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (intent !== "all") q = q.eq("listing_type", intent);
      if (search.trim()) {
        const term = search.trim();
        q = q.or(
          `title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`,
        );
      }
      const { data, error } = await q.limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const listingIds = useMemo(() => listings?.map((l: any) => l.id) ?? [], [listings]);

  const { data: allMedia } = useQuery({
    queryKey: ["hub-listing-media", listingIds],
    queryFn: async () => {
      if (listingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("listing_media")
        .select("*")
        .in("listing_id", listingIds)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: listingIds.length > 0,
  });

  const getMediaForListing = (id: string) =>
    allMedia?.filter((m: any) => m.listing_id === id) ?? [];

  // ─── Trending creators rail (most active sellers in last 30 days) ─────
  const { data: trendingCreators } = useQuery({
    queryKey: ["hub-trending-creators"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("marketplace_listings")
        .select("user_id")
        .eq("is_active", true)
        .gte("created_at", since)
        .limit(200);
      const counts = new Map<string, number>();
      (recent ?? []).forEach((r: any) => counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1));
      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id]) => id);
      if (topIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, headline")
        .in("user_id", topIds);
      return (profiles ?? [])
        .map((p: any) => ({ ...p, listing_count: counts.get(p.user_id) ?? 0 }))
        .sort((a: any, b: any) => b.listing_count - a.listing_count);
    },
  });

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-12">
      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-accent/5 p-8 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.12),transparent_55%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_85%,hsl(var(--accent)/0.10),transparent_55%)] pointer-events-none" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">
              Discover · Browse · Buy
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              The Hub.
            </h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-lg">
              Get inspired by what's dropping, then book the brand, hire the
              maker, or grab the piece. Marketplace meets mood board.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (!requireAuth("Sign up to post your work to the Hub.")) return;
                setCreateOpen(true);
              }}
              className="rounded-full"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Post Listing
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Discovery feed ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
              In the feed
            </p>
            <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">
              Fresh inspiration
            </h2>
          </div>
          <Link
            to="/flow"
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Open Flow Mode <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {loadingFlow && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] bg-muted animate-pulse rounded-2xl"
              />
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
                onClick={() => navigate("/flow")}
                variant="outline"
                size="sm"
                className="mt-4 rounded-full"
              >
                Open Flow Mode
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
                onClick={() => navigate("/flow")}
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

      {/* ─── Trending creators rail ──────────────────────────────────── */}
      {trendingCreators && trendingCreators.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
                Most active · Last 30 days
              </p>
              <h2 className="font-display text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Trending creators
              </h2>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
            {trendingCreators.map((c: any, i: number) => (
              <motion.div
                key={c.user_id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="snap-start shrink-0 w-44"
              >
                <Link
                  to={`/profiles/${c.user_id}`}
                  className="block rounded-2xl border border-border bg-card hover:bg-muted/30 hover:-translate-y-0.5 transition-all p-4 text-center group"
                >
                  {c.avatar_url ? (
                    <img
                      src={c.avatar_url}
                      alt={c.display_name || c.username || ""}
                      className="h-16 w-16 rounded-full object-cover mx-auto mb-3 ring-2 ring-border group-hover:ring-primary/40 transition-all"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-3 text-lg font-bold text-foreground">
                      {(c.display_name || c.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <p className="text-sm font-display font-semibold text-foreground line-clamp-1">
                    {c.display_name || c.username || "Anon"}
                  </p>
                  {c.headline && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                      {c.headline}
                    </p>
                  )}
                  <p className="text-[10px] text-primary font-medium mt-2">
                    {c.listing_count} new {c.listing_count === 1 ? "listing" : "listings"}
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
              For sale · For hire · For collab
            </p>
            <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">
              Storefronts
            </h2>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search the Hub…"
            className="pl-10 h-11 rounded-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Intent pills */}
        <div className="flex gap-2 flex-wrap mb-6">
          {INTENTS.map((it) => {
            const Icon = it.icon;
            const active = intent === it.key;
            return (
              <button
                key={it.key}
                onClick={() => setIntent(it.key)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {it.label}
              </button>
            );
          })}
        </div>

        {/* Listings grid */}
        {loadingListings ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-72 bg-muted animate-pulse rounded-2xl"
              />
            ))}
          </div>
        ) : !listings || listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <Store className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium">
              {search ? "No listings match your search." : "No listings yet."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Be the first to open shop.
            </p>
            <Button
              onClick={() => {
                if (!requireAuth("Sign up to post your work to the Hub.")) return;
                setCreateOpen(true);
              }}
              className="mt-4 rounded-full"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Post Listing
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing: any, i: number) => (
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

      <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default HubPage;

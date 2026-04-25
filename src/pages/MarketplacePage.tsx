import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGate } from "@/components/AuthGateDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Music,
  Palette,
  Camera,
  Video,
  PenTool,
  Search,
  Sparkles,
  Briefcase,
  FileText,
  Package,
  ShoppingBag,
  Handshake,
  LayoutGrid,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ListingCard from "@/components/marketplace/ListingCard";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";

const CATEGORIES = [
  { key: "all", label: "All", icon: Sparkles },
  { key: "music", label: "Music", icon: Music },
  { key: "design", label: "Design", icon: Palette },
  { key: "photo", label: "Photo", icon: Camera },
  { key: "video", label: "Video", icon: Video },
  { key: "writing", label: "Writing", icon: PenTool },
];

// Primary intent picker — the three core ways people use the marketplace
type IntentKey = "all" | "service" | "project_request" | "collaboration";

const INTENTS: {
  key: IntentKey;
  label: string;
  tagline: string;
  icon: typeof Briefcase;
  accent: string;
}[] = [
  {
    key: "all",
    label: "Everything",
    tagline: "Browse all listings",
    icon: LayoutGrid,
    accent: "hsl(var(--foreground))",
  },
  {
    key: "service",
    label: "Services",
    tagline: "Hire creators for work",
    icon: Briefcase,
    accent: "hsl(210 70% 50%)",
  },
  {
    key: "project_request",
    label: "Project Requests",
    tagline: "Get hired — find gigs",
    icon: ShoppingBag,
    accent: "hsl(30 85% 55%)",
  },
  {
    key: "collaboration",
    label: "Collaborations",
    tagline: "Team up & build together",
    icon: Handshake,
    accent: "hsl(280 60% 55%)",
  },
];

// Secondary product-only filters (only visible when relevant)
const PRODUCT_TYPES: {
  key: "all" | "digital_product" | "physical_product";
  label: string;
  icon: typeof FileText;
}[] = [
  { key: "all", label: "All Products", icon: Sparkles },
  { key: "digital_product", label: "Digital", icon: FileText },
  { key: "physical_product", label: "Physical", icon: Package },
];

const MarketplacePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeIntent, setActiveIntent] = useState<IntentKey>("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeProduct, setActiveProduct] = useState<"all" | "digital_product" | "physical_product">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Counts per intent — independent of current intent filter so the picker shows
  // accurate totals at all times
  const { data: typeCounts } = useQuery({
    queryKey: ["marketplace-type-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("listing_type")
        .eq("is_active", true);
      if (error) throw error;
      const counts: Record<string, number> = { all: 0 };
      (data ?? []).forEach((row: any) => {
        counts.all += 1;
        counts[row.listing_type] = (counts[row.listing_type] ?? 0) + 1;
      });
      return counts;
    },
  });

  const { data: listings, isLoading } = useQuery({
    queryKey: ["marketplace-listings", activeIntent, activeCategory, activeProduct, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_listings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (activeCategory !== "all") query = query.eq("category", activeCategory);

      // Intent takes precedence; if "all", fall through to product filter
      if (activeIntent !== "all") {
        query = query.eq("listing_type", activeIntent);
      } else if (activeProduct !== "all") {
        query = query.eq("listing_type", activeProduct);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        query = query.or(
          `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%,tags.cs.{"${q}"}`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch media for all listings
  const listingIds = listings?.map((l: any) => l.id) ?? [];
  const { data: allMedia } = useQuery({
    queryKey: ["listing-media-bulk", listingIds],
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

  // Fetch review stats for all listings
  const { data: reviewStats } = useQuery({
    queryKey: ["listing-reviews-bulk", listingIds],
    queryFn: async () => {
      if (listingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("reviews" as any)
        .select("listing_id, rating")
        .in("listing_id", listingIds);
      if (error) throw error;
      return data as any[];
    },
    enabled: listingIds.length > 0,
  });

  const getReviewStatsForListing = (listingId: string) => {
    const reviews = reviewStats?.filter((r: any) => r.listing_id === listingId) ?? [];
    if (reviews.length === 0) return null;
    const avg = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length;
    return { avg: Math.round(avg * 10) / 10, count: reviews.length };
  };

  const deleteListing = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase.from("marketplace_listings").delete().eq("id", listingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-type-counts"] });
      toast.success("Listing removed");
    },
  });

  const getMediaForListing = (listingId: string) =>
    allMedia?.filter((m: any) => m.listing_id === listingId) ?? [];

  const activeIntentMeta = useMemo(
    () => INTENTS.find((i) => i.key === activeIntent) ?? INTENTS[0],
    [activeIntent],
  );

  const productCount = (typeCounts?.digital_product ?? 0) + (typeCounts?.physical_product ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Marketplace</h1>
          <p className="text-muted-foreground text-sm">
            Hire, get hired, or build something together.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="rounded-full">
          <Plus className="mr-2 h-4 w-4" />
          Post Listing
        </Button>
      </div>

      {/* Intent picker — primary filter */}
      <div>
        <p className="text-[10px] font-body font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2.5">
          What are you here for?
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {INTENTS.map((intent) => {
            const Icon = intent.icon;
            const isActive = activeIntent === intent.key;
            const count = typeCounts?.[intent.key] ?? 0;
            return (
              <motion.button
                key={intent.key}
                onClick={() => setActiveIntent(intent.key)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`group relative text-left rounded-xl border p-3.5 transition-all ${
                  isActive
                    ? "border-foreground/60 bg-card shadow-md"
                    : "border-border bg-card/60 hover:border-foreground/30 hover:bg-card"
                }`}
                style={
                  isActive
                    ? { boxShadow: `0 0 0 1px ${intent.accent}33, 0 4px 16px -4px ${intent.accent}40` }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      background: isActive ? intent.accent : `${intent.accent}18`,
                      color: isActive ? "hsl(var(--background))" : intent.accent,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={`text-[10px] font-bold tabular-nums rounded-full px-1.5 py-0.5 ${
                      isActive ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </div>
                <p className="font-display text-sm font-semibold text-foreground leading-tight">
                  {intent.label}
                </p>
                <p className="text-[11px] text-muted-foreground font-body mt-0.5 leading-snug">
                  {intent.tagline}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={`Search ${activeIntentMeta.label.toLowerCase()}...`}
          className="pl-10 rounded-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Product subfilter — only when browsing Everything and products exist */}
      {activeIntent === "all" && productCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-body font-semibold uppercase tracking-[0.16em] text-muted-foreground mr-1">
            Products
          </span>
          {PRODUCT_TYPES.map((p) => {
            const Icon = p.icon;
            const isActive = activeProduct === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setActiveProduct(p.key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Category pills — refines the active intent */}
      <div>
        <p className="text-[10px] font-body font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2">
          Filter by craft
        </p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                  isActive
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active filter summary */}
      {(activeIntent !== "all" || activeCategory !== "all" || searchQuery) && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground font-body">
          <span>Showing</span>
          {activeIntent !== "all" && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
              style={{ background: `${activeIntentMeta.accent}18`, color: activeIntentMeta.accent }}
            >
              {activeIntentMeta.label}
            </span>
          )}
          {activeCategory !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-foreground font-medium capitalize">
              {activeCategory}
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-foreground font-medium">
              "{searchQuery}"
            </span>
          )}
          <button
            onClick={() => {
              setActiveIntent("all");
              setActiveCategory("all");
              setActiveProduct("all");
              setSearchQuery("");
            }}
            className="ml-1 underline hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card border border-border animate-pulse rounded-xl h-72" />
          ))}
        </div>
      ) : !listings || listings.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center py-20 rounded-2xl text-center">
          <activeIntentMeta.icon className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-foreground font-medium">
            {searchQuery
              ? "No listings match your search"
              : activeIntent === "all"
                ? "No listings yet"
                : `No ${activeIntentMeta.label.toLowerCase()} yet`}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {activeIntent === "service" && "Be the first creator to offer your skills."}
            {activeIntent === "project_request" && "Be the first to post a paid gig."}
            {activeIntent === "collaboration" && "Start a collab and find your team."}
            {activeIntent === "all" && "Be the first to post!"}
          </p>
          <div className="flex gap-2 mt-4">
            <Button className="rounded-full" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Post Listing
            </Button>
            {activeIntent !== "all" && (
              <Button variant="outline" className="rounded-full" onClick={() => setActiveIntent("all")}>
                Browse Everything
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {listings.map((listing: any, i: number) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                media={getMediaForListing(listing.id)}
                reviewStats={getReviewStatsForListing(listing.id)}
                index={i}
                isOwner={listing.user_id === user?.id}
                onInquire={() =>
                  navigate(`/messages?to=${listing.user_id}&listing=${encodeURIComponent(listing.title)}`)
                }
                onClick={() => navigate(`/marketplace/${listing.id}`)}
                onDelete={() => deleteListing.mutate(listing.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default MarketplacePage;

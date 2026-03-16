import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, Sparkles, Briefcase, FileText, Package, ShoppingBag,
  TrendingUp, ArrowRight,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ListingCard from "@/components/marketplace/ListingCard";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";
import CategoryTiles from "@/components/creators/CategoryTiles";
import Leaderboard from "@/components/creators/Leaderboard";
import CreatorSpotlight from "@/components/creators/CreatorSpotlight";

const TYPES = [
  { key: "all", label: "All" },
  { key: "service", label: "Services", icon: Briefcase },
  { key: "digital_product", label: "Digital", icon: FileText },
  { key: "physical_product", label: "Physical", icon: Package },
  { key: "project_request", label: "Requests", icon: ShoppingBag },
];

const CreatorsHubPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeType, setActiveType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Listings
  const { data: listings, isLoading } = useQuery({
    queryKey: ["marketplace-listings", activeCategory, activeType, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_listings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (activeCategory !== "all") query = query.eq("category", activeCategory);
      if (activeType !== "all") query = query.eq("listing_type", activeType);
      if (searchQuery.trim()) query = query.ilike("title", `%${searchQuery}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // All listings for counts
  const { data: allListings } = useQuery({
    queryKey: ["marketplace-listings-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("marketplace_listings").select("category").eq("is_active", true);
      return data ?? [];
    },
  });

  const listingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allListings?.forEach((l) => { counts[l.category] = (counts[l.category] || 0) + 1; });
    return counts;
  }, [allListings]);

  const listingIds = listings?.map((l: any) => l.id) ?? [];
  const { data: allMedia } = useQuery({
    queryKey: ["listing-media-bulk", listingIds],
    queryFn: async () => {
      if (listingIds.length === 0) return [];
      const { data, error } = await supabase.from("listing_media").select("*").in("listing_id", listingIds).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: listingIds.length > 0,
  });

  const { data: reviewStats } = useQuery({
    queryKey: ["listing-reviews-bulk", listingIds],
    queryFn: async () => {
      if (listingIds.length === 0) return [];
      const { data, error } = await supabase.from("reviews").select("listing_id, rating").in("listing_id", listingIds);
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
      toast.success("Listing removed");
    },
  });

  const getMediaForListing = (listingId: string) => allMedia?.filter((m: any) => m.listing_id === listingId) ?? [];

  // Trending: first 4 listings
  const trendingListings = listings?.slice(0, 4) ?? [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero - compact & social */}
      <div className="relative overflow-hidden rounded-3xl px-6 py-8 md:px-10 md:py-10">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 opacity-30" style={{
          background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 60%)"
        }} />
        <div className="relative z-10 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                Creators Hub
              </h1>
              <p className="text-muted-foreground text-sm mt-1 max-w-md">
                Discover, connect, and collaborate with talented creators across every medium.
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search creators & listings..."
                  className="pl-10 rounded-full bg-card/80 backdrop-blur-sm border-border/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button onClick={() => setCreateOpen(true)} className="rounded-full shrink-0">
                <Plus className="mr-1.5 h-4 w-4" /> Post
              </Button>
            </div>
          </div>

          {/* Trending inside hero */}
          {trendingListings.length > 0 && !searchQuery && activeCategory === "all" && (
            <div>
              <h2 className="font-display font-semibold text-foreground text-sm flex items-center gap-1.5 mb-3">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Trending Now
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {trendingListings.map((listing: any, i: number) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    media={getMediaForListing(listing.id)}
                    reviewStats={getReviewStatsForListing(listing.id)}
                    index={i}
                    isOwner={listing.user_id === user?.id}
                    onInquire={() => navigate(`/messages?to=${listing.user_id}&listing=${encodeURIComponent(listing.title)}`)}
                    onClick={() => navigate(`/creators/${listing.id}`)}
                    onDelete={() => deleteListing.mutate(listing.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const isActive = activeType === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveType(t.key)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all ${
                    isActive ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Listings grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card border border-border animate-pulse rounded-xl h-72" />
              ))}
            </div>
          ) : !listings || listings.length === 0 ? (
            <div className="surface-card flex flex-col items-center justify-center py-16 rounded-2xl">
              <Sparkles className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-foreground font-medium">{searchQuery ? "No results" : "No listings yet"}</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to post something</p>
              <Button className="mt-4 rounded-full" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Post Listing
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AnimatePresence>
                {listings.map((listing: any, i: number) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    media={getMediaForListing(listing.id)}
                    reviewStats={getReviewStatsForListing(listing.id)}
                    index={i}
                    isOwner={listing.user_id === user?.id}
                    onInquire={() => navigate(`/messages?to=${listing.user_id}&listing=${encodeURIComponent(listing.title)}`)}
                    onClick={() => navigate(`/creators/${listing.id}`)}
                    onDelete={() => deleteListing.mutate(listing.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="space-y-6 hidden lg:block">
          <Leaderboard />
          <CreatorSpotlight />
        </aside>
      </div>

      {/* Mobile: Leaderboard + Creators below feed */}
      <div className="lg:hidden space-y-6">
        <Leaderboard />
        <CreatorSpotlight />
      </div>

      <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default CreatorsHubPage;

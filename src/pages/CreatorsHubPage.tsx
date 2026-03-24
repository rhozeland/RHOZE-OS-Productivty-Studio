import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, Sparkles, Briefcase, FileText, Package, ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ListingCard from "@/components/marketplace/ListingCard";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";
import CategoryTiles from "@/components/creators/CategoryTiles";
import Leaderboard from "@/components/creators/Leaderboard";

const TYPES = [
  { key: "all", label: "All Types" },
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero header */}
      <div className="space-y-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Discover Creative Work
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Browse digital assets, hire creators, and find collaborators.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="rounded-full shrink-0 self-start">
            <Plus className="mr-1.5 h-4 w-4" /> Post Listing
          </Button>
        </div>
      </div>

      {/* Search + Type filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search creators and listings..."
            className="pl-10 rounded-full bg-card border-border/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={activeType} onValueChange={setActiveType}>
          <SelectTrigger className="w-full sm:w-44 rounded-full">
            <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category filter pills — compact */}
      <CategoryTiles
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
        listingCounts={listingCounts}
      />

      {/* Leaderboard */}
      <Leaderboard />

      {/* Listings grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
                onInquire={() => navigate(`/messages?to=${listing.user_id}&listing=${encodeURIComponent(listing.title)}`)}
                onClick={() => navigate(`/creators/${listing.id}`)}
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

export default CreatorsHubPage;

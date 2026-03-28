import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
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

const TYPES = [
  { key: "all", label: "All Types" },
  { key: "service", label: "Services", icon: Briefcase },
  { key: "digital_product", label: "Digital", icon: FileText },
  { key: "physical_product", label: "Physical", icon: Package },
  { key: "project_request", label: "Requests", icon: ShoppingBag },
];

const MarketplacePage = () => {
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
      toast.success("Listing removed");
    },
  });

  const getMediaForListing = (listingId: string) =>
    allMedia?.filter((m: any) => m.listing_id === listingId) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Marketplace</h1>
          <p className="text-muted-foreground text-sm">
            Services, beats, products & project requests from the creative community
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="rounded-full">
          <Plus className="mr-2 h-4 w-4" />
          Post Listing
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search beats, services, products..."
          className="pl-10 rounded-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Type pills */}
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const isActive = activeType === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveType(t.key)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Category pills */}
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

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card border border-border animate-pulse rounded-xl h-72" />
          ))}
        </div>
      ) : !listings || listings.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center py-20 rounded-2xl">
          <Sparkles className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-foreground font-medium">
            {searchQuery ? "No listings match your search" : "No listings yet"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Be the first to post!</p>
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

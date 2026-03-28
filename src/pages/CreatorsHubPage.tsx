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
  SlidersHorizontal, Users, Clock, Zap, LayoutGrid, ArrowRight, Coins,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ListingCard from "@/components/marketplace/ListingCard";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";
import CategoryTiles from "@/components/creators/CategoryTiles";
import Leaderboard from "@/components/creators/Leaderboard";
import { formatDistanceToNow, isPast } from "date-fns";
import { cn } from "@/lib/utils";

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

  const { data: allListings } = useQuery({
    queryKey: ["marketplace-listings-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("marketplace_listings").select("category").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: dropRooms } = useQuery({
    queryKey: ["drop-rooms-hub"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drop_rooms")
        .select("*, drop_room_members(count)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []).filter((r: any) => !isPast(new Date(r.expires_at)));
    },
  });

  const { data: publicBoards } = useQuery({
    queryKey: ["public-boards-hub"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboards")
        .select("*")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(6);
      if (error) throw error;
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

  const hasCollabRooms = (dropRooms?.length ?? 0) > 0;
  const hasPublicBoards = (publicBoards?.length ?? 0) > 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero header — editorial */}
      <div className="relative overflow-hidden rounded-lg">
        <div className="absolute inset-0 grid-overlay pointer-events-none" />
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="iridescent-blob absolute -top-10 right-0 w-[400px] h-[250px] rounded-full opacity-50"
            style={{
              background: "linear-gradient(135deg, hsl(280, 80%, 70%), hsl(320, 80%, 60%), hsl(30, 90%, 60%))",
              filter: "blur(50px)",
            }}
          />
        </div>
        <div className="relative z-10 px-8 py-12 md:px-10 md:py-16">
          <p className="text-xs font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-3">
            Community
          </p>
          <h1 className="font-display text-3xl md:text-5xl text-foreground leading-[1.1] mb-3">
            Creators Hub
          </h1>
          <p className="text-sm text-muted-foreground max-w-md font-body leading-relaxed mb-6">
            Discover work, collaborate in real-time, and earn $RHOZE.
          </p>
          <button onClick={() => setCreateOpen(true)} className="btn-editorial">
            Post Listing <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Live Collab + Public Boards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[1px] bg-border rounded-lg overflow-hidden">
        {/* Collab Rooms */}
        <div className="bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-foreground" />
              <h2 className="font-display text-base text-foreground">Live Collab Rooms</h2>
              {hasCollabRooms && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
              )}
            </div>
            <button onClick={() => navigate("/drop-rooms")} className="text-xs text-muted-foreground hover:text-foreground font-body transition-colors">
              View all →
            </button>
          </div>
          {hasCollabRooms ? (
            <div className="grid grid-cols-2 gap-2">
              {dropRooms!.slice(0, 4).map((room: any) => {
                const memberCount = room.drop_room_members?.[0]?.count ?? 0;
                return (
                  <button
                    key={room.id}
                    onClick={() => navigate(`/drop-rooms/${room.id}`)}
                    className="card-dashed p-3 text-left hover:border-foreground/30 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground truncate font-body">{room.title}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground font-body">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {memberCount}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(room.expires_at))}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1 font-body">{room.category}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Zap className="h-6 w-6 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground font-body">No live rooms right now</p>
              <button onClick={() => navigate("/drop-rooms")} className="mt-3 text-xs font-body font-medium text-foreground underline underline-offset-2">
                Start a Room
              </button>
            </div>
          )}
        </div>

        {/* Public Boards */}
        <div className="bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-foreground" />
              <h2 className="font-display text-base text-foreground">Community Boards</h2>
            </div>
            <button onClick={() => navigate("/smartboards")} className="text-xs text-muted-foreground hover:text-foreground font-body transition-colors">
              View all →
            </button>
          </div>
          {hasPublicBoards ? (
            <div className="grid grid-cols-2 gap-2">
              {publicBoards!.slice(0, 4).map((board: any) => (
                <button
                  key={board.id}
                  onClick={() => navigate(`/smartboards/${board.id}`)}
                  className="card-dashed p-3 text-left hover:border-foreground/30 transition-colors"
                >
                  <div
                    className="w-full h-6 rounded-sm mb-2"
                    style={{ background: board.cover_color || board.background_color || "hsl(var(--muted))" }}
                  />
                  <p className="text-sm font-medium text-foreground truncate font-body">{board.title}</p>
                  {board.description && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 font-body">{board.description}</p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <LayoutGrid className="h-6 w-6 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground font-body">No public boards yet</p>
              <button onClick={() => navigate("/smartboards")} className="mt-3 text-xs font-body font-medium text-foreground underline underline-offset-2">
                Create a Board
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Earn $RHOZE — minimal banner */}
      <div className="border border-dashed border-border rounded-lg p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Coins className="h-5 w-5 text-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground font-body">Earn $RHOZE by creating</p>
            <p className="text-xs text-muted-foreground font-body">Post listings, collab in rooms, and curate boards to earn tokens.</p>
          </div>
        </div>
        <button onClick={() => navigate("/credits")} className="text-xs font-body font-medium text-foreground underline underline-offset-2 shrink-0">
          Learn more →
        </button>
      </div>

      {/* Search + Type filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search artists, music, design, services, and more..."
            className="pl-9 rounded-sm bg-card border-border text-sm font-body h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={activeType} onValueChange={setActiveType}>
          <SelectTrigger className="w-full sm:w-44 rounded-sm h-10">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
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

      {/* Category filter */}
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
            <div key={i} className="bg-card border border-border animate-pulse rounded-lg h-72" />
          ))}
        </div>
      ) : !listings || listings.length === 0 ? (
        <div className="card-dashed flex flex-col items-center justify-center py-16">
          <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-foreground font-medium font-body">{searchQuery ? "No results" : "No listings yet"}</p>
          <p className="text-xs text-muted-foreground mt-1 font-body">Be the first to post something</p>
          <button className="btn-editorial mt-4 text-xs" onClick={() => setCreateOpen(true)}>
            Post Listing <ArrowRight className="h-3 w-3" />
          </button>
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
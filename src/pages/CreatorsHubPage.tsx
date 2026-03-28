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
  SlidersHorizontal, Flame, Users, Clock, Zap, LayoutGrid, ArrowRight,
  Coins,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
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

const ROOM_COLORS: Record<string, string> = {
  general: "from-violet-500/20 to-purple-600/20",
  music: "from-rose-500/20 to-pink-600/20",
  design: "from-cyan-500/20 to-blue-600/20",
  video: "from-amber-500/20 to-orange-600/20",
  writing: "from-emerald-500/20 to-green-600/20",
  code: "from-slate-500/20 to-gray-600/20",
  business: "from-yellow-500/20 to-amber-600/20",
};

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

  // Fetch active drop rooms
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

  // Fetch public smartboards
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero header */}
      <div className="space-y-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Creators Hub
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Discover work, collaborate in real-time, and earn $RHOZE.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="rounded-full shrink-0 self-start">
            <Plus className="mr-1.5 h-4 w-4" /> Post Listing
          </Button>
        </div>
      </div>

      {/* Live Collab Rooms + Public Boards row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Collab Rooms */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-semibold text-foreground">Live Collab Rooms</h2>
              {hasCollabRooms && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/drop-rooms")}>
              View all
            </Button>
          </div>
          {hasCollabRooms ? (
            <div className="grid grid-cols-2 gap-2">
              {dropRooms!.slice(0, 4).map((room: any) => {
                const memberCount = room.drop_room_members?.[0]?.count ?? 0;
                const colorClass = ROOM_COLORS[room.category] || ROOM_COLORS.general;
                return (
                  <motion.button
                    key={room.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/drop-rooms/${room.id}`)}
                    className={cn(
                      "relative rounded-xl p-3 text-left border border-border/50 bg-gradient-to-br transition-all hover:shadow-md",
                      colorClass
                    )}
                  >
                    <p className="text-sm font-medium text-foreground truncate">{room.title}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {memberCount}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(room.expires_at))}</span>
                    </div>
                    <Badge variant="outline" className="absolute top-2 right-2 text-[9px] h-5 capitalize">{room.category}</Badge>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Zap className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No live rooms right now</p>
              <Button variant="outline" size="sm" className="mt-2 rounded-full text-xs" onClick={() => navigate("/drop-rooms")}>
                Start a Room
              </Button>
            </div>
          )}
        </div>

        {/* Public Boards */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-semibold text-foreground">Community Boards</h2>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/smartboards")}>
              View all
            </Button>
          </div>
          {hasPublicBoards ? (
            <div className="grid grid-cols-2 gap-2">
              {publicBoards!.slice(0, 4).map((board: any) => (
                <motion.button
                  key={board.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/smartboards/${board.id}`)}
                  className="rounded-xl p-3 text-left border border-border/50 bg-muted/30 transition-all hover:shadow-md hover:bg-muted/50"
                >
                  <div
                    className="w-full h-8 rounded-lg mb-2"
                    style={{ background: board.cover_color || board.background_color || "hsl(var(--muted))" }}
                  />
                  <p className="text-sm font-medium text-foreground truncate">{board.title}</p>
                  {board.description && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{board.description}</p>
                  )}
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <LayoutGrid className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No public boards yet</p>
              <Button variant="outline" size="sm" className="mt-2 rounded-full text-xs" onClick={() => navigate("/smartboards")}>
                Create a Board
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Earn $RHOZE banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 p-4 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Earn $RHOZE by creating</p>
            <p className="text-xs text-muted-foreground">Post listings, collab in rooms, and curate boards to earn tokens.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-full shrink-0 text-xs" onClick={() => navigate("/credits")}>
          Learn more <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </motion.div>

      {/* Search + Type filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search artists, music, design, services, and more..."
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

      {/* Category filter pills */}
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

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, Sparkles, Briefcase, FileText, Package, ShoppingBag,
  SlidersHorizontal, Users, Clock, Zap, LayoutGrid, ArrowRight, Coins,
  Trophy, Flame, TrendingUp,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ListingCard from "@/components/marketplace/ListingCard";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";
import CategoryTiles from "@/components/creators/CategoryTiles";
import Leaderboard from "@/components/creators/Leaderboard";
import FlowFeed from "@/components/creators/FlowFeed";
import { formatDistanceToNow, isPast } from "date-fns";
import { cn } from "@/lib/utils";

const TYPES = [
  { key: "all", label: "All Listings" },
  { key: "service", label: "Services", icon: Briefcase },
  { key: "project_request", label: "Job Requests", icon: ShoppingBag },
  { key: "collaboration", label: "Collabs", icon: Users },
];

const SORT_OPTIONS = [
  { key: "recent", label: "Most Recent" },
  { key: "trending", label: "Trending" },
];

const TABS = [
  { key: "listings", label: "Listings", icon: Sparkles },
  { key: "flow", label: "Flow", icon: Flame },
  { key: "collab", label: "Collab Rooms", icon: Zap },
  { key: "boards", label: "Boards", icon: LayoutGrid },
] as const;

type TabKey = typeof TABS[number]["key"];

const CreatorsHubPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("listings");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeType, setActiveType] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["marketplace-listings", activeCategory, activeType],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_listings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (activeCategory !== "all") query = query.eq("category", activeCategory);
      if (activeType !== "all") query = query.eq("listing_type", activeType);
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
        .limit(8);
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
        .limit(8);
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

  // Inquiry counts for trending sort
  const { data: inquiryCounts } = useQuery({
    queryKey: ["listing-inquiry-counts", listingIds],
    queryFn: async () => {
      if (listingIds.length === 0) return {};
      const { data } = await supabase.from("listing_inquiries").select("listing_id").in("listing_id", listingIds);
      const counts: Record<string, number> = {};
      data?.forEach((i) => { counts[i.listing_id] = (counts[i.listing_id] || 0) + 1; });
      return counts;
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

  // Sort listings
  const sortedListings = useMemo(() => {
    if (!listings) return [];
    const arr = [...listings];
    switch (sortBy) {
      case "trending":
        return arr.sort((a, b) => ((inquiryCounts as any)?.[b.id] ?? 0) - ((inquiryCounts as any)?.[a.id] ?? 0));
      default:
        return arr;
    }
  }, [listings, sortBy, inquiryCounts]);

  const hasCollabRooms = (dropRooms?.length ?? 0) > 0;
  const hasPublicBoards = (publicBoards?.length ?? 0) > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero */}
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
        <div className="relative z-10 px-8 py-10 md:px-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-xs font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-3">
                Community
              </p>
              <h1 className="font-display text-3xl md:text-5xl text-foreground leading-[1.1] mb-3">
                Creators Hub
              </h1>
              <p className="text-sm text-muted-foreground max-w-md font-body leading-relaxed">
                Discover services, find talent, and post creative projects.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-3 px-5 py-3 rounded-lg border border-dashed border-foreground/20 bg-card/60 backdrop-blur-sm"
            >
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Coins className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground font-body">Earn $RHOZE</p>
                <p className="text-[11px] text-muted-foreground font-body">Post, collab, curate → earn tokens</p>
              </div>
              <button
                onClick={() => navigate("/credits")}
                className="text-xs font-body text-foreground underline underline-offset-2 shrink-0 ml-2"
              >
                Learn&nbsp;more
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <Leaderboard />

      {/* Four-tab navigation */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-body font-medium transition-colors relative whitespace-nowrap shrink-0",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.key === "collab" && hasCollabRooms && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
              )}
              {active && (
                <motion.div
                  layoutId="hub-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {/* ───── LISTINGS TAB ───── */}
        {activeTab === "listings" && (
          <motion.div
            key="listings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Filters row */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <CategoryTiles
                activeCategory={activeCategory}
                onSelect={setActiveCategory}
                listingCounts={listingCounts}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={activeType} onValueChange={setActiveType}>
                  <SelectTrigger className="w-36 rounded-sm h-9 text-xs">
                    <SlidersHorizontal className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40 rounded-sm h-9 text-xs">
                    <TrendingUp className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button onClick={() => setCreateOpen(true)} className="btn-editorial text-xs">
                  <Plus className="h-3.5 w-3.5" /> Post
                </button>
              </div>
            </div>

            {/* Listings grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-card border border-border animate-pulse rounded-lg h-72" />
                ))}
              </div>
            ) : !sortedListings || sortedListings.length === 0 ? (
              <div className="card-dashed flex flex-col items-center justify-center py-16">
                <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-foreground font-medium font-body">No listings yet</p>
                <p className="text-xs text-muted-foreground mt-1 font-body">Be the first to post a service or job request</p>
                <button className="btn-editorial mt-4 text-xs" onClick={() => setCreateOpen(true)}>
                  Post a Listing <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {sortedListings.map((listing: any, i: number) => (
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
          </motion.div>
        )}

        {/* ───── FLOW TAB ───── */}
        {activeTab === "flow" && (
          <motion.div
            key="flow"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <FlowFeed />
          </motion.div>
        )}

        {/* ───── COLLAB ROOMS TAB ───── */}
        {activeTab === "collab" && (
          <motion.div
            key="collab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-body">
                {hasCollabRooms ? `${dropRooms!.length} active rooms` : "No live rooms right now"}
              </p>
              <button
                onClick={() => navigate("/drop-rooms")}
                className="btn-editorial text-xs"
              >
                {hasCollabRooms ? "View All Rooms" : "Start a Room"} <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {hasCollabRooms ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dropRooms!.map((room: any, i: number) => {
                  const memberCount = room.drop_room_members?.[0]?.count ?? 0;
                  return (
                    <motion.button
                      key={room.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => navigate(`/drop-rooms/${room.id}`)}
                      className="card-dashed p-4 text-left hover:border-foreground/30 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-body">{room.category} · Live</span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate font-body group-hover:text-accent transition-colors">{room.title}</p>
                      {room.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 font-body">{room.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground font-body">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {memberCount} joined</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(room.expires_at))} left</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="card-dashed flex flex-col items-center justify-center py-16">
                <Zap className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground font-body">No live rooms right now</p>
                <p className="text-xs text-muted-foreground mt-1 font-body">Start one and earn $RHOZE for hosting</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ───── BOARDS TAB ───── */}
        {activeTab === "boards" && (
          <motion.div
            key="boards"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-body">
                {hasPublicBoards ? `${publicBoards!.length} community boards` : "No public boards yet"}
              </p>
              <button
                onClick={() => navigate("/smartboards")}
                className="btn-editorial text-xs"
              >
                {hasPublicBoards ? "View All Boards" : "Create a Board"} <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {hasPublicBoards ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {publicBoards!.map((board: any, i: number) => (
                  <motion.button
                    key={board.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => navigate(`/smartboards/${board.id}`)}
                    className="card-dashed p-4 text-left hover:border-foreground/30 transition-colors group"
                  >
                    <div
                      className="w-full h-16 rounded-md mb-3"
                      style={{ background: board.cover_color || board.background_color || "hsl(var(--muted))" }}
                    />
                    <p className="text-sm font-medium text-foreground truncate font-body group-hover:text-accent transition-colors">{board.title}</p>
                    {board.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 font-body">{board.description}</p>
                    )}
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="card-dashed flex flex-col items-center justify-center py-16">
                <LayoutGrid className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground font-body">No community boards yet</p>
                <p className="text-xs text-muted-foreground mt-1 font-body">Curate a board and earn $RHOZE</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default CreatorsHubPage;

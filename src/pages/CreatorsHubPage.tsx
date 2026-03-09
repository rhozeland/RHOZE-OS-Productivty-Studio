import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Users,
  TrendingUp,
  Star,
  User,
  Globe,
  CheckCircle,
  MapPin,
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
  const [activeTab, setActiveTab] = useState("listings");
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
      const { data, error } = await supabase.from("reviews" as any).select("listing_id, rating").in("listing_id", listingIds);
      if (error) throw error;
      return data as any[];
    },
    enabled: listingIds.length > 0,
  });

  // Profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
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

  const filteredProfiles = profiles?.filter((p) => {
    const isOwn = p.user_id === user?.id;
    const isPublic = p.is_public !== false;
    if (!isOwn && !isPublic) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.bio?.toLowerCase().includes(q) ||
      p.skills?.some((s: string) => s.toLowerCase().includes(q)) ||
      p.mediums?.some((m: string) => m.toLowerCase().includes(q)) ||
      p.location?.toLowerCase().includes(q)
    );
  });

  const initials = (name: string | null) =>
    (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // Featured/trending: newest listings
  const trendingListings = listings?.slice(0, 3) ?? [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl px-6 py-10 md:px-10 md:py-14">
        <div className="absolute inset-0 animated-gradient" style={{
          background: "linear-gradient(135deg, hsl(175 40% 82%), hsl(260 35% 85%), hsl(340 40% 88%))",
          backgroundSize: "200% 200%",
        }} />
        <div className="absolute inset-0 opacity-20" style={{
          background: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.5) 0%, transparent 50%)"
        }} />
        <div className="relative z-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">Creators Hub</h1>
          <p className="text-muted-foreground mt-1 max-w-lg">
            Discover talented creators, browse services & products, and connect with the community.
          </p>
          <div className="flex gap-3 mt-4">
            <Button onClick={() => setCreateOpen(true)} className="rounded-full">
              <Plus className="mr-2 h-4 w-4" /> Post Listing
            </Button>
          </div>
        </div>
      </div>

      {/* Trending strip */}
      {trendingListings.length > 0 && (
        <div>
          <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Trending Now
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search listings, creators, skills..."
          className="pl-10 rounded-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs: Listings / Creators */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="listings" className="gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" /> Listings
          </TabsTrigger>
          <TabsTrigger value="creators" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Creators
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="space-y-4 mt-4">
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
                    isActive ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:text-foreground"
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
                    isActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
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
              <p className="text-foreground font-medium">{searchQuery ? "No listings match your search" : "No listings yet"}</p>
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
        </TabsContent>

        <TabsContent value="creators" className="mt-4">
          {profilesLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="surface-card h-64 animate-pulse" />
              ))}
            </div>
          ) : filteredProfiles?.length === 0 ? (
            <div className="text-center py-16">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">No creators found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? "Try a different search term" : "No creators have signed up yet"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProfiles?.map((profile, i) => (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/profiles/${profile.user_id}`)}
                  className="surface-card overflow-hidden cursor-pointer hover:shadow-md transition-all group"
                >
                  <div className="h-20 transition-colors" style={{ background: profile.banner_gradient || 'linear-gradient(135deg, hsl(175 50% 85%), hsl(310 50% 90%), hsl(280 40% 92%))' }} />
                  <div className="p-5">
                    <div className="-mt-14 mb-3 flex items-center justify-center rounded-full border-4 border-card bg-muted shadow-sm overflow-hidden" style={{ width: 72, height: 72 }}>
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <span className="font-display text-lg font-bold text-muted-foreground">{initials(profile.display_name)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-foreground truncate">{profile.display_name || "Creator"}</h3>
                      {profile.user_id === user?.id && <Badge variant="outline" className="text-[10px] shrink-0">You</Badge>}
                    </div>
                    {profile.headline && <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile.headline}</p>}
                    <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{profile.bio || "No bio yet"}</p>
                    {profile.skills && profile.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {profile.skills.slice(0, 3).map((skill: string) => (
                          <span key={skill} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{skill}</span>
                        ))}
                        {profile.skills.length > 3 && <span className="text-xs text-muted-foreground">+{profile.skills.length - 3}</span>}
                      </div>
                    )}
                    {profile.mediums && profile.mediums.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {profile.mediums.slice(0, 3).map((medium: string) => (
                          <span key={medium} className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent-foreground flex items-center gap-1">
                            <Palette className="h-2.5 w-2.5" /> {medium}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                      {profile.available && <span className="flex items-center gap-1 text-primary"><CheckCircle className="h-3 w-3" /> Available</span>}
                      {profile.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {profile.location}</span>}
                      {profile.portfolio_url && <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> Portfolio</span>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default CreatorsHubPage;

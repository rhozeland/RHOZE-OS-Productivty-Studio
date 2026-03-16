import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Star, Zap, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const Leaderboard = () => {
  const navigate = useNavigate();

  // Top sellers by review count & rating
  const { data: topSellers } = useQuery({
    queryKey: ["leaderboard-top-sellers"],
    queryFn: async () => {
      const { data: reviews } = await supabase.from("reviews").select("seller_id, rating");
      if (!reviews?.length) return [];
      const sellerMap: Record<string, { total: number; count: number }> = {};
      reviews.forEach((r) => {
        if (!sellerMap[r.seller_id]) sellerMap[r.seller_id] = { total: 0, count: 0 };
        sellerMap[r.seller_id].total += r.rating;
        sellerMap[r.seller_id].count++;
      });
      const sorted = Object.entries(sellerMap)
        .map(([id, s]) => ({ user_id: id, avg: s.total / s.count, count: s.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      const ids = sorted.map((s) => s.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url, headline").in("user_id", ids);
      return sorted.map((s) => ({ ...s, profile: profiles?.find((p) => p.user_id === s.user_id) }));
    },
  });

  // Rising creators (newest profiles with public visibility)
  const { data: risingCreators } = useQuery({
    queryKey: ["leaderboard-rising"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, headline, skills, created_at")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // Most inquired listings
  const { data: hotListings } = useQuery({
    queryKey: ["leaderboard-hot-listings"],
    queryFn: async () => {
      const { data: inquiries } = await supabase.from("listing_inquiries").select("listing_id");
      if (!inquiries?.length) return [];
      const countMap: Record<string, number> = {};
      inquiries.forEach((i) => { countMap[i.listing_id] = (countMap[i.listing_id] || 0) + 1; });
      const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const ids = sorted.map(([id]) => id);
      const { data: listings } = await supabase.from("marketplace_listings").select("id, title, category, cover_url, user_id").in("id", ids);
      return sorted.map(([id, count]) => ({ listing_id: id, inquiries: count, listing: listings?.find((l) => l.id === id) }));
    },
  });

  const initials = (name: string | null) =>
    (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="surface-card p-5 rounded-2xl">
      <h2 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2">
        <Flame className="h-5 w-5 text-orange-500" /> Leaderboard
      </h2>
      <Tabs defaultValue="popular">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="popular" className="text-xs gap-1"><TrendingUp className="h-3 w-3" /> Popular</TabsTrigger>
          <TabsTrigger value="sellers" className="text-xs gap-1"><Star className="h-3 w-3" /> Top Sellers</TabsTrigger>
          <TabsTrigger value="rising" className="text-xs gap-1"><Zap className="h-3 w-3" /> Rising</TabsTrigger>
        </TabsList>

        <TabsContent value="popular" className="mt-3 space-y-2">
          {(!hotListings || hotListings.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">No trending listings yet</p>
          ) : hotListings.map((item, i) => (
            <motion.div
              key={item.listing_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/creators/${item.listing_id}`)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <span className="font-display font-bold text-muted-foreground text-lg w-6 text-center">{i + 1}</span>
              {item.listing?.cover_url ? (
                <img src={item.listing.cover_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">🔥</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.listing?.title || "Listing"}</p>
                <p className="text-[10px] text-muted-foreground">{item.inquiries} inquiries</p>
              </div>
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent value="sellers" className="mt-3 space-y-2">
          {(!topSellers || topSellers.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">No sellers yet</p>
          ) : topSellers.map((seller, i) => (
            <motion.div
              key={seller.user_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/profiles/${seller.user_id}`)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <span className="font-display font-bold text-muted-foreground text-lg w-6 text-center">{i + 1}</span>
              <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {seller.profile?.avatar_url ? (
                  <img src={seller.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">{initials(seller.profile?.display_name ?? null)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{seller.profile?.display_name || "Creator"}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  {(seller.avg).toFixed(1)} · {seller.count} reviews
                </p>
              </div>
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent value="rising" className="mt-3 space-y-2">
          {(!risingCreators || risingCreators.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">No rising creators yet</p>
          ) : risingCreators.map((creator, i) => (
            <motion.div
              key={creator.user_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/profiles/${creator.user_id}`)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <span className="font-display font-bold text-muted-foreground text-lg w-6 text-center">{i + 1}</span>
              <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {creator.avatar_url ? (
                  <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">{initials(creator.display_name)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{creator.display_name || "New Creator"}</p>
                {creator.skills?.length > 0 && (
                  <p className="text-[10px] text-muted-foreground truncate">{creator.skills.slice(0, 2).join(" · ")}</p>
                )}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">New</span>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Leaderboard;

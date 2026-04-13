import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Zap, Flame, Award, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const Leaderboard = () => {
  const navigate = useNavigate();

  /* Top Earners — most $RHOZE reward transactions */
  const { data: topEarners } = useQuery({
    queryKey: ["leaderboard-top-earners"],
    queryFn: async () => {
      const { data: txs } = await supabase
        .from("credit_transactions")
        .select("user_id, amount")
        .eq("type", "reward");
      if (!txs?.length) return [];
      const map: Record<string, number> = {};
      txs.forEach((t) => { map[t.user_id] = (map[t.user_id] || 0) + t.amount; });
      const sorted = Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      const ids = sorted.map(([id]) => id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids);
      return sorted.map(([id, earned]) => ({
        user_id: id,
        earned,
        profile: profiles?.find((p) => p.user_id === id),
      }));
    },
  });

  /* Trending — most flow interactions in the last 7 days */
  const { data: trendingContent } = useQuery({
    queryKey: ["leaderboard-trending"],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: interactions } = await supabase
        .from("flow_interactions")
        .select("flow_item_id")
        .gte("created_at", weekAgo);
      if (!interactions?.length) return [];
      const map: Record<string, number> = {};
      interactions.forEach((i) => { map[i.flow_item_id] = (map[i.flow_item_id] || 0) + 1; });
      const sorted = Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      const ids = sorted.map(([id]) => id);
      const { data: items } = await supabase
        .from("flow_items")
        .select("id, title, category, user_id")
        .in("id", ids);
      const userIds = [...new Set(items?.map((i) => i.user_id) ?? [])];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds)
        : { data: [] };
      return sorted.map(([id, count]) => {
        const item = items?.find((i) => i.id === id);
        return {
          flow_item_id: id,
          interactions: count,
          item,
          profile: profiles?.find((p) => p.user_id === item?.user_id),
        };
      });
    },
  });

  /* New Members — newest public profiles */
  const { data: newMembers } = useQuery({
    queryKey: ["leaderboard-new-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, skills, created_at")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const initials = (name: string | null) =>
    (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const Avatar = ({ url, name }: { url: string | null; name: string | null }) => (
    <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-bold text-muted-foreground">{initials(name)}</span>
      )}
    </div>
  );

  const EmptyState = ({ text }: { text: string }) => (
    <p className="text-sm text-muted-foreground text-center py-6">{text}</p>
  );

  return (
    <div className="surface-card p-5 rounded-2xl">
      <h2 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2">
        <Flame className="h-5 w-5 text-primary" /> Leaderboard
      </h2>
      <Tabs defaultValue="earners">
        <TabsList className="w-full grid grid-cols-3 mb-3">
          <TabsTrigger value="earners" className="text-xs gap-1"><Coins className="h-3 w-3" /> Top Earners</TabsTrigger>
          <TabsTrigger value="trending" className="text-xs gap-1"><Flame className="h-3 w-3" /> Trending</TabsTrigger>
          <TabsTrigger value="new" className="text-xs gap-1"><UserPlus className="h-3 w-3" /> New Members</TabsTrigger>
        </TabsList>

        <TabsContent value="earners" className="mt-0">
          {(!topEarners || topEarners.length === 0) ? (
            <EmptyState text="No $RHOZE earned yet — be the first!" />
          ) : (
            <div className="space-y-2">
              {topEarners.map((item, i) => (
                <motion.div
                  key={item.user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/profiles/${item.user_id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                >
                  <span className="font-display font-bold text-muted-foreground text-lg w-6 text-center shrink-0">{i + 1}</span>
                  <Avatar url={item.profile?.avatar_url ?? null} name={item.profile?.display_name ?? null} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.profile?.display_name || "Creator"}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Coins className="h-2.5 w-2.5 text-primary" /> {item.earned} $RHOZE earned
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trending" className="mt-0">
          {(!trendingContent || trendingContent.length === 0) ? (
            <EmptyState text="No trending content this week" />
          ) : (
            <div className="space-y-2">
              {trendingContent.map((item, i) => (
                <motion.div
                  key={item.flow_item_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate("/flow")}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                >
                  <span className="font-display font-bold text-muted-foreground text-lg w-6 text-center shrink-0">{i + 1}</span>
                  <Avatar url={item.profile?.avatar_url ?? null} name={item.profile?.display_name ?? null} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.item?.title || "Flow Post"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.interactions} interactions · {item.item?.category}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="mt-0">
          {(!newMembers || newMembers.length === 0) ? (
            <EmptyState text="No new members yet" />
          ) : (
            <div className="space-y-2">
              {newMembers.map((creator, i) => (
                <motion.div
                  key={creator.user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/profiles/${creator.user_id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                >
                  <span className="font-display font-bold text-muted-foreground text-lg w-6 text-center shrink-0">{i + 1}</span>
                  <Avatar url={creator.avatar_url} name={creator.display_name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{creator.display_name || "New Creator"}</p>
                    {creator.skills?.length > 0 && (
                      <p className="text-[10px] text-muted-foreground truncate">{creator.skills.slice(0, 2).join(" · ")}</p>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">New</span>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Leaderboard;

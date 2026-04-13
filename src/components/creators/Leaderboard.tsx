import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Coins, Zap, Flame, Award } from "lucide-react";
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
        .slice(0, 5);
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

  /* Most On-Chain Anchors — contribution proofs with solana_signature */
  const { data: topAnchors } = useQuery({
    queryKey: ["leaderboard-top-anchors"],
    queryFn: async () => {
      const { data: proofs } = await supabase
        .from("contribution_proofs")
        .select("user_id")
        .not("solana_signature", "is", null);
      if (!proofs?.length) return [];
      const map: Record<string, number> = {};
      proofs.forEach((p) => { map[p.user_id] = (map[p.user_id] || 0) + 1; });
      const sorted = Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const ids = sorted.map(([id]) => id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids);
      return sorted.map(([id, count]) => ({
        user_id: id,
        anchors: count,
        profile: profiles?.find((p) => p.user_id === id),
      }));
    },
  });

  /* Rising — newest public profiles */
  const { data: risingCreators } = useQuery({
    queryKey: ["leaderboard-rising"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, skills, created_at")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(5);
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
        <Flame className="h-5 w-5 text-orange-500" /> Leaderboard
      </h2>
      <Tabs defaultValue="earners">
        <TabsList className="w-full grid grid-cols-3 mb-3">
          <TabsTrigger value="earners" className="text-xs gap-1"><Coins className="h-3 w-3" /> Top Earners</TabsTrigger>
          <TabsTrigger value="anchors" className="text-xs gap-1"><Award className="h-3 w-3" /> On-Chain</TabsTrigger>
          <TabsTrigger value="rising" className="text-xs gap-1"><Zap className="h-3 w-3" /> Rising</TabsTrigger>
        </TabsList>

        <TabsContent value="earners" className="mt-0">
          {(!topEarners || topEarners.length === 0) ? (
            <EmptyState text="No $RHOZE earned yet — be the first!" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {topEarners.map((item, i) => (
                <motion.div
                  key={item.user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/profiles/${item.user_id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                >
                  <span className="font-display font-bold text-muted-foreground text-lg w-5 text-center shrink-0">{i + 1}</span>
                  <Avatar url={item.profile?.avatar_url ?? null} name={item.profile?.display_name ?? null} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.profile?.display_name || "Creator"}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Coins className="h-2.5 w-2.5 text-primary" /> {item.earned} $RHOZE
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="anchors" className="mt-0">
          {(!topAnchors || topAnchors.length === 0) ? (
            <EmptyState text="No on-chain anchors yet" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {topAnchors.map((item, i) => (
                <motion.div
                  key={item.user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/profiles/${item.user_id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                >
                  <span className="font-display font-bold text-muted-foreground text-lg w-5 text-center shrink-0">{i + 1}</span>
                  <Avatar url={item.profile?.avatar_url ?? null} name={item.profile?.display_name ?? null} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.profile?.display_name || "Creator"}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Award className="h-2.5 w-2.5 text-primary" /> {item.anchors} anchors
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rising" className="mt-0">
          {(!risingCreators || risingCreators.length === 0) ? (
            <EmptyState text="No rising creators yet" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {risingCreators.map((creator, i) => (
                <motion.div
                  key={creator.user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/profiles/${creator.user_id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                >
                  <span className="font-display font-bold text-muted-foreground text-lg w-5 text-center shrink-0">{i + 1}</span>
                  <Avatar url={creator.avatar_url} name={creator.display_name} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{creator.display_name || "New Creator"}</p>
                    {creator.skills?.length > 0 && (
                      <p className="text-[10px] text-muted-foreground truncate">{creator.skills.slice(0, 2).join(" · ")}</p>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0 ml-auto">New</span>
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

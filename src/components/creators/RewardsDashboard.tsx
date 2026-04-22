import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Coins, Flame, TrendingUp, Zap, Star, MessageSquare, Award, ArrowRight, Download, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useRhozeBalance } from "@/hooks/useRhozeBalance";
import ClaimRhozeButton from "@/components/ClaimRhozeButton";
import RhozeClaimHistory from "@/components/RhozeClaimHistory";
import { Input } from "@/components/ui/input";
import { useWallet } from "@solana/wallet-adapter-react";

const REWARD_ACTIONS = [
  { action: "Post to Flow", reward: "+2 $RHOZE", icon: Flame, description: "Share creative work in your Flow feed" },
  { action: "Receive a Like/Save", reward: "+1 $RHOZE", icon: Star, description: "Earned when someone engages with your post" },
  { action: "Leave a Review", reward: "+3 $RHOZE", icon: MessageSquare, description: "Review a listing you purchased" },
  { action: "Milestone Approved", reward: "+10 $RHOZE", icon: Award, description: "Complete a project milestone for a client" },
  { action: "Post in Drop Room", reward: "+1 $RHOZE", icon: Zap, description: "Contribute ideas in collaborative rooms" },
  { action: "7-Day Streak", reward: "+5 $RHOZE", icon: TrendingUp, description: "Log in 7 days in a row" },
];

const RewardsDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { connected } = useWallet();
  const { data: tokenInfo } = useRhozeBalance();
  const [claimAmount, setClaimAmount] = useState(0);

  const { data: credits } = useQuery({
    queryKey: ["user-credits-rewards", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_credits")
        .select("balance, reward_streak, last_reward_login")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: rewardHistory } = useQuery({
    queryKey: ["reward-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", "reward")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: weeklyTotal } = useQuery({
    queryKey: ["weekly-rewards", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data } = await supabase
        .from("credit_transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("type", "reward")
        .gte("created_at", weekAgo.toISOString());
      return data?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;
    },
    enabled: !!user,
  });

  // Leaderboard: top earners this week
  const { data: leaderboard } = useQuery({
    queryKey: ["reward-leaderboard-weekly"],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data } = await supabase
        .from("credit_transactions")
        .select("user_id, amount")
        .eq("type", "reward")
        .gte("created_at", weekAgo.toISOString());

      if (!data || data.length === 0) return [];

      const totals: Record<string, number> = {};
      data.forEach((t) => {
        totals[t.user_id] = (totals[t.user_id] || 0) + Number(t.amount);
      });

      const sorted = Object.entries(totals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      const userIds = sorted.map(([id]) => id);
      const { data: profiles } = await supabase.rpc("get_profiles_by_ids", {
        _ids: userIds,
      });

      const profileMap: Record<string, any> = {};
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });

      return sorted.map(([id, amount], i) => ({
        rank: i + 1,
        user_id: id,
        amount,
        display_name: profileMap[id]?.display_name || "Creator",
        avatar_url: profileMap[id]?.avatar_url,
      }));
    },
  });

  if (!user) {
    return (
      <div className="card-dashed flex flex-col items-center justify-center py-16">
        <Coins className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-foreground font-body">Sign in to track your rewards</p>
        <button className="btn-editorial mt-4 text-xs" onClick={() => navigate("/auth")}>
          Sign In <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Balance", value: `${credits?.balance ?? 0}`, icon: Coins, accent: true },
          { label: "This Week", value: `+${weeklyTotal ?? 0}`, icon: TrendingUp },
          { label: "Streak", value: `${credits?.reward_streak ?? 0}d`, icon: Flame },
          { label: "Rewards Earned", value: `${rewardHistory?.length ?? 0}`, icon: Award },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-4 rounded-lg border ${stat.accent ? "border-primary/30 bg-primary/5" : "border-border bg-card/60"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-4 w-4 ${stat.accent ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">{stat.label}</span>
            </div>
            <p className={`text-2xl font-display ${stat.accent ? "text-primary" : "text-foreground"}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Claim & Wallet Token Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Claim to wallet */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <span className="text-sm font-body font-semibold text-foreground">Claim to Wallet</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-body">
            Convert your earned credits into real $RHOZE tokens on Solana.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={credits?.balance ?? 0}
              value={claimAmount || ""}
              onChange={(e) => setClaimAmount(Number(e.target.value))}
              placeholder="Amount"
              className="h-9 text-sm w-24"
            />
            <span className="text-xs text-muted-foreground font-body">
              / {credits?.balance ?? 0} available
            </span>
          </div>
          <ClaimRhozeButton
            creditsToClaim={claimAmount}
            onSuccess={() => setClaimAmount(0)}
            className="w-full"
            disabled={claimAmount <= 0 || claimAmount > (credits?.balance ?? 0)}
          />
        </motion.div>

        {/* On-chain token info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-lg border border-border bg-card/60 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-body font-semibold text-foreground">Wallet Token Balance</span>
          </div>
          {connected && tokenInfo ? (
            <>
              <p className="text-2xl font-display text-foreground">
                {tokenInfo.balance.toLocaleString()} <span className="text-sm text-muted-foreground">$RHOZE</span>
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-body font-semibold px-2 py-0.5 rounded-full ${
                  tokenInfo.tier === "play" ? "bg-primary/20 text-primary" :
                  tokenInfo.tier === "glow" ? "bg-yellow-500/20 text-yellow-500" :
                  tokenInfo.tier === "bloom" ? "bg-pink-500/20 text-pink-500" :
                  tokenInfo.tier === "spark" ? "bg-accent/20 text-accent" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {tokenInfo.tier.charAt(0).toUpperCase() + tokenInfo.tier.slice(1)} Holder
                </span>
              </div>
              {tokenInfo.perks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Your Perks</p>
                  {tokenInfo.perks.map((perk) => (
                    <p key={perk} className="text-xs text-foreground font-body flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                      {perk}
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground font-body">
                Connect your Solana wallet to see your on-chain $RHOZE balance and holder tier.
              </p>
            </div>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* How to earn */}
        <div className="space-y-3">
          <h3 className="text-sm font-body font-semibold text-foreground">How to Earn $RHOZE</h3>
          <div className="space-y-2">
            {REWARD_ACTIONS.map((action, i) => (
              <motion.div
                key={action.action}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/40 hover:bg-card/80 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <action.icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-foreground">{action.action}</p>
                  <p className="text-[10px] text-muted-foreground font-body">{action.description}</p>
                </div>
                <span className="text-xs font-body font-semibold text-primary shrink-0">{action.reward}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right column: leaderboard + history */}
        <div className="space-y-6">
          {/* Weekly leaderboard */}
          <div className="space-y-3">
            <h3 className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Weekly Leaderboard
            </h3>
            {leaderboard && leaderboard.length > 0 ? (
              <div className="space-y-1.5">
                {leaderboard.map((entry: any) => (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg text-sm font-body ${
                      entry.user_id === user.id ? "bg-primary/10 border border-primary/20" : "bg-card/40 border border-border"
                    }`}
                  >
                    <span className={`w-6 text-center text-xs font-semibold ${
                      entry.rank <= 3 ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
                    </span>
                    <div className="h-6 w-6 rounded-full bg-muted overflow-hidden shrink-0">
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground font-body">
                          {entry.display_name?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="flex-1 truncate text-foreground">
                      {entry.display_name}
                      {entry.user_id === user.id && <span className="text-muted-foreground ml-1">(you)</span>}
                    </span>
                    <span className="text-xs font-semibold text-primary">{entry.amount} $RHOZE</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card-dashed p-6 text-center">
                <p className="text-xs text-muted-foreground font-body">No rewards earned this week yet. Be the first!</p>
              </div>
            )}
          </div>

          {/* Recent rewards */}
          <div className="space-y-3">
            <h3 className="text-sm font-body font-semibold text-foreground">Recent Rewards</h3>
            {rewardHistory && rewardHistory.length > 0 ? (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {rewardHistory.map((tx: any) => (
                  <div key={tx.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-card/40 border border-border">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Coins className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-body text-foreground truncate">{tx.description}</p>
                      <p className="text-[10px] text-muted-foreground font-body">
                        {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary shrink-0">+{tx.amount}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card-dashed p-6 text-center">
                <p className="text-xs text-muted-foreground font-body">Start posting, reviewing, and collaborating to earn rewards!</p>
              </div>
            )}
          </div>

          {/* On-chain claim history */}
          <RhozeClaimHistory />
        </div>
      </div>
    </div>
  );
};

export default RewardsDashboard;

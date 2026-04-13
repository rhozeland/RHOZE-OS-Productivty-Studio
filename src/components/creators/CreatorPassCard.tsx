import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRhozeBalance } from "@/hooks/useRhozeBalance";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { Flame, Star, Trophy, Crown, Zap, Award, Coins, Shield, TrendingUp, Download } from "lucide-react";
import ClaimRhozeButton from "@/components/ClaimRhozeButton";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const LEVELS = [
  { level: 1, title: "Newcomer", xp: 0, icon: Zap, color: "hsl(210 60% 55%)" },
  { level: 2, title: "Contributor", xp: 20, icon: Star, color: "hsl(175 70% 50%)" },
  { level: 3, title: "Creator", xp: 50, icon: Flame, color: "hsl(40 80% 50%)" },
  { level: 4, title: "Builder", xp: 100, icon: Flame, color: "hsl(30 90% 60%)" },
  { level: 5, title: "Pro", xp: 200, icon: Trophy, color: "hsl(280 60% 60%)" },
  { level: 6, title: "Expert", xp: 350, icon: Trophy, color: "hsl(320 80% 60%)" },
  { level: 7, title: "Master", xp: 500, icon: Crown, color: "hsl(350 60% 55%)" },
  { level: 8, title: "Legend", xp: 750, icon: Crown, color: "hsl(150 55% 45%)" },
  { level: 9, title: "Visionary", xp: 1000, icon: Crown, color: "hsl(280 80% 65%)" },
  { level: 10, title: "Founder", xp: 1500, icon: Crown, color: "hsl(40 80% 50%)" },
];

const TIER_GRADIENTS: Record<string, string> = {
  spark: "linear-gradient(135deg, hsl(205 75% 65%), hsl(220 55% 42%))",
  bloom: "linear-gradient(135deg, hsl(330 65% 72%), hsl(345 55% 48%))",
  glow: "linear-gradient(135deg, hsl(30 90% 60%), hsl(20 80% 42%))",
  play: "linear-gradient(135deg, hsl(50 90% 58%), hsl(38 80% 40%))",
};

/** Token thresholds that unlock tiers without paying monthly */
const TOKEN_TIER_MAP = [
  { tier: "play", min: 50_000_000 },
  { tier: "glow", min: 25_000_000 },
  { tier: "bloom", min: 1_000_000 },
  { tier: "spark", min: 0 },
];

export function getTokenTier(balance: number): string {
  return (TOKEN_TIER_MAP.find((t) => balance >= t.min) ?? TOKEN_TIER_MAP[TOKEN_TIER_MAP.length - 1]).tier;
}

const CreatorPassCard = () => {
  const { user } = useAuth();
  const { connected } = useWallet();
  const { data: tokenInfo } = useRhozeBalance();
  const [claimAmount, setClaimAmount] = useState(0);

  const { data: credits } = useQuery({
    queryKey: ["user-credits-pass", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("balance, reward_streak, tier")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-pass", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: xpData } = useQuery({
    queryKey: ["creator-xp-pass", user?.id],
    queryFn: async () => {
      const [{ count: proofCount }, { count: txCount }] = await Promise.all([
        supabase.from("contribution_proofs").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("credit_transactions").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("type", "reward"),
      ]);
      return { proofCount: proofCount ?? 0, txCount: txCount ?? 0, totalXP: (proofCount ?? 0) + (txCount ?? 0) * 2 };
    },
    enabled: !!user,
  });

  const { data: badgeCount } = useQuery({
    queryKey: ["badge-count-pass", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("contribution_proofs").select("id", { count: "exact", head: true }).eq("user_id", user!.id).not("solana_signature", "is", null);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: weeklyRank } = useQuery({
    queryKey: ["weekly-rank-pass", user?.id],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data } = await supabase
        .from("credit_transactions")
        .select("user_id, amount")
        .eq("type", "reward")
        .gte("created_at", weekAgo.toISOString());
      if (!data?.length) return null;
      const totals: Record<string, number> = {};
      data.forEach((t) => { totals[t.user_id] = (totals[t.user_id] || 0) + Number(t.amount); });
      const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
      const rank = sorted.findIndex(([id]) => id === user!.id);
      return rank >= 0 ? rank + 1 : null;
    },
    enabled: !!user,
  });

  const totalXP = xpData?.totalXP ?? 0;
  const currentLevel = LEVELS.reduce((acc, l) => (totalXP >= l.xp ? l : acc), LEVELS[0]);
  const nextLevel = LEVELS.find((l) => l.xp > totalXP) ?? LEVELS[LEVELS.length - 1];
  const progressPct = nextLevel.xp > currentLevel.xp
    ? Math.min(100, ((totalXP - currentLevel.xp) / (nextLevel.xp - currentLevel.xp)) * 100)
    : 100;

  // Determine effective tier: max of subscription tier and token-holding tier
  const LEGACY_MAP: Record<string, string> = { bronze: "spark", gold: "bloom", diamond: "glow", prism: "play" };
  const subTier = credits?.tier ? (LEGACY_MAP[credits.tier] || credits.tier) : "spark";
  const holdTier = tokenInfo ? getTokenTier(tokenInfo.balance) : "spark";
  const TIER_RANK: Record<string, number> = { spark: 0, bloom: 1, glow: 2, play: 3 };
  const effectiveTier = (TIER_RANK[holdTier] ?? 0) >= (TIER_RANK[subTier] ?? 0) ? holdTier : subTier;
  const gradient = TIER_GRADIENTS[effectiveTier] || TIER_GRADIENTS.spark;

  if (!user) return null;

  const LevelIcon = currentLevel.icon;

  return (
    <div className="space-y-6">
      {/* ── Gym Badge Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden shadow-xl"
        style={{ background: gradient }}
      >
        {/* Texture overlay */}
        <div className="absolute inset-0 opacity-15" style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.5) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        <div className="relative z-10 p-6 text-white">
          {/* Top row: name + tier */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full border-2 border-white/40 overflow-hidden bg-white/10 flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-display font-bold">{profile?.display_name?.[0]?.toUpperCase() || "?"}</span>
                )}
              </div>
              <div>
                <p className="font-display text-lg font-bold drop-shadow-sm">{profile?.display_name || "Creator"}</p>
                <p className="text-xs opacity-80 font-body">Creator Pass</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest opacity-70 font-body">Tier</p>
              <p className="font-display text-xl font-bold capitalize drop-shadow-sm">{effectiveTier}</p>
              {holdTier !== "spark" && (TIER_RANK[holdTier] ?? 0) >= (TIER_RANK[subTier] ?? 0) && holdTier !== subTier && (
                <p className="text-[9px] opacity-60 font-body">via token hold</p>
              )}
            </div>
          </div>

          {/* Stats grid — the "gym badges" */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: "Balance", value: `${credits?.balance ?? 0}`, icon: Coins },
              { label: "Streak", value: `${credits?.reward_streak ?? 0}d`, icon: Flame },
              { label: "Level", value: `${currentLevel.level}`, icon: LevelIcon },
              { label: "XP", value: `${totalXP}`, icon: TrendingUp },
              { label: "Anchored", value: `${badgeCount ?? 0}`, icon: Shield },
              { label: "Rank", value: weeklyRank ? `#${weeklyRank}` : "—", icon: Award },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="h-9 w-9 mx-auto rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center mb-1">
                  <stat.icon className="h-4 w-4" />
                </div>
                <p className="font-display text-sm font-bold">{stat.value}</p>
                <p className="text-[9px] uppercase tracking-wider opacity-60 font-body">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Level progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-[10px] mb-1 opacity-80 font-body">
              <span>Lv.{currentLevel.level} {currentLevel.title}</span>
              <span>{totalXP} / {nextLevel.xp} XP</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-white/70"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Token Balance + Claim ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* On-chain balance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="surface-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-body font-semibold text-foreground">Wallet Token Balance</span>
          </div>
          {connected && tokenInfo ? (
            <>
              <p className="text-2xl font-display text-foreground">
                {tokenInfo.balance.toLocaleString()} <span className="text-sm text-muted-foreground">$RHOZE</span>
              </p>
              {holdTier !== "spark" && (
                <p className="text-xs font-body text-muted-foreground">
                  Holding unlocks <span className="font-semibold capitalize text-primary">{holdTier}</span> tier benefits
                </p>
              )}
              <div className="text-[10px] text-muted-foreground font-body space-y-0.5">
                <p>1M–24M → Bloom • 25M–49M → Glow • 50M+ → Play</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground font-body py-4 text-center">
              Connect your Solana wallet to see your on-chain $RHOZE balance and unlock tier benefits by holding.
            </p>
          )}
        </motion.div>

        {/* Claim to wallet */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="surface-card p-4 space-y-3 border-primary/20">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <span className="text-sm font-body font-semibold text-foreground">Claim to Wallet</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-body">
            Convert earned credits into real $RHOZE tokens on Solana.
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
            <span className="text-xs text-muted-foreground font-body">/ {credits?.balance ?? 0} available</span>
          </div>
          <ClaimRhozeButton
            creditsToClaim={claimAmount}
            onSuccess={() => setClaimAmount(0)}
            className="w-full"
            disabled={claimAmount <= 0 || claimAmount > (credits?.balance ?? 0)}
          />
        </motion.div>
      </div>

      {/* ── Token Tier Unlock Guide ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="surface-card p-5 space-y-3">
        <h3 className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          Unlock Tiers by Holding $RHOZE
        </h3>
        <p className="text-xs text-muted-foreground font-body">
          Hold tokens in your wallet to unlock the same benefits as a monthly subscription — no payment required.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { tier: "Spark", hold: "0", benefits: ["3 Boards", "1 hr Drop Rooms"], active: effectiveTier === "spark", gradient: "linear-gradient(135deg, hsl(205 75% 65%), hsl(220 55% 42%))", glowColor: "hsl(210, 70%, 55%)" },
            { tier: "Bloom", hold: "1M–24M", benefits: ["15 Boards", "4 hr Rooms", "5% studio discount"], active: effectiveTier === "bloom", gradient: "linear-gradient(135deg, hsl(330 65% 72%), hsl(345 55% 48%))", glowColor: "hsl(335, 60%, 65%)" },
            { tier: "Glow", hold: "25M–49M", benefits: ["50 Boards", "12 hr Rooms", "10% discount", "Priority booking"], active: effectiveTier === "glow", gradient: "linear-gradient(135deg, hsl(30 90% 60%), hsl(20 80% 42%))", glowColor: "hsl(28, 85%, 55%)" },
            { tier: "Play", hold: "50M+", benefits: ["∞ Boards", "∞ Rooms", "15% discount", "Priority + all perks"], active: effectiveTier === "play", gradient: "linear-gradient(135deg, hsl(50 90% 58%), hsl(38 80% 40%))", glowColor: "hsl(45, 85%, 52%)" },
          ].map((t) => (
            <motion.div
              key={t.tier}
              whileHover={{ y: -4, scale: 1.02 }}
              className={`rounded-2xl overflow-hidden border transition-all ${t.active ? "border-2 border-white/50 shadow-xl" : "border border-border shadow-md hover:shadow-lg"}`}
              style={{ boxShadow: t.active ? `0 8px 30px -6px ${t.glowColor}50` : undefined }}
            >
              {/* Colored header */}
              <div
                className="px-3 py-3 text-white relative overflow-hidden"
                style={{ background: t.gradient }}
              >
                <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 60%)" }} />
                <div className="relative z-10 flex items-center justify-between">
                  <span className="text-sm font-display font-bold drop-shadow-sm">{t.tier}</span>
                  {t.active && <span className="text-[9px] bg-white/25 backdrop-blur-sm px-1.5 py-0.5 rounded-full font-bold">ACTIVE</span>}
                </div>
                <p className="text-[10px] opacity-80 font-body mt-0.5 relative z-10">Hold {t.hold}+</p>
              </div>
              {/* Benefits body */}
              <div className="p-3 bg-card space-y-1">
                {t.benefits.map((b) => (
                  <p key={b} className="text-[10px] text-muted-foreground font-body flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full shrink-0" style={{ background: t.glowColor }} />
                    {b}
                  </p>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default CreatorPassCard;

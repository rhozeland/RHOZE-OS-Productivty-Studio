import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Flame, Coins, Shield, Download, BadgeCheck, Ticket,
  FolderKanban, MessageSquare, Calendar,
} from "lucide-react";
import ClaimRhozeButton from "@/components/ClaimRhozeButton";
import { Input } from "@/components/ui/input";
import Tilt3D from "@/components/ui/Tilt3D";
import { useState } from "react";
import { format } from "date-fns";

// Levels/XP removed in v8.7 — Creator Pass surfaces $RHOZE hold + collectible
// stats only. Level + XP previously double-displayed alongside the tier.


import {
  TIERS,
  TIER_RANK,
  getHoldTier,
  getEffectiveTier,
  type TierId,
} from "@/lib/tier-matrix";


const TIER_GRADIENTS: Record<string, string> = Object.fromEntries(
  TIERS.map((t) => [t.id, t.gradient]),
);

/** Back-compat: existing imports rely on this name. */
export function getTokenTier(balance: number): string {
  return getHoldTier(balance);
}

const CreatorPassCard = () => {
  const { user } = useAuth();
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
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, verification_status")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Verified Works (anchored creative IP) — replaces the old "Anchored" generic count.
  const { data: verifiedWorks } = useQuery({
    queryKey: ["verified-works-pass", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("contribution_proofs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .not("solana_signature", "is", null);
      return count ?? 0;
    },
    enabled: !!user,
  });

  // Events attended — count of issued/checked-in tickets the user holds.
  const { data: ticketsData } = useQuery({
    queryKey: ["pass-tickets", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_tickets")
        .select("id, status, created_at, event_id, event:events(id,title,starts_at,cover_url,category)")
        .eq("holder_id", user!.id)
        .in("status", ["issued", "checked_in"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const eventsAttended = (ticketsData ?? []).filter((t: any) => t.status === "checked_in").length;

  // ─── Personal "Studio activity" metrics — relocated here from the
  // retired My Studio dashboard. Surfaces the live counts for a creator's
  // private workspace without needing a separate page.
  const { data: studioStats } = useQuery({
    queryKey: ["studio-stats-pass", user?.id],
    queryFn: async () => {
      const sb = supabase as any;
      const [activeProj, unread, upcoming] = await Promise.all([
        sb.from("projects")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .neq("status", "completed"),
        sb.from("messages")
          .select("id", { count: "exact", head: true })
          .eq("receiver_id", user!.id)
          .eq("read", false),
        sb.from("events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .gte("starts_at", new Date().toISOString()),
      ]);
      return {
        activeProjects: (activeProj?.count as number) ?? 0,
        unread: (unread?.count as number) ?? 0,
        upcoming: (upcoming?.count as number) ?? 0,
      };
    },
    enabled: !!user,
  });

  // Effective tier = max($RHOZE hold, legacy subscription mapping)
  // v8.3: activity-based qualification removed — tier eligibility = $RHOZE hold only.
  const LEGACY_MAP: Record<string, TierId> = { bronze: "spark", gold: "bloom", diamond: "glow", prism: "play" };
  const subTier: TierId = credits?.tier ? ((LEGACY_MAP[credits.tier] || credits.tier) as TierId) : "spark";
  const holdTier: TierId = getHoldTier(Number(credits?.balance ?? 0)) as TierId;
  const effectiveTier = getEffectiveTier(subTier, holdTier);
  const gradient = TIER_GRADIENTS[effectiveTier] || TIER_GRADIENTS.spark;

  const isVerifiedArtist = profile?.verification_status === "verified";

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* ── Holographic Pass Card (3D tilt + shine) ── */}
      <Tilt3D maxTilt={10} className="rounded-2xl">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative tier-shimmer rounded-2xl overflow-hidden shadow-xl"
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
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-display text-lg font-bold drop-shadow-sm truncate">{profile?.display_name || "Creator"}</p>
                  {isVerifiedArtist && (
                    <span
                      title="Verified Artist · identity confirmed by Rhozeland"
                      className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white/25 backdrop-blur-sm shrink-0"
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-80 font-body">
                  {isVerifiedArtist ? "Verified Artist · Creator Pass" : "Creator Pass"}
                </p>
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

          {/* Stats — 4 collectible metrics (with milestone hints when zero) */}
          <div className="grid grid-cols-4 gap-3">
            {([
              {
                label: "Balance",
                value: `${credits?.balance ?? 0}`,
                icon: Coins,
                isZero: Number(credits?.balance ?? 0) === 0,
                hint: null,
              },
              {
                label: "Streak",
                value: `${credits?.reward_streak ?? 0}d`,
                icon: Flame,
                isZero: Number(credits?.reward_streak ?? 0) === 0,
                hint: { text: "Sign in daily to start", to: null as string | null },
              },
              {
                label: "Events",
                value: `${eventsAttended}`,
                icon: Ticket,
                isZero: eventsAttended === 0,
                hint: { text: "Attend 1 event →", to: "/events" },
              },
              {
                label: "Verified Works",
                value: `${verifiedWorks ?? 0}`,
                icon: Shield,
                isZero: (verifiedWorks ?? 0) === 0,
                hint: { text: "Submit a work →", to: "/discover" },
              },
            ] as const).map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="h-9 w-9 mx-auto rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center mb-1">
                  <stat.icon className="h-4 w-4" />
                </div>
                {stat.isZero && stat.hint ? (
                  stat.hint.to ? (
                    <Link
                      to={stat.hint.to}
                      className="block font-display text-[10px] font-semibold leading-tight underline-offset-2 hover:underline"
                    >
                      {stat.hint.text}
                    </Link>
                  ) : (
                    <p className="font-display text-[10px] font-semibold leading-tight opacity-90">
                      {stat.hint.text}
                    </p>
                  )
                ) : (
                  <p className="font-display text-sm font-bold tabular-nums">{stat.value}</p>
                )}
                <p className="text-[9px] uppercase tracking-wider opacity-60 font-body mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      </Tilt3D>

      {/* ── Ticket Collection — collectible row of attended/upcoming tickets ── */}
      {(ticketsData?.length ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="surface-card p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            <p className="font-body font-semibold text-sm">Ticket Collection</p>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {ticketsData!.length} {ticketsData!.length === 1 ? "stub" : "stubs"}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            {ticketsData!.slice(0, 12).map((t: any) => {
              const ev = t.event;
              const checked = t.status === "checked_in";
              return (
                <Link
                  key={t.id}
                  to={`/tickets/${t.id}`}
                  className="snap-start shrink-0 w-36 group"
                >
                  <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-muted border border-border group-hover:border-foreground/30 transition-colors">
                    {ev?.cover_url ? (
                      <img src={ev.cover_url} alt={ev.title} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/10" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute top-2 left-2">
                      <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-medium ${
                        checked
                          ? "bg-emerald-500/90 text-white"
                          : "bg-white/85 text-foreground"
                      }`}>
                        {checked ? "Attended" : "RSVP"}
                      </span>
                    </div>
                    <div className="absolute inset-x-2 bottom-2 text-white">
                      <p className="text-[11px] font-semibold leading-tight line-clamp-2">{ev?.title ?? "Event"}</p>
                      {ev?.starts_at && (
                        <p className="text-[9px] opacity-80 mt-0.5">
                          {format(new Date(ev.starts_at), "MMM d")}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}


      {/* ── Studio activity (relocated from My Studio) ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-[1px] bg-border rounded-2xl overflow-hidden"
      >
        {[
          { icon: FolderKanban, label: "Active Projects", value: studioStats?.activeProjects ?? 0, path: "/projects" },
          { icon: MessageSquare, label: "Unread", value: studioStats?.unread ?? 0, path: "/messages" },
          { icon: Calendar, label: "Upcoming", value: studioStats?.upcoming ?? 0, path: "/calendar" },
        ].map((s) => (
          <Link key={s.label} to={s.path} className="bg-card p-4 hover:bg-muted/50 transition-colors group">
            <s.icon className="h-4 w-4 text-muted-foreground mb-2 group-hover:text-foreground transition-colors" />
            <p className="font-display text-2xl text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-body">{s.label}</p>
          </Link>
        ))}
      </motion.div>

      {/* ── In-app $RHOZE Balance + Claim ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* In-app balance — bank-statement style, drives tier eligibility */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="surface-card p-5 flex flex-col items-center text-center"
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-body font-medium">
              $RHOZE Balance
            </span>
          </div>
          <p className="font-display text-4xl md:text-5xl font-bold text-foreground tabular-nums leading-none mt-3">
            {Number(credits?.balance ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground font-body uppercase tracking-widest mt-1.5">
            $RHOZE
          </p>

          {/* Tier ladder pills */}
          <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
            {TIERS.map((t) => {
              const isActive = t.id === holdTier;
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${
                    isActive
                      ? "border-foreground/30 bg-foreground/5"
                      : "border-border/40 opacity-60"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: t.gradient }}
                    aria-hidden
                  />
                  <span className="text-[10px] font-body font-medium text-foreground">
                    {t.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground tabular-nums">
                    {t.holdLabel}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground font-body mt-3 max-w-xs">
            {holdTier !== "spark" ? (
              <>
                You're holding <span className="font-semibold capitalize text-foreground">{holdTier}</span> tier benefits.
              </>
            ) : (
              <>Hold $RHOZE to unlock tier perks — no wallet needed.</>
            )}
          </p>
        </motion.div>

        {/* Claim to wallet */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="surface-card p-4 space-y-3 border-primary/20">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <span className="text-sm font-body font-semibold text-foreground">Claim to Wallet</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-body">
            Convert earned credits into real $RHOZE tokens in your wallet.
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

    </div>
  );
};

export default CreatorPassCard;

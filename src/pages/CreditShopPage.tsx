import { useState, useEffect, useRef } from "react";

/** Animated counter that counts from 0 to `end` */
const CountUp = ({ end, delay = 0 }: { end: number; delay?: number }) => {
  const [value, setValue] = useState(0);
  const ref = useRef(false);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (ref.current) return;
      ref.current = true;
      const duration = 1200;
      const steps = 30;
      const increment = end / steps;
      let current = 0;
      const interval = setInterval(() => {
        current += increment;
        if (current >= end) {
          setValue(end);
          clearInterval(interval);
        } else {
          setValue(Math.round(current));
        }
      }, duration / steps);
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [end, delay]);
  return <>{value}</>;
};
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Coins,
  Sparkles,
  Flower2,
  Sun,
  Gamepad,
  Check,
  CreditCard,
  Wallet,
  ShoppingBag,
  Download,
  Music,
  Info,
  CircleDollarSign,
  BadgeCheck,
  ArrowRightLeft,
  Zap,
  Shield,
  TrendingUp,
  RefreshCw,
  Award,
  Link2,
  Palette,
  Camera,
  Video,
  PenTool,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import PaySolAndVerify from "@/components/PaySolAndVerify";
import PayWithRhozeButton from "@/components/PayWithRhozeButton";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";
import CreatorPassCard from "@/components/creators/CreatorPassCard";
import GuestCreditsPreview from "@/components/guest/GuestCreditsPreview";

const CAT_ICONS: Record<string, any> = {
  music: Music, design: Palette, photo: Camera, video: Video, writing: PenTool,
};

const RHOZE_CA = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const PUMP_FUN_URL = `https://pump.fun/coin/${RHOZE_CA}`;

const TIERS = [
  {
    key: "spark",
    name: "Spark",
    price: 0,
    gradient: "linear-gradient(135deg, hsl(205, 75%, 65%), hsl(210, 65%, 52%), hsl(220, 55%, 42%))",
    glowColor: "hsl(210, 70%, 55%)",
    icon: Sparkles,
    isFree: true,
    bestFor: "Exploring the platform, getting started",
    features: [
      "3 Boards",
      "Drop Rooms — 1 hr max",
      "Browse studios & creators",
      "Basic profile",
    ],
    limits: { smartboards: 3, dropRoomHours: 1, studioDiscount: 0 },
  },
  {
    key: "bloom",
    name: "Bloom",
    price: 10,
    gradient: "linear-gradient(135deg, hsl(330, 65%, 72%), hsl(340, 60%, 58%), hsl(345, 55%, 48%))",
    glowColor: "hsl(335, 60%, 65%)",
    icon: Flower2,
    bestFor: "New creators, freelancers, side-hustlers",
    features: [
      "15 Boards",
      "Drop Rooms — 4 hr max",
      "5% off studio bookings",
      "Marketplace access",
    ],
    limits: { smartboards: 15, dropRoomHours: 4, studioDiscount: 5 },
  },
  {
    key: "glow",
    name: "Glow",
    price: 20,
    gradient: "linear-gradient(135deg, hsl(30, 90%, 60%), hsl(25, 85%, 50%), hsl(20, 80%, 42%))",
    glowColor: "hsl(28, 85%, 55%)",
    icon: Sun,
    bestFor: "Semi-pros, scaling creators",
    features: [
      "50 Boards",
      "Drop Rooms — 12 hr max",
      "10% off studio bookings",
      "Priority booking",
      "Marketplace access",
    ],
    limits: { smartboards: 50, dropRoomHours: 12, studioDiscount: 10 },
  },
  {
    key: "play",
    name: "Play",
    price: 30,
    gradient: "linear-gradient(135deg, hsl(50, 90%, 58%), hsl(43, 85%, 48%), hsl(38, 80%, 40%))",
    glowColor: "hsl(45, 85%, 52%)",
    icon: Gamepad,
    bestFor: "Full-time creators, funded artists",
    features: [
      "Unlimited Boards",
      "Unlimited Drop Rooms",
      "15% off studio bookings",
      "Priority booking",
      "Marketplace access",
    ],
    limits: { smartboards: -1, dropRoomHours: -1, studioDiscount: 15 },
  },
];

const CreditShopPage = () => {
  const { user } = useAuth();

  if (!user) {
    return <GuestCreditsPreview />;
  }

  return <AuthenticatedCreditShopPage user={user} />;
};

const AuthenticatedCreditShopPage = ({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subPaymentOpen, setSubPaymentOpen] = useState(false);
  const [subPaymentMethod, setSubPaymentMethod] = useState<"card" | "crypto">("card");
  const [pendingTier, setPendingTier] = useState<(typeof TIERS)[number] | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [purchaseSubTab, setPurchaseSubTab] = useState<"history" | "buy">("history");

  const activeTab = searchParams.get("tab") || "pass";

  const { data: userCredits } = useQuery({
    queryKey: ["user-credits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const subscribeTier = useMutation({
    mutationFn: async (tier: (typeof TIERS)[number]) => {
      const now = new Date();
      const endDate = new Date(now);
      if (billingCycle === "annual") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const { error } = await supabase.rpc("update_user_subscription", {
        _user_id: user!.id,
        _tier: tier.key,
        _tier_credits_monthly: 0,
        _subscription_start: now.toISOString().split("T")[0],
        _subscription_end: endDate.toISOString().split("T")[0],
        _description: `${tier.name} subscription — ${billingCycle}`,
        _payment_method: subPaymentMethod,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      toast.success("Subscription activated!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const LEGACY_TIER_MAP: Record<string, string> = { bronze: "spark", gold: "bloom", diamond: "glow", prism: "play" };
  const rawTier = userCredits?.tier && userCredits.tier !== "none" ? userCredits.tier : "spark";
  const currentTier = LEGACY_TIER_MAP[rawTier] || rawTier;

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ["my-purchases", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchases" as any).select("*").eq("buyer_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const purchaseListingIds = purchases?.map((p: any) => p.listing_id) ?? [];
  const { data: purchaseListings } = useQuery({
    queryKey: ["purchased-listings", purchaseListingIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketplace_listings").select("*").in("id", purchaseListingIds);
      if (error) throw error;
      return data;
    },
    enabled: purchaseListingIds.length > 0,
  });

  const { data: purchaseMedia } = useQuery({
    queryKey: ["purchased-media", purchaseListingIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("listing_media").select("*").in("listing_id", purchaseListingIds).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: purchaseListingIds.length > 0,
  });

  const purchaseListingsMap = new Map(purchaseListings?.map((l) => [l.id, l]) ?? []);
  const purchaseMediaMap = new Map<string, any[]>();
  purchaseMedia?.forEach((m) => {
    if (!purchaseMediaMap.has(m.listing_id)) purchaseMediaMap.set(m.listing_id, []);
    purchaseMediaMap.get(m.listing_id)!.push(m);
  });

  const setTab = (v: string) => {
    if (v === "pass") searchParams.delete("tab"); else searchParams.set("tab", v);
    setSearchParams(searchParams, { replace: true });
  };

  const getPrice = (tier: typeof TIERS[number]) => {
    if (tier.isFree) return 0;
    return billingCycle === "annual" ? tier.price * 10 : tier.price; // 2 months free on annual
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Creator Pass</h1>
            <p className="text-muted-foreground">Your creative membership — unlock more boards, longer rooms, and studio discounts</p>
          </div>
          <div className="surface-card flex items-center gap-3 px-5 py-3">
            <Coins className="h-5 w-5 text-primary" />
            <div>
              <p className="font-display text-lg font-bold text-foreground capitalize">{currentTier}</p>
              <p className="text-xs text-muted-foreground">Current Plan</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pass" className="gap-1.5"><Award className="h-3.5 w-3.5" /> My Pass</TabsTrigger>
          <TabsTrigger value="shop" className="gap-1.5"><Coins className="h-3.5 w-3.5" /> Plans</TabsTrigger>
          <TabsTrigger value="how" className="gap-1.5"><Info className="h-3.5 w-3.5" /> How It Works</TabsTrigger>
          <TabsTrigger value="works" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Verified IP</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5"><ShoppingBag className="h-3.5 w-3.5" /> Purchases</TabsTrigger>
        </TabsList>

        {/* ═══════ My Pass Tab (Primary) ═══════ */}
        <TabsContent value="pass" className="mt-4">
          <CreatorPassCard />
        </TabsContent>

        {/* ═══════ Plans Tab ═══════ */}
        <TabsContent value="shop" className="space-y-6 mt-4">
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${billingCycle === "annual" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              Annual <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Save 2 months</Badge>
            </button>
          </div>

          {/* Tiers */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier, i) => {
              const TierIcon = tier.icon;
              const isCurrentTier = currentTier === tier.key;
              const isBestValue = tier.key === "glow";
              const displayPrice = getPrice(tier);
              return (
                <motion.div
                  key={tier.key}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, type: "spring", stiffness: 180 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className={`relative rounded-2xl overflow-hidden transition-all ${
                    isCurrentTier ? "border-2 border-primary shadow-xl"
                      : isBestValue ? "border-2 border-primary/50 shadow-lg"
                      : "border border-border hover:shadow-xl"
                  }`}
                  style={{
                    boxShadow: isCurrentTier
                      ? `0 12px 40px -8px ${tier.glowColor}50`
                      : isBestValue ? `0 8px 30px -6px ${tier.glowColor}30` : undefined,
                  }}
                >
                  {isBestValue && !isCurrentTier && (
                    <div className="absolute top-3 right-3 z-20 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">Best Value</div>
                  )}

                  <div
                    className="px-5 py-6 text-center text-white relative overflow-hidden animated-gradient"
                    style={{ background: tier.gradient, backgroundSize: "200% 200%" }}
                  >
                    <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 60%)" }} />
                    <p className="text-xs font-semibold tracking-widest uppercase opacity-90 relative z-10">{tier.name}</p>
                    <div className="flex items-center justify-center gap-2 mt-2 relative z-10">
                      <TierIcon className="h-6 w-6 drop-shadow-sm" />
                      <span className="font-display text-4xl font-bold drop-shadow-sm">
                        {tier.isFree ? "Free" : `$${displayPrice}`}
                      </span>
                    </div>
                    <p className="text-sm opacity-80 mt-1 relative z-10">
                      {tier.isFree ? "forever" : billingCycle === "annual" ? "/ year" : "/ month"}
                    </p>
                  </div>

                  <div className="p-4 bg-card space-y-3">
                    <p className="text-xs text-muted-foreground font-medium leading-snug">{tier.bestFor}</p>
                    <ul className="space-y-1.5">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-foreground leading-snug">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 shrink-0 mt-0.5">
                            <Check className="h-2.5 w-2.5 text-primary" />
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrentTier ? (
                      <Button className="w-full h-9 font-semibold text-xs" variant="outline" disabled>Current Plan</Button>
                    ) : tier.isFree ? (
                      <Button className="w-full h-9 font-semibold text-xs" variant="secondary" disabled>Included</Button>
                    ) : (
                      <Button
                        className="w-full h-9 font-semibold text-xs gap-1"
                        onClick={() => { setPendingTier(tier); setSubPaymentMethod("card"); setSubPaymentOpen(true); }}
                      >
                        Subscribe — ${displayPrice}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          
        </TabsContent>




        {/* ═══════ How It Works Tab ═══════ */}
        <TabsContent value="how" className="mt-4 space-y-10">
          {/* ── Section 1 · Intro ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-xl mx-auto space-y-2"
          >
            <span className="text-[11px] font-bold tracking-[0.2em] text-muted-foreground uppercase">The system</span>
            <h2 className="font-display text-3xl font-bold text-foreground leading-tight">How Rhozeland Works</h2>
            <p className="text-muted-foreground text-sm">
              Create. Earn. Build a verified record. Share the revenue.
            </p>
          </motion.div>

          {/* ── Section 2 · The four-step journey ── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold tracking-[0.2em] text-muted-foreground uppercase">01 · Journey</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Zap, step: "01", title: "Create", desc: "Post to Flow, complete milestones, review work — earn $RHOZE automatically.", color: "hsl(210, 70%, 55%)" },
                { icon: Shield, step: "02", title: "Verify", desc: "Every reward becomes a tamper-proof entry in your Earning History.", color: "hsl(335, 60%, 60%)" },
                { icon: TrendingUp, step: "03", title: "Unlock", desc: "Spend $RHOZE on studios, marketplace, and higher Pass tiers.", color: "hsl(28, 80%, 55%)" },
                { icon: RefreshCw, step: "04", title: "Reinvest", desc: "10% of every sale flows back to creators and the ecosystem.", color: "hsl(45, 80%, 50%)" },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl border border-border bg-card p-5 space-y-3 relative overflow-hidden group hover:shadow-lg transition-shadow"
                >
                  <div
                    className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{ background: s.color }}
                  />
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: `${s.color}20` }}
                    >
                      <s.icon className="h-5 w-5" style={{ color: s.color }} />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground tracking-[0.2em]">STEP {s.step}</span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Section 3 · Revenue Split (hero visual) ── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold tracking-[0.2em] text-muted-foreground uppercase">02 · The split</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card p-6 space-y-5"
            >
              <div className="text-center max-w-md mx-auto space-y-1">
                <h3 className="font-display text-xl font-semibold text-foreground">Every sale, split three ways</h3>
                <p className="text-xs text-muted-foreground">Automatic on-chain distribution — no middlemen.</p>
              </div>

              {/* Stacked bar */}
              <div className="flex h-6 w-full overflow-hidden rounded-full">
                <div className="h-full bg-[hsl(150,55%,45%)]" style={{ width: "75%" }} />
                <div className="h-full bg-[hsl(210,60%,55%)]" style={{ width: "15%" }} />
                <div className="h-full bg-[hsl(40,80%,50%)]" style={{ width: "10%" }} />
              </div>

              {/* Legend — vertical stack avoids clipping */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { pct: "75%", label: "Creator", color: "hsl(150,55%,45%)" },
                  { pct: "15%", label: "Curator", color: "hsl(210,60%,55%)" },
                  { pct: "10%", label: "Buyback", color: "hsl(40,80%,50%)" },
                ].map((row) => (
                  <div key={row.label} className="rounded-xl border border-border/60 bg-muted/30 p-3 text-center space-y-0.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                      <span className="font-display text-lg font-bold text-foreground">{row.pct}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{row.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* ── Section 4 · Three pillars ── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold tracking-[0.2em] text-muted-foreground uppercase">03 · Pillars</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  icon: CircleDollarSign,
                  title: "$RHOZE Economy",
                  color: "hsl(45, 80%, 50%)",
                  points: [
                    "SPL token on Solana",
                    "Earned from posts, reviews & milestones",
                    "Spent on studios, talent & marketplace",
                    "Tiers: Spark → Bloom → Glow → Play",
                  ],
                },
                {
                  icon: BadgeCheck,
                  title: "Reputation",
                  color: "hsl(210, 70%, 55%)",
                  points: [
                    "Every reward = verified Earning entry",
                    "Independently auditable on-chain",
                    "Portable creator identity",
                    "Builds trust with collaborators",
                  ],
                },
                {
                  icon: ArrowRightLeft,
                  title: "Revenue Sharing",
                  color: "hsl(150, 55%, 45%)",
                  points: [
                    "Auto 3-way split on every sale",
                    "Creators take the majority",
                    "Curators earn for referrals",
                    "10% buyback strengthens $RHOZE",
                  ],
                },
              ].map((pillar, i) => (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl border border-border bg-card p-5 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: `${pillar.color}20` }}
                    >
                      <pillar.icon className="h-5 w-5" style={{ color: pillar.color }} />
                    </div>
                    <h3 className="font-display font-semibold text-foreground">{pillar.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {pillar.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
                          <Check className="h-2.5 w-2.5 text-primary" />
                        </span>
                        <span className="min-w-0">{pt}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Section 5 · The flywheel ── */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold tracking-[0.2em] text-muted-foreground uppercase">04 · Flywheel</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-muted/30 p-6 space-y-6 max-w-2xl mx-auto"
            >
              <div className="text-center space-y-1">
                <Award className="h-7 w-7 text-primary mx-auto" />
                <h3 className="font-display text-lg font-semibold text-foreground">Every action feeds the next</h3>
              </div>

              {/* Circular flywheel */}
              <div className="relative mx-auto" style={{ width: 280, height: 280 }}>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-20 w-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <RefreshCw className="h-7 w-7 text-primary" />
                  </div>
                </div>
                {[
                  { icon: Sparkles, label: "Create", angle: 0, color: "hsl(150,55%,45%)" },
                  { icon: Coins, label: "Earn", angle: 72, color: "hsl(40,80%,50%)" },
                  { icon: TrendingUp, label: "Grow", angle: 144, color: "hsl(210,60%,55%)" },
                  { icon: Shield, label: "Reputation", angle: 216, color: "hsl(280,60%,60%)" },
                  { icon: ArrowRightLeft, label: "Reinvest", angle: 288, color: "hsl(350,60%,55%)" },
                ].map((node, i) => {
                  const rad = (node.angle - 90) * (Math.PI / 180);
                  const r = 115;
                  const x = 140 + r * Math.cos(rad) - 28;
                  const y = 140 + r * Math.sin(rad) - 28;
                  return (
                    <motion.div
                      key={node.label}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.1, type: "spring", stiffness: 200 }}
                      className="absolute flex flex-col items-center gap-1"
                      style={{ left: x, top: y, width: 56 }}
                    >
                      <div
                        className="h-11 w-11 rounded-full flex items-center justify-center shadow-md"
                        style={{ backgroundColor: node.color + "22", border: `2px solid ${node.color}` }}
                      >
                        <node.icon className="h-5 w-5" style={{ color: node.color }} />
                      </div>
                      <span className="text-[10px] font-semibold text-foreground whitespace-nowrap">{node.label}</span>
                    </motion.div>
                  );
                })}
                <svg className="absolute inset-0" viewBox="0 0 280 280" fill="none">
                  {[0, 72, 144, 216, 288].map((angle, i) => {
                    const rad1 = (angle - 90) * (Math.PI / 180);
                    const rad2 = ((angle + 72) - 90) * (Math.PI / 180);
                    const r = 90;
                    const x1 = 140 + r * Math.cos(rad1);
                    const y1 = 140 + r * Math.sin(rad1);
                    const x2 = 140 + r * Math.cos(rad2);
                    const y2 = 140 + r * Math.sin(rad2);
                    const midAngle = (angle + 36 - 90) * (Math.PI / 180);
                    const cx = 140 + (r + 20) * Math.cos(midAngle);
                    const cy = 140 + (r + 20) * Math.sin(midAngle);
                    return (
                      <motion.path
                        key={i}
                        d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                        stroke="hsl(var(--primary))"
                        strokeWidth="1.5"
                        strokeOpacity="0.25"
                        strokeDasharray="4 3"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
                      />
                    );
                  })}
                </svg>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" />
                <a
                  href={PUMP_FUN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  View $RHOZE on Pump Fun
                </a>
              </div>
            </motion.div>
          </section>
        </TabsContent>

        {/* ═══════ Verified IP — Works explainer + recent anchors ═══════ */}
        <TabsContent value="works" className="mt-4 space-y-6">
          <VerifiedIPSection userId={user?.id ?? null} />
        </TabsContent>

        <TabsContent value="purchases" className="mt-4 space-y-6">
          {/* Sub-tab toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
            <button
              onClick={() => setPurchaseSubTab("history")}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${purchaseSubTab === "history" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ShoppingBag className="inline h-3.5 w-3.5 mr-1.5" />Purchase History
            </button>
            <button
              onClick={() => setPurchaseSubTab("buy")}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${purchaseSubTab === "buy" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Wallet className="inline h-3.5 w-3.5 mr-1.5" />Buy $RHOZE
            </button>
          </div>

          {purchaseSubTab === "history" ? (
            <>
              {/* Purchases */}
              {purchasesLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : !purchases?.length ? (
                <div className="text-center py-12 space-y-4">
                  <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <p className="text-muted-foreground">No purchases yet</p>
                  <Link to="/creators">
                    <Button variant="outline" className="rounded-full">Browse Creators Hub</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="font-display text-lg font-semibold text-foreground">Purchases</h2>
                  {purchases.map((purchase: any) => {
                    const listing = purchaseListingsMap.get(purchase.listing_id);
                    const media = purchaseMediaMap.get(purchase.listing_id) ?? [];
                    const CatIcon = CAT_ICONS[listing?.category] ?? Sparkles;
                    return (
                      <div key={purchase.id} className="surface-card p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <CatIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <Link to={`/creators/${purchase.listing_id}`} className="font-semibold text-foreground hover:text-primary transition-colors truncate block">
                                {listing?.title ?? "Listing"}
                              </Link>
                              <p className="text-xs text-muted-foreground">{format(new Date(purchase.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="gap-1 flex-shrink-0"><Coins className="h-3 w-3" />{purchase.credits_paid}</Badge>
                        </div>
                        {media.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {media.map((m: any) => (
                              <a key={m.id} href={m.file_url} download={m.file_name} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs text-primary hover:bg-muted/80 transition-colors">
                                <Download className="h-3 w-3" />{m.file_name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <TransactionHistory userId={user?.id} />
            </>
          ) : (
            /* Buy $RHOZE sub-tab */
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <h2 className="font-display text-2xl font-bold text-foreground">$RHOZE Token</h2>
                    <p className="text-muted-foreground">
                      $RHOZE is the native utility token for Rhozeland. Use it to pay for studio bookings at a discount,
                      trade on the marketplace, and support creators directly.
                    </p>
                    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contract Address</p>
                      <code className="text-xs text-foreground bg-muted px-2 py-1 rounded font-mono break-all block">{RHOZE_CA}</code>
                      <p className="text-xs text-muted-foreground">Solana · SPL Token</p>
                    </div>
                    <a href={PUMP_FUN_URL} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full h-12 text-base rounded-full gap-2">
                        <ExternalLink className="h-4 w-4" /> Buy on Pump Fun
                      </Button>
                    </a>
                  </motion.div>
                </div>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <h3 className="font-display font-semibold text-foreground">Swap Widget</h3>
                    <p className="text-xs text-muted-foreground">Swap SOL → $RHOZE directly — powered by Jupiter</p>
                  </div>
                  <iframe
                    src={`https://jup.ag/swap/SOL-${RHOZE_CA}?embedded=true`}
                    className="w-full h-[500px] border-0"
                    title="Buy $RHOZE"
                    allow="clipboard-write; clipboard-read"
                  />
                </motion.div>
              </div>
              <div className="surface-card p-6">
                <h3 className="font-display text-lg font-semibold text-foreground mb-4">How it works</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { step: "1", title: "Connect Wallet", desc: "Connect your Phantom or Solflare wallet to get started." },
                    { step: "2", title: "Swap SOL → $RHOZE", desc: "Use Pump Fun or any Solana DEX to swap SOL for $RHOZE tokens." },
                    { step: "3", title: "Pay with Crypto", desc: "Use SOL or $RHOZE to pay for studio bookings and marketplace items at a discount." },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">{item.step}</div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Subscription Payment Modal */}
      <Dialog open={subPaymentOpen} onOpenChange={setSubPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Subscribe to {pendingTier?.name}</DialogTitle>
          </DialogHeader>
          {pendingTier && (
            <>
              <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{pendingTier.name} Plan</span>
                  <span className="text-lg font-bold text-primary">${getPrice(pendingTier)}{billingCycle === "annual" ? "/yr" : "/mo"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Billed {billingCycle}
                  {billingCycle === "annual" && " • 2 months free"}
                </p>
              </div>

              {/* Payment method toggle */}
              <div className="flex rounded-lg bg-muted p-1 gap-1">
                <button
                  onClick={() => setSubPaymentMethod("card")}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-all ${subPaymentMethod === "card" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                >
                  <CreditCard className="inline h-3.5 w-3.5 mr-1" /> Card
                </button>
                <button
                  onClick={() => setSubPaymentMethod("crypto")}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-all ${subPaymentMethod === "crypto" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                >
                  <Wallet className="inline h-3.5 w-3.5 mr-1" /> Crypto (SOL)
                </button>
              </div>

              {subPaymentMethod === "card" ? (
                <SquareCardForm
                  amount={getPrice(pendingTier)}
                  onTokenize={async (token) => {
                    const price = getPrice(pendingTier);
                    const { data, error } = await supabase.functions.invoke("square-payment", {
                      body: {
                        amount_cents: price * 100,
                        currency: "USD",
                        description: `Rhozeland: ${pendingTier.name} subscription (${billingCycle})`,
                        source_id: token,
                        location_id: SQUARE_LOCATION_ID,
                      },
                    });
                    if (error) throw error;
                    if (!data?.success) throw new Error(data?.error || "Payment failed");

                    const paymentId = data?.payment_id;
                    await subscribeTier.mutateAsync(pendingTier);

                    const now = new Date();
                    const endDate = new Date(now);
                    if (billingCycle === "annual") endDate.setFullYear(endDate.getFullYear() + 1);
                    else endDate.setMonth(endDate.getMonth() + 1);

                    supabase.functions.invoke("send-subscription-receipt", {
                      body: {
                        to_email: user?.email,
                        user_name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Creator",
                        tier_name: pendingTier.name,
                        credits: 0,
                        amount: price.toFixed(2),
                        payment_id: paymentId,
                        subscription_start: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                        subscription_end: endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                      },
                    }).catch((err) => console.error("Receipt email failed:", err));

                    setSubPaymentOpen(false);
                    setPendingTier(null);
                  }}
                />
              ) : (
                <div className="space-y-3">
                  <PaySolAndVerify
                    solAmount={+(getPrice(pendingTier) / 150).toFixed(4)}
                    intent="subscription"
                    type="subscription"
                    description={`${pendingTier.name} subscription (${billingCycle}, SOL)`}
                    label={`Pay ~${(getPrice(pendingTier) / 150).toFixed(4)} SOL`}
                    className="w-full"
                    onSuccess={async () => {
                      await subscribeTier.mutateAsync(pendingTier);
                      setSubPaymentOpen(false);
                      setPendingTier(null);
                    }}
                  />
                  <div className="relative flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground font-body">or pay with $RHOZE</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <PayWithRhozeButton
                    tokenAmount={Math.ceil(getPrice(pendingTier) * 100)}
                    intent="subscription"
                    type="subscription"
                    description={`${pendingTier.name} subscription (${billingCycle}, $RHOZE)`}
                    label={`Pay ${Math.ceil(getPrice(pendingTier) * 100)} $RHOZE`}
                    className="w-full"
                    onSuccess={async () => {
                      await subscribeTier.mutateAsync(pendingTier);
                      setSubPaymentOpen(false);
                      setPendingTier(null);
                    }}
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    Pay via Phantom or Solflare • SOL or $RHOZE accepted
                  </p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TransactionHistory = ({ userId }: { userId?: string }) => {
  const { data: transactions } = useQuery({
    queryKey: ["credit-transactions", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!userId,
  });

  if (!transactions || transactions.length === 0) return null;

  const methodLabel = (method: string | null, type: string) => {
    if (method === "crypto") return "Crypto (SOL)";
    if (method === "card") return "Card (Square)";
    if (method === "credits") return "Credits";
    if (type === "subscription") return "Subscription";
    if (type === "refund") return "Refund";
    return type;
  };

  const methodColor = (method: string | null) => {
    if (method === "crypto") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    if (method === "card") return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="surface-card p-6">
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Payment History</h2>
      <div className="space-y-2">
        {transactions.map((tx: any) => (
          <div key={tx.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${methodColor(tx.payment_method)}`}>
                  {methodLabel(tx.payment_method, tx.type)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
            <span className={`font-display font-bold text-sm whitespace-nowrap ${tx.amount > 0 ? "text-primary" : "text-destructive"}`}>
              {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount * 75).toFixed(0) !== "0" ? (Math.abs(tx.amount) * 1).toFixed(0) : tx.amount} cr
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────────────
   Verified IP — Works explainer + recent anchored works for the creator.
   Lives inside Creator Pass so the IP toolkit feels like part of the kit
   instead of a standalone tab. The full vault still lives at /works.
   ─────────────────────────────────────────────────────────────────────── */
const VerifiedIPSection = ({ userId }: { userId: string | null }) => {
  const { data: works = [], isLoading } = useQuery({
    queryKey: ["creator-pass-works", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("works")
        .select("id, title, kind, content_hash, solana_signature, anchored_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: !!userId,
  });

  const anchoredCount = works.filter((w: any) => w.solana_signature).length;

  return (
    <div className="space-y-6">
      {/* Explainer */}
      <div className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          <Shield className="h-3.5 w-3.5" /> Layer I · Verified IP
        </div>
        <h3 className="font-display text-2xl font-bold text-foreground">
          Every file you make can be Verified IP.
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Drop in any audio, image, video, or document and Rhozeland computes a
          <strong className="text-foreground"> SHA-256 fingerprint</strong> in
          your browser — a unique signature of the file's bytes. Anchor it on
          Solana and you get a public, timestamped proof of authorship that
          travels with the work everywhere it goes: profiles, projects, the Hub,
          even revenue splits.
        </p>
        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl border border-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fingerprinted</p>
            <p className="font-display text-2xl font-bold text-foreground">{works.length}</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Anchored on Solana</p>
            <p className="font-display text-2xl font-bold text-foreground">{anchoredCount}</p>
          </div>
          <div className="rounded-xl border border-border p-3 flex items-center">
            <Link to="/works" className="text-sm font-medium text-foreground hover:underline inline-flex items-center gap-1">
              Open the vault →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent works */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display text-base font-semibold text-foreground">Your recent works</h4>
          <Link to="/works" className="text-xs text-muted-foreground hover:text-foreground">See all →</Link>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : works.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground">No works registered yet.</p>
            <Link to="/works">
              <Button size="sm" className="rounded-full">Register your first work</Button>
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {works.map((w: any) => (
              <li key={w.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                  <Shield className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{w.title}</p>
                    <Badge variant="outline" className="text-[10px] py-0 h-4">{w.kind}</Badge>
                    {w.solana_signature && (
                      <Badge variant="outline" className="gap-1 text-[10px] py-0 h-4">
                        <Shield className="h-2.5 w-2.5" /> Anchored
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground truncate" title={w.content_hash}>
                    sha256:{w.content_hash?.slice(0, 10)}…{w.content_hash?.slice(-6)}
                  </p>
                </div>
                {w.solana_signature && (
                  <a
                    href={`https://solscan.io/tx/${w.solana_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    Solscan →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CreditShopPage;

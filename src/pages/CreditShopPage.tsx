import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
  Palette,
  Camera,
  Video,
  PenTool,
  ExternalLink,
  Zap,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import PaySolAndVerify from "@/components/PaySolAndVerify";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";

const CAT_ICONS: Record<string, any> = {
  music: Music, design: Palette, photo: Camera, video: Video, writing: PenTool,
};

const CRYPTO_DISCOUNT = 0.30; // 30% off for crypto payments
const TOKEN_PRICE = 75;

// Placeholder — user will provide the actual Pump Fun CA
const RHOZE_CA = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const PUMP_FUN_URL = `https://pump.fun/coin/${RHOZE_CA}`;

const TIERS = [
  {
    key: "spark",
    name: "Spark",
    price: 0,
    credits: 0,
    gradient: "linear-gradient(135deg, hsl(205, 75%, 65%), hsl(210, 65%, 52%), hsl(220, 55%, 42%))",
    glowColor: "hsl(210, 70%, 55%)",
    icon: Sparkles,
    isFree: true,
    bestFor: "Exploring the platform, getting started",
    features: [
      "Access all creative tools",
      "3 Boards",
      "Collab Rooms — 1 hr max",
      "Community access",
      "Basic profile",
    ],
    limits: { smartboards: 3, dropRoomHours: 1 },
  },
  {
    key: "bloom",
    name: "Bloom",
    price: 240,
    credits: 4,
    gradient: "linear-gradient(135deg, hsl(330, 65%, 72%), hsl(340, 60%, 58%), hsl(345, 55%, 48%))",
    glowColor: "hsl(335, 60%, 65%)",
    icon: Flower2,
    bestFor: "New creators, freelancers, side-hustlers",
    features: [
      "4 $RHOZE/month",
      "15 Boards",
      "Collab Rooms — 4 hr max",
      "Studio access",
      "Livestream workshops",
      "Community Telegram",
    ],
    limits: { smartboards: 15, dropRoomHours: 4 },
  },
  {
    key: "glow",
    name: "Glow",
    price: 560,
    credits: 10,
    gradient: "linear-gradient(135deg, hsl(30, 90%, 60%), hsl(25, 85%, 50%), hsl(20, 80%, 42%))",
    glowColor: "hsl(28, 85%, 55%)",
    icon: Sun,
    bestFor: "Semi-pros, scaling micro-influencers",
    features: [
      "10 $RHOZE/month",
      "50 Boards",
      "Collab Rooms — 12 hr max",
      "Standard workshops",
      "Strategy consultation",
      "Priority booking",
    ],
    limits: { smartboards: 50, dropRoomHours: 12 },
  },
  {
    key: "play",
    name: "Play",
    price: 1500,
    credits: 25,
    gradient: "linear-gradient(135deg, hsl(50, 90%, 58%), hsl(43, 85%, 48%), hsl(38, 80%, 40%))",
    glowColor: "hsl(45, 85%, 52%)",
    icon: Gamepad,
    bestFor: "Full-time creators, funded artists",
    features: [
      "25 $RHOZE/month",
      "Unlimited Boards",
      "Unlimited Collab Rooms",
      "Premium workshops",
      "360 Audit",
      "Grant support",
      "First content review",
    ],
    limits: { smartboards: -1, dropRoomHours: -1 },
  },
];

const CreditShopPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [alaCarteCredits, setAlaCarteCredits] = useState(1);
  const [cardPaymentOpen, setCardPaymentOpen] = useState(false);
  const [pendingCardCredits, setPendingCardCredits] = useState(0);
  const [subPaymentOpen, setSubPaymentOpen] = useState(false);
  const [subPaymentMethod, setSubPaymentMethod] = useState<"card" | "crypto">("card");
  const [pendingTier, setPendingTier] = useState<(typeof TIERS)[number] | null>(null);

  const activeTab = searchParams.get("tab") || "shop";

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

  const purchaseCredits = useMutation({
    mutationFn: async ({ amount, description, method }: { amount: number; description: string; method: string }) => {
      if (userCredits) {
        const { error } = await supabase
          .from("user_credits")
          .update({ balance: (userCredits.balance as number) + amount })
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_credits")
          .insert({ user_id: user!.id, balance: amount });
        if (error) throw error;
      }
      const { error: txError } = await supabase
        .from("credit_transactions")
        .insert({ user_id: user!.id, amount, type: "purchase", description, payment_method: method });
      if (txError) throw txError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      toast.success("$RHOZE added to your balance!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const subscribeTier = useMutation({
    mutationFn: async (tier: (typeof TIERS)[number]) => {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);

      const payload = {
        balance: ((userCredits?.balance as number) ?? 0) + tier.credits,
        tier: tier.key,
        tier_credits_monthly: tier.credits,
        subscription_start: now.toISOString().split("T")[0],
        subscription_end: endDate.toISOString().split("T")[0],
      };

      if (userCredits) {
        const { error } = await supabase.from("user_credits").update(payload).eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_credits").insert({ user_id: user!.id, ...payload });
        if (error) throw error;
      }

      const { error: txError } = await supabase
        .from("credit_transactions")
        .insert({
          user_id: user!.id,
          amount: tier.credits,
          type: "subscription",
          description: `${tier.name} subscription — ${tier.credits} $RHOZE`,
          payment_method: "card",
        });
      if (txError) throw txError;
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
    if (v === "shop") searchParams.delete("tab"); else searchParams.set("tab", v);
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Studio Pass</h1>
            <p className="text-muted-foreground">Your creative membership & $RHOZE wallet</p>
          </div>
          <div className="surface-card flex items-center gap-3 px-5 py-3">
            <Coins className="h-5 w-5 text-primary" />
            <div>
              <p className="font-display text-2xl font-bold text-foreground">{userCredits?.balance ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Balance</p>
            </div>
            <Badge className="ml-2 capitalize">{currentTier}</Badge>
          </div>
        </div>

        {/* Explainer */}
        <div className="rounded-2xl bg-gradient-to-r from-primary/5 to-accent/5 border border-border p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What is $RHOZE?</p>
            <p className="text-sm text-foreground">$RHOZE is the native token powering Rhozeland. Use it to book studios, hire creators, and trade on the marketplace. <strong>1 $RHOZE ≈ ${TOKEN_PRICE}</strong>.</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">How to earn</p>
            <p className="text-sm text-foreground">Subscribe for monthly $RHOZE, post listings, collaborate in rooms, or top up with card/SOL.</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">How to spend</p>
            <p className="text-sm text-foreground">Book studio sessions, hire creators, or purchase digital assets on the marketplace.</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="shop" className="gap-1.5"><Coins className="h-3.5 w-3.5" /> Plans</TabsTrigger>
          <TabsTrigger value="buy" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Buy $RHOZE</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5"><ShoppingBag className="h-3.5 w-3.5" /> Purchases</TabsTrigger>
        </TabsList>

        {/* ═══════ Plans Tab ═══════ */}
        <TabsContent value="shop" className="space-y-8 mt-4">
          {/* Crypto discount banner */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500/10 to-primary/10 border border-primary/20 p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 shrink-0">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground text-sm">Pay with crypto & save {Math.round(CRYPTO_DISCOUNT * 100)}%</p>
              <p className="text-xs text-muted-foreground">Subscribe using SOL or $RHOZE and get {Math.round(CRYPTO_DISCOUNT * 100)}% off any paid tier.</p>
            </div>
          </motion.div>

          {/* Tiers */}
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground mb-1">
              Membership <span className="text-sm font-normal text-muted-foreground">— choose your creative tier</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
              {TIERS.map((tier, i) => {
                const TierIcon = tier.icon;
                const isCurrentTier = currentTier === tier.key;
                const isFree = (tier as any).isFree;
                const isBestValue = tier.key === "glow";
                const cryptoPrice = Math.round(tier.price * (1 - CRYPTO_DISCOUNT));
                return (
                  <motion.div
                    key={tier.key}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.12, type: "spring", stiffness: 180 }}
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
                        <span className="font-display text-4xl font-bold drop-shadow-sm">{isFree ? "Free" : tier.credits}</span>
                      </div>
                      <p className="text-sm opacity-80 mt-1 relative z-10">{isFree ? "forever" : "$RHOZE / month"}</p>
                      {!isFree && (
                        <div className="mt-1 relative z-10 space-y-0.5">
                          <p className="text-xs opacity-60">${tier.price}/mo (fiat)</p>
                          <p className="text-xs font-semibold opacity-90 text-white">
                            ${cryptoPrice}/mo with crypto — Save {Math.round(CRYPTO_DISCOUNT * 100)}%
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-card space-y-3">
                      <p className="text-xs text-muted-foreground font-medium leading-snug">{tier.bestFor}</p>
                      <details className="group">
                        <summary className="text-[11px] font-medium text-primary cursor-pointer select-none hover:underline list-none flex items-center gap-1">
                          <span className="group-open:hidden">Show features ↓</span>
                          <span className="hidden group-open:inline">Hide features ↑</span>
                        </summary>
                        <ul className="space-y-1.5 mt-2">
                          {tier.features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-xs text-foreground leading-snug">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 shrink-0 mt-0.5">
                                <Check className="h-2.5 w-2.5 text-primary" />
                              </span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </details>

                      {isCurrentTier ? (
                        <Button className="w-full h-9 font-semibold text-xs" variant="outline" disabled>Current Plan</Button>
                      ) : isFree ? (
                        <Button className="w-full h-9 font-semibold text-xs" variant="secondary" disabled>Included</Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 h-9 font-semibold text-xs gap-1"
                            onClick={() => { setPendingTier(tier); setSubPaymentMethod("card"); setSubPaymentOpen(true); }}
                          >
                            <CreditCard className="h-3.5 w-3.5" /> ${tier.price}
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 h-9 font-semibold text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => { setPendingTier(tier); setSubPaymentMethod("crypto"); setSubPaymentOpen(true); }}
                          >
                            <Wallet className="h-3.5 w-3.5" /> ${cryptoPrice}
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* À la carte top-up */}
          <div className="surface-card p-6 space-y-5">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Top Up <span className="text-sm font-normal text-muted-foreground">— add $RHOZE anytime</span>
            </h2>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">1 $RHOZE ≈ ${TOKEN_PRICE.toFixed(2)}</p>
              <p className="font-display text-3xl font-bold text-foreground">{alaCarteCredits}</p>
              <Slider value={[alaCarteCredits]} onValueChange={(v) => setAlaCarteCredits(v[0])} min={1} max={30} step={1} className="py-4" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="flex-1" onClick={() => { setPendingCardCredits(alaCarteCredits); setCardPaymentOpen(true); }}>
                <CreditCard className="mr-2 h-4 w-4" /> Buy {alaCarteCredits} $RHOZE @ ${(alaCarteCredits * TOKEN_PRICE).toFixed(2)}
              </Button>
              <PaySolAndVerify
                solAmount={+(alaCarteCredits * TOKEN_PRICE / 150).toFixed(4)}
                creditsToAdd={alaCarteCredits}
                description={`${alaCarteCredits} $RHOZE à la carte (SOL)`}
                label={`Pay ~${(alaCarteCredits * TOKEN_PRICE / 150).toFixed(4)} SOL`}
                className="flex-1"
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["user-credits"] })}
              />
            </div>
          </div>

          <TransactionHistory userId={user?.id} />
        </TabsContent>

        {/* ═══════ Buy $RHOZE Tab ═══════ */}
        <TabsContent value="buy" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left — info */}
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <h2 className="font-display text-2xl font-bold text-foreground">Buy $RHOZE Token</h2>
                <p className="text-muted-foreground">
                  $RHOZE is the native utility token for Rhozeland. Purchase directly on Pump Fun or swap via your preferred DEX.
                  Holding $RHOZE unlocks <strong>{Math.round(CRYPTO_DISCOUNT * 100)}% discounts</strong> on Studio Pass subscriptions and studio bookings.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border p-4 space-y-1 bg-card">
                    <TrendingUp className="h-5 w-5 text-primary mb-1" />
                    <p className="font-display font-bold text-foreground text-lg">1 ◊ ≈ ${TOKEN_PRICE}</p>
                    <p className="text-xs text-muted-foreground">Current valuation</p>
                  </div>
                  <div className="rounded-xl border border-border p-4 space-y-1 bg-card">
                    <Zap className="h-5 w-5 text-primary mb-1" />
                    <p className="font-display font-bold text-foreground text-lg">{Math.round(CRYPTO_DISCOUNT * 100)}% Off</p>
                    <p className="text-xs text-muted-foreground">Crypto discount on subs</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contract Address</p>
                  <code className="text-xs text-foreground bg-muted px-2 py-1 rounded font-mono break-all block">
                    {RHOZE_CA}
                  </code>
                  <p className="text-xs text-muted-foreground">Solana · SPL Token</p>
                </div>

                <a href={PUMP_FUN_URL} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full h-12 text-base rounded-full gap-2">
                    <ExternalLink className="h-4 w-4" /> Buy on Pump Fun
                  </Button>
                </a>
              </motion.div>
            </div>

            {/* Right — embedded swap widget */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              <div className="p-4 border-b border-border">
                <h3 className="font-display font-semibold text-foreground">Swap Widget</h3>
                <p className="text-xs text-muted-foreground">Buy $RHOZE directly — powered by Pump Fun</p>
              </div>
              <iframe
                  src={`https://pump.fun/coin/${RHOZE_CA}?embed=true`}
                  className="w-full h-[500px] border-0"
                  title="Buy $RHOZE"
                  allow="clipboard-write"
                />
            </motion.div>
          </div>

          {/* How it works */}
          <div className="surface-card p-6">
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">How buying $RHOZE works</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { step: "1", title: "Connect Wallet", desc: "Connect your Phantom or Solflare wallet to get started." },
                { step: "2", title: "Swap SOL → $RHOZE", desc: "Use Pump Fun or any Solana DEX to swap SOL for $RHOZE tokens." },
                { step: "3", title: "Unlock Benefits", desc: `Get ${Math.round(CRYPTO_DISCOUNT * 100)}% off subscriptions, book studios, and trade on the marketplace.` },
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
        </TabsContent>

        {/* ═══════ Purchases Tab ═══════ */}
        <TabsContent value="purchases" className="mt-4">
          {purchasesLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !purchases?.length ? (
            <div className="text-center py-20 space-y-4">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground">No purchases yet</p>
              <Link to="/creators">
                <Button variant="outline" className="rounded-full">Browse Creators Hub</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
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
        </TabsContent>
      </Tabs>

      {/* Square Card Payment Modal (à la carte) */}
      <Dialog open={cardPaymentOpen} onOpenChange={setCardPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Buy {pendingCardCredits} $RHOZE</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 border border-border p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">{pendingCardCredits} $RHOZE</span>
            </div>
            <span className="text-lg font-bold text-primary">${(pendingCardCredits * TOKEN_PRICE).toFixed(2)}</span>
          </div>
          <SquareCardForm
            amount={pendingCardCredits * TOKEN_PRICE}
            onTokenize={async (token) => {
              const { data, error } = await supabase.functions.invoke("square-payment", {
                body: {
                  amount_cents: pendingCardCredits * TOKEN_PRICE * 100,
                  currency: "USD",
                  description: `Rhozeland: ${pendingCardCredits} $RHOZE`,
                  source_id: token,
                  location_id: SQUARE_LOCATION_ID,
                },
              });
              if (error) throw error;
              if (!data?.success) throw new Error(data?.error || "Payment failed");
              await purchaseCredits.mutateAsync({ amount: pendingCardCredits, description: `${pendingCardCredits} $RHOZE à la carte`, method: "card" });
              setCardPaymentOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Subscription Payment Modal (fiat or crypto) */}
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
                  {subPaymentMethod === "crypto" ? (
                    <div className="text-right">
                      <span className="text-lg font-bold text-primary">${Math.round(pendingTier.price * (1 - CRYPTO_DISCOUNT))}/mo</span>
                      <p className="text-xs text-muted-foreground line-through">${pendingTier.price}/mo</p>
                    </div>
                  ) : (
                    <span className="text-lg font-bold text-primary">${pendingTier.price.toFixed(2)}/mo</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pendingTier.credits} $RHOZE/month • Billed monthly
                  {subPaymentMethod === "crypto" && ` • ${Math.round(CRYPTO_DISCOUNT * 100)}% crypto discount applied`}
                </p>
              </div>

              {/* Payment method toggle */}
              <div className="flex rounded-lg bg-muted p-1 gap-1">
                <button
                  onClick={() => setSubPaymentMethod("card")}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-all ${subPaymentMethod === "card" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                >
                  <CreditCard className="inline h-3.5 w-3.5 mr-1" /> Card — ${pendingTier.price}
                </button>
                <button
                  onClick={() => setSubPaymentMethod("crypto")}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-all ${subPaymentMethod === "crypto" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                >
                  <Wallet className="inline h-3.5 w-3.5 mr-1" /> Crypto — ${Math.round(pendingTier.price * (1 - CRYPTO_DISCOUNT))}
                </button>
              </div>

              {subPaymentMethod === "card" ? (
                <SquareCardForm
                  amount={pendingTier.price}
                  onTokenize={async (token) => {
                    const { data, error } = await supabase.functions.invoke("square-payment", {
                      body: {
                        amount_cents: pendingTier.price * 100,
                        currency: "USD",
                        description: `Rhozeland: ${pendingTier.name} subscription`,
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
                    endDate.setMonth(endDate.getMonth() + 1);
                    supabase.functions.invoke("send-subscription-receipt", {
                      body: {
                        to_email: user?.email,
                        user_name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Creator",
                        tier_name: pendingTier.name,
                        credits: pendingTier.credits,
                        amount: pendingTier.price.toFixed(2),
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
                    solAmount={+(Math.round(pendingTier.price * (1 - CRYPTO_DISCOUNT)) / 150).toFixed(4)}
                    creditsToAdd={pendingTier.credits}
                    description={`${pendingTier.name} subscription (crypto — ${Math.round(CRYPTO_DISCOUNT * 100)}% off)`}
                    label={`Pay ~${(Math.round(pendingTier.price * (1 - CRYPTO_DISCOUNT)) / 150).toFixed(4)} SOL`}
                    className="w-full"
                    onSuccess={async () => {
                      await subscribeTier.mutateAsync(pendingTier);
                      setSubPaymentOpen(false);
                      setPendingTier(null);
                    }}
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    {Math.round(CRYPTO_DISCOUNT * 100)}% discount applied • Pay via Phantom or Solflare
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

  return (
    <div className="surface-card p-6">
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Transaction History</h2>
      <div className="space-y-2">
        {transactions.map((tx: any) => (
          <div key={tx.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">{tx.description}</p>
              <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()} • {tx.payment_method ?? tx.type}</p>
            </div>
            <span className={`font-display font-bold ${tx.amount > 0 ? "text-primary" : "text-destructive"}`}>
              {tx.amount > 0 ? "+" : ""}{tx.amount} ◊
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CreditShopPage;

import { useState } from "react";
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
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";

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
      "Collab Rooms — 1 hr max",
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
      "Collab Rooms — 4 hr max",
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
      "Collab Rooms — 12 hr max",
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
      "Unlimited Collab Rooms",
      "15% off studio bookings",
      "Priority booking",
      "Marketplace access",
    ],
    limits: { smartboards: -1, dropRoomHours: -1, studioDiscount: 15 },
  },
];

const CreditShopPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subPaymentOpen, setSubPaymentOpen] = useState(false);
  const [subPaymentMethod, setSubPaymentMethod] = useState<"card" | "crypto">("card");
  const [pendingTier, setPendingTier] = useState<(typeof TIERS)[number] | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

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

  const subscribeTier = useMutation({
    mutationFn: async (tier: (typeof TIERS)[number]) => {
      const now = new Date();
      const endDate = new Date(now);
      if (billingCycle === "annual") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const payload = {
        balance: (userCredits?.balance as number) ?? 0,
        tier: tier.key,
        tier_credits_monthly: 0,
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
          amount: 0,
          type: "subscription",
          description: `${tier.name} subscription — ${billingCycle}`,
          payment_method: subPaymentMethod,
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
            <h1 className="font-display text-3xl font-bold text-foreground">Studio Pass</h1>
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
          <TabsTrigger value="shop" className="gap-1.5"><Coins className="h-3.5 w-3.5" /> Plans</TabsTrigger>
          <TabsTrigger value="rhoze" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> $RHOZE</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5"><ShoppingBag className="h-3.5 w-3.5" /> Purchases</TabsTrigger>
        </TabsList>

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

          <TransactionHistory userId={user?.id} />
        </TabsContent>

        {/* ═══════ $RHOZE Tab ═══════ */}
        <TabsContent value="rhoze" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left — info */}
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <h2 className="font-display text-2xl font-bold text-foreground">$RHOZE Token</h2>
                <p className="text-muted-foreground">
                  $RHOZE is the native utility token for Rhozeland. Use it to pay for studio bookings at a discount,
                  trade on the marketplace, and support creators directly on-chain.
                </p>

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

          {/* How it works */}
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
                    creditsToAdd={0}
                    description={`${pendingTier.name} subscription (${billingCycle}, crypto)`}
                    label={`Pay ~${(getPrice(pendingTier) / 150).toFixed(4)} SOL`}
                    className="w-full"
                    onSuccess={async () => {
                      await subscribeTier.mutateAsync(pendingTier);
                      setSubPaymentOpen(false);
                      setPendingTier(null);
                    }}
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    One-time crypto payment • Pay via Phantom or Solflare
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

export default CreditShopPage;

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
  Infinity,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import PaySolAndVerify from "@/components/PaySolAndVerify";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";

const CAT_ICONS: Record<string, any> = {
  music: Music, design: Palette, photo: Camera, video: Video, writing: PenTool,
};

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

const TOKEN_PRICE = 75; // 1 $RHOZE ≈ $75

const CreditShopPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [alaCarteCredits, setAlaCarteCredits] = useState(1);
  const [cardPaymentOpen, setCardPaymentOpen] = useState(false);
  const [pendingCardCredits, setPendingCardCredits] = useState(0);
  const [subPaymentOpen, setSubPaymentOpen] = useState(false);
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
    mutationFn: async ({
      amount,
      description,
      method,
    }: {
      amount: number;
      description: string;
      method: string;
    }) => {
      // Upsert user credits
      if (userCredits) {
        const { error: updateError } = await supabase
          .from("user_credits")
          .update({ balance: (userCredits.balance as number) + amount })
          .eq("user_id", user!.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("user_credits")
          .insert({ user_id: user!.id, balance: amount });
        if (insertError) throw insertError;
      }

      // Log transaction
      const { error: txError } = await supabase
        .from("credit_transactions")
        .insert({
          user_id: user!.id,
          amount,
          type: "purchase",
          description,
          payment_method: method,
        });
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

      if (userCredits) {
        const { error } = await supabase
          .from("user_credits")
          .update({
            balance: (userCredits.balance as number) + tier.credits,
            tier: tier.key,
            tier_credits_monthly: tier.credits,
            subscription_start: now.toISOString().split("T")[0],
            subscription_end: endDate.toISOString().split("T")[0],
          })
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_credits").insert({
          user_id: user!.id,
          balance: tier.credits,
          tier: tier.key,
          tier_credits_monthly: tier.credits,
          subscription_start: now.toISOString().split("T")[0],
          subscription_end: endDate.toISOString().split("T")[0],
        });
        if (error) throw error;
      }

      // Log transaction
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

  // Purchases data
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

  return (
    <div className="space-y-8">
      {/* Header with explainer */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Studio Pass
            </h1>
            <p className="text-muted-foreground">
              Your creative membership & $RHOZE wallet
            </p>
          </div>
          <div className="surface-card flex items-center gap-3 px-5 py-3">
            <Coins className="h-5 w-5 text-primary" />
            <div>
              <p className="font-display text-2xl font-bold text-foreground">
                {userCredits?.balance ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Total Balance</p>
            </div>
            <Badge className="ml-2 capitalize">{currentTier}</Badge>
          </div>
        </div>

        {/* What are credits explainer */}
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

      <Tabs value={activeTab} onValueChange={(v) => {
        if (v === "shop") { searchParams.delete("tab"); } else { searchParams.set("tab", v); }
        setSearchParams(searchParams, { replace: true });
      }}>
        <TabsList>
          <TabsTrigger value="shop" className="gap-1.5"><Coins className="h-3.5 w-3.5" /> Plans</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5"><ShoppingBag className="h-3.5 w-3.5" /> Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-8 mt-4">

      {/* Membership tiers */}
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-1">
          Membership{" "}
          <span className="text-sm font-normal text-muted-foreground">
            — choose your creative tier
          </span>
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
          {TIERS.map((tier, i) => {
            const TierIcon = tier.icon;
            const isCurrentTier = currentTier === tier.key;
            const isFree = (tier as any).isFree;
            const isBestValue = tier.key === "glow";
            const perCreditCost = !isFree && tier.credits > 0 ? tier.price / tier.credits : 0;
            const sparkPerCredit = TIERS[1].price / TIERS[1].credits; // baseline bloom
            const discount = !isFree && tier.credits > 0 && perCreditCost < sparkPerCredit
              ? Math.round((1 - perCreditCost / sparkPerCredit) * 100)
              : 0;
            return (
              <motion.div
                key={tier.key}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12, type: "spring", stiffness: 180 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className={`relative rounded-2xl overflow-hidden transition-all ${
                  isCurrentTier
                    ? "border-2 border-primary shadow-xl"
                    : isBestValue
                    ? "border-2 border-primary/50 shadow-lg"
                    : "border border-border hover:shadow-xl"
                }`}
                style={{
                  boxShadow: isCurrentTier
                    ? `0 12px 40px -8px ${tier.glowColor}50`
                    : isBestValue
                    ? `0 8px 30px -6px ${tier.glowColor}30`
                    : undefined,
                }}
              >
                {/* Best value badge */}
                {isBestValue && !isCurrentTier && (
                  <div className="absolute top-3 right-3 z-20 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                    Best Value
                  </div>
                )}

                {/* Gradient header */}
                <div
                  className="px-5 py-6 text-center text-white relative overflow-hidden animated-gradient"
                  style={{ background: tier.gradient, backgroundSize: "200% 200%" }}
                >
                  <div className="absolute inset-0 opacity-20" style={{
                    background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 60%)"
                  }} />
                  <p className="text-xs font-semibold tracking-widest uppercase opacity-90 relative z-10">{tier.name}</p>
                  <div className="flex items-center justify-center gap-2 mt-2 relative z-10">
                    <TierIcon className="h-6 w-6 drop-shadow-sm" />
                    <span className="font-display text-4xl font-bold drop-shadow-sm">
                      {isFree ? "Free" : tier.credits}
                    </span>
                  </div>
                  <p className="text-sm opacity-80 mt-1 relative z-10">
                    {isFree ? "forever" : "$RHOZE / month"}
                  </p>
                  {!isFree && (
                    <p className="text-xs opacity-60 mt-0.5 relative z-10">
                      ${tier.price.toFixed(0)}/mo
                      {discount > 0 && (
                        <span className="ml-1.5 text-white/90 font-semibold">
                          · Save {discount}%
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Features — collapsible */}
                <div className="p-4 bg-card space-y-3">
                  <p className="text-xs text-muted-foreground font-medium leading-snug">
                    {tier.bestFor}
                  </p>
                  <details className="group">
                    <summary className="text-[11px] font-medium text-primary cursor-pointer select-none hover:underline list-none flex items-center gap-1">
                      <span className="group-open:hidden">Show features ↓</span>
                      <span className="hidden group-open:inline">Hide features ↑</span>
                    </summary>
                    <ul className="space-y-1.5 mt-2">
                      {tier.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-xs text-foreground leading-snug"
                        >
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 shrink-0 mt-0.5">
                            <Check className="h-2.5 w-2.5 text-primary" />
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                  <Button
                    className="w-full h-9 font-semibold text-xs"
                    variant={isCurrentTier ? "outline" : isFree ? "secondary" : "default"}
                    disabled={isCurrentTier}
                    onClick={() => {
                      if (isFree) return;
                      setPendingTier(tier);
                      setSubPaymentOpen(true);
                    }}
                  >
                    {isCurrentTier ? "Current Plan" : isFree ? "Included" : `$${tier.price}/mo`}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* À la carte */}
      <div className="surface-card p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Top Up{" "}
          <span className="text-sm font-normal text-muted-foreground">
            — add $RHOZE anytime
          </span>
        </h2>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            1 $RHOZE ≈ ${TOKEN_PRICE.toFixed(2)}
          </p>
          <p className="font-display text-3xl font-bold text-foreground">
            {alaCarteCredits}
          </p>
          <Slider
            value={[alaCarteCredits]}
            onValueChange={(v) => setAlaCarteCredits(v[0])}
            min={1}
            max={30}
            step={1}
            className="py-4"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="flex-1"
            onClick={() => {
              setPendingCardCredits(alaCarteCredits);
              setCardPaymentOpen(true);
            }}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Buy {alaCarteCredits} $RHOZE @ $
            {(alaCarteCredits * TOKEN_PRICE).toFixed(2)}
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

      {/* Transaction history */}
      <TransactionHistory userId={user?.id} />
        </TabsContent>

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

      {/* Square Card Payment Modal */}
      <Dialog open={cardPaymentOpen} onOpenChange={setCardPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Buy {pendingCardCredits} $RHOZE
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 border border-border p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {pendingCardCredits} $RHOZE
              </span>
            </div>
            <span className="text-lg font-bold text-primary">
              ${(pendingCardCredits * TOKEN_PRICE).toFixed(2)}
            </span>
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

              // Payment succeeded — now add credits
              await purchaseCredits.mutateAsync({
                amount: pendingCardCredits,
                description: `${pendingCardCredits} $RHOZE à la carte`,
                method: "card",
              });

              setCardPaymentOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Square Subscription Payment Modal */}
      <Dialog open={subPaymentOpen} onOpenChange={setSubPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Subscribe to {pendingTier?.name}
            </DialogTitle>
          </DialogHeader>
          {pendingTier && (
            <>
              <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{pendingTier.name} Plan</span>
                  <span className="text-lg font-bold text-primary">${pendingTier.price.toFixed(2)}/mo</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {pendingTier.credits} credits/month • Billed monthly
                </p>
              </div>
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

                   // Payment succeeded — activate subscription
                   await subscribeTier.mutateAsync(pendingTier);

                   // Send receipt email (fire-and-forget)
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
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">
        Transaction History
      </h2>
      <div className="space-y-2">
        {transactions.map((tx: any) => (
          <div
            key={tx.id}
            className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {tx.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(tx.created_at).toLocaleDateString()} •{" "}
                {tx.payment_method ?? tx.type}
              </p>
            </div>
            <span
              className={`font-display font-bold ${
                tx.amount > 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {tx.amount > 0 ? "+" : ""}
              {tx.amount} cr
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CreditShopPage;

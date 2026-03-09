import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Coins,
  Zap,
  Crown,
  Diamond,
  Check,
  CreditCard,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import PaySolAndVerify from "@/components/PaySolAndVerify";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";

const TIERS = [
  {
    key: "bronze",
    name: "Bronze",
    price: 240,
    credits: 4,
    gradient: "linear-gradient(135deg, hsl(30, 60%, 60%), hsl(25, 50%, 42%), hsl(20, 45%, 35%))",
    glowColor: "hsl(30, 55%, 55%)",
    icon: Zap,
    bestFor: "New creators, freelancers, side-hustlers",
    features: [
      "4 credits/month",
      "Studio access",
      "Livestream workshops",
      "Community Telegram",
    ],
  },
  {
    key: "gold",
    name: "Gold",
    price: 560,
    credits: 10,
    gradient: "linear-gradient(135deg, hsl(50, 95%, 58%), hsl(43, 90%, 48%), hsl(35, 85%, 40%))",
    glowColor: "hsl(45, 90%, 50%)",
    icon: Crown,
    bestFor: "Semi-pros, scaling micro-influencers",
    features: [
      "10 credits/month",
      "All Bronze features",
      "Standard workshops",
      "Strategy consultation",
      "Priority booking",
    ],
  },
  {
    key: "diamond",
    name: "Diamond",
    price: 1500,
    credits: 25,
    gradient: "linear-gradient(135deg, hsl(200, 65%, 78%), hsl(210, 55%, 62%), hsl(220, 50%, 50%))",
    glowColor: "hsl(200, 60%, 70%)",
    icon: Diamond,
    bestFor: "Full-time creators, funded artists",
    features: [
      "25 credits/month",
      "All Gold features",
      "Premium workshops",
      "360 Audit",
      "Grant support",
      "First content review",
    ],
  },
];

const CREDIT_PRICE = 75;

const CreditShopPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [alaCarteCredits, setAlaCarteCredits] = useState(1);
  const [cardPaymentOpen, setCardPaymentOpen] = useState(false);
  const [pendingCardCredits, setPendingCardCredits] = useState(0);
  const [subPaymentOpen, setSubPaymentOpen] = useState(false);
  const [pendingTier, setPendingTier] = useState<(typeof TIERS)[number] | null>(null);

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
      toast.success("Credits added to your balance!");
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
          description: `${tier.name} subscription — ${tier.credits} credits`,
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

  const currentTier = userCredits?.tier ?? "none";

  return (
    <div className="space-y-8">
      {/* Header with balance */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Credit Shop
          </h1>
          <p className="text-muted-foreground">
            Power your creative workflow with credits
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
          {currentTier !== "none" && (
            <Badge className="ml-2 capitalize">{currentTier}</Badge>
          )}
        </div>
      </div>

      {/* Subscription tiers */}
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-1">
          Recharge{" "}
          <span className="text-sm font-normal text-muted-foreground">
            (monthly — select one of the plans to continue)
          </span>
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-4">
          {TIERS.map((tier, i) => {
            const TierIcon = tier.icon;
            const isCurrentTier = currentTier === tier.key;
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
                    : "border border-border hover:shadow-xl"
                }`}
                style={{
                  boxShadow: isCurrentTier
                    ? `0 12px 40px -8px ${tier.glowColor}50`
                    : undefined,
                }}
              >
                {/* Gradient header */}
                <div
                  className="px-5 py-8 text-center text-white relative overflow-hidden"
                  style={{ background: tier.gradient }}
                >
                  <div className="absolute inset-0 opacity-20" style={{
                    background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 60%)"
                  }} />
                  <p className="text-sm font-semibold tracking-wide uppercase opacity-90 relative z-10">{tier.name}</p>
                  <p className="font-display text-3xl font-bold mt-1.5 relative z-10 drop-shadow-sm">
                    {tier.credits} Credits/monthly
                  </p>
                  <p className="text-sm opacity-80 mt-0.5 relative z-10">
                    ${tier.price.toFixed(2)}/monthly
                  </p>
                </div>

                {/* Features */}
                <div className="p-6 bg-card space-y-4">
                  <p className="text-xs text-muted-foreground font-medium">
                    {tier.bestFor}
                  </p>
                  <ul className="space-y-2.5">
                    {tier.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2.5 text-sm text-foreground font-medium"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15">
                          <Check className="h-3 w-3 text-primary" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-4 h-11 font-semibold text-sm"
                    variant={isCurrentTier ? "outline" : "default"}
                    disabled={isCurrentTier}
                    onClick={() => {
                      setPendingTier(tier);
                      setSubPaymentOpen(true);
                    }}
                  >
                    {isCurrentTier ? "Current Plan" : `Subscribe — $${tier.price}/mo`}
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
          Recharge{" "}
          <span className="text-sm font-normal text-muted-foreground">
            (fixed amount — slide to select more credits)
          </span>
        </h2>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            1 credit ≈ ${CREDIT_PRICE.toFixed(2)}
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
            Buy {alaCarteCredits} Credit{alaCarteCredits > 1 ? "s" : ""} @ $
            {(alaCarteCredits * CREDIT_PRICE).toFixed(2)}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() =>
              purchaseCredits.mutate({
                amount: alaCarteCredits,
                description: `${alaCarteCredits} credit(s) à la carte (crypto)`,
                method: "crypto",
              })
            }
            disabled={purchaseCredits.isPending}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Buy with Crypto (${(alaCarteCredits * CREDIT_PRICE).toFixed(2)})
          </Button>
        </div>
      </div>

      {/* Transaction history */}
      <TransactionHistory userId={user?.id} />

      {/* Square Card Payment Modal */}
      <Dialog open={cardPaymentOpen} onOpenChange={setCardPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Buy {pendingCardCredits} Credit{pendingCardCredits > 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 border border-border p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {pendingCardCredits} credit{pendingCardCredits > 1 ? "s" : ""}
              </span>
            </div>
            <span className="text-lg font-bold text-primary">
              ${(pendingCardCredits * CREDIT_PRICE).toFixed(2)}
            </span>
          </div>
          <SquareCardForm
            amount={pendingCardCredits * CREDIT_PRICE}
            onTokenize={async (token) => {
              // Process real payment via Square
              const { data, error } = await supabase.functions.invoke("square-payment", {
                body: {
                  amount_cents: pendingCardCredits * CREDIT_PRICE * 100,
                  currency: "USD",
                  description: `Rhozeland: ${pendingCardCredits} credit(s)`,
                  source_id: token,
                  location_id: SQUARE_LOCATION_ID,
                },
              });
              if (error) throw error;
              if (!data?.success) throw new Error(data?.error || "Payment failed");

              // Payment succeeded — now add credits
              await purchaseCredits.mutateAsync({
                amount: pendingCardCredits,
                description: `${pendingCardCredits} credit(s) à la carte`,
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

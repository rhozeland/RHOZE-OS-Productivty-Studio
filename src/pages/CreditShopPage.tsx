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
import PayWithSolButton from "@/components/PayWithSolButton";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";

const TIERS = [
  {
    key: "bronze",
    name: "Bronze",
    price: 240,
    credits: 4,
    color: "hsl(30, 55%, 55%)",
    bgClass: "from-[hsl(30,55%,55%)] to-[hsl(30,45%,45%)]",
    icon: Zap,
    bestFor: "New creators, freelancers, side-hustlers",
    features: [
      "4 credits/month",
      "Studio access",
      "Livestream workshops",
      "Community Discord",
    ],
  },
  {
    key: "gold",
    name: "Gold",
    price: 560,
    credits: 10,
    color: "hsl(45, 90%, 50%)",
    bgClass: "from-[hsl(45,90%,50%)] to-[hsl(40,80%,40%)]",
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
    color: "hsl(200, 60%, 70%)",
    bgClass: "from-[hsl(200,60%,70%)] to-[hsl(210,50%,55%)]",
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl overflow-hidden border transition-all ${
                  isCurrentTier
                    ? "border-primary shadow-lg"
                    : "border-border hover:shadow-md"
                }`}
              >
                {/* Colored header */}
                <div
                  className="px-5 py-6 text-center text-white"
                  style={{ background: `linear-gradient(135deg, ${tier.color}, ${tier.color.replace("55%", "40%")})` }}
                >
                  <p className="text-sm font-medium opacity-90">{tier.name}</p>
                  <p className="font-display text-2xl font-bold mt-1">
                    {tier.credits} Credits/monthly
                  </p>
                  <p className="text-sm opacity-80">
                    ${tier.price.toFixed(2)}/monthly
                  </p>
                </div>

                {/* Features */}
                <div className="p-5 bg-card space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {tier.bestFor}
                  </p>
                  <ul className="space-y-2">
                    {tier.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2 text-sm text-foreground"
                      >
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-3"
                    variant={isCurrentTier ? "outline" : "default"}
                    disabled={isCurrentTier || subscribeTier.isPending}
                    onClick={() => subscribeTier.mutate(tier)}
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
            onClick={() =>
              purchaseCredits.mutate({
                amount: alaCarteCredits,
                description: `${alaCarteCredits} credit(s) à la carte`,
                method: "card",
              })
            }
            disabled={purchaseCredits.isPending}
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

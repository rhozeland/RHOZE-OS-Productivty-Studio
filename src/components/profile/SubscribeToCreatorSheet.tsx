/**
 * SubscribeToCreatorSheet — v10 primary monetization flow.
 *
 * Three fixed monthly tiers ($5 / $10 / $25). Picking one opens Stripe
 * Embedded Checkout inline. On success, Stripe redirects to /checkout/return
 * and the webhook writes the row to creator_subscriptions.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Lock, MessageSquare, Sparkles } from "lucide-react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName: string;
}

type Tier = "basic" | "standard" | "premium";

const TIERS: { id: Tier; price: number; name: string; perks: string[]; popular?: boolean }[] = [
  {
    id: "basic",
    price: 5,
    name: "Basic",
    perks: ["Private feed access", "Subscriber-only posts"],
  },
  {
    id: "standard",
    price: 10,
    name: "Standard",
    popular: true,
    perks: ["Everything in Basic", "Direct messaging", "Early drops"],
  },
  {
    id: "premium",
    price: 25,
    name: "Premium",
    perks: ["Everything in Standard", "Behind-the-scenes", "Priority DMs"],
  },
];

export default function SubscribeToCreatorSheet({ open, onOpenChange, creatorId, creatorName }: Props) {
  const { user } = useAuth();
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);

  const fetchClientSecret = async (): Promise<string> => {
    if (!selectedTier) throw new Error("No tier selected");
    if (!user) throw new Error("Sign in required");
    const returnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&creator=${creatorId}`;
    const { data, error } = await supabase.functions.invoke("create-subscription-checkout", {
      body: {
        creatorId,
        tier: selectedTier,
        userId: user.id,
        email: user.email,
        returnUrl,
        environment: getStripeEnvironment(),
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || data?.error || "Failed to start checkout");
    }
    return data.clientSecret as string;
  };

  const handlePick = (tier: Tier) => {
    if (!user) {
      toast.error("Sign in to subscribe");
      return;
    }
    setLoadingTier(tier);
    setSelectedTier(tier);
    // Loader spinner clears when EmbeddedCheckout mounts.
    setTimeout(() => setLoadingTier(null), 400);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setSelectedTier(null);
      setLoadingTier(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[92vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="font-display text-xl">
            {selectedTier ? `Subscribing to ${creatorName}` : `Subscribe to ${creatorName}`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {selectedTier
              ? "Complete payment to unlock instantly."
              : "Pick a monthly tier. Cancel anytime."}
          </DialogDescription>
        </DialogHeader>

        {!selectedTier && (
          <div className="px-4 pb-5 pt-2 space-y-2 overflow-y-auto">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handlePick(t.id)}
                disabled={loadingTier === t.id}
                className={cn(
                  "group w-full text-left rounded-xl border p-4 transition-all",
                  "bg-card/60 hover:border-foreground/40 hover:bg-card",
                  t.popular && "border-primary/50 ring-1 ring-primary/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {t.id === "basic" && <Lock className="h-4 w-4 text-primary" />}
                    {t.id === "standard" && <MessageSquare className="h-4 w-4 text-primary" />}
                    {t.id === "premium" && <Sparkles className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {t.name}
                        {t.popular && (
                          <span className="ml-2 text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                            Most popular
                          </span>
                        )}
                      </p>
                      <p className="text-sm font-display font-semibold">
                        ${t.price}
                        <span className="text-[10px] text-muted-foreground font-normal">/mo</span>
                      </p>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {t.perks.map((p) => (
                        <li key={p} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Check className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {loadingTier === t.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                  )}
                </div>
              </button>
            ))}
            <p className="text-[10px] text-center text-muted-foreground pt-2">
              {creatorName} keeps 85%. Rhozeland 15%. Tax calculated at checkout.
            </p>
          </div>
        )}

        {selectedTier && (
          <div className="flex-1 overflow-y-auto">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
            <div className="px-6 py-3 border-t border-border/40">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTier(null)} className="w-full">
                ← Back to tier selection
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

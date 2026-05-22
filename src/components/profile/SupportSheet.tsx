/**
 * SupportSheet — v10.3 unified creator support flow.
 *
 * Single tabbed dialog that collapses the three ways to back a creator
 * into one CTA on the profile:
 *   1. Subscribe — recurring monthly $5/$10/$25 via Stripe (full flow inline)
 *   2. Tip — one-off Stripe checkout (stub in v10.3 step 2; wired in step 5)
 *   3. Trade — read-only token discovery chip + pump.fun deeplink
 *
 * Replaces the separate Subscribe + Back + Trade entry points on the profile.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Lock, MessageSquare, Sparkles, Coins, Heart, ExternalLink, Hourglass } from "lucide-react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName: string;
  initialTab?: "subscribe" | "tip" | "trade";
}

type Tier = "basic" | "standard" | "premium";

interface TierCard {
  id: Tier;
  price: number;
  name: string;
  perks: string[];
  popular?: boolean;
}

const DEFAULT_TIERS: TierCard[] = [
  { id: "basic", price: 5, name: "Basic", perks: ["Private feed access", "Subscriber-only posts"] },
  { id: "standard", price: 10, name: "Standard", popular: true, perks: ["Everything in Basic", "Direct messaging", "Early drops"] },
  { id: "premium", price: 25, name: "Premium", perks: ["Everything in Standard", "Behind-the-scenes", "Priority DMs"] },
];

export default function SupportSheet({ open, onOpenChange, creatorId, creatorName, initialTab = "subscribe" }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"subscribe" | "tip" | "trade">(initialTab);
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);
  const [tiers, setTiers] = useState<TierCard[]>(DEFAULT_TIERS);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setSelectedTier(null);
      setLoadingTier(null);
      setTab(initialTab);
    }
  }, [open, initialTab]);

  // Creator-customized tier perks (same logic as SubscribeToCreatorSheet)
  useEffect(() => {
    if (!open || !creatorId) return;
    void (async () => {
      const { data } = await supabase
        .from("creator_subscription_tiers")
        .select("tier, perks, active")
        .eq("creator_id", creatorId);
      const byTier = new Map<Tier, { perks: string[]; active: boolean }>();
      for (const r of data ?? []) {
        byTier.set(r.tier as Tier, {
          perks: Array.isArray(r.perks) ? (r.perks as string[]) : [],
          active: r.active,
        });
      }
      const merged = DEFAULT_TIERS
        .map((def) => {
          const override = byTier.get(def.id);
          if (!override) return def;
          if (!override.active) return null;
          return {
            ...def,
            perks: override.perks.length > 0 ? override.perks : def.perks,
          };
        })
        .filter((t): t is TierCard => t !== null);
      setTiers(merged.length > 0 ? merged : DEFAULT_TIERS);
    })();
  }, [open, creatorId]);

  // Token discovery — surfaces Trade tab only when a coin is linked
  const { data: token } = useQuery({
    queryKey: ["support-sheet-token", creatorId],
    enabled: open && !!creatorId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("token_mint_address, token_ticker, show_token_chip")
        .eq("id", creatorId)
        .maybeSingle();
      if (!data || data.show_token_chip === false || !data.token_mint_address) return null;
      return {
        mint: data.token_mint_address as string,
        ticker: (data.token_ticker ?? "TOKEN") as string,
      };
    },
  });

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
    setTimeout(() => setLoadingTier(null), 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[92vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            {selectedTier ? `Subscribing to ${creatorName}` : `Support ${creatorName}`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {selectedTier
              ? "Complete payment to unlock instantly."
              : "Three ways to back this creator. Pick what fits."}
          </DialogDescription>
        </DialogHeader>

        {selectedTier ? (
          <div className="flex-1 overflow-y-auto">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
            <div className="px-6 py-3 border-t border-border/40">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTier(null)} className="w-full">
                ← Back to options
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 grid grid-cols-3">
              <TabsTrigger value="subscribe" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Subscribe
              </TabsTrigger>
              <TabsTrigger value="tip" className="gap-1.5">
                <Heart className="h-3.5 w-3.5" /> Tip
              </TabsTrigger>
              <TabsTrigger value="trade" disabled={!token} className="gap-1.5">
                <Coins className="h-3.5 w-3.5" /> Trade
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto px-4 pb-5 pt-3">
              <TabsContent value="subscribe" className="space-y-2 mt-0">
                {tiers.map((t) => (
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
              </TabsContent>

              <TabsContent value="tip" className="mt-0">
                <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center">
                  <Hourglass className="h-6 w-6 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">One-off tips coming soon</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                    We're wiring up one-time Stripe checkouts. Until then, subscribe monthly to support {creatorName} — cancel anytime.
                  </p>
                  <Button size="sm" variant="outline" className="mt-4" onClick={() => setTab("subscribe")}>
                    See subscription tiers
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="trade" className="mt-0">
                {token ? (
                  <div className="rounded-xl border border-border bg-card/60 p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Coins className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold text-foreground">${token.ticker}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{token.mint}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                      Tokens are a discovery overlay only. Trading happens on pump.fun — Rhozeland doesn't custody or simulate swaps.
                    </p>
                    <a
                      href={`https://pump.fun/coin/${token.mint}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-4 inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-md bg-emerald-500 hover:bg-emerald-500/90 text-white text-sm font-medium transition-colors"
                    >
                      Trade ${token.ticker} on pump.fun
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center">
                    <Coins className="h-6 w-6 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">No token yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {creatorName} hasn't linked a Solana token to their profile.
                    </p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

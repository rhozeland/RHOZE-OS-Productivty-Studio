/**
 * SupportSheet — v10.3 unified creator support flow.
 *
 * One dialog, three tabs, ordered by what we want fans to do FIRST:
 *   1. Work together — commission a project, book one of the creator's spaces,
 *      attend their next event. This is where the platform fee actually flows.
 *   2. Subscribe & Tip — recurring + one-off (less hot until creators ship
 *      private feeds, so demoted to tab 2).
 *   3. Trade — read-only Birdeye/pump.fun overlay. Hidden when no coin linked.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Check, Loader2, Lock, MessageSquare, Sparkles, Coins, Heart, Briefcase,
  CalendarDays, Building2, ArrowRight, ExternalLink, Wand2,
} from "lucide-react";
import { ConciergeIntakeSheet } from "@/components/concierge/ConciergeIntakeSheet";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CreatorTokenPanel from "@/components/profile/CreatorTokenPanel";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName: string;
  /** "work" (default) | "subscribe" | "trade" */
  initialTab?: SupportTab;
}

type SupportTab = "work" | "subscribe" | "trade";
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

const TIP_PRESETS = [5, 10, 25];

export default function SupportSheet({
  open, onOpenChange, creatorId, creatorName, initialTab = "work",
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SupportTab>(initialTab);
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);
  const [tiers, setTiers] = useState<TierCard[]>(DEFAULT_TIERS);
  const [tipAmount, setTipAmount] = useState<number>(10);
  const [tipMessage, setTipMessage] = useState<string>("");
  const [tipCheckoutOpen, setTipCheckoutOpen] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedTier(null);
      setLoadingTier(null);
      setTab(initialTab);
      setTipCheckoutOpen(false);
      setTipMessage("");
      setTipAmount(10);
    }
  }, [open, initialTab]);

  // Custom tier perks
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
          return { ...def, perks: override.perks.length > 0 ? override.perks : def.perks };
        })
        .filter((t): t is TierCard => t !== null);
      setTiers(merged.length > 0 ? merged : DEFAULT_TIERS);
    })();
  }, [open, creatorId]);

  // Token (Trade tab visibility)
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

  // "Work together" tab data — spaces + upcoming events
  const { data: spaces = [] } = useQuery({
    queryKey: ["support-sheet-spaces", creatorId],
    enabled: open && !!creatorId,
    queryFn: async () => {
      const { data } = await supabase
        .from("studios")
        .select("id, name, cover_url, hourly_rate, currency, category")
        .eq("owner_id", creatorId)
        .eq("is_active", true)
        .limit(3);
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["support-sheet-events", creatorId],
    enabled: open && !!creatorId,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, starts_at, cover_url, price, currency")
        .eq("host_id", creatorId)
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(2);
      return data ?? [];
    },
  });

  const fetchClientSecret = async (): Promise<string> => {
    if (!selectedTier) throw new Error("No tier selected");
    if (!user) throw new Error("Sign in required");
    const returnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&creator=${creatorId}`;
    const { data, error } = await supabase.functions.invoke("create-subscription-checkout", {
      body: {
        creatorId, tier: selectedTier, userId: user.id, email: user.email,
        returnUrl, environment: getStripeEnvironment(),
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || data?.error || "Failed to start checkout");
    }
    return data.clientSecret as string;
  };

  const fetchTipClientSecret = async (): Promise<string> => {
    if (!user) throw new Error("Sign in required");
    const returnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&creator=${creatorId}&kind=tip`;
    const { data, error } = await supabase.functions.invoke("create-tip-checkout", {
      body: {
        creatorId, amountCents: Math.round(tipAmount * 100), userId: user.id, email: user.email,
        message: tipMessage.trim() || undefined, returnUrl, environment: getStripeEnvironment(),
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || data?.error || "Failed to start checkout");
    }
    return data.clientSecret as string;
  };

  const handlePick = (tier: Tier) => {
    if (!user) { toast.error("Sign in to subscribe"); return; }
    setLoadingTier(tier);
    setSelectedTier(tier);
    setTimeout(() => setLoadingTier(null), 400);
  };

  const handleStartTip = () => {
    if (!user) { toast.error("Sign in to tip"); return; }
    if (tipAmount < 1 || tipAmount > 500) { toast.error("Tip must be between $1 and $500"); return; }
    setTipCheckoutOpen(true);
  };

  const handleCommission = () => {
    try {
      sessionStorage.setItem("newProjectPrefill", JSON.stringify({
        title: `Project with ${creatorName}`,
        collaboratorId: creatorId,
      }));
    } catch { /* ignore */ }
    onOpenChange(false);
    navigate(`/messages?tab=projects&new=1`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[92vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            {selectedTier
              ? `Subscribing to ${creatorName}`
              : tipCheckoutOpen
                ? `Tipping ${creatorName}`
                : `Support ${creatorName}`}
          </DialogTitle>
          <DialogDescription className="text-xs flex items-center justify-between gap-2">
            <span>
              {selectedTier
                ? "Complete payment to unlock instantly."
                : tipCheckoutOpen
                  ? `Sending $${tipAmount.toFixed(2)} as a one-off tip.`
                  : "Pick how you want to back this creator."}
            </span>
            {!selectedTier && !tipCheckoutOpen && (
              <Link
                to={`/profiles/${creatorId}`}
                onClick={() => onOpenChange(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 shrink-0"
              >
                View profile <ArrowRight className="h-3 w-3" />
              </Link>
            )}
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
        ) : tipCheckoutOpen ? (
          <div className="flex-1 overflow-y-auto">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: fetchTipClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
            <div className="px-6 py-3 border-t border-border/40">
              <Button variant="ghost" size="sm" onClick={() => setTipCheckoutOpen(false)} className="w-full">
                ← Back to options
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as SupportTab)} className="flex-1 flex flex-col min-h-0">
            <TabsList className={cn("mx-6", token ? "grid grid-cols-3" : "grid grid-cols-2")}>
              <TabsTrigger value="work" className="gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Work together
              </TabsTrigger>
              <TabsTrigger value="subscribe" className="gap-1.5">
                <Heart className="h-3.5 w-3.5" /> Subscribe & Tip
              </TabsTrigger>
              {token && (
                <TabsTrigger value="trade" className="gap-1.5">
                  <Coins className="h-3.5 w-3.5" /> Trade
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex-1 overflow-y-auto px-4 pb-5 pt-3">
              {/* ─── WORK TOGETHER ───────────────────────────────── */}
              <TabsContent value="work" className="mt-0 space-y-2.5">
                {/* Commission */}
                <button
                  type="button"
                  onClick={handleCommission}
                  className="w-full text-left rounded-xl border border-border bg-card/60 hover:bg-card hover:border-foreground/40 p-4 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Briefcase className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground flex items-center justify-between">
                        Commission a project
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Brief, scope, milestones, escrow — Rhozeland's full project flow with {creatorName}.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Spaces */}
                {spaces.length > 0 ? (
                  <div className="rounded-xl border border-border bg-card/60 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      <p className="text-sm font-semibold">Book one of their spaces</p>
                    </div>
                    <div className="space-y-1.5">
                      {spaces.map((s: any) => (
                        <Link
                          key={s.id}
                          to={`/spaces/${s.id}`}
                          onClick={() => onOpenChange(false)}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-sm text-foreground truncate">{s.name}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {s.hourly_rate ? `$${s.hourly_rate}/hr` : "View"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyHint icon={Building2} label="No spaces listed yet" />
                )}

                {/* Events */}
                {events.length > 0 ? (
                  <div className="rounded-xl border border-border bg-card/60 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      <p className="text-sm font-semibold">Attend an upcoming event</p>
                    </div>
                    <div className="space-y-1.5">
                      {events.map((e: any) => (
                        <Link
                          key={e.id}
                          to={`/events/${e.id}`}
                          onClick={() => onOpenChange(false)}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-sm text-foreground truncate">{e.title}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                            {new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            {e.price ? ` · $${e.price}` : " · Free"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyHint icon={CalendarDays} label="No upcoming events" />
                )}

                <p className="text-[10px] text-center text-muted-foreground pt-2">
                  Platform fee is tier-based (7–15%). The rest goes straight to {creatorName}.
                </p>
              </TabsContent>

              {/* ─── SUBSCRIBE & TIP ─────────────────────────────── */}
              <TabsContent value="subscribe" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Recurring</p>
                  {tiers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handlePick(t.id)}
                      disabled={loadingTier === t.id}
                      className={cn(
                        "group w-full text-left rounded-xl border p-3 transition-all",
                        "bg-card/60 hover:border-foreground/40 hover:bg-card",
                        t.popular && "border-primary/50 ring-1 ring-primary/30",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
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
                                  Popular
                                </span>
                              )}
                            </p>
                            <p className="text-sm font-display font-semibold">
                              ${t.price}<span className="text-[10px] text-muted-foreground font-normal">/mo</span>
                            </p>
                          </div>
                          <ul className="mt-1.5 space-y-0.5">
                            {t.perks.slice(0, 2).map((p) => (
                              <li key={p} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
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
                </div>

                <div className="space-y-2 pt-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">One-time tip</p>
                  <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2.5">
                    <div className="grid grid-cols-4 gap-1.5">
                      {TIP_PRESETS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTipAmount(amt)}
                          className={cn(
                            "rounded-lg border h-9 text-sm font-display font-semibold transition-all",
                            tipAmount === amt
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-background/40 hover:border-foreground/30",
                          )}
                        >
                          ${amt}
                        </button>
                      ))}
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        <input
                          type="number"
                          min={1} max={500}
                          value={tipAmount}
                          onChange={(e) => setTipAmount(Number(e.target.value) || 0)}
                          className="w-full h-9 rounded-lg border border-border bg-background pl-5 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                        />
                      </div>
                    </div>
                    <Button onClick={handleStartTip} size="sm" className="w-full">
                      <Heart className="h-3.5 w-3.5 mr-1.5" />
                      Tip ${Number.isFinite(tipAmount) ? tipAmount.toFixed(2) : "0.00"}
                    </Button>
                  </div>
                </div>

                <p className="text-[10px] text-center text-muted-foreground">
                  {creatorName} keeps 85%. Rhozeland 15%. Tax calculated at checkout.
                </p>
              </TabsContent>

              {/* ─── TRADE ───────────────────────────────────────── */}
              {token && (
                <TabsContent value="trade" className="mt-0">
                  <CreatorTokenPanel mint={token.mint} ticker={token.ticker} creatorName={creatorName} />
                </TabsContent>
              )}
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

const EmptyHint = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-3 flex items-center gap-2">
    <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
    <span className="text-[11px] text-muted-foreground">{label}</span>
  </div>
);

/**
 * CreditShopPage — `/credits` (Creator Pass)
 *
 * v8: Subscriptions killed. Tiers are earned only — by holding $RHOZE
 * OR ecosystem activity (posts, projects, listings, events, interactions).
 * The old `/rewards` page is folded back inline as the "How rewards
 * work" tab so back-nav from Discover always lands you back on Creator
 * Pass instead of bouncing around.
 *
 * Tabs: My Pass · Tiers · How rewards work · Verified IP · Purchases
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Coins, Sparkles, Check, Wallet, ShoppingBag, Download, Music, Info, Shield,
  Award, Palette, Camera, Video, PenTool, ExternalLink, Star, Heart, Trophy,
  HelpCircle, Ticket,
} from "lucide-react";
import TicketsTab from "@/components/credits/TicketsTab";
import { format } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import CreatorPassCard from "@/components/creators/CreatorPassCard";
import TierMatrix from "@/components/creators/TierMatrix";
import CoinPortfolio from "@/components/creators/CoinPortfolio";
import { StreakCard } from "@/components/creators/StreakCard";
import { REWARDS_BY_LANE } from "@/lib/rewards-catalog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const CAT_ICONS: Record<string, any> = {
  music: Music, design: Palette, photo: Camera, video: Video, writing: PenTool,
};

const RHOZE_CA = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const PUMP_FUN_URL = `https://pump.fun/coin/${RHOZE_CA}`;

const CreditShopPage = () => {
  const { user } = useAuth();
  if (!user) {
    // Guests see the same earned-tier story.
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Creator Pass</h1>
          <p className="text-muted-foreground">Tiers unlock by holding $RHOZE or showing up — no subscriptions.</p>
        </div>
        <TierMatrix />
        <div className="text-center">
          <Link to="/auth">
            <Button>Sign in to start earning</Button>
          </Link>
        </div>
      </div>
    );
  }
  return <AuthenticatedCreditShopPage user={user} />;
};

const AuthenticatedCreditShopPage = ({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) => {
  const [searchParams, setSearchParams] = useSearchParams();
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Creator Pass</h1>
            <p className="text-muted-foreground">Earned tiers — hold $RHOZE or show up. No subscriptions.</p>
          </div>
          <div className="surface-card flex items-center gap-3 px-5 py-3">
            <Coins className="h-5 w-5 text-primary" />
            <div>
              <p className="font-display text-lg font-bold text-foreground capitalize">{currentTier}</p>
              <p className="text-xs text-muted-foreground">Current Tier</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pass" className="gap-1.5"><Award className="h-3.5 w-3.5" /> My Pass</TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5"><Ticket className="h-3.5 w-3.5" /> Tickets</TabsTrigger>
          <TabsTrigger value="tiers" className="gap-1.5"><Star className="h-3.5 w-3.5" /> Tiers</TabsTrigger>
          <TabsTrigger value="how" className="gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> How rewards work</TabsTrigger>
          <TabsTrigger value="works" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Verified IP</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5"><ShoppingBag className="h-3.5 w-3.5" /> Purchases</TabsTrigger>
        </TabsList>

        {/* ═══════ My Pass ═══════ */}
        <TabsContent value="pass" className="mt-4 space-y-4">
          <CreatorPassCard />
          <StreakCard />
          <CoinPortfolio />
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-4">
          <TicketsTab userId={user.id} />
        </TabsContent>

        {/* ═══════ Tiers (replaces old paid Plans) ═══════ */}
        <TabsContent value="tiers" className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-foreground">Tier eligibility</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Hold $RHOZE to climb. Tier upgrades the moment your balance crosses
              a threshold — no subscriptions, no applications.
            </p>
          </div>
          <TierMatrix activeTier={currentTier as any} />
        </TabsContent>

        {/* ═══════ How rewards work — inlined from old /rewards page ═══════ */}
        <TabsContent value="how" className="mt-4 space-y-6">
          <RewardsExplainer />
        </TabsContent>

        {/* ═══════ Verified IP ═══════ */}
        <TabsContent value="works" className="mt-4 space-y-6">
          <VerifiedIPSection userId={user?.id ?? null} />
        </TabsContent>

        {/* ═══════ Purchases / Buy $RHOZE ═══════ */}
        <TabsContent value="purchases" className="mt-4 space-y-6">
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
              {purchasesLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : !purchases?.length ? (
                <div className="text-center py-12 space-y-4">
                  <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <p className="text-muted-foreground">No purchases yet</p>
                  <Link to="/discover">
                    <Button variant="outline" className="rounded-full">Browse Discover</Button>
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
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ─── How rewards work — inlined explainer (was /rewards) ─── */
const RewardsExplainer = () => (
  <div className="space-y-8">
    <header className="space-y-2">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/15 px-3 py-1">
        <Coins className="h-3 w-3 text-primary" />
        <span className="text-[11px] font-medium text-primary tracking-wide uppercase">Optional layer</span>
      </div>
      <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight text-foreground">
        $RHOZE rewards the people who show up.
      </h2>
      <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
        You don't need a token to use Rhozeland. But if you post work, support
        artists, and complete milestones, $RHOZE accrues — usable for bookings,
        marketplace, or held to climb tiers.
      </p>
    </header>

    {/* Three-line explainer */}
    <section className="grid sm:grid-cols-3 gap-3">
      {[
        { icon: Sparkles, title: "Earn by contributing", desc: "Posting, reviewing, milestones, streaks. All admin-approved." },
        { icon: Shield, title: "Yours to keep", desc: "Bind a Solana wallet to claim on-chain. No wallet? Credits stay parked." },
        { icon: Coins, title: "Use it or hold it", desc: "Pay for bookings at a discount, unlock higher tiers, or hold long-term." },
      ].map((item) => (
        <div key={item.title} className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-4">
          <item.icon className="h-4 w-4 text-primary mb-2" />
          <h3 className="font-display text-sm font-semibold text-foreground mb-1">{item.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
        </div>
      ))}
    </section>

    {/* Earning catalog */}
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-lg font-semibold text-foreground">How you earn</h3>
      </div>
      {[
        {
          key: "connect" as const,
          icon: Heart,
          title: "Connect",
          subtitle: "Engage with artists and the community.",
        },
        {
          key: "build" as const,
          icon: Trophy,
          title: "Build",
          subtitle: "Run Spaces, projects, and your creative footprint.",
        },
      ].map(({ key, icon: Icon, title, subtitle }) => (
        <div key={key} className="rounded-2xl border border-border/50 bg-card/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <h4 className="font-display text-sm font-semibold">{title}</h4>
            <span className="text-[11px] text-muted-foreground">· {subtitle}</span>
          </div>
          <ul className="divide-y divide-border/40">
            {REWARDS_BY_LANE[key].map((r) => (
              <li key={r.action} className="py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-primary whitespace-nowrap">{r.amount}</p>
                    {r.cap && <p className="text-[10px] text-muted-foreground whitespace-nowrap">{r.cap}</p>}
                  </div>
                </div>
                {r.detail && (
                  <details className="mt-1 group">
                    <summary className="text-[11px] text-muted-foreground/80 hover:text-foreground cursor-pointer list-none select-none inline-flex items-center gap-1">
                      <span className="group-open:hidden underline underline-offset-2">Learn more</span>
                      <span className="hidden group-open:inline underline underline-offset-2">Hide</span>
                    </summary>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed border-l-2 border-border/60 pl-2">
                      {r.detail}
                    </p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>

    {/* FAQ */}
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        <h3 className="font-display text-lg font-semibold text-foreground">Quick FAQ</h3>
      </div>
      <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 px-4 sm:px-5">
        <Accordion type="single" collapsible>
          <AccordionItem value="claim" className="border-border/40">
            <AccordionTrigger className="text-sm font-medium">How do I claim what I've earned?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              Earnings sit as credits until an admin approves them — keeps the
              reward pool honest. Once approved, bind a Solana wallet in{" "}
              <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">Settings</Link>{" "}
              and claim on-chain from <strong>My Pass</strong>.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="splits" className="border-border/40">
            <AccordionTrigger className="text-sm font-medium">How do paid project splits work?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              Paid projects use a 75 / 15 / 10 split: creator, collaborators,
              platform. Splits are configured at lock and anchored on-chain so
              nobody can quietly rewrite them mid-project.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="wallet" className="border-border/40">
            <AccordionTrigger className="text-sm font-medium">Do I need a wallet?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              No. Discovery, conversations, projects, and bookings all work
              with a regular account. A wallet only matters to claim $RHOZE
              on-chain or mint Verified IP.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="revoke" className="last:border-b-0">
            <AccordionTrigger className="text-sm font-medium">Can rewards be revoked?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              Approved on-chain claims are yours. Pending credits can be
              rejected if flagged (spam, duplicate, fake engagement). Reasoning
              is always logged in your reward history.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  </div>
);

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
              {tx.amount > 0 ? "+" : ""}{Math.abs(tx.amount).toFixed(0)} cr
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

import { useState } from "react";

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
          travels with the work everywhere it goes.
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

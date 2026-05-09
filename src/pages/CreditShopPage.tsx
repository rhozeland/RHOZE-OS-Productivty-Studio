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
import { useState } from "react";
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
  HelpCircle, Ticket, TrendingUp,
} from "lucide-react";
import TicketsTab from "@/components/credits/TicketsTab";
import RewardsExplainerV2 from "@/components/credits/RewardsExplainerV2";
import VerifiedIPHub from "@/components/credits/VerifiedIPHub";
import BuyRhozeSection from "@/components/credits/BuyRhozeSection";
import { RhozeInfoPopover } from "@/components/RhozeInfoPopover";
import { format, formatDistanceToNow } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import CreatorPassCard from "@/components/creators/CreatorPassCard";
import NextStepCard from "@/components/creators/NextStepCard";
import GettingStartedBanner from "@/components/creators/GettingStartedBanner";
import TierMatrix from "@/components/creators/TierMatrix";
import TierProgressCard from "@/components/creators/TierProgressCard";
import CoinPortfolio from "@/components/creators/CoinPortfolio";
import { StreakCard } from "@/components/creators/StreakCard";

const CAT_ICONS: Record<string, any> = {
  music: Music, design: Palette, photo: Camera, video: Video, writing: PenTool,
};


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
            <p className="text-muted-foreground inline-flex items-center gap-1.5">
              Earned tiers — hold <span className="font-medium">$RHOZE</span>
              <RhozeInfoPopover size={13} /> or show up. No subscriptions.
            </p>
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

      <RhozeIntroCard />

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pass" className="gap-1.5"><Award className="h-3.5 w-3.5" /> My Pass</TabsTrigger>
          <TabsTrigger value="tiers" className="gap-1.5"><Star className="h-3.5 w-3.5" /> Tiers</TabsTrigger>
          <TabsTrigger value="how" className="gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> How rewards work</TabsTrigger>
          <TabsTrigger value="works" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Verified IP</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5"><ShoppingBag className="h-3.5 w-3.5" /> Purchases</TabsTrigger>
        </TabsList>

        {/* ═══════ My Pass ═══════ */}
        <TabsContent value="pass" className="mt-4 space-y-4">
          <NextStepCard />
          <TierProgressCard />
          <CreatorPassCard />
          <GettingStartedBanner />
          <StreakCard />
          <EarnHistory userId={user.id} />
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
          <TierProgressCard />
          <TierMatrix activeTier={currentTier as any} />
        </TabsContent>

        {/* ═══════ How rewards work — inlined from old /rewards page ═══════ */}
        <TabsContent value="how" className="mt-4 space-y-6">
          <RewardsExplainerV2 />
        </TabsContent>

        {/* ═══════ Verified IP ═══════ */}
        <TabsContent value="works" className="mt-4 space-y-6">
          <VerifiedIPHub userId={user?.id ?? null} />
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
            <BuyRhozeSection />
          )}
        </TabsContent>
      </Tabs>
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
              {tx.amount > 0 ? "+" : ""}{Math.abs(tx.amount).toFixed(0)} cr
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};



/* ─── Intro card explaining $RHOZE — sits at the top of Creator Pass ─── */
const RhozeIntroCard = () => (
  <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-5 sm:p-6 space-y-3">
    <div className="flex items-start gap-2">
      <Coins className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <p className="text-sm leading-relaxed">
        <span className="font-semibold text-foreground">What is $RHOZE? </span>
        <span className="text-muted-foreground">
          Rhozeland's currency — earned by creating, attending events, and collaborating.
        </span>
      </p>
    </div>
    <div className="flex items-start gap-2">
      <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <p className="text-sm leading-relaxed">
        <span className="font-semibold text-foreground">How to earn more: </span>
        <span className="text-muted-foreground">
          Post work · Attend events · Complete collabs · Maintain streaks
        </span>
      </p>
    </div>
    <div className="flex items-start gap-2">
      <Wallet className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <p className="text-sm leading-relaxed">
        <span className="font-semibold text-foreground">What to spend it on: </span>
        <span className="text-muted-foreground">
          Rhozeland services · Hold to level up · Cash out to wallet
        </span>
      </p>
    </div>
  </div>
);

/* ─── Earn History — log of every $RHOZE earn event ─── */
const EarnHistory = ({ userId }: { userId: string }) => {
  const { data: earns, isLoading } = useQuery({
    queryKey: ["rhoze-earn-history", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("id, amount, description, type, created_at")
        .eq("user_id", userId)
        .gt("amount", 0)
        .neq("type", "claim")
        .order("created_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
  });

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold text-foreground">Earn History</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">
          Every time you earned $RHOZE
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : earns && earns.length > 0 ? (
        <ul className="divide-y divide-border/60">
          {earns.map((tx: any) => (
            <li key={tx.id} className="flex items-center gap-3 py-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Coins className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {tx.description || "Earned $RHOZE"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                </p>
              </div>
              <span className="text-sm font-semibold text-primary whitespace-nowrap">
                +{Math.abs(Number(tx.amount)).toLocaleString()} $RHOZE
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No earnings yet. Post work, attend an event, or join a collab to start
          earning $RHOZE.
        </p>
      )}
    </div>
  );
};

export default CreditShopPage;

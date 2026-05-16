/**
 * CreditShopPage — `/credits` (Creator Pass)
 *
 * v8.10:
 *  • My Pass condensed: drop the long Earn History block + portfolio table
 *    and the redundant Getting Started banner. Show a small recent-activity
 *    preview that links into the new Activity tab.
 *  • New Portfolio tab — surfaces CoinPortfolio so tokens-launched links
 *    from the Creator Pass card route here. (Profile pages still have
 *    their own portfolio surface.)
 *  • Purchases tab → Activity. Unified ledger of every $RHOZE credit/debit
 *    (earns + spends) with All / Earned / Spent filter chips. Purchases
 *    with downloadable files retain their detail card below the list.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Coins, Sparkles, Wallet, ShoppingBag, Download, Music, Shield,
  Award, Palette, Camera, Video, PenTool, Star, HelpCircle, ArrowRight,
  Activity as ActivityIcon, Briefcase, TrendingUp, ArrowUpRight, ArrowDownRight,
  Ticket as TicketIcon,
} from "lucide-react";
import RewardsExplainerV2 from "@/components/credits/RewardsExplainerV2";
import VerifiedIPHub from "@/components/credits/VerifiedIPHub";
import BuyRhozeSection from "@/components/credits/BuyRhozeSection";

import { format, formatDistanceToNow } from "date-fns";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CreatorPassCard from "@/components/creators/CreatorPassCard";
import NextStepCard from "@/components/creators/NextStepCard";
import TierMatrix from "@/components/creators/TierMatrix";
import TierStripCompact from "@/components/creators/TierStripCompact";
import TierProgressCard from "@/components/creators/TierProgressCard";
import CoinPortfolio from "@/components/creators/CoinPortfolio";
import TicketsTab from "@/components/credits/TicketsTab";

import { cn } from "@/lib/utils";

const CAT_ICONS: Record<string, any> = {
  music: Music, design: Palette, photo: Camera, video: Video, writing: PenTool,
};

const CreditShopPage = () => {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Creator Pass</h1>
          <p className="text-muted-foreground">Tiers unlock by holding $RHOZE or showing up — no subscriptions.</p>
        </div>
        <TierMatrix />
        <div className="text-center">
          <Link to="/auth"><Button>Sign in to start earning</Button></Link>
        </div>
      </div>
    );
  }
  return <AuthenticatedCreditShopPage user={user} />;
};

const AuthenticatedCreditShopPage = ({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  // Legacy redirects: `tiers` → My Pass; `tickets` → new Passport tab.
  const activeTab =
    rawTab === "tiers" ? "pass"
    : rawTab === "tickets" ? "passport"
    : (rawTab || "pass");

  const { data: userCredits } = useQuery({
    queryKey: ["user-credits", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_credits").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const LEGACY_TIER_MAP: Record<string, string> = { bronze: "spark", gold: "bloom", diamond: "glow", prism: "play" };
  const rawTier = userCredits?.tier && userCredits.tier !== "none" ? userCredits.tier : "spark";
  const currentTier = LEGACY_TIER_MAP[rawTier] || rawTier;

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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pass" className="gap-1.5"><Award className="h-3.5 w-3.5" /> My Pass</TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Portfolio</TabsTrigger>
          <TabsTrigger value="passport" className="gap-1.5"><TicketIcon className="h-3.5 w-3.5" /> Passport</TabsTrigger>
          <TabsTrigger value="works" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Verified IP</TabsTrigger>
          <TabsTrigger value="topup" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Top up</TabsTrigger>
        </TabsList>

        {/* ═══════ My Pass — now also surfaces the full tier matrix ═══════ */}
        <TabsContent value="pass" className="mt-4 space-y-4">
          <NextStepCard />
          <CreatorPassCard />
          <TierProgressCard />
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-semibold text-foreground">All tiers</h3>
              <span className="text-[10px] text-muted-foreground/70 ml-1">Hover for perks</span>
            </div>
          </div>
          <TierStripCompact activeTier={currentTier as any} />
          <ActivityPreview userId={user.id} onSeeAll={() => setTab("activity")} />

          {/* Subtle "How rewards work" footer — collapsible */}
          <details className="group rounded-2xl border border-border/50 bg-card/40 mt-4">
            <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none text-sm text-muted-foreground hover:text-foreground transition-colors">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>How rewards work</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider opacity-60 group-open:hidden">Open</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider opacity-60 hidden group-open:inline">Close</span>
            </summary>
            <div className="px-4 pb-5 pt-1">
              <RewardsExplainerV2 />
            </div>
          </details>
        </TabsContent>

        {/* ═══════ Portfolio ═══════ */}
        <TabsContent value="portfolio" className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-foreground">Portfolio</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Every artist coin you hold. Tap a row to trade, top up, or view the artist.
            </p>
          </div>
          <CoinPortfolio />
        </TabsContent>

        {/* ═══════ Passport — event tickets + spaces visited ═══════ */}
        <TabsContent value="passport" className="mt-4 space-y-6">
          <button
            type="button"
            onClick={() => setTab("pass")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to My Pass
          </button>
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-foreground">Passport</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Every event you've registered for and every space you've visited — your portfolio of places and moments.
            </p>
          </div>
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
              <TicketIcon className="h-4 w-4 text-muted-foreground" /> Events
            </h3>
            <TicketsTab userId={user.id} />
          </section>
          <SpacesPassportSection userId={user.id} />
        </TabsContent>

        {/* ═══════ Verified IP ═══════ */}
        <TabsContent value="works" className="mt-4 space-y-6">
          <VerifiedIPHub userId={user?.id ?? null} />
        </TabsContent>

        {/* ═══════ Activity — pure ledger, no buy module ═══════ */}
        <TabsContent value="activity" className="mt-4 space-y-4">
          <ActivityBackButton />
          <ActivityFeed userId={user.id} />
        </TabsContent>

        {/* ═══════ Top up — buy/swap $RHOZE in its own surface ═══════ */}
        <TabsContent value="topup" className="mt-4 space-y-6">
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-foreground">Top up $RHOZE</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Buy $RHOZE with card or crypto to unlock tiers, back creators, and trade artist coins.
            </p>
          </div>
          <BuyRhozeSection />
        </TabsContent>

        {/* ═══════ How it works ═══════ */}
        <TabsContent value="how" className="mt-4 space-y-6">
          <RewardsExplainerV2 />
        </TabsContent>
      </Tabs>
    </div>
  );
};


/* ─────────────── Activity preview (My Pass) ─────────────── */
const ActivityPreview = ({ userId, onSeeAll }: { userId: string; onSeeAll: () => void }) => {
  const { data: recent } = useQuery({
    queryKey: ["activity-preview", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("id, amount, description, type, created_at, payment_method")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  if (!recent || recent.length === 0) return null;

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold text-foreground">Recent activity</h3>
        <button
          onClick={onSeeAll}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          View all <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <ul className="divide-y divide-border/60">
        {recent.map((tx: any) => <ActivityRow key={tx.id} tx={tx} compact />)}
      </ul>
    </div>
  );
};


/* ─────────────── Unified Activity feed (Activity tab) ─────────────── */
type FilterMode = "all" | "earned" | "spent";

const ActivityFeed = ({ userId }: { userId: string }) => {
  const [filter, setFilter] = useState<FilterMode>("all");

  const { data: txs, isLoading } = useQuery({
    queryKey: ["activity-feed", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("id, amount, description, type, created_at, payment_method")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  // Purchase detail (with downloadable media) for the buy-with-files view.
  const { data: purchases } = useQuery({
    queryKey: ["my-purchases-activity", userId],
    queryFn: async () => {
      const { data } = await supabase.from("purchases" as any).select("*").eq("buyer_id", userId).order("created_at", { ascending: false }).limit(20);
      return (data as any[]) ?? [];
    },
  });
  const purchaseListingIds = purchases?.map((p: any) => p.listing_id) ?? [];
  const { data: purchaseListings } = useQuery({
    queryKey: ["purchased-listings-activity", purchaseListingIds],
    queryFn: async () => {
      const { data } = await supabase.from("marketplace_listings").select("*").in("id", purchaseListingIds);
      return data ?? [];
    },
    enabled: purchaseListingIds.length > 0,
  });
  const { data: purchaseMedia } = useQuery({
    queryKey: ["purchased-media-activity", purchaseListingIds],
    queryFn: async () => {
      const { data } = await supabase.from("listing_media").select("*").in("listing_id", purchaseListingIds).order("sort_order");
      return data ?? [];
    },
    enabled: purchaseListingIds.length > 0,
  });
  const purchaseListingsMap = new Map(purchaseListings?.map((l) => [l.id, l]) ?? []);
  const purchaseMediaMap = new Map<string, any[]>();
  purchaseMedia?.forEach((m) => {
    if (!purchaseMediaMap.has(m.listing_id)) purchaseMediaMap.set(m.listing_id, []);
    purchaseMediaMap.get(m.listing_id)!.push(m);
  });

  const filtered = useMemo(() => {
    if (!txs) return [];
    if (filter === "earned") return txs.filter((t: any) => Number(t.amount) > 0);
    if (filter === "spent") return txs.filter((t: any) => Number(t.amount) < 0);
    return txs;
  }, [txs, filter]);

  const totals = useMemo(() => {
    const earned = (txs ?? []).filter((t: any) => Number(t.amount) > 0).reduce((s: number, t: any) => s + Number(t.amount), 0);
    const spent = (txs ?? []).filter((t: any) => Number(t.amount) < 0).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
    return { earned, spent };
  }, [txs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Activity</h2>
          <p className="text-sm text-muted-foreground">Every $RHOZE earned, spent, or claimed — in one place.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span className="tabular-nums font-semibold">+{totals.earned.toLocaleString()}</span> earned
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <ArrowDownRight className="h-3.5 w-3.5" />
            <span className="tabular-nums font-semibold">{totals.spent.toLocaleString()}</span> spent
          </span>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {(["all", "earned", "spent"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-all",
              filter === f ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Unified ledger */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card text-center py-12 space-y-3">
          <ActivityIcon className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No activity yet</p>
          <Link to="/discover">
            <Button variant="outline" size="sm" className="rounded-full">Browse Discover</Button>
          </Link>
        </div>
      ) : (
        <div className="surface-card divide-y divide-border">
          {filtered.map((tx: any) => <ActivityRow key={tx.id} tx={tx} />)}
        </div>
      )}

      {/* Purchases with downloadable files */}
      {purchases && purchases.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="font-display text-base font-semibold text-foreground inline-flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" /> Files & downloads
          </h3>
          {purchases.map((purchase: any) => {
            const listing = purchaseListingsMap.get(purchase.listing_id);
            const media = purchaseMediaMap.get(purchase.listing_id) ?? [];
            if (media.length === 0) return null;
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
                      <p className="text-xs text-muted-foreground">{format(new Date(purchase.created_at), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1 flex-shrink-0"><Coins className="h-3 w-3" />{purchase.credits_paid}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {media.map((m: any) => (
                    <a key={m.id} href={m.file_url} download={m.file_name} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs text-primary hover:bg-muted/80 transition-colors">
                      <Download className="h-3 w-3" />{m.file_name}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


/* ─── A single ledger row, used in both preview + full feed ─── */
const ActivityRow = ({ tx, compact = false }: { tx: any; compact?: boolean }) => {
  const amount = Number(tx.amount);
  const isEarn = amount > 0;
  const Icon = isEarn ? ArrowUpRight : ArrowDownRight;
  const label =
    tx.payment_method === "crypto" ? "Crypto"
    : tx.payment_method === "card" ? "Card"
    : tx.type === "claim" ? "Claim"
    : tx.type === "subscription" ? "Subscription"
    : tx.type === "refund" ? "Refund"
    : isEarn ? "Earn" : "Spend";

  return (
    <div className={cn("flex items-center gap-3", compact ? "py-2.5" : "px-4 py-3")}>
      <div
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
          isEarn
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {tx.description || (isEarn ? "Earned $RHOZE" : "Spent $RHOZE")}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
            {label}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
      <span className={cn(
        "text-sm font-semibold whitespace-nowrap tabular-nums",
        isEarn ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
      )}>
        {isEarn ? "+" : "−"}{Math.abs(amount).toLocaleString()} $RHOZE
      </span>
    </div>
  );
};

const ActivityBackButton = () => {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        if (window.history.length > 1) navigate(-1);
        else navigate("/vault");
      }}
      className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
};

export default CreditShopPage;

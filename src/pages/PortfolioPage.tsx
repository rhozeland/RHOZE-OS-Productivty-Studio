/**
 * PortfolioPage — `/portfolio`
 *
 * v10.4: Promoted to a top-level sidebar destination. Houses everything that
 * used to clutter the Creator Pass page — Passport (event tickets + spaces
 * visited), Verified IP, and Earnings — plus a lightweight wallet token
 * holdings panel for fans that have connected a Solana wallet.
 *
 * Creator Pass keeps only the "gem card" tier surface; this page is the
 * unified inventory of what a user has earned, held, and visited.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Briefcase,
  Ticket as TicketIcon,
  Shield,
  TrendingUp,
  Wallet as WalletIcon,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TicketCollection from "@/components/credits/TicketCollection";
import VerifiedIPHub from "@/components/credits/VerifiedIPHub";
import CreatorEarningsTab from "@/components/credits/CreatorEarningsTab";
import WalletButton from "@/components/WalletButton";

/* ─────────────── Passport · Spaces visited ─────────────── */
const SpacesPassportSection = ({ userId }: { userId: string }) => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["portfolio-spaces", userId],
    queryFn: async () => {
      const { data: bks } = await supabase
        .from("studio_bookings")
        .select("id, status, start_time, end_time, studio_id, total_price")
        .eq("user_id", userId)
        .not("status", "in", "(cancelled,declined)")
        .order("start_time", { ascending: false });
      const ids = Array.from(new Set((bks ?? []).map((b: any) => b.studio_id)));
      if (!ids.length) return [];
      const { data: studios } = await supabase
        .from("studios")
        .select("id, name, location, cover_url")
        .in("id", ids);
      const m = new Map((studios ?? []).map((s: any) => [s.id, s]));
      return (bks ?? []).map((b: any) => ({ ...b, studio: m.get(b.studio_id) }));
    },
  });

  if (isLoading) return <div className="h-24 animate-pulse rounded-xl bg-muted/40" />;
  if (rows.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" /> Spaces visited
        </h3>
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            No spaces booked yet — they'll appear here on the day of your booking.
          </p>
          <Link
            to="/discover?kind=space"
            className="inline-flex items-center gap-1 text-xs text-foreground hover:underline mt-2"
          >
            Browse spaces <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" /> Spaces visited
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((r: any) => (
          <Link
            key={r.id}
            to={`/studios/${r.studio_id}`}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-foreground/30 transition-colors"
          >
            {r.studio?.cover_url ? (
              <img
                src={r.studio.cover_url}
                alt=""
                className="h-14 w-14 rounded-xl object-cover shrink-0"
              />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-muted shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {r.studio?.name ?? "Space"}
              </p>
              {r.studio?.location && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {r.studio.location}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                {new Date(r.start_time).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

/* ─────────────── Token Holdings (wallet-gated) ─────────────── */
const TokenHoldingsSection = () => {
  const { connected, publicKey } = useWallet();

  if (!connected) {
    return (
      <section className="space-y-3">
        <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
          <WalletIcon className="h-4 w-4 text-muted-foreground" /> Creator token holdings
        </h3>
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Connect a Solana wallet to surface every creator token you hold,
            with live prices from pump.fun.
          </p>
          <div className="flex justify-center">
            <WalletButton />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
        <WalletIcon className="h-4 w-4 text-muted-foreground" /> Creator token holdings
      </h3>
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Connected as{" "}
          <span className="font-mono text-foreground">
            {publicKey?.toBase58().slice(0, 4)}…{publicKey?.toBase58().slice(-4)}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          Live holdings sync is rolling out — your pump.fun-linked creator
          tokens will appear here next.
        </p>
      </div>
    </section>
  );
};

/* ─────────────── Backed creators (overview strip) ─────────────── */
const BackedStrip = () => {
  const { user } = useAuth();

  const { data: myProfileId } = useQuery({
    queryKey: ["portfolio-my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as any)?.id as string | undefined;
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["portfolio-subs", myProfileId],
    enabled: !!myProfileId,
    queryFn: async () => {
      const { data } = await supabase
        .from("creator_subscriptions")
        .select("id, creator_id, monthly_price_usd, status")
        .eq("subscriber_id", myProfileId!)
        .eq("status", "active");
      return data ?? [];
    },
  });

  const monthlySpend = useMemo(
    () => subs.reduce((a: number, r: any) => a + Number(r.monthly_price_usd || 0), 0),
    [subs],
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div className="surface-card px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Backing</p>
        <p className="font-display text-2xl font-bold text-foreground">{subs.length}</p>
        <p className="text-[11px] text-muted-foreground">Active subscriptions</p>
      </div>
      <div className="surface-card px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Monthly</p>
        <p className="font-display text-2xl font-bold text-foreground">
          ${monthlySpend.toFixed(0)}
        </p>
        <p className="text-[11px] text-muted-foreground">Recurring USD</p>
      </div>
      <div className="surface-card px-4 py-3 col-span-2 md:col-span-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pass</p>
        <Link
          to="/credits"
          className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:underline"
        >
          View Creator Pass <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <p className="text-[11px] text-muted-foreground">Tier + rewards</p>
      </div>
    </div>
  );
};

/* ─────────────── Page ─────────────── */
const PortfolioPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "passport";

  const setTab = (v: string) => {
    if (v === "passport") searchParams.delete("tab");
    else searchParams.set("tab", v);
    setSearchParams(searchParams, { replace: true });
  };

  if (!user) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <header className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-7 w-7" /> Portfolio
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to see your passport, verified IP, and earnings.
          </p>
        </header>
        <Link to="/auth">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header className="space-y-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-7 w-7" /> Portfolio
          </h1>
          <p className="text-sm text-muted-foreground">
            Your passport, verified IP, earnings, and creator-token holdings — all in one place.
          </p>
        </div>
        <BackedStrip />
      </header>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="passport" className="gap-1.5">
            <TicketIcon className="h-3.5 w-3.5" /> Passport
          </TabsTrigger>
          <TabsTrigger value="works" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Verified IP
          </TabsTrigger>
          <TabsTrigger value="earnings" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Earnings
          </TabsTrigger>
          <TabsTrigger value="tokens" className="gap-1.5">
            <WalletIcon className="h-3.5 w-3.5" /> Tokens
          </TabsTrigger>
        </TabsList>

        <TabsContent value="passport" className="mt-4 space-y-6">
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-foreground">Passport</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Every event you've registered for and every space you've visited.
            </p>
          </div>
          <TicketCollection userId={user.id} />
          <SpacesPassportSection userId={user.id} />
        </TabsContent>

        <TabsContent value="works" className="mt-4 space-y-6">
          <VerifiedIPHub userId={user.id} />
        </TabsContent>

        <TabsContent value="earnings" className="mt-4">
          <CreatorEarningsTab userId={user.id} />
        </TabsContent>

        <TabsContent value="tokens" className="mt-4 space-y-6">
          <TokenHoldingsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortfolioPage;

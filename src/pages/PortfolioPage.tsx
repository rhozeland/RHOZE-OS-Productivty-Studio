/**
 * PortfolioPage — `/portfolio`
 *
 * Pillar 6 cleanup: dropped the BackedStrip hero (Backing/Monthly/Pass
 * counters), the duplicate CreatorTokenHoldings panel above the tabs,
 * the inline DashboardPage feed merge, and the wallet-gated "Token
 * Holdings" section that was just a coming-soon message. The page is
 * now a clean tabbed inventory: Passport · IP · Earnings · Holdings.
 */
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TicketCollection from "@/components/credits/TicketCollection";
import VerifiedIPHub from "@/components/credits/VerifiedIPHub";
import CreatorEarningsTab from "@/components/credits/CreatorEarningsTab";
import CreatorTokenHoldings from "@/components/portfolio/CreatorTokenHoldings";

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
      {/* Minimal header — Pillar 6 dropped the BackedStrip / monthly-spend
          metrics and the duplicate token-holdings panel that used to live
          above the tabs. Numbers people care about now live inline in
          each tab (Passport count, Verified IP count, Earnings totals). */}
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5" /> Your portfolio
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
          Passport · IP · Earnings · Holdings
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Every space you've visited, every work you've fingerprinted, every
          dollar you've earned, and every creator token you hold.
        </p>
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
            <WalletIcon className="h-3.5 w-3.5" /> Holdings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="passport" className="mt-4 space-y-6">
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
          <CreatorTokenHoldings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortfolioPage;

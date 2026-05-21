/**
 * PortfolioPage — `/portfolio` (Fan mode, Prompt 3)
 *
 * Surfaces every creator the signed-in fan has actively subscribed to via
 * `creator_subscriptions` (v10 spine). Layout mirrors existing pages:
 * `font-display` heading, `surface-card` stat strip, and Discover-style
 * creator tiles for the grid. No new tokens or styles introduced.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Briefcase, ArrowRight, Sparkles, TrendingUp, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type BackedRow = {
  id: string;
  creator_id: string;
  created_at: string;
  tier: string;
  monthly_price_usd: number;
  creator: {
    id: string;
    user_id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  rank: number;
  growthSince: number;
};

const PortfolioPage = () => {
  const { user } = useAuth();

  // Resolve the user's profile.id (creator_subscriptions FK target).
  const { data: myProfileId } = useQuery({
    queryKey: ["my-profile-id", user?.id],
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

  // Pull active subscriptions + the creator profile in one shot, then enrich
  // each row with a "Fan #N" position and a growth delta (subscribers added
  // since this fan joined).
  const { data: backed, isLoading } = useQuery({
    queryKey: ["portfolio-backed", myProfileId],
    enabled: !!myProfileId,
    queryFn: async (): Promise<BackedRow[]> => {
      const { data: rows } = await supabase
        .from("creator_subscriptions")
        .select(
          "id, creator_id, created_at, tier, monthly_price_usd, creator:profiles!creator_subscriptions_creator_id_fkey(id, user_id, display_name, username, avatar_url)",
        )
        .eq("subscriber_id", myProfileId!)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      const list = (rows ?? []) as any[];
      const enriched = await Promise.all(
        list.map(async (r) => {
          // Rank = number of earlier-or-equal active subscribers + 1.
          const [{ count: earlier }, { count: after }] = await Promise.all([
            supabase
              .from("creator_subscriptions")
              .select("id", { head: true, count: "exact" })
              .eq("creator_id", r.creator_id)
              .eq("status", "active")
              .lte("created_at", r.created_at),
            supabase
              .from("creator_subscriptions")
              .select("id", { head: true, count: "exact" })
              .eq("creator_id", r.creator_id)
              .eq("status", "active")
              .gt("created_at", r.created_at),
          ]);
          return {
            ...r,
            rank: earlier ?? 1,
            growthSince: after ?? 0,
          } as BackedRow;
        }),
      );
      return enriched;
    },
  });

  // Total earned $RHOZE from reward-type credit transactions.
  const { data: totalEarned } = useQuery({
    queryKey: ["portfolio-earned", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("amount")
        .eq("user_id", user!.id)
        .eq("type", "reward");
      return (data ?? []).reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
    },
  });

  const stats = useMemo(() => {
    const list = backed ?? [];
    const avgRank =
      list.length === 0
        ? 0
        : Math.round(list.reduce((sum, r) => sum + r.rank, 0) / list.length);
    return {
      count: list.length,
      avgRank,
      earned: Math.round(Number(totalEarned ?? 0)),
    };
  }, [backed, totalEarned]);

  return (
    <div className="space-y-8">
      {/* Header — same shape as Creator Pass / Credits page */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Portfolio</h1>
        <p className="text-muted-foreground">Creators you've backed</p>
      </div>

      {/* Stat strip — surface-card pattern reused */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile
          icon={<Briefcase className="h-4 w-4 text-primary" />}
          label="Creators backed"
          value={stats.count.toLocaleString()}
        />
        <StatTile
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          label="Avg. fan rank held"
          value={stats.avgRank ? `#${stats.avgRank}` : "—"}
        />
        <StatTile
          icon={<Coins className="h-4 w-4 text-primary" />}
          label="$RHOZE earned"
          value={stats.earned.toLocaleString()}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="surface-card h-48 animate-pulse" />
          ))}
        </div>
      ) : (backed?.length ?? 0) === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {backed!.map((row) => (
            <BackedCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
};

const StatTile = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="surface-card flex items-center gap-3 px-5 py-4">
    {icon}
    <div>
      <p className="font-display text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
);

const BackedCard = ({ row }: { row: BackedRow }) => {
  const name = row.creator?.display_name || row.creator?.username || "Creator";
  const profileHref = row.creator?.user_id
    ? `/profiles/${row.creator.user_id}`
    : "/discover";

  return (
    <div className="surface-card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={row.creator?.avatar_url ?? undefined} alt={name} />
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-foreground truncate">
            {name}
          </p>
          <p className="text-xs text-muted-foreground">
            Backed {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fan rank</span>
          <span className="font-semibold text-foreground">Fan #{row.rank}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Growth since you joined</span>
          <span className="font-semibold text-foreground">
            {row.growthSince > 0 ? "+" : ""}
            {row.growthSince.toLocaleString()} fans
          </span>
        </div>
      </div>

      <Button asChild variant="outline" size="sm" className="self-end">
        <Link to={profileHref}>
          View <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
};

const EmptyState = () => (
  <div className="surface-card text-center py-12 px-6 space-y-3">
    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
      <Sparkles className="h-5 w-5 text-primary" />
    </div>
    <h2 className="font-display text-xl font-semibold text-foreground">
      You haven't backed anyone yet
    </h2>
    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
      Find a creator rising early and back them before everyone else does
    </p>
    <div className="pt-2">
      <Button asChild>
        <Link to="/creators">Discover Creators</Link>
      </Button>
    </div>
  </div>
);

export default PortfolioPage;

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Inbox,
  Star,
  Package,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { motion } from "framer-motion";

interface ProfileSellerStatsProps {
  userId: string;
  isOwnProfile: boolean;
}

const ProfileSellerStats = ({ userId, isOwnProfile }: ProfileSellerStatsProps) => {
  // Public: total sales count, avg rating, listings count
  const { data: sellerListings } = useQuery({
    queryKey: ["profile-seller-listings", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("id, title, is_active, credits_price")
        .eq("user_id", userId);
      return data || [];
    },
  });

  const { data: salesCount } = useQuery({
    queryKey: ["profile-sales-count", userId],
    queryFn: async () => {
      const { count } = await supabase
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", userId);
      return count ?? 0;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["profile-seller-reviews", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("rating, created_at")
        .eq("seller_id", userId);
      return data || [];
    },
  });

  // Private: earnings, detailed sales, inquiries, contracts
  const { data: earnings } = useQuery({
    queryKey: ["profile-seller-earnings", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("amount, created_at")
        .eq("user_id", userId)
        .eq("type", "sale");
      return data || [];
    },
    enabled: isOwnProfile,
  });

  const { data: sales } = useQuery({
    queryKey: ["profile-seller-sales", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("id, credits_paid, created_at, listing_id")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isOwnProfile,
  });

  const { data: inquiries } = useQuery({
    queryKey: ["profile-seller-inquiries", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("listing_inquiries")
        .select("id, status, created_at")
        .eq("receiver_id", userId);
      return data || [];
    },
    enabled: isOwnProfile,
  });

  const { data: contracts } = useQuery({
    queryKey: ["profile-seller-contracts", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_contracts")
        .select("id, status, total_credits, released_credits, escrowed_credits")
        .eq("specialist_id", userId);
      return data || [];
    },
    enabled: isOwnProfile,
  });

  const activeListings = (sellerListings || []).filter((l) => l.is_active).length;
  const avgRating = (reviews || []).length > 0
    ? Math.round(((reviews || []).reduce((s, r) => s + r.rating, 0) / (reviews || []).length) * 10) / 10
    : 0;

  // If no seller activity at all, don't show this section
  if (activeListings === 0 && (salesCount ?? 0) === 0 && (reviews || []).length === 0) {
    return null;
  }

  // Private stats
  const totalEarnings = (earnings || []).reduce((s, e) => s + Number(e.amount), 0);
  const monthStart = startOfMonth(new Date());
  const monthlyEarnings = (earnings || [])
    .filter((e) => new Date(e.created_at) >= monthStart)
    .reduce((s, e) => s + Number(e.amount), 0);
  const pendingInquiries = (inquiries || []).filter((i) => i.status === "pending").length;
  const activeContracts = (contracts || []).filter((c) => c.status === "active").length;
  const escrowedTotal = (contracts || []).reduce((s, c) => s + Number(c.escrowed_credits), 0);

  // Earnings chart (last 30 days)
  const earningsChart = (() => {
    if (!isOwnProfile) return [];
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM dd");
      days[d] = 0;
    }
    (earnings || []).forEach((e) => {
      const d = format(new Date(e.created_at), "MMM dd");
      if (days[d] !== undefined) days[d] += Number(e.amount);
    });
    return Object.entries(days).map(([date, amount]) => ({ date, amount }));
  })();

  // Public stat cards (visible to everyone)
  const publicStats = [
    { label: "Listings", value: activeListings, icon: Package, accent: "text-primary", bg: "bg-primary/10" },
    { label: "Sales", value: salesCount ?? 0, icon: ShoppingBag, accent: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Avg Rating", value: avgRating > 0 ? `${avgRating} ★` : "—", icon: Star, accent: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Reviews", value: (reviews || []).length, icon: Star, accent: "text-violet-500", bg: "bg-violet-500/10" },
  ];

  // Private stat cards (owner only)
  const privateStats = isOwnProfile
    ? [
        { label: "Total Earnings", value: `${totalEarnings} cr`, icon: DollarSign, accent: "text-emerald-500", bg: "bg-emerald-500/10" },
        { label: "This Month", value: `${monthlyEarnings} cr`, icon: TrendingUp, accent: "text-primary", bg: "bg-primary/10" },
        { label: "Pending Inquiries", value: pendingInquiries, icon: Inbox, accent: "text-orange-500", bg: "bg-orange-500/10" },
        { label: "In Escrow", value: `${escrowedTotal} cr`, icon: DollarSign, accent: "text-cyan-500", bg: "bg-cyan-500/10" },
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
      className="space-y-4"
    >
      <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        {isOwnProfile ? "Seller Dashboard" : "Seller Stats"}
      </h2>

      {/* Public stats — visible to everyone */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {publicStats.map((s) => (
          <div key={s.label} className="rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 p-3.5">
            <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${s.bg} mb-2`}>
              <s.icon className={`h-4 w-4 ${s.accent}`} />
            </div>
            <p className="text-xl font-bold text-foreground tracking-tight">{s.value}</p>
            <p className="text-[10px] text-muted-foreground tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Private stats — owner only */}
      {isOwnProfile && (
        <>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">Your Analytics</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {privateStats.map((s) => (
              <div key={s.label} className="rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 p-3.5">
                <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${s.bg} mb-2`}>
                  <s.icon className={`h-4 w-4 ${s.accent}`} />
                </div>
                <p className="text-xl font-bold text-foreground tracking-tight">{s.value}</p>
                <p className="text-[10px] text-muted-foreground tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Earnings chart */}
          {earningsChart.length > 0 && (
            <div className="rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 p-4">
              <p className="text-sm font-medium text-foreground mb-3">Earnings — Last 30 Days</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={earningsChart}>
                    <defs>
                      <linearGradient id="profileEarnGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} className="text-muted-foreground" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#profileEarnGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent sales + contracts summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Recent sales */}
            <div className="rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 p-4">
              <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> Recent Sales
              </p>
              {(sales || []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No sales yet</p>
              ) : (
                <div className="divide-y divide-border/50 max-h-48 overflow-y-auto">
                  {(sales || []).slice(0, 8).map((sale: any) => {
                    const listing = (sellerListings || []).find((l) => l.id === sale.listing_id);
                    return (
                      <div key={sale.id} className="flex items-center justify-between py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{listing?.title || "Listing"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(sale.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-mono shrink-0 ml-2">
                          +{sale.credits_paid} cr
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Contracts summary */}
            <div className="rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 p-4">
              <p className="text-sm font-medium text-foreground mb-3">Contracts</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <span className="text-sm font-bold text-foreground">{activeContracts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">In Escrow</span>
                  <span className="text-sm font-bold text-foreground">{escrowedTotal} credits</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total Released</span>
                  <span className="text-sm font-bold text-foreground">
                    {(contracts || []).reduce((s: number, c: any) => s + Number(c.released_credits), 0)} credits
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total Value</span>
                  <span className="text-sm font-bold text-foreground">
                    {(contracts || []).reduce((s: number, c: any) => s + Number(c.total_credits), 0)} credits
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default ProfileSellerStats;

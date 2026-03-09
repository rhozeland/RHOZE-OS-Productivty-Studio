import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const SellerDashboardPage = () => {
  const { user } = useAuth();

  // Total earnings (credits received from sales)
  const { data: earnings } = useQuery({
    queryKey: ["seller-earnings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("amount, created_at")
        .eq("user_id", user!.id)
        .eq("type", "sale");
      return data || [];
    },
    enabled: !!user,
  });

  // Purchases (sales to this seller)
  const { data: sales } = useQuery({
    queryKey: ["seller-sales", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("id, credits_paid, created_at, listing_id")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Listings
  const { data: listings } = useQuery({
    queryKey: ["seller-listings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("id, title, is_active, credits_price, created_at")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Inquiries received
  const { data: inquiries } = useQuery({
    queryKey: ["seller-inquiries", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("listing_inquiries")
        .select("id, status, created_at")
        .eq("receiver_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Reviews on seller's listings
  const { data: reviews } = useQuery({
    queryKey: ["seller-reviews", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("rating, created_at")
        .eq("seller_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Contracts
  const { data: contracts } = useQuery({
    queryKey: ["seller-contracts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_contracts")
        .select("id, status, total_credits, released_credits, escrowed_credits")
        .eq("specialist_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Compute stats
  const totalEarnings = (earnings || []).reduce((s, e) => s + Number(e.amount), 0);
  const totalSales = (sales || []).length;
  const activeListings = (listings || []).filter((l) => l.is_active).length;
  const pendingInquiries = (inquiries || []).filter((i) => i.status === "pending").length;
  const totalInquiries = (inquiries || []).length;
  const avgRating =
    (reviews || []).length > 0
      ? (reviews || []).reduce((s, r) => s + r.rating, 0) / (reviews || []).length
      : 0;
  const activeContracts = (contracts || []).filter((c) => c.status === "active").length;
  const escrowedTotal = (contracts || []).reduce((s, c) => s + Number(c.escrowed_credits), 0);

  // Earnings over time (last 30 days)
  const earningsChart = (() => {
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

  // Sales by listing
  const salesByListing = (() => {
    const map: Record<string, { title: string; count: number; revenue: number }> = {};
    (sales || []).forEach((s) => {
      const lid = s.listing_id;
      if (!map[lid]) {
        const listing = (listings || []).find((l) => l.id === lid);
        map[lid] = { title: listing?.title || "Unknown", count: 0, revenue: 0 };
      }
      map[lid].count++;
      map[lid].revenue += Number(s.credits_paid);
    });
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  })();

  // Monthly earnings
  const monthStart = startOfMonth(new Date());
  const monthlyEarnings = (earnings || [])
    .filter((e) => new Date(e.created_at) >= monthStart)
    .reduce((s, e) => s + Number(e.amount), 0);

  const statCards = [
    {
      label: "Total Earnings",
      value: `${totalEarnings} credits`,
      icon: DollarSign,
      accent: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "This Month",
      value: `${monthlyEarnings} credits`,
      icon: TrendingUp,
      accent: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Total Sales",
      value: totalSales,
      icon: ShoppingBag,
      accent: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Active Listings",
      value: activeListings,
      icon: Package,
      accent: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Avg Rating",
      value: avgRating > 0 ? avgRating.toFixed(1) + " ★" : "—",
      icon: Star,
      accent: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Pending Inquiries",
      value: pendingInquiries,
      icon: Inbox,
      accent: "text-orange-500",
      bg: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Seller Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your marketplace performance, earnings, and buyer activity.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className={`inline-flex items-center justify-center h-9 w-9 rounded-lg ${s.bg} mb-2`}>
                <s.icon className={`h-4.5 w-4.5 ${s.accent}`} />
              </div>
              <p className="text-2xl font-bold tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Earnings over time */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Earnings — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningsChart}>
                  <defs>
                    <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="hsl(var(--primary))"
                    fill="url(#earnGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top listings by revenue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Listings</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByListing.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No sales yet</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByListing} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      dataKey="title"
                      type="category"
                      width={100}
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Inquiries + Contracts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inquiry breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Inquiry Stats
              <Badge variant="outline" className="font-normal text-xs">
                {totalInquiries} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Pending", status: "pending", color: "bg-amber-500" },
                { label: "Accepted", status: "accepted", color: "bg-emerald-500" },
                { label: "Declined", status: "declined", color: "bg-destructive" },
              ].map((row) => {
                const count = (inquiries || []).filter((i) => i.status === row.status).length;
                const pct = totalInquiries > 0 ? (count / totalInquiries) * 100 : 0;
                return (
                  <div key={row.status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.color} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Active contracts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Contracts
              <Badge variant="outline" className="font-normal text-xs">
                {activeContracts} active
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Escrow</span>
                <span className="text-lg font-bold">{escrowedTotal} credits</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Released</span>
                <span className="text-lg font-bold">
                  {(contracts || []).reduce((s, c) => s + Number(c.released_credits), 0)} credits
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Contract Value</span>
                <span className="text-lg font-bold">
                  {(contracts || []).reduce((s, c) => s + Number(c.total_credits), 0)} credits
                </span>
              </div>
              {(contracts || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No contracts yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent sales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            Recent Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(sales || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No sales yet — your first sale will show up here!
            </p>
          ) : (
            <div className="divide-y divide-border">
              {(sales || []).slice(0, 10).map((sale) => {
                const listing = (listings || []).find((l) => l.id === sale.listing_id);
                return (
                  <div key={sale.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{listing?.title || "Unknown listing"}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(sale.created_at), "MMM d, yyyy · h:mm a")}
                      </p>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      +{sale.credits_paid} credits
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SellerDashboardPage;

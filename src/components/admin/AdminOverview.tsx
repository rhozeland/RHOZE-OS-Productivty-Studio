import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Briefcase, CalendarCheck, Coins, CheckCircle,
  Store, LayoutGrid, Flame, ShieldCheck, Clock,
} from "lucide-react";
import { toast } from "sonner";

const AdminOverview = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalServices: 0,
    totalBookings: 0,
    totalRevenue: 0,
    totalStudios: 0,
    totalSmartboards: 0,
    totalFlowPosts: 0,
    pendingRewards: 0,
    totalAdmins: 0,
    bannedUsers: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  const fetchData = async () => {
    const [profiles, services, bookings, transactions, studios] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("services").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
      supabase.from("credit_transactions").select("amount"),
      supabase.from("studios").select("id", { count: "exact", head: true }),
    ]);

    const [smartboards, flowItems, pendingRewards, adminRoles, bannedProfiles] = await Promise.all([
      supabase.from("smartboards").select("id", { count: "exact", head: true }),
      supabase.from("flow_items").select("id", { count: "exact", head: true }),
      supabase.from("pending_rewards").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("ban_status" as any, "banned"),
    ]);

    const totalRevenue = (transactions.data || [])
      .reduce((sum, t) => sum + Number(t.amount), 0);

    setStats({
      totalUsers: profiles.count || 0,
      totalServices: services.count || 0,
      totalBookings: bookings.count || 0,
      totalRevenue,
      totalStudios: studios.count || 0,
      totalSmartboards: smartboards.count || 0,
      totalFlowPosts: flowItems.count || 0,
      pendingRewards: pendingRewards.count || 0,
      totalAdmins: adminRoles.count || 0,
      bannedUsers: bannedProfiles.count || 0,
    });

    const { data: recent } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    setRecentBookings(recent || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const confirmBooking = async (bookingId: string) => {
    setConfirming(bookingId);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", bookingId);

    if (error) toast.error("Failed to confirm: " + error.message);
    else { toast.success("Booking confirmed!"); fetchData(); }
    setConfirming(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Admins", value: stats.totalAdmins, icon: ShieldCheck, color: "text-emerald-500" },
    { label: "Banned", value: stats.bannedUsers, icon: Users, color: "text-destructive" },
    { label: "Active Services", value: stats.totalServices, icon: Briefcase, color: "text-blue-500" },
    { label: "Studios", value: stats.totalStudios, icon: Store, color: "text-violet-500" },
    { label: "Bookings", value: stats.totalBookings, icon: CalendarCheck, color: "text-orange-500" },
    { label: "Smartboards", value: stats.totalSmartboards, icon: LayoutGrid, color: "text-cyan-500" },
    { label: "Flow Posts", value: stats.totalFlowPosts, icon: Flame, color: "text-amber-500" },
    { label: "Pending Rewards", value: stats.pendingRewards, icon: Clock, color: "text-yellow-600" },
    { label: "Credits Transacted", value: stats.totalRevenue, icon: Coins, color: "text-yellow-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-[11px] font-medium text-muted-foreground leading-tight">
                {s.label}
              </CardTitle>
              <s.icon className={`h-4 w-4 ${s.color} shrink-0`} />
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <div className="space-y-2">
              {recentBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.start_time).toLocaleDateString()} • {b.duration_hours}h
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        b.status === "confirmed" ? "default" :
                        b.status === "cancelled" ? "destructive" : "outline"
                      }
                      className="capitalize text-[10px]"
                    >
                      {b.status}
                    </Badge>
                    {b.status === "upcoming" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs h-7"
                        disabled={confirming === b.id}
                        onClick={() => confirmBooking(b.id)}
                      >
                        <CheckCircle className="h-3 w-3" />
                        {confirming === b.id ? "..." : "Confirm"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;

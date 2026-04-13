import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Coins, Store, LayoutGrid, Flame, ShieldCheck, Clock,
} from "lucide-react";

const AdminOverview = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStudios: 0,
    totalSmartboards: 0,
    totalFlowPosts: 0,
    pendingRewards: 0,
    totalAdmins: 0,
    bannedUsers: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [profiles, studios, transactions] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("studios").select("id", { count: "exact", head: true }),
      supabase.from("credit_transactions").select("amount"),
    ]);

    const smartboards = await supabase.from("smartboards").select("id", { count: "exact", head: true });
    const flowItems = await supabase.from("flow_items").select("id", { count: "exact", head: true });
    const pendingRewards = await (supabase.from("pending_rewards").select("id", { count: "exact", head: true }) as any).eq("status", "pending");
    const adminRoles = await (supabase.from("user_roles").select("id", { count: "exact", head: true }) as any).eq("role", "admin");
    const bannedProfiles = await (supabase.from("profiles").select("id", { count: "exact", head: true }) as any).eq("ban_status", "banned");

    const totalRevenue = (transactions.data || [])
      .reduce((sum, t) => sum + Number(t.amount), 0);

    setStats({
      totalUsers: profiles.count || 0,
      totalStudios: studios.count || 0,
      totalSmartboards: smartboards.count || 0,
      totalFlowPosts: flowItems.count || 0,
      pendingRewards: pendingRewards.count || 0,
      totalAdmins: adminRoles.count || 0,
      bannedUsers: bannedProfiles.count || 0,
      totalRevenue,
    });

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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
    { label: "Studios", value: stats.totalStudios, icon: Store, color: "text-violet-500" },
    { label: "Smartboards", value: stats.totalSmartboards, icon: LayoutGrid, color: "text-cyan-500" },
    { label: "Flow Posts", value: stats.totalFlowPosts, icon: Flame, color: "text-amber-500" },
    { label: "Pending Rewards", value: stats.pendingRewards, icon: Clock, color: "text-yellow-600" },
    { label: "Credits Transacted", value: stats.totalRevenue, icon: Coins, color: "text-yellow-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-4">
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
    </div>
  );
};

export default AdminOverview;

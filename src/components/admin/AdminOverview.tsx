import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Briefcase, CalendarCheck, Coins, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const AdminOverview = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalServices: 0,
    totalBookings: 0,
    totalRevenue: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  const fetchData = async () => {
    const [profiles, services, bookings, transactions] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("services").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
      supabase.from("credit_transactions").select("amount"),
    ]);

    const totalRevenue = (transactions.data || [])
      .reduce((sum, t) => sum + Number(t.amount), 0);

    setStats({
      totalUsers: profiles.count || 0,
      totalServices: services.count || 0,
      totalBookings: bookings.count || 0,
      totalRevenue,
    });

    const { data: recent } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

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

    if (error) {
      toast.error("Failed to confirm: " + error.message);
    } else {
      toast.success("Booking confirmed — project generated!");
      fetchData();
    }
    setConfirming(null);
  };

  if (loading) {
    return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Active Services", value: stats.totalServices, icon: Briefcase, color: "text-blue-500" },
    { label: "Total Bookings", value: stats.totalBookings, icon: CalendarCheck, color: "text-orange-500" },
    { label: "Credits Transacted", value: stats.totalRevenue, icon: Coins, color: "text-yellow-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.start_time).toLocaleDateString()} • {b.duration_hours}h
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      b.status === "confirmed" ? "default" :
                      b.status === "upcoming" ? "secondary" :
                      b.status === "cancelled" ? "destructive" : "outline"
                    } className="capitalize">
                      {b.status}
                    </Badge>
                    {b.status === "upcoming" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        disabled={confirming === b.id}
                        onClick={() => confirmBooking(b.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
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

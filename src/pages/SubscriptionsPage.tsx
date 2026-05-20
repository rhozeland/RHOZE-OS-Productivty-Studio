import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles, Loader2, Users } from "lucide-react";
import { format } from "date-fns";

export default function SubscriptionsPage() {
  const { user } = useAuth();

  const { data: mySubs, isLoading } = useQuery({
    queryKey: ["my-subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("creator_subscriptions")
        .select("*, creator:profiles!creator_subscriptions_creator_id_fkey(id, username, display_name, avatar_url)")
        .eq("subscriber_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: mySubscribers } = useQuery({
    queryKey: ["my-subscribers", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("creator_subscriptions")
        .select("*, subscriber:profiles!creator_subscriptions_subscriber_id_fkey(id, username, display_name, avatar_url)")
        .eq("creator_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <EmptyState
          icon={Sparkles}
          title="Sign in to view subscriptions"
          description="Track the creators you back and see who backs you."
          cta={{ label: "Sign in", to: "/auth", prominent: true }}
        />
      </div>
    );
  }

  const activeMrr = (mySubscribers ?? [])
    .reduce((sum, s) => sum + Number(s.monthly_price_usd || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      <header>
        <h1 className="font-display text-3xl">Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage who you back and who backs you.
        </p>
      </header>

      {/* Earnings summary (creator side) */}
      {mySubscribers && mySubscribers.length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/8 via-card to-card/40 p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your subscribers</p>
              <p className="font-display text-xl">
                {mySubscribers.length} backers · ${activeMrr}/mo
              </p>
            </div>
          </div>
        </section>
      )}

      {/* My subscriptions (fan side) */}
      <section>
        <h2 className="text-sm font-semibold mb-3">You're subscribed to</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !mySubs || mySubs.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="You're not subscribed to anyone yet"
            description="Find creators on Discover and subscribe to unlock their private feed."
            cta={{ label: "Browse creators", to: "/discover", prominent: true }}
            size="sm"
          />
        ) : (
          <ul className="space-y-2">
            {mySubs.map((s: any) => (
              <li key={s.id} className="rounded-xl border border-border/60 bg-card/60 p-4 flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={s.creator?.avatar_url} />
                  <AvatarFallback>{(s.creator?.display_name || s.creator?.username || "?")[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/profile/${s.creator?.id}`}
                    className="font-medium text-sm hover:underline truncate block"
                  >
                    {s.creator?.display_name || s.creator?.username || "Creator"}
                  </Link>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {s.tier} · ${s.monthly_price_usd}/mo
                    {s.current_period_end && (
                      <> · renews {format(new Date(s.current_period_end), "MMM d")}</>
                    )}
                  </p>
                </div>
                <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-[10px]">
                  {s.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

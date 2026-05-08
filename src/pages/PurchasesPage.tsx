import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Coins, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * PurchasesPage — unified purchase history.
 *
 * Reads from `credit_transactions` so every kind of purchase shows up:
 * marketplace listings, event tickets, studio bookings, $RHOZE top-ups,
 * subscriptions, etc. Anything that touches a user's credits ledger.
 */
const PurchasesPage = () => {
  const { user } = useAuth();

  const { data: txs, isLoading } = useQuery({
    queryKey: ["my-purchase-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .in("type", ["purchase", "usage", "subscription", "renewal"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">My Purchases</h1>
        <p className="text-muted-foreground">
          Everything you've bought or spent credits on — bookings, tickets, top-ups, and more.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !txs?.length ? (
        <EmptyState
          icon={ShoppingBag}
          title="No purchases yet"
          description="Anything you buy on Rhozeland — listings, tickets, bookings, $RHOZE top-ups — shows up here."
          cta={{ label: "Browse the marketplace", to: "/discover?kind=offering" }}
        />
      ) : (
        <div className="space-y-3">
          {txs.map((tx: any) => {
            const isCredit = tx.amount > 0;
            return (
              <div key={tx.id} className="surface-card p-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCredit ? "bg-emerald-500/10" : "bg-primary/10"
                    }`}
                  >
                    {isCredit ? (
                      <ArrowDownRight className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">
                      {tx.description || (isCredit ? "Credits added" : "Credits spent")}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_at), "MMM d, yyyy 'at' h:mm a")}
                      {tx.payment_method ? ` · ${tx.payment_method}` : ""}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={`gap-1 flex-shrink-0 ${
                    isCredit ? "text-emerald-500" : "text-foreground"
                  }`}
                >
                  <Coins className="h-3 w-3" />
                  {isCredit ? "+" : ""}
                  {tx.amount} $RHOZE
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PurchasesPage;

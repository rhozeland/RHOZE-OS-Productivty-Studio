import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Download, ExternalLink, History } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ClaimRow {
  id: string;
  amount: number;
  description: string | null;
  payment_reference: string | null;
  created_at: string;
}

const SOLSCAN_TX = "https://solscan.io/tx/";

const RhozeClaimHistory = ({ className }: { className?: string }) => {
  const { user } = useAuth();

  const { data: claims, isLoading } = useQuery<ClaimRow[]>({
    queryKey: ["rhoze-claim-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("id, amount, description, payment_reference, created_at")
        .eq("user_id", user.id)
        .eq("type", "claim")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ClaimRow[];
    },
    enabled: !!user,
  });

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          $RHOZE Claim History
        </h3>
        {claims && claims.length > 0 && (
          <span className="text-[10px] text-muted-foreground font-body">
            {claims.length} claim{claims.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : claims && claims.length > 0 ? (
        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
          {claims.map((claim, i) => {
            const amount = Math.abs(Number(claim.amount));
            const sig = claim.payment_reference;
            const date = new Date(claim.created_at);
            return (
              <motion.div
                key={claim.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/60 hover:bg-card transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Download className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-body font-semibold text-foreground">
                      {amount.toLocaleString()} $RHOZE
                    </p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-body font-medium">
                      Claimed
                    </span>
                  </div>
                  <p
                    className="text-[10px] text-muted-foreground font-body truncate"
                    title={format(date, "PPpp")}
                  >
                    {formatDistanceToNow(date, { addSuffix: true })} ·{" "}
                    {format(date, "MMM d, yyyy")}
                    {sig && (
                      <>
                        {" · "}
                        <span className="font-mono">{sig.slice(0, 6)}…{sig.slice(-4)}</span>
                      </>
                    )}
                  </p>
                </div>
                {sig ? (
                  <a
                    href={`${SOLSCAN_TX}${sig}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-body text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md border border-border"
                    title="View on Solscan"
                  >
                    Solscan
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="shrink-0 text-[10px] text-muted-foreground font-body">
                    no tx
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="card-dashed p-6 text-center">
          <p className="text-xs text-muted-foreground font-body">
            No $RHOZE claims yet. Once you claim tokens to your wallet, your
            transaction history will appear here with Solscan links.
          </p>
        </div>
      )}
    </div>
  );
};

export default RhozeClaimHistory;

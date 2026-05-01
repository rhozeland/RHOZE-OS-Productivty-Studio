/**
 * HoldersList — top holders for a launch.
 *
 * RLS reminder: `coin_holdings` is only readable by the holder themself
 * or the launch creator. So:
 *   - If the viewer is the creator → show full list with profiles.
 *   - Otherwise → show a privacy notice (matches pump.fun's lightweight
 *     "you can see your own position" model in the right column).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Lock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  launchId: string;
  totalSupply: number;
  isCreator: boolean;
  ticker: string;
}

const HoldersList = ({ launchId, totalSupply, isCreator, ticker }: Props) => {
  const { data: holders, isLoading } = useQuery({
    queryKey: ["launch-holders", launchId, isCreator],
    queryFn: async () => {
      if (!isCreator) return [];
      const { data: rows } = await supabase
        .from("coin_holdings")
        .select("trader_id, balance, sol_invested")
        .eq("launch_id", launchId)
        .order("balance", { ascending: false })
        .limit(25);
      const ids = (rows ?? []).map((r) => r.trader_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles_public")
        .select("user_id, display_name, avatar_url, username")
        .in("user_id", ids);
      const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
      return (rows ?? []).map((r) => ({ ...r, profile: map.get(r.trader_id) ?? null }));
    },
  });

  if (!isCreator) {
    return (
      <div className="rounded-md border border-border/40 bg-muted/20 p-6 text-center space-y-2">
        <Lock className="h-5 w-5 text-muted-foreground/60 mx-auto" />
        <p className="text-xs text-muted-foreground">
          The full holder list is private to the creator.
        </p>
        <p className="text-[10px] text-muted-foreground/70">
          You can always see your own ${ticker} balance in the trade panel.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-muted/40 animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (!holders || holders.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/50 bg-muted/10 p-6 text-center">
        <Users className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No holders yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {holders.map((h, i) => {
        const pct = totalSupply > 0 ? (Number(h.balance) / totalSupply) * 100 : 0;
        const name =
          h.profile?.display_name || h.profile?.username || `${h.trader_id.slice(0, 4)}…${h.trader_id.slice(-4)}`;
        return (
          <Link
            key={h.trader_id}
            to={h.profile?.user_id ? `/profiles/${h.profile.user_id}` : "#"}
            className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-muted-foreground font-mono w-5 text-right">{i + 1}.</span>
              {h.profile?.avatar_url ? (
                <img src={h.profile.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                  {name[0]?.toUpperCase()}
                </div>
              )}
              <span className="truncate">{name}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0 font-mono">
              <span className="text-foreground">
                {Number(h.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className="text-muted-foreground w-12 text-right">{pct.toFixed(2)}%</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default HoldersList;

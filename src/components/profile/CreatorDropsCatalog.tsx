/**
 * CreatorDropsCatalog — replaces the old single "artist token" card on the
 * profile Support tab. Lists every coin (drop) the creator has launched,
 * with the event/space context it belongs to. Each card links to the
 * dedicated `/coin/:ticker` page.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Coins, ArrowRight, Calendar, Building2 } from "lucide-react";

interface Props {
  creatorId: string;
  isOwnProfile: boolean;
}

const CreatorDropsCatalog = ({ creatorId, isOwnProfile }: Props) => {
  const { data: drops, isLoading } = useQuery({
    queryKey: ["creator-drops", creatorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select(
          "id, ticker, name, image_url, status, virtual_sol_reserves, virtual_token_reserves, total_supply, event_id, space_id, events(title), studios(name)"
        )
        .eq("creator_id", creatorId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card/60 border border-border/50 p-6 animate-pulse h-32" />
    );
  }

  if (!drops || drops.length === 0) {
    return (
      <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-6 text-center space-y-2">
        <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Coins className="h-5 w-5 text-emerald-500" />
        </div>
        <h3 className="font-display text-base font-semibold text-foreground">
          {isOwnProfile ? "No drops yet" : "No drops yet"}
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          {isOwnProfile
            ? "Launch a coin from one of your events or spaces to start raising support."
            : "This creator hasn't dropped any coins yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {drops.map((c) => {
        const real = Number(c.real_sol_reserves) * 100;
        const goal = Number(c.graduation_sol_target) * 100;
        const progress = Math.min(100, goal > 0 ? (real / goal) * 100 : 0);
        const ctx = c.events?.title
          ? { icon: Calendar, label: c.events.title }
          : c.studios?.name
            ? { icon: Building2, label: c.studios.name }
            : null;
        return (
          <Link
            key={c.id}
            to={`/coin/${c.ticker}`}
            className="group block rounded-2xl border border-border bg-card hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all p-4"
          >
            <div className="flex items-start gap-3 mb-3">
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={c.name}
                  className="h-11 w-11 rounded-md object-cover shrink-0"
                />
              ) : (
                <div className="h-11 w-11 rounded-md bg-gradient-to-br from-emerald-500/30 to-fuchsia-500/30 flex items-center justify-center shrink-0">
                  <Coins className="h-5 w-5 text-emerald-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-sm group-hover:text-emerald-500 transition-colors">${c.ticker}</span>
                  {c.status === "graduated" && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500">
                      Grad
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{c.name}</p>
                {ctx && (
                  <p className="text-[10px] text-muted-foreground/80 truncate flex items-center gap-1 mt-0.5">
                    <ctx.icon className="h-2.5 w-2.5" />
                    {ctx.label}
                  </p>
                )}
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
              <span>{real.toFixed(0)} $RHOZE</span>
              <span>{goal.toFixed(0)} goal</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-fuchsia-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default CreatorDropsCatalog;

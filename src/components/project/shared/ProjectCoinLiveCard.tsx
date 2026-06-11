/**
 * ProjectCoinLiveCard — shown under the EditorSideRail when the project
 * has a linked, approved creator_token (i.e. coin is live on pump.fun).
 * One-tap deeplink out to the coin on pump.fun.
 */
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  linkedTokenId?: string | null;
}

const ProjectCoinLiveCard = ({ linkedTokenId }: Props) => {
  const { data: token } = useQuery({
    queryKey: ["project-linked-token", linkedTokenId],
    enabled: !!linkedTokenId,
    queryFn: async () => {
      const { data } = await supabase
        .from("creator_tokens")
        .select("mint_address, ticker, name, status")
        .eq("id", linkedTokenId!)
        .maybeSingle();
      if (!data || data.status !== "approved") return null;
      return data;
    },
  });

  if (!linkedTokenId || !token) return null;

  const url = `https://pump.fun/coin/${token.mint_address}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block relative overflow-hidden rounded-2xl border border-white/5 bg-slate-900 dark:bg-slate-950 text-white p-4 shadow-lg shadow-slate-900/20 hover:border-white/20 transition-colors"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-3xl"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live on pump.fun
          </div>
          <h3 className="text-2xl font-display font-black tracking-tighter leading-none">
            ${token.ticker}
          </h3>
          {token.name && (
            <p className="text-[11px] text-slate-400 mt-1 truncate">{token.name}</p>
          )}
        </div>
        <ExternalLink className="h-4 w-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>

      <div className="relative mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[10px]">
        <span className="font-bold uppercase tracking-widest text-slate-500">Trade on pump.fun</span>
        <span className="font-mono text-slate-500">
          {token.mint_address.slice(0, 4)}…{token.mint_address.slice(-4)}
        </span>
      </div>
    </a>
  );
};

export default ProjectCoinLiveCard;

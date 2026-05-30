/**
 * AttachCoinToProjectCard — owner-only control on Roadmap tab that links one
 * of the owner's APPROVED creator tokens to this project. Coin chip on the
 * public ReleasePage only appears when this link is set (no more auto-attach
 * of the profile's primary token).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Link2Off, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Props {
  projectId: string;
  linkedTokenId: string | null;
}

export default function AttachCoinToProjectCard({ projectId, linkedTokenId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: tokens } = useQuery({
    queryKey: ["my-approved-tokens", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_tokens")
        .select("id, ticker, name, mint_address, is_primary")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setLink = useMutation({
    mutationFn: async (tokenId: string | null) => {
      const { error } = await supabase
        .from("projects")
        .update({ linked_token_id: tokenId })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["release"] });
      toast.success("Updated linked coin");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update link"),
  });

  if (!tokens || tokens.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 flex items-center gap-3">
        <Coins className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 text-sm text-muted-foreground">
          Link an approved coin to showcase it on this release.
        </div>
        <Button asChild size="sm" variant="outline">
          <a href="/settings#token">Add coin</a>
        </Button>
      </div>
    );
  }

  const current = tokens.find((t: any) => t.id === linkedTokenId);

  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3 flex flex-wrap items-center gap-3">
      <Coins className="h-4 w-4 text-emerald-500 shrink-0" />
      <div className="flex-1 min-w-[180px]">
        <div className="text-sm font-medium">Linked coin</div>
        <div className="text-xs text-muted-foreground">
          {current
            ? `Showing $${current.ticker} on the public release page.`
            : "No coin linked. Pick one of your approved coins to anchor this release."}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((t: any) => {
          const active = t.id === linkedTokenId;
          return (
            <Button
              key={t.id}
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => setLink.mutate(active ? null : t.id)}
              disabled={setLink.isPending}
              className="h-8 gap-1.5"
            >
              <Badge variant="secondary" className="px-1 py-0 text-[10px]">${t.ticker}</Badge>
              {active ? "Linked" : "Link"}
            </Button>
          );
        })}
        {current && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLink.mutate(null)}
            disabled={setLink.isPending}
            className="h-8 gap-1"
          >
            <Link2Off className="h-3.5 w-3.5" /> Unlink
          </Button>
        )}
      </div>
    </div>
  );
}

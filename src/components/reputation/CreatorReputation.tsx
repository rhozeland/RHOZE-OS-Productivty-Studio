import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Award, ExternalLink } from "lucide-react";
import ContributionProofCard from "./ContributionProofCard";
import { useState } from "react";
import { toast } from "sonner";

interface CreatorReputationProps {
  userId: string;
  isOwner?: boolean;
}

const CreatorReputation = ({ userId, isOwner = false }: CreatorReputationProps) => {
  const [anchoringAll, setAnchoringAll] = useState(false);

  const { data: proofs, isLoading } = useQuery({
    queryKey: ["contribution-proofs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribution_proofs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const anchoredCount = proofs?.filter((p) => p.solana_signature).length ?? 0;
  const totalCount = proofs?.length ?? 0;
  const unanchoredCount = totalCount - anchoredCount;

  const handleAnchorAll = async () => {
    if (!proofs) return;
    const unanchored = proofs.filter((p) => !p.solana_signature);
    if (unanchored.length === 0) {
      toast.info("All contributions already anchored!");
      return;
    }

    setAnchoringAll(true);
    let success = 0;
    for (const proof of unanchored.slice(0, 5)) {
      try {
        const { error } = await supabase.functions.invoke("anchor-contribution", {
          body: { proof_id: proof.id },
        });
        if (!error) success++;
      } catch {
        // continue anchoring others
      }
    }
    toast.success(`Anchored ${success} contributions on Solana!`);
    setAnchoringAll(false);
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading reputation...
      </div>
    );
  }

  return (
    <div className="surface-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-accent" />
          <h3 className="font-display text-lg font-semibold text-foreground">
            On-Chain Reputation
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {anchoredCount}/{totalCount} verified
          </Badge>
          {isOwner && unanchoredCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAnchorAll}
              disabled={anchoringAll}
              className="gap-1.5"
            >
              {anchoringAll ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Shield className="h-3 w-3" />
              )}
              Anchor All ({Math.min(unanchoredCount, 5)})
            </Button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      {totalCount > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(
            proofs!.reduce<Record<string, number>>((acc, p) => {
              acc[p.action_type] = (acc[p.action_type] || 0) + 1;
              return acc;
            }, {})
          )
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([type, count]) => (
              <div
                key={type}
                className="rounded-lg border border-border bg-muted/30 p-3 text-center"
              >
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground capitalize">{type}s</p>
              </div>
            ))}
        </div>
      )}

      {/* Proof list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {proofs && proofs.length > 0 ? (
          proofs.map((proof) => (
            <ContributionProofCard key={proof.id} proof={{
              ...proof,
              metadata: (typeof proof.metadata === 'object' && proof.metadata !== null && !Array.isArray(proof.metadata))
                ? proof.metadata as Record<string, unknown>
                : {},
            }} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No contributions yet. Start posting, collaborating, and creating!
          </p>
        )}
      </div>

      {anchoredCount > 0 && (
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
          <ExternalLink className="h-3 w-3" />
          All proofs verifiable on{" "}
          <a
            href="https://solscan.io"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Solscan
          </a>
        </p>
      )}
    </div>
  );
};

export default CreatorReputation;

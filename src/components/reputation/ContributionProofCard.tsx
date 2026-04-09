import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Shield, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContributionProof {
  id: string;
  action_type: string;
  metadata: Record<string, unknown>;
  solana_signature: string | null;
  anchored_at: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  reward: { label: "Reward", color: "bg-accent/15 text-accent" },
  post: { label: "Post", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  collaboration: { label: "Collab", color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  review: { label: "Review", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
  milestone: { label: "Milestone", color: "bg-green-500/15 text-green-600 dark:text-green-400" },
  curation: { label: "Curation", color: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
};

const ContributionProofCard = ({ proof }: { proof: ContributionProof }) => {
  const [anchoring, setAnchoring] = useState(false);
  const config = ACTION_LABELS[proof.action_type] || ACTION_LABELS.reward;

  const handleAnchor = async () => {
    setAnchoring(true);
    try {
      const { data, error } = await supabase.functions.invoke("anchor-contribution", {
        body: { proof_id: proof.id },
      });
      if (error) throw error;
      toast.success(`Anchored on Solana! Tx: ${data.signature.slice(0, 8)}...`);
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to anchor";
      toast.error(message);
    } finally {
      setAnchoring(false);
    }
  };

  const description = (proof.metadata as Record<string, unknown>)?.description as string;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-3 min-w-0">
        <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={config.color}>
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(proof.created_at).toLocaleDateString()}
            </span>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {proof.solana_signature ? (
        <a
          href={`https://solscan.io/tx/${proof.solana_signature}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
        >
          <Badge variant="secondary" className="gap-1 font-mono text-xs">
            <ExternalLink className="h-3 w-3" />
            {proof.solana_signature.slice(0, 6)}...
          </Badge>
        </a>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={handleAnchor}
          disabled={anchoring}
          className="shrink-0 gap-1.5"
        >
          {anchoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
          {anchoring ? "Anchoring..." : "Anchor"}
        </Button>
      )}
    </div>
  );
};

export default ContributionProofCard;

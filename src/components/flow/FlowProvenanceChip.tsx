/**
 * FlowProvenanceChip — ambient "verification status" indicator for Flow cards.
 *
 * Every Flow upload now carries a SHA-256 fingerprint and progresses through
 * a Verified-IP lifecycle. This chip is the at-a-glance status shown on each
 * card so creators (and viewers) can tell instantly:
 *
 *   • `verified`    → the asset has been admin-reviewed and anchored on
 *                     Solana. We render the existing <VerifiedIPBadge />
 *                     so the visual is unified across the whole app.
 *   • `pending`     → creator submitted for review; awaiting an admin.
 *   • `none`        → fingerprinted only (the default for every fresh
 *                     upload). Owner sees a subtle hint they can apply
 *                     for verification; viewers see a quiet badge.
 *   • `rejected` /
 *     `changes_requested` → admin pushed back. Visible to the owner only.
 *
 * Phase 1 keeps this read-only — clicking the "Apply" CTA is wired up in
 * Phase 2 once the verification request flow lands.
 */
import { Badge } from "@/components/ui/badge";
import { Fingerprint, Hourglass, AlertCircle } from "lucide-react";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import { cn } from "@/lib/utils";

export type FlowVerificationStatus =
  | "none"
  | "pending"
  | "verified"
  | "rejected"
  | "changes_requested";

interface FlowProvenanceChipProps {
  status?: FlowVerificationStatus | null;
  contentHash?: string | null;
  solanaSignature?: string | null;
  isOwner?: boolean;
  className?: string;
}

const FlowProvenanceChip = ({
  status,
  contentHash,
  solanaSignature,
  isOwner,
  className,
}: FlowProvenanceChipProps) => {
  // Verified → reuse the canonical badge so this surface looks identical to
  // every other "anchored creative IP" surface in the app (profiles,
  // listings, project deliverables, etc.).
  if (status === "verified" && solanaSignature) {
    return (
      <VerifiedIPBadge
        signature={solanaSignature}
        size="xs"
        className={className}
      />
    );
  }

  if (status === "pending") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "h-5 gap-1 px-1.5 text-[10px] font-medium",
          "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
          className,
        )}
        title="Submitted for review — an admin will verify this work shortly."
      >
        <Hourglass className="h-3 w-3" />
        <span>Pending review</span>
      </Badge>
    );
  }

  if ((status === "rejected" || status === "changes_requested") && isOwner) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "h-5 gap-1 px-1.5 text-[10px] font-medium",
          "border-destructive/30 bg-destructive/10 text-destructive",
          className,
        )}
        title={
          status === "rejected"
            ? "Verification request was declined."
            : "Admin requested changes before verification."
        }
      >
        <AlertCircle className="h-3 w-3" />
        <span>{status === "rejected" ? "Not verified" : "Changes requested"}</span>
      </Badge>
    );
  }

  // Default: fingerprinted but not yet submitted. Only show the chip if we
  // actually have a hash on the row — historical posts with no fingerprint
  // get nothing here (they'll be handled by the opt-in re-hash flow in
  // Phase 2).
  if (contentHash) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "h-5 gap-1 px-1.5 text-[10px] font-medium",
          "border-border/60 bg-muted/40 text-muted-foreground",
          className,
        )}
        title={`Fingerprinted: sha256:${contentHash.slice(0, 12)}…\nClick "Verify this work" to submit for review.`}
      >
        <Fingerprint className="h-3 w-3" />
        <span>Fingerprinted</span>
      </Badge>
    );
  }

  return null;
};

export default FlowProvenanceChip;

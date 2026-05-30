/**
 * SignedAgreementCard — locked agreement + signatures + on-chain anchor for
 * a project that was created from a signed proposal.
 *
 * Mounted on ProjectDetailPage above the roadmap. Renders nothing when no
 * proposal is linked to the project's contract (e.g. legacy projects that
 * pre-date the proposal flow).
 *
 * Surfaces:
 *  - Agreement title + version chip + "Locked" status
 *  - Both signers (avatar + display name) with timestamps + Solscan link
 *  - Collapsible full agreement text (the same `terms_text` the parties
 *    signed — read-only, monospace, preserves whitespace)
 *  - SHA-256 terms hash footer for verifiability
 *
 * Milestones live in the existing Roadmap below this card; the agreement
 * only links them by reference ("see Roadmap").
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSignature,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SignedAgreementCardProps {
  projectId: string;
  contractId?: string | null;
}

const SignedAgreementCard = ({ projectId, contractId }: SignedAgreementCardProps) => {
  const [open, setOpen] = useState(false);

  // Pull the proposal linked to this project's contract. Skip until the
  // contract id is known so we don't fire a query keyed on `null`.
  const { data: proposal } = useQuery({
    queryKey: ["project-proposal", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_proposals")
        .select(
          "id, title, status, terms_text, terms_version, terms_hash, client_id, specialist_id, client_signed_at, specialist_signed_at, client_signature_tx, specialist_signature_tx, anchored_at",
        )

        .eq("contract_id", contractId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });

  // Resolve display names + avatars for both signers in a single round-trip.
  const userIds = useMemo(
    () =>
      proposal
        ? Array.from(new Set([proposal.client_id, proposal.specialist_id].filter(Boolean)))
        : [],
    [proposal],
  );
  const { data: signerProfiles } = useQuery({
    queryKey: ["proposal-signer-profiles", userIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });

  // Hide entirely until the proposal exists AND has been double-signed.
  // Pre-sign agreements are shown in <ProposalSheet />, not here.
  if (!proposal || proposal.status !== "signed") return null;

  const profileFor = (uid: string | null) =>
    signerProfiles?.find((p) => p.user_id === uid) ?? null;

  const clientProfile = profileFor(proposal.client_id);
  const specialistProfile = profileFor(proposal.specialist_id);

  const bothAnchored = !!proposal.anchored_at;

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-card to-card">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 shrink-0 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <FileSignature className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {proposal.title}
              </h3>
              <Badge
                variant="secondary"
                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] gap-1 border-0"
              >
                <CheckCircle2 className="h-2.5 w-2.5" /> Signed
              </Badge>
              {bothAnchored && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                >
                  <ShieldCheck className="h-2.5 w-2.5" /> Anchored
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
              {proposal.terms_version}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="gap-1 text-xs h-8"
        >
          {open ? "Hide" : "Read"} agreement
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Signers */}
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
        <SignerBlock
          role="Client"
          displayName={
            clientProfile?.display_name || clientProfile?.username || "Client"
          }
          avatarUrl={clientProfile?.avatar_url ?? null}
          signedAt={proposal.client_signed_at}
          tx={proposal.client_signature_tx}
        />
        <SignerBlock
          role="Creator"
          displayName={
            specialistProfile?.display_name ||
            specialistProfile?.username ||
            "Creator"
          }
          avatarUrl={specialistProfile?.avatar_url ?? null}
          signedAt={proposal.specialist_signed_at}
          tx={proposal.specialist_signature_tx}
        />
      </div>

      {/* Expandable full agreement text */}
      {open && proposal.terms_text && (
        <>
          <Separator />
          <div className="px-4 py-4 sm:px-5">
            <pre className="max-h-[420px] overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3.5 text-[11px] leading-relaxed font-mono whitespace-pre-wrap text-foreground/90">
              {proposal.terms_text}
            </pre>
            <p className="mt-2 text-[10px] text-muted-foreground italic">
              Milestones &amp; payment stages are listed in the Roadmap below.
            </p>
          </div>
        </>
      )}

      {/* Footer — SHA-256 hash for verifiability */}
      {proposal.terms_hash && (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-2 sm:px-5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3 shrink-0" />
          <span className="shrink-0">terms hash</span>
          <code className="truncate font-mono text-foreground/70">
            {proposal.terms_hash}
          </code>
        </div>
      )}
    </div>
  );
};

interface SignerBlockProps {
  role: string;
  displayName: string;
  avatarUrl: string | null;
  signedAt: string | null;
  tx: string | null;
}

const SignerBlock = ({ role, displayName, avatarUrl, signedAt, tx }: SignerBlockProps) => {
  const signed = !!signedAt;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/60 p-3">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={avatarUrl ?? undefined} />
        <AvatarFallback className="text-[11px]">
          {displayName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            {role}
          </p>
          {signed && (
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          )}
        </div>
        <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
        <p className="text-[11px] text-muted-foreground">
          {signed
            ? `Signed ${new Date(signedAt!).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}`
            : "Not signed yet"}
        </p>
        {tx ? (
          <a
            href={`https://solscan.io/tx/${tx}`}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "mt-1 inline-flex items-center gap-1 text-[10px] font-medium",
              "text-emerald-700 dark:text-emerald-400 hover:underline",
            )}
          >
            <ShieldCheck className="h-2.5 w-2.5" />
            View on Solana
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : signed ? (
          <p className="mt-1 text-[10px] text-amber-600">awaiting on-chain anchor…</p>
        ) : null}
      </div>
    </div>
  );
};

export default SignedAgreementCard;

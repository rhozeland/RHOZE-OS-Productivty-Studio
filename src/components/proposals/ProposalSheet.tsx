/**
 * ProposalSheet — two-sided project proposal builder.
 *
 * Modes:
 *   • { proposalId }                  → load existing proposal, allow edit
 *     until signed.
 *   • { newProposal: { counterpartyId, role, title?, summary?,
 *                      listingId?, budget? } }
 *     → creates a fresh draft proposal owned by the current user on first
 *       mount. `role` describes the current user's side ('client' if they
 *       are commissioning, 'specialist' if they are the creator pitching
 *       their own service).
 *
 * Surfaces title / summary / budget editor + an inline milestone list.
 * Either party can edit while unsigned; substantive edits made by an
 * already-signed party will auto-revoke their signature (handled by the
 * DB trigger).
 *
 * "Sign & send" calls the sign_project_proposal RPC. When both sides have
 * signed, the DB creates the project + contract + milestones and returns
 * the contract_id; we then redirect to the new /projects/:id.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2, PenLine, Plus, Trash2, CheckCircle2, X, DollarSign,
  FileText, ChevronDown, ShieldCheck, ExternalLink, Anchor,
} from "lucide-react";
import BudgetSplitViz from "@/components/project/BudgetSplitViz";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildDefaultAgreement, TERMS_VERSION } from "@/lib/project-agreement";

type NewProposalInput = {
  counterpartyId: string;
  /** Which side the current user is on. Defaults to "client" (commissioner). */
  role?: "client" | "specialist";
  title?: string;
  summary?: string;
  listingId?: string;
  budgetCredits?: number;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId?: string | null;
  newProposal?: NewProposalInput | null;
}

const ProposalSheet = ({ open, onOpenChange, proposalId, newProposal }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(proposalId ?? null);
  const [bootstrapping, setBootstrapping] = useState(false);

  // Reset on close.
  useEffect(() => {
    if (!open) {
      setActiveId(proposalId ?? null);
    }
  }, [open, proposalId]);

  // If opened with a proposalId, use it directly.
  useEffect(() => {
    if (open && proposalId) setActiveId(proposalId);
  }, [open, proposalId]);

  // If opened in "new" mode, create the draft once on first open.
  useEffect(() => {
    if (!open || !user || activeId || !newProposal || bootstrapping) return;
    setBootstrapping(true);
    const role = newProposal.role ?? "client";
    (async () => {
      const { data, error } = await supabase
        .from("project_proposals")
        .insert({
          created_by: user.id,
          client_id: role === "client" ? user.id : newProposal.counterpartyId,
          specialist_id: role === "specialist" ? user.id : newProposal.counterpartyId,
          title: newProposal.title || "Untitled project",
          summary: newProposal.summary ?? null,
          budget_credits: newProposal.budgetCredits ?? 0,
          currency: "credits",
          source_listing_id: newProposal.listingId ?? null,
          status: "draft",
        })
        .select("id")
        .single();
      setBootstrapping(false);
      if (error) {
        toast.error(error.message);
        onOpenChange(false);
        return;
      }
      setActiveId(data.id);
      qc.invalidateQueries({ queryKey: ["project-proposals"] });
    })();
  }, [open, user, activeId, newProposal, bootstrapping, onOpenChange, qc]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
        {activeId ? (
          <ProposalEditor proposalId={activeId} onClose={() => onOpenChange(false)} onConverted={(projectId) => {
            onOpenChange(false);
            navigate(`/projects/${projectId}`);
          }} />
        ) : (
          <div className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Starting proposal…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface EditorProps {
  proposalId: string;
  onClose: () => void;
  onConverted: (projectId: string) => void;
}

const ProposalEditor = ({ proposalId, onClose, onConverted }: EditorProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: proposal, isLoading } = useQuery({
    queryKey: ["project-proposal", proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_proposals")
        .select("*")
        .eq("id", proposalId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: milestones } = useQuery({
    queryKey: ["proposal-milestones", proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_proposal_milestones")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: counterpartyProfile } = useQuery({
    queryKey: ["proposal-counterparty", proposal?.client_id, proposal?.specialist_id, user?.id],
    enabled: !!proposal && !!user,
    queryFn: async () => {
      const otherId = user!.id === proposal.client_id ? proposal.specialist_id : proposal.client_id;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", otherId)
        .maybeSingle();
      return data ?? { display_name: "Counterparty", username: null, avatar_url: null };
    },
  });

  const [localTitle, setLocalTitle] = useState("");
  const [localSummary, setLocalSummary] = useState("");
  const [localBudget, setLocalBudget] = useState<number>(0);

  useEffect(() => {
    if (!proposal) return;
    setLocalTitle(proposal.title ?? "");
    setLocalSummary(proposal.summary ?? "");
    setLocalBudget(Number(proposal.budget_credits ?? 0));
  }, [proposal]);

  const isMine = !!user && !!proposal &&
    (user.id === proposal.client_id || user.id === proposal.specialist_id);
  const myRole: "client" | "specialist" | null = !proposal || !user ? null
    : user.id === proposal.client_id ? "client" : "specialist";
  const mySigned = myRole === "client" ? !!proposal?.client_signed_at : !!proposal?.specialist_signed_at;
  const otherSigned = myRole === "client" ? !!proposal?.specialist_signed_at : !!proposal?.client_signed_at;
  const locked = proposal?.status === "signed" || proposal?.status === "declined";
  const editable = isMine && !locked;

  const turnLabel = useMemo(() => {
    if (!proposal || !myRole) return "";
    if (proposal.status === "draft") return "Draft — your turn";
    if (proposal.status === "awaiting_client") return myRole === "client" ? "Your turn to sign" : "Waiting on the client";
    if (proposal.status === "awaiting_creator") return myRole === "specialist" ? "Your turn to sign" : "Waiting on the creator";
    if (proposal.status === "signed") return "Signed by both sides";
    if (proposal.status === "declined") return "Declined";
    return "";
  }, [proposal, myRole]);

  const saveMeta = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("project_proposals")
        .update({
          title: localTitle.trim() || "Untitled project",
          summary: localSummary.trim() || null,
          budget_credits: Number.isFinite(localBudget) ? localBudget : 0,
        })
        .eq("id", proposalId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-proposal", proposalId] });
      qc.invalidateQueries({ queryKey: ["project-proposals"] });
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMilestone = useMutation({
    mutationFn: async () => {
      const nextOrder = (milestones?.length ?? 0);
      const { error } = await supabase
        .from("project_proposal_milestones")
        .insert({
          proposal_id: proposalId,
          title: "New milestone",
          credit_amount: 0,
          sort_order: nextOrder,
          proposed_by: user!.id,
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal-milestones", proposalId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updateMilestone = useMutation({
    mutationFn: async (m: { id: string; title?: string; credit_amount?: number }) => {
      const { id, ...rest } = m;
      const { error } = await supabase
        .from("project_proposal_milestones")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal-milestones", proposalId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removeMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_proposal_milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal-milestones", proposalId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const sign = useMutation({
    mutationFn: async () => {
      // Save pending text edits first so the signed snapshot is current.
      await supabase
        .from("project_proposals")
        .update({
          title: localTitle.trim() || "Untitled project",
          summary: localSummary.trim() || null,
          budget_credits: Number.isFinite(localBudget) ? localBudget : 0,
        })
        .eq("id", proposalId);

      const { data, error } = await supabase.rpc("sign_project_proposal", { _proposal_id: proposalId });
      if (error) throw error;
      return data as { status: string; contract_id: string | null; project_id: string | null };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["project-proposal", proposalId] });
      qc.invalidateQueries({ queryKey: ["project-proposals"] });
      if (data?.status === "signed" && data.project_id) {
        toast.success("Project locked — work starts now");
        onConverted(data.project_id);
      } else {
        toast.success("Signed — waiting on the other side");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const decline = useMutation({
    mutationFn: async () => {
      const reason = window.prompt("Optional reason for declining?") ?? null;
      const { error } = await supabase.rpc("decline_project_proposal", {
        _proposal_id: proposalId,
        _reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-proposal", proposalId] });
      qc.invalidateQueries({ queryKey: ["project-proposals"] });
      toast.success("Proposal declined");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const milestoneTotal = (milestones ?? []).reduce((s, m) => s + Number(m.credit_amount ?? 0), 0);

  if (isLoading || !proposal) {
    return (
      <div className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading proposal…
      </div>
    );
  }

  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
        <DialogTitle className="font-display text-xl flex items-center gap-2">
          <PenLine className="h-4 w-4 text-primary" />
          Project proposal
        </DialogTitle>
        <DialogDescription className="text-xs flex items-center justify-between gap-2">
          <span>
            with <span className="text-foreground font-medium">
              {counterpartyProfile?.display_name || counterpartyProfile?.username || "creator"}
            </span>
          </span>
          <Badge variant={proposal.status === "signed" ? "default" : "outline"} className="text-[10px]">
            {turnLabel}
          </Badge>
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Title</label>
          <Input
            value={localTitle}
            disabled={!editable}
            onChange={(e) => setLocalTitle(e.target.value)}
            placeholder="What are you building together?"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Summary</label>
          <Textarea
            value={localSummary}
            disabled={!editable}
            onChange={(e) => setLocalSummary(e.target.value)}
            placeholder="Scope, goals, deliverables…"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Total budget (USD)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              min={0}
              step="any"
              disabled={!editable}
              value={localBudget || ""}
              onChange={(e) => setLocalBudget(Number(e.target.value || 0))}
              placeholder="e.g. 2500"
              className="pl-9 text-lg font-medium"
            />
          </div>
          <BudgetSplitViz budget={localBudget} />
          {milestoneTotal > 0 && Math.abs(milestoneTotal - localBudget) > 0.5 && (
            <p className="text-[11px] text-amber-600">
              Milestones add up to {milestoneTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })} — doesn't match budget.
            </p>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Milestones</h4>
            {editable && (
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => addMilestone.mutate()}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            )}
          </div>

          {(milestones ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No milestones yet. Add at least one to lock budget per stage.</p>
          ) : (
            <div className="space-y-2">
              {milestones!.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border p-2 bg-card">
                  <Input
                    className="flex-1 h-8 text-sm"
                    value={m.title}
                    disabled={!editable}
                    onChange={(e) => updateMilestone.mutate({ id: m.id, title: e.target.value })}
                  />
                  <div className="relative w-28 shrink-0">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      className="h-8 text-sm pl-7 pr-2 font-mono"
                      value={Number(m.credit_amount ?? 0)}
                      disabled={!editable}
                      onChange={(e) => updateMilestone.mutate({ id: m.id, credit_amount: Number(e.target.value || 0) })}
                    />
                  </div>
                  {editable && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMilestone.mutate(m.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signature summary */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2">
            {proposal.client_signed_at ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/50" />}
            <span>Client {proposal.client_signed_at ? "signed" : "not yet signed"}</span>
          </div>
          <div className="flex items-center gap-2">
            {proposal.specialist_signed_at ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/50" />}
            <span>Creator {proposal.specialist_signed_at ? "signed" : "not yet signed"}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border/60 p-4 flex flex-wrap items-center justify-end gap-2 shrink-0">
        {editable && (
          <Button variant="ghost" size="sm" onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending}>
            Save changes
          </Button>
        )}
        {isMine && !locked && (
          <Button variant="outline" size="sm" onClick={() => decline.mutate()} disabled={decline.isPending} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Decline
          </Button>
        )}
        {isMine && !locked && !mySigned && (
          <Button size="sm" onClick={() => sign.mutate()} disabled={sign.isPending} className="gap-1.5">
            {sign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
            {otherSigned ? "Sign & start project" : "Sign & send"}
          </Button>
        )}
        {mySigned && !locked && (
          <Badge variant="outline" className="gap-1 text-[11px]">
            <CheckCircle2 className="h-3 w-3" /> You signed — waiting on the other side
          </Badge>
        )}
      </div>
    </>
  );
};

export default ProposalSheet;

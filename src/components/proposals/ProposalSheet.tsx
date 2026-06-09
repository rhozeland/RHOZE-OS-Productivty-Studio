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
  Flag, AlignLeft, Paperclip, Users, ListChecks, CalendarDays,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BudgetSplitViz from "@/components/project/BudgetSplitViz";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildDefaultAgreement, TERMS_VERSION } from "@/lib/project-agreement";
import VoiceDictateButton from "@/components/voice/VoiceDictateButton";

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
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
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
  const [localTerms, setLocalTerms] = useState<string>("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsEdited, setTermsEdited] = useState(false);

  // Pull own profile name so we can fill the agreement template.
  const { data: selfProfile } = useQuery({
    queryKey: ["proposal-self-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data ?? { display_name: null, username: null };
    },
  });

  useEffect(() => {
    if (!proposal) return;
    setLocalTitle(proposal.title ?? "");
    setLocalSummary(proposal.summary ?? "");
    setLocalBudget(Number(proposal.budget_credits ?? 0));
    setLocalTerms(proposal.terms_text ?? "");
    setTermsEdited(!!proposal.terms_text);
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
          terms_text: termsEdited ? localTerms : null,
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

  // Computed canonical agreement text — what the user actually sees + signs.
  const counterpartyName =
    counterpartyProfile?.display_name || counterpartyProfile?.username || "Counterparty";
  const myName = selfProfile?.display_name || selfProfile?.username || (user?.email?.split("@")[0] ?? "You");
  const clientName = myRole === "client" ? myName : counterpartyName;
  const creatorName = myRole === "specialist" ? myName : counterpartyName;

  const renderedTerms = useMemo(() => {
    if (termsEdited && localTerms.trim().length > 0) return localTerms;
    return buildDefaultAgreement({
      clientName,
      creatorName,
      title: localTitle || "Untitled project",
      summary: localSummary,
      totalBudget: Number(localBudget || 0),
      currency: (proposal?.currency as string) || "usd",
      milestones: (milestones ?? []).map((m: any) => ({
        title: m.title,
        credit_amount: Number(m.credit_amount ?? 0),
      })),
    });
  }, [termsEdited, localTerms, clientName, creatorName, localTitle, localSummary, localBudget, proposal?.currency, milestones]);

  const anchorSignature = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("anchor-proposal-signature", {
        body: { proposal_id: proposalId },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { signature: string; explorer: string; side: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-proposal", proposalId] });
    },
    onError: (e: any) => {
      // Non-fatal — off-chain signature is already valid, anchor can retry.
      console.warn("anchor failed", e);
      toast.error("Anchor on-chain failed — you can retry from the proposal.");
    },
  });

  const sign = useMutation({
    mutationFn: async () => {
      // Persist the agreement snapshot before signing so the RPC hashes the
      // exact text the user is looking at.
      await supabase
        .from("project_proposals")
        .update({
          title: localTitle.trim() || "Untitled project",
          summary: localSummary.trim() || null,
          budget_credits: Number.isFinite(localBudget) ? localBudget : 0,
          terms_text: renderedTerms,
        })
        .eq("id", proposalId);

      const { data, error } = await supabase.rpc("sign_project_proposal", { _proposal_id: proposalId });
      if (error) throw error;
      return data as { status: string; contract_id: string | null; project_id: string | null };
    },
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: ["project-proposal", proposalId] });
      qc.invalidateQueries({ queryKey: ["project-proposals"] });

      // Anchor my newly-recorded signature on-chain (non-blocking UX).
      anchorSignature.mutate(undefined, {
        onSuccess: (res) => {
          toast.success("Signature anchored on Solana");
        },
      });

      if (data?.status === "signed" && data.project_id) {
        // Give the anchor call a beat then redirect to the project workspace.
        setTimeout(() => {
          toast.success("Project locked — work starts now");
          onConverted(data.project_id!);
        }, 600);
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

  const signedCount = (proposal.client_signed_at ? 1 : 0) + (proposal.specialist_signed_at ? 1 : 0);
  const signedPct = Math.round((signedCount / 2) * 100);
  const priorityTone =
    proposal.status === "signed" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
    : proposal.status === "declined" ? "bg-muted text-muted-foreground border-border"
    : proposal.status === "draft" ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
    : "bg-primary/15 text-primary border-primary/30";
  const counterpartyInitial = counterpartyName.slice(0, 1).toUpperCase();
  const myInitial = (myName ?? "Y").slice(0, 1).toUpperCase();
  const fmtUsd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });


  return (
    <>
      <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b border-border/60">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="font-display text-lg flex items-center gap-2 truncate">
              <PenLine className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{localTitle || "Untitled project"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Proposal with <span className="text-foreground font-medium">{counterpartyName}</span>
            </DialogDescription>
          </div>
          <Badge className={`text-[10px] border ${priorityTone}`} variant="outline">
            {turnLabel}
          </Badge>
        </div>

        {/* Meta strip — Notion-style key/value rows */}
        <div className="mt-4 space-y-1.5 text-xs">
          <MetaRow icon={<Flag className="h-3.5 w-3.5" />} label="Priority">
            <Badge variant="outline" className={`text-[10px] border ${priorityTone}`}>
              {proposal.status === "signed" ? "Locked" : proposal.status === "declined" ? "Declined" : "Open"}
            </Badge>
          </MetaRow>
          <MetaRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Budget">
            <span className="font-medium text-foreground">{fmtUsd(Number(localBudget || 0))}</span>
            {milestones && milestones.length > 0 && (
              <span className="text-muted-foreground"> · {milestones.length} milestone{milestones.length === 1 ? "" : "s"}</span>
            )}
          </MetaRow>
          <MetaRow icon={<Users className="h-3.5 w-3.5" />} label="Team">
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{myInitial}</AvatarFallback></Avatar>
              <Avatar className="h-5 w-5">
                {counterpartyProfile?.avatar_url
                  ? <AvatarImage src={counterpartyProfile.avatar_url} alt={counterpartyName} />
                  : <AvatarFallback className="text-[9px]">{counterpartyInitial}</AvatarFallback>}
              </Avatar>
              <span className="text-muted-foreground">You & {counterpartyName}</span>
            </div>
          </MetaRow>
          <MetaRow icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description">
            <span className="text-muted-foreground line-clamp-1">
              {localSummary?.trim() || <span className="italic">Add a brief…</span>}
            </span>
          </MetaRow>
        </div>

        {/* Signature progress */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${signedPct}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            Signed {signedCount}/2 · {signedPct}%
          </span>
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="overview" className="w-full">
          <div className="px-6 pt-3 sticky top-0 bg-background z-10 border-b border-border/40">
            <TabsList className="h-9 bg-muted/40">
              <TabsTrigger value="overview" className="text-xs gap-1.5"><AlignLeft className="h-3 w-3" />Overview</TabsTrigger>
              <TabsTrigger value="roadmap" className="text-xs gap-1.5"><ListChecks className="h-3 w-3" />Roadmap</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs gap-1.5"><CalendarDays className="h-3 w-3" />Timeline</TabsTrigger>
              <TabsTrigger value="team" className="text-xs gap-1.5"><Users className="h-3 w-3" />Team</TabsTrigger>
              <TabsTrigger value="agreement" className="text-xs gap-1.5"><FileText className="h-3 w-3" />Agreement</TabsTrigger>
            </TabsList>
          </div>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="px-6 py-4 space-y-4 mt-0">
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
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Description</label>
                {editable && (
                  <VoiceDictateButton label="Speak the brief" onTranscript={(t) => setLocalSummary(t)} />
                )}
              </div>
              <Textarea
                value={localSummary}
                disabled={!editable}
                onChange={(e) => setLocalSummary(e.target.value)}
                placeholder="Scope, goals, deliverables… or tap the mic to dictate."
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Total budget (USD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number" min={0} step="any" disabled={!editable}
                  value={localBudget || ""}
                  onChange={(e) => setLocalBudget(Number(e.target.value || 0))}
                  placeholder="e.g. 2500"
                  className="pl-9 text-lg font-medium"
                />
              </div>
              <BudgetSplitViz budget={localBudget} />
              {milestoneTotal > 0 && Math.abs(milestoneTotal - localBudget) > 0.5 && (
                <p className="text-[11px] text-amber-600">
                  Milestones add up to {fmtUsd(milestoneTotal)} — doesn't match budget.
                </p>
              )}
            </div>

            {/* Attachments — source listing if any */}
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Paperclip className="h-3 w-3" /> Attachments
              </label>
              {proposal.source_listing_id ? (
                <a
                  href={`/listings/${proposal.source_listing_id}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5 hover:bg-accent transition-colors text-xs"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="flex-1 font-medium truncate">Source listing</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">No attachments yet.</p>
              )}
            </div>
          </TabsContent>

          {/* ROADMAP — milestones */}
          <TabsContent value="roadmap" className="px-6 py-4 space-y-3 mt-0">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">Milestones</h4>
                <p className="text-[11px] text-muted-foreground">Lock budget per stage so payment ships as work ships.</p>
              </div>
              {editable && (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => addMilestone.mutate()}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              )}
            </div>

            {(milestones ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No milestones yet.</p>
            ) : (
              <div className="space-y-2">
                {milestones!.map((m: any, i: number) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border p-2 bg-card">
                    <span className="text-[10px] font-mono text-muted-foreground w-5 text-center shrink-0">{i + 1}</span>
                    <Input
                      className="flex-1 h-8 text-sm"
                      value={m.title}
                      disabled={!editable}
                      onChange={(e) => updateMilestone.mutate({ id: m.id, title: e.target.value })}
                    />
                    <div className="relative w-28 shrink-0">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="number" min={0}
                        className="h-8 text-sm pl-7 pr-2 font-mono"
                        value={Number(m.credit_amount ?? 0)}
                        disabled={!editable}
                        onChange={(e) => updateMilestone.mutate({ id: m.id, credit_amount: Number(e.target.value || 0) })}
                      />
                    </div>
                    {editable && (
                      <Button
                        size="icon" variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMilestone.mutate(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                  <span>{milestones!.length} stage{milestones!.length === 1 ? "" : "s"}</span>
                  <span className="font-mono">Total: {fmtUsd(milestoneTotal)}</span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TIMELINE — derived from milestones */}
          <TabsContent value="timeline" className="px-6 py-4 mt-0">
            {(milestones ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Add milestones in Roadmap to see the timeline.</p>
            ) : (
              <ol className="relative border-l border-border/60 ml-2 space-y-4">
                {milestones!.map((m: any, i: number) => (
                  <li key={m.id} className="ml-4">
                    <span className="absolute -left-[7px] flex h-3 w-3 rounded-full bg-primary/20 border-2 border-background ring-1 ring-border" />
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium">{m.title || `Stage ${i + 1}`}</p>
                      <span className="text-[11px] font-mono text-muted-foreground">{fmtUsd(Number(m.credit_amount ?? 0))}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Stage {i + 1} of {milestones!.length}</p>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>

          {/* TEAM */}
          <TabsContent value="team" className="px-6 py-4 space-y-2 mt-0">
            <TeamCard
              name={myName} initial={myInitial} avatar={null}
              role={myRole === "client" ? "Client" : "Creator"}
              signedAt={myRole === "client" ? proposal.client_signed_at : proposal.specialist_signed_at}
              isYou
            />
            <TeamCard
              name={counterpartyName} initial={counterpartyInitial} avatar={counterpartyProfile?.avatar_url ?? null}
              role={myRole === "client" ? "Creator" : "Client"}
              signedAt={myRole === "client" ? proposal.specialist_signed_at : proposal.client_signed_at}
            />
          </TabsContent>

          {/* AGREEMENT */}
          <TabsContent value="agreement" className="px-6 py-4 space-y-3 mt-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Standard Rhozeland agreement
                <Badge variant="outline" className="ml-1 text-[9px] font-mono uppercase">{TERMS_VERSION}</Badge>
              </h4>
              {editable && termsEdited && (
                <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                  onClick={() => { setLocalTerms(""); setTermsEdited(false); }}>
                  Reset to standard
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Both parties sign these exact terms. Full document + milestones are hashed (SHA-256) and anchored on Solana on sign.
            </p>
            <Textarea
              value={renderedTerms}
              disabled={!editable}
              rows={12}
              spellCheck={false}
              onChange={(e) => { setLocalTerms(e.target.value); setTermsEdited(true); }}
              className="font-mono text-[11px] leading-relaxed"
            />

            {/* Signatures */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-2">
              <SignatureRow label="Client" signedAt={proposal.client_signed_at}
                hash={proposal.client_signature_hash} tx={proposal.client_signature_tx} />
              <SignatureRow label="Creator" signedAt={proposal.specialist_signed_at}
                hash={proposal.specialist_signature_hash} tx={proposal.specialist_signature_tx} />
              {proposal.terms_hash && (
                <div className="pt-1 mt-1 border-t border-border/40 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  <span className="font-mono truncate">hash: {proposal.terms_hash.slice(0, 24)}…</span>
                </div>
              )}
              {mySigned && !(myRole === "client" ? proposal.client_signature_tx : proposal.specialist_signature_tx) && (
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px] w-full"
                  onClick={() => anchorSignature.mutate()} disabled={anchorSignature.isPending}>
                  {anchorSignature.isPending
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Anchor className="h-3 w-3" />}
                  Anchor my signature on Solana
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
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

interface SignatureRowProps {
  label: string;
  signedAt: string | null;
  hash: string | null;
  tx: string | null;
}

const SignatureRow = ({ label, signedAt, hash, tx }: SignatureRowProps) => {
  const signed = !!signedAt;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        {signed
          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          : <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/50" />}
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {signed ? `signed ${new Date(signedAt!).toLocaleDateString()}` : "not yet signed"}
        </span>
        {tx && (
          <a
            href={`https://solscan.io/tx/${tx}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-emerald-700 hover:underline"
          >
            <ShieldCheck className="h-3 w-3" /> on-chain <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
      {signed && hash && !tx && (
        <p className="pl-5 text-[10px] text-amber-600">awaiting Solana anchor…</p>
      )}
    </div>
  );
};

const MetaRow = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-3 min-h-[24px]">
    <div className="flex items-center gap-1.5 w-28 shrink-0 text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">{children}</div>
  </div>
);

const TeamCard = ({
  name, initial, avatar, role, signedAt, isYou,
}: {
  name: string; initial: string; avatar: string | null;
  role: string; signedAt: string | null; isYou?: boolean;
}) => (
  <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
    <Avatar className="h-9 w-9">
      {avatar ? <AvatarImage src={avatar} alt={name} /> : <AvatarFallback>{initial}</AvatarFallback>}
    </Avatar>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium truncate">{name}</p>
        {isYou && <Badge variant="outline" className="text-[9px] h-4">You</Badge>}
      </div>
      <p className="text-[11px] text-muted-foreground">{role}</p>
    </div>
    {signedAt ? (
      <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Signed
      </Badge>
    ) : (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">Pending</Badge>
    )}
  </div>
);


export default ProposalSheet;

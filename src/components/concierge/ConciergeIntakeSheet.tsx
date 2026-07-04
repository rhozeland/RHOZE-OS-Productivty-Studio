/**
 * ConciergeIntakeSheet — Phase 1 of the Concierge SKU.
 *
 * Surfaces the "Have Rhozeland scope this for me" intake form. Persists into
 * `concierge_requests` (status='new'). Admin reviews from /admin?tab=concierge.
 *
 * Fee model (v10.4): 25% with $250 min floor. No upfront scoping fee.
 * Sole curator at launch = the operator(s) with admin role.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, CheckCircle2, Clock, ShieldCheck, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGate } from "@/components/AuthGateDialog";
import { toast } from "sonner";

const CATEGORIES = [
  "Brand identity",
  "Video / Content",
  "Photo / Campaign",
  "Music / Audio",
  "Web / App",
  "Marketing / Launch",
  "Other",
];

const BUDGET_RANGES = [
  "Under $1k",
  "$1k–$5k",
  "$5k–$15k",
  "$15k–$50k",
  "$50k+",
];

type Tier = "curated" | "roster";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselect a tier when opened from the LaunchLadder. */
  initialTier?: Tier;
}

export function ConciergeIntakeSheet({ open, onOpenChange, initialTier }: Props) {
  const { user } = useAuth();
  const authGate = useAuthGate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [budgetRange, setBudgetRange] = useState<string | null>(null);
  const [deadline, setDeadline] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [tier, setTier] = useState<Tier>(initialTier ?? "curated");
  const [splitterAddress, setSplitterAddress] = useState("");

  // Sync tier when the parent passes a new initialTier (sheet reopened with a different ladder rung).
  useState(() => {
    if (initialTier) setTier(initialTier);
  });

  const reset = () => {
    setSummary("");
    setOutcome("");
    setCategory(null);
    setBudgetRange(null);
    setDeadline("");
    setContactEmail("");
    setTier(initialTier ?? "curated");
    setSplitterAddress("");
    setSubmitted(false);
  };

  const submit = async () => {
    if (!user) {
      onOpenChange(false);
      return authGate.requireAuth("request a Concierge scoping");
    }
    if (!summary.trim() || summary.trim().length < 20) {
      toast.error("Add a few more details — at least one solid sentence.");
      return;
    }
    setSubmitting(true);
    const payload = {
      client_id: user.id,
      summary: summary.trim(),
      outcome: outcome.trim() || null,
      category,
      budget_range: budgetRange,
      deadline: deadline || null,
      contact_email: contactEmail.trim() || user.email || null,
      tier,
      splitter_address: splitterAddress.trim() || null,
    };
    const { data: inserted, error } = await supabase
      .from("concierge_requests")
      .insert(payload)
      .select("id")
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Fire-and-forget internal ops alert to collab@rhozeland.com
    supabase.functions
      .invoke("send-transactional-email", {
        body: {
          templateName: "concierge-request-internal",
          recipientEmail: "collab@rhozeland.com",
          idempotencyKey: `concierge-internal-${inserted?.id ?? user.id}-${Date.now()}`,
          templateData: {
            category: category ?? "concierge",
            tier,
            submitterName: user.user_metadata?.full_name ?? null,
            submitterEmail: payload.contact_email,
            submitterId: user.id,
            summary: payload.summary,
            outcome: payload.outcome,
            budgetRange: payload.budget_range,
            deadline: payload.deadline,
            requestId: inserted?.id ?? null,
            source: "ConciergeIntakeSheet",
          },
        },
      })
      .catch((e) => console.warn("[concierge alert] email failed:", e));

    setSubmitted(true);
    toast.success("Request received — we'll be in touch.");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTimeout(reset, 300);
      }}
    >
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Rhozeland A&R
            </span>
          </div>
          <DialogTitle className="font-display text-2xl">
            Have Rhozeland scope your release.
          </DialogTitle>
          <DialogDescription className="text-sm">
            Tell us the release you want to ship. We'll scope it, pick the
            right artists & collaborators, and run the project end-to-end.
            25% platform fee ($250 min). Response within 48 hours.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="mt-8 space-y-4 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                We're on it.
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                You'll hear from the Rhozeland team within 48 hours with a
                scoped proposal — budget, timeline, and the creators we'd
                suggest.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" /> Track status in Messages soon.
            </div>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {/* Tier picker — Curated (A&R lite) vs Roster (full A&R) */}
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Which tier?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "curated", label: "Curated match", hint: "A&R lite. You stay in control." },
                  { id: "roster", label: "Full Roster", hint: "Co-piloted launch + A&R deal." },
                ] as { id: Tier; label: string; hint: string }[]).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      tier === t.id
                        ? "border-foreground bg-foreground/[0.04]"
                        : "border-border bg-card hover:border-foreground/30"
                    }`}
                  >
                    <div className="text-xs font-semibold">{t.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{t.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                What's the outcome you want? *
              </label>
              <Textarea
                placeholder="e.g. Drop a 4-track EP in Q3 with a coin launch the same day. Need a producer, a visual director, and a release roadmap."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="min-h-[110px]"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {summary.length}/600 — be specific about the result.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                How will you know it worked? (optional)
              </label>
              <Input
                placeholder="e.g. EP released, 50k streams in 30d, coin liquidity $25k+."
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c === category ? null : c)}
                    className={`text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                      category === c
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Budget range
              </label>
              <div className="flex flex-wrap gap-1.5">
                {BUDGET_RANGES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBudgetRange(b === budgetRange ? null : b)}
                    className={`text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                      budgetRange === b
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Deadline
                </label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Contact email
                </label>
                <Input
                  type="email"
                  placeholder={user?.email ?? "you@example.com"}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Roster-only: splitter wallet field */}
            {tier === "roster" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <label className="text-xs font-semibold text-foreground">
                    A&R splitter wallet (optional now, required to sign)
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Roster artists route pump.fun creator rewards through a Squads multisig
                  we both sign. Paste your multisig vault address if you've already deployed —
                  otherwise we'll walk you through it on the kickoff call.
                </p>
                <Input
                  placeholder="Squads vault address (Solana)"
                  value={splitterAddress}
                  onChange={(e) => setSplitterAddress(e.target.value)}
                  className="font-mono text-xs"
                />
                <Link
                  to="/ar-splitter"
                  className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 hover:underline"
                >
                  Read the 3-step setup guide
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </div>
            )}

            <Button
              onClick={submit}
              disabled={submitting || summary.trim().length < 20}
              className="rounded-full w-full gap-2"
            >
              {submitting ? "Sending…" : tier === "roster" ? "Apply to Roster" : "Request a match"}
              <Send className="h-3.5 w-3.5" />
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              No scoping fee. 25% platform fee on the final project (min $250).
              You approve the proposal before anything moves.
              <br />
              Settled in minutes, not months.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

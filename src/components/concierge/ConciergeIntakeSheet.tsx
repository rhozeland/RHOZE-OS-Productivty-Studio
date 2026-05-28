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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, CheckCircle2, Clock } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConciergeIntakeSheet({ open, onOpenChange }: Props) {
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

  const reset = () => {
    setSummary("");
    setOutcome("");
    setCategory(null);
    setBudgetRange(null);
    setDeadline("");
    setContactEmail("");
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
    const { error } = await supabase.from("concierge_requests").insert({
      client_id: user.id,
      summary: summary.trim(),
      outcome: outcome.trim() || null,
      category,
      budget_range: budgetRange,
      deadline: deadline || null,
      contact_email: contactEmail.trim() || user.email || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSubmitted(true);
    toast.success("Concierge request received.");
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTimeout(reset, 300);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Rhozeland Concierge
            </span>
          </div>
          <SheetTitle className="font-display text-2xl">
            Have Rhozeland scope it for you.
          </SheetTitle>
          <SheetDescription className="text-sm">
            Tell us the outcome you want. We'll scope it, pick the right
            creators, and run the project end-to-end. 25% platform fee
            ($250 min). Response within 48 hours.
          </SheetDescription>
        </SheetHeader>

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
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                What's the outcome you want? *
              </label>
              <Textarea
                placeholder="e.g. Launch a 4-piece beauty campaign across 3 micro-influencers in Korea, deliverables: short-form video + UGC."
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
                placeholder="e.g. 100k views, 3 finished assets, brand approval by Aug 1."
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

            <Button
              onClick={submit}
            <p className="text-[10px] text-muted-foreground text-center">
              No scoping fee. 25% platform fee on the final project (min $250).
              You approve the proposal before anything moves.
              <br />
              Settled in minutes, not months.
            </p>
              <Send className="h-3.5 w-3.5" />
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              No scoping fee. 25% platform fee on the final project (min $250).
              You approve the proposal before anything moves.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

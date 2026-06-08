/**
 * LaunchCoinFlowModal — 3-screen guided "Launch a Coin" experience.
 *
 * Screen 1: The Hook — coin preview card + pump.fun/Rhozeland framing.
 * Screen 2: Their Story — 3 AI-prefilled editable fields.
 * Screen 3: Confirmation — submitted to Rhozeland A&R team.
 *
 * Inserts a `concierge_requests` row (category="coin-launch") on submit.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, ArrowRight, Loader2, Rocket, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { deriveTicker } from "@/lib/pump-fun";
import { toast } from "sonner";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface LaunchCoinFlowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; title: string; description?: string | null } | null;
  /** Optional: where to send the user from the confirmation screen. */
  backHref?: string;
}

const GRADIENT =
  "linear-gradient(120deg, hsl(330 85% 60%) 0%, hsl(292 84% 61%) 25%, hsl(38 92% 55%) 50%, hsl(292 84% 61%) 75%, hsl(330 85% 60%) 100%)";

const DEFAULT_HOLDER_BENEFITS =
  "Early access to unreleased tracks, behind-the-scenes updates, and a share of streaming royalties.";

const truncate = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");

const buildPitch = (title: string, description?: string | null) => {
  const src = (description ?? "").trim();
  if (!src) return truncate(`${title} — a new release worth backing.`, 140);
  const firstSentence = src.split(/(?<=[.!?])\s/)[0] || src;
  return truncate(firstSentence, 140);
};

const LaunchCoinFlowModal = ({
  open,
  onOpenChange,
  project,
  backHref,
}: LaunchCoinFlowModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Pull avatar for the coin preview.
  const { data: profile } = useQuery({
    queryKey: ["launch-coin-profile", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url,display_name,username")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as any;
    },
  });

  const initialName = project?.title ?? "Untitled Release";
  const initialPitch = useMemo(
    () => buildPitch(initialName, project?.description),
    [initialName, project?.description],
  );

  const [coinName, setCoinName] = useState(initialName);
  const [pitch, setPitch] = useState(initialPitch);
  const [holderBenefits, setHolderBenefits] = useState(DEFAULT_HOLDER_BENEFITS);

  // Re-sync prefills when a different project opens the modal.
  useEffect(() => {
    if (open) {
      setStep(1);
      setCoinName(initialName);
      setPitch(initialPitch);
      setHolderBenefits(DEFAULT_HOLDER_BENEFITS);
    }
  }, [open, initialName, initialPitch]);

  const ticker = useMemo(() => deriveTicker(coinName), [coinName]);
  const displayName = profile?.display_name || profile?.username || "Artist";

  const submit = async () => {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }
    if (!coinName.trim() || !pitch.trim()) {
      toast.error("Coin name and pitch are required.");
      return;
    }
    setSubmitting(true);
    const summary = [
      `Coin: ${coinName.trim()} ($${ticker})`,
      `Pitch: ${pitch.trim()}`,
      `Holder benefits: ${holderBenefits.trim() || "—"}`,
      project ? `Project: ${project.title} (${project.id})` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: inserted, error } = await (supabase as any)
      .from("concierge_requests")
      .insert({
        client_id: user.id,
        summary,
        category: "coin-launch",
        outcome: `Launch $${ticker} on pump.fun with Rhozeland A&R support`,
        tier: "curated",
      })
      .select("id")
      .single();

    if (error) {
      setSubmitting(false);
      toast.error(error.message || "Could not submit. Try again.");
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
            category: "coin-launch",
            tier: "curated",
            submitterName: displayName,
            submitterEmail: user.email ?? null,
            submitterId: user.id,
            summary,
            outcome: `Launch $${ticker} on pump.fun with Rhozeland A&R support`,
            requestId: inserted?.id ?? null,
            source: "LaunchCoinFlowModal",
          },
        },
      })
      .catch((e) => console.warn("[concierge alert] email failed:", e));

    setSubmitting(false);
    setStep(3);
  };

  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl w-[95vw] p-0 overflow-hidden border-border bg-background gap-0 [&>button]:hidden"
      >
        <VisuallyHidden>
          <DialogTitle>Launch a Coin</DialogTitle>
          <DialogDescription>
            Three step flow to submit your release coin to Rhozeland's A&R team.
          </DialogDescription>
        </VisuallyHidden>

        {/* Close (top right) */}
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 z-20 h-8 w-8 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Back (top left, step 2 only) */}
        {step === 2 && (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="absolute left-3 top-3 z-20 h-8 w-8 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        {/* ── Screen 1 ───────────────────────────────────────── */}
        {step === 1 && (
          <div className="relative px-6 pt-12 pb-6 sm:px-10 sm:pt-14 sm:pb-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(circle at 50% 38%, hsl(330 85% 60% / 0.18), transparent 55%), radial-gradient(circle at 50% 70%, hsl(38 92% 55% / 0.14), transparent 60%)",
              }}
            />
            <div className="relative">
              <div className="text-center space-y-1.5 mb-6">
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                  You're about to launch your coin
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Rhozeland handles everything — wallet, launch, and listing on pump.fun
                </p>
              </div>

              {/* Coin preview card */}
              <div className="relative mx-auto max-w-xs">
                <div
                  aria-hidden
                  className="absolute -inset-6 rounded-full blur-3xl opacity-70"
                  style={{
                    background:
                      "radial-gradient(circle, hsl(330 85% 60% / 0.55) 0%, hsl(38 92% 55% / 0.35) 45%, transparent 75%)",
                  }}
                />
                <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur px-6 py-7 text-center">
                  <Avatar className="h-24 w-24 mx-auto ring-2 ring-border">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                    <AvatarFallback className="text-2xl">
                      {displayName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="mt-4 font-display text-lg font-bold leading-tight">
                    {coinName}
                  </p>
                  <p
                    className="mt-1 font-display text-2xl font-extrabold tracking-tight bg-clip-text text-transparent"
                    style={{ backgroundImage: GRADIENT }}
                  >
                    ${ticker}
                  </p>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Launching on pump.fun · With Rhozeland
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setStep(2)}
                className="mt-8 w-full h-12 text-base font-semibold text-white border-0 shadow-lg hover:opacity-95"
                style={{ background: GRADIENT }}
              >
                Let's launch <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Screen 2 ───────────────────────────────────────── */}
        {step === 2 && (
          <div className="px-6 pt-12 pb-6 sm:px-10 sm:pt-14 sm:pb-8 space-y-5">
            <div className="text-center space-y-1.5">
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Tell us about this release
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Our A&R team uses this to set up your coin. We've filled in what we know.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="coin-name" className="flex items-center gap-1.5">
                  Coin name
                  <Sparkles className="h-3 w-3 text-fuchsia-500" />
                </Label>
                <Input
                  id="coin-name"
                  value={coinName}
                  onChange={(e) => setCoinName(e.target.value)}
                  maxLength={80}
                  className="border-fuchsia-500/40 focus-visible:border-fuchsia-500"
                />
                <p className="text-[11px] text-muted-foreground">
                  Ticker preview: <span className="font-semibold text-foreground">${ticker}</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coin-pitch" className="flex items-center gap-1.5">
                  What's this release about?
                  <Sparkles className="h-3 w-3 text-fuchsia-500" />
                </Label>
                <Textarea
                  id="coin-pitch"
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value.slice(0, 140))}
                  maxLength={140}
                  rows={3}
                  className="border-fuchsia-500/40 focus-visible:border-fuchsia-500 resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {pitch.length}/140
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coin-benefits" className="flex items-center gap-1.5">
                  What do your holders get?
                  <Sparkles className="h-3 w-3 text-fuchsia-500" />
                </Label>
                <Textarea
                  id="coin-benefits"
                  value={holderBenefits}
                  onChange={(e) => setHolderBenefits(e.target.value)}
                  placeholder="Early access, exclusive updates, split royalties"
                  rows={3}
                  className="border-fuchsia-500/40 focus-visible:border-fuchsia-500 resize-none"
                />
              </div>
            </div>

            <Button
              onClick={submit}
              disabled={submitting}
              className="w-full h-12 text-base font-semibold text-white border-0 shadow-lg hover:opacity-95"
              style={{ background: GRADIENT }}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  Submit to Rhozeland <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* ── Screen 3 ───────────────────────────────────────── */}
        {step === 3 && (
          <div className="relative px-6 pt-14 pb-8 sm:px-10 sm:pt-16 sm:pb-10 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 30%, hsl(330 85% 60% / 0.25), transparent 60%), radial-gradient(circle at 50% 75%, hsl(38 92% 55% / 0.2), transparent 65%)",
              }}
            />
            <div className="relative space-y-5">
              <div
                className="mx-auto h-20 w-20 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-500"
                style={{ background: GRADIENT }}
              >
                <Rocket className="h-10 w-10 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-3xl font-bold tracking-tight">
                  You're on the launchpad 🚀
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Rhozeland's A&R team will reach out within 24 hours to get your coin
                  live on pump.fun. Keep building in public while you wait.
                </p>
              </div>

              <Button
                onClick={() => {
                  close();
                  if (backHref) navigate(backHref);
                }}
                className="w-full h-12 text-base font-semibold text-white border-0 shadow-lg hover:opacity-95"
                style={{ background: GRADIENT }}
              >
                Back to my project
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Questions? Email us at{" "}
                <a
                  href="mailto:collab@rhozeland.com"
                  className="underline hover:text-foreground"
                >
                  collab@rhozeland.com
                </a>
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LaunchCoinFlowModal;

/**
 * LaunchCoinFlowModal — guided "Launch a Coin" experience.
 *
 * Screen 0: Pick a release — only shown when no project is preselected.
 *           Lists the user's projects + a "pitch us an idea" escape hatch.
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
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Rocket,
  Sparkles,
  X,
  Lightbulb,
  FolderOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { deriveTicker } from "@/lib/pump-fun";
import { toast } from "sonner";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import PitchNewIdeaDialog from "./PitchNewIdeaDialog";

type PickerProject = { id: string; title: string; description?: string | null };

interface LaunchCoinFlowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Pre-selected project. When omitted/null, the modal opens with a picker
   * letting the user choose from their existing releases or pitch a new idea.
   */
  project: PickerProject | null;
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

  const startStep: 0 | 1 = project ? 1 : 0;
  const [step, setStep] = useState<0 | 1 | 2 | 3>(startStep);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PickerProject | null>(project);
  const [pitchOpen, setPitchOpen] = useState(false);


  const activeProject = selectedProject ?? project;

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

  // Fetch the user's own projects for the picker step.
  const { data: myProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ["launch-coin-my-projects", user?.id],
    enabled: !!user && open && !project,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,description,linked_token_id,updated_at")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as Array<
        PickerProject & { linked_token_id: string | null; updated_at: string }
      >;
    },
  });

  const initialName = activeProject?.title ?? "Untitled Release";
  const initialPitch = useMemo(
    () => buildPitch(initialName, activeProject?.description),
    [initialName, activeProject?.description],
  );

  const [coinName, setCoinName] = useState(initialName);
  const [pitch, setPitch] = useState(initialPitch);
  const [holderBenefits, setHolderBenefits] = useState(DEFAULT_HOLDER_BENEFITS);

  // Re-sync prefills when the modal opens or the selected project changes.
  useEffect(() => {
    if (open) {
      setStep(project ? 1 : 0);
      setSelectedProject(project);
    }
  }, [open, project]);

  useEffect(() => {
    if (open) {
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
      activeProject ? `Project: ${activeProject.title} (${activeProject.id})` : null,
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

  const confirmationHref =
    backHref ?? (activeProject ? `/projects/${activeProject.id}` : "/my-projects");

  return (
    <>
    <PitchNewIdeaDialog open={pitchOpen} onOpenChange={setPitchOpen} />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-border bg-background gap-0 [&>button]:hidden"
      >
        <VisuallyHidden>
          <DialogTitle>Launch a Coin</DialogTitle>
          <DialogDescription>
            Pick a release (or pitch a new idea) and submit it to Rhozeland's A&R team to coin it on pump.fun.
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

        {/* Back (top left, steps 1 & 2) */}
        {(step === 1 || step === 2) && (
          <button
            type="button"
            onClick={() => {
              if (step === 2) setStep(1);
              else if (step === 1 && !project) setStep(0);
              else close();
            }}
            className="absolute left-3 top-3 z-20 h-8 w-8 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        {/* ── Screen 0 — Project picker ──────────────────────── */}
        {step === 0 && (
          <div className="relative px-6 pt-12 pb-6 sm:px-10 sm:pt-14 sm:pb-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(circle at 50% 30%, hsl(330 85% 60% / 0.15), transparent 55%), radial-gradient(circle at 50% 80%, hsl(38 92% 55% / 0.12), transparent 60%)",
              }}
            />
            <div className="relative">
              <div className="text-center space-y-1.5 mb-6">
                <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words">
                  Which release are you coining?
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Pick one of your existing releases — or pitch us a new idea and we'll build it with you.
                </p>
              </div>

              {/* Project list */}
              <div className="space-y-2 max-h-[44vh] overflow-y-auto -mx-1 px-1">
                {projectsLoading && (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading your releases…
                  </div>
                )}

                {!projectsLoading && (myProjects ?? []).length === 0 && (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                    You haven't started a release yet.
                  </div>
                )}

                {!projectsLoading &&
                  (myProjects ?? []).map((p) => {
                    const alreadyCoined = !!p.linked_token_id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={alreadyCoined}
                        onClick={() => {
                          setSelectedProject({
                            id: p.id,
                            title: p.title,
                            description: p.description ?? null,
                          });
                          setStep(1);
                        }}
                        className="group w-full text-left flex items-center gap-3 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-fuchsia-500/40 transition px-3 py-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-card/60 disabled:hover:border-border"
                      >
                        <div className="h-9 w-9 shrink-0 rounded-lg bg-foreground/5 flex items-center justify-center">
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{p.title}</p>
                          {p.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {p.description}
                            </p>
                          )}
                        </div>
                        {alreadyCoined ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                            Coined
                          </span>
                        ) : (
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition" />
                        )}
                      </button>
                    );
                  })}
              </div>

              {/* Divider */}
              <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <div className="flex-1 h-px bg-border" />
                or
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* New idea escape hatch */}
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(() => setPitchOpen(true), 150);
                }}
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-amber-500/40 transition px-3 py-3 text-left"
              >
                <div className="h-9 w-9 shrink-0 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">Pitch us a new idea</p>
                  <p className="text-xs text-muted-foreground">
                    Send our A&R team a proposal — we'll plan the release and the coin together.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
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
                {activeProject && (
                  <p className="text-xs text-muted-foreground/80">
                    For release:{" "}
                    <span className="font-medium text-foreground">{activeProject.title}</span>
                  </p>
                )}
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
                  navigate(confirmationHref);
                }}
                className="w-full h-12 text-base font-semibold text-white border-0 shadow-lg hover:opacity-95"
                style={{ background: GRADIENT }}
              >
                {activeProject ? "Back to my project" : "View my projects"}
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
    </>
  );
};

export default LaunchCoinFlowModal;

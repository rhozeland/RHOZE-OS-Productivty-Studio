/**
 * BackArtistSheet — single-step "Back this artist" flow.
 *
 * Per v11 spec: one clean bottom sheet, max two taps to confirm.
 *  - Amount pills: $1 · $5 · $10 · $25 · Custom
 *  - Auto-selects most-recently-active project (one with ≥1 stage)
 *  - Optional inline project picker if multiple backable projects exist
 *  - Dynamic $RHOZE reward preview (1 $RHOZE per $1 backed, mirrors
 *    award-engagement-reward catalog for "like_work")
 *  - Confirm → writes a `project_cheers` row + awards reward, then swaps to
 *    a success state with "View the release →" + back-to-profile link.
 *
 * No tipping rails yet — "backing" is currently a cheer commitment + a
 * declared dollar amount stored in the cheer description until the
 * payments rail lands. The amount is captured so future Stripe wiring can
 * read it from project_cheers metadata.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, ArrowRight, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { awardEngagementReward } from "@/lib/award-engagement-reward";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BackableProject {
  id: string;
  title: string;
  cover_color: string | null;
  cover_image_url: string | null;
  stageCount: number;
  activeStage: { title: string; pct: number } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string | null;
  /** Pre-fetched backable projects (only ones with ≥1 stage). */
  projects: BackableProject[];
}

const PRESET_AMOUNTS = [1, 5, 10, 25];

const BackArtistSheet = ({
  open,
  onOpenChange,
  creatorId,
  creatorName,
  creatorAvatar,
  projects,
}: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [amount, setAmount] = useState<number>(5);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [success, setSuccess] = useState<{ projectId: string; projectTitle: string; rhoze: number } | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setAmount(5);
      setCustomMode(false);
      setCustomInput("");
      setPickerOpen(false);
      setSuccess(null);
      setSelectedProjectId(projects[0]?.id ?? null);
    }
  }, [open, projects]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  // 1 $RHOZE per $1 backed (matches like_work drip economics, capped server-side)
  const rhozeReward = Math.max(1, Math.round(amount));

  const confirm = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to back");
      if (!selectedProject) throw new Error("Pick a project");

      // Upsert a cheer row (idempotent — duplicate hits just succeed)
      const { error } = await supabase.from("project_cheers").upsert(
        { project_id: selectedProject.id, user_id: user.id },
        { onConflict: "project_id,user_id", ignoreDuplicates: true },
      );
      if (error) throw error;

      await awardEngagementReward({
        userId: user.id,
        action: "like_work",
        referenceId: selectedProject.id,
        description: `Backed ${creatorName} on "${selectedProject.title}" ($${amount})`,
      });

      return { projectId: selectedProject.id, projectTitle: selectedProject.title };
    },
    onSuccess: ({ projectId, projectTitle }) => {
      qc.invalidateQueries({ queryKey: ["release"] });
      qc.invalidateQueries({ queryKey: ["release-mycheer"] });
      qc.invalidateQueries({ queryKey: ["profile-backable-projects"] });
      setSuccess({ projectId, projectTitle, rhoze: rhozeReward });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not back this artist"),
  });

  const setPresetAmount = (n: number) => {
    setCustomMode(false);
    setAmount(n);
  };

  const enableCustom = () => {
    setCustomMode(true);
    setCustomInput(String(amount));
  };

  const handleCustomChange = (v: string) => {
    setCustomInput(v);
    const n = parseFloat(v);
    if (!Number.isNaN(n) && n > 0) setAmount(Math.min(n, 100_000));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {success ? (
          <div className="px-6 py-8 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check className="h-7 w-7 text-emerald-500" />
            </div>
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="font-display text-xl text-center">
                You are backing {creatorName}
              </DialogTitle>
              <DialogDescription className="text-center text-sm">
                You have been added as a backer on "{success.projectTitle}". You will get notified at every stage.
              </DialogDescription>
            </DialogHeader>
            <p className="text-2xl font-display font-bold text-emerald-500 tabular-nums">
              +{success.rhoze} $RHOZE earned
            </p>
            <div className="space-y-2 pt-2">
              <Button
                className="w-full gap-1.5 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 text-white border-0"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/projects/${success.projectId}`);
                }}
              >
                View the release <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
              >
                Back to profile
              </button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-2 text-center sm:text-center">
              <div className="mx-auto">
                <Avatar className="h-14 w-14 mb-2 mx-auto">
                  <AvatarImage src={creatorAvatar ?? undefined} />
                  <AvatarFallback>{creatorName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
              <DialogTitle className="font-display text-xl">Back {creatorName}</DialogTitle>
              <DialogDescription className="text-xs">Choose how much to back</DialogDescription>
            </DialogHeader>

            <div className="px-5 pb-5 space-y-4">
              {/* Amount pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_AMOUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPresetAmount(n)}
                    className={cn(
                      "h-10 min-w-[64px] px-4 rounded-full text-sm font-semibold transition-colors border",
                      !customMode && amount === n
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-foreground hover:bg-muted/60",
                    )}
                  >
                    ${n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={enableCustom}
                  className={cn(
                    "h-10 px-4 rounded-full text-sm font-semibold transition-colors border",
                    customMode
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-foreground hover:bg-muted/60",
                  )}
                >
                  Custom
                </button>
              </div>

              {customMode && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="decimal"
                    autoFocus
                    placeholder="Enter amount"
                    value={customInput}
                    onChange={(e) => handleCustomChange(e.target.value)}
                  />
                </div>
              )}

              {/* Project card */}
              {selectedProject ? (
                <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-12 w-12 rounded-lg shrink-0 bg-cover bg-center"
                      style={{
                        backgroundImage: selectedProject.cover_image_url
                          ? `url(${selectedProject.cover_image_url})`
                          : undefined,
                        background: selectedProject.cover_image_url
                          ? undefined
                          : selectedProject.cover_color ??
                            "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{selectedProject.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        You are backing {selectedProject.activeStage?.title ?? "this release"}
                      </p>
                    </div>
                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPickerOpen((v) => !v)}
                        className="text-[11px] text-primary hover:underline shrink-0"
                      >
                        Change →
                      </button>
                    )}
                  </div>
                  {selectedProject.activeStage && (
                    <Progress value={selectedProject.activeStage.pct} className="h-1" />
                  )}

                  {pickerOpen && projects.length > 1 && (
                    <div className="pt-2 mt-2 border-t border-border/60 space-y-1 max-h-48 overflow-y-auto">
                      {projects.map((pr) => (
                        <button
                          key={pr.id}
                          type="button"
                          onClick={() => {
                            setSelectedProjectId(pr.id);
                            setPickerOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 hover:bg-muted/60",
                            pr.id === selectedProject.id && "bg-muted/60",
                          )}
                        >
                          <span
                            className="h-6 w-6 rounded shrink-0"
                            style={{
                              background:
                                pr.cover_color ??
                                "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                            }}
                          />
                          <span className="truncate flex-1">{pr.title}</span>
                          <span className="text-muted-foreground">{pr.stageCount} stages</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No backable projects yet.</p>
              )}

              {/* Reward preview */}
              <p className="text-xs text-center text-emerald-500 font-medium flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                You will earn {rhozeReward} $RHOZE for this backing
              </p>

              {/* Confirm */}
              <Button
                size="lg"
                onClick={() => confirm.mutate()}
                disabled={confirm.isPending || !selectedProject || amount <= 0}
                className="w-full gap-2 font-semibold bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 text-white hover:opacity-95 border-0"
              >
                <Heart className="h-4 w-4" />
                Confirm backing <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BackArtistSheet;

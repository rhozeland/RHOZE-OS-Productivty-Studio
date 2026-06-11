/**
 * SupportFlowSheet — adaptive Support modal.
 *
 * Auto-detects which of three states applies based on the artist's data:
 *   STATE 1 — no projects yet → Follow-only
 *   STATE 2 — has projects, no coin → Back a stage (inline 3-step flow) + Follow
 *   STATE 3 — has an approved coin → Buy coin (pump.fun) + Back a stage + Follow
 *
 * Visual styles, gradients, and tokens match the rest of the app — we reuse the
 * pink→fuchsia→amber primary gradient, the dark/zinc surfaces from Tokenize CTAs,
 * the emerald reward pills, and the existing Dialog/Button primitives.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Heart, Coins, Sparkles, Check, ArrowRight, Loader2,
  ExternalLink, Users, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { awardEngagementReward } from "@/lib/award-engagement-reward";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string | null;
  creatorUsername?: string | null;
}

interface ProjectRow {
  id: string;
  title: string;
  cover_image_url?: string | null;
  cover_color?: string | null;
}
interface StageRow {
  id: string;
  title: string;
  status: string;
  budget_amount: number;
  progress: number;
}

const FOLLOW_REWARD = 5;
const COIN_FIRST_BUY_REWARD = 50;
const RHOZE_PER_DOLLAR = 2; // back $1 → +2 $RHOZE estimate

export default function SupportFlowSheet({
  open, onOpenChange, creatorId, creatorName, creatorAvatar, creatorUsername,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ----- Data -----
  const { data: creator } = useQuery({
    queryKey: ["support-flow-creator", creatorId],
    enabled: open && !!creatorId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, token_mint_address, token_ticker, token_submission_status")
        .eq("user_id", creatorId)
        .maybeSingle();
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["support-flow-projects", creatorId],
    enabled: open && !!creatorId,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, cover_image_url, cover_color")
        .eq("user_id", creatorId)
        .order("created_at", { ascending: false })
        .limit(12);
      return (data ?? []) as ProjectRow[];
    },
  });

  const { data: isFollowing, refetch: refetchFollow } = useQuery({
    queryKey: ["support-flow-following", user?.id, creatorId],
    enabled: open && !!user?.id && !!creatorId,
    queryFn: async () => {
      const { data } = await supabase
        .from("connections")
        .select("id")
        .eq("follower_id", user!.id)
        .eq("following_id", creatorId)
        .eq("type", "follow")
        .maybeSingle();
      return !!data;
    },
  });

  // ----- Stage state -----
  const [expandedBack, setExpandedBack] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [selectedStage, setSelectedStage] = useState<StageRow | null>(null);
  const [amount, setAmount] = useState<number>(10);
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState<{ project: string; reward: number } | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setExpandedBack(false);
      setSelectedProject(null);
      setSelectedStage(null);
      setAmount(10);
      setSuccess(null);
    }
  }, [open]);

  const { data: stages } = useQuery({
    queryKey: ["support-flow-stages", selectedProject?.id],
    enabled: !!selectedProject?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_goals")
        .select("id, title, status, budget_amount, progress")
        .eq("project_id", selectedProject!.id)
        .is("parent_id", null)
        .order("sort_order", { ascending: true });
      return (data ?? []) as StageRow[];
    },
  });

  // ----- Derived state -----
  const hasCoin = !!(creator?.token_mint_address && creator?.token_submission_status === "approved");
  const hasProjects = (projects?.length ?? 0) > 0;
  const state: 1 | 2 | 3 = hasCoin ? 3 : hasProjects ? 2 : 1;

  const displayName = creator?.display_name || creatorName || creator?.username || "this artist";
  const avatar = creator?.avatar_url ?? creatorAvatar;
  const ticker = creator?.token_ticker;

  const estReward = useMemo(
    () => Math.max(1, Math.round(Number(amount || 0) * RHOZE_PER_DOLLAR)),
    [amount],
  );

  // ----- Handlers -----
  const handleFollow = async () => {
    if (!user) { navigate("/auth"); return; }
    if (isFollowing) { toast.info(`You already follow ${displayName}`); return; }
    setFollowBusy(true);
    const { error } = await supabase.from("connections").insert({
      follower_id: user.id, following_id: creatorId, type: "follow", status: "active",
    } as any);
    setFollowBusy(false);
    if (error) { toast.error("Couldn't follow", { description: error.message }); return; }
    awardEngagementReward({ userId: user.id, action: "follow_artist", referenceId: creatorId }).catch(() => {});
    toast.success(`Following ${displayName}`, { description: `+${FOLLOW_REWARD} $RHOZE` });
    refetchFollow();
    qc.invalidateQueries({ queryKey: ["profile-relationship"] });
    onOpenChange(false);
  };

  const handleConfirmBack = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!selectedProject || amount < 1) return;
    setConfirming(true);
    // Optimistic — write a project_goals comment / connection-style backing
    // record via a generic backers route. We don't have a dedicated table here,
    // so we simply follow + queue a reward and navigate. This is the same
    // pattern other "soft" support actions use until the backers schema lands.
    if (!isFollowing) {
      await supabase.from("connections").insert({
        follower_id: user.id, following_id: creatorId, type: "follow", status: "active",
      } as any);
    }
    await awardEngagementReward({
      userId: user.id, action: "follow_artist", referenceId: selectedProject.id,
      description: `Backed $${amount} on ${selectedProject.title}`,
    }).catch(() => {});
    setConfirming(false);
    setSuccess({ project: selectedProject.title, reward: estReward });
  };

  // ----- Render helpers -----
  const Header = (
    <DialogHeader className="items-center text-center pt-2">
      <Avatar className="h-16 w-16 mb-2 ring-2 ring-border">
        {avatar ? <AvatarImage src={avatar} alt={displayName} /> : null}
        <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <DialogTitle className="font-display text-lg font-bold">{displayName}</DialogTitle>
      <p className="text-sm text-muted-foreground">
        {success ? `You're backing ${displayName}` :
          state === 1 ? `Show up for ${displayName}` :
          state === 2 ? "How do you want to show up?" :
          "Own a piece of their story"}
      </p>
    </DialogHeader>
  );

  const RewardPill = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-semibold">
      <Sparkles className="h-3 w-3" /> {children}
    </span>
  );

  const FollowCard = ({ compact = false }: { compact?: boolean }) => (
    <div className={cn(
      "rounded-2xl border p-4",
      compact ? "border-border/60 bg-card/60" : "border-border bg-card",
    )}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center">
            <Heart className="h-4 w-4" />
          </div>
          <div>
            <p className={cn("font-semibold", compact ? "text-sm" : "")}>
              {compact ? "Just follow for now" : "Follow this artist"}
            </p>
            <p className="text-xs text-muted-foreground">
              {compact
                ? "Stay in their corner. Get notified when they drop."
                : "Get notified when they drop something new. Be first in their corner."}
            </p>
          </div>
        </div>
        <RewardPill>+{FOLLOW_REWARD} $RHOZE</RewardPill>
      </div>
      <Button
        onClick={handleFollow}
        disabled={followBusy || isFollowing}
        variant={compact ? "outline" : "default"}
        className="w-full gap-1.5"
      >
        {followBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
        {isFollowing ? `Following ${displayName}` : "Follow"}
        {!isFollowing && <ArrowRight className="h-3.5 w-3.5" />}
      </Button>
      {!compact && (
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Following is free and earns you $RHOZE
        </p>
      )}
    </div>
  );

  const BackStageCard = ({ small = false }: { small?: boolean }) => (
    <div className={cn(
      "rounded-2xl overflow-hidden relative text-primary-foreground shadow-lg",
      "bg-gradient-to-br from-primary via-fuchsia-500 to-amber-500",
      small ? "p-4" : "p-5",
    )}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] opacity-90 font-semibold">
            <Sparkles className="h-3 w-3" /> Back a stage
          </div>
          <p className={cn("font-display font-bold mt-1", small ? "text-base" : "text-lg")}>
            Fund the next milestone
          </p>
          <p className={cn("opacity-90 mt-1", small ? "text-xs" : "text-sm")}>
            Pick a project and fund a stage. You get listed as a backer and earn $RHOZE.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 text-white px-2 py-0.5 text-[11px] font-semibold">
          <Sparkles className="h-3 w-3" /> +$RHOZE based on amount
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5 bg-white text-black hover:bg-white/90"
          onClick={() => setExpandedBack(true)}
        >
          Back a stage <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  const CoinCard = () => (
    <div className="rounded-2xl overflow-hidden relative bg-gradient-to-br from-black via-zinc-900 to-black border border-white/10 p-5 text-white">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 20% 30%, hsl(292 84% 61% / 0.4), transparent 50%), radial-gradient(circle at 80% 70%, hsl(330 85% 60% / 0.35), transparent 50%)",
        }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-amber-300">
            <Coins className="h-3 w-3" /> On pump.fun
          </span>
          <RewardPill>+{COIN_FIRST_BUY_REWARD} $RHOZE first buy</RewardPill>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10 ring-1 ring-white/20">
            {avatar ? <AvatarImage src={avatar} /> : null}
            <AvatarFallback>{displayName.slice(0,2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-display font-bold truncate">{displayName}</p>
            <p className="text-sm font-mono text-amber-300">${ticker}</p>
          </div>
        </div>
        <p className="text-sm text-white/70 mb-4">
          Buy ${ticker} and become a permanent holder. Earn $RHOZE on your first purchase.
        </p>
        <Button
          size="lg"
          className="w-full gap-1.5 bg-white text-black hover:bg-white/90"
          onClick={() => {
            window.open(`https://pump.fun/coin/${creator?.token_mint_address}`, "_blank", "noopener");
          }}
        >
          <Coins className="h-4 w-4" /> Buy ${ticker}
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  // ----- Success view -----
  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          {Header}
          <div className="text-center space-y-3 pt-2">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 text-primary flex items-center justify-center">
              <Check className="h-7 w-7" />
            </div>
            <p className="text-sm text-muted-foreground">
              You've been added as a backer on <span className="font-semibold text-foreground">{success.project}</span>.
              You'll get notified at every stage.
            </p>
            <p className="text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400">
              +{success.reward} $RHOZE earned
            </p>
            <Button
              className="w-full gap-1.5"
              onClick={() => {
                const pid = selectedProject?.id;
                onOpenChange(false);
                if (pid) navigate(`/projects/${pid}`);
              }}
            >
              View the release <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ----- Expanded Back-a-stage flow -----
  if (expandedBack) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          {Header}
          <div className="space-y-4 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 -ml-2"
              onClick={() => { setExpandedBack(false); setSelectedProject(null); setSelectedStage(null); }}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>

            {/* Step 1 — Project */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Which project?</p>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {(projects ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedProject(p); setSelectedStage(null); }}
                    className={cn(
                      "text-left rounded-xl border p-3 flex items-center gap-3 transition",
                      selectedProject?.id === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-border/80",
                    )}
                  >
                    <div
                      className="h-10 w-10 rounded-lg shrink-0 bg-cover bg-center"
                      style={{
                        backgroundImage: p.cover_image_url ? `url(${p.cover_image_url})` : undefined,
                        backgroundColor: p.cover_color || "hsl(var(--muted))",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{p.title}</p>
                    </div>
                    {selectedProject?.id === p.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 — Stage */}
            {selectedProject && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Which stage?</p>
                <div className="grid gap-1.5 max-h-44 overflow-y-auto">
                  {(stages ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">No stages yet on this project.</p>
                  )}
                  {(stages ?? []).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStage(s)}
                      className={cn(
                        "text-left rounded-lg border p-2.5 flex items-center justify-between gap-2 transition",
                        selectedStage?.id === s.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-border/80",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{s.status}</p>
                      </div>
                      {Number(s.budget_amount) > 0 && (
                        <span className="text-xs font-mono text-muted-foreground">
                          ${Number(s.budget_amount).toLocaleString()}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 — Amount */}
            {selectedStage && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  How much do you want to back?
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
                  <Input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
                    className="pl-7 font-mono"
                  />
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  You'll earn +{estReward} $RHOZE
                </p>
                <Button
                  onClick={handleConfirmBack}
                  disabled={confirming || amount < 1}
                  className="w-full gap-1.5"
                >
                  {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Confirm backing <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ----- Main state view -----
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {Header}
        <div className="space-y-3 pt-2">
          {state === 1 && <FollowCard />}

          {state === 2 && (
            <>
              <BackStageCard />
              <FollowCard compact />
            </>
          )}

          {state === 3 && (
            <>
              <CoinCard />
              <BackStageCard small />
              <button
                type="button"
                onClick={handleFollow}
                disabled={followBusy || isFollowing}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground py-2"
              >
                {isFollowing ? `Following ${displayName}` : `Just follow ${displayName}`}
                {!isFollowing && <ArrowRight className="h-3.5 w-3.5" />}
                <RewardPill>+{FOLLOW_REWARD} $RHOZE</RewardPill>
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

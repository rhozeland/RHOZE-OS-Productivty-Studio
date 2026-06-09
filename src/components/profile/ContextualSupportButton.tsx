/**
 * ContextualSupportButton — single right-aside CTA on visitor profiles.
 *
 * Per v11 spec, the label + behavior adapt to the artist's current status:
 *
 *   1. Approved pump.fun coin    → "Buy $TICKER" (dark gradient, Coins icon)
 *                                  Opens pump.fun in a new tab. One tap.
 *   2. ≥1 project with ≥1 stage  → "Back this artist" (pink→orange,
 *                                  Heart icon) opens <BackArtistSheet />.
 *   3. Otherwise                  → "Follow" / "Following ✓" (outline,
 *                                  UserPlus / Heart-filled). Instant
 *                                  action with a $RHOZE-pill toast.
 *
 * Backable project = at least one row in `project_goals` (a "stage").
 * Projects with zero stages are filtered out of the picker entirely.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Coins, Heart, UserPlus, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BackArtistSheet from "./BackArtistSheet";

interface Props {
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string | null;
  isFollowing: boolean;
  followPending: boolean;
  onFollow: () => void;
}

const ContextualSupportButton = ({
  creatorId,
  creatorName,
  creatorAvatar,
  tokenMintAddress,
  tokenTicker,
  tokenStatus,
  isFollowing,
  followPending,
  onFollow,
}: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [backOpen, setBackOpen] = useState(false);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);

  // ── Backable projects: any project owned by this creator with ≥1 stage ──
  const { data: backableProjects, isLoading: backableLoading } = useQuery({
    queryKey: ["profile-backable-projects", creatorId],
    queryFn: async () => {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title, cover_color, cover_image_url, created_at")
        .eq("user_id", creatorId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!projects || projects.length === 0) return [];

      const ids = projects.map((p) => p.id);
      const { data: goals } = await supabase
        .from("project_goals")
        .select("project_id, title, status, position")
        .in("project_id", ids)
        .order("position", { ascending: true });

      const byProject = new Map<string, any[]>();
      (goals ?? []).forEach((g: any) => {
        if (!byProject.has(g.project_id)) byProject.set(g.project_id, []);
        byProject.get(g.project_id)!.push(g);
      });

      return projects
        .map((p) => {
          const stages = byProject.get(p.id) ?? [];
          if (stages.length === 0) return null;
          const completed = stages.filter(
            (s) => s.status === "approved" || s.status === "released" || s.status === "done" || s.status === "completed",
          ).length;
          const active = stages.find((s) => s.status !== "approved" && s.status !== "released") ?? stages[0];
          return {
            id: p.id,
            title: p.title,
            cover_color: p.cover_color,
            cover_image_url: p.cover_image_url,
            stageCount: stages.length,
            activeStage: {
              title: active?.title ?? "Next stage",
              pct: stages.length ? Math.round((completed / stages.length) * 100) : 0,
            },
          };
        })
        .filter(Boolean) as any[];
    },
    enabled: !!creatorId,
    staleTime: 30_000,
  });

  const hasApprovedCoin =
    !!tokenMintAddress &&
    !!tokenTicker &&
    (tokenStatus === "approved" || !tokenStatus); // legacy rows w/ no status field

  const mode: "coin" | "back" | "follow" = useMemo(() => {
    if (hasApprovedCoin) return "coin";
    if ((backableProjects?.length ?? 0) > 0) return "back";
    return "follow";
  }, [hasApprovedCoin, backableProjects]);

  // ── Handlers ──
  const handleBuyCoin = () => {
    if (!tokenMintAddress) return;
    window.open(`https://pump.fun/coin/${tokenMintAddress}`, "_blank", "noopener,noreferrer");
  };

  const handleBack = () => {
    if (!user) return navigate("/auth");
    setBackOpen(true);
  };

  const handleFollowTap = () => {
    if (!user) return navigate("/auth");
    if (isFollowing) {
      setConfirmUnfollow(true);
      return;
    }
    onFollow();
    // Show $RHOZE-pill toast (auto-dismiss ~2s by sonner default)
    toast.custom(
      (t) => (
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-lg px-4 py-3 flex items-center gap-3">
          <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
          <span className="text-sm font-medium">You are now following {creatorName}</span>
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
            +5 $RHOZE
          </span>
        </div>
      ),
      { duration: 2000 },
    );
  };

  // ── Render ──
  if (backableLoading) {
    return (
      <div className="w-full rounded-2xl p-5 bg-muted/40 border border-border flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mode === "coin") {
    return (
      <button
        type="button"
        onClick={handleBuyCoin}
        className="w-full text-left rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg hover:opacity-95 transition-opacity border border-emerald-500/30"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-80">
          <Coins className="h-3.5 w-3.5 text-emerald-400" /> Trade on pump.fun
        </div>
        <p className="font-display text-lg font-bold mt-2 flex items-center gap-2">
          Buy ${tokenTicker} <ArrowRight className="h-4 w-4 opacity-70" />
        </p>
        <p className="text-xs opacity-75 mt-1">
          First buy earns +50 $RHOZE toward your Creator Pass.
        </p>
      </button>
    );
  }

  if (mode === "back") {
    return (
      <>
        <button
          type="button"
          onClick={handleBack}
          className="w-full text-left rounded-2xl p-5 bg-gradient-to-br from-rose-500 via-fuchsia-500 to-amber-400 text-white shadow-lg hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-90">
            <Heart className="h-3.5 w-3.5" /> Support
          </div>
          <p className="font-display text-lg font-bold mt-2">Back this artist</p>
          <p className="text-xs opacity-90 mt-1">
            Fund the next stage of {creatorName}'s release.
          </p>
        </button>

        <BackArtistSheet
          open={backOpen}
          onOpenChange={setBackOpen}
          creatorId={creatorId}
          creatorName={creatorName}
          creatorAvatar={creatorAvatar}
          projects={backableProjects ?? []}
        />
      </>
    );
  }

  // mode === "follow"
  return (
    <>
      <button
        type="button"
        onClick={handleFollowTap}
        disabled={followPending}
        className={
          isFollowing
            ? "w-full text-left rounded-2xl p-5 border border-border bg-card/60 hover:bg-card transition-colors disabled:opacity-60"
            : "w-full text-left rounded-2xl p-5 border border-border bg-background hover:bg-muted/40 transition-colors disabled:opacity-60"
        }
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {isFollowing ? (
            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
          ) : (
            <UserPlus className="h-3.5 w-3.5" />
          )}
          {isFollowing ? "Following" : "Follow"}
        </div>
        <p className="font-display text-lg font-bold mt-2">
          {isFollowing ? `Following ${creatorName} ✓` : `Follow ${creatorName}`}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isFollowing
            ? "You'll see their new posts and releases."
            : "Get notified when they post. +5 $RHOZE on first follow."}
        </p>
      </button>

      <AlertDialog open={confirmUnfollow} onOpenChange={setConfirmUnfollow}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfollow {creatorName}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll stop seeing their new posts and releases in your feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmUnfollow(false);
                onFollow();
              }}
            >
              Unfollow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ContextualSupportButton;

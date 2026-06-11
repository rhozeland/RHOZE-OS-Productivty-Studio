/**
 * SupportProjectCard — fan-facing "Support this project" CTA on a project
 * detail page (when the viewer is NOT a manager/owner).
 *
 * Styled to match the owner-only "Build in public" gradient card so the
 * profile aside feels consistent across roles.
 *
 * Flow:
 *   1. Click → opens a confirmation dialog
 *   2. Dialog shows a "Share to my profile" switch (default ON). Confirming
 *      writes a row into `project_cheers` with `shared_to_profile` set
 *      accordingly. When ON, the project surfaces in the supporter's
 *      profile → Supporting tab.
 *   3. Already-supporting → button flips to "Supporting" and clicking
 *      removes the cheer.
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Heart, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { awardEngagementReward } from "@/lib/award-engagement-reward";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  projectTitle: string;
  isPublic: boolean;
  ownerName?: string | null;
}

const SupportProjectCard = ({ projectId, projectTitle, isPublic, ownerName }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sb: any = supabase;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [shareToProfile, setShareToProfile] = useState(true);

  const { data: myCheer, refetch } = useQuery({
    queryKey: ["project-mycheer", projectId, user?.id],
    enabled: !!user && !!projectId,
    queryFn: async () => {
      const { data } = await sb
        .from("project_cheers")
        .select("id, shared_to_profile")
        .eq("project_id", projectId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  useEffect(() => {
    if (myCheer) setShareToProfile(!!myCheer.shared_to_profile);
  }, [myCheer]);

  const iSupport = !!myCheer;

  const supportMutation = useMutation({
    mutationFn: async (share: boolean) => {
      if (!user) throw new Error("Sign in to support");
      const { error } = await sb
        .from("project_cheers")
        .insert({ project_id: projectId, user_id: user.id, shared_to_profile: share });
      if (error) throw error;
      await awardEngagementReward({
        userId: user.id,
        action: "like_work",
        referenceId: projectId,
        description: `Supported project: ${projectTitle}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-mycheer", projectId] });
      qc.invalidateQueries({ queryKey: ["supporting-cheers"] });
      qc.invalidateQueries({ queryKey: ["studio-backed", user?.id] });
      setConfirmOpen(false);
      setSuccessOpen(true);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not support"),
  });

  const updateShareMutation = useMutation({
    mutationFn: async (share: boolean) => {
      if (!user || !myCheer) return;
      const { error } = await sb
        .from("project_cheers")
        .update({ shared_to_profile: share })
        .eq("id", myCheer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-mycheer", projectId] });
      qc.invalidateQueries({ queryKey: ["supporting-cheers"] });
      qc.invalidateQueries({ queryKey: ["studio-backed", user?.id] });
    },
  });

  const unsupport = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await sb
        .from("project_cheers")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-mycheer", projectId] });
      qc.invalidateQueries({ queryKey: ["supporting-cheers"] });
      qc.invalidateQueries({ queryKey: ["studio-backed", user?.id] });
      toast.success("Removed your support");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update"),
  });

  // RLS requires the project to be public for cheers to insert. Don't show
  // the button if it isn't — would just error.
  if (!isPublic) return null;

  const handleClick = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (iSupport) {
      unsupport.mutate();
    } else {
      setShareToProfile(true);
      setConfirmOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={unsupport.isPending}
        className={cn(
          "w-full text-left rounded-2xl p-5 shadow-lg transition-opacity hover:opacity-95 disabled:opacity-50",
          iSupport
            ? "bg-foreground text-background"
            : "bg-gradient-to-br from-rose-500 via-fuchsia-500 to-amber-500 text-white",
        )}
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-90">
          {iSupport ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          {iSupport ? "Supporting" : "Back the build"}
        </div>
        <p className="font-display text-lg font-bold mt-2 flex items-center gap-2">
          <Heart className={cn("h-4 w-4", iSupport && "fill-current")} />
          {iSupport ? "You're supporting this" : "Support this project"}
        </p>
        <p className="text-xs opacity-90 mt-1">
          {iSupport
            ? "Tap to remove. Manage visibility from the dialog below."
            : `Cheer ${ownerName ? `${ownerName}'s` : "this"} release and follow the roadmap.`}
        </p>
      </button>

      {/* If already supporting, expose share toggle inline */}
      {iSupport && (
        <div className="rounded-2xl border border-border bg-card/70 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="share-toggle-inline" className="text-xs font-semibold">
              Show on my profile
            </Label>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {shareToProfile ? "Visible in your Supporting tab." : "Kept private to you."}
            </p>
          </div>
          <Switch
            id="share-toggle-inline"
            checked={shareToProfile}
            onCheckedChange={(v) => {
              setShareToProfile(v);
              updateShareMutation.mutate(v);
            }}
          />
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Support this project?</DialogTitle>
            <DialogDescription>
              You're about to back <span className="font-semibold text-foreground">{projectTitle}</span>
              {ownerName ? <> by <span className="font-semibold text-foreground">{ownerName}</span></> : null}.
              Supporting drips $RHOZE toward your Creator Pass.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="share-toggle" className="text-sm font-semibold">
                Share to my profile
              </Label>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                Show this project in the Supporting tab on your profile so others see what you back.
              </p>
            </div>
            <Switch id="share-toggle" checked={shareToProfile} onCheckedChange={setShareToProfile} />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={() => supportMutation.mutate(shareToProfile)}
              disabled={supportMutation.isPending}
              className="bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-500 text-white hover:opacity-95"
            >
              <Heart className="h-4 w-4 mr-1.5" />
              {supportMutation.isPending ? "Supporting…" : "Confirm support"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success dialog */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <div className="mx-auto -mt-2 mb-1 h-16 w-16 rounded-full bg-gradient-to-br from-rose-500 via-fuchsia-500 to-amber-500 flex items-center justify-center shadow-lg">
            <Heart className="h-7 w-7 text-white fill-white" />
          </div>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-center">
              You're in 🌹
            </DialogTitle>
            <DialogDescription className="text-center">
              {shareToProfile ? (
                <>You're now publicly supporting <span className="font-semibold text-foreground">{projectTitle}</span>. It'll show up under <span className="font-semibold text-foreground">Supporting</span> on your profile.</>
              ) : (
                <>Your support is recorded privately. Flip the toggle on the project card any time to share it on your profile.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            {user && (
              <Button variant="outline" onClick={() => { setSuccessOpen(false); navigate(`/profiles/${user.id}?tab=supporting`); }}>
                View my Supporting
              </Button>
            )}
            <Button
              onClick={() => setSuccessOpen(false)}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SupportProjectCard;

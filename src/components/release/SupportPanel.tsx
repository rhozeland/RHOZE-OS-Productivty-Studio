/**
 * SupportPanel — primary CTA stack on the public release page.
 *
 * Click flow:
 *   1. "Support this release" → opens a confirm dialog with a
 *      "Share to my profile" toggle (default ON).
 *   2. Confirming inserts `project_cheers { shared_to_profile }` and
 *      pops a celebratory success dialog with a shortcut to the
 *      supporter's profile → Supporting tab.
 *   3. Already supporting → button flips to "Supporting" and clicking
 *      removes the cheer; an inline toggle exposes profile visibility.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share2, Coins, Copy, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ReleaseComments from "@/components/release/ReleaseComments";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { awardEngagementReward } from "@/lib/award-engagement-reward";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  projectTitle: string;
  cheerCount: number;
  iSupport: boolean;
  iSupportShared?: boolean;
  releaseUrl: string;
  ownerName?: string | null;
  coverColor?: string | null;
  coverImageUrl?: string | null;
  linkedTokenTicker?: string | null;
  linkedTokenMint?: string | null;
  onScrollToComments?: () => void;
}

const SupportPanel = ({
  projectId,
  projectTitle,
  cheerCount,
  iSupport,
  iSupportShared,
  releaseUrl,
  ownerName,
  coverImageUrl,
  linkedTokenTicker,
  linkedTokenMint,
}: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sb: any = supabase;
  const [sharing, setSharing] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [shareToProfile, setShareToProfile] = useState(true);

  useEffect(() => {
    if (iSupport) setShareToProfile(!!iSupportShared);
  }, [iSupport, iSupportShared]);

  const support = useMutation({
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
        description: `Supported release: ${projectTitle}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["release"] });
      qc.invalidateQueries({ queryKey: ["release-mycheer"] });
      qc.invalidateQueries({ queryKey: ["supporting-cheers"] });
      qc.invalidateQueries({ queryKey: ["studio-backed", user?.id] });
      setConfirmOpen(false);
      setSuccessOpen(true);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not support"),
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
      qc.invalidateQueries({ queryKey: ["release"] });
      qc.invalidateQueries({ queryKey: ["release-mycheer"] });
      qc.invalidateQueries({ queryKey: ["supporting-cheers"] });
      qc.invalidateQueries({ queryKey: ["studio-backed", user?.id] });
      toast.success("Removed your support");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update"),
  });

  const updateShare = useMutation({
    mutationFn: async (share: boolean) => {
      if (!user) return;
      const { error } = await sb
        .from("project_cheers")
        .update({ shared_to_profile: share })
        .eq("project_id", projectId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["release-mycheer"] });
      qc.invalidateQueries({ queryKey: ["supporting-cheers"] });
      qc.invalidateQueries({ queryKey: ["studio-backed", user?.id] });
    },
  });

  const onSupportClick = () => {
    if (!user) {
      toast.error("Sign in to support");
      return;
    }
    if (iSupport) {
      unsupport.mutate();
    } else {
      setShareToProfile(true);
      setConfirmOpen(true);
    }
  };

  const shareToFeed = async () => {
    if (!user) {
      toast.error("Sign in to share to your feed");
      return;
    }
    setSharing(true);
    try {
      const { error } = await supabase.from("flow_items").insert({
        user_id: user.id,
        title: `Supporting: ${projectTitle}`,
        description: ownerName
          ? `Backing ${ownerName}'s release. Tap to follow the roadmap.`
          : `Backing this release. Tap to follow the roadmap.`,
        content_type: coverImageUrl ? "image" : "link",
        file_url: coverImageUrl ?? null,
        link_url: releaseUrl,
        category: "design",
        tags: ["supporting", "release"],
      });
      if (error) throw error;
      toast.success("Shared to your feed");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not share");
    } finally {
      setSharing(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(releaseUrl);
    toast.success("Release link copied");
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-3xl font-display font-bold tabular-nums">{cheerCount}</div>
          <div className="text-xs text-muted-foreground">
            {cheerCount === 1 ? "supporter" : "supporters"}
          </div>
        </div>
        <Heart className={cn("h-6 w-6", iSupport ? "fill-rose-500 text-rose-500" : "text-rose-500")} />
      </div>

      <Button
        size="lg"
        onClick={onSupportClick}
        disabled={support.isPending || unsupport.isPending}
        className={cn(
          "w-full gap-2 font-semibold shadow-lg shadow-rose-500/20 transition-all",
          iSupport
            ? "bg-foreground text-background hover:bg-foreground/90"
            : "bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 text-white hover:opacity-95 hover:shadow-rose-500/40",
        )}
      >
        <Heart className={cn("h-4 w-4", iSupport && "fill-current")} />
        {iSupport ? "Supporting" : user ? "Support this release" : "Sign in to support"}
      </Button>

      <p className="text-[11px] text-muted-foreground text-center leading-snug">
        Supporting drips $RHOZE toward your Creator Pass and lets you comment, share, and trade.
      </p>

      {iSupport && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="release-share-toggle" className="text-xs font-semibold">
              Show on my profile
            </Label>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {shareToProfile ? "Visible in your Supporting tab." : "Kept private to you."}
            </p>
          </div>
          <Switch
            id="release-share-toggle"
            checked={shareToProfile}
            onCheckedChange={(v) => {
              setShareToProfile(v);
              updateShare.mutate(v);
            }}
          />
        </div>
      )}

      <div className="pt-1">
        <Button variant="outline" size="sm" onClick={onScrollToComments} className="w-full gap-1.5">
          <MessageCircle className="h-3.5 w-3.5" /> Comment
        </Button>
      </div>

      {linkedTokenTicker && (
        <a
          href={
            linkedTokenMint
              ? `https://pump.fun/coin/${linkedTokenMint}`
              : `https://pump.fun/board?q=${encodeURIComponent(linkedTokenTicker)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 hover:bg-emerald-500/10 transition"
        >
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-500" />
            <div>
              <div className="text-sm font-semibold">Buy ${linkedTokenTicker}</div>
              <div className="text-[10px] text-muted-foreground">Trade on pump.fun</div>
            </div>
          </div>
          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
        </a>
      )}

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Support this release?</DialogTitle>
            <DialogDescription>
              You're about to back <span className="font-semibold text-foreground">{projectTitle}</span>
              {ownerName ? <> by <span className="font-semibold text-foreground">{ownerName}</span></> : null}.
              Supporting drips $RHOZE toward your Creator Pass.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="release-share-confirm" className="text-sm font-semibold">
                Share to my profile
              </Label>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                Show this release in the Supporting tab on your profile so others see what you back.
              </p>
            </div>
            <Switch id="release-share-confirm" checked={shareToProfile} onCheckedChange={setShareToProfile} />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={() => support.mutate(shareToProfile)}
              disabled={support.isPending}
              className="bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 text-white hover:opacity-95"
            >
              <Heart className="h-4 w-4 mr-1.5" />
              {support.isPending ? "Supporting…" : "Confirm support"}
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
            <DialogTitle className="font-display text-2xl text-center">You're in 🌹</DialogTitle>
            <DialogDescription className="text-center">
              {shareToProfile ? (
                <>You're now publicly supporting <span className="font-semibold text-foreground">{projectTitle}</span>. It'll show up under <span className="font-semibold text-foreground">Supporting</span> on your profile.</>
              ) : (
                <>Your support is recorded privately. Flip the toggle on the release any time to share it on your profile.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            {user && (
              <Button variant="outline" onClick={() => navigate(`/profiles/${user.id}?tab=supporting`)}>
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
    </div>
  );
};

export default SupportPanel;

/**
 * SupportPanel — primary CTA stack on the public release page.
 *
 * One highlighted "Support" button (toggles a row in `project_cheers`),
 * plus secondary actions: jump to comments, share to your own feed (creates
 * a `flow_items` row pointing at the release URL), and — when the release
 * has a linked approved coin — a buy CTA that deeplinks to pump.fun.
 *
 * Supporters earn $RHOZE toward their Creator Pass via the standard
 * engagement reward gate (action: like_work) on first support per project.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share2, Coins, Copy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { awardEngagementReward } from "@/lib/award-engagement-reward";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  projectTitle: string;
  cheerCount: number;
  iSupport: boolean;
  releaseUrl: string;
  ownerName?: string | null;
  coverColor?: string | null;
  coverImageUrl?: string | null;
  linkedTokenTicker?: string | null;
  linkedTokenMint?: string | null;
  onScrollToComments: () => void;
}

const SupportPanel = ({
  projectId,
  projectTitle,
  cheerCount,
  iSupport,
  releaseUrl,
  ownerName,
  coverColor,
  coverImageUrl,
  linkedTokenTicker,
  linkedTokenMint,
  onScrollToComments,
}: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sharing, setSharing] = useState(false);

  const support = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to support");
      if (iSupport) {
        const { error } = await supabase
          .from("project_cheers")
          .delete()
          .eq("project_id", projectId)
          .eq("user_id", user.id);
        if (error) throw error;
        return { added: false };
      }
      const { error } = await supabase
        .from("project_cheers")
        .insert({ project_id: projectId, user_id: user.id });
      if (error) throw error;
      // Drip $RHOZE toward Creator Pass — capped daily by the gate.
      await awardEngagementReward({
        userId: user.id,
        action: "like_work",
        referenceId: projectId,
        description: `Supported release: ${projectTitle}`,
      });
      return { added: true };
    },
    onSuccess: ({ added }) => {
      qc.invalidateQueries({ queryKey: ["release"] });
      qc.invalidateQueries({ queryKey: ["release-mycheer"] });
      if (added) toast.success("You're now supporting this release 🌹");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not support"),
  });

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

      {/* Primary highlighted Support button */}
      <Button
        size="lg"
        onClick={() => support.mutate()}
        disabled={support.isPending}
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

      {/* Secondary actions */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onScrollToComments} className="gap-1.5">
          <MessageCircle className="h-3.5 w-3.5" /> Comment
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={shareToFeed}
          disabled={sharing}
          className="gap-1.5"
        >
          <Share2 className="h-3.5 w-3.5" /> Share to feed
        </Button>
        <Button variant="ghost" size="sm" onClick={copyLink} className="gap-1.5 col-span-2 text-xs text-muted-foreground">
          <Copy className="h-3 w-3" /> Copy link
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
    </div>
  );
};

export default SupportPanel;

/**
 * FlowUnlockGate — wraps Flow card media. If the viewer doesn't hold any
 * Shares of the post's author (or isn't signed in), the children are blurred
 * and a centered "Invest & Unlock" overlay is rendered on top.
 *
 * Owners always pass through. If the artist hasn't launched Shares yet,
 * content is shown normally too (no fake gate).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import BackCreatorSheet from "@/components/profile/BackCreatorSheet";
import { SHARE_LABEL } from "@/lib/economy-copy";

interface Props {
  artistId?: string | null;
  artistName?: string | null;
  children: React.ReactNode;
}

const FlowUnlockGate = ({ artistId, artistName, children }: Props) => {
  const { user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Resolve the artist's launch + viewer holdings in one batched query.
  const { data: gate, isLoading } = useQuery({
    queryKey: ["flow-unlock-holdings", artistId, user?.id],
    enabled: !!artistId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: launch } = await supabase
        .from("coin_launches")
        .select("id, status")
        .eq("creator_id", artistId!)
        .neq("status", "cancelled")
        .order("work_id", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!launch) return { hasLaunch: false, holds: 0 };
      if (!user) return { hasLaunch: true, holds: 0, launchId: launch.id };

      const { data: hold } = await supabase
        .from("coin_holdings")
        .select("balance")
        .eq("trader_id", user.id)
        .eq("launch_id", launch.id)
        .maybeSingle();
      return {
        hasLaunch: true,
        launchId: launch.id,
        holds: Number(hold?.balance ?? 0),
      };
    },
  });

  const isOwner = !!user && !!artistId && user.id === artistId;
  // Pass-through cases:
  //  - viewer is the author
  //  - artist hasn't launched Shares yet (don't fake a gate)
  //  - viewer holds at least 1 Share
  //  - still loading the gate (avoid blur flicker)
  const passThrough =
    isOwner ||
    isLoading ||
    !gate ||
    !gate.hasLaunch ||
    (gate.holds ?? 0) > 0;

  if (passThrough) return <>{children}</>;

  return (
    <>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none select-none"
          style={{ filter: "blur(28px) saturate(0.6)" }}
        >
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
          <div className="max-w-[280px] rounded-2xl border border-border/40 bg-card/90 backdrop-blur-md shadow-xl p-5 text-center space-y-3">
            <div className="mx-auto h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-display font-semibold text-sm text-foreground">
                Locked · Hold a {SHARE_LABEL.toLowerCase()} to unlock
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Invest in {artistName || "this artist"} to unlock their private feed.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 w-full"
              onClick={(e) => {
                e.stopPropagation();
                setSheetOpen(true);
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Back creator
            </Button>
          </div>
        </div>
      </div>
      {artistId && (
        <BackCreatorSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          artistId={artistId}
          artistName={artistName}
        />
      )}
    </>
  );
};

export default FlowUnlockGate;

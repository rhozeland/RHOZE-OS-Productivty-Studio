/**
 * LaunchCoinButton — drop-in CTA to spin up a coin for a Verified IP work.
 *
 * Renders nothing if the work isn't verified or the caller isn't the owner.
 * Detects an existing live/graduated launch and switches to a "View coin"
 * link instead of offering to launch a duplicate.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Coins, ArrowRight, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LaunchCoinDialog from "./LaunchCoinDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useArtistVerification } from "@/hooks/useArtistVerification";

interface Props {
  workId: string;
  isOwner: boolean;
  isVerified: boolean;
  workName?: string;
  workImage?: string | null;
  size?: "sm" | "default";
}

const LaunchCoinButton = ({
  workId,
  isOwner,
  isVerified,
  workName,
  workImage,
  size = "sm",
}: Props) => {
  const { user } = useAuth();
  const { data: verif } = useArtistVerification(isOwner ? user?.id : null);
  const isVerifiedArtist = verif?.verified ?? false;
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState<{ id: string; ticker: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isVerified) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select("id, ticker, status")
        .eq("work_id", workId)
        .neq("status", "cancelled")
        .maybeSingle();
      if (!cancelled) {
        setExisting(data ? { id: data.id, ticker: data.ticker } : null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workId, isVerified]);

  if (!isVerified || loading) return null;

  if (existing) {
    return (
      <Button asChild variant="outline" size={size} className="gap-1.5">
        <Link to={`/launchpad/${existing.id}`}>
          <Coins className="h-3.5 w-3.5" />
          ${existing.ticker}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    );
  }

  if (!isOwner) return null;

  if (!isVerifiedArtist) {
    return (
      <Button asChild variant="outline" size={size} className="gap-1.5">
        <Link to="/settings/verification">
          <BadgeCheck className="h-3.5 w-3.5" />
          Verify to launch a coin
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" size={size} className="gap-1.5" onClick={() => setOpen(true)}>
        <Coins className="h-3.5 w-3.5" />
        Launch a coin
      </Button>
      <LaunchCoinDialog
        open={open}
        onOpenChange={setOpen}
        workId={workId}
        defaultName={workName}
        defaultImage={workImage}
      />
    </>
  );
};

export default LaunchCoinButton;

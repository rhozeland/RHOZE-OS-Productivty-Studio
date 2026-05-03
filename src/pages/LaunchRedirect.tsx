/**
 * LaunchRedirect — back-compat for the now-removed /launchpad/:id route.
 *
 * Coins are profile-bound (one per creator). Any old /launchpad/:id link
 * we encounter resolves the launch's creator_id and forwards the visitor
 * to that creator's profile Coin tab, where the bonding-curve chart and
 * trade panel now live.
 */
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const LaunchRedirect = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["coin-launch-redirect", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_launches")
        .select("ticker, creator_id")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (isLoading) return;
    if (data?.ticker) {
      navigate(`/coin/${data.ticker}`, { replace: true });
    } else if (data?.creator_id) {
      navigate(`/profiles/${data.creator_id}?tab=support`, { replace: true });
    } else if (isError || !data) {
      navigate("/discover", { replace: true });
    }
  }, [data, isLoading, isError, navigate]);

  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
};

export default LaunchRedirect;

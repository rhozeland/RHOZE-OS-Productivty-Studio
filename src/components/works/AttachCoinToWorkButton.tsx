/**
 * AttachCoinToWorkButton — owner-only control to back a work with a coin.
 *
 * Reads the owner's approved `profiles.token_mint_address` and offers a
 * one-tap "Back this with $TICKER" toggle. If the owner has no approved
 * token, surfaces a quiet link to /why-coin instead.
 *
 * Writes `works.linked_token_mint` directly. RLS already constrains
 * updates to the work owner.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Coins, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  workId: string;
  workOwnerId: string;
  currentMint: string | null | undefined;
}

const AttachCoinToWorkButton = ({ workId, workOwnerId, currentMint }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isOwner = user?.id === workOwnerId;

  const { data: ownerToken } = useQuery({
    queryKey: ["owner-token-chip", workOwnerId],
    enabled: isOwner,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("token_mint_address, token_ticker")
        .eq("user_id", workOwnerId)
        .maybeSingle();
      return data;
    },
  });

  const [busy, setBusy] = useState(false);

  const setMint = useMutation({
    mutationFn: async (mint: string | null) => {
      setBusy(true);
      const { error } = await supabase
        .from("works")
        .update({ linked_token_mint: mint })
        .eq("id", workId);
      if (error) throw error;
    },
    onSuccess: (_, mint) => {
      qc.invalidateQueries({ queryKey: ["work-token-chip"] });
      qc.invalidateQueries({ queryKey: ["works-detail", workId] });
      toast.success(mint ? "Coin attached to this work" : "Coin detached");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update work"),
    onSettled: () => setBusy(false),
  });

  if (!isOwner) return null;

  const hasMint = !!currentMint;

  if (!ownerToken?.token_mint_address) {
    return (
      <Link
        to="/why-coin"
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Coins className="h-3 w-3" />
        Launch a coin to back this work →
      </Link>
    );
  }

  if (hasMint) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setMint.mutate(null)}
        className="gap-1.5 h-7 text-xs"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        Detach coin
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() => setMint.mutate(ownerToken.token_mint_address!)}
      className="gap-1.5 h-7 text-xs"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className="h-3 w-3 text-emerald-500" />}
      Back with ${ownerToken.token_ticker ?? "TOKEN"}
    </Button>
  );
};

export default AttachCoinToWorkButton;

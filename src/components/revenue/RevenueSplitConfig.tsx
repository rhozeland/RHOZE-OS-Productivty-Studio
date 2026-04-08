import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, PieChart, Wallet } from "lucide-react";

interface RevenueSplitConfigProps {
  listingId?: string;
  contractId?: string;
}

const RevenueSplitConfig = ({ listingId, contractId }: RevenueSplitConfigProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [creatorPct, setCreatorPct] = useState(80);
  const [curatorPct, setCuratorPct] = useState(10);
  const [buybackWallet, setBuybackWallet] = useState("");

  const buybackPct = 100 - creatorPct - curatorPct;

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["split-config", listingId, contractId],
    queryFn: async () => {
      let query = supabase.from("revenue_split_configs").select("*");
      if (listingId) query = query.eq("listing_id", listingId);
      if (contractId) query = query.eq("contract_id", contractId);
      const { data, error } = await query.eq("is_active", true).maybeSingle();
      if (error) throw error;
      if (data) {
        setCreatorPct(data.creator_pct);
        setCuratorPct(data.curator_pct);
        setBuybackWallet(data.buyback_wallet || "");
      }
      return data;
    },
    enabled: !!(listingId || contractId),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (buybackPct < 0) throw new Error("Percentages must sum to 100");

      const payload = {
        listing_id: listingId || null,
        contract_id: contractId || null,
        creator_id: user!.id,
        creator_pct: creatorPct,
        curator_pct: curatorPct,
        buyback_pct: buybackPct,
        buyback_wallet: buybackWallet || null,
        is_active: true,
      };

      if (existingConfig) {
        const { error } = await supabase
          .from("revenue_split_configs")
          .update(payload)
          .eq("id", existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("revenue_split_configs")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["split-config"] });
      toast.success("Revenue split saved!");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading split config...
      </div>
    );
  }

  return (
    <div className="surface-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <PieChart className="h-5 w-5 text-accent" />
        <h3 className="font-display text-lg font-semibold text-foreground">
          Revenue Split
        </h3>
      </div>

      {/* Visual split */}
      <div className="flex h-4 rounded-full overflow-hidden">
        <div
          className="bg-primary transition-all"
          style={{ width: `${creatorPct}%` }}
        />
        <div
          className="bg-accent transition-all"
          style={{ width: `${curatorPct}%` }}
        />
        <div
          className="bg-muted-foreground/30 transition-all"
          style={{ width: `${buybackPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <Badge variant="outline" className="bg-primary/15 text-primary">
          Creator {creatorPct}%
        </Badge>
        <Badge variant="outline" className="bg-accent/15 text-accent">
          Curator {curatorPct}%
        </Badge>
        <Badge variant="outline">
          Buyback {buybackPct}%
        </Badge>
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Creator Share: {creatorPct}%</Label>
          <Slider
            value={[creatorPct]}
            onValueChange={([v]) => {
              setCreatorPct(v);
              if (v + curatorPct > 100) setCuratorPct(100 - v);
            }}
            min={50}
            max={95}
            step={5}
          />
        </div>

        <div className="space-y-2">
          <Label>Curator Share: {curatorPct}%</Label>
          <Slider
            value={[curatorPct]}
            onValueChange={([v]) => {
              setCuratorPct(v);
              if (creatorPct + v > 100) setCreatorPct(100 - v);
            }}
            min={0}
            max={25}
            step={5}
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            Buyback Pool Wallet (optional)
          </Label>
          <Input
            placeholder="Solana wallet address for $RHOZE buyback"
            value={buybackWallet}
            onChange={(e) => setBuybackWallet(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {buybackPct}% of revenue goes to the buyback pool.
            {!buybackWallet && " Set a wallet to enable on-chain buyback transfers."}
          </p>
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || buybackPct < 0}
        className="w-full"
      >
        {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {existingConfig ? "Update Split" : "Set Split"}
      </Button>
    </div>
  );
};

export default RevenueSplitConfig;

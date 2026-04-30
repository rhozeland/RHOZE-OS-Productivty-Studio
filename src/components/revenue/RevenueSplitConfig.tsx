import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, PieChart, Wallet, Fingerprint, ShieldCheck } from "lucide-react";
import CuratorInviteSection from "./CuratorInviteSection";
import { shortHash } from "@/lib/content-hash";

/**
 * Compute a SHA-256 fingerprint of the canonical split table.
 * Mirrors the `splits_hash` field defined in the future Anchor program
 * spec — surfacing it now primes users for the eventual on-chain freeze
 * at lock time, without changing any DB shape.
 */
async function computeSplitsHash(parts: {
  creator_pct: number;
  curator_pct: number;
  buyback_pct: number;
  buyback_wallet: string | null;
}): Promise<string> {
  const canonical = JSON.stringify({
    creator: parts.creator_pct,
    curator: parts.curator_pct,
    buyback: parts.buyback_pct,
    wallet: parts.buyback_wallet ?? "",
  });
  const buf = new TextEncoder().encode(canonical);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
  const [splitsHash, setSplitsHash] = useState<string>("");
  // Phase 3: bind the split to a specific Work (the IP being monetized).
  // The work's content_hash + this splits hash form the full provenance chain.
  const [workId, setWorkId] = useState<string>("");

  const buybackPct = 100 - creatorPct - curatorPct;

  // Recompute the canonical SHA-256 fingerprint whenever any split input
  // changes. Mirrors the future on-chain `splits_hash` in the Anchor spec.
  useEffect(() => {
    let cancelled = false;
    computeSplitsHash({
      creator_pct: creatorPct,
      curator_pct: curatorPct,
      buyback_pct: buybackPct,
      buyback_wallet: buybackWallet || null,
    }).then((h) => {
      if (!cancelled) setSplitsHash(h);
    });
    return () => {
      cancelled = true;
    };
  }, [creatorPct, curatorPct, buybackPct, buybackWallet]);

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
        setWorkId((data as { work_id?: string | null }).work_id ?? "");
      }
      return data;
    },
    enabled: !!(listingId || contractId),
  });

  // The creator's own works, for the Linked Work picker.
  const { data: myWorks = [] } = useQuery({
    queryKey: ["works-for-split", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("works")
        .select("id, title, kind, content_hash, solana_signature")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const linkedWork = myWorks.find((w) => w.id === workId);

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
        work_id: workId || null,
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
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5 text-accent" />
          <h3 className="font-display text-lg font-semibold text-foreground">
            Programmable Split
          </h3>
        </div>
        <p className="text-xs text-muted-foreground italic pl-7">
          Executable code, not a contract clause.
        </p>
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

      {/* Splits fingerprint — SHA-256 of the canonical split table.
          Same field the future Anchor program freezes at lock time. */}
      {splitsHash && (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs">
          <Fingerprint className="h-3.5 w-3.5 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground">
              Splits fingerprint · SHA-256
            </div>
            <div
              className="font-mono text-[11px] text-foreground/80 truncate"
              title={splitsHash}
            >
              {splitsHash.slice(0, 24)}…{splitsHash.slice(-8)}
            </div>
          </div>
        </div>
      )}

      {existingConfig && curatorPct > 0 && (
        <CuratorInviteSection
          splitConfigId={existingConfig.id}
          curatorId={existingConfig.curator_id ?? null}
        />
      )}
    </div>
  );
};

export default RevenueSplitConfig;

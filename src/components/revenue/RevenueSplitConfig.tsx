/**
 * RevenueSplitConfig — Splits v2.
 *
 * One model: a Collaborators pool (must sum to 100%) + a tier-based
 * platform fee taken off the top. Splits + fee are frozen at project
 * lock and a SHA-256 fingerprint is anchored on Solana.
 *
 * No more "creator vs curator vs buyback" — everyone working on the
 * thing is just a collaborator.
 */
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  PieChart,
  Fingerprint,
  ShieldCheck,
  Lock,
  Users,
  ExternalLink,
} from "lucide-react";
import CuratorInviteSection from "./CuratorInviteSection";
import { shortHash } from "@/lib/content-hash";
import { useRhozeBalance } from "@/hooks/useRhozeBalance";
import { feeForBalance, usePlatformFeeTiers } from "@/hooks/usePlatformFeeTiers";

interface RevenueSplitConfigProps {
  listingId?: string;
  contractId?: string;
}

type Collaborator = {
  user_id: string;
  pct: number;
  profile?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

const RevenueSplitConfig = ({ listingId, contractId }: RevenueSplitConfigProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [workId, setWorkId] = useState<string>("");
  const { data: tiers = [] } = usePlatformFeeTiers();
  const { balance: rhozeBalance = 0 } = useRhozeBalance();
  const platformFee = feeForBalance(rhozeBalance, tiers);

  // Find or create the config row.
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["split-config", listingId, contractId],
    queryFn: async () => {
      let q = supabase.from("revenue_split_configs").select("*");
      if (listingId) q = q.eq("listing_id", listingId);
      if (contractId) q = q.eq("contract_id", contractId);
      const { data } = await q.eq("is_active", true).maybeSingle();
      if (data) setWorkId((data as { work_id?: string | null }).work_id ?? "");
      return data;
    },
    enabled: !!(listingId || contractId),
  });

  const isLocked = !!existingConfig?.locked_at;

  // Live collaborator list for this config.
  const { data: collaborators = [] } = useQuery({
    queryKey: ["split-collaborators", existingConfig?.id],
    queryFn: async (): Promise<Collaborator[]> => {
      if (!existingConfig?.id) return [];
      const { data: rows } = await supabase
        .from("revenue_split_collaborators")
        .select("user_id, pct")
        .eq("config_id", existingConfig.id);
      const ids = (rows ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", ids);
      const map = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return (rows ?? []).map((r) => ({
        user_id: r.user_id,
        pct: Number(r.pct),
        profile: map.get(r.user_id) ?? null,
      }));
    },
    enabled: !!existingConfig?.id,
  });

  const totalPct = collaborators.reduce((s, c) => s + c.pct, 0);
  const summed100 = Math.round(totalPct) === 100;

  // The creator's own works, for the Linked Work picker.
  const { data: myWorks = [] } = useQuery({
    queryKey: ["works-for-split", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("works")
        .select("id, title, kind, content_hash, solana_signature")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const linkedWork = myWorks.find((w) => w.id === workId);

  // Create the config (if missing) so collaborator rows can attach.
  const ensureConfig = useMutation({
    mutationFn: async () => {
      if (existingConfig) return existingConfig;
      const payload = {
        listing_id: listingId || null,
        contract_id: contractId || null,
        creator_id: user!.id,
        creator_pct: 100,
        curator_pct: 0,
        buyback_pct: 0,
        work_id: workId || null,
        is_active: true,
      };
      const { data, error } = await supabase
        .from("revenue_split_configs")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      // Seed the lead at 100%.
      await supabase
        .from("revenue_split_collaborators")
        .insert({ config_id: data.id, user_id: user!.id, pct: 100 });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["split-config"] });
      qc.invalidateQueries({ queryKey: ["split-collaborators"] });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  // Update workId on the config.
  const saveWork = useMutation({
    mutationFn: async () => {
      if (!existingConfig) return;
      const { error } = await supabase
        .from("revenue_split_configs")
        .update({ work_id: workId || null })
        .eq("id", existingConfig.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["split-config"] });
      toast.success("Linked work updated");
    },
  });

  // Update a single collaborator pct.
  const updatePct = useMutation({
    mutationFn: async ({ userId, pct }: { userId: string; pct: number }) => {
      if (!existingConfig) return;
      const { error } = await supabase
        .from("revenue_split_collaborators")
        .update({ pct })
        .eq("config_id", existingConfig.id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["split-collaborators", existingConfig?.id] }),
  });

  // Remove a non-lead collaborator.
  const removeCollab = useMutation({
    mutationFn: async (userId: string) => {
      if (!existingConfig) return;
      const removed = collaborators.find((c) => c.user_id === userId);
      const { error } = await supabase
        .from("revenue_split_collaborators")
        .delete()
        .eq("config_id", existingConfig.id)
        .eq("user_id", userId);
      if (error) throw error;
      // Give the share back to the lead.
      if (removed && existingConfig.creator_id) {
        const lead = collaborators.find((c) => c.user_id === existingConfig.creator_id);
        await supabase
          .from("revenue_split_collaborators")
          .update({ pct: (lead?.pct ?? 0) + removed.pct })
          .eq("config_id", existingConfig.id)
          .eq("user_id", existingConfig.creator_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["split-collaborators"] });
      toast.success("Collaborator removed");
    },
  });

  // Lock the splits — calls the SECURITY DEFINER RPC.
  const lockSplits = useMutation({
    mutationFn: async () => {
      if (!existingConfig) return;
      const { error } = await (supabase as unknown as {
        rpc: (n: string, p: Record<string, unknown>) => Promise<{ error: unknown }>;
      }).rpc("lock_split_config", { _config_id: existingConfig.id });
      if (error) throw error as { message: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["split-config"] });
      toast.success("Splits locked + fingerprint anchored");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading split config…
      </div>
    );
  }

  return (
    <div className="surface-card p-6 space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5 text-accent" />
          <h3 className="font-display text-lg font-semibold text-foreground">
            Split with collaborators
          </h3>
          {isLocked && (
            <Badge variant="outline" className="bg-primary/15 text-primary gap-1">
              <Lock className="h-3 w-3" /> Locked
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground italic pl-7">
          Split the pool with anyone working on this. Platform fee comes off the top.
        </p>
      </div>

      {/* No config yet */}
      {!existingConfig && (
        <Button
          onClick={() => ensureConfig.mutate()}
          disabled={ensureConfig.isPending}
          className="w-full"
        >
          {ensureConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Set up split
        </Button>
      )}

      {existingConfig && (
        <>
          {/* Visual bar */}
          <div className="flex h-3 rounded-full overflow-hidden bg-muted/40">
            {collaborators.map((c, i) => (
              <div
                key={c.user_id}
                className={i === 0 ? "bg-primary" : i % 2 ? "bg-accent" : "bg-primary/60"}
                style={{ width: `${c.pct}%` }}
              />
            ))}
          </div>

          {/* Collaborator list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Collaborators
              </Label>
              <span
                className={`text-xs font-mono ${
                  summed100 ? "text-muted-foreground" : "text-destructive"
                }`}
              >
                {Math.round(totalPct)}% / 100%
              </span>
            </div>
            {collaborators.map((c) => {
              const isLead = c.user_id === existingConfig.creator_id;
              return (
                <div
                  key={c.user_id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-2.5"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={c.profile?.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {(c.profile?.display_name || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">
                        {c.profile?.display_name || c.profile?.username || "Collaborator"}
                      </p>
                      {isLead && (
                        <Badge variant="outline" className="text-[10px] h-4">
                          Lead
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Input
                    type="number"
                    value={c.pct}
                    min={0}
                    max={100}
                    disabled={isLocked}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value)));
                      updatePct.mutate({ userId: c.user_id, pct: v });
                    }}
                    className="w-20 text-right font-mono"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  {!isLead && !isLocked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCollab.mutate(c.user_id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Platform fee read-out */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Platform fee (your tier)</span>
              <span className="font-mono font-semibold">
                {Math.round(
                  (isLocked
                    ? (existingConfig.locked_platform_fee_bps ?? 1500) / 10000
                    : platformFee) * 100,
                )}
                %
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isLocked
                ? "Frozen at lock — same fee applies to every milestone."
                : "Hold more $RHOZE to drop your fee. Spark/Bloom 15% · Glow 10% · Play 7%."}
            </p>
          </div>

          {/* Linked work */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Fingerprint className="h-3.5 w-3.5" />
              Linked work (optional)
            </Label>
            <Select
              value={workId || "__none__"}
              disabled={isLocked}
              onValueChange={(v) => {
                const next = v === "__none__" ? "" : v;
                setWorkId(next);
                saveWork.mutate();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a registered work…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No work linked</SelectItem>
                {myWorks.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    <span className="flex items-center gap-2">
                      {w.title}
                      {w.solana_signature && (
                        <ShieldCheck className="h-3 w-3 text-primary" />
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {linkedWork ? (
              <div
                className="text-[11px] font-mono text-muted-foreground truncate"
                title={linkedWork.content_hash}
              >
                sha256:{shortHash(linkedWork.content_hash)}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Bind a Work so its content hash flows into this split.{" "}
                <Link to="/works" className="text-primary hover:underline">
                  Register a work →
                </Link>
              </p>
            )}
          </div>

          {/* Lock action / locked state */}
          {!isLocked ? (
            <Button
              onClick={() => lockSplits.mutate()}
              disabled={lockSplits.isPending || !summed100}
              className="w-full"
              variant="default"
            >
              {lockSplits.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Lock className="h-4 w-4 mr-2" />
              {summed100 ? "Lock splits" : `Sum must equal 100% (now ${Math.round(totalPct)}%)`}
            </Button>
          ) : (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <Lock className="h-3.5 w-3.5" />
                Locked {existingConfig.locked_at
                  ? new Date(existingConfig.locked_at).toLocaleDateString()
                  : ""}
              </div>
              {existingConfig.splits_hash && (
                <div
                  className="font-mono text-[11px] text-muted-foreground truncate"
                  title={existingConfig.splits_hash}
                >
                  fingerprint: {existingConfig.splits_hash.slice(0, 24)}…
                  {existingConfig.splits_hash.slice(-8)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Splits cannot be rewritten mid-project. Each payout references this fingerprint.
              </p>
            </div>
          )}

          {/* Invite collaborator (reuses curator_invites under the hood) */}
          {!isLocked && (
            <CuratorInviteSection
              splitConfigId={existingConfig.id}
              leadCurrentPct={
                collaborators.find((c) => c.user_id === existingConfig.creator_id)?.pct ?? 100
              }
            />
          )}
        </>
      )}
    </div>
  );
};

export default RevenueSplitConfig;

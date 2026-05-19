/**
 * TokenGateDialog — owner-only flow to attach a token-gated unlock to a Work.
 *
 * Picks one of the owner's coin launches, sets a minimum token-hold, and
 * uploads the gated asset to the private `gated-works` bucket. The selected
 * file path + threshold are persisted onto `works.gating` as JSON.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PoolType = "backer" | "launch" | "rhoze_pool";

type Props = {
  workId: string;
  workTitle?: string;
  /** Existing gating config so the dialog can hydrate. */
  current?: {
    enabled?: boolean;
    pool_type?: PoolType;
    launch_id?: string;
    min_tokens?: number;
    gated_path?: string;
  } | null;
  /** Render-prop trigger. Defaults to a small Lock button. */
  trigger?: React.ReactNode;
};

export const TokenGateDialog = ({
  workId,
  workTitle,
  current,
  trigger,
}: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [poolType, setPoolType] = useState<PoolType>(
    current?.pool_type ?? "backer",
  );
  const [launchId, setLaunchId] = useState<string>(current?.launch_id ?? "");
  const [minTokens, setMinTokens] = useState<string>(
    current?.min_tokens != null ? String(current.min_tokens) : "1",
  );
  const [file, setFile] = useState<File | null>(null);

  // Owner's launches (need at least one to gate against).
  const { data: launches } = useQuery({
    queryKey: ["my-launches", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_launches")
        .select("id, ticker, name, status")
        .eq("creator_id", user!.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (poolType === "launch" && !launchId) throw new Error("Pick a coin");
      const threshold = Number(minTokens);
      if (!Number.isFinite(threshold) || threshold < 0) {
        throw new Error("Threshold must be a positive number");
      }

      let gatedPath = current?.gated_path ?? null;

      // Upload only when a new file is provided. Path is scoped to the user's
      // folder so storage RLS will accept the write.
      if (file) {
        const ext = file.name.includes(".")
          ? file.name.split(".").pop()
          : "bin";
        const path = `${user.id}/${workId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("gated-works")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) throw upErr;
        gatedPath = path;
      }

      if (!gatedPath) throw new Error("Upload the gated file");

      const gating: Record<string, unknown> = {
        enabled: true,
        pool_type: poolType,
        min_tokens: threshold,
        gated_path: gatedPath,
      };
      if (poolType === "launch") gating.launch_id = launchId;

      const { error: updErr } = await supabase
        .from("works")
        .update({ gating: gating as never })
        .eq("id", workId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Token gate enabled", {
        description: "Only qualifying holders can unlock this work.",
      });
      qc.invalidateQueries({ queryKey: ["works"] });
      qc.invalidateQueries({ queryKey: ["work", workId] });
      setOpen(false);
      setFile(null);
    },
    onError: (e: any) =>
      toast.error("Could not save gate", { description: e.message }),
  });

  const disableMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("works")
        .update({ gating: null })
        .eq("id", workId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gate removed");
      qc.invalidateQueries({ queryKey: ["works"] });
      qc.invalidateQueries({ queryKey: ["work", workId] });
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            {current?.enabled ? "Edit gate" : "Token-gate"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Token-gate this work
          </DialogTitle>
          <DialogDescription>
            Fans must hold a minimum of your coin to unlock the file.
            {workTitle ? ` Gating "${workTitle}".` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pool type toggle */}
          <div className="space-y-1.5">
            <Label>Who can unlock?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPoolType("launch")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left ${
                  poolType === "launch"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/60 text-muted-foreground hover:bg-muted/30"
                }`}
              >
                Holders of my coin
                <span className="block text-[10px] font-normal text-muted-foreground/80">
                  Requires an active launch
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPoolType("rhoze_pool")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left ${
                  poolType === "rhoze_pool"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/60 text-muted-foreground hover:bg-muted/30"
                }`}
              >
                $RHOZE holders
                <span className="block text-[10px] font-normal text-muted-foreground/80">
                  Live wallet balance
                </span>
              </button>
            </div>
          </div>

          {poolType === "launch" && ((launches?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
              You need an active coin launch to use this pool. Head to the
              Launchpad to create one — or switch to $RHOZE holders above.
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Coin</Label>
              <Select value={launchId} onValueChange={setLaunchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick one of your launches" />
                </SelectTrigger>
                <SelectContent>
                  {launches!.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      ${l.ticker} — {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          <div className="space-y-1.5">
            <Label>
              Minimum {poolType === "rhoze_pool" ? "$RHOZE" : "tokens"} to unlock
            </Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={minTokens}
              onChange={(e) => setMinTokens(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {poolType === "rhoze_pool"
                ? "Read from the holder's connected Solana wallet on each unlock."
                : "Holdings are read from the simulated bonding curve until the on-chain mint ships."}
            </p>
          </div>

            <div className="space-y-1.5">
              <Label>Gated file</Label>
              <label className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30 transition-colors">
                <UploadCloud className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {file
                    ? file.name
                    : current?.gated_path
                      ? "Replace existing file"
                      : "Choose a file (hi-res, stems, PDF, video…)"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                Stored in a private bucket. Holders receive a 5-minute signed
                URL only when their balance qualifies.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {current?.enabled ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => disableMut.mutate()}
                  disabled={disableMut.isPending}
                >
                  Remove gate
                </Button>
              ) : (
                <span />
              )}
              <Button
                onClick={() => saveMut.mutate()}
                disabled={
                  saveMut.isPending ||
                  (poolType === "launch" && !launchId)
                }
                className="gap-1.5"
              >
                {saveMut.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {current?.enabled ? "Save changes" : "Enable gate"}
              </Button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
};

export default TokenGateDialog;

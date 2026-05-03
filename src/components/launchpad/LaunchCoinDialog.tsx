/**
 * LaunchCoinDialog — opens from any Verified IP work surface.
 *
 * Step 4a (scaffold): collects ticker, name, image (URL), description, and
 * lets the creator pick LP-lock duration. Server enforces:
 *   - caller owns the work
 *   - work has a Solana signature (Verified IP)
 *   - ticker is unique
 *
 * Trade fees default to 200 bps creator + 100 bps platform per the chosen
 * launchpad config and are not editable in this first pass.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getHoldTier, getCoinDropsPerMonth, TIERS } from "@/lib/tier-matrix";
import { COIN_LAUNCH_FEE_RHOZE } from "@/lib/rewards-catalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Coins, Upload, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * Work-coin mode (legacy): pass a workId. The coin is bound to that
   * Verified IP work and the dialog calls `create_coin_launch`.
   *
   * Profile-coin mode (current): omit workId. The dialog calls
   * `create_profile_coin_launch` and the coin is bound to the signed-in
   * creator's profile (one active profile coin per creator).
   */
  workId?: string;
  defaultName?: string;
  defaultImage?: string | null;
  /** Optional callback so parents can refetch their coin query on success. */
  onLaunched?: (launchId: string) => void;
}

const LP_LOCK_OPTIONS = [
  { value: "6", label: "6 months" },
  { value: "12", label: "1 year (recommended)" },
  { value: "24", label: "2 years" },
  { value: "60", label: "5 years" },
  { value: "120", label: "10 years" },
];

const LaunchCoinDialog = ({
  open,
  onOpenChange,
  workId,
  defaultName,
  defaultImage,
  onLaunched,
}: Props) => {
  const navigate = useNavigate();
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState(defaultName ?? "");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState(defaultImage ?? "");
  const [lpLock, setLpLock] = useState("12");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dropInfo, setDropInfo] = useState<{
    tierLabel: string;
    cap: number | null;
    used: number;
    balance: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp.user?.id;
      if (!uid) return;
      const [{ data: credits }, { count }] = await Promise.all([
        supabase.from("user_credits").select("balance").eq("user_id", uid).maybeSingle(),
        supabase
          .from("coin_launches")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", uid)
          .neq("status", "cancelled")
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);
      const balance = Number(credits?.balance ?? 0);
      const tier = getHoldTier(balance);
      const cap = getCoinDropsPerMonth(tier);
      const tierLabel = TIERS.find((t) => t.id === tier)?.label ?? "Spark";
      if (!cancelled) setDropInfo({ tierLabel, cap, used: count ?? 0, balance });
    })();
    return () => { cancelled = true; };
  }, [open]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Image files only", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const { data: userResp } = await supabase.auth.getUser();
    if (!userResp.user) {
      setUploading(false);
      toast({ title: "Sign in to upload", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${userResp.user.id}/coin-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatar-uploads")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data: pub } = supabase.storage.from("avatar-uploads").getPublicUrl(path);
    setImageUrl(pub.publicUrl);
    setUploading(false);
    toast({ title: "Image uploaded" });
  };

  const isProfileCoin = !workId;

  const submit = async () => {
    if (ticker.trim().length < 2) {
      toast({ title: "Ticker too short", description: "Pick a 2-10 character ticker.", variant: "destructive" });
      return;
    }
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    const payload = {
      _ticker: ticker.trim(),
      _name: name.trim(),
      _description: description.trim() || null,
      _image_url: imageUrl.trim() || null,
      _creator_fee_bps: 200,
      _platform_fee_bps: 100,
      _lp_lock_months: Number(lpLock),
    };

    const { data, error } = isProfileCoin
      ? await supabase.rpc("create_profile_coin_launch", payload)
      : await supabase.rpc("create_coin_launch", { ...payload, _work_id: workId! });

    setSubmitting(false);
    if (error) {
      toast({ title: "Launch failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Coin launched", description: `$${ticker.toUpperCase()} is now live on the curve.` });
    onOpenChange(false);
    if (data) {
      onLaunched?.(data as string);
      // Always send creators back to their profile Coin tab — that's where
      // the chart + trade panel now live.
      const { data: userResp } = await supabase.auth.getUser();
      if (userResp.user) {
        navigate(`/profiles/${userResp.user.id}?tab=coin`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-500" />
            {isProfileCoin ? "Launch your profile coin" : "Launch a coin for this work"}
          </DialogTitle>
          <DialogDescription>
            {isProfileCoin
              ? "Mint a coin tied to your profile so collectors can back you. Trades flow through a bonding curve until graduation, then migrate to Raydium with locked LP."
              : "Mint a fan coin tied to your Verified IP. Trades flow through a bonding curve until graduation, then migrate to Raydium with locked LP."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label htmlFor="ticker">Ticker</Label>
              <Input
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                placeholder="ROSE"
                className="font-mono uppercase"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="name">Coin name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rose Coin" />
            </div>
          </div>



          <div>
            <Label htmlFor="desc">Description (optional)</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this coin about?"
            />
          </div>

          <div className="space-y-2">
            <Label>Coin image (optional)</Label>
            <div className="flex items-start gap-3">
              {imageUrl ? (
                <div className="relative shrink-0">
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover border border-border/60"
                    onError={() => setImageUrl("")}
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border/60 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition"
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-border/60 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition text-muted-foreground">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span className="text-[9px] mt-0.5">Upload</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <Input
                  id="image"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="…or paste image URL"
                  className="text-xs"
                />
                <p className="text-[10px] text-muted-foreground">PNG/JPG/GIF · max 5 MB</p>
              </div>
            </div>
          </div>

          {dropInfo && (() => {
            const unlimited = dropInfo.cap === null;
            const remaining = unlimited
              ? Infinity
              : Math.max((dropInfo.cap ?? 0) - dropInfo.used, 0);
            const blocked = !unlimited && remaining <= 0;
            return (
              <div
                className={`rounded-md border p-3 text-[11px] ${
                  blocked
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-border/60 bg-muted/30 text-muted-foreground"
                }`}
              >
                <span className="font-medium text-foreground">{dropInfo.tierLabel} tier</span>
                {" — "}
                {unlimited
                  ? "unlimited coin drops."
                  : blocked
                    ? `you've used ${dropInfo.used}/${dropInfo.cap} drops in the last 30 days. Hold more $RHOZE to raise your cap.`
                    : `${remaining} of ${dropInfo.cap} coin drops left in the next 30 days.`}
              </div>
            );
          })()}

          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground">
            Simulated launch — no real liquidity yet. Tokenomics (supply, fees, graduation) lock in once the on-chain mint ships.
          </div>

        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={
              submitting ||
              (dropInfo !== null &&
                dropInfo.cap !== null &&
                dropInfo.used >= dropInfo.cap)
            }
          >
            {submitting && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
            Launch coin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LaunchCoinDialog;

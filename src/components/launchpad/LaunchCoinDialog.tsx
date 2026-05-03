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
   * Coins are now free-form "drops" that can optionally attach to an
   * Event or a Space. Pass `eventId` or `spaceId` to bind the drop to
   * that surface (server checks ownership). Omit both for a standalone
   * drop. The legacy `workId` path is kept for back-compat with old
   * Verified-IP work surfaces.
   */
  workId?: string;
  eventId?: string;
  spaceId?: string;
  /** Where to send the user after launch. Defaults to /coin/<TICKER>. */
  contextLabel?: string;
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
  eventId,
  spaceId,
  contextLabel,
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
  const [initialBuy, setInitialBuy] = useState("500");
  const [step, setStep] = useState<"form" | "confirm">("form");
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
      const [{ data: credits }, { count }, { data: profile }] = await Promise.all([
        supabase.from("user_credits").select("balance").eq("user_id", uid).maybeSingle(),
        supabase
          .from("coin_launches")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", uid)
          .neq("status", "cancelled")
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("profiles").select("avatar_url").eq("id", uid).maybeSingle(),
      ]);
      const balance = Number(credits?.balance ?? 0);
      const tier = getHoldTier(balance);
      const cap = getCoinDropsPerMonth(tier);
      const tierLabel = TIERS.find((t) => t.id === tier)?.label ?? "Spark";
      if (!cancelled) {
        setDropInfo({ tierLabel, cap, used: count ?? 0, balance });
        // Auto-fill coin image with profile avatar (creator can change it).
        setImageUrl((prev) => prev || profile?.avatar_url || "");
      }
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

  const isWorkCoin = !!workId;
  const dropContext = contextLabel
    ?? (eventId ? "this event" : spaceId ? "this space" : null);

  const submit = async () => {
    if (ticker.trim().length < 2) {
      toast({ title: "Ticker too short", description: "Pick a 2-10 character ticker.", variant: "destructive" });
      return;
    }
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!imageUrl.trim()) {
      toast({ title: "Coin image required", description: "Use your profile picture or upload one.", variant: "destructive" });
      return;
    }
    const initialBuyNum = Math.max(0, Number(initialBuy) || 0);
    const totalSpend = COIN_LAUNCH_FEE_RHOZE + initialBuyNum;
    if (initialBuyNum < 1) {
      toast({
        title: "Kickstart your coin",
        description: "Buy at least 1 $RHOZE worth to seed your own supply.",
        variant: "destructive",
      });
      return;
    }
    if (dropInfo && dropInfo.balance < totalSpend) {
      toast({
        title: "Not enough $RHOZE",
        description: `Launch fee + initial buy = ${totalSpend} $RHOZE. You have ${Math.floor(dropInfo.balance)}.`,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);

    const basePayload = {
      _ticker: ticker.trim(),
      _name: name.trim(),
      _description: description.trim() || null,
      _image_url: imageUrl.trim() || null,
      _creator_fee_bps: 200,
      _platform_fee_bps: 100,
      _lp_lock_months: Number(lpLock),
    };

    const { data, error } = isWorkCoin
      ? await supabase.rpc("create_coin_launch", { ...basePayload, _work_id: workId! })
      : await supabase.rpc("create_drop_coin_launch", {
          ...basePayload,
          _event_id: eventId ?? null,
          _space_id: spaceId ?? null,
        });

    if (error) {
      setSubmitting(false);
      toast({ title: "Launch failed", description: error.message, variant: "destructive" });
      return;
    }

    // Best-effort fee deduction. Server-side ledger should mirror this in the
    // future; for now we mutate user_credits.balance directly so the launch
    // feels real and the next-tier math reflects the spend.
    const { data: userResp } = await supabase.auth.getUser();
    if (userResp.user && dropInfo) {
      const newBalance = Math.max(0, dropInfo.balance - COIN_LAUNCH_FEE_RHOZE);
      await supabase
        .from("user_credits")
        .update({ balance: newBalance })
        .eq("user_id", userResp.user.id);
    }

    // Kickstart buy — give the creator an initial share of supply so they
    // own a % of the float from day one.
    let kickPct: number | null = null;
    if (data && initialBuyNum > 0) {
      const { data: buyRes, error: buyErr } = await supabase.rpc("swap_rhoze_for_coin", {
        _launch_id: data as string,
        _side: "buy",
        _amount: initialBuyNum,
      });
      if (buyErr) {
        toast({
          title: "Coin launched, kickstart buy failed",
          description: buyErr.message,
          variant: "destructive",
        });
      } else if (buyRes && typeof buyRes === "object") {
        const tokensOut = Number((buyRes as any).tokens_out ?? 0);
        const { data: launchRow } = await supabase
          .from("coin_launches")
          .select("total_supply")
          .eq("id", data as string)
          .maybeSingle();
        const supply = Number(launchRow?.total_supply ?? 0) || 1;
        kickPct = (tokensOut / supply) * 100;
      }
    }

    setSubmitting(false);
    toast({
      title: "Coin dropped",
      description: kickPct !== null
        ? `$${ticker.toUpperCase()} is live. You own ${kickPct.toFixed(2)}% of supply.`
        : `$${ticker.toUpperCase()} is live.`,
    });
    onOpenChange(false);
    if (data) {
      onLaunched?.(data as string);
      // Resolve to mint_address (vanity CA) so the URL is the canonical coin slug.
      const { data: launched } = await supabase
        .from("coin_launches")
        .select("mint_address, ticker")
        .eq("id", data as string)
        .maybeSingle();
      const slug = launched?.mint_address || launched?.ticker || ticker.trim().toUpperCase();
      navigate(`/coin/${slug}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-500" />
            {isWorkCoin
              ? "Launch a coin for this work"
              : dropContext
                ? `Drop a coin for ${dropContext}`
                : "Drop a new coin"}
          </DialogTitle>
          <DialogDescription>
            {isWorkCoin
              ? "Launch a coin tied to this work so your community can back it. Supporters buy in early, and you earn a cut of every trade as it grows."
              : "Drop a coin so your community can back it and grow with you. Think of it like crowdfunding — supporters buy in early, and as more people join, the value rises. You earn a cut of every trade."}
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
            <Label>Coin image</Label>
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
              <div className="flex-1 min-w-0 space-y-1 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  We use your profile picture by default. Tap the image to remove it and upload your own.
                </p>
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

          {/* Kickstart buy — owner gets a % of supply on day one */}
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="initial-buy" className="text-xs font-medium text-foreground">
                Kickstart buy
              </Label>
              <span className="text-[10px] text-muted-foreground">Own a slice from day one</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="initial-buy"
                type="number"
                min="0"
                step="1"
                value={initialBuy}
                onChange={(e) => setInitialBuy(e.target.value)}
                className="font-mono"
              />
              <span className="text-xs text-muted-foreground shrink-0">$RHOZE</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["100", "500", "1000", "5000"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setInitialBuy(v)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                    initialBuy === v
                      ? "bg-foreground text-background border-foreground"
                      : "border-border/60 hover:bg-muted/50"
                  }`}
                >
                  {Number(v).toLocaleString()}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              The earlier you buy, the bigger your % of total supply. You can sell anytime from the trade panel.
            </p>
          </div>

          {(() => {
            const balance = dropInfo?.balance ?? 0;
            const initialBuyNum = Math.max(0, Number(initialBuy) || 0);
            const totalSpend = COIN_LAUNCH_FEE_RHOZE + initialBuyNum;
            const insufficient = balance < totalSpend;
            return (
              <div
                className={`rounded-md border p-3 text-[11px] space-y-1 ${
                  insufficient
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-border/60 bg-muted/30 text-muted-foreground"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-foreground">Total to deduct</span>
                  <span className="font-mono tabular-nums shrink-0 text-foreground">
                    {totalSpend.toLocaleString()} $RHOZE
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[10px]">
                  <span>
                    Launch fee {COIN_LAUNCH_FEE_RHOZE} · Kickstart {initialBuyNum.toLocaleString()}
                  </span>
                  <span className="font-mono tabular-nums">
                    Bal: {Math.floor(balance).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })()}

        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={
              submitting ||
              (dropInfo !== null &&
                dropInfo.cap !== null &&
                dropInfo.used >= dropInfo.cap) ||
              (dropInfo !== null &&
                dropInfo.balance < COIN_LAUNCH_FEE_RHOZE + Math.max(0, Number(initialBuy) || 0))
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

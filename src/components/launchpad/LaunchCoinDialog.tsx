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
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Coins, Lock } from "lucide-react";

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
            <Label htmlFor="image">Image URL (optional)</Label>
            <Input id="image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
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

          <div>
            <Label className="flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> LP lock at graduation
            </Label>
            <Select value={lpLock} onValueChange={setLpLock}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LP_LOCK_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              When the curve fills (85 SOL), liquidity migrates to Raydium and is locked for this duration.
            </p>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>Trade fee</span><span className="font-mono">3% (2% creator · 1% platform)</span></div>
            <div className="flex justify-between"><span>Total supply</span><span className="font-mono">1,000,000,000</span></div>
            <div className="flex justify-between"><span>Graduation target</span><span className="font-mono">85 SOL</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
            Launch coin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LaunchCoinDialog;

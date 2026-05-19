import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sparkles, Globe, Zap, Check, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

type SKU = "featured_24h" | "featured_7d" | "globe_pin_24h";

interface BoostSku {
  id: SKU;
  label: string;
  usd: number;
  credits: number;
  duration: string;
  icon: React.ComponentType<{ className?: string }>;
  perks: string[];
  highlight?: boolean;
}

const SKUS: BoostSku[] = [
  {
    id: "featured_24h",
    label: "Featured 24h",
    usd: 15,
    credits: 1500,
    duration: "24 hours",
    icon: Zap,
    perks: ["Top of Discover Featured grid", "Priority in Connect deck"],
  },
  {
    id: "featured_7d",
    label: "Featured 7d",
    usd: 75,
    credits: 7500,
    duration: "7 days",
    icon: Sparkles,
    perks: ["Top of Discover for a full week", "Priority in Connect deck", "Best value"],
    highlight: true,
  },
  {
    id: "globe_pin_24h",
    label: "Globe pin 24h",
    usd: 30,
    credits: 3000,
    duration: "24 hours",
    icon: Globe,
    perks: ["Pinned dot on the Discover globe", "Region-visible to every visitor"],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BoostProfileSheet({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<SKU>("featured_7d");

  const { data: credits } = useQuery({
    queryKey: ["user-credits-balance", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      return Number(data?.balance ?? 0);
    },
    enabled: !!user && open,
  });

  const { data: pin } = useQuery({
    queryKey: ["profile-featured-pin", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("featured_pin_until, featured_tier, verified_pro_at")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && open,
  });

  const purchase = useMutation({
    mutationFn: async (sku: SKU) => {
      const { data, error } = await supabase.rpc("purchase_featured_boost", { _sku: sku });
      if (error) throw error;
      return data as { success: boolean; expires_at: string; tier: string; credits_spent: number };
    },
    onSuccess: (data) => {
      toast.success(`Boost active until ${format(new Date(data.expires_at), "MMM d, h:mm a")}`);
      qc.invalidateQueries({ queryKey: ["user-credits-balance"] });
      qc.invalidateQueries({ queryKey: ["profile-featured-pin"] });
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Could not purchase boost");
    },
  });

  const PRO_CREDITS = 2900;
  const purchasePro = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("purchase_verified_pro");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Welcome to Verified Pro — fee floor now 10%.");
      qc.invalidateQueries({ queryKey: ["user-credits-balance"] });
      qc.invalidateQueries({ queryKey: ["profile-featured-pin"] });
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not upgrade"),
  });


  const chosen = SKUS.find((s) => s.id === selected)!;
  const balance = credits ?? 0;
  const canAfford = balance >= chosen.credits;
  const activePin = pin?.featured_pin_until ? new Date(pin.featured_pin_until) : null;
  const isActive = activePin && activePin > new Date();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" /> Boost your profile
          </SheetTitle>
          <SheetDescription>
            Get in front of more backers. Paid in Credits — no fees, instant.
          </SheetDescription>
        </SheetHeader>

        {isActive && (
          <div className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm">
            You're currently boosted ({pin?.featured_tier ?? "featured"}) until{" "}
            <strong>{format(activePin!, "MMM d, h:mm a")}</strong>. New purchases stack on top.
          </div>
        )}

        <div className="mt-5 grid gap-3">
          {SKUS.map((sku) => {
            const Icon = sku.icon;
            const isSel = selected === sku.id;
            return (
              <Card
                key={sku.id}
                onClick={() => setSelected(sku.id)}
                className={`p-4 cursor-pointer transition border-2 ${
                  isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                    isSel ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold flex items-center gap-2">
                        {sku.label}
                        {sku.highlight && <Badge variant="secondary" className="text-[10px]">Best value</Badge>}
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{sku.credits.toLocaleString()} Credits</div>
                        <div className="text-xs text-muted-foreground">≈ ${sku.usd}</div>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {sku.perks.map((p) => (
                        <li key={p} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-emerald-500 shrink-0" /> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Phase B3 — Verified Pro one-time upgrade */}
        {pin?.verified_pro_at ? (
          <div className="mt-5 rounded-xl bg-gradient-to-r from-amber-500/10 via-fuchsia-500/10 to-indigo-500/10 border border-fuchsia-500/30 p-4">
            <div className="flex items-center gap-2 font-semibold">
              <BadgeCheck className="h-4 w-4 text-fuchsia-500" /> You're Verified Pro
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Custom banners unlocked · Connect priority · platform fee floored at 10%
            </p>
          </div>
        ) : (
          <Card className="mt-5 p-4 border-2 border-fuchsia-500/30 bg-gradient-to-br from-amber-500/5 via-fuchsia-500/5 to-indigo-500/5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 via-fuchsia-500 to-indigo-500 text-white flex items-center justify-center">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold flex items-center gap-2">
                    Verified Pro
                    <Badge variant="secondary" className="text-[10px]">One-time</Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{PRO_CREDITS.toLocaleString()} Credits</div>
                    <div className="text-xs text-muted-foreground">≈ $29 forever</div>
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {[
                    "Pro chip next to your name",
                    "Upload a custom banner image",
                    "Priority in Connect matching",
                    "Platform fee floored at 10% (skip Spark/Bloom)",
                  ].map((p) => (
                    <li key={p} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500 shrink-0" /> {p}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  className="mt-3 w-full bg-gradient-to-r from-amber-500 via-fuchsia-500 to-indigo-500 text-white border-0 hover:opacity-90"
                  disabled={balance < PRO_CREDITS || purchasePro.isPending}
                  onClick={() => purchasePro.mutate()}
                >
                  {purchasePro.isPending
                    ? "Upgrading…"
                    : balance >= PRO_CREDITS
                      ? "Upgrade to Verified Pro"
                      : `Need ${(PRO_CREDITS - balance).toLocaleString()} more Credits`}
                </Button>
              </div>
            </div>
          </Card>
        )}


        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your balance</span>
            <span className="font-medium">{balance.toLocaleString()} Credits</span>
          </div>
          <Button
            className="w-full h-12 text-base"
            disabled={!canAfford || purchase.isPending}
            onClick={() => purchase.mutate(selected)}
          >
            {purchase.isPending
              ? "Activating…"
              : canAfford
                ? `Boost for ${chosen.duration}`
                : `Need ${(chosen.credits - balance).toLocaleString()} more Credits`}
          </Button>
          {!canAfford && (
            <Button variant="outline" className="w-full" onClick={() => (window.location.href = "/credits?tab=topup")}>
              Top up Credits
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground text-center">
            Boosts are non-refundable. Card checkout coming soon.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

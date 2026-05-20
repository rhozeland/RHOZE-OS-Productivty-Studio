/**
 * CreatorTiersCard — v10 creator-side perk editor.
 *
 * Lets the signed-in creator define what their $5 / $10 / $25 subscription
 * tiers unlock. Each tier has an `active` toggle (defaults on) and a free-form
 * perks textarea (one line per bullet). Saves to `creator_subscription_tiers`.
 *
 * Prices are fixed platform-wide ($5/$10/$25) — only perks + active are
 * editable here. Fans see this on the SubscribeToCreatorSheet.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Lock, MessageSquare, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tier = "basic" | "standard" | "premium";

const TIER_META: Record<Tier, { name: string; price: number; icon: typeof Lock; placeholder: string }> = {
  basic: {
    name: "Basic",
    price: 5,
    icon: Lock,
    placeholder: "Private feed access\nSubscriber-only posts",
  },
  standard: {
    name: "Standard",
    price: 10,
    icon: MessageSquare,
    placeholder: "Everything in Basic\nDirect messaging\nEarly drops",
  },
  premium: {
    name: "Premium",
    price: 25,
    icon: Sparkles,
    placeholder: "Everything in Standard\nBehind-the-scenes\nPriority DMs",
  },
};

const DEFAULT_PERKS: Record<Tier, string[]> = {
  basic: ["Private feed access", "Subscriber-only posts"],
  standard: ["Everything in Basic", "Direct messaging", "Early drops"],
  premium: ["Everything in Standard", "Behind-the-scenes", "Priority DMs"],
};

interface TierRow {
  tier: Tier;
  perks: string[];
  active: boolean;
  perksText: string;
}

export default function CreatorTiersCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<Tier, TierRow>>({
    basic: { tier: "basic", perks: DEFAULT_PERKS.basic, active: true, perksText: DEFAULT_PERKS.basic.join("\n") },
    standard: { tier: "standard", perks: DEFAULT_PERKS.standard, active: true, perksText: DEFAULT_PERKS.standard.join("\n") },
    premium: { tier: "premium", perks: DEFAULT_PERKS.premium, active: true, perksText: DEFAULT_PERKS.premium.join("\n") },
  });
  const [dmSubsOnly, setDmSubsOnly] = useState(false);
  const [dmSaving, setDmSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data }, { data: prof }] = await Promise.all([
        supabase
          .from("creator_subscription_tiers")
          .select("tier, perks, active")
          .eq("creator_id", user.id),
        supabase
          .from("profiles")
          .select("dm_subscribers_only")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (data && data.length > 0) {
        setRows((prev) => {
          const next = { ...prev };
          for (const r of data) {
            const tier = r.tier as Tier;
            const perks = Array.isArray(r.perks) ? (r.perks as string[]) : DEFAULT_PERKS[tier];
            next[tier] = {
              tier,
              perks,
              active: r.active,
              perksText: perks.join("\n"),
            };
          }
          return next;
        });
      }
      setDmSubsOnly(!!prof?.dm_subscribers_only);
      setLoading(false);
    })();
  }, [user]);

  const handleDmToggle = async (v: boolean) => {
    if (!user) return;
    setDmSubsOnly(v); // optimistic
    setDmSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ dm_subscribers_only: v })
      .eq("id", user.id);
    setDmSaving(false);
    if (error) {
      setDmSubsOnly(!v);
      toast.error(error.message);
      return;
    }
    toast.success(v ? "DMs are now subscribers-only" : "DMs are open to everyone");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const upserts = (Object.values(rows) as TierRow[]).map((r) => ({
      creator_id: user.id,
      tier: r.tier,
      monthly_price_usd: TIER_META[r.tier].price,
      perks: r.perksText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      active: r.active,
    }));

    const { error } = await supabase
      .from("creator_subscription_tiers")
      .upsert(upserts, { onConflict: "creator_id,tier" });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Subscription tiers saved");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-muted/40 border border-border/40 p-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Fans pay <span className="text-foreground font-medium">$5, $10, or $25/month</span> to subscribe.
          You keep <span className="text-foreground font-medium">85%</span>, Rhozeland keeps 15%. Prices are
          fixed across the platform — customize what each tier unlocks below. Turn a tier off if you don't
          want to offer it.
        </p>
      </div>

      <div className="grid gap-4">
        {(Object.keys(TIER_META) as Tier[]).map((tier) => {
          const meta = TIER_META[tier];
          const row = rows[tier];
          const Icon = meta.icon;
          return (
            <div
              key={tier}
              className={cn(
                "rounded-xl border p-4 transition-all",
                row.active ? "bg-card/60 border-border" : "bg-muted/30 border-border/40 opacity-70",
              )}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{meta.name}</p>
                    <p className="text-sm font-display font-semibold">
                      ${meta.price}
                      <span className="text-[10px] text-muted-foreground font-normal">/mo</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Creator keeps ${(meta.price * 0.85).toFixed(2)}/mo per subscriber
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {row.active ? "On" : "Off"}
                  </span>
                  <Switch
                    checked={row.active}
                    onCheckedChange={(v) =>
                      setRows((prev) => ({ ...prev, [tier]: { ...prev[tier], active: v } }))
                    }
                  />
                </div>
              </div>

              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Perks (one per line)
                </span>
                <Textarea
                  value={row.perksText}
                  onChange={(e) =>
                    setRows((prev) => ({ ...prev, [tier]: { ...prev[tier], perksText: e.target.value } }))
                  }
                  placeholder={meta.placeholder}
                  rows={4}
                  className="mt-1.5 text-xs resize-none"
                  disabled={!row.active}
                />
              </label>

              {row.active && row.perksText.trim() && (
                <div className="mt-3 pt-3 border-t border-border/40">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                    Preview
                  </p>
                  <ul className="space-y-1">
                    {row.perksText
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .map((p, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Check className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                          <span>{p}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save tiers
        </Button>
      </div>
    </div>
  );
}

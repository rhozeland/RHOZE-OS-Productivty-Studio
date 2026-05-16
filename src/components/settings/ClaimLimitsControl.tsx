import { useEffect, useMemo, useState } from "react";
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
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { readClaimLimits, writeClaimLimits } from "@/lib/claim-limits";

type PresetId = "off" | "conservative" | "standard" | "power" | "custom";

const PRESETS: Record<Exclude<PresetId, "custom">, { label: string; min: number | null; max: number | null; hint: string }> = {
  off: { label: "Off — no limit", min: null, max: null, hint: "No min or max" },
  conservative: { label: "Conservative", min: 1, max: 100, hint: "1 – 100 $RHOZE" },
  standard: { label: "Standard (recommended)", min: 1, max: 500, hint: "1 – 500 $RHOZE" },
  power: { label: "Power user", min: 10, max: 5000, hint: "10 – 5,000 $RHOZE" },
};

const matchPreset = (min: number | null, max: number | null): PresetId => {
  for (const [id, p] of Object.entries(PRESETS) as [Exclude<PresetId, "custom">, typeof PRESETS[keyof typeof PRESETS]][]) {
    if (p.min === min && p.max === max) return id;
  }
  return "custom";
};

const ClaimLimitsControl = () => {
  const [preset, setPreset] = useState<PresetId>("standard");
  const [minStr, setMinStr] = useState("");
  const [maxStr, setMaxStr] = useState("");

  useEffect(() => {
    const { min, max } = readClaimLimits();
    setMinStr(min == null ? "" : String(min));
    setMaxStr(max == null ? "" : String(max));
    setPreset(matchPreset(min ?? null, max ?? null));
  }, []);

  const parse = (v: string): number | null => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    if (!isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  };

  const currentHint = useMemo(() => {
    if (preset !== "custom") return PRESETS[preset].hint;
    const min = parse(minStr);
    const max = parse(maxStr);
    if (min == null && max == null) return "No min or max";
    return `${min ?? "no min"} – ${max ?? "no max"} $RHOZE`;
  }, [preset, minStr, maxStr]);

  const onPresetChange = (id: PresetId) => {
    setPreset(id);
    if (id === "custom") return;
    const p = PRESETS[id];
    setMinStr(p.min == null ? "" : String(p.min));
    setMaxStr(p.max == null ? "" : String(p.max));
    writeClaimLimits({ min: p.min, max: p.max });
    toast.success(`Claim limits: ${p.label}`);
  };

  const saveCustom = () => {
    const min = parse(minStr);
    const max = parse(maxStr);
    if (min != null && max != null && min > max) {
      toast.error("Minimum can't be greater than maximum");
      return;
    }
    writeClaimLimits({ min, max });
    toast.success("Custom claim limits saved", { description: currentHint });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-tight">Claim safety limits</h3>
            <p className="text-[11px] text-muted-foreground truncate">Caps how much $RHOZE you can claim at once. {currentHint}.</p>
          </div>
        </div>
        <Select value={preset} onValueChange={(v) => onPresetChange(v as PresetId)}>
          <SelectTrigger className="w-[180px] h-8 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(PRESETS) as [Exclude<PresetId, "custom">, typeof PRESETS[keyof typeof PRESETS]][]).map(([id, p]) => (
              <SelectItem key={id} value={id} className="text-xs">{p.label}</SelectItem>
            ))}
            <SelectItem value="custom" className="text-xs">Custom…</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {preset === "custom" && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="claim-min" className="text-xs">Minimum per claim</Label>
              <Input id="claim-min" type="number" min={1} step={1} inputMode="numeric"
                placeholder="e.g. 1" value={minStr} onChange={(e) => setMinStr(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="claim-max" className="text-xs">Maximum per claim</Label>
              <Input id="claim-max" type="number" min={1} step={1} inputMode="numeric"
                placeholder="e.g. 500" value={maxStr} onChange={(e) => setMaxStr(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveCustom} size="sm">Save limits</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimLimitsControl;

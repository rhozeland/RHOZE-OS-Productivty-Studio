import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { readClaimLimits, writeClaimLimits } from "@/lib/claim-limits";

const PRESETS = [
  { label: "Off", min: "", max: "" },
  { label: "Conservative", min: "1", max: "100" },
  { label: "Standard", min: "1", max: "500" },
  { label: "Power user", min: "10", max: "5000" },
] as const;

const ClaimLimitsControl = () => {
  const [minStr, setMinStr] = useState("");
  const [maxStr, setMaxStr] = useState("");

  useEffect(() => {
    const { min, max } = readClaimLimits();
    setMinStr(min == null ? "" : String(min));
    setMaxStr(max == null ? "" : String(max));
  }, []);

  const parse = (v: string): number | null => {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  };

  const save = () => {
    const min = parse(minStr);
    const max = parse(maxStr);
    if (min != null && max != null && min > max) {
      toast.error("Minimum can't be greater than maximum");
      return;
    }
    writeClaimLimits({ min, max });
    if (min == null && max == null) {
      toast.success("Claim safety limits cleared");
    } else {
      toast.success("Claim safety limits saved", {
        description: `${min ?? "no min"} – ${max ?? "no max"} $RHOZE per claim`,
      });
    }
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setMinStr(p.min);
    setMaxStr(p.max);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Claim safety limits</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Set a minimum and/or maximum $RHOZE amount allowed per claim confirmation.
            Helps prevent fat-finger claims. Leave a field blank to disable that limit.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="claim-min" className="text-xs">Minimum per claim</Label>
          <Input
            id="claim-min"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="e.g. 1"
            value={minStr}
            onChange={(e) => setMinStr(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="claim-max" className="text-xs">Maximum per claim</Label>
          <Input
            id="claim-max"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="e.g. 500"
            value={maxStr}
            onChange={(e) => setMaxStr(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Presets
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className="text-[11px] px-2.5 py-1 rounded-full border border-border text-foreground/80 hover:bg-muted transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} size="sm">Save limits</Button>
      </div>
    </div>
  );
};

export default ClaimLimitsControl;

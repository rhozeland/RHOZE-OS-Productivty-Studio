/**
 * LaunchpadIdlSettings — paste the Anchor IDL + (optional) program ID at
 * runtime. Once both are present, all trade buttons switch to real
 * on-chain mode without code changes.
 *
 * Render in any settings module. Stored in localStorage; clear to reset.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import {
  setOverrideIdl,
  setOverrideProgramId,
  getOverrideProgramId,
  getCachedIdl,
  isIdlFromOverride,
  subscribeIdl,
  loadLaunchpadIdl,
} from "@/lib/launchpad-idl-store";
import { LAUNCHPAD_NETWORK, isLaunchpadOnChainEnabled, getLaunchpadProgramId } from "@/lib/launchpad-onchain";

const LaunchpadIdlSettings = () => {
  const [idlText, setIdlText] = useState("");
  const [programId, setProgramId] = useState(getOverrideProgramId() ?? "");
  const [, force] = useState(0);

  useEffect(() => {
    void loadLaunchpadIdl();
    const unsub = subscribeIdl(() => force((n) => n + 1));
    return unsub;
  }, []);

  const idl = getCachedIdl();
  const fromOverride = isIdlFromOverride();
  const enabled = isLaunchpadOnChainEnabled();
  const activePid = getLaunchpadProgramId()?.toBase58() ?? null;

  const ixSummary = useMemo(() => {
    if (!idl) return null;
    const list = (idl as unknown as { instructions?: Array<{ name: string }> }).instructions ?? [];
    return list.map((i) => i.name);
  }, [idl]);

  const handleSave = () => {
    try {
      if (idlText.trim()) setOverrideIdl(idlText);
      if (programId.trim()) setOverrideProgramId(programId.trim());
      else setOverrideProgramId(null);
      toast.success("Launchpad IDL saved", {
        description: "Trade buttons will now use the on-chain program.",
      });
      setIdlText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save IDL");
    }
  };

  const handleClear = () => {
    setOverrideIdl(null);
    setOverrideProgramId(null);
    setIdlText("");
    setProgramId("");
    toast.success("Cleared. Falling back to simulation mode.");
  };

  return (
    <Card className="bg-card/40 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          On-chain Launchpad
          {enabled ? (
            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Live · {LAUNCHPAD_NETWORK}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Simulation
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Paste your deployed Anchor IDL (and program ID if it differs from the env var). Both
          are stored in your browser only. The trade buttons switch to real on-chain calls the
          moment both are present and a wallet is connected.
        </p>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">Program ID</label>
          <Input
            placeholder="e.g. RhozLp1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="font-mono text-xs"
          />
          {activePid && (
            <p className="text-[10px] text-muted-foreground font-mono">Active: {activePid}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">IDL JSON</label>
          <Textarea
            placeholder='{ "address": "...", "metadata": {...}, "instructions": [...] }'
            value={idlText}
            onChange={(e) => setIdlText(e.target.value)}
            className="font-mono text-[11px] min-h-[140px]"
          />
        </div>

        {idl && ixSummary && (
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-500">IDL loaded</span>
              <span className="text-[10px] text-muted-foreground">
                {fromOverride ? "from your paste" : "from public/launchpad-idl.json"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {ixSummary.slice(0, 12).map((name) => (
                <Badge key={name} variant="secondary" className="font-mono text-[10px]">
                  {name}
                </Badge>
              ))}
              {ixSummary.length > 12 && (
                <Badge variant="outline" className="text-[10px]">+{ixSummary.length - 12} more</Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} disabled={!idlText.trim() && !programId.trim()} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
          <Button onClick={handleClear} variant="outline" className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default LaunchpadIdlSettings;

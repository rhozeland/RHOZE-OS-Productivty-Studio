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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, RotateCcw, Save, XCircle, Info } from "lucide-react";
import { toast } from "sonner";
import {
  setOverrideIdl,
  setOverrideProgramId,
  getOverrideProgramId,
  getCachedIdl,
  isIdlFromOverride,
  subscribeIdl,
  loadLaunchpadIdl,
  validateIdl,
} from "@/lib/launchpad-idl-store";
import { LAUNCHPAD_NETWORK, isLaunchpadOnChainEnabled, getLaunchpadProgramId } from "@/lib/launchpad-onchain";
import { cn } from "@/lib/utils";

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

  // Live validation as the user types
  const liveValidation = useMemo(
    () => (idlText.trim() ? validateIdl(idlText) : null),
    [idlText],
  );
  const blockingErrors = liveValidation?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = liveValidation?.issues.filter((i) => i.severity === "warning") ?? [];

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
      toast.error("IDL rejected", {
        description: e instanceof Error ? e.message : "Failed to save IDL",
      });
    }
  };

  const handleClear = () => {
    setOverrideIdl(null);
    setOverrideProgramId(null);
    setIdlText("");
    setProgramId("");
    toast.success("Cleared. Falling back to simulation mode.");
  };

  const canSave =
    (idlText.trim() && liveValidation?.ok) || (!idlText.trim() && programId.trim().length > 0);

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
          are stored in your browser only. The IDL must include <code className="text-foreground">address</code>,{" "}
          <code className="text-foreground">instructions</code>, and <code className="text-foreground">accounts</code>{" "}
          before on-chain trading is enabled.
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
            placeholder='{ "address": "...", "metadata": {...}, "instructions": [...], "accounts": [...] }'
            value={idlText}
            onChange={(e) => setIdlText(e.target.value)}
            className={cn(
              "font-mono text-[11px] min-h-[140px]",
              liveValidation && !liveValidation.ok && "border-destructive/60 focus-visible:ring-destructive/40",
              liveValidation?.ok && "border-emerald-500/50 focus-visible:ring-emerald-500/40",
            )}
          />
        </div>

        {liveValidation && !liveValidation.ok && (
          <Alert variant="destructive" className="bg-destructive/5">
            <XCircle className="h-4 w-4" />
            <AlertTitle className="text-sm">
              {blockingErrors.length} required field{blockingErrors.length === 1 ? "" : "s"} missing or invalid
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1 text-xs">
                {blockingErrors.map((issue, i) => (
                  <li key={i} className="flex gap-2">
                    <code className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive shrink-0 h-fit">
                      {issue.field}
                    </code>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {liveValidation?.ok && warnings.length > 0 && (
          <Alert className="bg-amber-500/5 border-amber-500/30">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-sm text-amber-200">
              Valid — {warnings.length} recommendation{warnings.length === 1 ? "" : "s"}
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1 text-xs">
                {warnings.map((issue, i) => (
                  <li key={i} className="flex gap-2">
                    <code className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 shrink-0 h-fit">
                      {issue.field}
                    </code>
                    <span className="text-muted-foreground">{issue.message}</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {liveValidation?.ok && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Ready to save
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
              <span>Instructions: <span className="text-foreground">{liveValidation.summary.instructionCount}</span></span>
              <span>Accounts: <span className="text-foreground">{liveValidation.summary.accountCount}</span></span>
              <span>Events: <span className="text-foreground">{liveValidation.summary.eventCount}</span></span>
              <span>Errors: <span className="text-foreground">{liveValidation.summary.errorCount}</span></span>
            </div>
            {liveValidation.summary.foundIxAliases.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {liveValidation.summary.foundIxAliases.map((a) => (
                  <Badge key={a} variant="secondary" className="font-mono text-[10px]">{a}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {idl && ixSummary && !idlText.trim() && (
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
          <Button onClick={handleSave} disabled={!canSave} className="gap-1.5">
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

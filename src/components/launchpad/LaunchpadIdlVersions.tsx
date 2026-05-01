/**
 * LaunchpadIdlVersions — manage multiple IDL+programId versions per network
 * (devnet / mainnet-beta) and switch the active one. The currently active
 * version on the *current* network is what every TradePanel uses.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  Circle,
  Trash2,
  Plus,
  Power,
  PowerOff,
  Radio,
  XCircle,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  type IdlVersion,
  type LaunchpadNetwork,
  activateVersion,
  deactivateNetwork,
  deleteVersion,
  getActiveVersionId,
  getCurrentNetwork,
  listVersions,
  saveVersion,
  subscribeVersions,
  updateVersion,
} from "@/lib/launchpad-idl-versions";
import { validateIdl } from "@/lib/launchpad-idl-store";
import { cn } from "@/lib/utils";

const NETWORKS: LaunchpadNetwork[] = ["devnet", "mainnet-beta"];

const LaunchpadIdlVersions = () => {
  const [, force] = useState(0);
  useEffect(() => subscribeVersions(() => force((n) => n + 1)), []);

  const currentNetwork = getCurrentNetwork();
  const [tab, setTab] = useState<LaunchpadNetwork>(currentNetwork);

  return (
    <Card className="bg-card/40 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          IDL Versions
          <Badge variant="outline" className="gap-1 text-[10px] uppercase">
            <Radio className="h-3 w-3" /> Current env: {currentNetwork}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground pt-1">
          Save multiple Anchor IDL + program ID pairs per network and switch instantly. The
          active version on <span className="font-mono text-foreground">{currentNetwork}</span>{" "}
          is what trade buttons use.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as LaunchpadNetwork)}>
          <TabsList className="grid grid-cols-2 w-full mb-4">
            {NETWORKS.map((n) => (
              <TabsTrigger key={n} value={n} className="text-xs">
                {n}
                {n === currentNetwork && (
                  <Badge variant="outline" className="ml-2 text-[9px] h-4 px-1">env</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {NETWORKS.map((n) => (
            <TabsContent key={n} value={n} className="space-y-4 mt-0">
              <NetworkPanel network={n} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

interface NetworkPanelProps {
  network: LaunchpadNetwork;
}

const NetworkPanel = ({ network }: NetworkPanelProps) => {
  const versions = listVersions(network);
  const activeId = getActiveVersionId(network);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {versions.length} saved {versions.length === 1 ? "version" : "versions"}
        </span>
        <div className="flex gap-2">
          {activeId && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => {
                deactivateNetwork(network);
                toast.success(`Deactivated ${network}. Trades back to simulation.`);
              }}
            >
              <PowerOff className="h-3 w-3" /> Deactivate
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setAdding((a) => !a)}
            variant={adding ? "outline" : "default"}
          >
            {adding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {adding ? "Cancel" : "Add version"}
          </Button>
        </div>
      </div>

      {adding && (
        <VersionForm
          network={network}
          onCancel={() => setAdding(false)}
          onSaved={() => setAdding(false)}
        />
      )}

      {versions.length === 0 && !adding && (
        <Alert className="bg-muted/30">
          <AlertTitle className="text-sm">No versions yet</AlertTitle>
          <AlertDescription className="text-xs">
            Add your first deployed program for {network}. You can save several and switch
            between them whenever you redeploy.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {versions.map((v) => (
          <VersionRow
            key={v.id}
            version={v}
            isActive={v.id === activeId}
            isEditing={editingId === v.id}
            onActivate={() => {
              activateVersion(v.id);
              toast.success(`${v.label} is now active on ${network}.`);
            }}
            onEdit={() => setEditingId(editingId === v.id ? null : v.id)}
            onDelete={() => setConfirmDeleteId(v.id)}
            onSavedEdit={() => setEditingId(null)}
          />
        ))}
      </div>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the saved IDL and program ID from your browser. If it's the active
              version, the network will fall back to simulation mode.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId) {
                  deleteVersion(confirmDeleteId);
                  toast.success("Version deleted.");
                  setConfirmDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface VersionRowProps {
  version: IdlVersion;
  isActive: boolean;
  isEditing: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSavedEdit: () => void;
}

const VersionRow = ({
  version,
  isActive,
  isEditing,
  onActivate,
  onEdit,
  onDelete,
  onSavedEdit,
}: VersionRowProps) => {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2 transition",
        isActive ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card/40",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={onActivate}
          className="mt-0.5 shrink-0"
          title={isActive ? "Active" : "Set active"}
        >
          {isActive ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{version.label}</span>
            {isActive && (
              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px] gap-1">
                <Radio className="h-2.5 w-2.5" /> Active
              </Badge>
            )}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground truncate">
            {version.programId}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Saved {new Date(version.createdAt).toLocaleString()}
            {version.notes && <> · {version.notes}</>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {!isActive && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={onActivate}>
              <Power className="h-3 w-3" /> Use
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Edit">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {isEditing && (
        <VersionForm
          network={version.network}
          editing={version}
          onCancel={onSavedEdit}
          onSaved={onSavedEdit}
        />
      )}
    </div>
  );
};

interface VersionFormProps {
  network: LaunchpadNetwork;
  editing?: IdlVersion;
  onCancel: () => void;
  onSaved: () => void;
}

const VersionForm = ({ network, editing, onCancel, onSaved }: VersionFormProps) => {
  const [label, setLabel] = useState(editing?.label ?? "");
  const [programId, setProgramId] = useState(editing?.programId ?? "");
  const [idlJson, setIdlJson] = useState(editing?.idlJson ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const validation = useMemo(() => (idlJson.trim() ? validateIdl(idlJson) : null), [idlJson]);
  const blockers = validation?.issues.filter((i) => i.severity === "error") ?? [];
  const canSave = label.trim() && programId.trim() && validation?.ok;

  const handleSubmit = () => {
    try {
      if (editing) {
        updateVersion(editing.id, { label, programId, idlJson, notes });
        toast.success("Version updated.");
      } else {
        saveVersion({ network, label, programId, idlJson, notes, activate: true });
        toast.success(`Saved & activated on ${network}.`);
      }
      onSaved();
    } catch (e) {
      toast.error("Could not save version", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <div className="rounded-md border border-border bg-background/60 p-3 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Label</label>
          <Input
            placeholder="v0.3 graduation fix"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Program ID</label>
          <Input
            placeholder="RhozLp1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="h-8 text-xs font-mono"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">IDL JSON</label>
        <Textarea
          placeholder='{ "address": "...", "instructions": [...], "accounts": [...] }'
          value={idlJson}
          onChange={(e) => setIdlJson(e.target.value)}
          className={cn(
            "font-mono text-[11px] min-h-[120px]",
            validation && !validation.ok && "border-destructive/60",
            validation?.ok && "border-emerald-500/50",
          )}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes (optional)</label>
        <Input
          placeholder="Deployed from main, includes graduation hotfix"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {validation && !validation.ok && (
        <Alert variant="destructive" className="bg-destructive/5 py-2">
          <XCircle className="h-3.5 w-3.5" />
          <AlertTitle className="text-xs">{blockers.length} issue{blockers.length === 1 ? "" : "s"}</AlertTitle>
          <AlertDescription>
            <ul className="text-[11px] mt-1 space-y-0.5">
              {blockers.slice(0, 4).map((i, idx) => (
                <li key={idx}>
                  <code className="font-mono text-[10px]">{i.field}</code> — {i.message}
                </li>
              ))}
              {blockers.length > 4 && <li>+{blockers.length - 4} more</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {validation?.ok && (
        <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
          <Badge variant="secondary" className="text-[10px]">
            {validation.summary.instructionCount} ix
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {validation.summary.accountCount} accounts
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {validation.summary.eventCount} events
          </Badge>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel} className="h-7 text-xs">
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!canSave} className="h-7 text-xs">
          {editing ? "Save changes" : "Save & activate"}
        </Button>
      </div>
    </div>
  );
};

export default LaunchpadIdlVersions;

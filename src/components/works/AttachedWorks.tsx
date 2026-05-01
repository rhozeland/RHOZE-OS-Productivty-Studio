/**
 * AttachedWorks — universal attach/detach panel for binding registered
 * Works to any host entity (listing, project, contract).
 *
 * Behavior:
 *  • Owner of the host (passed in via `canManage`) sees an "Attach work"
 *    picker that lists their own works and inserts a `work_attachments`
 *    row scoped to (target_type, target_id).
 *  • Everyone who can see this surface sees the list of attached works
 *    with their content-hash fingerprint and Solscan anchor link.
 *  • RLS does the heavy lifting — we only ever query attachments by
 *    target, never bypass it.
 *
 * This is the bridge that lets a content-hashed IP asset (Phase 2)
 * actually flow into a listing or project (Phase 3).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Fingerprint,
  Plus,
  ShieldCheck,
  ExternalLink,
  Loader2,
  X,
  Music,
  Image as ImageIcon,
  Video,
  FileText,
  File as FileIcon,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { computeContentHash, inferWorkKind, formatFileSize, shortHash } from "@/lib/content-hash";

export type AttachTargetType = "listing" | "project" | "contract";

interface AttachedWorksProps {
  targetType: AttachTargetType;
  targetId: string;
  /** True when the current viewer owns the host entity. */
  canManage: boolean;
  /** Optional title override. */
  title?: string;
}

interface AttachedRow {
  id: string;
  work_id: string;
  role: string;
  works: {
    id: string;
    title: string;
    kind: string;
    content_hash: string;
    solana_signature: string | null;
    user_id: string;
  } | null;
}

const KIND_ICON: Record<string, typeof Music> = {
  audio: Music,
  image: ImageIcon,
  video: Video,
  text: FileText,
  other: FileIcon,
};

const ROLES: { value: string; label: string }[] = [
  { value: "master", label: "Master file" },
  { value: "reference", label: "Reference" },
  { value: "cover", label: "Cover" },
  { value: "deliverable", label: "Deliverable" },
];

const AttachedWorks = ({
  targetType,
  targetId,
  canManage,
  title = "Linked works",
}: AttachedWorksProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pickedWorkId, setPickedWorkId] = useState<string>("");
  const [pickedRole, setPickedRole] = useState<string>("reference");

  // Upload-and-fingerprint flow (creates a new Work + auto-attaches it).
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadRole, setUploadRole] = useState<string>("deliverable");
  const [uploadVisibility, setUploadVisibility] = useState<"public" | "private">("private");
  const [hashing, setHashing] = useState(false);
  const [contentHash, setContentHash] = useState<string | null>(null);

  const { data: attached = [], isLoading } = useQuery({
    queryKey: ["work-attachments", targetType, targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_attachments")
        .select(
          "id, work_id, role, works:works(id, title, kind, content_hash, solana_signature, user_id)",
        )
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AttachedRow[];
    },
  });

  // Owner-only: pull the user's own works to populate the picker.
  const { data: myWorks = [] } = useQuery({
    queryKey: ["works-for-attach", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("works")
        .select("id, title, kind, content_hash, solana_signature")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && canManage,
  });

  const attachedIds = useMemo(
    () => new Set(attached.map((a) => a.work_id)),
    [attached],
  );
  const pickable = useMemo(
    () => myWorks.filter((w) => !attachedIds.has(w.id)),
    [myWorks, attachedIds],
  );

  const attachMutation = useMutation({
    mutationFn: async () => {
      if (!user || !pickedWorkId) return;
      const { error } = await supabase.from("work_attachments").insert({
        work_id: pickedWorkId,
        target_type: targetType,
        target_id: targetId,
        attached_by: user.id,
        role: pickedRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work linked");
      setOpen(false);
      setPickedWorkId("");
      setPickedRole("reference");
      queryClient.invalidateQueries({
        queryKey: ["work-attachments", targetType, targetId],
      });
    },
    onError: (e: unknown) =>
      toast.error("Could not link work", {
        description: e instanceof Error ? e.message : "Unknown error",
      }),
  });

  const detachMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase
        .from("work_attachments")
        .delete()
        .eq("id", attachmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work unlinked");
      queryClient.invalidateQueries({
        queryKey: ["work-attachments", targetType, targetId],
      });
    },
    onError: (e: unknown) =>
      toast.error("Could not unlink work", {
        description: e instanceof Error ? e.message : "Unknown error",
      }),
  });

  return (
    <section className="surface-card p-4 sm:p-5 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-accent" />
          <h3 className="font-display text-base font-semibold text-foreground">
            {title}
          </h3>
          {attached.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({attached.length})
            </span>
          )}
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-8">
                <Plus className="h-3.5 w-3.5" /> Link work
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Link a work</DialogTitle>
                <DialogDescription>
                  Bind a registered, content-hashed work to this{" "}
                  {targetType}. Anchored works carry their Solana proof
                  forward.
                </DialogDescription>
              </DialogHeader>

              {pickable.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center space-y-3">
                  <p>You don't have any unlinked works yet.</p>
                  <Link to="/works">
                    <Button size="sm" variant="outline">
                      Register a work →
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      Work
                    </label>
                    <Select
                      value={pickedWorkId}
                      onValueChange={setPickedWorkId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a work…" />
                      </SelectTrigger>
                      <SelectContent>
                        {pickable.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            <span className="flex items-center gap-2">
                              {w.title}
                              {w.solana_signature && (
                                <ShieldCheck className="h-3 w-3 text-primary" />
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      Role
                    </label>
                    <Select value={pickedRole} onValueChange={setPickedRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => attachMutation.mutate()}
                  disabled={!pickedWorkId || attachMutation.isPending}
                >
                  {attachMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Link
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : attached.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {canManage
            ? "Link a registered work to carry its content hash and Solana proof into this surface."
            : "No works linked yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {attached.map((a) => {
            if (!a.works) return null;
            const Icon = KIND_ICON[a.works.kind] ?? FileIcon;
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/30 px-3 py-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to="/works"
                      className="text-sm font-medium text-foreground hover:underline truncate"
                    >
                      {a.works.title}
                    </Link>
                    <Badge variant="outline" className="text-[10px] py-0 h-4">
                      {a.role}
                    </Badge>
                    {a.works.solana_signature && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] py-0 h-4"
                      >
                        <ShieldCheck className="h-2.5 w-2.5" /> Anchored
                      </Badge>
                    )}
                  </div>
                  <div
                    className="text-[10px] font-mono text-muted-foreground truncate"
                    title={a.works.content_hash}
                  >
                    sha256:{shortHash(a.works.content_hash)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {a.works.solana_signature && (
                    <a
                      href={`https://solscan.io/tx/${a.works.solana_signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="View on Solscan"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {canManage && a.works.user_id === user?.id && (
                    <button
                      onClick={() => detachMutation.mutate(a.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Unlink"
                      disabled={detachMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default AttachedWorks;

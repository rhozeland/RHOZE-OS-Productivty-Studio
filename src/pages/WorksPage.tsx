/**
 * WorksPage — `/works`
 * ─────────────────────────────────────────────────────────────────────────
 * Phase 2 of Rhozeland's infrastructure stack: **Works as the IP-asset
 * primitive**. A "work" is any uploaded creative asset (audio, image,
 * video, text, other) fingerprinted with a SHA-256 content hash and —
 * once anchored — backed by a public Solana memo transaction.
 *
 * What this page does:
 *  1. Lets a signed-in user upload a file and register it as a Work.
 *     The hash is computed in the browser; the file is stored in the
 *     existing `flow-uploads` bucket under `<uid>/works/...`.
 *  2. Lists all of the current user's works and the public registry.
 *  3. Provides an "Anchor on Solana" action per work that reuses the
 *     existing `anchor-contribution` edge function — no backend changes
 *     required. The function reads `contribution_proofs` and writes the
 *     resulting signature back to that row; we mirror it onto the work.
 *
 * Guests see the public registry only and a sign-in CTA on the upload
 * action, matching the platform-wide guest-mode pattern.
 */
import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Fingerprint,
  Upload,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Music,
  Image as ImageIcon,
  Video,
  FileText,
  File as FileIcon,
  Plus,
  Lock,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  computeContentHash,
  inferWorkKind,
  formatFileSize,
  shortHash,
} from "@/lib/content-hash";

type WorkKind = "audio" | "image" | "video" | "text" | "other";

interface Work {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  kind: WorkKind;
  content_hash: string;
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  visibility: "public" | "private";
  solana_signature: string | null;
  anchored_at: string | null;
  created_at: string;
}

const KIND_ICON: Record<WorkKind, typeof Music> = {
  audio: Music,
  image: ImageIcon,
  video: Video,
  text: FileText,
  other: FileIcon,
};

const KIND_LABEL: Record<WorkKind, string> = {
  audio: "Audio",
  image: "Image",
  video: "Video",
  text: "Text",
  other: "Other",
};

const WorksPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "registry" ? "registry" : "mine";
  const [tab, setTab] = useState<"mine" | "registry">(initialTab as any);

  const handleTabChange = (v: string) => {
    setTab(v as "mine" | "registry");
    const next = new URLSearchParams(searchParams);
    if (v === "registry") next.set("tab", "registry");
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  // My works
  const { data: myWorks = [], isLoading: loadingMine } = useQuery({
    queryKey: ["works-mine", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("works")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Work[];
    },
    enabled: !!user,
  });

  // Public registry
  const { data: registry = [], isLoading: loadingRegistry } = useQuery({
    queryKey: ["works-registry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works")
        .select("*")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as Work[];
    },
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-10 space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <Fingerprint className="h-3.5 w-3.5" /> Layer I · Provenance
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-tight">
          Works
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
          Register any file — audio, image, video, text — as a verifiable
          IP asset. Each work gets a SHA-256 content fingerprint and can
          be anchored on Solana for a public, timestamped proof of
          authorship.{" "}
          <Link
            to="/infrastructure"
            className="underline-offset-4 hover:underline text-foreground"
          >
            Read the thesis →
          </Link>
        </p>

        {user && (
          <div className="pt-2">
            <UploadDialog
              onCreated={() => {
                queryClient.invalidateQueries({ queryKey: ["works-mine"] });
                queryClient.invalidateQueries({ queryKey: ["works-registry"] });
              }}
            />
          </div>
        )}
      </header>

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="mine" disabled={!user}>
            My works {user && myWorks.length > 0 && (
              <span className="ml-1.5 text-muted-foreground">({myWorks.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="registry">
            Public registry{" "}
            <span className="ml-1.5 text-muted-foreground">({registry.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-6">
          {!user ? (
            <EmptyState
              icon={Lock}
              title="Sign in to register a work"
              body="Once signed in, drop in a file and we'll fingerprint it instantly."
              cta={
                <Link to="/auth">
                  <Button>Sign in</Button>
                </Link>
              }
            />
          ) : loadingMine ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : myWorks.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="No works yet"
              body="Upload your first piece to mint a content-hash fingerprint."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {myWorks.map((w) => (
                <WorkCard key={w.id} work={w} isOwner />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="registry" className="mt-6">
          {loadingRegistry ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : registry.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="The registry is empty"
              body="Be the first to anchor a work on-chain."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {registry.map((w) => (
                <WorkCard key={w.id} work={w} isOwner={w.user_id === user?.id} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────── */

function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: typeof Upload;
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="surface-card p-10 text-center space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{body}</p>
      {cta && <div className="pt-2">{cta}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function WorkCard({ work, isOwner }: { work: Work; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const Icon = KIND_ICON[work.kind] ?? FileIcon;
  const [anchoring, setAnchoring] = useState(false);

  const anchorMutation = useMutation({
    mutationFn: async () => {
      // 1) Create a contribution_proof row pointing at this work.
      //    Re-uses the existing anchor-contribution edge function with no
      //    backend changes — `action_type` is a free-form text field.
      const { data: proof, error: proofErr } = await supabase
        .from("contribution_proofs")
        .insert({
          user_id: work.user_id,
          action_type: "work_register",
          reference_id: work.id,
          metadata: {
            content_hash: work.content_hash,
            title: work.title,
            kind: work.kind,
            mime_type: work.mime_type,
            file_size: work.file_size,
          },
        })
        .select()
        .single();
      if (proofErr) throw proofErr;

      // 2) Call the existing edge function which signs a Solana memo.
      const { data, error } = await supabase.functions.invoke(
        "anchor-contribution",
        { body: { proof_id: proof.id } },
      );
      if (error) throw error;

      // 3) Mirror signature onto the work for easy display.
      const signature = (data as { signature?: string })?.signature;
      if (signature) {
        await supabase
          .from("works")
          .update({
            solana_signature: signature,
            anchored_at: new Date().toISOString(),
          })
          .eq("id", work.id);
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Anchored on Solana", {
        description: "Your work now has a public, timestamped proof.",
      });
      queryClient.invalidateQueries({ queryKey: ["works-mine"] });
      queryClient.invalidateQueries({ queryKey: ["works-registry"] });
    },
    onError: (err: unknown) => {
      toast.error("Could not anchor work", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
    onSettled: () => setAnchoring(false),
  });

  return (
    <article className="surface-card p-4 sm:p-5 space-y-3 group">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-base font-semibold text-foreground truncate">
              {work.title}
            </h3>
            {work.solana_signature && (
              <Badge variant="outline" className="gap-1 text-[10px] py-0 h-5">
                <ShieldCheck className="h-3 w-3" /> Anchored
              </Badge>
            )}
            {work.visibility === "private" && (
              <Badge variant="outline" className="gap-1 text-[10px] py-0 h-5">
                <Lock className="h-3 w-3" /> Private
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{KIND_LABEL[work.kind]}</span>
            {work.file_size && <span>· {formatFileSize(work.file_size)}</span>}
          </div>
        </div>
      </div>

      {work.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {work.description}
        </p>
      )}

      <div
        className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground bg-muted/40 rounded-md px-2 py-1.5 select-all"
        title={work.content_hash}
      >
        <Fingerprint className="h-3 w-3 shrink-0" />
        <span className="truncate">sha256:{shortHash(work.content_hash)}</span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        {work.solana_signature ? (
          <a
            href={`https://solscan.io/tx/${work.solana_signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            View on Solscan <ExternalLink className="h-3 w-3" />
          </a>
        ) : isOwner ? (
          <Button
            size="sm"
            variant="outline"
            disabled={anchoring || anchorMutation.isPending}
            onClick={() => {
              setAnchoring(true);
              anchorMutation.mutate();
            }}
            className="gap-1.5"
          >
            {anchorMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            Anchor on Solana
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Not yet anchored</span>
        )}

        {work.file_url && (
          <a
            href={work.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            File <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </article>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function UploadDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [hashing, setHashing] = useState(false);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setContentHash(null);
    setVisibility("public");
  };

  const inferredKind = useMemo(
    () => inferWorkKind(file?.type ?? null),
    [file],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setContentHash(null);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    setHashing(true);
    try {
      const hash = await computeContentHash(f);
      setContentHash(hash);
    } catch (err) {
      toast.error("Could not hash file", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setHashing(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !file || !contentHash || !title.trim()) return;
    setSubmitting(true);
    try {
      // Upload to existing public flow-uploads bucket under the user's folder
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/works/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from("flow-uploads")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });
      if (uploadErr) throw uploadErr;
      const { data: pub } = supabase.storage
        .from("flow-uploads")
        .getPublicUrl(path);

      const { error: insertErr } = await supabase.from("works").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        kind: inferredKind,
        content_hash: contentHash,
        file_url: pub.publicUrl,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        visibility,
      });
      if (insertErr) throw insertErr;

      toast.success("Work registered", {
        description: "Fingerprint stored. Anchor it on-chain when you're ready.",
      });
      setOpen(false);
      setFile(null);
      setTitle("");
      setDescription("");
      setContentHash(null);
      setVisibility("public");
      onCreated();
    } catch (err) {
      toast.error("Could not register work", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !!file && !!contentHash && !!title.trim() && !hashing && !submitting;

  return (
    <section className="surface-card p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Register a work
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            We hash the file in your browser — the bytes never leave your
            device until you confirm.
          </p>
        </div>
        {open && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Hide
          </Button>
        )}
      </div>

      {!open ? (
        <Button onClick={() => setOpen(true)} className="gap-1.5 rounded-full">
          <Plus className="h-4 w-4" /> New work
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="work-file">File</Label>
              <Input id="work-file" type="file" onChange={handleFileChange} />
              {file && (
                <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
                  <span>{KIND_LABEL[inferredKind]}</span>
                  <span>· {formatFileSize(file.size)}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="work-title">Title</Label>
              <Input
                id="work-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled"
                maxLength={140}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="work-desc">Description (optional)</Label>
            <Textarea
              id="work-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Notes, credits, context…"
            />
          </div>

          <div className="space-y-1.5 max-w-xs">
            <Label>Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(v) => setVisibility(v as "public" | "private")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public — listed in registry</SelectItem>
                <SelectItem value="private">Private — only visible to you</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(hashing || contentHash) && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-[11px] font-mono text-muted-foreground flex items-center gap-2">
              <Fingerprint className="h-3.5 w-3.5 shrink-0" />
              {hashing ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Computing
                  SHA-256…
                </span>
              ) : (
                <span className="truncate">
                  sha256:{contentHash && shortHash(contentHash, 10, 10)}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setFile(null);
                setTitle("");
                setDescription("");
                setContentHash(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading…
                </>
              ) : (
                "Register"
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export default WorksPage;

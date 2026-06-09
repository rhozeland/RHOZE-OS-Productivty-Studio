/**
 * LaunchCoinFlowModal — guided "Launch a Coin" experience.
 *
 * Screen 0: Pick a release — only shown when no project is preselected.
 * Screen 1: Combined coin preview + auto-filled proposal form.
 * Screen 2: Confirmation.
 *
 * Auto-fill rules (only when opened from an existing project):
 *  - release type ← keyword detected from project title + description
 *  - title ← project title
 *  - share tags ← pre-populated from moodboard_items (files + links)
 *  - timeline ← derived from project_goals completion %
 *
 * All auto-filled fields are visually marked with a Sparkles icon and
 * remain fully editable.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Rocket,
  Sparkles,
  X,
  Lightbulb,
  FolderOpen,
  Upload,
  Link2,
  FileAudio,
  Image as ImageIcon,
  Video,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { deriveTicker } from "@/lib/pump-fun";
import { toast } from "sonner";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import PitchNewIdeaDialog from "./PitchNewIdeaDialog";
import { cn } from "@/lib/utils";

type PickerProject = { id: string; title: string; description?: string | null };

interface LaunchCoinFlowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: PickerProject | null;
  backHref?: string;
}

const GRADIENT =
  "linear-gradient(120deg, hsl(330 85% 60%) 0%, hsl(292 84% 61%) 25%, hsl(38 92% 55%) 50%, hsl(292 84% 61%) 75%, hsl(330 85% 60%) 100%)";

type ReleaseType = "single" | "ep" | "album" | "beat-tape" | "visual" | "other";
const RELEASE_TYPES: { value: ReleaseType; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
  { value: "beat-tape", label: "Beat tape" },
  { value: "visual", label: "Visual project" },
  { value: "other", label: "Other" },
];

type Timeline = "asap" | "1m" | "3m" | "flexible";
const TIMELINES: { value: Timeline; label: string }[] = [
  { value: "asap", label: "ASAP" },
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
  { value: "flexible", label: "Flexible" },
];

const MAX_FILE_MB = 25;

type ShareTag = {
  id: string;
  kind: "file" | "link";
  label: string;
  url: string;
  mime?: string;
  fromAi?: boolean;
};

const inferReleaseType = (title: string, description: string | null | undefined): ReleaseType => {
  const blob = `${title} ${description ?? ""}`.toLowerCase();
  if (/\bbeat\s?tape|beats?\b/.test(blob)) return "beat-tape";
  if (/\balbum\b|\blp\b/.test(blob)) return "album";
  if (/\bep\b/.test(blob)) return "ep";
  if (/\bvideo|visual|film|short|mv|music\s?video\b/.test(blob)) return "visual";
  if (/\bsingle\b|\btrack\b/.test(blob)) return "single";
  return "single";
};

const timelineForPct = (pct: number): Timeline => {
  if (pct >= 51) return "asap";
  if (pct >= 26) return "1m";
  return "3m";
};

const fileIcon = (mime?: string) => {
  if (!mime) return FileText;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime.startsWith("video/")) return Video;
  if (mime.startsWith("image/")) return ImageIcon;
  return FileText;
};

const LaunchCoinFlowModal = ({
  open,
  onOpenChange,
  project,
  backHref,
}: LaunchCoinFlowModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const startStep: 0 | 1 = project ? 1 : 0;
  const [step, setStep] = useState<0 | 1 | 2>(startStep);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PickerProject | null>(project);
  const [pitchOpen, setPitchOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeProject = selectedProject ?? project;
  const hasProjectContext = !!activeProject;

  // Profile (for avatar in coin preview)
  const { data: profile } = useQuery({
    queryKey: ["launch-coin-profile", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url,display_name,username")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as any;
    },
  });

  // Project picker list
  const { data: myProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ["launch-coin-my-projects", user?.id],
    enabled: !!user && open && !project,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,description,linked_token_id,updated_at")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as Array<
        PickerProject & { linked_token_id: string | null; updated_at: string }
      >;
    },
  });

  // Project context for auto-fill (goals + moodboard)
  const { data: projectContext } = useQuery({
    queryKey: ["launch-coin-project-ctx", activeProject?.id, open, step],
    enabled: !!activeProject?.id && open && step === 1,
    // Always fetch fresh — spec: "All auto-filled content generates fresh
    // at the moment the modal opens. Never cached from previous sessions."
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const [goalsRes, moodRes] = await Promise.all([
        supabase
          .from("project_goals")
          .select("id,status")
          .eq("project_id", activeProject!.id),
        supabase
          .from("moodboard_items")
          .select("id,kind,file_url,file_name,file_type,link_url,title")
          .eq("project_id", activeProject!.id)
          .order("position", { ascending: true })
          .limit(12),
      ]);
      const goals = (goalsRes.data ?? []) as Array<{ status: string }>;
      const total = goals.length;
      const done = goals.filter((g) => g.status === "completed").length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return {
        pct,
        totalGoals: total,
        mood: (moodRes.data ?? []) as Array<any>,
      };
    },
  });

  // Form state
  const [releaseType, setReleaseType] = useState<ReleaseType>("single");
  const [releaseTypeFromAi, setReleaseTypeFromAi] = useState(false);
  const [title, setTitle] = useState("");
  const [titleFromAi, setTitleFromAi] = useState(false);
  const [coinName, setCoinName] = useState("");
  const [coinNameFromAi, setCoinNameFromAi] = useState(false);
  const [tags, setTags] = useState<ShareTag[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [timeline, setTimeline] = useState<Timeline>("3m");
  const [timelineFromAi, setTimelineFromAi] = useState(false);
  const [handleLaunch, setHandleLaunch] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Reset/sync when modal opens or project changes
  useEffect(() => {
    if (open) {
      setStep(project ? 1 : 0);
      setSelectedProject(project);
    }
  }, [open, project]);

  // Auto-fill from project context (regenerates fresh each open)
  useEffect(() => {
    if (!open || step !== 1) return;
    if (activeProject) {
      const t = activeProject.title ?? "";
      setTitle(t);
      setTitleFromAi(!!t);
      setCoinName(t);
      setCoinNameFromAi(!!t);
      const rt = inferReleaseType(t, activeProject.description);
      setReleaseType(rt);
      setReleaseTypeFromAi(true);
    } else {
      setTitle("");
      setTitleFromAi(false);
      setCoinName("");
      setCoinNameFromAi(false);
      setReleaseType("single");
      setReleaseTypeFromAi(false);
    }
    setHandleLaunch(true);
  }, [open, step, activeProject?.id]);

  // Pre-populate share tags from moodboard + derive timeline from goal pct
  useEffect(() => {
    if (!projectContext) return;
    const seeded: ShareTag[] = (projectContext.mood ?? []).flatMap((m: any) => {
      const items: ShareTag[] = [];
      if (m.file_url) {
        items.push({
          id: `mood-file-${m.id}`,
          kind: "file",
          label: m.file_name || m.title || "Attachment",
          url: m.file_url,
          mime: m.file_type ?? undefined,
          fromAi: true,
        });
      }
      if (m.link_url) {
        items.push({
          id: `mood-link-${m.id}`,
          kind: "link",
          label: m.title || m.link_url,
          url: m.link_url,
          fromAi: true,
        });
      }
      return items;
    });
    setTags(seeded);

    if (projectContext.totalGoals > 0) {
      setTimeline(timelineForPct(projectContext.pct));
      setTimelineFromAi(true);
    } else {
      setTimeline("3m");
      setTimelineFromAi(false);
    }
  }, [projectContext]);

  const ticker = useMemo(() => deriveTicker(coinName || title || "Coin"), [coinName, title]);
  const displayName = profile?.display_name || profile?.username || "Artist";
  const stagePct = projectContext?.pct ?? 0;
  const isComplete = (projectContext?.totalGoals ?? 0) > 0 && stagePct >= 100;

  const removeTag = (id: string) => setTags((prev) => prev.filter((t) => t.id !== id));

  const addLink = () => {
    const raw = linkInput.trim();
    if (!raw) return;
    const value = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    setTags((prev) => [
      ...prev,
      { id: `link-${Date.now()}`, kind: "link", label: value, url: value },
    ]);
    setLinkInput("");
    setShowLinkInput(false);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || !user) return;
    setUploading(true);
    const next: ShareTag[] = [];
    for (const f of Array.from(fileList)) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name} is over ${MAX_FILE_MB}MB.`);
        continue;
      }
      const path = `${user.id}/launch-${Date.now()}-${f.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
      const { error } = await supabase.storage
        .from("flow-uploads")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (error) {
        toast.error(`Upload failed: ${f.name}`);
        continue;
      }
      const { data: pub } = supabase.storage.from("flow-uploads").getPublicUrl(path);
      next.push({
        id: `file-${Date.now()}-${f.name}`,
        kind: "file",
        label: f.name,
        url: pub.publicUrl,
        mime: f.type,
      });
    }
    setTags((prev) => [...prev, ...next]);
    setUploading(false);
  };

  const submit = async () => {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }
    if (!coinName.trim() || !title.trim()) {
      toast.error("Coin name and release title are required.");
      return;
    }
    setSubmitting(true);
    const releaseLabel = RELEASE_TYPES.find((r) => r.value === releaseType)?.label ?? "Other";
    const timelineLabel = TIMELINES.find((t) => t.value === timeline)?.label ?? "Flexible";

    const summary = [
      `Coin: ${coinName.trim()} ($${ticker})`,
      `Release type: ${releaseLabel}`,
      `Title: ${title.trim()}`,
      `Timeline: ${timelineLabel}`,
      `Rhozeland handles full launch: ${handleLaunch ? "Yes" : "No (advisory only)"}`,
      tags.length
        ? `Attachments / links:\n${tags.map((t) => `- [${t.kind}] ${t.label} — ${t.url}`).join("\n")}`
        : null,
      activeProject ? `Project: ${activeProject.title} (${activeProject.id})` : null,
      activeProject && (projectContext?.totalGoals ?? 0) > 0
        ? `Stage completion: ${stagePct}%`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: inserted, error } = await (supabase as any)
      .from("concierge_requests")
      .insert({
        client_id: user.id,
        summary,
        category: "coin-launch",
        outcome: `Launch $${ticker} on pump.fun with Rhozeland A&R support`,
        tier: "curated",
      })
      .select("id")
      .single();

    if (error) {
      setSubmitting(false);
      toast.error(error.message || "Could not submit. Try again.");
      return;
    }

    supabase.functions
      .invoke("send-transactional-email", {
        body: {
          templateName: "concierge-request-internal",
          recipientEmail: "collab@rhozeland.com",
          idempotencyKey: `concierge-internal-${inserted?.id ?? user.id}-${Date.now()}`,
          templateData: {
            category: "coin-launch",
            tier: "curated",
            submitterName: displayName,
            submitterEmail: user.email ?? null,
            submitterId: user.id,
            summary,
            outcome: `Launch $${ticker} on pump.fun with Rhozeland A&R support`,
            requestId: inserted?.id ?? null,
            source: "LaunchCoinFlowModal",
          },
        },
      })
      .catch((e) => console.warn("[concierge alert] email failed:", e));

    setSubmitting(false);
    setStep(2);
  };

  const close = () => onOpenChange(false);
  const confirmationHref =
    backHref ?? (activeProject ? `/projects/${activeProject.id}` : "/my-projects");

  return (
    <>
      <PitchNewIdeaDialog open={pitchOpen} onOpenChange={setPitchOpen} />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[min(95vw,42rem)] max-w-[42rem] max-h-[90vh] overflow-hidden p-0 border-border bg-background gap-0 [&>button]:hidden">
          <VisuallyHidden>
            <DialogTitle>Launch a Coin</DialogTitle>
            <DialogDescription>
              Pick a release and submit it to Rhozeland's A&R team to coin it on pump.fun.
            </DialogDescription>
          </VisuallyHidden>

          {/* Close */}
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-20 h-8 w-8 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Back */}
          {step === 1 && !project && (
            <button
              type="button"
              onClick={() => setStep(0)}
              className="absolute left-3 top-3 z-20 h-8 w-8 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          {/* ── Step 0 — picker (unchanged) ── */}
          {step === 0 && (
            <div className="relative max-h-[90vh] overflow-y-auto overflow-x-hidden px-4 pt-12 pb-5 sm:px-8 sm:pt-14 sm:pb-8">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                  background:
                    "radial-gradient(circle at 50% 30%, hsl(330 85% 60% / 0.15), transparent 55%), radial-gradient(circle at 50% 80%, hsl(38 92% 55% / 0.12), transparent 60%)",
                }}
              />
              <div className="relative">
                <div className="mx-auto mb-6 max-w-[32rem] text-center space-y-1.5">
                  <h2
                    className="mx-auto max-w-[14ch] font-display text-xl font-bold leading-[0.96] tracking-tight sm:text-2xl md:text-3xl"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    Which release are you coining?
                  </h2>
                  <p className="mx-auto max-w-md text-sm text-muted-foreground">
                    Pick one of your existing releases — or pitch us a new idea and we'll build it with you.
                  </p>
                </div>

                <div className="-mx-1 max-h-[min(44vh,24rem)] space-y-2 overflow-y-auto overflow-x-hidden px-1">
                  {projectsLoading && (
                    <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading your releases…
                    </div>
                  )}
                  {!projectsLoading && (myProjects ?? []).length === 0 && (
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                      You haven't started a release yet.
                    </div>
                  )}
                  {!projectsLoading &&
                    (myProjects ?? []).map((p) => {
                      const alreadyCoined = !!p.linked_token_id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={alreadyCoined}
                          onClick={() => {
                            setSelectedProject({
                              id: p.id,
                              title: p.title,
                              description: p.description ?? null,
                            });
                            setStep(1);
                          }}
                          className="group flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-border bg-card/60 px-3 py-3 text-left transition hover:border-fuchsia-500/40 hover:bg-card disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-card/60"
                        >
                          <div className="h-9 w-9 shrink-0 rounded-lg bg-foreground/5 flex items-center justify-center">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{p.title}</p>
                            {p.description && (
                              <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">
                                {p.description}
                              </p>
                            )}
                          </div>
                          {alreadyCoined ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                              Coined
                            </span>
                          ) : (
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition" />
                          )}
                        </button>
                      );
                    })}
                </div>

                <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <div className="flex-1 h-px bg-border" />
                  or
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    setTimeout(() => setPitchOpen(true), 150);
                  }}
                  className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-border bg-card/60 px-3 py-3 text-left transition hover:border-amber-500/40 hover:bg-card"
                >
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">Pitch us a new idea</p>
                    <p className="text-xs text-muted-foreground" style={{ overflowWrap: "anywhere" }}>
                      Send our A&R team a proposal — we'll plan the release and the coin together.
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 1 — Combined preview + form ── */}
          {step === 1 && (
            <div className="relative px-6 pt-12 pb-6 sm:px-8 sm:pt-14 sm:pb-8 space-y-6">
              {/* Coin preview card */}
              <div className="relative mx-auto max-w-xs">
                <div
                  aria-hidden
                  className="absolute -inset-6 rounded-full blur-3xl opacity-60"
                  style={{
                    background:
                      "radial-gradient(circle, hsl(330 85% 60% / 0.45) 0%, hsl(38 92% 55% / 0.3) 45%, transparent 75%)",
                  }}
                />
                <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur px-6 py-6 text-center">
                  <Avatar className="h-20 w-20 mx-auto ring-2 ring-border">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                    <AvatarFallback className="text-xl">
                      {displayName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    value={coinName}
                    onChange={(e) => {
                      setCoinName(e.target.value);
                      setCoinNameFromAi(false);
                    }}
                    maxLength={60}
                    placeholder="Coin name"
                    className="mt-3 w-full bg-transparent border-0 outline-none text-center font-display text-lg font-bold leading-tight focus:bg-foreground/[0.04] rounded px-2 py-1"
                  />
                  {coinNameFromAi && (
                    <Sparkles className="inline h-3 w-3 text-fuchsia-500 -mt-1" />
                  )}
                  <p
                    className="mt-1 font-display text-2xl font-extrabold tracking-tight bg-clip-text text-transparent"
                    style={{ backgroundImage: GRADIENT }}
                  >
                    ${ticker}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Launching with Rhozeland · pump.fun
                  </p>
                </div>
              </div>

              {/* AI summary line */}
              {hasProjectContext && (
                <div className="flex items-start gap-2 rounded-lg bg-foreground/[0.04] border border-border px-3 py-2.5">
                  <Sparkles className="h-3.5 w-3.5 text-fuchsia-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-snug">
                    Based on your project we've filled in what we know. Review and adjust anything before sending.
                  </p>
                </div>
              )}

              {/* Field 1 — Release type + title */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">What are you releasing?</Label>
                <div className="relative">
                  <Select
                    value={releaseType}
                    onValueChange={(v) => {
                      setReleaseType(v as ReleaseType);
                      setReleaseTypeFromAi(false);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RELEASE_TYPES.map((rt) => (
                        <SelectItem key={rt.value} value={rt.value}>
                          {rt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {releaseTypeFromAi && (
                    <Sparkles className="absolute right-9 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fuchsia-500 pointer-events-none" />
                  )}
                </div>
                <div className="relative">
                  <Input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setTitleFromAi(false);
                    }}
                    placeholder="Give it a title"
                    maxLength={120}
                    className={titleFromAi ? "pr-9" : undefined}
                  />
                  {titleFromAi && (
                    <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fuchsia-500 pointer-events-none" />
                  )}
                </div>
              </div>

              {/* Field 2 — Share */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Share something with us</Label>
                <p className="text-xs text-muted-foreground">
                  A demo, rough mix, artwork, anything that shows the vision.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-10"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload a file
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowLinkInput((v) => !v)}
                    className="h-10"
                  >
                    <Link2 className="h-4 w-4" />
                    Add a link
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="audio/*,video/*,image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
                {showLinkInput && (
                  <div className="flex gap-2">
                    <Input
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder="Paste any URL — SoundCloud, YouTube, Drive…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addLink();
                        }
                      }}
                    />
                    <Button type="button" onClick={addLink} variant="secondary">
                      Add
                    </Button>
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((t) => {
                      const Icon = t.kind === "link" ? Link2 : fileIcon(t.mime);
                      return (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1.5 max-w-[14rem] rounded-full bg-foreground/[0.06] border border-border pl-1.5 pr-1 py-1 text-xs"
                        >
                          {t.fromAi && (
                            <Sparkles className="h-3 w-3 text-fuchsia-500 shrink-0" />
                          )}
                          <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{t.label}</span>
                          <button
                            type="button"
                            onClick={() => removeTag(t.id)}
                            className="h-4 w-4 rounded-full hover:bg-foreground/10 flex items-center justify-center shrink-0"
                            aria-label="Remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Field 3 — Timeline */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">When do you want to launch?</Label>
                <div className="flex flex-wrap gap-2">
                  {TIMELINES.map((t) => {
                    const selected = timeline === t.value;
                    const showAi = timelineFromAi && selected;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          setTimeline(t.value);
                          setTimelineFromAi(false);
                        }}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium border transition",
                          selected
                            ? "border-transparent text-white shadow-sm"
                            : "border-border bg-foreground/[0.04] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07]",
                        )}
                        style={selected ? { background: GRADIENT } : undefined}
                      >
                        {showAi && <Sparkles className="h-3 w-3" />}
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {isComplete && (
                  <p
                    className="text-xs font-medium bg-clip-text text-transparent"
                    style={{ backgroundImage: GRADIENT }}
                  >
                    Your project is complete — you're ready to launch.
                  </p>
                )}
              </div>

              {/* Checkbox */}
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={handleLaunch}
                    onCheckedChange={(v) => setHandleLaunch(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-snug">
                    Let Rhozeland handle the full launch — coin setup, marketing, and rollout.
                  </span>
                </label>
                {!handleLaunch && (
                  <p className="text-xs text-muted-foreground pl-7">
                    Our team will advise but you manage the launch yourself.
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                onClick={submit}
                disabled={submitting}
                className="w-full h-12 text-base font-semibold text-white border-0 shadow-lg hover:opacity-95"
                style={{ background: GRADIENT }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    Send to Rhozeland <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="text-center space-y-1">
                <p className="text-[11px] text-muted-foreground">
                  Our A&R team reviews every submission within 24 hours and reaches out in your Inbox.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Platform fee 7–15% based on your tier. Everything else is yours.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2 — Confirmation ── */}
          {step === 2 && (
            <div className="relative px-6 pt-14 pb-8 sm:px-10 sm:pt-16 sm:pb-10 text-center overflow-hidden">
              {/* Gradient burst (2s) then settles */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 animate-in fade-in zoom-in-95 duration-500"
                style={{
                  background: GRADIENT,
                  animation: "launchBurst 2s ease-out forwards",
                }}
              />
              <style>{`
                @keyframes launchBurst {
                  0% { opacity: 0.95; transform: scale(1.05); }
                  60% { opacity: 0.55; }
                  100% { opacity: 0; transform: scale(1); }
                }
              `}</style>

              <div className="relative space-y-5">
                <div
                  className="mx-auto h-20 w-20 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-500"
                  style={{ background: GRADIENT }}
                >
                  <Rocket className="h-10 w-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-display text-3xl font-bold tracking-tight">
                    You're on the launchpad
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Our A&R team will be in touch within 24 hours. Keep building in public while you wait — every update you post strengthens your launch.
                  </p>
                </div>

                <Button
                  onClick={() => {
                    close();
                    navigate(confirmationHref);
                  }}
                  className="w-full h-12 text-base font-semibold text-white border-0 shadow-lg hover:opacity-95"
                  style={{ background: GRADIENT }}
                >
                  {activeProject ? "Back to my project" : "View my projects"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    navigate("/messages?tab=projects");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition"
                >
                  View in Inbox →
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LaunchCoinFlowModal;

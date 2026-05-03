/**
 * ProjectsInbox — v7 phase 2 inline-expanded project threads inside Inbox.
 *
 * Replaces the standalone /projects index. Acts like Inbox: list of
 * project "threads" on the left, full thread view on the right with the
 * project's chat (project_messages) up top and collapsible Roadmap /
 * Vault / Splits panels stacked below. Click "Open project →" to jump
 * to the canonical /projects/:id detail page when you need the full
 * working surface (Tools tab, etc.).
 *
 * URL contract:
 *   /messages?tab=projects             → list, no selection
 *   /messages?tab=projects&p=<id>      → list + selected project thread
 *   /messages?tab=projects&new=1       → opens create dialog
 *
 * Data sources:
 *   • projects (rows where I'm owner OR project_collaborators row exists)
 *   • project_messages — chat thread (best-effort; falls back gracefully
 *     if the table is empty or the user can't read it).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  FolderKanban,
  CheckCircle2,
  Clock,
  PauseCircle,
  Send,
  ListTree,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  cover_color: string | null;
  project_type: string | null;
  total_budget: number;
  currency: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

const STATUS_META: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  active:    { label: "In Progress", icon: Clock,         color: "bg-primary/10 text-primary" },
  completed: { label: "Completed",   icon: CheckCircle2,  color: "bg-emerald-500/10 text-emerald-600" },
  paused:    { label: "Paused",      icon: PauseCircle,   color: "bg-amber-500/10 text-amber-600" },
};


const COVER_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#0f766e",
  "#ca8a04",
  "#be123c",
  "#1f2937",
];

const ProjectsInbox = ({ userId }: { userId: string }) => {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("p");
  const showNew = params.get("new") === "1";

  // ─── Owned + collaborator-joined projects ─────────────────────────
  // Two queries (owned + collab-ids) merged client-side — Supabase
  // doesn't support OR across joins cleanly without a view.
  const { data: ownedProjects } = useQuery({
    queryKey: ["inbox-owned-projects", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const { data: collabProjectIds } = useQuery({
    queryKey: ["inbox-collab-project-ids", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("project_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.project_id);
    },
  });

  const { data: collabProjects } = useQuery({
    queryKey: ["inbox-collab-projects", collabProjectIds],
    queryFn: async () => {
      if (!collabProjectIds?.length) return [] as Project[];
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .in("id", collabProjectIds);
      if (error) throw error;
      return (data ?? []) as Project[];
    },
    enabled: !!collabProjectIds && collabProjectIds.length > 0,
  });

  const projects: Project[] = useMemo(() => {
    const map = new Map<string, Project>();
    [...(ownedProjects ?? []), ...(collabProjects ?? [])].forEach((p) =>
      map.set(p.id, p),
    );
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [ownedProjects, collabProjects]);

  // Per-project member counts (owner + collaborators) for the list indicator.
  const { data: memberCounts } = useQuery({
    queryKey: ["inbox-project-member-counts", projects.map((p) => p.id).join(",")],
    enabled: projects.length > 0,
    queryFn: async () => {
      const ids = projects.map((p) => p.id);
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("project_id")
        .in("project_id", ids);
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      for (const id of ids) counts[id] = 1; // owner counts as 1
      (data ?? []).forEach((r: any) => {
        counts[r.project_id] = (counts[r.project_id] ?? 1) + 1;
      });
      return counts;
    },
  });

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  // If the URL points at a project that isn't in our list (stale share link
  // or no access), surface a one-time toast and clean the param so the empty
  // state doesn't silently mislead the user. We wait until the project list
  // has actually loaded before deciding it's missing.
  const projectsLoaded = ownedProjects !== undefined && (collabProjectIds === undefined || collabProjectIds.length === 0 || collabProjects !== undefined);
  useEffect(() => {
    if (!selectedId || selectedProject || !projectsLoaded) return;
    toast.error("That project link isn't available to you.");
    const next = new URLSearchParams(params);
    next.delete("p");
    next.set("tab", "projects");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedProject, projectsLoaded]);

  // Update URL when selecting a project. We `push` (not `replace`) so each
  // selection is its own history entry — back button restores the previous
  // thread, and the URL is fully shareable (e.g. /messages?tab=projects&p=…).
  // Deselecting (e.g. mobile back arrow) replaces, so we don't pollute
  // history with empty-selection entries.
  const setSelected = (id: string | null) => {
    const next = new URLSearchParams(params);
    next.set("tab", "projects");
    if (id) next.set("p", id);
    else next.delete("p");
    setParams(next, { replace: !id });
  };

  return (
    <>
      <div className="surface-card flex h-[calc(100vh-22rem)] min-h-[480px] overflow-hidden">
        {/* ─── LEFT: project list ─── */}
        <div
          className={cn(
            "flex flex-col border-r border-border",
            selectedProject ? "hidden md:flex md:w-80" : "w-full md:w-80",
          )}
        >
          <div className="p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-full gap-1.5 text-xs"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("tab", "projects");
                next.set("new", "1");
                setParams(next, { replace: true });
              }}
            >
              <Plus className="h-3.5 w-3.5" /> New project
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {projects.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No projects yet</p>
                <p className="text-[11px] text-muted-foreground/70">
                  Start one to track milestones, vault, and splits in one thread.
                </p>
              </div>
            ) : (
              projects.map((p) => {
                const meta = STATUS_META[p.status] ?? STATUS_META.active;
                const Icon = meta.icon;
                const active = selectedProject?.id === p.id;
                const isOwner = p.user_id === userId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 border-l-2",
                      active
                        ? "bg-muted/70 border-l-foreground"
                        : "border-l-transparent",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.cover_color ?? "#7c3aed" }}
                      />
                      <span className="text-sm font-medium text-foreground truncate flex-1">
                        {p.title}
                      </span>
                      {!isOwner && (
                        <Badge variant="outline" className="text-[9px] py-0 h-4">
                          Collab
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                      <span>{format(new Date(p.updated_at), "MMM d")}</span>
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </div>

        {/* ─── RIGHT: thread + collapsible panels ─── */}
        <div
          className={cn(
            "flex flex-1 flex-col",
            !selectedProject ? "hidden md:flex" : "flex",
          )}
        >
          {!selectedProject ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground px-4">
              <FolderKanban className="mb-4 h-12 w-12" />
              <p className="text-lg font-medium">Pick a project</p>
              <p className="text-sm max-w-sm">
                Each project lives as a thread — chat, roadmap, vault, splits.
              </p>
            </div>
          ) : (
            <ProjectThread
              project={selectedProject}
              userId={userId}
              onBack={() => setSelected(null)}
            />
          )}
        </div>
      </div>

      <NewProjectDialog
        open={showNew}
        onOpenChange={(open) => {
          const next = new URLSearchParams(params);
          if (!open) next.delete("new");
          else next.set("new", "1");
          setParams(next, { replace: true });
        }}
        userId={userId}
        onCreated={(id) => {
          queryClient.invalidateQueries({ queryKey: ["inbox-owned-projects"] });
          setSelected(id);
          toast.success("Project created.");
        }}
      />
    </>
  );
};

/* ─── Project thread (right pane) ─── */
const ProjectThread = ({
  project,
  userId,
  onBack,
}: {
  project: Project;
  userId: string;
  onBack: () => void;
}) => {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  // Project chat — best-effort. If `project_messages` doesn't exist or
  // RLS denies it, we just show the panels.
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["project-messages", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_messages" as any)
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) {
        // Soft-fail: most likely the table doesn't exist yet — return [].
        return [] as any[];
      }
      return (data ?? []) as any[];
    },
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      const trimmed = text.trim();
      if (!trimmed) throw new Error("Type a message.");
      const { error } = await supabase
        .from("project_messages" as any)
        .insert({
          project_id: project.id,
          sender_id: userId,
          content: trimmed,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["project-messages", project.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const meta = STATUS_META[project.status] ?? STATUS_META.active;
  const StatusIcon = meta.icon;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 md:px-6 py-3.5">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: project.cover_color ?? "#7c3aed" }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-foreground truncate">
            {project.title}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <StatusIcon className="h-3 w-3" /> {meta.label}
            </span>
            {project.total_budget > 0 && (
              <>
                <span>·</span>
                <span>
                  {project.currency.toUpperCase()} {project.total_budget.toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full gap-1.5 text-xs"
          onClick={() => {
            const url = `${window.location.origin}/messages?tab=projects&p=${project.id}`;
            navigator.clipboard
              .writeText(url)
              .then(() => toast.success("Link copied"))
              .catch(() => toast.error("Couldn't copy link"));
          }}
          title="Copy a shareable link to this project thread"
        >
          <LinkIcon className="h-3 w-3" /> Copy link
        </Button>
      </div>

      {/* Pinned roadmap shortcut — sits right under the status row so the
          full project surface (roadmap, vault, splits, tools) is always one
          tap away without cluttering the thread with collapsible panels. */}
      <Link
        to={`/projects/${project.id}`}
        className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 md:px-6 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ListTree className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">
            Open project workspace — roadmap, vault, splits, tools
          </span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </Link>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-4">
          {/* ─── Messages ─── */}
          {loadingMessages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (messages?.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No messages yet. Kick off the thread below.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages!.map((m: any) => {
                const mine = m.sender_id === userId;
                return (
                  <div
                    key={m.id}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2",
                        mine
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md",
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {m.content}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          mine
                            ? "text-primary-foreground/60"
                            : "text-muted-foreground",
                        )}
                      >
                        {format(new Date(m.created_at), "MMM d · h:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </ScrollArea>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) sendMessage.mutate();
        }}
        className="flex items-end gap-2 border-t border-border px-4 md:px-6 py-3"
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the team…"
          className="flex-1 min-h-[40px] max-h-32 resize-none border-0 bg-muted/40 focus-visible:ring-1"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (text.trim()) sendMessage.mutate();
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || sendMessage.isPending}
        >
          {sendMessage.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </>
  );
};

/* ─── Lightweight create dialog (name + accent color) ─── */
const NewProjectDialog = ({
  open,
  onOpenChange,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onCreated: (id: string) => void;
}) => {
  const [title, setTitle] = useState("");
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0]);

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title required.");
      const { data, error } = await (supabase.rpc as any)("create_project_with_owner", {
        _title: title.trim(),
        _description: null,
        _vision: null,
        _scope_of_work: null,
        _project_type: "collaborative",
        _status: "active",
        _cover_color: coverColor,
      });
      if (error) throw error;
      const project = Array.isArray(data) ? data[0] : data;
      if (!project?.id) throw new Error("Project creation returned no project.");
      return project;
    },
    onSuccess: (p: any) => {
      setTitle("");
      setCoverColor(COVER_COLORS[0]);
      onOpenChange(false);
      onCreated(p.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/70">
        <DialogHeader>
          <DialogTitle className="font-display">New project</DialogTitle>
          <DialogDescription>
            Just a name and a color. Everything else lives inside the workspace.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-5 pt-2"
        >
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Project name
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name the project"
              autoFocus
              className="h-12 rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground block">
              Accent color
            </label>
            <div className="flex flex-wrap gap-2">
              {COVER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setCoverColor(color)}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition-transform",
                    coverColor === color ? "scale-110 border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Choose project color ${color}`}
                />
              ))}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full rounded-full gap-1.5"
            disabled={create.isPending || !title.trim()}
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectsInbox;

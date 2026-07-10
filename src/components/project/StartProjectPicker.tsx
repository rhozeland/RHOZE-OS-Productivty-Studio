/**
 * StartProjectPicker — one-click "Start a Project" entry.
 *
 * v12 flow: no AI vs Blank fork. Clicking Start creates a project via
 * `create_project_with_owner`, opens the collaborator-invite sheet, then
 * routes the user into the FigJam-style canvas at `/projects/:id/canvas`.
 * All roadmap/AI drafting happens inside the canvas via the AI Copilot dock.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowUp,
  ArrowLeft,
  Disc3,
  FileText,
  Film,
  Mic,
  Music4,
  Radio,
  Sparkles,
  Loader2,
  UserPlus,
  Search as SearchIcon,
  X,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthGate } from "@/components/AuthGateDialog";
import { todayGradient } from "@/lib/rhoze-gradients";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "pick" | "ai" | "invite";

type PickedUser = { user_id: string; display_name: string; username?: string | null; avatar_url?: string | null };

const SUGGESTIONS: { label: string; Icon: typeof Mic; prompt: string; tint: string }[] = [
  {
    label: "Single release",
    Icon: Music4,
    prompt: "Release my next single — recording, artwork, distribution, and a 2-week rollout plan.",
    tint: "text-rose-500",
  },
  {
    label: "EP campaign",
    Icon: Disc3,
    prompt: "Plan a 5-track EP — production schedule, cover art, lead single, and a release-week campaign.",
    tint: "text-fuchsia-500",
  },
  {
    label: "Music video",
    Icon: Film,
    prompt: "Shoot a music video for the lead single — concept, location, crew, edit, premiere.",
    tint: "text-amber-500",
  },
  {
    label: "Tour run",
    Icon: Radio,
    prompt: "Book a 6-city tour run — venues, promoters, ticketing, travel, merch table.",
    tint: "text-teal-500",
  },
  {
    label: "Studio session",
    Icon: Mic,
    prompt: "Block a studio week — engineer, sessions, vocal comps, rough mixes.",
    tint: "text-violet-500",
  },
];

const StartProjectPicker = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGate();
  const grad = todayGradient();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>("pick");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Post-create invite state
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [createdWasAi, setCreatedWasAi] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteDebounced, setInviteDebounced] = useState("");
  const [invitePicked, setInvitePicked] = useState<PickedUser[]>([]);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setInviteDebounced(inviteSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [inviteSearch]);

  const [searchResults, setSearchResults] = useState<PickedUser[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (inviteDebounced.length < 2) { setSearchResults([]); return; }
    (async () => {
      const { data, error } = await (supabase.rpc as any)("lookup_user_by_display_name", { _name: inviteDebounced });
      if (cancelled || error) return;
      const pickedIds = new Set(invitePicked.map((u) => u.user_id));
      pickedIds.add(user?.id ?? "");
      setSearchResults(((data ?? []) as PickedUser[]).filter((p) => !pickedIds.has(p.user_id)));
    })();
    return () => { cancelled = true; };
  }, [inviteDebounced, invitePicked, user?.id]);

  const reset = () => {
    setPhase("pick");
    setPrompt("");
    setSubmitting(false);
    setCreatedProjectId(null);
    setCreatedWasAi(false);
    setInviteSearch("");
    setInviteDebounced("");
    setInvitePicked([]);
    setInviting(false);
    setSearchResults([]);
  };

  const handleOpen = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };




  const createProject = async (opts: { aiPrompt?: string }) => {
    if (!user) return null;
    let title = "Untitled release";
    let description = "";
    if (opts.aiPrompt) {
      try {
        const { data: gen, error: genErr } = await supabase.functions.invoke(
          "generate-project-title",
          { body: { prompt: opts.aiPrompt } },
        );
        if (!genErr) {
          const t = ((gen as any)?.title ?? "").toString().trim();
          const d = ((gen as any)?.description ?? "").toString().trim();
          if (t) title = t;
          if (d) description = d;
        }
      } catch { /* ignore */ }
      if (title === "Untitled release") {
        const firstLine = opts.aiPrompt.split(/\n|\.|—|·/)[0].trim();
        title = firstLine.slice(0, 60) || "Untitled release";
      }
    }
    const coverColor = "#a855f7";
    const coverUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${coverColor}'/><stop offset='1' stop-color='#0a0a0a'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/></svg>`,
    )}`;
    const { data, error } = await (supabase.rpc as any)("create_project_with_owner", {
      _title: title,
      _description: description,
      _vision: description,
      _scope_of_work: null,
      _project_type: "collaborative",
      _status: "active",
      _cover_color: coverColor,
      _cover_image_url: coverUrl,
    });
    if (error) {
      toast.error(error.message ?? "Could not create project.");
      return null;
    }
    const project = Array.isArray(data) ? data[0] : data;
    return project?.id as string | undefined;
  };

  const goToBlank = async () => {
    if (!requireAuth("post")) return;
    try { sessionStorage.removeItem("startProjectMode"); } catch { /* ignore */ }
    try { sessionStorage.removeItem("startProjectAiPrompt"); } catch { /* ignore */ }
    setSubmitting(true);
    const id = await createProject({});
    setSubmitting(false);
    if (!id) return;
    setCreatedProjectId(id);
    setCreatedWasAi(false);
    setPhase("invite");
  };

  const goToAi = () => {
    if (!requireAuth("post")) return;
    setPhase("ai");
  };

  const submitAi = async () => {
    const text = prompt.trim();
    if (text.length < 6) return;
    setSubmitting(true);
    try {
      sessionStorage.setItem("startProjectMode", "ai");
      sessionStorage.setItem("startProjectAiPrompt", text);
    } catch { /* ignore */ }
    const id = await createProject({ aiPrompt: text });
    setSubmitting(false);
    if (!id) return;
    setCreatedProjectId(id);
    setCreatedWasAi(true);
    setPhase("invite");
  };

  const finishInvite = async () => {
    const projectId = createdProjectId;
    if (!projectId) return;
    if (invitePicked.length > 0) {
      setInviting(true);
      const rows = invitePicked.map((u) => ({
        project_id: projectId,
        user_id: u.user_id,
        invited_by: user!.id,
        role: "member",
        project_role: "collaborator",
      }));
      const { error } = await supabase.from("project_collaborators").insert(rows as any);
      setInviting(false);
      if (error) {
        toast.error(error.message ?? "Could not invite everyone.");
        return;
      }
      toast.success(
        invitePicked.length === 1
          ? `Invited ${invitePicked[0].display_name}.`
          : `Invited ${invitePicked.length} collaborators.`,
      );
    } else {
      toast.success(createdWasAi ? "Project created — drafting your roadmap…" : "Project created.");
    }
    handleOpen(false);
    navigate(`/projects/${projectId}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submitAi();
    }
  };


  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-xl border-border/70 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
        {phase === "pick" && (
          <div className="p-6 sm:p-8 space-y-4">
            <DialogTitle className="font-display text-2xl tracking-tight">
              Start a Project
            </DialogTitle>
            <p className="text-sm text-muted-foreground -mt-2">
              Pick how you'd like to begin. You can edit everything later.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 mt-4">
              {/* Build with AI */}
              <button
                type="button"
                onClick={goToAi}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-5 text-left transition-all hover:border-foreground/40 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div
                  className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: grad.halo }}
                />
                <div
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
                  style={{ background: grad.text }}
                >
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="relative mt-3 font-display text-base font-semibold text-foreground">
                  Build with AI
                </p>
                <p className="relative mt-1 text-xs text-muted-foreground leading-relaxed">
                  Tell Rhozeland what you're making — get a roadmap with milestones, timeline, budget.
                </p>
              </button>

              {/* Empty page */}
              <button
                type="button"
                onClick={goToBlank}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-5 text-left transition-all hover:border-foreground/40 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="relative mt-3 font-display text-base font-semibold text-foreground">
                  Empty page
                </p>
                <p className="relative mt-1 text-xs text-muted-foreground leading-relaxed">
                  Start blank. You'll fill in the brief, milestones, and team yourself.
                </p>
              </button>
            </div>
          </div>
        )}

        {phase === "ai" && (
          <div className="relative p-6 sm:p-10">
            {/* Subtle Rhozeland halo behind the prompt card */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{ background: grad.surface }}
            />

            <button
              type="button"
              onClick={() => setPhase("pick")}
              className="relative inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>

            <div className="relative flex flex-col items-center text-center mt-6 mb-6">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-white shadow-md"
                style={{ background: grad.text }}
              >
                <Sparkles className="h-5 w-5" />
              </div>
              <DialogTitle className="font-display text-2xl sm:text-3xl tracking-tight mt-4">
                What release do you want to build?
              </DialogTitle>
            </div>

            <div className="relative rounded-2xl border-2 border-foreground/20 focus-within:border-foreground/60 bg-background/80 backdrop-blur-sm transition-colors shadow-sm">
              <textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="e.g. Drop a 4-track EP in 8 weeks, shoot a video for the single, plan a release party in Lagos."
                rows={4}
                className="w-full resize-none bg-transparent px-4 pt-3 pb-12 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              />
              <button
                type="button"
                onClick={submitAi}
                disabled={prompt.trim().length < 6 || submitting}
                aria-label="Generate roadmap"
                className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform"
              >
                {submitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>

            {/* Suggestion chips */}
            <div className="relative mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map(({ label, Icon, prompt: p, tint }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setPrompt(p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background hover:border-foreground/40 transition-all"
                >
                  <Icon className={`h-3.5 w-3.5 ${tint}`} />
                  {label}
                </button>
              ))}
            </div>

            <p className="relative mt-5 text-center text-[11px] text-muted-foreground/70">
              Press ⌘+Enter to generate.
            </p>
          </div>
        )}

        {phase === "invite" && (
          <div className="relative p-6 sm:p-8 space-y-4">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{ background: grad.surface }}
            />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white shadow-sm"
                  style={{ background: grad.text }}
                >
                  <UserPlus className="h-4 w-4" />
                </div>
                <DialogTitle className="font-display text-xl tracking-tight">
                  Bring in your team
                </DialogTitle>
              </div>
              <p className="text-xs text-muted-foreground ml-10">
                Add collaborators now, or skip and invite them from the project workspace later.
              </p>
            </div>

            {/* Picked chips */}
            {invitePicked.length > 0 && (
              <div className="relative flex flex-wrap gap-1.5">
                {invitePicked.map((u) => (
                  <span
                    key={u.user_id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card pl-1.5 pr-2 py-1 text-xs"
                  >
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <span className="h-5 w-5 rounded-full bg-muted grid place-items-center text-[10px] font-semibold">
                        {(u.display_name || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="text-foreground">{u.display_name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${u.display_name}`}
                      onClick={() => setInvitePicked((p) => p.filter((x) => x.user_id !== u.user_id))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  placeholder="Search by name or username…"
                  className="w-full rounded-xl border border-border bg-background/80 pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground/40"
                />
              </div>

              {inviteDebounced.length >= 2 && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border/60">
                  {searchResults.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No matches for "{inviteDebounced}".
                    </p>
                  )}
                  {searchResults.map((r) => (
                    <button
                      key={r.user_id}
                      type="button"
                      onClick={() => {
                        setInvitePicked((p) => [...p, r]);
                        setInviteSearch("");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                    >
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="h-8 w-8 rounded-full bg-muted grid place-items-center text-xs font-semibold">
                          {(r.display_name || "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground truncate">{r.display_name}</p>
                        {r.username && (
                          <p className="text-[11px] text-muted-foreground truncate">@{r.username}</p>
                        )}
                      </div>
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={finishInvite}
                disabled={inviting}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={finishInvite}
                disabled={inviting}
                className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2 text-xs font-medium disabled:opacity-40 hover:scale-[1.02] active:scale-95 transition-transform"
              >
                {inviting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {invitePicked.length > 0
                  ? `Invite ${invitePicked.length} & open project`
                  : "Open project"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StartProjectPicker;

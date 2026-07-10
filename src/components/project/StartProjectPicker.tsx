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
  Sparkles,
  Loader2,
  UserPlus,
  Search as SearchIcon,
  X,
  Check,
  ArrowRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuthGate } from "@/components/AuthGateDialog";
import { todayGradient } from "@/lib/rhoze-gradients";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "start" | "invite";

type PickedUser = { user_id: string; display_name: string; username?: string | null; avatar_url?: string | null };

const StartProjectPicker = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGate();
  const grad = todayGradient();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>("start");
  const [submitting, setSubmitting] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteDebounced, setInviteDebounced] = useState("");
  const [invitePicked, setInvitePicked] = useState<PickedUser[]>([]);
  const [inviting, setInviting] = useState(false);
  const [searchResults, setSearchResults] = useState<PickedUser[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setInviteDebounced(inviteSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [inviteSearch]);

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
    setPhase("start");
    setSubmitting(false);
    setCreatedProjectId(null);
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

  const createProject = async () => {
    if (!user) return null;
    const coverColor = "#a855f7";
    const coverUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${coverColor}'/><stop offset='1' stop-color='#0a0a0a'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/></svg>`,
    )}`;
    const { data, error } = await (supabase.rpc as any)("create_project_with_owner", {
      _title: "Untitled release",
      _description: "",
      _vision: "",
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

  const startProject = async () => {
    if (!requireAuth("post")) return;
    setSubmitting(true);
    const id = await createProject();
    setSubmitting(false);
    if (!id) return;
    setCreatedProjectId(id);
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
    }
    handleOpen(false);
    navigate(`/projects/${projectId}/canvas`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg border-border/70 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
        {phase === "start" && (
          <div className="relative p-6 sm:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{ background: grad.surface }}
            />
            <div className="relative flex flex-col items-center text-center">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-white shadow-md"
                style={{ background: grad.text }}
              >
                <Sparkles className="h-5 w-5" />
              </div>
              <DialogTitle className="font-display text-2xl sm:text-3xl tracking-tight mt-4">
                Start a new release
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                A blank canvas opens for your release. Drop tracks, art, references, and let the AI Copilot map out the rollout with you.
              </p>
              <button
                type="button"
                onClick={startProject}
                disabled={submitting}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium disabled:opacity-40 hover:scale-[1.02] active:scale-95 transition-transform"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting ? "Creating…" : "Open the canvas"}
              </button>
              <p className="mt-4 text-[11px] text-muted-foreground/70">
                You can rename it inline once you're in.
              </p>
            </div>
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
                Add collaborators now, or skip and open the canvas.
              </p>
            </div>

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
                Skip
              </button>
              <button
                type="button"
                onClick={finishInvite}
                disabled={inviting}
                className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2 text-xs font-medium disabled:opacity-40 hover:scale-[1.02] active:scale-95 transition-transform"
              >
                {inviting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {invitePicked.length > 0
                  ? `Invite ${invitePicked.length} & open canvas`
                  : "Open canvas"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StartProjectPicker;

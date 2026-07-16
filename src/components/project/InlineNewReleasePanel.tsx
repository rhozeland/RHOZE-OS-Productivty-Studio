/**
 * InlineNewReleasePanel — replaces the pop-up chain (Pick → Create → Invite)
 * with a single inline expanding panel anchored on the Releases page.
 *
 * One panel handles: name, accent color, optional collaborator invites.
 * Clicking "Open canvas" creates the project + fires invites in one pass,
 * then routes to the release workspace with a soft cross-fade.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Loader2,
  Search as SearchIcon,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGate } from "@/components/AuthGateDialog";
import { todayGradient } from "@/lib/rhoze-gradients";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
}

type PickedUser = {
  user_id: string;
  display_name: string;
  username?: string | null;
  avatar_url?: string | null;
};

const ACCENTS = [
  { name: "Rose",    value: "#f43f5e" },
  { name: "Amber",   value: "#f59e0b" },
  { name: "Emerald", value: "#10b981" },
  { name: "Sky",     value: "#0ea5e9" },
  { name: "Violet",  value: "#a855f7" },
  { name: "Slate",   value: "#475569" },
];

const InlineNewReleasePanel = ({ onClose }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const grad = useMemo(() => todayGradient(), []);

  const [title, setTitle] = useState("");
  const [accent, setAccent] = useState(ACCENTS[4].value);
  const [submitting, setSubmitting] = useState(false);

  // invite state
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteDebounced, setInviteDebounced] = useState("");
  const [invitePicked, setInvitePicked] = useState<PickedUser[]>([]);
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

  const createAndOpen = async () => {
    if (!requireAuth("post")) return;
    if (!user) return;
    setSubmitting(true);
    const coverColor = accent;
    const coverUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${coverColor}'/><stop offset='1' stop-color='#0a0a0a'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/></svg>`,
    )}`;
    const { data, error } = await (supabase.rpc as any)("create_project_with_owner", {
      _title: title.trim() || "Untitled release",
      _description: "",
      _vision: "",
      _scope_of_work: null,
      _project_type: "collaborative",
      _status: "active",
      _cover_color: coverColor,
      _cover_image_url: coverUrl,
    });
    if (error) {
      setSubmitting(false);
      toast.error(error.message ?? "Could not create release.");
      return;
    }
    const project = Array.isArray(data) ? data[0] : data;
    const projectId = project?.id as string | undefined;
    if (!projectId) {
      setSubmitting(false);
      toast.error("Could not create release.");
      return;
    }

    if (invitePicked.length > 0) {
      const rows = invitePicked.map((u) => ({
        project_id: projectId,
        user_id: u.user_id,
        invited_by: user.id,
        role: "member",
        project_role: "collaborator",
      }));
      const { error: invErr } = await supabase.from("project_collaborators").insert(rows as any);
      if (invErr) {
        toast.error(invErr.message ?? "Could not invite everyone — you can add them from the canvas.");
      } else {
        toast.success(
          invitePicked.length === 1
            ? `Invited ${invitePicked[0].display_name}.`
            : `Invited ${invitePicked.length} collaborators.`,
        );
      }
    }

    navigate(`/projects/${projectId}/canvas`);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-sm border border-border/60 bg-card"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: grad.surface }}
      />

      <div className="relative flex items-start justify-between gap-4 border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-white shadow-sm shrink-0"
            style={{ background: grad.text }}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              New release
            </p>
            <h2 className="font-display text-xl text-foreground leading-tight">
              Set the vision, then open the canvas
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 px-6 py-5">
        {/* Left: name + accent */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Working title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled release"
              className="mt-2 w-full bg-transparent border-b border-border/60 focus:border-foreground/60 pb-2 font-display text-2xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors"
              onKeyDown={(e) => { if (e.key === "Enter") createAndOpen(); }}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground/70">
              You can rename it inline once you're in.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Accent
            </label>
            <div className="mt-2 flex items-center gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAccent(a.value)}
                  aria-label={a.name}
                  className={cn(
                    "h-6 w-6 rounded-full border transition-transform",
                    accent === a.value
                      ? "border-foreground scale-110 ring-2 ring-foreground/20"
                      : "border-border/60 hover:scale-105",
                  )}
                  style={{ background: a.value }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: invite */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Bring in your team <span className="normal-case tracking-normal text-muted-foreground/60 ml-1">(optional)</span>
            </label>
          </div>

          {invitePicked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {invitePicked.map((u) => (
                <span
                  key={u.user_id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background pl-1.5 pr-2 py-1 text-xs"
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
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={inviteSearch}
              onChange={(e) => setInviteSearch(e.target.value)}
              placeholder="Search by name or username…"
              className="w-full rounded-lg border border-border bg-background/80 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground/40"
            />
          </div>

          {inviteDebounced.length >= 2 && (
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-card divide-y divide-border/60">
              {searchResults.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No matches for "{inviteDebounced}".
                </p>
              ) : (
                searchResults.map((r) => (
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
                      <img src={r.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="h-7 w-7 rounded-full bg-muted grid place-items-center text-xs font-semibold">
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
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative flex items-center justify-between gap-3 border-t border-border/50 px-6 py-3.5">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={createAndOpen}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2 text-xs font-mono uppercase tracking-widest disabled:opacity-40 hover:scale-[1.02] active:scale-95 transition-transform"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
          {submitting
            ? "Opening…"
            : invitePicked.length > 0
              ? `Invite ${invitePicked.length} & open canvas`
              : "Open the canvas"}
        </button>
      </div>
    </motion.section>
  );
};

export default InlineNewReleasePanel;

/**
 * ProjectTools — in-context tools panel for a project.
 *
 * Order: Drop Rooms (primary collab) → Smartboards (read-only mini list,
 * full management lives in Scope) → Flow (least priority, jumps to the
 * global Flow swipe feed scoped by this project's tags).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow, isPast } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette, Flame, Radio, Plus, ExternalLink, Clock, ArrowRight, Link2, X } from "lucide-react";

const ROOM_DURATIONS = [
  { label: "1 hour", hours: 1 },
  { label: "3 hours", hours: 3 },
  { label: "6 hours", hours: 6 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
];

interface Props {
  projectId: string;
  projectTitle: string;
  smartboardDetails?: any[] | null;
  onLinkSmartboard?: () => void;
  onUnlinkSmartboard?: (id: string) => void;
}

const ProjectTools = ({ projectId, projectTitle, smartboardDetails, onLinkSmartboard, onUnlinkSmartboard }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [roomOpen, setRoomOpen] = useState(false);
  const [roomTitle, setRoomTitle] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [roomHours, setRoomHours] = useState(24);
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Project meta — used to tag the Flow jump.
  const { data: projectMeta } = useQuery({
    queryKey: ["project-tools-meta", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("categories")
        .eq("id", projectId)
        .single();
      return data;
    },
  });

  const boards = smartboardDetails ?? [];

  // ─── Drop Rooms scoped to this project ───────────────────────────────
  const { data: rooms } = useQuery({
    queryKey: ["project-drop-rooms", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("drop_rooms")
        .select("id, title, description, category, cover_color, expires_at, is_active, enable_video")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).filter((r) => !isPast(new Date(r.expires_at)));
    },
  });

  const createRoom = useMutation({
    mutationFn: async () => {
      if (!user || !roomTitle.trim()) throw new Error("Title required");
      const expiresAt = new Date(Date.now() + roomHours * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("drop_rooms")
        .insert({
          title: roomTitle.trim(),
          description: roomDescription.trim() || null,
          category: "general",
          created_by: user.id,
          expires_at: expiresAt,
          project_id: projectId,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onMutate: () => setCreatingRoom(true),
    onSettled: () => setCreatingRoom(false),
    onSuccess: (roomId) => {
      qc.invalidateQueries({ queryKey: ["project-drop-rooms", projectId] });
      setRoomOpen(false);
      setRoomTitle("");
      setRoomDescription("");
      setRoomHours(24);
      toast.success("Drop Room launched");
      navigate(`/drop-rooms/${roomId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openFlowScoped = () => {
    const tags = (projectMeta?.categories ?? []) as string[];
    const qs = tags.length ? `?tags=${encodeURIComponent(tags.join(","))}` : "";
    navigate(`/flow${qs}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
          Tools for this project
        </p>
        <h3 className="font-display text-xl font-bold text-foreground">
          Build it your way
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Spin up live rooms or pin mood boards — all scoped to <span className="text-foreground font-medium">{projectTitle}</span>.
        </p>
      </div>

      {/* ─── Drop Rooms (primary) ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <h4 className="font-display text-base font-semibold">Drop Rooms</h4>
          </div>
          <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => setRoomOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New room
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Pop-up collab spaces that auto-expire. Great for review sessions and fast feedback.
        </p>
        {rooms && rooms.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rooms.map((r: any, i: number) => (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/drop-rooms/${r.id}`)}
                className="group text-left rounded-xl border border-border overflow-hidden hover:-translate-y-0.5 transition-all"
              >
                <div className="h-1.5" style={{ background: r.cover_color || "hsl(var(--primary))" }} />
                <div className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-display font-semibold text-foreground line-clamp-1">
                      {r.title}
                    </p>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  {r.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {r.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-destructive/80 font-medium pt-0.5">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(r.expires_at), { addSuffix: false })} left
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active rooms yet. Launch one to collaborate live.
          </p>
        )}
      </section>

      {/* ─── Smartboards (full management lives here) ─────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <h4 className="font-display text-base font-semibold">Smartboards</h4>
          </div>
          {onLinkSmartboard && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full h-8 gap-1.5"
              onClick={onLinkSmartboard}
            >
              <Link2 className="h-3.5 w-3.5" /> Link smartboard
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Visual mood boards pinned to this project — drop in images, video, audio, links, or notes for the team to riff on.
        </p>
        {boards && boards.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {boards.map((b: any, i: number) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group relative"
              >
                <Link
                  to={`/smartboards/${b.id}?from=project:${projectId}`}
                  state={{ backTo: `/projects/${projectId}`, backLabel: "Back to project" }}
                  className="block rounded-xl overflow-hidden border border-border hover:-translate-y-0.5 transition-all"
                >
                  <div
                    className="aspect-[16/10]"
                    style={{ background: b.cover_color || "hsl(var(--muted))" }}
                  />
                  <div className="p-2">
                    <p className="text-xs font-display font-semibold text-foreground line-clamp-1">
                      {b.title}
                    </p>
                  </div>
                </Link>
                {onUnlinkSmartboard && (
                  <button
                    onClick={() => onUnlinkSmartboard(b.id)}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Unlink smartboard"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <button
            onClick={onLinkSmartboard}
            className="w-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-8 hover:border-primary/40 transition-colors"
          >
            <Palette className="mb-2 h-7 w-7 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No smartboards linked yet — click to link one</p>
          </button>
        )}
      </section>


      {/* ─── Create Drop Room dialog ─────────────────────────────────── */}
      <Dialog open={roomOpen} onOpenChange={setRoomOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">New Drop Room</DialogTitle>
            <DialogDescription>
              A pop-up collaboration space scoped to {projectTitle ? `"${projectTitle}"` : "this project"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Room name</Label>
              <Input
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder="Final mix review"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={roomDescription}
                onChange={(e) => setRoomDescription(e.target.value)}
                placeholder="What are we working on?"
                rows={3}
              />
            </div>
            <div>
              <Label>Duration</Label>
              <Select value={String(roomHours)} onValueChange={(v) => setRoomHours(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROOM_DURATIONS.map((d) => (
                    <SelectItem key={d.hours} value={String(d.hours)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => createRoom.mutate()}
              disabled={creatingRoom || !roomTitle.trim()}
              className="w-full"
            >
              {creatingRoom ? "Launching…" : "Launch room"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectTools;

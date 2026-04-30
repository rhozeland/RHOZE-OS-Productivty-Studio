/**
 * ProjectTools — in-context tools panel for a project.
 *
 * Surfaces Smartboards, Flow, and Drop Rooms inside Projects (which is now
 * their canonical home after the IA consolidation). Each tile launches the
 * tool deep-linked to this project where supported, or to the tool's main
 * surface otherwise. Smartboards already use `project_smartboards` to link
 * boards to a project; that list is shown directly here.
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
import { Palette, Flame, Radio, Plus, Link2, ExternalLink, Clock, Users } from "lucide-react";

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
}

const ProjectTools = ({ projectId, projectTitle }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [linkOpen, setLinkOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [roomTitle, setRoomTitle] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [roomHours, setRoomHours] = useState(24);
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Smartboards already linked to this project.
  const { data: linked } = useQuery({
    queryKey: ["project-smartboards", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_smartboards" as any)
        .select("smartboard_id")
        .eq("project_id", projectId);
      return (data ?? []).map((r: any) => r.smartboard_id);
    },
  });

  const { data: boards } = useQuery({
    queryKey: ["project-smartboard-details", linked],
    queryFn: async () => {
      if (!linked || linked.length === 0) return [];
      const { data } = await supabase
        .from("smartboards")
        .select("id, title, description, cover_color")
        .in("id", linked);
      return data ?? [];
    },
    enabled: !!linked && linked.length > 0,
  });

  const { data: mySmartboards } = useQuery({
    queryKey: ["my-smartboards-tools", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("smartboards")
        .select("id, title, description, cover_color")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user && linkOpen,
  });

  const linkSb = useMutation({
    mutationFn: async (sbId: string) => {
      const { error } = await supabase.from("project_smartboards" as any).insert({
        project_id: projectId,
        smartboard_id: sbId,
        linked_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-smartboards", projectId] });
      setLinkOpen(false);
      toast.success("Smartboard linked");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const linkedSet = new Set(linked ?? []);
  const available = (mySmartboards ?? []).filter((b: any) => !linkedSet.has(b.id));

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
          Smartboards, Flow, and Drop Rooms now live inside your projects so
          everything you make stays in scope.
        </p>
      </div>

      {/* ─── Smartboards ────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <h4 className="font-display text-base font-semibold">Smartboards</h4>
          </div>
          <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => setLinkOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Link board
          </Button>
        </div>
        {boards && boards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {boards.map((b: any, i: number) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to={`/smartboards/${b.id}`}
                  className="group block rounded-xl overflow-hidden border border-border hover:-translate-y-0.5 transition-all"
                >
                  <div
                    className="aspect-[16/9]"
                    style={{ background: b.cover_color || "hsl(var(--muted))" }}
                  />
                  <div className="p-3">
                    <p className="text-sm font-display font-semibold text-foreground line-clamp-1">
                      {b.title}
                    </p>
                    {b.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {b.description}
                      </p>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No smartboards linked yet. Link an existing board or create one.
          </p>
        )}
      </section>

      {/* ─── Flow launcher (Drop Rooms have their own section below) ─── */}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          toast.message("Flow inside Projects is coming next", {
            description: "For now, capture inspiration from the Hub feed.",
          });
        }}
        className="group block rounded-2xl border border-border bg-card p-5 hover:-translate-y-0.5 transition-all"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-primary" />
            <h4 className="font-display text-base font-semibold">Flow</h4>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="text-sm text-muted-foreground">
          Capture references, notes, and quick drops inside the project's
          scope. Coming online soon.
        </p>
      </a>

      {/* ─── Drop Rooms (project-scoped) ─────────────────────────────── */}
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
            No active rooms for {projectTitle ? `"${projectTitle}"` : "this project"} yet.
            Launch one to collaborate live.
          </p>
        )}
      </section>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Link a Smartboard</DialogTitle>
          </DialogHeader>
          {available.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {(mySmartboards ?? []).length === 0
                ? "You don't have any smartboards yet."
                : "All your smartboards are already linked."}
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {available.map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => linkSb.mutate(b.id)}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-muted/60 transition-colors"
                >
                  <div
                    className="h-10 w-10 rounded-lg shrink-0"
                    style={{ background: b.cover_color || "hsl(var(--muted))" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {b.title}
                    </p>
                    {b.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {b.description}
                      </p>
                    )}
                  </div>
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

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

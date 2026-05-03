/**
 * DropRoomLauncher — compact "Start Drop Room" button for the Progress
 * Overview header. Opens the same launch dialog ProjectTools used to host,
 * and links to any currently-active room. Keeps the surface minimal so the
 * roadmap stays focused on stages + smartboards.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isPast, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Radio, Plus, Clock } from "lucide-react";

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

const DropRoomLauncher = ({ projectId, projectTitle }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState(24);
  const [creating, setCreating] = useState(false);

  const { data: rooms } = useQuery({
    queryKey: ["project-drop-rooms", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("drop_rooms")
        .select("id, title, expires_at, is_active")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).filter((r) => !isPast(new Date(r.expires_at)));
    },
  });

  const createRoom = useMutation({
    mutationFn: async () => {
      if (!user || !title.trim()) throw new Error("Title required");
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("drop_rooms")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
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
    onMutate: () => setCreating(true),
    onSettled: () => setCreating(false),
    onSuccess: (roomId) => {
      qc.invalidateQueries({ queryKey: ["project-drop-rooms", projectId] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setHours(24);
      toast.success("Drop Room launched");
      navigate(`/drop-rooms/${roomId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeCount = rooms?.length ?? 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="rounded-full h-8 gap-1.5">
            <Radio className="h-3.5 w-3.5 text-primary" />
            Drop Room
            {activeCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                {activeCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Start a new room
          </DropdownMenuItem>
          {activeCount > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Active rooms
              </DropdownMenuLabel>
              {rooms!.map((r: any) => (
                <DropdownMenuItem
                  key={r.id}
                  onClick={() => navigate(`/drop-rooms/${r.id}`)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="text-sm font-medium truncate w-full">{r.title}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDistanceToNow(new Date(r.expires_at), { addSuffix: false })} left
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">New Drop Room</DialogTitle>
            <DialogDescription>
              A pop-up collaboration space scoped to "{projectTitle}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Room name</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Final mix review"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are we working on?"
                rows={3}
              />
            </div>
            <div>
              <Label>Duration</Label>
              <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
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
              disabled={creating || !title.trim()}
              className="w-full"
            >
              {creating ? "Launching…" : "Launch room"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DropRoomLauncher;

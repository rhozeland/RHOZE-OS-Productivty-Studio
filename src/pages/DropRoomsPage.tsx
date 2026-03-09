import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users, Clock, Flame, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, isPast } from "date-fns";

const CATEGORIES = ["general", "music", "design", "video", "writing", "code", "business"];
const DURATIONS = [
  { label: "30 minutes", hours: 0.5 },
  { label: "1 hour", hours: 1 },
  { label: "3 hours", hours: 3 },
  { label: "6 hours", hours: 6 },
  { label: "24 hours", hours: 24 },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-muted text-muted-foreground",
  music: "bg-primary/10 text-primary",
  design: "bg-accent/80 text-accent-foreground",
  video: "bg-destructive/10 text-destructive",
  writing: "bg-secondary text-secondary-foreground",
  code: "bg-muted text-foreground",
  business: "bg-primary/20 text-primary",
};

interface DropRoom {
  id: string;
  title: string;
  description: string | null;
  category: string;
  cover_color: string | null;
  created_by: string;
  expires_at: string;
  max_members: number | null;
  is_active: boolean;
  created_at: string;
}

const DropRoomsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<DropRoom[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [durationHours, setDurationHours] = useState(24);
  const [, setTick] = useState(0);

  // Countdown timer – re-render every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from("drop_rooms")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    // Filter out expired rooms client-side
    const active = (data || []).filter((r: DropRoom) => !isPast(new Date(r.expires_at)));
    setRooms(active);

    // Fetch member counts
    if (active.length > 0) {
      const ids = active.map((r: DropRoom) => r.id);
      const { data: members } = await supabase
        .from("drop_room_members")
        .select("room_id")
        .in("room_id", ids);

      const counts: Record<string, number> = {};
      (members || []).forEach((m: { room_id: string }) => {
        counts[m.room_id] = (counts[m.room_id] || 0) + 1;
      });
      setMemberCounts(counts);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("drop_rooms").insert({
      title: title.trim(),
      description: description.trim() || null,
      category,
      created_by: user.id,
      expires_at: expiresAt,
    });

    if (error) {
      toast.error("Failed to create room");
      setCreating(false);
      return;
    }

    toast.success("Room created!");
    setDialogOpen(false);
    setTitle("");
    setDescription("");
    setCategory("general");
    setDurationHours(24);
    setCreating(false);
    fetchRooms();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Drop Rooms
          </h1>
          <p className="text-muted-foreground mt-1">
            Temporary creative collaboration spaces — jump in, build ideas, drop out.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Create Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a Drop Room</DialogTitle>
              <DialogDescription>
                Launch a temporary room for live creative collaboration.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Room Name</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Music Video Brainstorm"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are we creating together?"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duration</Label>
                  <Select value={String(durationHours)} onValueChange={(v) => setDurationHours(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d.hours} value={String(d.hours)}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={creating || !title.trim()} className="w-full">
                {creating ? "Creating…" : "Launch Room"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse h-44" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Flame className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">No active rooms right now</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Be the first to create one!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const timeLeft = formatDistanceToNow(new Date(room.expires_at), { addSuffix: false });
            const count = memberCounts[room.id] || 0;
            return (
              <Card
                key={room.id}
                className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
                onClick={() => navigate(`/drop-rooms/${room.id}`)}
              >
                <div
                  className="h-2"
                  style={{ background: room.cover_color || "hsl(var(--primary))" }}
                />
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {room.title}
                    </h3>
                    <Badge variant="outline" className={`shrink-0 capitalize text-xs ${CATEGORY_COLORS[room.category] || ""}`}>
                      {room.category}
                    </Badge>
                  </div>
                  {room.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{room.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {count} inside
                    </span>
                    <span className="flex items-center gap-1 text-destructive/80 font-medium">
                      <Clock className="h-3.5 w-3.5" /> {timeLeft} left
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DropRoomsPage;

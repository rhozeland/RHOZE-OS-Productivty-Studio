/**
 * DropRoomLauncher — one-click "Start video chat" button for the Progress
 * Overview header. No setup dialog: click → spin up a room → drop you in.
 * Active rooms are accessible from the dropdown caret beside the main CTA.
 */
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isPast, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Video, ChevronDown, Clock } from "lucide-react";

interface Props {
  projectId: string;
  projectTitle: string;
}

// Default room window. Per-tier auto-extend can be wired in later; for now
// every room runs for 60 minutes and the team is notified when it ends.
const DEFAULT_ROOM_HOURS = 1;

const DropRoomLauncher = ({ projectId, projectTitle }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

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
      if (!user) throw new Error("Sign in required");
      const expiresAt = new Date(Date.now() + DEFAULT_ROOM_HOURS * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("drop_rooms")
        .insert({
          title: `${projectTitle} · Video chat`,
          description: null,
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
    onSuccess: (roomId) => {
      qc.invalidateQueries({ queryKey: ["project-drop-rooms", projectId] });
      toast.success("Video chat started — team notified");
      navigate(`/drop-rooms/${roomId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeCount = rooms?.length ?? 0;

  return (
    <div className="inline-flex items-center">
      <Button
        size="sm"
        variant="outline"
        className="rounded-full h-8 gap-1.5 rounded-r-none border-r-0 pr-2.5"
        onClick={() => createRoom.mutate()}
        disabled={createRoom.isPending}
      >
        <Video className="h-3.5 w-3.5 text-primary" />
        {createRoom.isPending ? "Starting…" : "Start video chat"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-8 px-1.5 rounded-l-none"
            aria-label="Active video chats"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            {activeCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                {activeCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {activeCount === 0 ? (
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              No active video chats. Click "Start video chat" to begin.
            </DropdownMenuLabel>
          ) : (
            <>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Active video chats
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
    </div>
  );
};

export default DropRoomLauncher;

import { useState, useCallback } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, VideoOff, Eye, Loader2, Monitor } from "lucide-react";
import { toast } from "sonner";

interface DropRoomVideoProps {
  roomId: string;
  enableVideo: boolean;
  allowSpectators: boolean;
  enableRecording: boolean;
  isMember: boolean;
}

const DropRoomVideo = ({
  roomId,
  enableVideo,
  allowSpectators,
  enableRecording,
  isMember,
}: DropRoomVideoProps) => {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [role, setRole] = useState<"participant" | "spectator">("participant");

  const joinVideo = useCallback(
    async (joinRole: "participant" | "spectator") => {
      setConnecting(true);
      setRole(joinRole);
      try {
        const { data, error } = await supabase.functions.invoke("livekit-token", {
          body: { room_id: roomId, role: joinRole },
        });

        if (error) throw new Error(error.message);
        if (data.error) throw new Error(data.error);

        setToken(data.token);
        setServerUrl(data.url);
        setJoined(true);
      } catch (err: any) {
        toast.error(err.message || "Failed to connect to video");
      } finally {
        setConnecting(false);
      }
    },
    [roomId],
  );

  const leaveVideo = useCallback(() => {
    setToken(null);
    setServerUrl(null);
    setJoined(false);
  }, []);

  if (!enableVideo) return null;

  // Not yet joined — show join buttons
  if (!joined || !token || !serverUrl) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Live Video</span>
          {enableRecording && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> Recording available
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isMember && (
            <Button
              size="sm"
              onClick={() => joinVideo("participant")}
              disabled={connecting}
              className="gap-1.5"
            >
              {connecting && role === "participant" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Monitor className="h-3.5 w-3.5" />
              )}
              Join with Camera
            </Button>
          )}
          {allowSpectators && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => joinVideo("spectator")}
              disabled={connecting}
              className="gap-1.5"
            >
              {connecting && role === "spectator" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              Watch as Spectator
            </Button>
          )}
          {!isMember && !allowSpectators && (
            <p className="text-xs text-muted-foreground">Join the room to access video</p>
          )}
        </div>
      </div>
    );
  }

  // Joined — render LiveKit room
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-black/90 relative">
      <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
        <Badge
          variant="secondary"
          className="text-[10px] capitalize"
        >
          {role === "spectator" ? "Spectating" : "Live"}
        </Badge>
        <Button
          size="sm"
          variant="destructive"
          onClick={leaveVideo}
          className="h-7 text-xs gap-1"
        >
          <VideoOff className="h-3 w-3" /> Leave
        </Button>
      </div>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        onDisconnected={leaveVideo}
        data-lk-theme="default"
        style={{ height: "400px" }}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
};

export default DropRoomVideo;

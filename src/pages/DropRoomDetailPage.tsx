import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Clock,
  Users,
  Send,
  Lightbulb,
  LogOut,
  Zap,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, isPast, format } from "date-fns";
import DropRoomVideo from "@/components/droproom/DropRoomVideo";

interface Post {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  post_type: string;
  file_url: string | null;
  upvotes: number;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

interface Member {
  id: string;
  user_id: string;
  joined_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

const DropRoomDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [sending, setSending] = useState(false);
  const [, setTick] = useState(0);
  const feedEnd = useRef<HTMLDivElement>(null);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  const fetchRoom = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("drop_rooms")
      .select("*")
      .eq("id", id)
      .single();
    setRoom(data);
    setLoading(false);
  };

  const fetchPosts = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("drop_room_posts")
      .select("*")
      .eq("room_id", id)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((p: Post) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => (profileMap[p.user_id] = p));

      setPosts(
        data.map((p: Post) => ({ ...p, profile: profileMap[p.user_id] || null }))
      );
    } else {
      setPosts([]);
    }
  };

  const fetchMembers = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("drop_room_members")
      .select("*")
      .eq("room_id", id);

    if (data && data.length > 0) {
      const userIds = data.map((m: Member) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => (profileMap[p.user_id] = p));

      const enriched = data.map((m: Member) => ({
        ...m,
        profile: profileMap[m.user_id] || null,
      }));
      setMembers(enriched);
      setIsMember(enriched.some((m: Member) => m.user_id === user?.id));
    } else {
      setMembers([]);
      setIsMember(false);
    }
  };

  useEffect(() => {
    fetchRoom();
    fetchPosts();
    fetchMembers();
  }, [id]);

  // Realtime subscriptions
  useEffect(() => {
    if (!id) return;

    const postChannel = supabase
      .channel(`room-posts-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drop_room_posts", filter: `room_id=eq.${id}` },
        () => fetchPosts()
      )
      .subscribe();

    const memberChannel = supabase
      .channel(`room-members-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drop_room_members", filter: `room_id=eq.${id}` },
        () => fetchMembers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postChannel);
      supabase.removeChannel(memberChannel);
    };
  }, [id]);

  // Auto-scroll on new posts
  useEffect(() => {
    feedEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [posts.length]);

  const handleJoin = async () => {
    if (!user || !id) return;
    const { error } = await supabase
      .from("drop_room_members")
      .insert({ room_id: id, user_id: user.id });
    if (error) {
      if (error.code === "23505") {
        toast.info("You're already in the room");
      } else {
        toast.error("Failed to join");
      }
      return;
    }
    toast.success("You're in!");
    fetchMembers();
  };

  const handleLeave = async () => {
    if (!user || !id) return;
    await supabase
      .from("drop_room_members")
      .delete()
      .eq("room_id", id)
      .eq("user_id", user.id);
    toast("Left the room");
    fetchMembers();
  };

  const handleSendPost = async () => {
    if (!user || !id || !newPost.trim()) return;
    setSending(true);
    const { error } = await supabase.from("drop_room_posts").insert({
      room_id: id,
      user_id: user.id,
      content: newPost.trim(),
      post_type: "idea",
    });
    if (error) {
      toast.error("Failed to post");
    }
    setNewPost("");
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendPost();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Room not found or has expired.</p>
        <Button variant="link" onClick={() => navigate("/drop-rooms")}>
          Back to Drop Rooms
        </Button>
      </div>
    );
  }

  const expired = isPast(new Date(room.expires_at));
  const timeLeft = expired
    ? "Expired"
    : formatDistanceToNow(new Date(room.expires_at), { addSuffix: false }) + " left";

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/drop-rooms")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary shrink-0" />
            {room.title}
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1 capitalize">
              <Badge variant="outline" className="text-[10px] py-0">{room.category}</Badge>
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {members.length}
            </span>
            <span className={`flex items-center gap-1 ${expired ? "text-destructive" : "text-amber-600"}`}>
              <Clock className="h-3 w-3" /> {timeLeft}
            </span>
          </div>
        </div>

        {!expired && (
          isMember ? (
            <Button variant="outline" size="sm" onClick={handleLeave}>
              <LogOut className="h-4 w-4 mr-1" /> Leave
            </Button>
          ) : (
            <Button size="sm" onClick={handleJoin}>
              Join Room
            </Button>
          )
        )}
      </div>

      <div className="flex flex-1 min-h-0 gap-4 pt-4">
        {/* Posts feed */}
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-2 pb-2">
              {posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/60">
                  <Lightbulb className="h-8 w-8 mb-2" />
                  <p className="text-sm">No drops yet — be the first to share an idea!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <Card key={post.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={post.profile?.avatar_url || ""} />
                          <AvatarFallback className="text-xs bg-muted">
                            {(post.profile?.display_name || "?")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-foreground">
                              {post.profile?.display_name || "Anonymous"}
                            </span>
                            <span className="text-muted-foreground">
                              {format(new Date(post.created_at), "h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                            {post.content}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              <div ref={feedEnd} />
            </div>
          </ScrollArea>

          {/* Post input */}
          {isMember && !expired ? (
            <div className="flex items-end gap-2 pt-3 border-t border-border shrink-0">
              <Textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Drop an idea…"
                rows={2}
                className="resize-none flex-1"
              />
              <Button
                size="icon"
                onClick={handleSendPost}
                disabled={sending || !newPost.trim()}
                className="shrink-0 h-10 w-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : !isMember && !expired ? (
            <div className="text-center py-3 border-t border-border text-sm text-muted-foreground">
              Join the room to drop ideas
            </div>
          ) : null}
        </div>

        {/* Members sidebar — hidden on mobile */}
        <div className="hidden md:flex flex-col w-52 shrink-0 border-l border-border pl-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Members ({members.length})
          </h3>
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={m.profile?.avatar_url || ""} />
                    <AvatarFallback className="text-[10px] bg-muted">
                      {(m.profile?.display_name || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate">
                    {m.profile?.display_name || "Anonymous"}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default DropRoomDetailPage;

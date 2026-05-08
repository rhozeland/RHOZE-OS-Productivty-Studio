/**
 * FollowingPickerDialog — quick picker listing creators the user follows,
 * so the Conversations empty state can jump straight into messaging one.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Loader2, Users } from "lucide-react";
import { Link } from "react-router-dom";

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onPick: (profile: Profile) => void;
}

const FollowingPickerDialog = ({ open, onOpenChange, userId, onPick }: Props) => {
  const { data: following, isLoading } = useQuery({
    queryKey: ["following-picker", userId],
    queryFn: async () => {
      const { data: conns } = await supabase
        .from("connections")
        .select("following_id")
        .eq("follower_id", userId)
        .eq("type", "follow")
        .eq("status", "active");
      const ids = (conns ?? []).map((c: any) => c.following_id);
      if (ids.length === 0) return [] as Profile[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids)
        .order("display_name", { ascending: true });
      return (profiles ?? []) as Profile[];
    },
    enabled: open && !!userId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            People you follow
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tap anyone to start a conversation.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !following?.length ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">
              You're not following anyone yet.
            </p>
            <Link
              to="/discover"
              onClick={() => onOpenChange(false)}
              className="text-xs underline underline-offset-2 text-foreground"
            >
              Discover creators →
            </Link>
          </div>
        ) : (
          <ScrollArea className="max-h-72">
            <div className="space-y-1">
              {following.map((profile) => (
                <button
                  key={profile.user_id}
                  onClick={() => onPick(profile)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted/60 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 overflow-hidden">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground truncate">
                    {profile.display_name || "Creator"}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FollowingPickerDialog;

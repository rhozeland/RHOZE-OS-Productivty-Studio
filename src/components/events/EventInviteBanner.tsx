/**
 * EventInviteBanner — shown on EventDetailPage when the current user has a
 * pending co-host invite for this event. Lets them accept or decline inline.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface Props {
  eventId: string;
  eventTitle: string;
}

const EventInviteBanner = ({ eventId, eventTitle }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: invite } = useQuery({
    queryKey: ["event-my-collab-invite", eventId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_collaborators")
        .select("id, role, status, invited_by")
        .eq("event_id", eventId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const respond = useMutation({
    mutationFn: async (status: "accepted" | "declined") => {
      const { error } = await supabase
        .from("event_collaborators")
        .update({ status })
        .eq("id", invite!.id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(status === "accepted" ? "You're a co-host" : "Invite declined");
      qc.invalidateQueries({ queryKey: ["event-my-collab-invite", eventId] });
      qc.invalidateQueries({ queryKey: ["event-collaborators", eventId] });
      qc.invalidateQueries({ queryKey: ["event-is-collab", eventId] });
    },
    onError: (e) =>
      toast.error("Could not respond", {
        description: e instanceof Error ? e.message : "Try again",
      }),
  });

  if (!invite || invite.status !== "pending") return null;

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Crown className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            You've been invited to co-host
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {eventTitle} · role: {invite.role === "co_host" ? "Co-host" : "Manager"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-full gap-1"
          disabled={respond.isPending}
          onClick={() => respond.mutate("declined")}
        >
          <X className="h-3.5 w-3.5" /> Decline
        </Button>
        <Button
          size="sm"
          className="rounded-full gap-1"
          disabled={respond.isPending}
          onClick={() => respond.mutate("accepted")}
        >
          {respond.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Accept
        </Button>
      </div>
    </div>
  );
};

export default EventInviteBanner;

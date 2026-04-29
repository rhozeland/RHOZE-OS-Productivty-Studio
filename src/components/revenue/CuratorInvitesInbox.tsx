/**
 * CuratorInvitesInbox — incoming curator invites for the current user.
 *
 * Renders a section above the regular inquiries list with Accept / Decline
 * buttons. Hidden when there are no pending invites.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { format } from "date-fns";

const CuratorInvitesInbox = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: invites, isLoading } = useQuery({
    queryKey: ["incoming-curator-invites", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curator_invites")
        .select(`
          *,
          revenue_split_configs ( creator_pct, curator_pct, buyback_pct )
        `)
        .eq("invitee_id", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const inviterIds = invites?.map((i: any) => i.inviter_id) ?? [];
  const { data: profiles } = useQuery({
    queryKey: ["curator-invite-profiles", inviterIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", inviterIds);
      return data ?? [];
    },
    enabled: inviterIds.length > 0,
  });

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

  const respond = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const { error } = await supabase
        .from("curator_invites")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["incoming-curator-invites"] });
      toast.success(vars.status === "accepted" ? "You're now a curator!" : "Invite declined");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !invites?.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <h2 className="font-display text-lg font-semibold">Curator Invites</h2>
        <Badge variant="outline" className="bg-accent/15 text-accent text-xs">
          {invites.length}
        </Badge>
      </div>

      {invites.map((inv: any) => {
        const inviter = profileMap.get(inv.inviter_id);
        const config = inv.revenue_split_configs;
        return (
          <div
            key={inv.id}
            className="surface-card p-4 space-y-3 border border-accent/30"
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={inviter?.avatar_url ?? undefined} />
                <AvatarFallback>
                  {(inviter?.display_name || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {inviter?.display_name || inviter?.username || "Someone"}
                </p>
                <p className="text-xs text-muted-foreground">
                  invited you to curate · {format(new Date(inv.created_at), "MMM d")}
                </p>
              </div>
              {config && (
                <Badge variant="outline" className="bg-accent/10 text-accent text-xs shrink-0">
                  {config.curator_pct}% share
                </Badge>
              )}
            </div>

            {inv.message && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{inv.message}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1.5 rounded-full"
                onClick={() => respond.mutate({ id: inv.id, status: "accepted" })}
                disabled={respond.isPending}
              >
                {respond.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 rounded-full text-muted-foreground"
                onClick={() => respond.mutate({ id: inv.id, status: "declined" })}
                disabled={respond.isPending}
              >
                <X className="h-3.5 w-3.5" />
                Decline
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CuratorInvitesInbox;

/**
 * CuratorInviteSection — invite a curator by username on a revenue split config.
 *
 * Renders three states:
 *   1. No curator yet → search-by-username + send invite
 *   2. Pending invite → show invitee name + revoke button
 *   3. Accepted curator → show curator card + remove option
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, UserPlus, X, Check, Clock, Search } from "lucide-react";

interface Props {
  splitConfigId: string;
  curatorId: string | null;
}

const CuratorInviteSection = ({ splitConfigId, curatorId }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Pending invite (if any)
  const { data: pendingInvite } = useQuery({
    queryKey: ["curator-invite", splitConfigId],
    queryFn: async () => {
      const { data } = await supabase
        .from("curator_invites")
        .select("*")
        .eq("split_config_id", splitConfigId)
        .eq("status", "pending")
        .maybeSingle();
      return data;
    },
  });

  // Curator profile (if accepted)
  const { data: curator } = useQuery({
    queryKey: ["profile", curatorId],
    queryFn: async () => {
      if (!curatorId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .eq("user_id", curatorId)
        .maybeSingle();
      return data;
    },
    enabled: !!curatorId,
  });

  // Pending invitee profile
  const { data: pendingProfile } = useQuery({
    queryKey: ["profile", pendingInvite?.invitee_id],
    queryFn: async () => {
      if (!pendingInvite) return null;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .eq("user_id", pendingInvite.invitee_id)
        .maybeSingle();
      return data;
    },
    enabled: !!pendingInvite,
  });

  // Username search
  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["curator-search", query],
    queryFn: async () => {
      if (query.trim().length < 2) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq("user_id", user!.id)
        .limit(5);
      return data ?? [];
    },
    enabled: query.trim().length >= 2 && !curatorId && !pendingInvite,
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error("Pick a user first");
      const { error } = await supabase.from("curator_invites").insert({
        split_config_id: splitConfigId,
        inviter_id: user!.id,
        invitee_id: selectedUserId,
        message: message.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curator-invite", splitConfigId] });
      toast.success("Invite sent");
      setQuery("");
      setSelectedUserId(null);
      setMessage("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeInvite = useMutation({
    mutationFn: async () => {
      if (!pendingInvite) return;
      const { error } = await supabase
        .from("curator_invites")
        .update({ status: "revoked" })
        .eq("id", pendingInvite.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curator-invite", splitConfigId] });
      toast.success("Invite revoked");
    },
  });

  const removeCurator = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("revenue_split_configs")
        .update({ curator_id: null })
        .eq("id", splitConfigId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["split-config"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Curator removed");
    },
  });

  const initials = (s?: string | null) =>
    (s || "?").slice(0, 2).toUpperCase();

  // ── Accepted curator ─────────────────────────────────────────────
  if (curatorId && curator) {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={curator.avatar_url ?? undefined} />
            <AvatarFallback>{initials(curator.display_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">
                {curator.display_name || curator.username}
              </p>
              <Badge variant="outline" className="bg-accent/15 text-accent text-xs">
                <Check className="h-3 w-3 mr-1" /> Curator
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              @{curator.username} · receives curator share on every release
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeCurator.mutate()}
            disabled={removeCurator.isPending}
          >
            Remove
          </Button>
        </div>
      </div>
    );
  }

  // ── Pending invite ───────────────────────────────────────────────
  if (pendingInvite && pendingProfile) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={pendingProfile.avatar_url ?? undefined} />
            <AvatarFallback>{initials(pendingProfile.display_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">
                {pendingProfile.display_name || pendingProfile.username}
              </p>
              <Badge variant="outline" className="bg-amber-500/15 text-amber-600 text-xs">
                <Clock className="h-3 w-3 mr-1" /> Pending
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Awaiting their response
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => revokeInvite.mutate()}
            disabled={revokeInvite.isPending}
          >
            Revoke
          </Button>
        </div>
      </div>
    );
  }

  // ── Invite a curator ─────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-accent" />
        <Label className="text-sm font-medium">Invite a curator</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Curators help you ship and get paid automatically on every release.
      </p>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by username..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedUserId(null);
          }}
          className="pl-8"
        />
      </div>

      {searching && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Searching…
        </p>
      )}

      {searchResults && searchResults.length > 0 && !selectedUserId && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {searchResults.map((p: any) => (
            <button
              key={p.user_id}
              onClick={() => {
                setSelectedUserId(p.user_id);
                setQuery(p.display_name || p.username || "");
              }}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-left transition-colors"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{initials(p.display_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {p.display_name || p.username}
                </p>
                <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedUserId && (
        <>
          <Input
            placeholder="Optional message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedUserId(null);
                setQuery("");
                setMessage("");
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => sendInvite.mutate()}
              disabled={sendInvite.isPending}
              className="flex-1"
            >
              {sendInvite.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Send invite
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default CuratorInviteSection;

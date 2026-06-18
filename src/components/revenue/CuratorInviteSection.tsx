/**
 * CuratorInviteSection — invite collaborators on a revenue split config.
 *
 * Splits v2: invites carry a `pct` field; on accept, a DB trigger moves
 * that share from the lead to the invitee in revenue_split_collaborators.
 *
 * Supports queueing multiple invitees before sending, and lists all
 * pending invites (DB allows many — unique only per invitee).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, UserPlus, X, Clock, Search, Plus } from "lucide-react";

interface Props {
  splitConfigId: string;
  /** Lead's current % — total invited share cannot exceed this. */
  leadCurrentPct: number;
}

type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type QueuedInvitee = Profile & { pct: number; message: string };

const initials = (s?: string | null) => (s || "?").slice(0, 2).toUpperCase();

const CuratorInviteSection = ({ splitConfigId, leadCurrentPct }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<QueuedInvitee[]>([]);

  const { data: pendingInvites = [] } = useQuery({
    queryKey: ["curator-invites", splitConfigId],
    queryFn: async () => {
      const { data } = await supabase
        .from("curator_invites")
        .select("*")
        .eq("split_config_id", splitConfigId)
        .eq("status", "pending");
      return data ?? [];
    },
  });

  const pendingIds = useMemo(
    () => (pendingInvites ?? []).map((i: any) => i.invitee_id),
    [pendingInvites],
  );

  const { data: pendingProfiles = [] } = useQuery({
    queryKey: ["curator-invite-profiles", pendingIds.join(",")],
    enabled: pendingIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", pendingIds);
      return (data ?? []) as Profile[];
    },
  });

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    (pendingProfiles ?? []).forEach((p) => m.set(p.user_id, p));
    return m;
  }, [pendingProfiles]);

  const pendingPctTotal = useMemo(
    () => (pendingInvites ?? []).reduce((s: number, i: any) => s + Number(i.pct || 0), 0),
    [pendingInvites],
  );
  const queuedPctTotal = useMemo(
    () => queue.reduce((s, q) => s + (Number(q.pct) || 0), 0),
    [queue],
  );
  const remainingPct = Math.max(0, leadCurrentPct - pendingPctTotal - queuedPctTotal);

  const queuedIds = new Set(queue.map((q) => q.user_id));
  const pendingSet = new Set(pendingIds);

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["collaborator-search", query],
    queryFn: async () => {
      if (query.trim().length < 2) return [] as Profile[];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq("user_id", user!.id)
        .limit(8);
      return (data ?? []) as Profile[];
    },
    enabled: query.trim().length >= 2,
  });

  const addToQueue = (p: Profile) => {
    if (queuedIds.has(p.user_id) || pendingSet.has(p.user_id)) return;
    const fallback = Math.min(10, Math.max(1, remainingPct));
    setQueue((q) => [...q, { ...p, pct: fallback, message: "" }]);
    setQuery("");
  };

  const updateQueued = (id: string, patch: Partial<QueuedInvitee>) =>
    setQueue((q) => q.map((row) => (row.user_id === id ? { ...row, ...patch } : row)));

  const removeQueued = (id: string) =>
    setQueue((q) => q.filter((row) => row.user_id !== id));

  const sendInvites = useMutation({
    mutationFn: async () => {
      if (queue.length === 0) throw new Error("Add at least one person");
      const invalid = queue.find((q) => !q.pct || q.pct < 1);
      if (invalid) throw new Error("Each share must be at least 1%");
      const total = pendingPctTotal + queuedPctTotal;
      if (total >= leadCurrentPct) {
        throw new Error(
          `Total invited share (${total}%) must stay below your ${leadCurrentPct}%`,
        );
      }
      const rows = queue.map((q) => ({
        split_config_id: splitConfigId,
        inviter_id: user!.id,
        invitee_id: q.user_id,
        message: q.message.trim() || null,
        pct: q.pct,
      }));
      const { error } = await (supabase as unknown as {
        from: (t: string) => {
          insert: (p: Record<string, unknown>[]) => Promise<{ error: unknown }>;
        };
      })
        .from("curator_invites")
        .insert(rows);
      if (error) throw error as { message: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curator-invites", splitConfigId] });
      toast.success(`Sent ${queue.length} invite${queue.length === 1 ? "" : "s"}`);
      setQueue([]);
      setQuery("");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("curator_invites")
        .update({ status: "revoked" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curator-invites", splitConfigId] });
      toast.success("Invite revoked");
    },
  });

  return (
    <div className="space-y-3">
      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          {pendingInvites.map((inv: any) => {
            const p = profileById.get(inv.invitee_id);
            return (
              <div key={inv.id} className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={p?.avatar_url ?? undefined} />
                  <AvatarFallback>{initials(p?.display_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">
                      {p?.display_name || p?.username || "Invitee"}
                    </p>
                    <Badge
                      variant="outline"
                      className="bg-amber-500/15 text-amber-600 text-xs"
                    >
                      <Clock className="h-3 w-3 mr-1" /> Pending · {inv.pct}%
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeInvite.mutate(inv.id)}
                  disabled={revokeInvite.isPending}
                >
                  Revoke
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite builder */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-accent" />
            <Label className="text-sm font-medium">Invite collaborators</Label>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {remainingPct}% of your share still available
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Search and add as many people as you want, set each share, then send all
          invites at once. Comes out of your share, not the platform fee.
        </p>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by username or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {searching && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Searching…
          </p>
        )}

        {query.trim().length >= 2 && searchResults.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {searchResults.map((p) => {
              const already = queuedIds.has(p.user_id) || pendingSet.has(p.user_id);
              return (
                <button
                  key={p.user_id}
                  onClick={() => addToQueue(p)}
                  disabled={already}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {initials(p.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {p.display_name || p.username}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{p.username}
                    </p>
                  </div>
                  {already ? (
                    <span className="text-[11px] text-muted-foreground">Added</span>
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Queued invitees */}
        {queue.length > 0 && (
          <div className="space-y-2 pt-1">
            {queue.map((row) => (
              <div
                key={row.user_id}
                className="rounded-lg border border-border/60 bg-background p-2.5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={row.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {initials(row.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {row.display_name || row.username}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={Math.max(1, leadCurrentPct - 1)}
                      value={row.pct}
                      onChange={(e) =>
                        updateQueued(row.user_id, { pct: Number(e.target.value) })
                      }
                      className="w-16 h-8 font-mono text-right text-xs"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeQueued(row.user_id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Input
                  placeholder="Optional message…"
                  value={row.message}
                  onChange={(e) =>
                    updateQueued(row.user_id, { message: e.target.value })
                  }
                  className="h-8 text-xs"
                />
              </div>
            ))}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground">
                Sending {queue.length} · {queuedPctTotal}% total
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setQueue([])}>
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={() => sendInvites.mutate()}
                  disabled={sendInvites.isPending}
                >
                  {sendInvites.isPending && (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  )}
                  Send {queue.length} invite{queue.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CuratorInviteSection;

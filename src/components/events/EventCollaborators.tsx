/**
 * EventCollaborators — host-only panel inside EventManagePage that lets the
 * host invite co-hosts / managers, see the current team, and remove people.
 *
 * Backed by the `event_collaborators` table. Collaborators inherit edit /
 * tier / attendee rights via RLS (`can_manage_event`).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, X, Loader2, Crown, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  eventId: string;
  hostId: string;
}

interface Profile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .map((c) => c[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

const EventCollaborators = ({ eventId, hostId }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");

  // Current collaborators + their profile rows
  const { data: collaborators = [] } = useQuery({
    queryKey: ["event-collaborators", eventId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("event_collaborators")
        .select("id, user_id, role, created_at")
        .eq("event_id", eventId);
      const ids = (rows ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      return (rows ?? []).map((r) => ({
        ...r,
        profile: (profMap.get(r.user_id) ?? null) as Profile | null,
      }));
    },
  });

  // Host profile (for the team header)
  const { data: hostProfile } = useQuery({
    queryKey: ["event-host-profile", hostId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .eq("user_id", hostId)
        .maybeSingle();
      return data as Profile | null;
    },
  });

  // Live profile search (>=2 chars)
  const trimmed = query.trim();
  const { data: results = [], isFetching: searching } = useQuery({
    queryKey: ["event-collab-search", trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .or(`display_name.ilike.%${trimmed}%,username.ilike.%${trimmed}%`)
        .limit(6);
      return (data ?? []) as Profile[];
    },
  });

  const existingIds = new Set([hostId, ...collaborators.map((c: any) => c.user_id)]);

  const addCollab = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "co_host" | "manager" }) => {
      if (!user) throw new Error("Sign in required");
      const { error } = await supabase.from("event_collaborators").insert({
        event_id: eventId,
        user_id: userId,
        role,
        invited_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to team");
      setQuery("");
      qc.invalidateQueries({ queryKey: ["event-collaborators", eventId] });
    },
    onError: (e: unknown) =>
      toast.error("Could not add", {
        description: e instanceof Error ? e.message : "Unknown error",
      }),
  });

  const removeCollab = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_collaborators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["event-collaborators", eventId] });
    },
    onError: (e: unknown) =>
      toast.error("Could not remove", {
        description: e instanceof Error ? e.message : "Unknown error",
      }),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: "co_host" | "manager" }) => {
      const { error } = await supabase
        .from("event_collaborators")
        .update({ role })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-collaborators", eventId] }),
  });

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold tracking-tight">Team</h2>

      <div className="space-y-2">
        {/* Host row */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9">
              <AvatarImage src={hostProfile?.avatar_url ?? undefined} />
              <AvatarFallback>{initials(hostProfile?.display_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {hostProfile?.display_name || hostProfile?.username || "Host"}
              </p>
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Crown className="h-3 w-3" /> Host · full control
              </p>
            </div>
          </div>
        </div>

        {collaborators.map((c: any) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={c.profile?.avatar_url ?? undefined} />
                <AvatarFallback>{initials(c.profile?.display_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {c.profile?.display_name || c.profile?.username || "Member"}
                </p>
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  {c.role === "co_host" ? "Co-host" : "Manager"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <select
                value={c.role}
                onChange={(e) =>
                  updateRole.mutate({ id: c.id, role: e.target.value as any })
                }
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="co_host">Co-host</option>
                <option value="manager">Manager</option>
              </select>
              <button
                type="button"
                onClick={() => removeCollab.mutate(c.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Invite */}
      <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or username…"
            className="h-9 border-0 bg-transparent focus-visible:ring-0 px-1 text-sm"
          />
          {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {trimmed.length >= 2 && (
          <div className="space-y-1.5">
            {results.length === 0 && !searching && (
              <p className="text-xs text-muted-foreground px-1">No matches.</p>
            )}
            {results
              .filter((r) => !existingIds.has(r.user_id))
              .map((r) => (
                <div
                  key={r.user_id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-muted/50 transition-colors",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={r.avatar_url ?? undefined} />
                      <AvatarFallback>{initials(r.display_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {r.display_name || r.username}
                      </p>
                      {r.username && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          @{r.username}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full gap-1"
                    disabled={addCollab.isPending}
                    onClick={() => addCollab.mutate({ userId: r.user_id, role: "co_host" })}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              ))}
          </div>
        )}
        {trimmed.length < 2 && (
          <p className="text-[11px] text-muted-foreground px-1">
            Type at least 2 characters to find people. Co-hosts can edit the event,
            tiers, and check guests in.
          </p>
        )}
      </div>
    </section>
  );
};

export default EventCollaborators;

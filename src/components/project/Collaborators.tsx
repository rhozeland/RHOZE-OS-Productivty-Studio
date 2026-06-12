import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, Plus, X, Search, Info, ChevronDown, Lock, Check } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

import { useProjectRole } from "@/hooks/useProjectRole";


const ROLE_INFO: Record<string, { label: string; description: string }> = {
  member: { label: "Member", description: "Can view the project, its goals, files, and team — but cannot edit settings, manage the team, or upload to the moodboard." },
  admin: { label: "Admin", description: "Full editing access — can update project settings, manage the team, edit goals, and upload to the moodboard. Cannot remove the owner." },
  owner: { label: "Co-owner", description: "Same powers as the original owner — can edit settings, manage the team, invite/remove collaborators, and lock revenue splits. Use for true partners on the project." },
};

interface CollaboratorsProps {
  projectId: string;
  isCollaborative?: boolean;
}

const Collaborators = ({ projectId, isCollaborative }: CollaboratorsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isOwner, isAdmin, canManage } = useProjectRole(projectId);
  // Spec: only the Lead Artist (owner) can invite, remove, or change roles.
  const canInviteOrRemove = isOwner;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ user_id: string; display_name: string } | null>(null);
  const [role, setRole] = useState<"member" | "admin" | "owner">("member");
  const [projectRole, setProjectRole] = useState("client");
  const [showResults, setShowResults] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounced search results
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: searchResults } = useQuery({
    queryKey: ["user-search", debouncedSearch],
    enabled: debouncedSearch.length >= 2 && !selectedUser,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("lookup_user_by_display_name", { _name: debouncedSearch });
      if (error) throw error;
      // Filter out current user and existing collaborators
      const existingIds = new Set(collaborators?.map((c) => c.user_id) ?? []);
      existingIds.add(user?.id ?? "");
      return (data ?? []).filter((p: any) => !existingIds.has(p.user_id));
    },
  });

  const { data: collaborators } = useQuery({
    queryKey: ["project-collaborators", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: collabProfiles } = useQuery({
    queryKey: ["collab-profiles", collaborators?.map((c) => c.user_id)],
    enabled: !!collaborators && collaborators.length > 0,
    queryFn: async () => {
      const ids = collaborators!.map((c) => c.user_id);
      const { data, error } = await supabase.rpc("get_profiles_by_ids", { _ids: ids });
      if (error) throw error;
      return data;
    },
  });

  // ---- Revenue splits ----
  const { data: project } = useQuery({
    queryKey: ["project-splits-meta", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("user_id, title, team_splits_locked_at")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const splitsLocked = !!project?.team_splits_locked_at;
  const ownerUserId: string | undefined = project?.user_id;

  const { data: splitRows } = useQuery({
    queryKey: ["project-team-splits", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_team_splits" as any)
        .select("user_id, pct")
        .eq("project_id", projectId);
      if (error) throw error;
      return ((data ?? []) as unknown) as Array<{ user_id: string; pct: number }>;
    },
  });

  // Local edit buffer keyed by user_id → pct string
  const [draftSplits, setDraftSplits] = useState<Record<string, string>>({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);

  // Seed draft when server data arrives
  useEffect(() => {
    if (!splitRows) return;
    const seed: Record<string, string> = {};
    splitRows.forEach((r) => { seed[r.user_id] = String(Number(r.pct)); });
    setDraftSplits(seed);
  }, [splitRows]);

  const serverPct = useMemo(() => {
    const m = new Map<string, number>();
    (splitRows ?? []).forEach((r) => m.set(r.user_id, Number(r.pct) || 0));
    return m;
  }, [splitRows]);

  const getDraftNum = (uid: string) => {
    const raw = draftSplits[uid];
    if (raw === undefined || raw === "") return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const allTeamUserIds: string[] = [
    ...(ownerUserId ? [ownerUserId] : []),
    ...((collaborators ?? []).map((c) => c.user_id)),
  ];
  const total = allTeamUserIds.reduce((sum, uid) => sum + getDraftNum(uid), 0);
  const totalRounded = Math.round(total * 100) / 100;

  const hasUnsavedChanges = allTeamUserIds.some(
    (uid) => getDraftNum(uid) !== (serverPct.get(uid) ?? 0)
  );

  const saveSplits = useMutation({
    mutationFn: async () => {
      const rows = allTeamUserIds.map((uid) => ({
        project_id: projectId,
        user_id: uid,
        pct: getDraftNum(uid),
      }));
      const { error } = await supabase
        .from("project_team_splits" as any)
        .upsert(rows, { onConflict: "project_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-team-splits", projectId] });
      setEditingUserId(null);
      toast.success("Splits saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const lockSplits = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("lock_project_team_splits" as any, {
        p_project_id: projectId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-team-splits", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-splits-meta", projectId] });
      setConfirmLockOpen(false);
      toast.success("Splits locked — team notified");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Inline split pill shown next to a team member. Visible to lead OR self only.
  const SplitPill = ({ userId }: { userId: string }) => {
    const canSeeRow = isOwner || userId === user?.id;
    if (!canSeeRow) return null;
    const value = draftSplits[userId] ?? "";
    const displayPct = isOwner ? (value === "" ? 0 : Number(value) || 0) : (serverPct.get(userId) ?? 0);
    const canEdit = isOwner && !splitsLocked;
    const isEditing = canEdit && editingUserId === userId;

    if (isEditing) {
      return (
        <div className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5">
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={value}
            autoFocus
            onChange={(e) =>
              setDraftSplits((p) => ({ ...p, [userId]: e.target.value }))
            }
            onBlur={() => setEditingUserId(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setEditingUserId(null);
              if (e.key === "Escape") setEditingUserId(null);
            }}
            className="h-5 w-14 text-[11px] px-1 py-0 border-0 bg-transparent focus-visible:ring-0"
          />
          <span className="text-[10px] text-muted-foreground">%</span>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={canEdit ? () => setEditingUserId(userId) : undefined}
        disabled={!canEdit}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums",
          splitsLocked
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary",
          canEdit && "hover:bg-primary/15 cursor-pointer",
        )}
        title={splitsLocked ? "Splits are locked" : canEdit ? "Click to edit" : undefined}
      >
        {splitsLocked && <Lock className="h-2.5 w-2.5" />}
        {displayPct}%
      </button>
    );
  };


  const invite = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("Please select a user from the search results.");

      const { error } = await supabase.from("project_collaborators").insert({
        project_id: projectId,
        user_id: selectedUser.user_id,
        invited_by: user!.id,
        role,
        project_role: isCollaborative ? "collaborator" : projectRole,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-collaborators", projectId] });
      setOpen(false);
      setSearch("");
      setSelectedUser(null);
      toast.success("Collaborator invited!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_collaborators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-collaborators", projectId] });
      toast.success("Collaborator removed");
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("project_collaborators").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-collaborators", projectId] });
      toast.success("Role updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const profileMap = new Map(collabProfiles?.map((p: any) => [p.user_id, p]) ?? []);

  const roleColors: Record<string, string> = {
    member: "bg-secondary text-secondary-foreground",
    admin: "bg-amber-500/10 text-amber-600",
    owner: "bg-primary/10 text-primary",
  };

  const projectRoleColors: Record<string, string> = {
    client: "bg-blue-500/10 text-blue-600",
    specialist: "bg-emerald-500/10 text-emerald-600",
    manager: "bg-purple-500/10 text-purple-600",
    label: "bg-amber-500/10 text-amber-600",
    contributor: "bg-pink-500/10 text-pink-600",
  };

  const handleSelectUser = (u: { user_id: string; display_name: string }) => {
    setSelectedUser(u);
    setSearch(u.display_name);
    setShowResults(false);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setSelectedUser(null);
    setShowResults(true);
  };

  return (
    <div className="surface-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">Team</h2>
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <Info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-sm space-y-3" side="bottom" align="start">
              <p className="font-semibold text-foreground">Role Permissions</p>
              {Object.entries(ROLE_INFO).map(([key, info]) => (
                <div key={key}>
                  <p className="font-medium text-foreground capitalize">{info.label}</p>
                  <p className="text-xs text-muted-foreground">{info.description}</p>
                </div>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        {canInviteOrRemove && (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSearch(""); setSelectedUser(null); } }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Plus className="mr-1 h-4 w-4" />Invite</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite Collaborator</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); invite.mutate(); }} className="space-y-4">
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => !selectedUser && setShowResults(true)}
                    className="pl-9"
                    required
                  />
                </div>

                {/* Search results dropdown */}
                {showResults && debouncedSearch.length >= 2 && !selectedUser && (
                  <div
                    ref={resultsRef}
                    className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
                  >
                    {searchResults && searchResults.length > 0 ? (
                      searchResults.map((u: any) => (
                        <button
                          key={u.user_id}
                          type="button"
                          onClick={() => handleSelectUser(u)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-bold shrink-0">
                            {(u.display_name?.[0] ?? "?").toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-foreground truncate">{u.display_name}</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-sm text-muted-foreground">No users found</p>
                    )}
                  </div>
                )}

                {/* Selected user chip */}
                {selectedUser && (
                  <div className="mt-2 flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 w-fit">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {(selectedUser.display_name?.[0] ?? "?").toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-primary">{selectedUser.display_name}</span>
                    <button type="button" onClick={() => { setSelectedUser(null); setSearch(""); }} className="ml-1">
                      <X className="h-3.5 w-3.5 text-primary/60 hover:text-primary" />
                    </button>
                  </div>
                )}
              </div>

              {!isCollaborative && (
                <Select value={projectRole} onValueChange={setProjectRole}>
                  <SelectTrigger><SelectValue placeholder="Project role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="specialist">Specialist</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="label">Record Label</SelectItem>
                    <SelectItem value="contributor">Contributor</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={role} onValueChange={(v) => setRole(v as "member" | "admin" | "owner")}>
                <SelectTrigger><SelectValue placeholder="Permission" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                  {isOwner && <SelectItem value="owner">Co-owner</SelectItem>}
                </SelectContent>
              </Select>
              {!isOwner && (role === "admin" || role === "owner") && (
                <p className="text-xs text-muted-foreground">Only the owner can promote someone to Admin or Co-owner.</p>
              )}
              {role === "owner" && (
                <p className="text-xs text-amber-600">Co-owners get full control of this project — they can edit settings, manage the team, and lock revenue splits.</p>
              )}
              <Button type="submit" className="w-full" disabled={invite.isPending || !selectedUser}>
                {invite.isPending ? "Inviting..." : "Invite"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Owner */}
      <div className="mb-2 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
          You
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">You</p>
          <p className="text-xs text-muted-foreground">Owner</p>
        </div>
        {ownerUserId && <SplitPill userId={ownerUserId} />}
      </div>


      {collaborators?.map((collab, i) => {
        const profile = profileMap.get(collab.user_id);
        return (
          <motion.div
            key={collab.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 mt-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-bold">
              {(profile?.display_name?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{profile?.display_name ?? "User"}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {!isCollaborative && (
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${projectRoleColors[(collab as any).project_role] ?? projectRoleColors.client}`}>
                    {(collab as any).project_role || "client"}
                  </span>
                )}
              </div>
            </div>
            <SplitPill userId={collab.user_id} />
            {canInviteOrRemove ? (
              <Select
                value={collab.role}
                onValueChange={(val) => updateRole.mutate({ id: collab.id, role: val })}
              >
                <SelectTrigger className="h-7 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key} disabled={key === "admin" && !isOwner}>
                      <span className="capitalize">{info.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${roleColors[collab.role] ?? roleColors.member}`}>
                {ROLE_INFO[collab.role]?.label ?? collab.role}
              </span>
            )}
            {(canInviteOrRemove || collab.user_id === user?.id) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => remove.mutate(collab.id)}
                title={collab.user_id === user?.id ? "Leave project" : "Remove member"}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}

          </motion.div>
        );
      })}

      {(!collaborators || collaborators.length === 0) && (
        <p className="mt-2 text-xs text-muted-foreground">No collaborators yet — invite someone from your network.</p>
      )}

      {/* ── Revenue splits footer ────────────────────────────── */}
      {isOwner && (
        <div className="mt-4 border-t border-border/60 pt-3 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Total: <span className={cn(
                "font-semibold tabular-nums",
                totalRounded === 100 ? "text-emerald-500" : "text-foreground"
              )}>{totalRounded}%</span> of 100%
            </p>
            <div className="flex items-center gap-2">
              {!splitsLocked && hasUnsavedChanges && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveSplits.mutate()}
                  disabled={saveSplits.isPending}
                >
                  {saveSplits.isPending ? "Saving..." : "Save splits"}
                </Button>
              )}
              {!splitsLocked && !hasUnsavedChanges && totalRounded === 100 && (
                <Button
                  size="sm"
                  onClick={() => setConfirmLockOpen(true)}
                  className="gap-1"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Lock splits
                </Button>
              )}
              {splitsLocked && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              )}
            </div>
          </div>
          {!splitsLocked && totalRounded !== 100 && (
            <p className="text-[11px] text-primary">
              Splits must total 100% before launch.
            </p>
          )}
        </div>
      )}

      {/* Collaborator-only mini footer: just show own % */}
      {!isOwner && user && (
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="text-xs text-muted-foreground">
            Your share:{" "}
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium tabular-nums",
              splitsLocked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
            )}>
              {splitsLocked && <Lock className="h-2.5 w-2.5" />}
              {serverPct.get(user.id) ?? 0}%
            </span>
          </p>
        </div>
      )}

      {/* Confirm lock dialog */}
      <Dialog open={confirmLockOpen} onOpenChange={setConfirmLockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock splits permanently?</DialogTitle>
            <DialogDescription>
              Locking splits is permanent. All team members will be notified. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmLockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => lockSplits.mutate()} disabled={lockSplits.isPending} className="gap-1">
              <Lock className="h-3.5 w-3.5" />
              {lockSplits.isPending ? "Locking..." : "Lock splits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default Collaborators;

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Send, Users, ArrowLeft, Plus, User, Settings, LogOut, UserPlus, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type Group = {
  id: string;
  name: string;
  avatar_url: string | null;
  creator_id: string;
  created_at: string;
};

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

const CirclesTab = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch groups user is in
  const { data: groups } = useQuery({
    queryKey: ["chat-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_groups")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Group[];
    },
    enabled: !!user,
  });

  // Members of selected group
  const { data: members } = useQuery({
    queryKey: ["chat-group-members", selectedGroup?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_group_members")
        .select("*")
        .eq("group_id", selectedGroup!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedGroup,
  });

  const memberIds = members?.map((m: any) => m.user_id) ?? [];
  const { data: memberProfiles } = useQuery({
    queryKey: ["group-member-profiles", memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase.rpc("get_profiles_by_ids", { _ids: memberIds });
      if (error) throw error;
      return data as Profile[];
    },
    enabled: memberIds.length > 0,
  });

  const profileMap = new Map(memberProfiles?.map((p) => [p.user_id, p]) ?? []);

  // Messages for selected group
  const { data: messages } = useQuery({
    queryKey: ["chat-group-messages", selectedGroup?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_group_messages")
        .select("*")
        .eq("group_id", selectedGroup!.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data as GroupMessage[];
    },
    enabled: !!selectedGroup,
  });

  // Realtime for group messages
  useEffect(() => {
    if (!selectedGroup || !user) return;
    const channel = supabase
      .channel(`group-${selectedGroup.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_group_messages",
        filter: `group_id=eq.${selectedGroup.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-group-messages", selectedGroup.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup?.id, user, queryClient]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Create group
  const createGroup = useMutation({
    mutationFn: async () => {
      const { data: group, error } = await supabase
        .from("chat_groups")
        .insert({ name: newGroupName.trim(), creator_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      // Add creator as admin member
      await supabase.from("chat_group_members").insert({
        group_id: group.id, user_id: user!.id, role: "admin",
      });
      return group;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["chat-groups"] });
      setCreateOpen(false);
      setNewGroupName("");
      setSelectedGroup(group as Group);
      toast.success("Circle created!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Send message
  const sendMessage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("chat_group_messages").insert({
        group_id: selectedGroup!.id,
        sender_id: user!.id,
        content: messageText.trim(),
      });
      if (error) throw error;
      // Touch updated_at on group
      await supabase.from("chat_groups").update({ updated_at: new Date().toISOString() }).eq("id", selectedGroup!.id);
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["chat-group-messages", selectedGroup?.id] });
      queryClient.invalidateQueries({ queryKey: ["chat-groups"] });
    },
  });

  // Search users to add
  const { data: addResults } = useQuery({
    queryKey: ["add-member-search", addMemberSearch],
    queryFn: async () => {
      if (!addMemberSearch.trim()) return [];
      const { data, error } = await supabase.rpc("lookup_user_by_display_name", { _name: addMemberSearch.trim() });
      if (error) throw error;
      return (data ?? []).filter((p: any) => p.user_id !== user!.id && !memberIds.includes(p.user_id)) as Profile[];
    },
    enabled: !!addMemberSearch.trim() && manageOpen,
  });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("chat_group_members").insert({
        group_id: selectedGroup!.id, user_id: userId, role: "member",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-group-members", selectedGroup?.id] });
      setAddMemberSearch("");
      toast.success("Member added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const leaveGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("chat_group_members")
        .delete()
        .eq("group_id", selectedGroup!.id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-groups"] });
      setSelectedGroup(null);
      setManageOpen(false);
      toast.success("Left the circle");
    },
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("chat_group_members")
        .delete()
        .eq("group_id", selectedGroup!.id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-group-members", selectedGroup?.id] });
      toast.success("Member removed");
    },
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const filteredGroups = groups?.filter((g) =>
    !search || g.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const isAdmin = selectedGroup?.creator_id === user?.id ||
    members?.some((m: any) => m.user_id === user?.id && m.role === "admin");

  return (
    <div className="surface-card flex h-[calc(100vh-20rem)] overflow-hidden">
      {/* Group list sidebar */}
      <div className={cn(
        "flex flex-col border-r border-border",
        selectedGroup ? "hidden md:flex md:w-80" : "w-full md:w-80"
      )}>
        <div className="p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search circles..." className="pl-9" />
          </div>
          <Button variant="outline" size="sm" className="w-full rounded-full gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Create Circle
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {filteredGroups.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {search ? "No circles match your search" : "No circles yet"}
              </p>
              {!search && (
                <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Create Circle
                </Button>
              )}
            </div>
          ) : (
            filteredGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  selectedGroup?.id === group.id && "bg-muted/70"
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/30">
                  <Users className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate block">{group.name}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(group.created_at)}</span>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className={cn("flex flex-1 flex-col", !selectedGroup ? "hidden md:flex" : "flex")}>
        {!selectedGroup ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground px-4">
            <Users className="mb-4 h-12 w-12" />
            <p className="text-lg font-medium">Select a Circle</p>
            <p className="text-sm">Choose a circle or create a new one to start chatting</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 md:px-6 py-4">
              <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setSelectedGroup(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/30">
                <Users className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-display font-semibold text-foreground block truncate">{selectedGroup.name}</span>
                <span className="text-[10px] text-muted-foreground">{members?.length ?? 0} members</span>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setManageOpen(true)}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-6">
              <div className="space-y-3">
                {messages?.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  const senderProfile = profileMap.get(msg.sender_id);
                  return (
                    <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                      <div className="max-w-[70%]">
                        {!isMine && (
                          <p className="text-[10px] text-muted-foreground mb-0.5 px-1">
                            {senderProfile?.display_name || "Member"}
                          </p>
                        )}
                        <div className={cn(
                          "rounded-2xl px-4 py-2.5",
                          isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
                        )}>
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={cn("mt-1 text-[10px]", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <form
              onSubmit={(e) => { e.preventDefault(); if (messageText.trim()) sendMessage.mutate(); }}
              className="flex items-center gap-2 border-t border-border px-4 md:px-6 py-3"
            >
              <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Message this circle..." className="flex-1" />
              <Button type="submit" size="icon" disabled={!messageText.trim() || sendMessage.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </div>

      {/* Create Circle Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Create a Circle</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newGroupName.trim()) createGroup.mutate(); }} className="space-y-4">
            <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Circle name..." autoFocus />
            <Button type="submit" className="w-full rounded-full" disabled={!newGroupName.trim() || createGroup.isPending}>
              {createGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Circle"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Circle Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display">{selectedGroup?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Add member */}
            {isAdmin && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Add Members</label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={addMemberSearch} onChange={(e) => setAddMemberSearch(e.target.value)} placeholder="Search by name..." className="pl-9" />
                </div>
                {addResults?.map((p) => (
                  <button key={p.user_id} onClick={() => addMember.mutate(p.user_id)}
                    className="flex w-full items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full rounded-full object-cover" /> : <User className="h-4 w-4 text-primary" />}
                    </div>
                    <span className="text-sm font-medium flex-1">{p.display_name || "Creator"}</span>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* Members list */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Members ({members?.length ?? 0})</label>
              {memberProfiles?.map((p) => {
                const memberRole = members?.find((m: any) => m.user_id === p.user_id);
                return (
                  <div key={p.user_id} className="flex items-center gap-3 px-3 py-2 rounded-lg">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full rounded-full object-cover" /> : <User className="h-4 w-4 text-primary" />}
                    </div>
                    <span className="text-sm font-medium flex-1 truncate">{p.display_name || "Creator"}</span>
                    {(memberRole as any)?.role === "admin" && (
                      <Badge variant="outline" className="text-[10px]">Admin</Badge>
                    )}
                    {isAdmin && p.user_id !== user?.id && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember.mutate(p.user_id)}>
                        <LogOut className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Leave */}
            <Button variant="outline" className="w-full rounded-full gap-2 text-destructive hover:text-destructive" onClick={() => leaveGroup.mutate()}>
              <LogOut className="h-4 w-4" /> Leave Circle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CirclesTab;

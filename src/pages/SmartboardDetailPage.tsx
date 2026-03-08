import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  MessageSquare,
  UserPlus,
  StickyNote,
  Link2,
  Image,
  Send,
  Trash2,
  X,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const SmartboardDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [itemType, setItemType] = useState<"note" | "link">("note");
  const [itemTitle, setItemTitle] = useState("");
  const [itemContent, setItemContent] = useState("");
  const [itemLink, setItemLink] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: board } = useQuery({
    queryKey: ["smartboard", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboards")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["smartboard-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboard_items")
        .select("*")
        .eq("smartboard_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["smartboard-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboard_members")
        .select("*, profiles(display_name, avatar_url)")
        .eq("smartboard_id", id!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: chatMessages } = useQuery({
    queryKey: ["smartboard-chat", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboard_messages")
        .select("*, profiles(display_name)")
        .eq("smartboard_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime chat
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`smartboard-chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "smartboard_messages", filter: `smartboard_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["smartboard-chat", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("smartboard_items").insert({
        smartboard_id: id!,
        user_id: user!.id,
        content_type: itemType,
        title: itemTitle || null,
        content: itemContent || null,
        link_url: itemLink || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smartboard-items", id] });
      setAddOpen(false);
      setItemTitle("");
      setItemContent("");
      setItemLink("");
      toast.success("Item added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("smartboard_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smartboard-items", id] });
    },
  });

  const sendChat = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("smartboard_messages").insert({
        smartboard_id: id!,
        user_id: user!.id,
        content: chatMsg,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setChatMsg("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const inviteMember = useMutation({
    mutationFn: async () => {
      // Look up user by display_name or email-like match in profiles
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .ilike("display_name", `%${inviteEmail}%`)
        .limit(1);
      if (pErr) throw pErr;
      if (!profiles || profiles.length === 0) throw new Error("User not found");

      const { error } = await supabase.from("smartboard_members").insert({
        smartboard_id: id!,
        user_id: profiles[0].user_id,
        role: inviteRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smartboard-members", id] });
      setInviteOpen(false);
      setInviteEmail("");
      toast.success("Member invited!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isOwner = board?.user_id === user?.id;

  if (!board) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/smartboards">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-foreground">{board.title}</h1>
          {board.description && (
            <p className="text-sm text-muted-foreground">{board.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Collaborator</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (inviteEmail.trim()) inviteMember.mutate();
                  }}
                  className="space-y-4"
                >
                  <Input
                    placeholder="Search by display name..."
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" className="w-full">
                    Send Invite
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Button
            variant={chatOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setChatOpen(!chatOpen)}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add to Board</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2 mb-4">
                <Button
                  variant={itemType === "note" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setItemType("note")}
                >
                  <StickyNote className="mr-1 h-4 w-4" />
                  Note
                </Button>
                <Button
                  variant={itemType === "link" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setItemType("link")}
                >
                  <Link2 className="mr-1 h-4 w-4" />
                  Link
                </Button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addItem.mutate();
                }}
                className="space-y-4"
              >
                <Input
                  placeholder="Title"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                />
                {itemType === "note" && (
                  <Textarea
                    placeholder="Write your note..."
                    value={itemContent}
                    onChange={(e) => setItemContent(e.target.value)}
                    rows={4}
                  />
                )}
                {itemType === "link" && (
                  <Input
                    placeholder="https://..."
                    value={itemLink}
                    onChange={(e) => setItemLink(e.target.value)}
                  />
                )}
                <Button type="submit" className="w-full">
                  Add to Board
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Members strip */}
      {members && members.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {members.map((m: any) => (
            <span key={m.id} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
              {(m.profiles as any)?.display_name ?? "User"} · {m.role}
            </span>
          ))}
        </div>
      )}

      <div className={`grid gap-6 ${chatOpen ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
        {/* Items grid */}
        <div className={chatOpen ? "lg:col-span-2" : ""}>
          {(!items || items.length === 0) ? (
            <div className="surface-card flex flex-col items-center justify-center py-20">
              <StickyNote className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">This board is empty. Add notes, links, or media!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.03 }}
                    className="surface-card group relative overflow-hidden p-5"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      {item.content_type === "note" && <StickyNote className="h-4 w-4 text-warm" />}
                      {item.content_type === "link" && <Link2 className="h-4 w-4 text-blue" />}
                      {item.content_type === "image" && <Image className="h-4 w-4 text-pink" />}
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        {item.content_type}
                      </span>
                    </div>
                    {item.title && (
                      <h3 className="mb-1 font-display font-semibold text-foreground text-sm">
                        {item.title}
                      </h3>
                    )}
                    {item.content && (
                      <p className="text-sm text-muted-foreground line-clamp-4">{item.content}</p>
                    )}
                    {item.link_url && (
                      <a
                        href={item.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block truncate text-sm text-primary hover:underline"
                      >
                        {item.link_url}
                      </a>
                    )}
                    {item.user_id === user?.id && (
                      <button
                        onClick={() => deleteItem.mutate(item.id)}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="surface-card flex flex-col overflow-hidden lg:col-span-1"
            style={{ height: "60vh" }}
          >
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-display font-semibold text-foreground text-sm">Board Chat</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages?.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.user_id === user?.id ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] text-muted-foreground mb-0.5">
                    {(msg.profiles as any)?.display_name ?? "User"}
                  </span>
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      msg.user_id === user?.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (chatMsg.trim()) sendChat.mutate();
              }}
              className="border-t border-border p-3 flex gap-2"
            >
              <Input
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!chatMsg.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SmartboardDetailPage;

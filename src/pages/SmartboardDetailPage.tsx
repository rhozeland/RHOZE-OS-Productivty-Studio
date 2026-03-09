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
  ImageIcon,
  Send,
  X,
  Users,
  Bookmark,
  Share2,
  Heart,
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
      const { data, error } = await supabase.from("smartboards").select("*").eq("id", id!).single();
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
      const { data, error } = await supabase.from("smartboard_members").select("*").eq("smartboard_id", id!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: chatMessages } = useQuery({
    queryKey: ["smartboard-chat", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboard_messages")
        .select("*")
        .eq("smartboard_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["smartboard-items", id] }),
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
    onSuccess: () => setChatMsg(""),
    onError: (e: any) => toast.error(e.message),
  });

  const inviteMember = useMutation({
    mutationFn: async () => {
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

  if (!board) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header — reference style */}
      <div className="surface-card rounded-2xl overflow-hidden">
        <div className="p-5 md:p-6">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/smartboards">
              <Button variant="outline" size="icon" className="rounded-full h-9 w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="font-display text-xl md:text-2xl font-bold text-foreground flex-1 text-center md:text-left">
              {board.title}
            </h1>
          </div>

          {/* Action strip */}
          <div className="flex items-center justify-center gap-5">
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Bookmark className="h-5 w-5" />
            </button>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Share2 className="h-5 w-5" />
            </button>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Heart className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {members && members.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{members.length + 1}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full text-xs">
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invite Collaborator</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); if (inviteEmail.trim()) inviteMember.mutate(); }} className="space-y-4">
                  <Input placeholder="Search by display name..." value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" className="w-full rounded-full">Send Invite</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Button
            variant={chatOpen ? "default" : "outline"}
            size="sm"
            className="rounded-full text-xs"
            onClick={() => setChatOpen(!chatOpen)}
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Chat
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full text-xs">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add to Board</DialogTitle></DialogHeader>
              <div className="flex gap-2 mb-4">
                <Button variant={itemType === "note" ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setItemType("note")}>
                  <StickyNote className="mr-1 h-4 w-4" /> Note
                </Button>
                <Button variant={itemType === "link" ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setItemType("link")}>
                  <Link2 className="mr-1 h-4 w-4" /> Link
                </Button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addItem.mutate(); }} className="space-y-4">
                <Input placeholder="Title" value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} />
                {itemType === "note" && <Textarea placeholder="Write your note..." value={itemContent} onChange={(e) => setItemContent(e.target.value)} rows={4} />}
                {itemType === "link" && <Input placeholder="https://..." value={itemLink} onChange={(e) => setItemLink(e.target.value)} />}
                <Button type="submit" className="w-full rounded-full">Add to Board</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className={`grid gap-4 ${chatOpen ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
        {/* Masonry grid */}
        <div className={chatOpen ? "lg:col-span-2" : ""}>
          {(!items || items.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl bg-muted/20 border border-border">
              <StickyNote className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-foreground font-medium">This board is empty</p>
              <p className="text-sm text-muted-foreground mt-1">Add notes, links, or media to get started</p>
            </div>
          ) : (
            <div className="columns-2 md:columns-3 gap-3 space-y-3">
              <AnimatePresence>
                {items.map((item, i) => {
                  const isImage = item.content_type === "image" && item.file_url;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.03 }}
                      className="break-inside-avoid group relative rounded-xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-md transition-shadow"
                    >
                      {isImage ? (
                        <img
                          src={item.file_url!}
                          alt={item.title || "Board item"}
                          className="w-full object-cover"
                        />
                      ) : (
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {item.content_type === "note" && <StickyNote className="h-3.5 w-3.5 text-primary" />}
                            {item.content_type === "link" && <Link2 className="h-3.5 w-3.5 text-primary" />}
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              {item.content_type}
                            </span>
                          </div>
                          {item.title && (
                            <h3 className="font-display font-semibold text-foreground text-sm leading-snug mb-1">
                              {item.title}
                            </h3>
                          )}
                          {item.content && (
                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">{item.content}</p>
                          )}
                          {item.link_url && (
                            <a
                              href={item.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 block truncate text-xs text-primary hover:underline"
                            >
                              {item.link_url}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Delete overlay */}
                      {item.user_id === user?.id && (
                        <button
                          onClick={() => deleteItem.mutate(item.id)}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground shadow-sm"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl bg-card border border-border flex flex-col overflow-hidden lg:col-span-1"
            style={{ height: "60vh" }}
          >
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-sm">Board Chat</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setChatOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages?.map((msg: any) => (
                <div key={msg.id} className={`flex flex-col ${msg.user_id === user?.id ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-muted-foreground mb-0.5">
                    {msg.user_id === user?.id ? "You" : "Member"}
                  </span>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    msg.user_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (chatMsg.trim()) sendChat.mutate(); }}
              className="border-t border-border p-3 flex gap-2"
            >
              <Input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} placeholder="Message..." className="flex-1 rounded-full" />
              <Button type="submit" size="icon" className="rounded-full" disabled={!chatMsg.trim()}>
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

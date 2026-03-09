import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, User, MessageSquare, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean | null;
  created_at: string;
};

const MessagesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inquiryHandled = useRef(false);

  // Get all profiles (potential contacts)
  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .neq("user_id", user!.id);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!user,
  });

  // Get conversations (users we've messaged with)
  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Group by conversation partner and get latest message
      const convMap = new Map<string, Message>();
      for (const msg of (data as Message[])) {
        const partnerId = msg.sender_id === user!.id ? msg.receiver_id : msg.sender_id;
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, msg);
        }
      }
      return convMap;
    },
    enabled: !!user,
  });

  // Get messages for selected conversation
  const { data: messages } = useQuery({
    queryKey: ["messages", selectedUser?.user_id],
    queryFn: async () => {
      if (!selectedUser) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user!.id},receiver_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${user!.id})`
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!user && !!selectedUser,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only process if we're involved
          if (newMsg.sender_id === user.id || newMsg.receiver_id === user.id) {
            queryClient.invalidateQueries({ queryKey: ["messages", selectedUser?.user_id] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUser?.user_id, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    if (!selectedUser || !user || !messages) return;
    const unread = messages.filter((m) => m.receiver_id === user.id && !m.read);
    if (unread.length > 0) {
      supabase
        .from("messages")
        .update({ read: true })
        .in("id", unread.map((m) => m.id))
        .then(() => queryClient.invalidateQueries({ queryKey: ["conversations"] }));
    }
  }, [messages, selectedUser, user, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("messages").insert({
        sender_id: user!.id,
        receiver_id: selectedUser!.user_id,
        content: messageText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedUser?.user_id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // Build contacts list: people we've talked to + searchable profiles
  const contactsList = (() => {
    if (!profiles) return [];
    const conversationPartnerIds = conversations ? Array.from(conversations.keys()) : [];

    // Sort: conversation partners first, then others
    const sorted = [...profiles].sort((a, b) => {
      const aHasConv = conversationPartnerIds.includes(a.user_id);
      const bHasConv = conversationPartnerIds.includes(b.user_id);
      if (aHasConv && !bHasConv) return -1;
      if (!aHasConv && bHasConv) return 1;
      return 0;
    });

    if (!search) return sorted;
    return sorted.filter((p) =>
      p.display_name?.toLowerCase().includes(search.toLowerCase())
    );
  })();

  const getLastMessage = (userId: string) => conversations?.get(userId);
  const getUnreadCount = (userId: string) => {
    const msg = conversations?.get(userId);
    if (!msg || msg.sender_id === user?.id || msg.read) return 0;
    return 1; // simplified
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Messages</h1>
        <p className="text-muted-foreground">Connect with other creators</p>
      </div>

      <div className="surface-card flex h-[calc(100vh-16rem)] overflow-hidden">
        {/* Sidebar - Contacts */}
        <div className={cn(
          "flex flex-col border-r border-border",
          selectedUser ? "hidden md:flex md:w-80" : "w-full md:w-80"
        )}>
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search creators..."
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {contactsList.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No creators found</p>
            ) : (
              contactsList.map((profile) => {
                const lastMsg = getLastMessage(profile.user_id);
                const unread = getUnreadCount(profile.user_id);
                return (
                  <button
                    key={profile.user_id}
                    onClick={() => setSelectedUser(profile)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      selectedUser?.user_id === profile.user_id && "bg-muted/70"
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground truncate">
                          {profile.display_name || "Creator"}
                        </span>
                        {lastMsg && (
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                            {formatTime(lastMsg.created_at)}
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground truncate flex-1">
                            {lastMsg.sender_id === user?.id ? "You: " : ""}{lastMsg.content}
                          </p>
                          {unread > 0 && (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                              {unread}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className={cn(
          "flex flex-1 flex-col",
          !selectedUser ? "hidden md:flex" : "flex"
        )}>
          {!selectedUser ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="mb-4 h-12 w-12" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a creator from the list to start chatting</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b border-border px-4 md:px-6 py-4">
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setSelectedUser(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <span className="font-display font-semibold text-foreground">
                  {selectedUser.display_name || "Creator"}
                </span>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-4">
                  {messages?.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2.5",
                            isMine
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={cn(
                            "mt-1 text-[10px]",
                            isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                          )}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (messageText.trim()) sendMessage.mutate();
                }}
                className="flex items-center gap-3 border-t border-border px-6 py-4"
              >
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!messageText.trim() || sendMessage.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;

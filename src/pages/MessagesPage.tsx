import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Send, User, MessageSquare, ArrowLeft,
  Inbox, FolderKanban, CheckCircle, XCircle, Clock, ArrowRight, Loader2,
  DollarSign, Video, Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import QuoteBuilder from "@/components/messages/QuoteBuilder";
import QuoteCard, { isQuoteMessage } from "@/components/messages/QuoteCard";
import ChatAttachmentMenu from "@/components/messages/ChatAttachmentMenu";
import RichMessageCard, { isRichMessage } from "@/components/messages/RichMessageCard";

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-amber-500/15 text-amber-600", icon: Clock },
  accepted: { label: "Accepted", color: "bg-green-500/15 text-green-600", icon: CheckCircle },
  declined: { label: "Declined", color: "bg-red-500/15 text-red-500", icon: XCircle },
};

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
  const [quoteOpen, setQuoteOpen] = useState(false);
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

  // Handle inquiry deep-link from marketplace
  useEffect(() => {
    if (inquiryHandled.current || !profiles) return;
    const toUserId = searchParams.get("to");
    const listingTitle = searchParams.get("listing");
    if (!toUserId) return;

    const targetProfile = profiles.find((p) => p.user_id === toUserId);
    if (targetProfile) {
      setSelectedUser(targetProfile);
      if (listingTitle) {
        setMessageText(`Hi! I'm interested in your listing "${decodeURIComponent(listingTitle)}". Could we discuss the details?`);
      }
      // Clean up URL params
      setSearchParams({}, { replace: true });
      inquiryHandled.current = true;
    }
  }, [profiles, searchParams, setSearchParams]);

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

  // === INQUIRIES DATA ===
  const navigate = useNavigate();
  const [convertDialog, setConvertDialog] = useState<any>(null);
  const [totalCredits, setTotalCredits] = useState("");

  const activeTab = searchParams.get("tab") || "messages";
  const setActiveTab = (tab: string) => {
    if (tab === "messages") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const { data: receivedInquiries } = useQuery({
    queryKey: ["inquiries-received", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listing_inquiries").select("*").eq("receiver_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: sentInquiries } = useQuery({
    queryKey: ["inquiries-sent", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listing_inquiries").select("*").eq("sender_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const allInquiryListingIds = [...new Set([...(receivedInquiries?.map((i) => i.listing_id) ?? []), ...(sentInquiries?.map((i) => i.listing_id) ?? [])])];
  const { data: inquiryListings } = useQuery({
    queryKey: ["inquiry-listings", allInquiryListingIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketplace_listings").select("id, title, credits_price").in("id", allInquiryListingIds);
      if (error) throw error;
      return data;
    },
    enabled: allInquiryListingIds.length > 0,
  });

  const senderIds = [...new Set(receivedInquiries?.map((i) => i.sender_id) ?? [])];
  const { data: senderProfiles } = useQuery({
    queryKey: ["inquiry-senders", senderIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name").in("user_id", senderIds);
      if (error) throw error;
      return data;
    },
    enabled: senderIds.length > 0,
  });

  const inquiryListingsMap = new Map(inquiryListings?.map((l) => [l.id, l]) ?? []);
  const sendersMap = new Map(senderProfiles?.map((p) => [p.user_id, p.display_name]) ?? []);

  const declineMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      const { error } = await supabase.from("listing_inquiries").update({ status: "declined" }).eq("id", inquiryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries-received"] });
      toast.success("Inquiry declined");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const convertMutation = useMutation({
    mutationFn: async ({ inquiryId, credits }: { inquiryId: string; credits: number }) => {
      const { data, error } = await supabase.rpc("convert_inquiry_to_project" as any, {
        _inquiry_id: inquiryId, _receiver_id: user!.id, _total_credits: credits,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inquiries-received"] });
      setConvertDialog(null);
      toast.success("Project created!");
      const projectId = typeof data === "object" ? data.project_id : null;
      if (projectId) navigate(`/projects/${projectId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pendingCount = receivedInquiries?.filter((i) => i.status === "pending").length ?? 0;

  const renderInquiry = (inquiry: any, type: "received" | "sent") => {
    const listing = inquiryListingsMap.get(inquiry.listing_id);
    const statusMeta = STATUS_META[inquiry.status] ?? STATUS_META.pending;
    const StatusIcon = statusMeta.icon;
    const senderName = type === "received" ? sendersMap.get(inquiry.sender_id) ?? "Someone" : "You";

    return (
      <div key={inquiry.id} className="surface-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`${statusMeta.color} border-0 gap-1 text-xs`}>
                <StatusIcon className="h-3 w-3" />
                {statusMeta.label}
              </Badge>
              <Badge variant="outline" className="gap-1 text-[10px]">
                <DollarSign className="h-2.5 w-2.5" /> Inquiry
              </Badge>
              <span className="text-xs text-muted-foreground">{format(new Date(inquiry.created_at), "MMM d, yyyy")}</span>
            </div>
            <Link to={`/creators/${inquiry.listing_id}`} className="font-semibold text-foreground hover:text-primary transition-colors text-sm">
              {listing?.title ?? "Listing"}
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">
              {type === "received" ? `From: ${senderName}` : `Sent to seller`}
            </p>
          </div>
          {inquiry.status === "accepted" && inquiry.project_id && (
            <Link to={`/projects/${inquiry.project_id}`}>
              <Button variant="outline" size="sm" className="gap-1 rounded-full text-xs">
                <FolderKanban className="h-3 w-3" /> View Project
              </Button>
            </Link>
          )}
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-foreground whitespace-pre-wrap">{inquiry.message}</p>
        </div>
        {type === "received" && inquiry.status === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="gap-1.5 rounded-full" onClick={() => {
              setConvertDialog(inquiry);
              setTotalCredits(listing?.credits_price?.toString() ?? "");
            }}>
              <FolderKanban className="h-3.5 w-3.5" /> Convert to Project
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 rounded-full text-muted-foreground"
              onClick={() => declineMutation.mutate(inquiry.id)} disabled={declineMutation.isPending}>
              <XCircle className="h-3.5 w-3.5" /> Decline
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Messages</h1>
        <p className="text-muted-foreground">Connect with creators & manage inquiries</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="messages" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> All Messages
          </TabsTrigger>
          <TabsTrigger value="inquiries" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" /> Inquiries
            {pendingCount > 0 && (
              <span className="ml-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-4">
          <div className="surface-card flex h-[calc(100vh-20rem)] overflow-hidden">
            {/* Sidebar - Contacts */}
            <div className={cn(
              "flex flex-col border-r border-border",
              selectedUser ? "hidden md:flex md:w-80" : "w-full md:w-80"
            )}>
              <div className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search creators..." className="pl-9" />
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
                            <span className="text-sm font-medium text-foreground truncate">{profile.display_name || "Creator"}</span>
                            {lastMsg && <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatTime(lastMsg.created_at)}</span>}
                          </div>
                          {lastMsg && (
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground truncate flex-1">
                                {lastMsg.sender_id === user?.id ? "You: " : ""}{lastMsg.content}
                              </p>
                              {unread > 0 && (
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{unread}</span>
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
            <div className={cn("flex flex-1 flex-col", !selectedUser ? "hidden md:flex" : "flex")}>
              {!selectedUser ? (
                <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                  <MessageSquare className="mb-4 h-12 w-12" />
                  <p className="text-lg font-medium">Select a conversation</p>
                  <p className="text-sm">Choose a creator from the list to start chatting</p>
                </div>
              ) : (
                <>
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
                    <span className="font-display font-semibold text-foreground">{selectedUser.display_name || "Creator"}</span>
                    <div className="ml-auto">
                      <QuoteBuilder recipientId={selectedUser.user_id} recipientName={selectedUser.display_name || "Creator"} />
                    </div>
                  </div>

                  <ScrollArea className="flex-1 p-6">
                    <div className="space-y-4">
                      {messages?.map((msg) => {
                        const isMine = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                            {isQuoteMessage(msg.content) ? (
                              <QuoteCard content={msg.content} isMine={isMine} messageId={msg.id} senderId={msg.sender_id} />
                            ) : isRichMessage(msg.content) ? (
                              <RichMessageCard content={msg.content} isMine={isMine} timestamp={msg.created_at} formatTime={formatTime} />
                            ) : (
                              <div className={cn(
                                "max-w-[70%] rounded-2xl px-4 py-2.5",
                                isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
                              )}>
                                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                <p className={cn("mt-1 text-[10px]", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                  {formatTime(msg.created_at)}
                                </p>
                              </div>
                            )}
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
                    <ChatAttachmentMenu
                      onSendMessage={(content) => {
                        const originalText = messageText;
                        // Temporarily set the message to send rich content
                        supabase.from("messages").insert({
                          sender_id: user!.id,
                          receiver_id: selectedUser!.user_id,
                          content,
                        }).then(({ error }) => {
                          if (error) { toast.error("Failed to share"); return; }
                          queryClient.invalidateQueries({ queryKey: ["messages", selectedUser?.user_id] });
                          queryClient.invalidateQueries({ queryKey: ["conversations"] });
                        });
                      }}
                      disabled={!selectedUser}
                    />
                    <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type a message..." className="flex-1" />
                    <Button type="submit" size="icon" disabled={!messageText.trim() || sendMessage.isPending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inquiries" className="mt-4">
          <Tabs defaultValue="received">
            <TabsList>
              <TabsTrigger value="received" className="gap-1.5">
                <Inbox className="h-3.5 w-3.5" /> Received
                {pendingCount > 0 && (
                  <span className="ml-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">{pendingCount}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-1.5">
                <Send className="h-3.5 w-3.5" /> Sent
              </TabsTrigger>
            </TabsList>
            <TabsContent value="received" className="space-y-3 mt-4">
              {!receivedInquiries?.length ? (
                <div className="text-center py-16"><Inbox className="h-10 w-10 mx-auto text-muted-foreground/30" /><p className="text-sm text-muted-foreground mt-3">No inquiries received yet</p></div>
              ) : receivedInquiries.map((i) => renderInquiry(i, "received"))}
            </TabsContent>
            <TabsContent value="sent" className="space-y-3 mt-4">
              {!sentInquiries?.length ? (
                <div className="text-center py-16"><Send className="h-10 w-10 mx-auto text-muted-foreground/30" /><p className="text-sm text-muted-foreground mt-3">You haven't sent any inquiries yet</p></div>
              ) : sentInquiries.map((i) => renderInquiry(i, "sent"))}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Convert to Project Dialog */}
      <Dialog open={!!convertDialog} onOpenChange={(open) => !open && setConvertDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Convert to Project</DialogTitle></DialogHeader>
          {convertDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">This will create a project with the client as a collaborator.</p>
              <div>
                <label className="text-sm font-medium text-foreground">Total Credits for Contract</label>
                <Input type="number" min="0" value={totalCredits} onChange={(e) => setTotalCredits(e.target.value)} placeholder="e.g. 5" className="mt-1.5" />
              </div>
              <Button className="w-full rounded-full gap-2" disabled={convertMutation.isPending}
                onClick={() => convertMutation.mutate({ inquiryId: convertDialog.id, credits: parseFloat(totalCredits) || 0 })}>
                {convertMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Creating...</> : <><FolderKanban className="h-4 w-4" />Create Project<ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesPage;

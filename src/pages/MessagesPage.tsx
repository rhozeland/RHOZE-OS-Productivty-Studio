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
  DollarSign, Video, Phone, Plus, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import QuoteBuilder from "@/components/messages/QuoteBuilder";
import QuoteCard, { isQuoteMessage } from "@/components/messages/QuoteCard";
import ChatAttachmentMenu from "@/components/messages/ChatAttachmentMenu";
import RichMessageCard, { isRichMessage } from "@/components/messages/RichMessageCard";
import CirclesTab from "@/components/messages/CirclesTab";
import BuddyList from "@/components/messages/BuddyList";

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
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const [newConvoSearch, setNewConvoSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inquiryHandled = useRef(false);

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

  // Get profiles for conversation partners
  const conversationPartnerIds = conversations ? Array.from(conversations.keys()) : [];
  const { data: partnerProfiles } = useQuery({
    queryKey: ["partner-profiles", conversationPartnerIds],
    queryFn: async () => {
      if (conversationPartnerIds.length === 0) return [];
      const { data, error } = await supabase.rpc("get_profiles_by_ids", {
        _ids: conversationPartnerIds,
      });
      if (error) throw error;
      return (data as Profile[]) ?? [];
    },
    enabled: conversationPartnerIds.length > 0,
  });

  // Search for new conversations
  const { data: searchResults } = useQuery({
    queryKey: ["user-search", newConvoSearch],
    queryFn: async () => {
      if (!newConvoSearch.trim()) return [];
      const { data, error } = await supabase.rpc("lookup_user_by_display_name", {
        _name: newConvoSearch.trim(),
      });
      if (error) throw error;
      return (data ?? []).filter((p: any) => p.user_id !== user!.id) as Profile[];
    },
    enabled: !!newConvoSearch.trim() && newConvoOpen,
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
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === user.id || newMsg.receiver_id === user.id) {
            queryClient.invalidateQueries({ queryKey: ["messages", selectedUser?.user_id] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedUser?.user_id, queryClient]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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

  // Handle deep-link (e.g. ?to=userId)
  useEffect(() => {
    if (inquiryHandled.current || !partnerProfiles) return;
    const toUserId = searchParams.get("to");
    const listingTitle = searchParams.get("listing");
    if (!toUserId) return;

    // Check if we have the profile already, if not fetch it
    let targetProfile = partnerProfiles.find((p) => p.user_id === toUserId);
    if (!targetProfile) {
      // Fetch the profile via RPC
      supabase.rpc("get_profiles_by_ids", { _ids: [toUserId] }).then(({ data }) => {
        if (data && data.length > 0) {
          setSelectedUser(data[0] as Profile);
          if (listingTitle) {
            setMessageText(`Hi! I'm interested in your listing "${decodeURIComponent(listingTitle)}". Could we discuss the details?`);
          }
        }
      });
    } else {
      setSelectedUser(targetProfile);
      if (listingTitle) {
        setMessageText(`Hi! I'm interested in your listing "${decodeURIComponent(listingTitle)}". Could we discuss the details?`);
      }
    }
    setSearchParams({}, { replace: true });
    inquiryHandled.current = true;
  }, [partnerProfiles, searchParams, setSearchParams]);

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

  // Build contacts list: only people we've messaged with, filtered by search
  const contactsList = (() => {
    if (!partnerProfiles) return [];
    // Sort by latest message time
    const sorted = [...partnerProfiles].sort((a, b) => {
      const aMsg = conversations?.get(a.user_id);
      const bMsg = conversations?.get(b.user_id);
      if (!aMsg && !bMsg) return 0;
      if (!aMsg) return 1;
      if (!bMsg) return -1;
      return new Date(bMsg.created_at).getTime() - new Date(aMsg.created_at).getTime();
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
    return 1;
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

  // All inquiries (both sent and received)
  const { data: allInquiries } = useQuery({
    queryKey: ["inquiries-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_inquiries")
        .select("*")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const allInquiryListingIds = [...new Set(allInquiries?.map((i) => i.listing_id) ?? [])];
  const { data: inquiryListings } = useQuery({
    queryKey: ["inquiry-listings", allInquiryListingIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketplace_listings").select("id, title, credits_price").in("id", allInquiryListingIds);
      if (error) throw error;
      return data;
    },
    enabled: allInquiryListingIds.length > 0,
  });

  const allInquiryUserIds = [...new Set([
    ...(allInquiries?.map((i) => i.sender_id) ?? []),
    ...(allInquiries?.map((i) => i.receiver_id) ?? []),
  ].filter(id => id !== user?.id))];

  const { data: inquiryProfiles } = useQuery({
    queryKey: ["inquiry-profiles", allInquiryUserIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profiles_by_ids", { _ids: allInquiryUserIds });
      if (error) throw error;
      return data;
    },
    enabled: allInquiryUserIds.length > 0,
  });

  const inquiryListingsMap = new Map(inquiryListings?.map((l) => [l.id, l]) ?? []);
  const inquiryProfilesMap = new Map(inquiryProfiles?.map((p: any) => [p.user_id, p.display_name]) ?? []);

  const pendingCount = allInquiries?.filter((i) => i.receiver_id === user?.id && i.status === "pending").length ?? 0;

  const declineMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      const { error } = await supabase.from("listing_inquiries").update({ status: "declined" }).eq("id", inquiryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries-all"] });
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
      queryClient.invalidateQueries({ queryKey: ["inquiries-all"] });
      setConvertDialog(null);
      toast.success("Project created!");
      const projectId = typeof data === "object" ? data.project_id : null;
      if (projectId) navigate(`/projects/${projectId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renderInquiry = (inquiry: any) => {
    const listing = inquiryListingsMap.get(inquiry.listing_id);
    const statusMeta = STATUS_META[inquiry.status] ?? STATUS_META.pending;
    const StatusIcon = statusMeta.icon;
    const isSender = inquiry.sender_id === user?.id;
    const otherUserId = isSender ? inquiry.receiver_id : inquiry.sender_id;
    const otherName = inquiryProfilesMap.get(otherUserId) ?? (isSender ? "Seller" : "Someone");

    return (
      <div key={inquiry.id} className="surface-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`${statusMeta.color} border-0 gap-1 text-xs`}>
                <StatusIcon className="h-3 w-3" />
                {statusMeta.label}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {isSender ? "Sent" : "Received"}
              </Badge>
              <span className="text-xs text-muted-foreground">{format(new Date(inquiry.created_at), "MMM d, yyyy")}</span>
            </div>
            <Link to={`/creators/${inquiry.listing_id}`} className="font-semibold text-foreground hover:text-primary transition-colors text-sm">
              {listing?.title ?? "Listing"}
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isSender ? `To: ${otherName}` : `From: ${otherName}`}
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
        {!isSender && inquiry.status === "pending" && (
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

  const startNewConversation = (profile: Profile) => {
    setSelectedUser(profile);
    setNewConvoOpen(false);
    setNewConvoSearch("");
    setActiveTab("messages");
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
            <MessageSquare className="h-3.5 w-3.5" /> DMs
          </TabsTrigger>
          <TabsTrigger value="circles" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Circles
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
            {/* Sidebar - Conversations only */}
            <div className={cn(
              "flex flex-col border-r border-border",
              selectedUser ? "hidden md:flex md:w-80" : "w-full md:w-80"
            )}>
              <div className="p-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." className="pl-9" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full gap-1.5 text-xs"
                  onClick={() => setNewConvoOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Start a Conversation
                </Button>
              </div>
              <ScrollArea className="flex-1">
                {contactsList.length === 0 ? (
                  <div className="p-6 text-center space-y-2">
                    <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      {search ? "No conversations match your search" : "No conversations yet"}
                    </p>
                    {!search && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full gap-1.5 text-xs"
                        onClick={() => setNewConvoOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Start a Conversation
                      </Button>
                    )}
                  </div>
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
              <BuddyList onSelectUser={setSelectedUser} selectedUserId={selectedUser?.user_id} />
            </div>

            {/* Chat Area */}
            <div className={cn("flex flex-1 flex-col", !selectedUser ? "hidden md:flex" : "flex")}>
              {!selectedUser ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground px-4">
                  <MessageSquare className="mb-4 h-12 w-12" />
                  <p className="text-lg font-medium">Select a conversation</p>
                  <p className="text-sm">Choose from your conversations or start a new one</p>
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
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        onClick={() => toast.info("Voice calls coming soon — tied to your Creator Pass tier")}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        onClick={() => toast.info("Video calls coming soon — tied to your Creator Pass tier")}
                      >
                        <Video className="h-4 w-4" />
                      </Button>
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
                              <RichMessageCard content={msg.content} isMine={isMine} timestamp={msg.created_at} formatTime={formatTime} messageId={msg.id} senderId={msg.sender_id} />
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
                      onSendQuote={() => setQuoteOpen(true)}
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

          {selectedUser && (
            <QuoteBuilder
              recipientId={selectedUser.user_id}
              recipientName={selectedUser.display_name || "Creator"}
              open={quoteOpen}
              onOpenChange={setQuoteOpen}
            />
          )}
        </TabsContent>

        <TabsContent value="circles" className="mt-4">
          <CirclesTab />
        </TabsContent>

        <TabsContent value="inquiries" className="mt-4 space-y-3">
          {!allInquiries?.length ? (
            <div className="text-center py-16">
              <Inbox className="h-10 w-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mt-3">No inquiries yet</p>
            </div>
          ) : (
            allInquiries.map((i) => renderInquiry(i))
          )}
        </TabsContent>
      </Tabs>

      {/* New Conversation Dialog */}
      <Dialog open={newConvoOpen} onOpenChange={setNewConvoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Start a Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={newConvoSearch}
                onChange={(e) => setNewConvoSearch(e.target.value)}
                placeholder="Search by name or handle..."
                className="pl-9"
                autoFocus
              />
            </div>
            <ScrollArea className="max-h-64">
              {newConvoSearch.trim() && searchResults?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No users found</p>
              )}
              {searchResults?.map((profile) => (
                <button
                  key={profile.user_id}
                  onClick={() => startNewConversation(profile)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted/60 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground">{profile.display_name || "Creator"}</span>
                </button>
              ))}
              {!newConvoSearch.trim() && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Type a name to find someone to message
                </p>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

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

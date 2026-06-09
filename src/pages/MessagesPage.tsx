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
  DollarSign, Video, Phone, Plus, Users, Store, Flame, CalendarDays,
  UserPlus, Compass,
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
import BuddyNotesRow from "@/components/notes/BuddyNotesRow";
import GuestMessagesPreview from "@/components/guest/GuestMessagesPreview";
import ProjectsInbox from "@/components/messages/ProjectsInbox";
import FollowingPickerDialog from "@/components/messages/FollowingPickerDialog";
import PostMenuButton from "@/components/PostMenuButton";

import InquiryThreadBanner from "@/components/messages/InquiryThreadBanner";
import { useSubscriberRelationships } from "@/hooks/useSubscriberRelationships";
import { Sparkles } from "lucide-react";

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

  if (!user) {
    return <GuestMessagesPreview />;
  }

  return <AuthenticatedMessagesPage user={user} />;
};

const AuthenticatedMessagesPage = ({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const [newConvoSearch, setNewConvoSearch] = useState("");
  const [followingOpen, setFollowingOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inquiryHandled = useRef(false);
  const [activeInquiryId, setActiveInquiryId] = useState<string | null>(null);
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread" | "subscribers" | "subscribed">("all");


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

  // Subscription relationship per partner (for inbox badge).
  const { data: subRelMap } = useSubscriberRelationships(conversationPartnerIds);

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
    const inquiryParam = searchParams.get("inquiry");
    if (!toUserId) return;

    if (inquiryParam) setActiveInquiryId(inquiryParam);

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
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Deterministic HSL color from name (letter avatar background).
  const colorFromName = (name: string | null | undefined) => {
    const s = name || "?";
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360} 55% 45%)`;
  };
  const initialOf = (name: string | null | undefined) =>
    (name || "?").trim().charAt(0).toUpperCase() || "?";


  // === INQUIRIES DATA ===
  const navigate = useNavigate();
  const [convertDialog, setConvertDialog] = useState<any>(null);
  const [totalCredits, setTotalCredits] = useState("");

  const rawTab = searchParams.get("tab");
  // Events + Flow moved to Discover. Listings folded into Projects.
  useEffect(() => {
    if (rawTab === "events") navigate("/discover?view=events", { replace: true });
    else if (rawTab === "flow") navigate("/flow", { replace: true });
    else if (rawTab === "listings") {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "projects");
      setSearchParams(next, { replace: true });
    }
  }, [rawTab, navigate, searchParams, setSearchParams]);
  const activeTab =
    rawTab === "inquiries" || !rawTab || rawTab === "events" || rawTab === "flow" || rawTab === "listings"
      ? rawTab === "listings" ? "projects" : "messages"
      : rawTab;
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
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={`${statusMeta.color} border-0 gap-1 text-xs`}>
                <StatusIcon className="h-3 w-3" />
                {statusMeta.label}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {isSender ? "Sent" : "Received"}
              </Badge>
              <span className="text-xs text-muted-foreground">{format(new Date(inquiry.created_at), "MMM d, yyyy")}</span>
            </div>
            <Link
              to={`/profiles/${otherUserId}`}
              className="text-xs text-foreground/80 hover:text-primary"
            >
              {isSender ? `To: ${otherName}` : `From: ${otherName}`}
            </Link>
            <Link to={`/creators/${inquiry.listing_id}`} className="block font-semibold text-foreground hover:text-primary transition-colors text-sm mt-0.5">
              {listing?.title ?? "Listing"}
            </Link>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            #{inquiry.id.slice(0, 6)}
          </Badge>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-foreground whitespace-pre-wrap">{inquiry.message}</p>
        </div>

        {/* Thread actions — every inquiry is its own dedicated thread.
            "Open chat" carries the inquiry context into the DM banner;
            "View project" appears once the inquiry has been converted. */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            onClick={() => {
              setActiveTab("messages");
              setActiveInquiryId(inquiry.id);
              navigate(`/messages?to=${otherUserId}&inquiry=${inquiry.id}`);
            }}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Open chat
          </Button>
          {inquiry.project_id && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full"
            >
              <Link to={`/projects/${inquiry.project_id}`}>
                <FolderKanban className="h-3.5 w-3.5" /> View project
              </Link>
            </Button>
          )}
          {!isSender && inquiry.status === "pending" && !inquiry.project_id && (
            <>
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
            </>
          )}
        </div>
      </div>
    );
  };

  const startNewConversation = (profile: Profile) => {
    setSelectedUser(profile);
    setNewConvoOpen(false);
    setNewConvoSearch("");
    setActiveTab("messages");
  };

  // Header subline counters
  const unreadConvoCount = (() => {
    if (!conversations) return 0;
    let n = 0;
    for (const msg of conversations.values()) {
      if (msg.receiver_id === user?.id && !msg.read) n += 1;
    }
    return n;
  })();

  return (
    <div className="w-full">
      <div className="w-full min-w-0 space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Inbox</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {unreadConvoCount} unread {unreadConvoCount === 1 ? "message" : "messages"}
            {" · "}
            {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}
            {" · "}
            {contactsList.length} {contactsList.length === 1 ? "conversation" : "conversations"}
          </p>
        </div>
      </div>


      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="messages" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Messages
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" /> Projects
            {pendingCount > 0 && (
              <span className="ml-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          {activeTab === "groups" && (
            <TabsTrigger value="groups" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Groups
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="messages" className="mt-4 space-y-4">
          <div className="flex h-[calc(100vh-22rem)] min-h-[520px] overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_24px_60px_-32px_hsl(var(--foreground)/0.18)]">
            {/* Conversation list */}
            <div className={cn(
              "flex flex-col border-r border-border/60 bg-background/40",
              selectedUser ? "hidden md:flex md:w-[340px]" : "w-full md:w-[340px]"
            )}>
              {/* Title strip */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-lg font-semibold text-foreground tracking-tight">All inbox</h2>
                  <button
                    onClick={() => setNewConvoOpen(true)}
                    className="text-[11px] text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> New
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {unreadConvoCount > 0
                    ? `${unreadConvoCount} unread · ${contactsList.length} total`
                    : `${contactsList.length} ${contactsList.length === 1 ? "thread" : "threads"}`}
                </p>
              </div>

              {/* Search */}
              <div className="px-4 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search inbox..."
                    className="pl-9 h-9 rounded-full bg-muted/40 border-border/50 text-xs"
                  />
                </div>
              </div>

              {/* Filter pills */}
              <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
                {[
                  { id: "all", label: "All" },
                  { id: "unread", label: "Unread", badge: unreadConvoCount || undefined },
                  { id: "subscribers", label: "Subscribers" },
                  { id: "subscribed", label: "Subscribed" },
                ].map((f) => {
                  const active = inboxFilter === (f.id as any);
                  return (
                    <button
                      key={f.id}
                      onClick={() => setInboxFilter(f.id as any)}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-3 py-1 rounded-full border transition-colors whitespace-nowrap",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border/60 hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      {f.label}
                      {f.badge ? (
                        <span className={cn(
                          "ml-0.5 text-[9px] font-bold px-1 rounded-full",
                          active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-foreground/10 text-foreground"
                        )}>{f.badge}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <BuddyNotesRow onSelectBuddy={setSelectedUser} />

              <ScrollArea className="flex-1">
                {(() => {
                  // Apply filter
                  const filtered = contactsList.filter((p) => {
                    const unread = getUnreadCount(p.user_id) > 0;
                    const rel = subRelMap?.get(p.user_id);
                    if (inboxFilter === "unread") return unread;
                    if (inboxFilter === "subscribers") return rel === "subscriber";
                    if (inboxFilter === "subscribed") return rel === "subscribed";
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center space-y-2">
                        <MessageSquare className="h-7 w-7 mx-auto text-muted-foreground/30" />
                        <p className="text-xs text-muted-foreground">
                          {search || inboxFilter !== "all" ? "Nothing matches that filter" : "No conversations yet"}
                        </p>
                        {!search && inboxFilter === "all" && (
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
                    );
                  }

                  // Group: Needs action (unread) vs Conversations
                  const needsAction = filtered.filter((p) => getUnreadCount(p.user_id) > 0);
                  const others = filtered.filter((p) => getUnreadCount(p.user_id) === 0);

                  const renderRow = (profile: Profile) => {
                    const lastMsg = getLastMessage(profile.user_id);
                    const unread = getUnreadCount(profile.user_id);
                    const name = profile.display_name || "Creator";
                    const rel = subRelMap?.get(profile.user_id);
                    const richLabel = (c: string): string | null => {
                      if (!c) return null;
                      if (c.startsWith("[FILE:")) return "📎 Attachment";
                      if (c.startsWith("[SMARTBOARD:")) return "🗂 Smartboard";
                      if (c.startsWith("[PROFILE:")) return "👤 Creator card";
                      if (c.startsWith("[LISTING:")) return "🛍 Listing";
                      if (c.startsWith("[LINK:")) return "🔗 Link";
                      if (c.startsWith("[EVENT:")) return "📅 Event";
                      if (c.startsWith("[FLOW:") || c.startsWith('{"type":"flow_share"')) return "✨ Shared from Flow";
                      if (c.startsWith("[STAFF_INVITE:")) return "👥 Staff invitation";
                      return null;
                    };
                    const friendly = lastMsg ? (richLabel(lastMsg.content) ?? lastMsg.content) : "";
                    const rawPreview = lastMsg
                      ? `${lastMsg.sender_id === user?.id ? "You: " : ""}${friendly}`
                      : "";
                    const isActive = selectedUser?.user_id === profile.user_id;
                    return (
                      <button
                        key={profile.user_id}
                        onClick={() => setSelectedUser(profile)}
                        className={cn(
                          "relative flex w-full items-start gap-3 px-4 py-3 text-left border-b border-border/40 transition-colors hover:bg-muted/40",
                          isActive && "bg-muted/60"
                        )}
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden text-white text-[11px] font-semibold"
                          style={{ backgroundColor: profile.avatar_url ? undefined : colorFromName(name) }}
                        >
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                          ) : (
                            <span>{initialOf(name)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn(
                              "text-[13px] text-foreground truncate",
                              unread > 0 ? "font-semibold" : "font-medium"
                            )}>{name}</span>
                            {rel && (
                              <span
                                className={cn(
                                  "shrink-0 rounded-md px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
                                  rel === "subscriber"
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
                                )}
                              >
                                {rel === "subscriber" ? "Sub" : "Subbed"}
                              </span>
                            )}
                          </div>
                          {rawPreview && (
                            <p className={cn(
                              "text-[11px] truncate mt-0.5",
                              unread > 0 ? "text-foreground/80" : "text-muted-foreground"
                            )} title={rawPreview}>
                              {rawPreview}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {lastMsg && (
                            <span className="text-[10px] text-muted-foreground/80">{formatTime(lastMsg.created_at)}</span>
                          )}
                          {unread > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="unread" />}
                        </div>
                      </button>
                    );
                  };

                  return (
                    <>
                      {needsAction.length > 0 && (
                        <>
                          <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                            Needs action
                          </div>
                          {needsAction.map(renderRow)}
                        </>
                      )}
                      {others.length > 0 && (
                        <>
                          <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                            Conversations
                          </div>
                          {others.map(renderRow)}
                        </>
                      )}
                    </>
                  );
                })()}
              </ScrollArea>
            </div>

            {/* Chat Area */}
            <div className={cn("flex flex-1 flex-col bg-background", !selectedUser ? "hidden md:flex" : "flex")}>
              {!selectedUser ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
                  <p className="font-display text-base font-semibold text-foreground mb-1">
                    Nothing open yet
                  </p>
                  <p className="text-xs text-muted-foreground mb-6">
                    Start a conversation, or try one of these:
                  </p>
                  <div className="w-full max-w-sm space-y-2">
                    {[
                      {
                        icon: UserPlus,
                        title: "Message someone you follow",
                        desc: "Pick from people you follow",
                        onClick: () => setFollowingOpen(true),
                      },
                      {
                        icon: Inbox,
                        title: "Respond to a request",
                        desc: allInquiries?.length
                          ? `${allInquiries.length} waiting`
                          : "Check pending requests",
                        onClick: () => setActiveTab("projects"),
                      },
                      {
                        icon: Compass,
                        title: "Browse listings to find collabs",
                        desc: "Open Discover · Offerings",
                        onClick: () => navigate("/discover?view=offerings"),
                      },
                    ].map((s) => (
                      <button
                        key={s.title}
                        type="button"
                        onClick={s.onClick}
                        className="group w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card hover:border-foreground/30 hover:bg-muted/40 transition-all px-4 py-3 text-left"
                      >
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <s.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {s.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {s.desc}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 border-b border-border/60 px-5 md:px-6 py-4">
                    <Button variant="ghost" size="icon" className="md:hidden shrink-0 -ml-2" onClick={() => setSelectedUser(null)}>
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => navigate(`/profiles/${selectedUser.user_id}`)}
                      className="flex items-center gap-3 group min-w-0 hover:opacity-90 transition-opacity"
                      title="View profile"
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full overflow-hidden shrink-0 text-white text-sm font-semibold"
                        style={{ backgroundColor: selectedUser.avatar_url ? undefined : colorFromName(selectedUser.display_name || "Creator") }}
                      >
                        {selectedUser.avatar_url ? (
                          <img src={selectedUser.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          <span>{initialOf(selectedUser.display_name || "Creator")}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-[15px] font-semibold text-foreground truncate group-hover:underline underline-offset-4">
                          {selectedUser.display_name || "Creator"}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          {(() => {
                            const rel = subRelMap?.get(selectedUser.user_id);
                            if (rel === "subscriber") return <><Sparkles className="h-2.5 w-2.5 text-emerald-500" /> One of your subscribers</>;
                            if (rel === "subscribed") return <><Sparkles className="h-2.5 w-2.5 text-fuchsia-500" /> You're subscribed</>;
                            return <>Direct message · tap to view profile</>;
                          })()}
                        </div>
                      </div>
                    </button>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/50"
                        onClick={() => toast.info("Voice calls coming soon — tied to your Creator Pass tier")}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/50"
                        onClick={() => toast.info("Video calls coming soon — tied to your Creator Pass tier")}
                      >
                        <Video className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {activeInquiryId && (
                    <InquiryThreadBanner
                      inquiryId={activeInquiryId}
                      onDismiss={() => setActiveInquiryId(null)}
                    />
                  )}

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
                    className="flex items-center gap-2 border-t border-border/60 px-4 md:px-6 py-3"
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
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={`Reply to ${selectedUser.display_name || "Creator"}…`}
                      className="flex-1 h-10 rounded-full bg-muted/40 border-border/50 text-sm px-4"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!messageText.trim() || sendMessage.isPending}
                      className="h-10 w-10 rounded-full shrink-0"
                    >
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


        <TabsContent value="projects" className="mt-4 space-y-6">
          <section className="surface-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Store className="h-4 w-4 text-primary" /> Interest inbox
                  {pendingCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Keep this simple: interest comes in here, then you turn the right fit into a project roadmap.
                </p>
              </div>
              <div className="shrink-0">
                <PostMenuButton
                  trigger={
                    <Button size="sm" className="rounded-full gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Post
                    </Button>
                  }
                />
              </div>
            </div>

            {!!allInquiries?.length ? (
              <div id="inquiries-section" className="space-y-3 scroll-mt-24">
                {allInquiries.map((i) => renderInquiry(i))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">No interest yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Post a listing, event, or space from Connect and the replies will land here.
                </p>
              </div>
            )}
          </section>

          {/* Active project threads — chat, roadmap, vault, splits. */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <FolderKanban className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Active projects</h2>
            </div>
            <ProjectsInbox userId={user.id} />
          </div>
        </TabsContent>

        {/* Events + Flow live on Discover now (toggles on the mosaic). */}

        <TabsContent value="groups" className="mt-4">
          <CirclesTab />
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

      {/* People you follow */}
      <FollowingPickerDialog
        open={followingOpen}
        onOpenChange={setFollowingOpen}
        userId={user.id}
        onPick={(profile) => {
          setSelectedUser(profile);
          setFollowingOpen(false);
        }}
      />

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
      
    </div>
  );
};

export default MessagesPage;

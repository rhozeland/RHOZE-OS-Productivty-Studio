/**
 * InboxDrawer (v10.5) — single header inbox that merges messages, pending
 * inquiries, AND notifications into one slide-out panel. Replaces the
 * standalone NotificationBell + the side-nav Conversations entry.
 *
 * Tabs: Messages (full MessagesPage compact) · Notifications.
 * The header has an "Expand" affordance that navigates to /messages so users
 * can blow the drawer out into the full Conversations page.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Maximize2, Bell, Check, Trash2, X, Inbox, ShoppingBag, Star, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import MessagesPage from "@/pages/MessagesPage";

const NOTIF_META: Record<string, { icon: any; color: string }> = {
  message: { icon: MessageSquare, color: "text-blue-500" },
  inquiry: { icon: Inbox, color: "text-amber-500" },
  purchase: { icon: ShoppingBag, color: "text-green-500" },
  review: { icon: Star, color: "text-purple-500" },
  general: { icon: Sparkles, color: "text-primary" },
};

const InboxDrawer = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"messages" | "notifications">("messages");

  // Unread messages + pending inquiries.
  const { data: msgCount = 0, refetch: refetchMsgs } = useQuery({
    queryKey: ["inbox-drawer-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const sb: any = supabase;
      const [msgs, inq] = await Promise.all([
        sb.from("messages").select("id", { count: "exact", head: true })
          .eq("recipient_id", user!.id).eq("read", false),
        sb.from("listing_inquiries").select("id", { count: "exact", head: true })
          .eq("receiver_id", user!.id).eq("status", "pending"),
      ]);
      return (msgs.count ?? 0) + (inq.count ?? 0);
    },
  });

  // Notifications (merged in from old NotificationBell).
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  const notifUnread = notifications.filter((n: any) => !n.read).length;
  const totalUnread = msgCount + notifUnread;

  // Realtime notifications.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("inbox-notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  useEffect(() => { if (!open) refetchMsgs(); }, [open, refetchMsgs]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications" as any).update({ read: true } as any).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });
  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications" as any).update({ read: true } as any)
        .eq("user_id", user!.id).eq("read", false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });
  const clearAll = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications" as any).delete().eq("user_id", user!.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const handleNotifClick = (n: any) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.link) { setOpen(false); navigate(n.link); }
  };

  const handleExpand = () => {
    setOpen(false);
    navigate("/messages");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className={cn("relative transition-opacity", totalUnread === 0 && "opacity-50 hover:opacity-100")}
        aria-label={totalUnread > 0 ? `${totalUnread} new updates` : "Inbox"}
      >
        <MessageSquare className="h-5 w-5" />
        {totalUnread > 0 && (
          <span
            className={cn(
              "absolute top-1 right-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50",
              totalUnread > 9 ? "h-4 min-w-4 px-1 text-[9px] font-bold" : "h-2 w-2",
            )}
          >
            {totalUnread > 9 ? (totalUnread > 99 ? "99+" : totalUnread) : ""}
          </span>
        )}
      </Button>

      <SheetContent side="right" className="w-full sm:max-w-[420px] p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-foreground tracking-tight">Inbox</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {msgCount} message{msgCount === 1 ? "" : "s"} · {notifUnread} new alert{notifUnread === 1 ? "" : "s"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpand}
            className="h-8 gap-1.5 text-xs rounded-full"
            aria-label="Open full conversations page"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Expand
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-3">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="messages" className="gap-1.5 text-xs">
                <MessageSquare className="h-3.5 w-3.5" /> Messages
                {msgCount > 0 && (
                  <span className="ml-1 rounded-full bg-foreground text-background text-[10px] font-bold px-1.5">
                    {msgCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-1.5 text-xs">
                <Bell className="h-3.5 w-3.5" /> Alerts
                {notifUnread > 0 && (
                  <span className="ml-1 rounded-full bg-foreground text-background text-[10px] font-bold px-1.5">
                    {notifUnread}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="messages" className="flex-1 overflow-y-auto mt-0 pb-4 [&_h1]:hidden [&>div>div>div:first-child]:hidden">
            <div className="px-2">
              <MessagesPage />
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="flex-1 flex flex-col min-h-0 mt-0">
            <div className="flex items-center justify-end gap-1 px-3 py-2 border-b border-border/60">
              {notifUnread > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => markAllRead.mutate()}>
                  <Check className="h-3 w-3" /> Read all
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 gap-1 text-destructive/70 hover:text-destructive"
                  onClick={() => clearAll.mutate()}
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No alerts yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((n: any) => {
                    const meta = NOTIF_META[n.type] || NOTIF_META.general;
                    const Icon = meta.icon;
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                          !n.read && "bg-primary/5",
                        )}
                      >
                        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted", meta.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm leading-snug", !n.read ? "font-medium text-foreground" : "text-muted-foreground")}>
                            {n.title}
                          </p>
                          {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            <p className="text-[10px] text-muted-foreground/50 text-center px-4 py-2 border-t border-border">
              Alerts auto-clear after 7 days
            </p>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default InboxDrawer;

/**
 * InboxDrawer — header-bar message bubble that slides the full Conversations
 * page in from the right. Mirrors the NotificationBell trigger styling so the
 * two icons look like a pair.
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import MessagesPage from "@/pages/MessagesPage";

const InboxDrawer = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Unread messages + pending inquiries — drives the dot badge.
  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ["inbox-drawer-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const sb: any = supabase;
      const [msgs, inq] = await Promise.all([
        sb
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", user!.id)
          .eq("read", false),
        sb
          .from("listing_inquiries")
          .select("id", { count: "exact", head: true })
          .eq("receiver_id", user!.id)
          .eq("status", "pending"),
      ]);
      return (msgs.count ?? 0) + (inq.count ?? 0);
    },
  });

  // Refresh badge when drawer closes (user likely read things).
  useEffect(() => {
    if (!open) refetch();
  }, [open, refetch]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className={cn("relative transition-opacity", unreadCount === 0 && "opacity-50 hover:opacity-100")}
        aria-label={unreadCount > 0 ? `${unreadCount} unread messages` : "Messages"}
      >
        <MessageSquare className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute top-1 right-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50",
              unreadCount > 9 ? "h-4 min-w-4 px-1 text-[9px] font-bold" : "h-2 w-2",
            )}
          >
            {unreadCount > 9 ? (unreadCount > 99 ? "99+" : unreadCount) : ""}
          </span>
        )}
      </Button>

      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] p-0 overflow-y-auto"
      >
        <div className="p-4 sm:p-6">
          <MessagesPage />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InboxDrawer;

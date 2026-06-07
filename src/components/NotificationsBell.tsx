import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  MessageSquare,
  Inbox,
  ShoppingBag,
  Star,
  Check,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Flag,
  Music4,
  Heart,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

/**
 * NotificationsBell (v11)
 * Hover/click popover that aggregates real updates across the app:
 *  - System notifications (notifications table)
 *  - Project progress (milestones on releases the user backs OR owns)
 *  - Creator activity (new works from creators the user has cheered/backed)
 *  - Chart movements (recent buys/sells on coins the user holds)
 */

type FeedItem = {
  id: string;
  source: "notification" | "milestone" | "work" | "swap";
  read: boolean;
  created_at: string;
  icon: any;
  iconColor: string;
  title: string;
  body?: string;
  link?: string;
  notifId?: string;
};

const SYSTEM_META: Record<string, { icon: any; color: string }> = {
  message: { icon: MessageSquare, color: "text-blue-500" },
  inquiry: { icon: Inbox, color: "text-amber-500" },
  purchase: { icon: ShoppingBag, color: "text-green-500" },
  review: { icon: Star, color: "text-purple-500" },
  general: { icon: Sparkles, color: "text-primary" },
};

const NotificationsBell = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // 1. System notifications
  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data as any[]) ?? [];
    },
    enabled: !!user,
  });

  // 2. Backed creators / projects (from project_cheers)
  const { data: cheers } = useQuery({
    queryKey: ["nb-cheers", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_cheers")
        .select("project_id, projects(id, name, owner_id, public_slug)")
        .eq("user_id", user!.id);
      return (data as any[]) ?? [];
    },
    enabled: !!user,
  });


  const backedProjectIds = useMemo(
    () => (cheers ?? []).map((c: any) => c.project_id),
    [cheers],
  );
  const backedCreatorIds = useMemo(
    () =>
      Array.from(
        new Set(
          (cheers ?? [])
            .map((c: any) => c.projects?.owner_id)
            .filter(Boolean),
        ),
      ),
    [cheers],
  );

  // 3. Milestone progress on backed/owned projects
  const { data: milestones } = useQuery({
    queryKey: ["nb-milestones", user?.id, backedProjectIds.length],
    queryFn: async () => {
      // Get contracts for backed projects + projects user owns
      const { data: ownedProjects } = await supabase
        .from("projects")
        .select("id, name, public_slug")
        .eq("owner_id", user!.id)
        .limit(50);
      const ownedIds = ((ownedProjects as any[]) ?? []).map((p) => p.id);
      const allProjectIds = Array.from(new Set([...backedProjectIds, ...ownedIds]));
      if (allProjectIds.length === 0) return [];

      const { data: contracts } = await supabase
        .from("project_contracts")
        .select("id, project_id")
        .in("project_id", allProjectIds);
      const contractRows = (contracts as any[]) ?? [];
      const contractIds = contractRows.map((c) => c.id);
      if (contractIds.length === 0) return [];

      const { data: projectRows } = await supabase
        .from("projects")
        .select("id, name, public_slug")
        .in("id", allProjectIds);
      const projectMap = new Map(
        ((projectRows as any[]) ?? []).map((p) => [p.id, p]),
      );

      const { data: ms } = await supabase
        .from("project_milestones")
        .select("id, title, status, contract_id, updated_at, approved_at")
        .in("contract_id", contractIds)
        .in("status", ["submitted", "approved", "in_progress"])
        .order("updated_at", { ascending: false })
        .limit(15);

      return ((ms as any[]) ?? []).map((m) => {
        const c = contractRows.find((x) => x.id === m.contract_id);
        return { ...m, project: c ? projectMap.get(c.project_id) : null };
      });

    },
    enabled: !!user,
  });

  // 4. Recent works from creators the user backs
  const { data: creatorWorks } = useQuery({
    queryKey: ["nb-works", user?.id, backedCreatorIds.length],
    queryFn: async () => {
      if (backedCreatorIds.length === 0) return [];
      const { data } = await supabase
        .from("works")
        .select("id, title, kind, user_id, created_at, profiles(display_name, username)")
        .in("user_id", backedCreatorIds)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data as any[]) ?? [];

    },
    enabled: !!user && backedCreatorIds.length > 0,
  });

  // 5. Chart movements on coins the user holds
  const { data: holdings } = useQuery({
    queryKey: ["nb-holdings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_holdings")
        .select("launch_id, balance")
        .eq("trader_id", user!.id)
        .gt("balance", 0);
      return (data as any[]) ?? [];
    },
    enabled: !!user,
  });

  const heldLaunchIds = useMemo(
    () => (holdings ?? []).map((h: any) => h.launch_id),
    [holdings],
  );

  const { data: swaps } = useQuery({
    queryKey: ["nb-swaps", user?.id, heldLaunchIds.length],
    queryFn: async () => {
      if (heldLaunchIds.length === 0) return [];
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("coin_swap_ledger")
        .select("id, side, launch_id, rhoze_amount, created_at, coin_launches(ticker, name)")
        .in("launch_id", heldLaunchIds)
        .gte("created_at", since)
        .neq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data as any[]) ?? [];

    },
    enabled: !!user && heldLaunchIds.length > 0,
  });

  // Aggregate into a single feed
  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];

    (notifications ?? []).forEach((n: any) => {
      const meta = SYSTEM_META[n.type] || SYSTEM_META.general;
      items.push({
        id: `n-${n.id}`,
        notifId: n.id,
        source: "notification",
        read: !!n.read,
        created_at: n.created_at,
        icon: meta.icon,
        iconColor: meta.color,
        title: n.title,
        body: n.body,
        link: n.link,
      });
    });

    (milestones ?? []).forEach((m: any) => {
      const verb =
        m.status === "approved"
          ? "approved"
          : m.status === "submitted"
            ? "submitted for review"
            : "in progress";
      items.push({
        id: `m-${m.id}`,
        source: "milestone",
        read: true,
        created_at: m.approved_at || m.updated_at,
        icon: Flag,
        iconColor: m.status === "approved" ? "text-emerald-500" : "text-amber-500",
        title: `Milestone ${verb}`,
        body: `${m.project?.name ?? "Release"} — ${m.title}`,
        link: m.project?.public_slug ? `/release/${m.project.public_slug}` : undefined,
      });
    });

    (creatorWorks ?? []).forEach((w: any) => {
      items.push({
        id: `w-${w.id}`,
        source: "work",
        read: true,
        created_at: w.created_at,
        icon: Music4,
        iconColor: "text-rose-500",
        title: `${w.profiles?.display_name ?? w.profiles?.username ?? "A creator"} dropped something new`,
        body: w.title,
        link: w.profiles?.username ? `/u/${w.profiles.username}` : undefined,
      });
    });

    (swaps ?? []).forEach((s: any) => {
      const isBuy = s.side === "buy";
      items.push({
        id: `s-${s.id}`,
        source: "swap",
        read: true,
        created_at: s.created_at,
        icon: isBuy ? TrendingUp : TrendingDown,
        iconColor: isBuy ? "text-emerald-500" : "text-rose-500",
        title: `$${s.coin_launches?.ticker ?? "COIN"} ${isBuy ? "buy" : "sell"} — ${Number(s.rhoze_amount).toFixed(2)} $RHOZE`,
        body: s.coin_launches?.name,
        link: `/discover?filter=coins`,
      });
    });

    return items.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [notifications, milestones, creatorWorks, swaps]);

  const unreadCount = useMemo(() => {
    const unreadSystem = feed.filter((f) => f.source === "notification" && !f.read).length;
    // Count recent (last 24h) activity items as "fresh"
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const freshActivity = feed.filter(
      (f) => f.source !== "notification" && new Date(f.created_at).getTime() > dayAgo,
    ).length;
    return unreadSystem + freshActivity;
  }, [feed]);

  // Realtime for notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notif-bell-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const markRead = useMutation({
    mutationFn: async (notifId: string) => {
      await supabase
        .from("notifications" as any)
        .update({ read: true } as any)
        .eq("id", notifId);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from("notifications" as any)
        .update({ read: true } as any)
        .eq("user_id", user!.id)
        .eq("read", false);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const handleClick = (item: FeedItem) => {
    if (item.source === "notification" && item.notifId && !item.read) {
      markRead.mutate(item.notifId);
    }
    if (item.link) navigate(item.link);
    setOpen(false);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="relative"
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "relative transition-opacity",
              unreadCount === 0 && "opacity-60 hover:opacity-100",
            )}
            aria-label={
              unreadCount > 0
                ? `${unreadCount} new notifications`
                : "Notifications"
            }
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                className={cn(
                  "absolute top-1 right-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground",
                  unreadCount > 9
                    ? "h-4 min-w-4 px-1 text-[9px] font-bold"
                    : "h-2 w-2",
                )}
              >
                {unreadCount > 9 ? (unreadCount > 99 ? "99+" : unreadCount) : ""}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-96 p-0"
          align="end"
          sideOffset={8}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                Notifications
              </h3>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                Updates from the artists and projects you back
              </p>
            </div>
            {(notifications ?? []).some((n: any) => !n.read) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 gap-1"
                onClick={() => markAllRead.mutate()}
              >
                <Check className="h-3 w-3" /> Read all
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-[28rem]">
            {feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-6 text-muted-foreground text-center">
                <Heart className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No updates yet</p>
                <p className="text-xs mt-1 opacity-70">
                  Back a creator or release to start seeing activity here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {feed.slice(0, 30).map((item) => {
                  const Icon = item.icon;
                  const isUnread = item.source === "notification" && !item.read;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleClick(item)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                        isUnread && "bg-primary/5",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted",
                          item.iconColor,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            isUnread
                              ? "font-medium text-foreground"
                              : "text-foreground/90",
                          )}
                        >
                          {item.title}
                        </p>
                        {item.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {item.body}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {isUnread && (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </div>
    </Popover>
  );
};

export default NotificationsBell;

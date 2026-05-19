/**
 * MyWorkPage — command center pulling together Projects, Inquiries, and Saved.
 *
 * URL contract:
 *   /my-work                  → defaults to whichever tab has urgent activity
 *   /my-work?tab=projects     → Projects tab (uses ProjectsInbox)
 *   /my-work?tab=inquiries    → Inquiries tab
 *   /my-work?tab=saved        → Saved tab
 */
import { useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, Bookmark, FolderKanban, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import ProjectsInbox from "@/components/messages/ProjectsInbox";
import GuestMessagesPreview from "@/components/guest/GuestMessagesPreview";
import { useSavedItems } from "@/hooks/useSavedItems";
import SaveButton from "@/components/saved/SaveButton";

type Profile = { user_id: string; display_name: string | null; avatar_url: string | null };

const colorFromName = (name: string | null | undefined) => {
  const s = name || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 45%)`;
};
const initialOf = (name: string | null | undefined) =>
  (name || "?").trim().charAt(0).toUpperCase() || "?";

const Avatar = ({ name, url }: { name: string; url: string | null }) => (
  <div
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden text-white text-sm font-semibold"
    style={{ backgroundColor: url ? undefined : colorFromName(name) }}
  >
    {url ? (
      <img src={url} alt="" className="h-full w-full rounded-full object-cover" />
    ) : (
      <span>{initialOf(name)}</span>
    )}
  </div>
);

const EmptyState = ({
  title,
  ctaLabel,
  ctaTo,
  icon: Icon,
}: {
  title: string;
  ctaLabel: string;
  ctaTo: string;
  icon: any;
}) => (
  <div className="surface-card flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
      <Icon className="h-6 w-6 text-primary" />
    </div>
    <p className="text-sm text-muted-foreground max-w-sm">{title}</p>
    <Button asChild size="sm" className="rounded-full">
      <Link to={ctaTo}>{ctaLabel}</Link>
    </Button>
  </div>
);

const MyWorkPage = () => {
  const { user } = useAuth();
  if (!user) return <GuestMessagesPreview />;
  return <AuthedMyWorkPage userId={user.id} />;
};

const AuthedMyWorkPage = ({ userId }: { userId: string }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // === Projects count (active = not completed/cancelled) ===
  const sb: any = supabase;
  const { data: projects } = useQuery({
    queryKey: ["my-work-projects", userId],
    queryFn: async (): Promise<Array<{ id: string; status: string | null }>> => {
      const ownerRes: any = await sb
        .from("projects")
        .select("id,status")
        .eq("owner_id", userId);
      const collabRes: any = await sb
        .from("project_collaborators")
        .select("project_id")
        .eq("user_id", userId);
      if (ownerRes.error) throw ownerRes.error;
      const collabIds = (collabRes.data ?? []).map((r: any) => r.project_id);
      let collabProjects: any[] = [];
      if (collabIds.length) {
        const r: any = await sb.from("projects").select("id,status").in("id", collabIds);
        collabProjects = r.data ?? [];
      }
      const all = [...(ownerRes.data ?? []), ...collabProjects];
      const seen = new Set<string>();
      return all.filter((p: any) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
    },
  });
  const activeProjectsCount = (projects ?? []).filter(
    (p: any) => !["completed", "cancelled", "archived"].includes(p.status ?? ""),
  ).length;

  // === Inquiries ===
  const { data: inquiries } = useQuery({
    queryKey: ["my-work-inquiries", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_inquiries")
        .select("*")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const listingIds = useMemo(
    () => [...new Set((inquiries ?? []).map((i: any) => i.listing_id))],
    [inquiries],
  );
  const { data: listings } = useQuery({
    queryKey: ["my-work-inquiry-listings", listingIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id, title")
        .in("id", listingIds as string[]);
      if (error) throw error;
      return data ?? [];
    },
    enabled: listingIds.length > 0,
  });
  const listingsMap = new Map((listings ?? []).map((l: any) => [l.id, l]));

  const partnerIds = useMemo(
    () => [
      ...new Set(
        (inquiries ?? [])
          .flatMap((i: any) => [i.sender_id, i.receiver_id])
          .filter((id: string) => id !== userId),
      ),
    ],
    [inquiries, userId],
  );
  const { data: partnerProfiles } = useQuery({
    queryKey: ["my-work-inquiry-profiles", partnerIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profiles_by_ids", {
        _ids: partnerIds as string[],
      });
      if (error) throw error;
      return (data as Profile[]) ?? [];
    },
    enabled: partnerIds.length > 0,
  });
  const profilesMap = new Map((partnerProfiles ?? []).map((p) => [p.user_id, p]));

  const unreadInquiries = (inquiries ?? []).filter(
    (i: any) => i.receiver_id === userId && i.status === "pending",
  );
  const unreadInquiryCount = unreadInquiries.length;

  // === Default tab routing ===
  const rawTab = searchParams.get("tab");
  const defaultTab = unreadInquiryCount > 0 ? "inquiries" : "projects";
  const activeTab =
    rawTab === "projects" || rawTab === "inquiries" || rawTab === "saved"
      ? rawTab
      : defaultTab;

  useEffect(() => {
    if (!rawTab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", defaultTab);
      setSearchParams(next, { replace: true });
    }
  }, [rawTab, defaultTab, searchParams, setSearchParams]);

  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  // === Saved — not yet implemented, always empty for now ===
  const savedItems: any[] = [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">My Work</h1>
        <p className="text-muted-foreground">
          {activeProjectsCount} active {activeProjectsCount === 1 ? "project" : "projects"}
          {" · "}
          {unreadInquiryCount} {unreadInquiryCount === 1 ? "inquiry" : "inquiries"} waiting
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="projects" className="gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" /> Projects
          </TabsTrigger>
          <TabsTrigger value="inquiries" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" /> Inquiries
            {unreadInquiryCount > 0 && (
              <span className="ml-1 h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {unreadInquiryCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-1.5">
            <Bookmark className="h-3.5 w-3.5" /> Saved
          </TabsTrigger>
        </TabsList>

        {/* ── PROJECTS ── */}
        <TabsContent value="projects" className="mt-4">
          {activeProjectsCount === 0 && (projects?.length ?? 0) === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No active projects yet. Find someone on Discover to get started."
              ctaLabel="Go to Discover"
              ctaTo="/discover"
            />
          ) : (
            <ProjectsInbox userId={userId} />
          )}
        </TabsContent>

        {/* ── INQUIRIES ── */}
        <TabsContent value="inquiries" className="mt-4">
          {(inquiries?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No inquiries yet. Post a listing to start receiving them."
              ctaLabel="Post Now"
              ctaTo="/discover?view=offerings"
            />
          ) : (
            <ScrollArea className="max-h-[calc(100vh-18rem)]">
              <div className="space-y-2">
                {(inquiries ?? []).map((inq: any) => {
                  const isSender = inq.sender_id === userId;
                  const otherId = isSender ? inq.receiver_id : inq.sender_id;
                  const other = profilesMap.get(otherId);
                  const listing = listingsMap.get(inq.listing_id);
                  const isUnread = !isSender && inq.status === "pending";
                  const name = other?.display_name || (isSender ? "Seller" : "Someone");
                  return (
                    <div
                      key={inq.id}
                      className={cn(
                        "surface-card flex items-center gap-4 px-4 py-3 rounded-2xl transition-shadow hover:shadow-md",
                        isUnread && "border-l-4 border-l-primary",
                      )}
                    >
                      <Avatar name={name} url={other?.avatar_url ?? null} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {name}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {isSender ? "Sent" : "Received"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {listing?.title ?? "Listing"} ·{" "}
                          {format(new Date(inq.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full shrink-0 gap-1"
                        onClick={() =>
                          navigate(`/messages?to=${otherId}&inquiry=${inq.id}`)
                        }
                      >
                        Respond <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* ── SAVED ── */}
        <TabsContent value="saved" className="mt-4">
          {savedItems.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="Nothing saved yet. Browse Discover and tap the save icon on any creator."
              ctaLabel="Go to Discover"
              ctaTo="/discover"
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyWorkPage;

/**
 * ConversationsRightRail — discovery panel pinned to the right of the
 * Conversations page on lg+ screens. Three tabs: Events · Spaces · Artists.
 *
 * Each tab shows a compact, scrollable list of upcoming/relevant entities.
 * Clicking any card deep-links to its detail page so users can flip between
 * messaging and discovery without leaving the page.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  Building2,
  Sparkles,
  ArrowRight,
  Globe2,
  MapPin,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import { useEventsCta } from "@/hooks/useEventsCta";

type Tab = "events" | "spaces" | "artists";

const ConversationsRightRail = () => {
  const [tab, setTab] = useState<Tab>("events");

  const { data: events = [] } = useQuery({
    queryKey: ["right-rail-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, cover_url, starts_at, venue_name, is_online, category")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(20);
      return data ?? [];
    },
    enabled: tab === "events",
  });

  const { data: spaces = [] } = useQuery({
    queryKey: ["right-rail-spaces"],
    queryFn: async () => {
      const { data } = await supabase
        .from("studios")
        .select("id, name, cover_image_url, city, state, hourly_rate")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: tab === "spaces",
  });

  const { data: artists = [] } = useQuery({
    queryKey: ["right-rail-artists"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, headline, verification_status")
        .eq("verification_status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: tab === "artists",
  });

  return (
    <aside className="hidden xl:flex flex-col surface-card w-80 shrink-0 self-start sticky top-24 max-h-[calc(100vh-7rem)]">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold tracking-tight">Discover</h3>
        <Link
          to={
            tab === "events"
              ? "/discover?view=events"
              : tab === "spaces"
                ? "/discover?kind=space"
                : "/discover"
          }
          className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="px-3 pb-2 flex gap-1">
        {(
          [
            { id: "events", label: "Events", icon: CalendarDays },
            { id: "spaces", label: "Spaces", icon: Building2 },
            { id: "artists", label: "Artists", icon: Sparkles },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      <ScrollArea className="flex-1 px-3 pb-3">
        <div className="space-y-2">
          {tab === "events" && events.length === 0 && (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming events"
              cta={{ label: "Host one", to: "/spaces/events/new" }}
              size="sm"
            />
          )}
          {tab === "events" &&
            events.map((e: any) => (
              <Link
                key={e.id}
                to={`/spaces/events/${e.id}`}
                className="group flex gap-3 rounded-xl border border-border bg-card/60 p-2 hover:bg-muted/40 transition-colors"
              >
                <div className="h-14 w-14 shrink-0 rounded-lg bg-muted overflow-hidden">
                  {e.cover_url ? (
                    <img
                      src={e.cover_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center">
                      <CalendarDays className="h-5 w-5 text-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(new Date(e.starts_at), "EEE, MMM d · h:mm a")}
                  </p>
                  <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug mt-0.5">
                    {e.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                    {e.is_online ? (
                      <>
                        <Globe2 className="h-2.5 w-2.5" /> Online
                      </>
                    ) : e.venue_name ? (
                      <>
                        <MapPin className="h-2.5 w-2.5" />
                        <span className="truncate">{e.venue_name}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </Link>
            ))}

          {tab === "spaces" && spaces.length === 0 && (
            <EmptyState
              icon={Building2}
              title="No spaces listed yet"
              cta={{ label: "List a space", to: "/studios/new" }}
              size="sm"
            />
          )}
          {tab === "spaces" &&
            spaces.map((s: any) => (
              <Link
                key={s.id}
                to={`/studios/${s.id}`}
                className="group flex gap-3 rounded-xl border border-border bg-card/60 p-2 hover:bg-muted/40 transition-colors"
              >
                <div className="h-14 w-14 shrink-0 rounded-lg bg-muted overflow-hidden">
                  {s.cover_image_url ? (
                    <img src={s.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
                    {s.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {[s.city, s.state].filter(Boolean).join(" · ")}
                  </p>
                  {s.hourly_rate ? (
                    <p className="text-[10px] text-foreground/70 mt-0.5">
                      ${s.hourly_rate} / hr
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}

          {tab === "artists" && artists.length === 0 && (
            <EmptyState
              icon={Users}
              title="No verified artists yet"
              cta={{ label: "Apply to verify", to: "/verification" }}
              size="sm"
            />
          )}
          {tab === "artists" &&
            artists.map((a: any) => (
              <Link
                key={a.user_id}
                to={`/profiles/${a.user_id}`}
                className="group flex gap-3 rounded-xl border border-border bg-card/60 p-2 hover:bg-muted/40 transition-colors items-center"
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-muted overflow-hidden">
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-foreground/60">
                      {(a.display_name ?? a.username ?? "?")[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {a.display_name ?? a.username ?? "Creator"}
                  </p>
                  {a.headline && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {a.headline}
                    </p>
                  )}
                </div>
              </Link>
            ))}
        </div>
      </ScrollArea>
    </aside>
  );
};

// Local EmptyState replaced with the shared `<EmptyState />` component.

export default ConversationsRightRail;

/**
 * useConnectRows — shared data hooks for the Connect room.
 *
 * Returns normalized `ConnectRow` records for each filter:
 *   • hire   → marketplace_listings (services)
 *   • space  → studios
 *   • call   → marketplace_listings (project_request / collaboration)
 *   • event  → upcoming published events
 *
 * Also exposes `useMixedConnectRows()` which interleaves all four kinds for
 * the Match-Mode swipeable deck.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Building2, Briefcase, CalendarDays, type LucideIcon } from "lucide-react";

export type ConnectKind = "hire" | "space" | "call" | "event";

export interface ConnectRow {
  id: string;
  kind: ConnectKind;
  title: string;
  subtitle?: string | null;
  priceLabel?: string | null;
  metaLabel?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  ownerAvatar?: string | null;
  category?: string | null;
  description?: string | null;
  detailHref: string;
  coverUrl?: string | null;
  isPro?: boolean;
}

export const KIND_META: Record<
  ConnectKind,
  { label: string; desc: string; Icon: LucideIcon }
> = {
  hire: { label: "Hire Creators", desc: "Book talent · creator services", Icon: Users },
  space: { label: "Spaces", desc: "Studios & venues hosted by creators", Icon: Building2 },
  call: { label: "Open Calls", desc: "Gigs, jobs & briefs", Icon: Briefcase },
  event: { label: "Events", desc: "Upcoming shows & gatherings", Icon: CalendarDays },
};

const fetchProfiles = async (ids: (string | null | undefined)[]) => {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (unique.length === 0) return new Map<string, any>();
  const { data } = await supabase
    .from("profiles")
    .select("user_id,display_name,username,avatar_url,verified_pro_at")
    .in("user_id", unique);
  return new Map((data ?? []).map((p: any) => [p.user_id, p]));
};

export const useHireRows = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["connect", "hire"],
    queryFn: async (): Promise<ConnectRow[]> => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id,title,description,category,price,currency,credits_price,delivery_days,cover_url,user_id,listing_type")
        .eq("is_active", true)
        .eq("listing_type", "service")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const profs = await fetchProfiles((data ?? []).map((d) => d.user_id));
      return (data ?? []).map((l: any) => {
        const p = profs.get(l.user_id);
        const price =
          l.price != null
            ? `${l.currency || "USD"} ${Number(l.price).toLocaleString()}`
            : l.credits_price != null
              ? `${Number(l.credits_price).toLocaleString()} $RHOZE`
              : null;
        return {
          id: l.id,
          kind: "hire" as const,
          title: l.title,
          subtitle: p?.display_name || p?.username || "Creator",
          priceLabel: price,
          metaLabel: l.delivery_days ? `${l.delivery_days}d delivery` : null,
          ownerId: l.user_id,
          ownerName: p?.display_name || p?.username || null,
          ownerAvatar: p?.avatar_url || null,
          isPro: !!p?.verified_pro_at,
          category: l.category,
          description: l.description,
          detailHref: `/marketplace/${l.id}`,
          coverUrl: l.cover_url,
        };
      });
    },
  });

export const useSpaceRows = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["connect", "space"],
    queryFn: async (): Promise<ConnectRow[]> => {
      const { data, error } = await supabase
        .from("studios")
        .select("id,name,short_description,city,country,category,hourly_rate,cover_image_url,owner_id")
        .eq("is_active", true)
        .eq("status", "approved")
        .order("rating_avg", { ascending: false })
        .limit(60);
      if (error) throw error;
      const profs = await fetchProfiles((data ?? []).map((d: any) => d.owner_id));
      return (data ?? []).map((s: any) => {
        const p = profs.get(s.owner_id);
        return {
          id: s.id,
          kind: "space" as const,
          title: s.name,
          subtitle: [s.city, s.country].filter(Boolean).join(", ") || "Location TBA",
          priceLabel: s.hourly_rate ? `$${s.hourly_rate}/hr` : null,
          metaLabel: s.category,
          ownerId: s.owner_id,
          ownerName: p?.display_name || p?.username || null,
          ownerAvatar: p?.avatar_url || null,
          isPro: !!p?.verified_pro_at,
          category: s.category,
          description: s.short_description,
          detailHref: `/studios/${s.id}`,
          coverUrl: s.cover_image_url,
        };
      });
    },
  });

export const useCallRows = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["connect", "call"],
    queryFn: async (): Promise<ConnectRow[]> => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id,title,description,category,price,currency,credits_price,delivery_days,cover_url,user_id,listing_type")
        .eq("is_active", true)
        .in("listing_type", ["project_request", "collaboration"])
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const profs = await fetchProfiles((data ?? []).map((d) => d.user_id));
      return (data ?? []).map((l: any) => {
        const p = profs.get(l.user_id);
        const price =
          l.price != null
            ? `Budget ${l.currency || "USD"} ${Number(l.price).toLocaleString()}`
            : null;
        return {
          id: l.id,
          kind: "call" as const,
          title: l.title,
          subtitle: p?.display_name || p?.username || "Creator",
          priceLabel: price,
          metaLabel:
            l.listing_type === "collaboration"
              ? "Collab"
              : l.delivery_days
                ? `${l.delivery_days}d deadline`
                : "Open call",
          ownerId: l.user_id,
          ownerName: p?.display_name || p?.username || null,
          ownerAvatar: p?.avatar_url || null,
          isPro: !!p?.verified_pro_at,
          category: l.category,
          description: l.description,
          detailHref: `/marketplace/${l.id}`,
          coverUrl: l.cover_url,
        };
      });
    },
  });

export const useEventRows = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["connect", "event"],
    queryFn: async (): Promise<ConnectRow[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,description,starts_at,venue_name,venue_address,cover_image_url,host_id,price,currency,is_online")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(60);
      if (error) throw error;
      const profs = await fetchProfiles((data ?? []).map((d: any) => d.host_id));
      return (data ?? []).map((e: any) => {
        const p = profs.get(e.host_id);
        const when = e.starts_at
          ? new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : null;
        const where = e.is_online ? "Online" : e.venue_name || "Venue TBA";
        const price =
          e.price != null && Number(e.price) > 0
            ? `${e.currency || "USD"} ${Number(e.price).toLocaleString()}`
            : e.price != null
              ? "Free"
              : null;
        return {
          id: e.id,
          kind: "event" as const,
          title: e.title,
          subtitle: [when, where].filter(Boolean).join(" · "),
          priceLabel: price,
          metaLabel: p?.display_name || p?.username || "Host",
          ownerId: e.host_id,
          ownerName: p?.display_name || p?.username || null,
          ownerAvatar: p?.avatar_url || null,
          isPro: !!p?.verified_pro_at,
          category: e.is_online ? "online" : "in-person",
          description: e.description,
          detailHref: `/spaces/events/${e.id}`,
          coverUrl: e.cover_image_url,
        };
      });
    },
  });

/** Interleave all four kinds for a mixed matchmaking deck. */
export const useMixedConnectRows = (enabled = true) => {
  const hire = useHireRows(enabled);
  const space = useSpaceRows(enabled);
  const call = useCallRows(enabled);
  const event = useEventRows(enabled);

  const isLoading =
    hire.isLoading && space.isLoading && call.isLoading && event.isLoading;
  const mixed = interleave([
    hire.data ?? [],
    space.data ?? [],
    call.data ?? [],
    event.data ?? [],
  ]);
  // Verified Pro creators float to the top of the matchmaking deck.
  const rows = [...mixed.filter((r) => r.isPro), ...mixed.filter((r) => !r.isPro)];
  return { rows, isLoading };
};

function interleave<T>(groups: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < max; i++) {
    for (const g of groups) if (g[i]) out.push(g[i]);
  }
  return out;
}

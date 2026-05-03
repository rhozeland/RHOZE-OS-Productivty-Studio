import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { REGIONS, type RegionMarket } from "@/lib/regions";

export type FeaturedKind = "artist" | "event" | "space";

export type FeaturedSlide =
  | {
      kind: "artist";
      id: string;
      href: string;
      title: string;
      subtitle?: string | null;
      banner?: string | null;
      avatar?: string | null;
      region_code?: string | null;
      mediums?: string[] | null;
      creator_roles?: string[] | null;
      verification_status?: string | null;
      works_count?: number;
      followers_count?: number;
    }
  | {
      kind: "event";
      id: string;
      href: string;
      title: string;
      subtitle?: string | null;
      banner?: string | null;
      starts_at: string;
      venue?: string | null;
      is_online?: boolean;
      region_code?: string | null;
    }
  | {
      kind: "space";
      id: string;
      href: string;
      title: string;
      subtitle?: string | null;
      banner?: string | null;
      location?: string | null;
      region_code?: string | null;
      category?: string | null;
      hourly_rate?: number | null;
      currency?: string | null;
      max_guests?: number | null;
      amenities?: string[] | null;
      rating_avg?: number | null;
      review_count?: number | null;
      available_days?: number | null;
    };

export interface FeaturedSpotlight {
  kind: FeaturedKind;
  id: string;
  href: string;
  title: string;
  subtitle?: string | null;
  region_code: string;
}

interface FeaturedArtistRow {
  user_id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  region_code: string | null;
  mediums: string[] | null;
  creator_roles: string[] | null;
  verification_status?: string | null;
  works_count?: number;
  followers_count?: number;
}

interface EventSpaceRelation {
  location?: string | null;
  city?: string | null;
  country?: string | null;
}

interface FeaturedEventRow {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  cover_url: string | null;
  starts_at: string;
  venue_name: string | null;
  venue_address: string | null;
  is_online: boolean;
  space?: EventSpaceRelation | EventSpaceRelation[] | null;
}

interface FeaturedSpaceRow {
  id: string;
  name: string;
  short_description: string | null;
  cover_image_url: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

const marketsByCode = new Map(REGIONS.map((region) => [region.code, region.market]));

const PLACE_TO_REGION_CODE: Record<string, string> = {
  "AUSTRALIA": "AU",
  "ARGENTINA": "AR",
  "BRAZIL": "BR",
  "CANADA": "CA",
  "CHILE": "CL",
  "CHINA": "CN",
  "FRANCE": "FR",
  "GERMANY": "DE",
  "GHANA": "GH",
  "HONG KONG": "HK",
  "INDONESIA": "ID",
  "ITALY": "IT",
  "JAPAN": "JP",
  "KENYA": "KE",
  "SOUTH KOREA": "KR",
  "KOREA": "KR",
  "MALAYSIA": "MY",
  "MEXICO": "MX",
  "NETHERLANDS": "NL",
  "NEW ZEALAND": "NZ",
  "NIGERIA": "NG",
  "PHILIPPINES": "PH",
  "SINGAPORE": "SG",
  "SPAIN": "ES",
  "SOUTH AFRICA": "ZA",
  "TAIWAN": "TW",
  "THAILAND": "TH",
  "UNITED KINGDOM": "GB",
  "UK": "GB",
  "GREAT BRITAIN": "GB",
  "UNITED STATES": "US",
  "USA": "US",
  "U.S.A.": "US",
  "VIETNAM": "VN",
};

const normalizePlace = (value?: string | null) =>
  value
    ?.toUpperCase()
    .replace(/[^A-Z\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? "";

const extractRelation = (space?: EventSpaceRelation | EventSpaceRelation[] | null) =>
  Array.isArray(space) ? (space[0] ?? null) : space ?? null;

export const resolveRegionCodeFromPlace = (values: Array<string | null | undefined>) => {
  for (const value of values) {
    const normalized = normalizePlace(value);
    if (!normalized) continue;

    for (const [place, code] of Object.entries(PLACE_TO_REGION_CODE)) {
      if (normalized.includes(place)) return code;
    }
  }

  return null;
};

const pickByMarket = <T extends { region_code?: string | null }>(items: T[], marketFilter: RegionMarket | "All") => {
  if (items.length === 0) return null;
  if (marketFilter === "All") return items[0] ?? null;

  const matching = items.find((item) => {
    const code = item.region_code?.toUpperCase();
    return code ? marketsByCode.get(code) === marketFilter : false;
  });

  return matching ?? items[0] ?? null;
};

export const useDiscoverFeatured = (marketFilter: RegionMarket | "All") => {
  const { data: artists } = useQuery({
    queryKey: ["discover-featured-artists"],
    queryFn: async () => {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("user_id, display_name, headline, bio, avatar_url, banner_url, region_code, mediums, creator_roles, verification_status")
        .eq("is_public", true)
        .not("avatar_url", "is", null)
        .order("updated_at", { ascending: false })
        .limit(20);

      const profiles = (profileRows ?? []) as FeaturedArtistRow[];
      if (profiles.length === 0) return profiles;

      const userIds = profiles.map((p) => p.user_id);

      // Backfill missing banner_url with the artist's most recent visual work,
      // so the Featured panel never renders an empty grey box.
      const needsBanner = profiles.filter((p) => !p.banner_url).map((p) => p.user_id);
      const bannerFallback = new Map<string, string>();
      const worksCount = new Map<string, number>();

      const { data: workRows } = await supabase
        .from("works")
        .select("user_id, file_url, mime_type, created_at")
        .in("user_id", userIds)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(200);

      (workRows ?? []).forEach((row: any) => {
        worksCount.set(row.user_id, (worksCount.get(row.user_id) ?? 0) + 1);
        if (
          needsBanner.includes(row.user_id) &&
          !bannerFallback.has(row.user_id) &&
          row.file_url &&
          typeof row.mime_type === "string" &&
          row.mime_type.startsWith("image/")
        ) {
          bannerFallback.set(row.user_id, row.file_url);
        }
      });

      // Followers count (connections.following_id = artist, accepted).
      const followersCount = new Map<string, number>();
      const { data: followerRows } = await supabase
        .from("connections")
        .select("following_id")
        .in("following_id", userIds)
        .eq("status", "accepted");

      (followerRows ?? []).forEach((row: any) => {
        followersCount.set(row.following_id, (followersCount.get(row.following_id) ?? 0) + 1);
      });

      return profiles.map((p) => ({
        ...p,
        banner_url: p.banner_url ?? bannerFallback.get(p.user_id) ?? null,
        works_count: worksCount.get(p.user_id) ?? 0,
        followers_count: followersCount.get(p.user_id) ?? 0,
      }));
    },
    staleTime: 60_000,
  });

  const { data: events } = useQuery({
    queryKey: ["discover-featured-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, slug, title, description, cover_url, starts_at, venue_name, venue_address, is_online, space:studios(location, city, country)")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(12);

      return ((data ?? []) as FeaturedEventRow[]).map((event) => ({
        ...event,
        region_code: resolveRegionCodeFromPlace([
          extractRelation(event.space)?.country,
          extractRelation(event.space)?.city,
          extractRelation(event.space)?.location,
          event.venue_name,
          event.venue_address,
        ]),
      }));
    },
    staleTime: 60_000,
  });

  const { data: spaces } = useQuery({
    queryKey: ["discover-featured-spaces"],
    queryFn: async () => {
      const { data } = await supabase
        .from("studios")
        .select("id, name, short_description, cover_image_url, location, city, state, country")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(12);

      return ((data ?? []) as FeaturedSpaceRow[]).map((space) => ({
        ...space,
        region_code: resolveRegionCodeFromPlace([space.country, space.city, space.location]),
      }));
    },
    staleTime: 60_000,
  });

  const artist = useMemo(() => pickByMarket(artists ?? [], marketFilter), [artists, marketFilter]);
  const event = useMemo(() => pickByMarket(events ?? [], marketFilter), [events, marketFilter]);
  const space = useMemo(() => pickByMarket(spaces ?? [], marketFilter), [spaces, marketFilter]);

  const slides = useMemo<FeaturedSlide[]>(() => {
    const next: FeaturedSlide[] = [];

    if (artist) {
      next.push({
        kind: "artist",
        id: artist.user_id,
        href: `/profiles/${artist.user_id}`,
        title: artist.display_name || "Untitled artist",
        subtitle: artist.headline || artist.bio,
        banner: artist.banner_url,
        avatar: artist.avatar_url,
        region_code: artist.region_code,
        mediums: artist.mediums,
        creator_roles: artist.creator_roles,
        verification_status: artist.verification_status ?? null,
        works_count: artist.works_count ?? 0,
        followers_count: artist.followers_count ?? 0,
      });
    }

    if (event) {
      next.push({
        kind: "event",
        id: event.id,
        href: `/spaces/events/${event.id}`,
        title: event.title,
        subtitle: event.description,
        banner: event.cover_url,
        starts_at: event.starts_at,
        venue: event.venue_name,
        is_online: event.is_online,
        region_code: event.region_code,
      });
    }

    if (space) {
      next.push({
        kind: "space",
        id: space.id,
        href: `/studios/${space.id}`,
        title: space.name,
        subtitle: space.short_description,
        banner: space.cover_image_url,
        location:
          [space.city, space.state].filter(Boolean).join(", ") ||
          space.location ||
          space.country ||
          null,
        region_code: space.region_code,
      });
    }

    return next;
  }, [artist, event, space]);

  const spotlights = useMemo<FeaturedSpotlight[]>(() => {
    return slides
      .map((slide) => {
        if (!slide.region_code) return null;
        return {
          kind: slide.kind,
          id: slide.id,
          href: slide.href,
          title: slide.title,
          subtitle: slide.subtitle,
          region_code: slide.region_code,
        } satisfies FeaturedSpotlight;
      })
      .filter(Boolean) as FeaturedSpotlight[];
  }, [slides]);

  return { slides, artist, event, space, spotlights };
};
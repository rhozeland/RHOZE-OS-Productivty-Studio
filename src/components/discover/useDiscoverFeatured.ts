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
      archetype?: string | null;
      verification_status?: string | null;
      works_count?: number;
      followers_count?: number;
      works_thumbs?: string[];
      coin?: { id: string; ticker: string; name: string | null; image_url: string | null } | null;
      next_event?: { id: string; slug: string | null; title: string; starts_at: string; cover_url: string | null } | null;
      hosted_space?: { id: string; name: string; cover_image_url: string | null } | null;
      offerings_count?: number;
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
  archetype?: string | null;
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
  cover_url_poster: string | null;
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
  category: string | null;
  hourly_rate: number | null;
  currency: string | null;
  max_guests: number | null;
  amenities: string[] | null;
  rating_avg: number | null;
  review_count: number | null;
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
      const flowCount = new Map<string, number>();

      // Count ALL works owned by the artist (not just `visibility=public`),
      // so that creators see their real total in the Featured stat strip.
      // The list of files is never rendered here — only the count.
      const { data: workRows } = await supabase
        .from("works")
        .select("user_id, file_url, mime_type, visibility, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(400);

      (workRows ?? []).forEach((row: any) => {
        worksCount.set(row.user_id, (worksCount.get(row.user_id) ?? 0) + 1);
        // Only public images may be used as banner fallback (no leaking private work).
        if (
          row.visibility === "public" &&
          needsBanner.includes(row.user_id) &&
          !bannerFallback.has(row.user_id) &&
          row.file_url &&
          typeof row.mime_type === "string" &&
          row.mime_type.startsWith("image/")
        ) {
          bannerFallback.set(row.user_id, row.file_url);
        }
      });

      // Public-facing "Works" on profiles map to Flow posts, so prefer that
      // count when available. Fall back to registered Works for creators who
      // use the registry but have not posted on Flow yet.
      const { data: flowRows } = await supabase
        .from("flow_items")
        .select("user_id, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(400);

      (flowRows ?? []).forEach((row: any) => {
        flowCount.set(row.user_id, (flowCount.get(row.user_id) ?? 0) + 1);
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

      // Recent visual works for the strip on Featured (3 most recent images per artist)
      const worksThumbs = new Map<string, string[]>();
      (workRows ?? []).forEach((row: any) => {
        if (
          row.visibility === "public" &&
          row.file_url &&
          typeof row.mime_type === "string" &&
          row.mime_type.startsWith("image/")
        ) {
          const arr = worksThumbs.get(row.user_id) ?? [];
          if (arr.length < 3) {
            arr.push(row.file_url);
            worksThumbs.set(row.user_id, arr);
          }
        }
      });

      // Active artist coin (one per creator)
      const coinByCreator = new Map<string, { id: string; ticker: string; name: string | null; image_url: string | null }>();
      const { data: coinRows } = await supabase
        .from("coin_launches")
        .select("id, ticker, name, image_url, creator_id, status, updated_at")
        .in("creator_id", userIds)
        .in("status", ["active", "graduated"])
        .order("updated_at", { ascending: false });
      (coinRows ?? []).forEach((row: any) => {
        if (!coinByCreator.has(row.creator_id)) {
          coinByCreator.set(row.creator_id, {
            id: row.id, ticker: row.ticker, name: row.name, image_url: row.image_url,
          });
        }
      });

      // Next upcoming event hosted by the artist
      const nextEventByHost = new Map<string, { id: string; slug: string | null; title: string; starts_at: string; cover_url: string | null }>();
      const { data: eventRows } = await supabase
        .from("events")
        .select("id, slug, title, starts_at, host_id, status, cover_url, cover_url_poster")
        .in("host_id", userIds)
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });
      (eventRows ?? []).forEach((row: any) => {
        if (!nextEventByHost.has(row.host_id)) {
          nextEventByHost.set(row.host_id, {
            id: row.id, slug: row.slug, title: row.title, starts_at: row.starts_at,
            cover_url: row.cover_url_poster ?? row.cover_url ?? null,
          });
        }
      });

      // One hosted space per artist (first active studio they own)
      const hostedSpaceByOwner = new Map<string, { id: string; name: string; cover_image_url: string | null }>();
      const { data: spaceRows } = await supabase
        .from("studios")
        .select("id, name, owner_id, is_active, cover_image_url")
        .in("owner_id", userIds)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });
      (spaceRows ?? []).forEach((row: any) => {
        if (!hostedSpaceByOwner.has(row.owner_id)) {
          hostedSpaceByOwner.set(row.owner_id, { id: row.id, name: row.name, cover_image_url: row.cover_image_url ?? null });
        }
      });

      // Active marketplace offerings per artist
      const offeringsCount = new Map<string, number>();
      const listingRes: any = await (supabase as any)
        .from("marketplace_listings")
        .select("user_id")
        .in("user_id", userIds)
        .eq("status", "active");
      const listingRows = listingRes?.data;
      (listingRows ?? []).forEach((row: any) => {
        offeringsCount.set(row.user_id, (offeringsCount.get(row.user_id) ?? 0) + 1);
      });

      const enriched = profiles.map((p) => {
        const works = Math.max(flowCount.get(p.user_id) ?? 0, worksCount.get(p.user_id) ?? 0);
        const followers = followersCount.get(p.user_id) ?? 0;
        const headline = (p.headline ?? "").trim();
        const bio = (p.bio ?? "").trim();
        const subtitle =
          headline.length >= 8 ? headline : bio.length >= 24 ? bio : null;
        const offerings = offeringsCount.get(p.user_id) ?? 0;
        const nextEvent = nextEventByHost.get(p.user_id) ?? null;
        const isFeaturable =
          (p.verification_status === "verified") ||
          works >= 1 || followers >= 1 || !!subtitle;
        return {
          ...p,
          banner_url: p.banner_url ?? bannerFallback.get(p.user_id) ?? null,
          works_count: works,
          followers_count: followers,
          subtitle,
          works_thumbs: worksThumbs.get(p.user_id) ?? [],
          coin: coinByCreator.get(p.user_id) ?? null,
          next_event: nextEvent,
          hosted_space: hostedSpaceByOwner.get(p.user_id) ?? null,
          offerings_count: offerings,
          _score:
            (p.verification_status === "verified" ? 1000 : 0) +
            works * 10 + followers * 3 + (subtitle ? 5 : 0) +
            (coinByCreator.has(p.user_id) ? 50 : 0) +
            (nextEvent ? 30 : 0) + offerings * 5,
          _featurable: isFeaturable,
        };
      });
      // Only keep featurable artists, sorted by score (best first).
      return enriched
        .filter((p) => p._featurable)
        .sort((a, b) => b._score - a._score);
    },
    staleTime: 60_000,
  });

  const { data: events } = useQuery({
    queryKey: ["discover-featured-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, slug, title, description, cover_url, cover_url_poster, starts_at, venue_name, venue_address, is_online, space:studios(location, city, country)")
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
        .select("id, name, short_description, cover_image_url, location, city, state, country, category, hourly_rate, currency, max_guests, amenities, rating_avg, review_count")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(12);

      const rows = (data ?? []) as FeaturedSpaceRow[];
      const ids = rows.map((r) => r.id);
      const availDays = new Map<string, number>();
      if (ids.length) {
        const { data: avail } = await supabase
          .from("studio_availability")
          .select("studio_id, day_of_week, is_available")
          .in("studio_id", ids);
        for (const a of (avail ?? []) as any[]) {
          if (a.is_available) {
            const key = `${a.studio_id}:${a.day_of_week}`;
            // @ts-ignore
            if (!availDays.has(key)) availDays.set(key, 1);
          }
        }
      }
      const dayCount = new Map<string, number>();
      for (const k of availDays.keys()) {
        const sid = k.split(":")[0];
        dayCount.set(sid, (dayCount.get(sid) ?? 0) + 1);
      }

      return rows.map((space) => ({
        ...space,
        region_code: resolveRegionCodeFromPlace([space.country, space.city, space.location]),
        available_days: dayCount.get(space.id) ?? 0,
      }));
    },
    staleTime: 60_000,
  });

  const artist = useMemo(() => pickByMarket(artists ?? [], marketFilter), [artists, marketFilter]);
  const event = useMemo(() => pickByMarket(events ?? [], marketFilter), [events, marketFilter]);
  const space = useMemo(() => pickByMarket(spaces ?? [], marketFilter), [spaces, marketFilter]);

  // Creator-first BUT visual: rotate through top artists, events, and
  // spaces so the globe carousel actually shows what's happening — real
  // posters, real space photos — not only avatars. Order is interleaved
  // (artist → event → space → artist…) so each refresh feels alive.
  const slides = useMemo<FeaturedSlide[]>(() => {
    const matchMarket = <T extends { region_code?: string | null }>(items: T[]) => {
      if (marketFilter === "All") return items;
      const filtered = items.filter((i) => {
        const code = i.region_code?.toUpperCase();
        return code ? marketsByCode.get(code) === marketFilter : false;
      });
      return filtered.length ? filtered : items;
    };

    const artistSlides: FeaturedSlide[] = matchMarket(artists ?? [])
      .slice(0, 5)
      .map((artist) => ({
        kind: "artist" as const,
        id: artist.user_id,
        href: `/profiles/${artist.user_id}`,
        title: artist.display_name || "Untitled artist",
        subtitle: (artist as any).subtitle ?? null,
        banner: artist.banner_url,
        avatar: artist.avatar_url,
        region_code: artist.region_code,
        mediums: artist.mediums,
        creator_roles: artist.creator_roles,
        verification_status: artist.verification_status ?? null,
        works_count: artist.works_count ?? 0,
        followers_count: artist.followers_count ?? 0,
        works_thumbs: (artist as any).works_thumbs ?? [],
        coin: (artist as any).coin ?? null,
        next_event: (artist as any).next_event ?? null,
        hosted_space: (artist as any).hosted_space ?? null,
        offerings_count: (artist as any).offerings_count ?? 0,
      }));

    const eventSlides: FeaturedSlide[] = matchMarket(events ?? [])
      .slice(0, 4)
      .map((event) => ({
        kind: "event" as const,
        id: event.id,
        href: `/spaces/events/${event.id}`,
        title: event.title,
        subtitle: event.description ?? null,
        banner: event.cover_url_poster ?? event.cover_url ?? null,
        starts_at: event.starts_at,
        venue: event.venue_name ?? extractRelation(event.space)?.location ?? null,
        is_online: event.is_online ?? false,
        region_code: event.region_code,
      }));

    const spaceSlides: FeaturedSlide[] = matchMarket(spaces ?? [])
      .slice(0, 4)
      .map((space) => ({
        kind: "space" as const,
        id: space.id,
        href: `/studios/${space.id}`,
        title: space.name,
        subtitle: space.short_description ?? null,
        banner: space.cover_image_url,
        location: [space.city, space.country].filter(Boolean).join(", ") || space.location || null,
        region_code: space.region_code,
        category: space.category,
        hourly_rate: space.hourly_rate,
        currency: space.currency,
        max_guests: space.max_guests,
        amenities: space.amenities,
        rating_avg: space.rating_avg,
        review_count: space.review_count,
        available_days: space.available_days,
      }));

    // Interleave: A E S A E S ... so the carousel feels mixed and visual.
    const interleaved: FeaturedSlide[] = [];
    const maxLen = Math.max(artistSlides.length, eventSlides.length, spaceSlides.length);
    for (let i = 0; i < maxLen; i++) {
      if (artistSlides[i]) interleaved.push(artistSlides[i]);
      if (eventSlides[i]) interleaved.push(eventSlides[i]);
      if (spaceSlides[i]) interleaved.push(spaceSlides[i]);
    }
    return interleaved;
  }, [artists, events, spaces, marketFilter]);

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
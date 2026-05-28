/**
 * useBackedCardData — pulls everything the BackedCard needs in one query:
 * creator profile + 3 headline stats (backers · $RHOZE earned · projects
 * completed). Cached aggressively so opening the share modal feels instant.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BackedCardData {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  archetype: string | null;
  regionCode: string | null;
  roles: string[];
  backers: number;
  rhozeEarned: number;
  projectsCompleted: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  artist: "Artist",
  builder: "Builder",
  influencer: "Influencer",
};

export const formatLocation = (
  archetype: string | null,
  region: string | null,
  roles: string[],
): string => {
  const parts: string[] = [];
  if (roles?.[0]) parts.push(roles[0]);
  else if (archetype) parts.push(CATEGORY_LABEL[archetype] ?? archetype);
  if (region) parts.push(region.toUpperCase());
  return parts.join(" · ") || "Creator";
};

export function useBackedCardData(creatorId: string | null | undefined) {
  return useQuery({
    queryKey: ["backed-card-data", creatorId],
    enabled: !!creatorId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BackedCardData | null> => {
      if (!creatorId) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, archetype, region_code, creator_roles, user_id",
        )
        .eq("id", creatorId)
        .maybeSingle();

      if (!profile) return null;

      const ownerUserId = (profile as any).user_id ?? creatorId;

      const [backersRes, projectsRes, earnedRes] = await Promise.all([
        supabase
          .from("creator_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", creatorId)
          .eq("status", "active"),
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", ownerUserId)
          .eq("status", "completed"),
        supabase
          .from("credit_transactions")
          .select("amount")
          .eq("user_id", ownerUserId)
          .gt("amount", 0),
      ]);

      const rhozeEarned = (earnedRes.data ?? []).reduce(
        (s: number, r: any) => s + Number(r.amount || 0),
        0,
      );

      return {
        id: profile.id as string,
        displayName:
          (profile as any).display_name ||
          (profile as any).username ||
          "Creator",
        username: (profile as any).username ?? null,
        avatarUrl: (profile as any).avatar_url ?? null,
        archetype: (profile as any).archetype ?? null,
        regionCode: (profile as any).region_code ?? null,
        roles: ((profile as any).creator_roles ?? []) as string[],
        backers: backersRes.count ?? 0,
        rhozeEarned: Number(rhozeEarned ?? 0),
        projectsCompleted: projectsRes.count ?? 0,
      };
    },
  });
}


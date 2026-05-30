/**
 * fetchCreatorContext — Pillar 5 helper.
 *
 * Pulls profile + last N works + linked-token info for a given user so the
 * `draft-project-roadmap` edge function can tailor strategy + target metrics
 * to the artist's actual style and audience.
 *
 * Returns `null` on failure (network/RLS) — caller should still fall back
 * to a name-only context so the AI isn't blocked.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ProfileContext, RecentWork } from "@/hooks/useAiRoadmapDraft";

export const fetchCreatorContext = async (
  userId: string | null | undefined,
  fallbackName = "Creator",
): Promise<ProfileContext> => {
  if (!userId) return { name: fallbackName, recent_works: [] };
  try {
    const [{ data: profile }, { data: works }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, username, archetype, bio, creator_roles, region_code, token_ticker, token_mint_address",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("works")
        .select("title, kind, description, mime_type")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const recent: RecentWork[] = (works ?? []).map((w: any) => ({
      title: w.title ?? undefined,
      kind: w.kind ?? null,
      description: w.description ?? null,
      mime_type: w.mime_type ?? null,
    }));

    return {
      name: profile?.display_name || profile?.username || fallbackName,
      archetype: profile?.archetype ?? null,
      bio: profile?.bio ?? null,
      roles: (profile?.creator_roles ?? null) as string[] | null,
      region: profile?.region_code ?? null,
      token_ticker: profile?.token_ticker ?? null,
      token_mint: profile?.token_mint_address ?? null,
      recent_works: recent,
    };
  } catch {
    return { name: fallbackName, recent_works: [] };
  }
};

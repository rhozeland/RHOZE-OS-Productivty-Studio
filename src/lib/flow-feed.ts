/**
 * Flow Mode feed loader — extracted from FlowModePage so it can be tested
 * in isolation against a mocked Supabase client.
 *
 * Contract (must hold for both guests and authenticated users):
 *  - Reads from `flow_items` with no user filter (global feed).
 *  - Soft-sorts: preferred categories surfaced first, but nothing hidden.
 *  - Resolves uploader attribution via the guest-safe `profiles_public` view,
 *    NEVER the private `profiles` table (which blocks anon reads).
 */

export type FlowItem = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  content_type: string;
  file_url: string | null;
  link_url: string | null;
  created_at: string;
  [key: string]: unknown;
};

export type FlowProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
};

export type FlowItemWithProfile = FlowItem & {
  profiles: FlowProfile | null;
};

// Minimal subset of the Supabase client surface the loader uses.
// Kept loose so tests can supply a tiny stub.
export interface FlowSupabase {
  from: (table: string) => any;
}

export const ALL_CATEGORIES = ["design", "music", "photo", "video", "writing"];

export async function loadFlowFeed(
  supabase: FlowSupabase,
  selectedCategories: string[],
): Promise<FlowItemWithProfile[]> {
  const { data, error } = await supabase
    .from("flow_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  let items: FlowItem[] = data ?? [];

  // Soft sort: preferred categories first, rest after — never filter out.
  if (
    selectedCategories.length > 0 &&
    selectedCategories.length < ALL_CATEGORIES.length
  ) {
    const prefSet = new Set(selectedCategories);
    const preferred = items.filter((i) => prefSet.has(i.category));
    const rest = items.filter((i) => !prefSet.has(i.category));
    items = [...preferred, ...rest];
  }

  const userIds = [...new Set(items.map((i) => i.user_id).filter(Boolean))];
  let withProfiles: FlowItemWithProfile[] = items.map((i) => ({
    ...i,
    profiles: null,
  }));

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles_public")
      .select("user_id, display_name, avatar_url, username")
      .in("user_id", userIds);
    const profileMap = new Map<string, FlowProfile>(
      ((profiles ?? []) as FlowProfile[])
        .filter((p) => !!p.user_id)
        .map((p) => [p.user_id, p]),
    );
    withProfiles = items.map((i) => ({
      ...i,
      profiles: profileMap.get(i.user_id) ?? null,
    }));
  }

  return withProfiles;
}

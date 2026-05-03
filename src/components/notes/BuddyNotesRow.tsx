/**
 * BuddyNotesRow — Instagram-style horizontal strip at the top of the DM
 * inbox. First tile is "Your note" (opens the composer); each following
 * tile shows a buddy's avatar with their active note bubbled above.
 *
 * If the user has no accepted buddies yet, we fall back to their recent
 * DM contacts so the row never feels empty — they can still tap an avatar
 * to jump back into a thread.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useBuddies } from "@/hooks/useBuddies";
import { useMyNote } from "@/hooks/useNotes";
import { NoteBubble } from "./NoteBubble";
import { NoteComposer } from "./NoteComposer";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSelectBuddy: (buddy: { user_id: string; display_name: string | null; avatar_url: string | null }) => void;
}

type Tile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  note_body: string | null;
  is_buddy: boolean;
};

const initials = (name: string | null | undefined) =>
  (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const truncate = (name: string | null | undefined, n = 10) => {
  const v = name || "Buddy";
  return v.length > n ? `${v.slice(0, n)}…` : v;
};

export const BuddyNotesRow = ({ onSelectBuddy }: Props) => {
  const { user } = useAuth();
  const { data: buddies } = useBuddies();
  const { note: myNote } = useMyNote();
  const [composerOpen, setComposerOpen] = useState(false);

  // Pull the user's profile avatar (user_metadata is rarely populated).
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-mini", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, display_name, username")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fallback: recent DM partners (if no buddies yet) so row isn't bare.
  const { data: recents } = useQuery({
    queryKey: ["buddy-row-recents", user?.id],
    queryFn: async () => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id, receiver_id, created_at")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(60);
      const seen = new Set<string>();
      const ids: string[] = [];
      for (const m of msgs ?? []) {
        const pid = m.sender_id === user!.id ? m.receiver_id : m.sender_id;
        if (!seen.has(pid)) { seen.add(pid); ids.push(pid); }
        if (ids.length >= 8) break;
      }
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.rpc("get_profiles_by_ids", { _ids: ids });
      const map = new Map((profiles as any[] ?? []).map((p) => [p.user_id, p]));
      return ids.map((id) => map.get(id)).filter(Boolean) as { user_id: string; display_name: string | null; avatar_url: string | null }[];
    },
    enabled: !!user && (!buddies || buddies.length === 0),
  });

  if (!user) return null;

  const tiles: Tile[] = (buddies && buddies.length > 0)
    ? buddies.map((b) => ({
        user_id: b.buddy_id,
        display_name: b.display_name,
        avatar_url: b.avatar_url,
        note_body: b.note_body,
        is_buddy: true,
      }))
    : (recents ?? []).map((r) => ({
        user_id: r.user_id,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        note_body: null,
        is_buddy: false,
      }));

  const myAvatar = myProfile?.avatar_url || (user.user_metadata?.avatar_url as string | undefined);
  const myName = myProfile?.display_name || myProfile?.username || user.email;

  return (
    <div className="px-3 pt-3 pb-3 border-b border-border/60">
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin scroll-smooth">
        {/* Your note */}
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="flex flex-col items-center gap-1.5 shrink-0 w-20 group"
        >
          <div className="h-9 flex items-end justify-center w-full">
            {myNote ? (
              <NoteBubble body={myNote.body} size="sm" />
            ) : (
              <span className="text-[10px] text-muted-foreground/70">Tap to share</span>
            )}
          </div>
          <div className="relative">
            <div className="h-12 w-12 rounded-full bg-muted ring-2 ring-border/60 overflow-hidden flex items-center justify-center">
              {myAvatar ? (
                <img src={myAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-muted-foreground">
                  {initials(myName)}
                </span>
              )}
            </div>
            {!myNote && (
              <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center ring-2 ring-card">
                <Plus className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium text-foreground truncate w-full text-center">
            {myNote ? "Your note" : "Add note"}
          </span>
        </button>

        {/* Buddy / recent tiles */}
        {tiles.map((b) => (
          <button
            key={b.user_id}
            type="button"
            onClick={() =>
              onSelectBuddy({
                user_id: b.user_id,
                display_name: b.display_name,
                avatar_url: b.avatar_url,
              })
            }
            className="flex flex-col items-center gap-1.5 shrink-0 w-20 group"
          >
            <div className="h-9 flex items-end justify-center w-full">
              {b.note_body ? <NoteBubble body={b.note_body} size="sm" /> : <span className="h-1" />}
            </div>
            <div className="relative">
              <div
                className={cn(
                  "h-12 w-12 rounded-full bg-muted overflow-hidden flex items-center justify-center transition-all",
                  b.note_body
                    ? "ring-2 ring-primary/60"
                    : "ring-2 ring-border/60 group-hover:ring-foreground/40",
                )}
              >
                {b.avatar_url ? (
                  <img src={b.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">
                    {initials(b.display_name)}
                  </span>
                )}
              </div>
            </div>
            <span className="text-[10px] font-medium text-foreground/80 truncate w-full text-center">
              {truncate(b.display_name)}
            </span>
          </button>
        ))}

        {tiles.length === 0 && (
          <div className="flex items-center text-[11px] text-muted-foreground/70 px-2 max-w-[220px]">
            Add buddies from a creator's profile to see their notes here.
          </div>
        )}
      </div>

      <NoteComposer open={composerOpen} onOpenChange={setComposerOpen} />
    </div>
  );
};

export default BuddyNotesRow;

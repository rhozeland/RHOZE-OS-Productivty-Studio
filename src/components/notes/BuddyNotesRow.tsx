/**
 * BuddyNotesRow — Instagram-style horizontal strip at the top of the DM
 * inbox. First tile is "Your note" (opens the composer); each following
 * tile shows a buddy's avatar with their active note (if any) bubbled
 * above. Tapping a buddy opens a DM with them.
 */
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBuddies } from "@/hooks/useBuddies";
import { useMyNote } from "@/hooks/useNotes";
import { NoteBubble } from "./NoteBubble";
import { NoteComposer } from "./NoteComposer";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSelectBuddy: (buddy: { user_id: string; display_name: string | null; avatar_url: string | null }) => void;
}

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

  if (!user) return null;

  const tiles = buddies ?? [];

  return (
    <div className="px-3 pt-3 pb-2 border-b border-border/60">
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scroll-smooth">
        {/* Your note */}
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="flex flex-col items-center gap-1 shrink-0 w-16 group"
        >
          <div className="relative">
            {myNote && (
              <div className="absolute left-1/2 -translate-x-1/2 -top-9 z-10">
                <NoteBubble body={myNote.body} size="sm" />
              </div>
            )}
            <div className="h-12 w-12 rounded-full bg-muted ring-2 ring-border/60 overflow-hidden flex items-center justify-center">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url as string} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-muted-foreground">
                  {initials(user.email)}
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

        {/* Buddy tiles */}
        {tiles.map((b) => (
          <button
            key={b.buddy_id}
            type="button"
            onClick={() =>
              onSelectBuddy({
                user_id: b.buddy_id,
                display_name: b.display_name,
                avatar_url: b.avatar_url,
              })
            }
            className="flex flex-col items-center gap-1 shrink-0 w-16 group"
          >
            <div className="relative">
              {b.note_body && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-9 z-10">
                  <NoteBubble body={b.note_body} size="sm" />
                </div>
              )}
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
          <div className="flex items-center text-[11px] text-muted-foreground/70 px-2">
            Add buddies from their profile to see their notes here.
          </div>
        )}
      </div>

      <NoteComposer open={composerOpen} onOpenChange={setComposerOpen} />
    </div>
  );
};

export default BuddyNotesRow;

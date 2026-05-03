/**
 * Notes hooks — Instagram-style 60-word, 24h-expiring status notes.
 *
 * - `useUserNote(userId)`: fetch the active (non-expired) note for any user.
 * - `useMyNote()`: read + post + clear the current user's note. Posting upserts
 *   the single row keyed by user_id and resets `expires_at` to now()+24h, so
 *   posting a new note simply replaces the previous one.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const NOTE_MAX_CHARS = 300;
/** Approx 60 words — used to display a friendlier counter. */
export const NOTE_MAX_WORDS = 60;

export interface UserNote {
  id: string;
  user_id: string;
  body: string;
  expires_at: string;
}

export function useUserNote(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["user-note", userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserNote | null> => {
      const { data, error } = await supabase
        .from("user_notes" as any)
        .select("id, user_id, body, expires_at")
        .eq("user_id", userId!)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useMyNote() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const note = useUserNote(user?.id ?? null);

  const post = useMutation({
    mutationFn: async (body: string) => {
      if (!user) throw new Error("Sign in to post a note.");
      const trimmed = body.trim();
      if (!trimmed) throw new Error("Notes can't be empty.");
      if (trimmed.length > NOTE_MAX_CHARS) {
        throw new Error(`Notes are limited to ${NOTE_MAX_CHARS} characters.`);
      }
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("user_notes" as any)
        .upsert(
          { user_id: user.id, body: trimmed, expires_at: expiresAt },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-note", user?.id] });
      qc.invalidateQueries({ queryKey: ["my-buddies"] });
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("user_notes" as any)
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-note", user?.id] });
      qc.invalidateQueries({ queryKey: ["my-buddies"] });
    },
  });

  return { note: note.data ?? null, isLoading: note.isLoading, post, clear };
}

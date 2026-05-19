/**
 * useSavedItems — read + toggle saved bookmarks for the current user.
 *
 * Backed by the `saved_items` table (user_id, item_type, item_id).
 * item_type ∈ 'creator' | 'work' | 'listing'.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SavedItemType = "creator" | "work" | "listing";

export type SavedItem = {
  id: string;
  user_id: string;
  item_type: SavedItemType;
  item_id: string;
  created_at: string;
};

const sb: any = supabase;

export const useSavedItems = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["saved-items", user?.id],
    queryFn: async (): Promise<SavedItem[]> => {
      if (!user) return [];
      const { data, error } = await sb
        .from("saved_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedItem[];
    },
    enabled: !!user,
  });

  const lookup = useMemo(() => {
    const set = new Set<string>();
    for (const row of query.data ?? []) {
      set.add(`${row.item_type}:${row.item_id}`);
    }
    return set;
  }, [query.data]);

  const isSaved = (type: SavedItemType, id: string) =>
    lookup.has(`${type}:${id}`);

  const toggle = useMutation({
    mutationFn: async ({
      type,
      id,
    }: {
      type: SavedItemType;
      id: string;
    }) => {
      if (!user) throw new Error("Sign in to save items");
      const already = isSaved(type, id);
      if (already) {
        const { error } = await sb
          .from("saved_items")
          .delete()
          .eq("user_id", user.id)
          .eq("item_type", type)
          .eq("item_id", id);
        if (error) throw error;
        return { saved: false } as const;
      }
      const { error } = await sb.from("saved_items").insert({
        user_id: user.id,
        item_type: type,
        item_id: id,
      });
      if (error) throw error;
      return { saved: true } as const;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["saved-items", user?.id] });
      toast.success(res.saved ? "Saved" : "Removed from Saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isSaved,
    toggle: (type: SavedItemType, id: string) => toggle.mutate({ type, id }),
    isPending: toggle.isPending,
  };
};

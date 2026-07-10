/**
 * useCanvasCards — CRUD hook for the release-canvas board.
 *
 * Loads every card for a project, exposes create/update/move/remove helpers,
 * and debounces position updates so drags don't hammer the DB.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CanvasLane = "ideas" | "in_progress" | "review" | "released";
export type CanvasKind = "media" | "milestone" | "moodboard" | "sticky" | "contract" | "deliverable";

export interface CanvasCard {
  id: string;
  project_id: string;
  lane: CanvasLane;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: CanvasKind;
  work_attachment_id: string | null;
  goal_id: string | null;
  contract_id: string | null;
  deliverable_id: string | null;
  payload: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const LANES: { id: CanvasLane; label: string }[] = [
  { id: "ideas", label: "Ideas" },
  { id: "in_progress", label: "In progress" },
  { id: "review", label: "Review" },
  { id: "released", label: "Released" },
];

export const useCanvasCards = (projectId: string | undefined) => {
  const [cards, setCards] = useState<CanvasCard[]>([]);
  const [loading, setLoading] = useState(true);
  const pendingUpdates = useRef<Map<string, Partial<CanvasCard>>>(new Map());
  const flushTimer = useRef<number | null>(null);

  const refetch = useCallback(async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from("canvas_cards" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (!error) setCards(((data as any) ?? []) as CanvasCard[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  const create = useCallback(async (partial: Partial<CanvasCard> & { kind: CanvasKind; lane?: CanvasLane }) => {
    if (!projectId) return null;
    const insert = {
      project_id: projectId,
      lane: partial.lane ?? "ideas",
      x: partial.x ?? 24,
      y: partial.y ?? 24,
      w: partial.w ?? 240,
      h: partial.h ?? 160,
      kind: partial.kind,
      work_attachment_id: partial.work_attachment_id ?? null,
      goal_id: partial.goal_id ?? null,
      contract_id: partial.contract_id ?? null,
      deliverable_id: partial.deliverable_id ?? null,
      payload: partial.payload ?? {},
    };
    const { data, error } = await supabase
      .from("canvas_cards" as any)
      .insert(insert as any)
      .select("*")
      .single();
    if (error || !data) return null;
    setCards((prev) => [...prev, data as unknown as CanvasCard]);
    return data as unknown as CanvasCard;
  }, [projectId]);

  const flushUpdates = useCallback(async () => {
    const pending = pendingUpdates.current;
    pendingUpdates.current = new Map();
    flushTimer.current = null;
    for (const [id, patch] of pending.entries()) {
      await supabase.from("canvas_cards" as any).update(patch as any).eq("id", id);
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) window.clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(flushUpdates, 350);
  }, [flushUpdates]);

  const patch = useCallback((id: string, changes: Partial<CanvasCard>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    const existing = pendingUpdates.current.get(id) ?? {};
    pendingUpdates.current.set(id, { ...existing, ...changes });
    scheduleFlush();
  }, [scheduleFlush]);

  const remove = useCallback(async (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("canvas_cards" as any).delete().eq("id", id);
  }, []);

  return { cards, loading, create, patch, remove, refetch };
};

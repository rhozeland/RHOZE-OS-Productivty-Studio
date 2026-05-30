/**
 * AiRoadmapDraftButton — "Draft with AI" entry point shown at the top of an
 * empty (or near-empty) project roadmap. Calls the `draft-project-roadmap`
 * edge function and writes the returned milestones into `project_goals` as
 * top-level stages the user can then edit, reorder, or delete inline.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAiRoadmapDraft } from "@/hooks/useAiRoadmapDraft";

interface Props {
  projectId: string;
  projectTitle: string;
  totalBudget: number;
  clientId?: string | null;
  specialistId?: string | null;
  existingGoalCount: number;
}

export const AiRoadmapDraftButton = ({
  projectId,
  projectTitle,
  totalBudget,
  clientId,
  specialistId,
  existingGoalCount,
}: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const draft = useAiRoadmapDraft();
  const [busy, setBusy] = useState(false);

  const generate = useMutation({
    mutationFn: async () => {
      setBusy(true);
      // Fetch both profiles for richer context.
      const ids = [clientId, specialistId].filter(Boolean) as string[];
      const { data: profiles } = ids.length
        ? await supabase
            .from("profiles")
            .select("user_id, display_name, username, archetype, bio, creator_roles")
            .in("user_id", ids)
        : { data: [] as any[] };

      const findProfile = (id?: string | null) => profiles?.find((p: any) => p.user_id === id);
      const c = findProfile(clientId);
      const s = findProfile(specialistId);

      const milestones = await draft.mutateAsync({
        projectName: projectTitle,
        totalBudget,
        clientProfile: c ? {
          name: c.display_name || c.username || "Client",
          archetype: c.archetype, bio: c.bio,
        } : undefined,
        specialistProfile: s ? {
          name: s.display_name || s.username || "Creator",
          archetype: s.archetype, bio: s.bio,
          roles: (s.creator_roles ?? []) as string[],
        } : undefined,
      });

      if (!milestones.length) throw new Error("AI returned no milestones");

      // Insert as top-level project_goals.
      const rows = milestones.map((m, i) => ({
        project_id: projectId,
        user_id: user!.id,
        title: m.title,
        description: m.deliverables,
        budget_amount: m.suggested_amount,
        sort_order: existingGoalCount + i,
        parent_id: null,
      })) as any;
      const { error } = await supabase.from("project_goals" as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-goals", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Rhozeland AI drafted your roadmap — edit anything you want.");
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't draft roadmap"),
    onSettled: () => setBusy(false),
  });

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10"
      disabled={busy || generate.isPending}
      onClick={() => generate.mutate()}
    >
      {busy || generate.isPending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Sparkles className="h-3.5 w-3.5 text-primary" />}
      {existingGoalCount > 0 ? "Add AI milestones" : "Draft roadmap with AI"}
    </Button>
  );
};

export default AiRoadmapDraftButton;

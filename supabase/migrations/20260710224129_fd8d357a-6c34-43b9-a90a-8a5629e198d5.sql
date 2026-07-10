CREATE TABLE public.canvas_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  lane text NOT NULL DEFAULT 'ideas' CHECK (lane IN ('ideas','in_progress','review','released')),
  x integer NOT NULL DEFAULT 0,
  y integer NOT NULL DEFAULT 0,
  w integer NOT NULL DEFAULT 240,
  h integer NOT NULL DEFAULT 160,
  kind text NOT NULL CHECK (kind IN ('media','milestone','moodboard','sticky','contract','deliverable')),
  work_attachment_id uuid REFERENCES public.work_attachments(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES public.project_goals(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.project_contracts(id) ON DELETE CASCADE,
  deliverable_id uuid REFERENCES public.project_deliverables(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX canvas_cards_project_idx ON public.canvas_cards(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canvas_cards TO authenticated;
GRANT ALL ON public.canvas_cards TO service_role;

ALTER TABLE public.canvas_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read canvas cards"
  ON public.canvas_cards FOR SELECT TO authenticated
  USING (public.project_member_role(project_id, auth.uid()) IS NOT NULL);

CREATE POLICY "members insert canvas cards"
  ON public.canvas_cards FOR INSERT TO authenticated
  WITH CHECK (public.project_member_role(project_id, auth.uid()) IS NOT NULL);

CREATE POLICY "members update canvas cards"
  ON public.canvas_cards FOR UPDATE TO authenticated
  USING (public.project_member_role(project_id, auth.uid()) IS NOT NULL)
  WITH CHECK (public.project_member_role(project_id, auth.uid()) IS NOT NULL);

CREATE POLICY "members delete canvas cards"
  ON public.canvas_cards FOR DELETE TO authenticated
  USING (public.project_member_role(project_id, auth.uid()) IS NOT NULL);

CREATE TRIGGER canvas_cards_updated_at
  BEFORE UPDATE ON public.canvas_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.canvas_cards;
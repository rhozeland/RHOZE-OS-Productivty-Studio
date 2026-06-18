
ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS board_x integer,
  ADD COLUMN IF NOT EXISTS board_y integer,
  ADD COLUMN IF NOT EXISTS board_width integer,
  ADD COLUMN IF NOT EXISTS board_height integer,
  ADD COLUMN IF NOT EXISTS board_rotation numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS board_z integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bg_removed boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.project_board_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('note','drawing','shape')),
  x integer NOT NULL DEFAULT 0,
  y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 220,
  height integer NOT NULL DEFAULT 180,
  rotation numeric NOT NULL DEFAULT 0,
  z integer NOT NULL DEFAULT 0,
  color text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_board_elements TO authenticated;
GRANT ALL ON public.project_board_elements TO service_role;

ALTER TABLE public.project_board_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board elements: read by project viewers"
ON public.project_board_elements FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND (
        p.user_id = auth.uid()
        OR p.is_public = true
        OR EXISTS (
          SELECT 1 FROM public.project_collaborators c
          WHERE c.project_id = p.id AND c.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "board elements: write by project members"
ON public.project_board_elements FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_collaborators c
          WHERE c.project_id = p.id AND c.user_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_collaborators c
          WHERE c.project_id = p.id AND c.user_id = auth.uid()
        )
      )
  )
);

CREATE INDEX IF NOT EXISTS project_board_elements_project_idx
  ON public.project_board_elements(project_id);

CREATE OR REPLACE FUNCTION public.touch_board_element_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_board_element ON public.project_board_elements;
CREATE TRIGGER trg_touch_board_element
BEFORE UPDATE ON public.project_board_elements
FOR EACH ROW EXECUTE FUNCTION public.touch_board_element_updated_at();

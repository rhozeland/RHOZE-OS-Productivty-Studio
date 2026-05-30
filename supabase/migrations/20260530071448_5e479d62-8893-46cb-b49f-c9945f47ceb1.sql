-- Wave D: link an approved creator token to a project + roadmap copilot chat

-- 1. projects.linked_token_id (nullable FK to creator_tokens)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS linked_token_id uuid REFERENCES public.creator_tokens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_linked_token ON public.projects(linked_token_id) WHERE linked_token_id IS NOT NULL;

-- Guard: only project owner can link, and only their own approved token
CREATE OR REPLACE FUNCTION public.enforce_project_linked_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok RECORD;
BEGIN
  IF NEW.linked_token_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT user_id, status INTO tok FROM public.creator_tokens WHERE id = NEW.linked_token_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found';
  END IF;
  IF tok.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Can only link your own approved coin to a project';
  END IF;
  IF tok.status <> 'approved' THEN
    RAISE EXCEPTION 'Token is not approved yet';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_project_linked_token_trg ON public.projects;
CREATE TRIGGER enforce_project_linked_token_trg
  BEFORE INSERT OR UPDATE OF linked_token_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_project_linked_token();

-- 2. project_copilot_messages — chat log for the Roadmap Copilot
CREATE TABLE IF NOT EXISTS public.project_copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  proposed_changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_msgs_project ON public.project_copilot_messages(project_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.project_copilot_messages TO authenticated;
GRANT ALL ON public.project_copilot_messages TO service_role;

ALTER TABLE public.project_copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members read copilot messages"
ON public.project_copilot_messages FOR SELECT
TO authenticated
USING (public.project_member_role(project_id, auth.uid()) IS NOT NULL);

CREATE POLICY "Project members write copilot messages"
ON public.project_copilot_messages FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.project_member_role(project_id, auth.uid()) IS NOT NULL
);

CREATE POLICY "Project members delete their copilot messages"
ON public.project_copilot_messages FOR DELETE
TO authenticated
USING (user_id = auth.uid());

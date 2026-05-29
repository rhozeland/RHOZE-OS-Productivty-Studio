-- v11 Tier 3: Music-native archetype expansion
-- Old: artist | builder | influencer
-- New: musician | producer | engineer | visual | promoter
-- Migration map: artist→musician, builder→producer, influencer→promoter

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_archetype_check;

UPDATE public.profiles SET archetype = 'musician' WHERE archetype = 'artist';
UPDATE public.profiles SET archetype = 'producer' WHERE archetype = 'builder';
UPDATE public.profiles SET archetype = 'promoter' WHERE archetype = 'influencer';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_archetype_check
  CHECK (
    archetype IS NULL
    OR archetype = ANY (ARRAY['musician','producer','engineer','visual','promoter']::text[])
  );

-- v11 Tier 3: Public release pages
-- Add is_public flag + tokenize-ready flag to projects.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS cheer_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokenize_ready boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_projects_public ON public.projects(is_public) WHERE is_public = true;

-- Allow public read of projects.is_public rows (with restricted columns enforced at app layer)
DROP POLICY IF EXISTS "Public projects are viewable by anyone" ON public.projects;
CREATE POLICY "Public projects are viewable by anyone"
ON public.projects
FOR SELECT
TO anon, authenticated
USING (is_public = true);

GRANT SELECT ON public.projects TO anon;

-- Cheers table — free counter on public releases
CREATE TABLE IF NOT EXISTS public.project_cheers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.project_cheers TO authenticated;
GRANT SELECT ON public.project_cheers TO anon;
GRANT ALL ON public.project_cheers TO service_role;

ALTER TABLE public.project_cheers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cheers visible on public projects"
ON public.project_cheers
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_public = true)
);

CREATE POLICY "Authenticated users can cheer public projects"
ON public.project_cheers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_public = true)
);

CREATE POLICY "Users can remove their own cheer"
ON public.project_cheers
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Cheer count denormalization trigger
CREATE OR REPLACE FUNCTION public.sync_project_cheer_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects SET cheer_count = cheer_count + 1 WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.projects SET cheer_count = GREATEST(cheer_count - 1, 0) WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_cheer_count ON public.project_cheers;
CREATE TRIGGER trg_sync_project_cheer_count
  AFTER INSERT OR DELETE ON public.project_cheers
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_cheer_count();

-- Slug generator: only when toggling is_public true and no slug yet
CREATE OR REPLACE FUNCTION public.ensure_project_public_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  suffix int := 0;
BEGIN
  IF NEW.is_public AND (NEW.public_slug IS NULL OR NEW.public_slug = '') THEN
    base := lower(regexp_replace(coalesce(NEW.title, 'release'), '[^a-zA-Z0-9]+', '-', 'g'));
    base := trim(both '-' from base);
    IF base = '' THEN base := 'release'; END IF;
    base := left(base, 48);
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM public.projects WHERE public_slug = candidate AND id <> NEW.id) LOOP
      suffix := suffix + 1;
      candidate := base || '-' || suffix::text;
    END LOOP;
    NEW.public_slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_project_public_slug ON public.projects;
CREATE TRIGGER trg_ensure_project_public_slug
  BEFORE INSERT OR UPDATE OF is_public, title ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.ensure_project_public_slug();

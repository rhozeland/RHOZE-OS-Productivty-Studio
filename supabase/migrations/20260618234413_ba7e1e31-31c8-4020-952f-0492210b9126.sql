
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS archetypes text[] NOT NULL DEFAULT '{}';

UPDATE public.profiles
SET archetypes = ARRAY[archetype]
WHERE archetype IS NOT NULL
  AND (archetypes IS NULL OR array_length(archetypes, 1) IS NULL);

CREATE OR REPLACE FUNCTION public.sync_profile_archetype()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.archetypes IS NOT NULL AND array_length(NEW.archetypes, 1) >= 1 THEN
    NEW.archetype := NEW.archetypes[1];
  ELSIF NEW.archetype IS NOT NULL AND (NEW.archetypes IS NULL OR array_length(NEW.archetypes, 1) IS NULL) THEN
    NEW.archetypes := ARRAY[NEW.archetype];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_archetype_trg ON public.profiles;
CREATE TRIGGER sync_profile_archetype_trg
BEFORE INSERT OR UPDATE OF archetypes, archetype ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_archetype();

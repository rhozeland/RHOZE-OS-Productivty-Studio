
-- Add username and wallet_address columns
ALTER TABLE public.profiles
ADD COLUMN username TEXT,
ADD COLUMN wallet_address TEXT;

-- Unique index on lowercase username (case-insensitive)
CREATE UNIQUE INDEX idx_profiles_username_lower ON public.profiles (lower(username));

-- Username validation trigger
CREATE OR REPLACE FUNCTION public.validate_username()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    IF LENGTH(NEW.username) < 3 OR LENGTH(NEW.username) > 20 THEN
      RAISE EXCEPTION 'Username must be between 3 and 20 characters';
    END IF;
    IF NEW.username !~ '^[a-zA-Z0-9_]+$' THEN
      RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_username_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_username();

-- Update lookup function to also search by username
CREATE OR REPLACE FUNCTION public.lookup_user_by_display_name(_name text)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, COALESCE(p.display_name, p.username) as display_name
  FROM public.profiles p
  WHERE lower(p.display_name) LIKE '%' || lower(_name) || '%'
     OR lower(p.username) LIKE '%' || lower(_name) || '%'
  ORDER BY
    CASE WHEN lower(p.username) = lower(_name) THEN 0
         WHEN lower(p.display_name) = lower(_name) THEN 0
         ELSE 1 END,
    p.display_name
  LIMIT 10;
$$;

-- Exact username lookup
CREATE OR REPLACE FUNCTION public.check_username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(_username)
  );
$$;

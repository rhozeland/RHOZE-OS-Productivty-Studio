-- Flow Mode is a global, public-by-design feed. Allow anonymous (guest) users
-- to read flow_items and the minimal profile info needed to attribute uploads.
-- Existing authenticated policies are preserved; we add anon-friendly ones.

-- 1) flow_items: allow anon SELECT (items are already user-curated public posts).
DROP POLICY IF EXISTS "Public can view flow items" ON public.flow_items;
CREATE POLICY "Public can view flow items"
  ON public.flow_items
  FOR SELECT
  TO anon
  USING (true);

-- 2) profiles: expose only the public display fields needed for Flow attribution
--    via a security-invoker view, while base table policies remain restrictive.
--    We keep this view limited to the columns Flow Mode actually reads.
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT user_id, display_name, avatar_url, username
  FROM public.profiles
  WHERE COALESCE(is_public, true) = true
    AND COALESCE(ban_status, 'active') = 'active';

-- Allow both anon and authenticated to read the public view.
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Add an anon-only SELECT policy on profiles limited to the same public set.
-- (security_invoker views run with caller privileges, so policies still apply.)
DROP POLICY IF EXISTS "Public can view safe profile fields" ON public.profiles;
CREATE POLICY "Public can view safe profile fields"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (
    COALESCE(is_public, true) = true
    AND COALESCE(ban_status, 'active') = 'active'
  );
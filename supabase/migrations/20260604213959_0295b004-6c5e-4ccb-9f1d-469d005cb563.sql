CREATE POLICY "Public can view public profiles"
ON public.profiles
FOR SELECT
USING (
  COALESCE(is_public, true) = true
  AND COALESCE(ban_status, 'active'::text) = 'active'::text
);
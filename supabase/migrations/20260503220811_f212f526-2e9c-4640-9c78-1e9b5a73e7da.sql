-- Mirror the existing anon "Public can view safe profile fields" policy
-- for authenticated users so signed-in users can browse other public
-- profiles (Discover Featured, search, profile pages, etc.). Without
-- this, the only authenticated read path was "view own profile" which
-- silently hid every other user.
CREATE POLICY "Authenticated can view public profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  COALESCE(is_public, true) = true
  AND COALESCE(ban_status, 'active'::text) = 'active'::text
);
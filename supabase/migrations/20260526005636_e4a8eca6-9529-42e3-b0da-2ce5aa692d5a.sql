-- Remove broad SELECT policies on public.profiles that exposed all columns
-- (including shipping_*) to any authenticated / anon visitor. The
-- `get_public_profile` SECURITY DEFINER RPC is the canonical public read
-- path; owners and admins retain full-row access via the remaining policies.
DROP POLICY IF EXISTS "Authenticated can view public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view safe profile fields" ON public.profiles;
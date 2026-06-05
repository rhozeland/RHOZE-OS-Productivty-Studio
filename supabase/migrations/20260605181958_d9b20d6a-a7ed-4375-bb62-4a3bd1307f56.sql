
-- 1) user_notes: drop the unscoped policy that let any authenticated user read all notes.
DROP POLICY IF EXISTS "Active notes readable by authenticated users" ON public.user_notes;

-- 2) profiles: revoke column-level SELECT on shipping address fields from anon and authenticated.
--    Owners read these via the existing SECURITY DEFINER RPC public.get_my_private_profile_fields().
--    Admins still have row access via the "Admins can view all profiles" policy + service_role grants.
REVOKE SELECT (
  shipping_address_line1,
  shipping_address_line2,
  shipping_city,
  shipping_state,
  shipping_zip,
  shipping_country
) ON public.profiles FROM anon, authenticated;

-- Ensure service_role still has full access (idempotent).
GRANT ALL ON public.profiles TO service_role;

-- Replace the public-only SELECT policy with a subscriber-aware one.
-- Owners still have the existing "Owners can view their works" policy.
DROP POLICY IF EXISTS "Public works are viewable by everyone" ON public.works;

CREATE POLICY "Public or subscribed works are viewable"
  ON public.works
  FOR SELECT
  USING (
    visibility = 'public'
    OR (
      auth.uid() IS NOT NULL
      AND auth.uid() <> user_id
      AND public.is_subscribed_to(user_id)
    )
  );

-- Count of locked (non-public) works for a creator, from the viewer's POV.
-- Used by profile/works UI to render a subscriber upsell card.
CREATE OR REPLACE FUNCTION public.count_locked_works_for_creator(_creator_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.works
  WHERE user_id = _creator_id
    AND visibility <> 'public'
    AND (auth.uid() IS NULL OR auth.uid() <> _creator_id)
    AND (auth.uid() IS NULL OR NOT public.is_subscribed_to(_creator_id));
$$;

GRANT EXECUTE ON FUNCTION public.count_locked_works_for_creator(uuid) TO anon, authenticated;
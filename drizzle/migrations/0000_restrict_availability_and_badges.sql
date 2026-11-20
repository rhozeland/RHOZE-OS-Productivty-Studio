DROP POLICY IF EXISTS "Authenticated users can view creator availability" ON public.creator_availability;
DROP POLICY IF EXISTS "Authenticated users can view recurring availability" ON public.creator_availability_recurring;
DROP POLICY IF EXISTS "Anyone can view user badges" ON public.user_badges;

DROP POLICY IF EXISTS "Owner or admin can view availability" ON public.creator_availability;
CREATE POLICY "Owner or admin can view availability" ON public.creator_availability FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Owner or admin can view recurring availability" ON public.creator_availability_recurring;
CREATE POLICY "Owner or admin can view recurring availability" ON public.creator_availability_recurring FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Owner or admin can view user badges" ON public.user_badges;
CREATE POLICY "Owner or admin can view user badges" ON public.user_badges FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_creator_availability(_creator uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(id uuid, user_id uuid, start_time timestamptz, end_time timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.user_id, a.start_time, a.end_time FROM public.creator_availability a
  WHERE auth.uid() IS NOT NULL AND a.user_id = _creator AND a.start_time >= _from AND a.start_time <= _to
$$;
CREATE OR REPLACE FUNCTION public.get_creator_recurring_availability(_creator uuid)
RETURNS TABLE(id uuid, user_id uuid, weekday int, start_minute int, end_minute int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.user_id, r.weekday::int, r.start_minute::int, r.end_minute::int FROM public.creator_availability_recurring r
  WHERE auth.uid() IS NOT NULL AND r.user_id = _creator
$$;
CREATE OR REPLACE FUNCTION public.get_user_badge_ids(_user uuid)
RETURNS TABLE(badge_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ub.badge_id FROM public.user_badges ub WHERE ub.user_id = _user
$$;
REVOKE ALL ON FUNCTION public.get_creator_availability(uuid,timestamptz,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_creator_recurring_availability(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_availability(uuid,timestamptz,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_creator_recurring_availability(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_badge_ids(uuid) TO anon, authenticated;
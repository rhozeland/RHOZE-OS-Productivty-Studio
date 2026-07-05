
-- Tighten flow_comments SELECT to parent flow_items visibility
DROP POLICY IF EXISTS "flow_comments_select_all" ON public.flow_comments;
CREATE POLICY "flow_comments_select_visible_parent"
ON public.flow_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.flow_items fi
    WHERE fi.id = flow_comments.flow_item_id
      AND (fi.archived_at IS NULL OR fi.user_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Tighten flow_reposts SELECT to parent flow_items visibility
DROP POLICY IF EXISTS "Anyone can view reposts" ON public.flow_reposts;
CREATE POLICY "flow_reposts_select_visible_parent"
ON public.flow_reposts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.flow_items fi
    WHERE fi.id = flow_reposts.flow_item_id
      AND (fi.archived_at IS NULL OR fi.user_id = auth.uid())
  )
  OR auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Restrict creator_availability SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can view creator availability" ON public.creator_availability;
CREATE POLICY "Authenticated users can view creator availability"
ON public.creator_availability
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Recurring availability is publicly viewable" ON public.creator_availability_recurring;
CREATE POLICY "Authenticated users can view recurring availability"
ON public.creator_availability_recurring
FOR SELECT
TO authenticated
USING (true);

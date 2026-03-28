-- Allow studio owners to insert staff for their studios
CREATE POLICY "Studio owners can insert staff"
ON public.staff_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.studios
    WHERE studios.id = staff_members.studio_id
      AND studios.owner_id = auth.uid()
  )
);

-- Allow studio owners to manage (update/delete) staff for their studios
CREATE POLICY "Studio owners can update staff"
ON public.staff_members FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.studios
    WHERE studios.id = staff_members.studio_id
      AND studios.owner_id = auth.uid()
  )
);

CREATE POLICY "Studio owners can delete staff"
ON public.staff_members FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.studios
    WHERE studios.id = staff_members.studio_id
      AND studios.owner_id = auth.uid()
  )
);

-- Allow users to view their own staff records (even if not available yet)
CREATE POLICY "Users can view own staff records"
ON public.staff_members FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Allow users to update their own staff record (accept/decline)
CREATE POLICY "Users can update own staff status"
ON public.staff_members FOR UPDATE TO authenticated
USING (user_id = auth.uid());
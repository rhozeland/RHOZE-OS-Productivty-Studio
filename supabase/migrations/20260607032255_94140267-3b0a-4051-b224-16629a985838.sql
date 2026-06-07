
-- 1) Tighten event_collaborators SELECT: don't leak draft event team lists
DROP POLICY IF EXISTS "Read collaborators when event readable" ON public.event_collaborators;

CREATE POLICY "Read collaborators when event readable"
ON public.event_collaborators
FOR SELECT
USING (
  -- Host / managers always see their team
  can_manage_event(event_id, auth.uid())
  -- Invitee sees their own row
  OR auth.uid() = user_id
  -- Public can only see collaborators on published/completed events
  OR EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_collaborators.event_id
      AND e.status IN ('published','completed')
  )
);

-- 2) Allow admins to read suppressed_emails for deliverability management
CREATE POLICY "Admins can read suppressed emails"
ON public.suppressed_emails
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

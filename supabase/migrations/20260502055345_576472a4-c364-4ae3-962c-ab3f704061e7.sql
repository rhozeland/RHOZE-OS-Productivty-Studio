-- Event collaborators (co-hosts / managers) with RLS allowing them to manage the event.
CREATE TYPE event_collaborator_role AS ENUM ('co_host', 'manager');

CREATE TABLE public.event_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role event_collaborator_role NOT NULL DEFAULT 'co_host',
  invited_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX event_collaborators_event_idx ON public.event_collaborators(event_id);
CREATE INDEX event_collaborators_user_idx ON public.event_collaborators(user_id);

ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;

-- Helper: can the caller manage this event (host or active collaborator)?
CREATE OR REPLACE FUNCTION public.can_manage_event(_event_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.host_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.event_collaborators c
    WHERE c.event_id = _event_id AND c.user_id = _user_id
  );
$$;

-- Anyone signed in can read collaborator rows for events they can already see;
-- keep it simple: collaborators visible to anyone who can read the event.
CREATE POLICY "Read collaborators when event readable"
ON public.event_collaborators
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = event_id
  )
);

-- Only the host (or existing managers) can add/remove collaborators.
CREATE POLICY "Host or managers can add collaborators"
ON public.event_collaborators
FOR INSERT
WITH CHECK (
  public.can_manage_event(event_id, auth.uid())
  AND auth.uid() = invited_by
);

CREATE POLICY "Host or managers can remove collaborators"
ON public.event_collaborators
FOR DELETE
USING (
  public.can_manage_event(event_id, auth.uid())
);

CREATE POLICY "Host or managers can update collaborator roles"
ON public.event_collaborators
FOR UPDATE
USING (public.can_manage_event(event_id, auth.uid()));

-- Extend existing events table policies so collaborators can update/manage too.
-- (We add a parallel UPDATE policy; existing host policies remain.)
CREATE POLICY "Collaborators can update event"
ON public.events
FOR UPDATE
USING (
  public.can_manage_event(id, auth.uid())
);

-- Allow collaborators to manage tiers and read/check-in tickets.
CREATE POLICY "Collaborators manage tiers"
ON public.event_ticket_tiers
FOR ALL
USING (public.can_manage_event(event_id, auth.uid()))
WITH CHECK (public.can_manage_event(event_id, auth.uid()));

CREATE POLICY "Collaborators read tickets"
ON public.event_tickets
FOR SELECT
USING (public.can_manage_event(event_id, auth.uid()));

CREATE POLICY "Collaborators update tickets"
ON public.event_tickets
FOR UPDATE
USING (public.can_manage_event(event_id, auth.uid()));
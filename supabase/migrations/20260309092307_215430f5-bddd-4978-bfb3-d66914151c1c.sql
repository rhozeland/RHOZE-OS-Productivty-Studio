
-- Add project_id to bookings so we can link generated projects
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create the function that generates a project when a booking is confirmed
CREATE OR REPLACE FUNCTION public.generate_project_from_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_service record;
  v_project_id uuid;
  v_admin_user_id uuid;
  v_milestone_titles text[] := ARRAY['Kickoff & Prep', 'Delivery', 'Revision'];
  v_milestone_descs text[] := ARRAY['Initial session setup and preparation', 'Primary deliverable completion', 'Final revisions and sign-off'];
  v_i int;
BEGIN
  -- Only trigger when status changes to confirmed
  IF NEW.status != 'confirmed' OR (OLD.status = 'confirmed') THEN
    RETURN NEW;
  END IF;

  -- Don't re-generate if project already linked
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get service info if available
  SELECT * INTO v_service FROM public.services WHERE id = NEW.service_id;

  -- Create the project (owned by the booking user)
  INSERT INTO public.projects (user_id, title, description, status, cover_color)
  VALUES (
    NEW.user_id,
    COALESCE(v_service.title, NEW.title) || ' — Project',
    'Auto-generated from booking on ' || to_char(NEW.start_time, 'Mon DD, YYYY') || '. ' || COALESCE(v_service.description, ''),
    'active',
    '#2dd4a8'
  )
  RETURNING id INTO v_project_id;

  -- Link project back to booking
  NEW.project_id := v_project_id;

  -- Create milestones as project_goals with due dates spread across the booking duration
  FOR v_i IN 1..3 LOOP
    INSERT INTO public.project_goals (project_id, user_id, title, description, status, priority, due_date)
    VALUES (
      v_project_id,
      NEW.user_id,
      v_milestone_titles[v_i],
      v_milestone_descs[v_i],
      CASE WHEN v_i = 1 THEN 'in_progress' ELSE 'pending' END,
      CASE WHEN v_i = 1 THEN 'high' WHEN v_i = 2 THEN 'high' ELSE 'medium' END,
      NEW.start_time + ((NEW.end_time - NEW.start_time) * v_i / 3)
    );
  END LOOP;

  -- Look up configurable admin from studio_settings
  SELECT value::uuid INTO v_admin_user_id
  FROM public.studio_settings
  WHERE key = 'service_project_admin'
    AND value IS NOT NULL
    AND value != '';

  -- Add admin as collaborator if configured
  IF v_admin_user_id IS NOT NULL THEN
    INSERT INTO public.project_collaborators (project_id, user_id, invited_by, role)
    VALUES (v_project_id, v_admin_user_id, NEW.user_id, 'editor')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on bookings
DROP TRIGGER IF EXISTS trg_booking_confirmed_project ON public.bookings;
CREATE TRIGGER trg_booking_confirmed_project
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_project_from_booking();

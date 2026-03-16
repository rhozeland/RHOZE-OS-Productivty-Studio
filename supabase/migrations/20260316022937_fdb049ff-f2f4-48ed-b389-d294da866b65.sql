
-- Staff members table for booking assignments
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  specialties text[] DEFAULT '{}',
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available staff" ON public.staff_members
  FOR SELECT TO authenticated USING (is_available = true);

CREATE POLICY "Admins can view all staff" ON public.staff_members
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert staff" ON public.staff_members
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update staff" ON public.staff_members
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete staff" ON public.staff_members
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Add staff_member_id to bookings
ALTER TABLE public.bookings ADD COLUMN staff_member_id uuid REFERENCES public.staff_members(id);

-- Badge definitions
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  icon text DEFAULT 'award',
  color text DEFAULT '#7c3aed',
  badge_type text NOT NULL DEFAULT 'manual',
  auto_criteria jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges" ON public.badges
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage badges" ON public.badges
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- User badges (assigned)
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  awarded_by uuid,
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user badges" ON public.user_badges
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can assign badges" ON public.user_badges
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can remove badges" ON public.user_badges
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Seed default badge types
INSERT INTO public.badges (name, label, description, icon, color, badge_type, sort_order) VALUES
  ('in_house', 'In-House', 'Official Rhozeland team member', 'building', '#2dd4a8', 'manual', 1),
  ('specialist', 'Specialist', 'Verified specialist in their craft', 'star', '#f59e0b', 'manual', 2),
  ('community', 'Community', 'Active community contributor', 'users', '#7c3aed', 'auto', 3),
  ('fan', 'Fan', 'Supporter of the creative ecosystem', 'heart', '#ec4899', 'auto', 4),
  ('verified', 'Verified', 'Verified creator identity', 'check-circle', '#3b82f6', 'manual', 5);

-- Trigger for updated_at on staff_members
CREATE TRIGGER update_staff_members_updated_at
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

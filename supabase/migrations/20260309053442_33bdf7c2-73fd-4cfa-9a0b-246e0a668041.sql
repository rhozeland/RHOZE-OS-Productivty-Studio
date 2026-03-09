
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. RLS policies for user_roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Studio settings table
CREATE TABLE public.studio_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view studio settings"
  ON public.studio_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage studio settings"
  ON public.studio_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Admin policies for services (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can insert services"
  ON public.services FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update services"
  ON public.services FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete services"
  ON public.services FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Admin policies for viewing all bookings
CREATE POLICY "Admins can view all bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 8. Admin policies for viewing all user_credits
CREATE POLICY "Admins can view all credits"
  ON public.user_credits FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 9. Admin policies for viewing all credit_transactions
CREATE POLICY "Admins can view all transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 10. Seed default studio settings
INSERT INTO public.studio_settings (key, value) VALUES
  ('studio_name', 'Rhozeland Studio'),
  ('studio_hours', '{"mon":"10:00-22:00","tue":"10:00-22:00","wed":"10:00-22:00","thu":"10:00-22:00","fri":"10:00-22:00","sat":"12:00-20:00","sun":"closed"}'),
  ('credit_rate_usd', '75'),
  ('booking_lead_time_hours', '24'),
  ('max_booking_duration_hours', '8'),
  ('studio_address', ''),
  ('studio_phone', ''),
  ('studio_email', '');

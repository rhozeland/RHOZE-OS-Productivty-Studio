
-- Studios table (Airbnb-style studio spaces)
CREATE TABLE public.studios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  location TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Canada',
  hourly_rate NUMERIC NOT NULL DEFAULT 50,
  daily_rate NUMERIC,
  currency TEXT NOT NULL DEFAULT 'CAD',
  amenities TEXT[] DEFAULT '{}',
  equipment TEXT[] DEFAULT '{}',
  rules TEXT,
  max_guests INTEGER DEFAULT 10,
  cover_image_url TEXT,
  gallery_urls TEXT[] DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'recording',
  status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT false,
  rating_avg NUMERIC DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Studio availability windows
CREATE TABLE public.studio_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '22:00',
  is_available BOOLEAN NOT NULL DEFAULT true
);

-- Studio bookings
CREATE TABLE public.studio_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  total_price NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'credits',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  guest_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Studio reviews
CREATE TABLE public.studio_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  booking_id UUID REFERENCES public.studio_bookings(id),
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Studio applications (for approval workflow)
CREATE TABLE public.studio_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  studio_name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  website_url TEXT,
  portfolio_url TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_applications ENABLE ROW LEVEL SECURITY;

-- Studios policies
CREATE POLICY "Anyone can view active studios" ON public.studios FOR SELECT USING (is_active = true AND status = 'approved');
CREATE POLICY "Owners can view own studios" ON public.studios FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners can update own studios" ON public.studios FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Authenticated users can create studios" ON public.studios FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins can manage all studios" ON public.studios FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Studio availability policies
CREATE POLICY "Anyone can view studio availability" ON public.studio_availability FOR SELECT USING (true);
CREATE POLICY "Owners can manage availability" ON public.studio_availability FOR ALL TO authenticated USING (studio_id IN (SELECT id FROM studios WHERE owner_id = auth.uid())) WITH CHECK (studio_id IN (SELECT id FROM studios WHERE owner_id = auth.uid()));

-- Studio bookings policies
CREATE POLICY "Users can view own bookings" ON public.studio_bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Studio owners can view bookings" ON public.studio_bookings FOR SELECT TO authenticated USING (studio_id IN (SELECT id FROM studios WHERE owner_id = auth.uid()));
CREATE POLICY "Users can create bookings" ON public.studio_bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookings" ON public.studio_bookings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all bookings" ON public.studio_bookings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Studio reviews policies
CREATE POLICY "Anyone can view studio reviews" ON public.studio_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews" ON public.studio_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.studio_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON public.studio_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Studio applications policies
CREATE POLICY "Users can create applications" ON public.studio_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own applications" ON public.studio_applications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage applications" ON public.studio_applications FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger for rating updates
CREATE OR REPLACE FUNCTION public.update_studio_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE studios SET
    rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM studio_reviews WHERE studio_id = COALESCE(NEW.studio_id, OLD.studio_id)),
    review_count = (SELECT COUNT(*) FROM studio_reviews WHERE studio_id = COALESCE(NEW.studio_id, OLD.studio_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.studio_id, OLD.studio_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_studio_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON public.studio_reviews
  FOR EACH ROW EXECUTE FUNCTION update_studio_rating();

-- Review rating validation trigger
CREATE OR REPLACE FUNCTION public.validate_studio_review_rating()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_studio_review_rating_trigger
  BEFORE INSERT OR UPDATE ON public.studio_reviews
  FOR EACH ROW EXECUTE FUNCTION validate_studio_review_rating();

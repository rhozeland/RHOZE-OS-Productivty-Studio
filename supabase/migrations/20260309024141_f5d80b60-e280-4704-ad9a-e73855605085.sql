
-- Create Rhozeland services table (the studio services offered)
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'audio',
  credits_cost NUMERIC NOT NULL DEFAULT 1,
  duration_hours NUMERIC NOT NULL DEFAULT 2,
  non_member_rate NUMERIC,
  revisions_info TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_hours NUMERIC NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'upcoming',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Services: anyone can view active services
CREATE POLICY "Anyone can view active services" ON public.services
  FOR SELECT USING (is_active = true);

-- Bookings: users can CRUD own bookings
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookings" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings" ON public.bookings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookings" ON public.bookings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Seed the Rhozeland services from the docs
INSERT INTO public.services (title, description, category, credits_cost, duration_hours, non_member_rate, revisions_info) VALUES
  ('Studio Room Rental', 'A cozy creative space for musicians, artists, and engineers to get their best sound. Fully equipped and ready when you are.', 'audio', 1, 2, 75, '1 Major + 1 Minor included. Extra: $50 (Major), $25 (Minor)'),
  ('Audio Recording', 'Our engineers balance and shape your track so every layer fits and the music feels alive.', 'audio', 2, 2, 150, '1 Major + 1 Minor included. Extra: $50 (Major), $25 (Minor)'),
  ('Mixing', 'Professional mixing to bring clarity and depth to your tracks.', 'audio', 2, 2, 150, '1 Major + 1 Minor included. Extra: $50 (Major), $25 (Minor)'),
  ('Mastering', 'Final polish for your tracks — industry-ready sound.', 'audio', 1, 1, 75, '1 Major + 1 Minor included. Extra: $50 (Major), $25 (Minor)'),
  ('Consult (Roadmap or Branding)', 'Strategic consultation for your creative roadmap or brand identity.', 'consulting', 1, 1, 75, NULL),
  ('UI/UX, Web, or Graphic Design', 'Custom design work for your brand — web, print, or digital.', 'design', 1, 1, 75, '1 Major + 1 Minor included. Extra: $50 (Major), $25 (Minor)'),
  ('Video Edit (Reels, Short Form)', 'Quick-turnaround edits for social content.', 'video', 1, 1, 75, '1 Major + 1 Minor included. Extra: $50 (Major), $25 (Minor)'),
  ('Long Form Edit (MV, Commercial)', 'Full production editing for music videos and commercials.', 'video', 2, 2, 150, '1 Major + 1 Minor included. Extra: $50 (Major), $25 (Minor)'),
  ('Video Recording (Mobile Short Form)', 'Directed short-form video shoots for social platforms.', 'video', 1, 1, 75, '1 Major + 1 Minor included. Extra: $50 (Major), $25 (Minor)'),
  ('Video Recording (MV/Commercial)', 'Full video production for music videos and commercial projects.', 'video', 2, 2, 150, '1 Major + 1 Minor included. Extra: $50 (Major), $25 (Minor)'),
  ('Podcast Recording', 'Full podcast session recording with professional audio.', 'audio', 3, 2, 225, '1 Major + 1 Minor included. Extra: $50 (Major), $25 (Minor)'),
  ('Photo Shoot Hour (incl. Editing)', 'Professional photo session with post-production editing included.', 'photo', 2, 1, 150, '1 Major + 1 Minor included. Extra: $50 (Major), $25 (Minor)'),
  ('Grant Research', 'Dedicated research for funding opportunities relevant to your creative work.', 'consulting', 1, 1, 75, NULL);

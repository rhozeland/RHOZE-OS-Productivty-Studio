-- Creator availability windows (date-based slots a creator opens for booking)
CREATE TABLE public.creator_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT creator_avail_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_creator_availability_user_time ON public.creator_availability(user_id, start_time);

ALTER TABLE public.creator_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creator availability"
ON public.creator_availability FOR SELECT
USING (true);

CREATE POLICY "Owners can insert own availability"
ON public.creator_availability FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own availability"
ON public.creator_availability FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete own availability"
ON public.creator_availability FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_creator_availability_updated_at
  BEFORE UPDATE ON public.creator_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Weekly recurring availability templates
CREATE TABLE IF NOT EXISTS public.creator_availability_recurring (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1440),
  end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 0 AND 1440),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_minute > start_minute)
);

CREATE INDEX IF NOT EXISTS idx_creator_avail_recurring_user ON public.creator_availability_recurring(user_id, weekday);

ALTER TABLE public.creator_availability_recurring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recurring availability is publicly viewable"
  ON public.creator_availability_recurring FOR SELECT USING (true);

CREATE POLICY "Owners insert their own recurring availability"
  ON public.creator_availability_recurring FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners update their own recurring availability"
  ON public.creator_availability_recurring FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners delete their own recurring availability"
  ON public.creator_availability_recurring FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_recurring_avail_updated
  BEFORE UPDATE ON public.creator_availability_recurring
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add meeting room url to bookings (auto-generated Jitsi link)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS meeting_url TEXT;
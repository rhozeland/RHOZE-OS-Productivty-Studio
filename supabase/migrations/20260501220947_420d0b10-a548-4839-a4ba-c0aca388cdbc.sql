ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS attendees text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS reminder_minutes integer;

ALTER TABLE public.drop_rooms ADD COLUMN IF NOT EXISTS enable_video boolean NOT NULL DEFAULT false;
ALTER TABLE public.drop_rooms ADD COLUMN IF NOT EXISTS allow_spectators boolean NOT NULL DEFAULT false;
ALTER TABLE public.drop_rooms ADD COLUMN IF NOT EXISTS enable_recording boolean NOT NULL DEFAULT false;

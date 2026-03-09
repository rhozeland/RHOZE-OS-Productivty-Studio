
-- Add background customization fields to smartboards
ALTER TABLE public.smartboards
  ADD COLUMN IF NOT EXISTS background_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS background_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS background_blur integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS background_opacity integer DEFAULT 100;

-- Add sizing fields to smartboard_items for free resize
ALTER TABLE public.smartboard_items
  ADD COLUMN IF NOT EXISTS item_width integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS item_height integer DEFAULT NULL;

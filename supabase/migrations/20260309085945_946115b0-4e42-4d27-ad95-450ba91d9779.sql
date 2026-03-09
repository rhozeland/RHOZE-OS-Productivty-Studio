ALTER TABLE public.profiles
  ADD COLUMN show_seller_stats boolean DEFAULT true,
  ADD COLUMN show_offerings boolean DEFAULT true,
  ADD COLUMN show_public_boards boolean DEFAULT true;
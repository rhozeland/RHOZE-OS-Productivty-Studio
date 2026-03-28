ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_layout jsonb DEFAULT '["about","stats","offerings","flow_posts","boards"]'::jsonb,
ADD COLUMN IF NOT EXISTS show_flow_posts boolean DEFAULT true;
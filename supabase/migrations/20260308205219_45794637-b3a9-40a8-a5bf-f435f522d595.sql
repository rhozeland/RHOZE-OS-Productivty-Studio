
-- Create marketplace_listings table
CREATE TABLE public.marketplace_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'design',
  price NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  image_url TEXT,
  contact_info TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active listings
CREATE POLICY "Anyone can view active listings"
  ON public.marketplace_listings FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Users can create their own listings
CREATE POLICY "Users can create own listings"
  ON public.marketplace_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update own listings
CREATE POLICY "Users can update own listings"
  ON public.marketplace_listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete own listings
CREATE POLICY "Users can delete own listings"
  ON public.marketplace_listings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

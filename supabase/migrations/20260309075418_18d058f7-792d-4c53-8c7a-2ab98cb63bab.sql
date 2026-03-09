
-- Evolve marketplace_listings for multi-type marketplace
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS credits_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_days integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS revisions integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS cover_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_info text DEFAULT NULL;

-- Listing media table for multi-file support (gallery, audio, video, pdf)
CREATE TABLE public.listing_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text DEFAULT 'image',
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_media ENABLE ROW LEVEL SECURITY;

-- Anyone can view media for active listings
CREATE POLICY "Anyone can view listing media"
  ON public.listing_media FOR SELECT
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.marketplace_listings WHERE is_active = true
    )
  );

-- Owners can manage their listing media
CREATE POLICY "Users can insert own listing media"
  ON public.listing_media FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own listing media"
  ON public.listing_media FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Listing inquiries table
CREATE TABLE public.listing_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  project_id uuid REFERENCES public.projects(id) DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inquiries"
  ON public.listing_inquiries FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create inquiries"
  ON public.listing_inquiries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can update inquiries"
  ON public.listing_inquiries FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id);

-- Create storage bucket for listing media
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-media', 'listing-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for listing-media bucket
CREATE POLICY "Anyone can view listing media files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'listing-media');

CREATE POLICY "Users can upload listing media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'listing-media');

CREATE POLICY "Users can delete own listing media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'listing-media' AND (storage.foldername(name))[1] = auth.uid()::text);

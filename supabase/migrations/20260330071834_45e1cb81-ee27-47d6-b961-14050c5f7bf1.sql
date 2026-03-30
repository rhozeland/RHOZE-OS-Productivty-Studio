
-- Studio services: per-studio custom offerings (optional)
CREATE TABLE public.studio_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  price NUMERIC DEFAULT 0,
  duration_hours NUMERIC DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_services ENABLE ROW LEVEL SECURITY;

-- Studio owners can manage their services
CREATE POLICY "Studio owners can manage own services"
ON public.studio_services
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.studios WHERE studios.id = studio_services.studio_id AND studios.owner_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.studios WHERE studios.id = studio_services.studio_id AND studios.owner_id = auth.uid())
);

-- Anyone can view active studio services
CREATE POLICY "Anyone can view active studio services"
ON public.studio_services
FOR SELECT
TO authenticated
USING (is_active = true);

-- Link table: studios can also reference global services
CREATE TABLE public.studio_global_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(studio_id, service_id)
);

ALTER TABLE public.studio_global_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio owners can manage linked services"
ON public.studio_global_services
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.studios WHERE studios.id = studio_global_services.studio_id AND studios.owner_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.studios WHERE studios.id = studio_global_services.studio_id AND studios.owner_id = auth.uid())
);

CREATE POLICY "Anyone can view linked services"
ON public.studio_global_services
FOR SELECT
TO authenticated
USING (true);

-- Add dock_config to profiles for dock customization
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dock_config JSONB DEFAULT NULL;

-- Create studio-media bucket for cover/gallery/video uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('studio-media', 'studio-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Studio owners can upload media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'studio-media' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM public.studios WHERE owner_id = auth.uid()
));

CREATE POLICY "Anyone can view studio media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'studio-media');

CREATE POLICY "Studio owners can delete own media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'studio-media' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM public.studios WHERE owner_id = auth.uid()
));

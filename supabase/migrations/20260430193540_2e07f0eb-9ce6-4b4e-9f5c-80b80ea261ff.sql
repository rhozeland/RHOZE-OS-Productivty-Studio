-- Works: IP-asset primitive for Rhozeland
-- A "work" is a registerable creative asset (audio, image, video, text, other)
-- with a SHA-256 content hash that can be anchored on Solana via the existing
-- anchor-contribution edge function.

CREATE TABLE public.works (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'other',
  content_hash TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size BIGINT,
  visibility TEXT NOT NULL DEFAULT 'public',
  solana_signature TEXT,
  anchored_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_works_user ON public.works(user_id);
CREATE INDEX idx_works_content_hash ON public.works(content_hash);
CREATE INDEX idx_works_created ON public.works(created_at DESC);
CREATE INDEX idx_works_anchored ON public.works(anchored_at) WHERE solana_signature IS NOT NULL;

ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;

-- Owners can do everything
CREATE POLICY "Owners can view their works"
  ON public.works FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public works are viewable by everyone"
  ON public.works FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "Users can create their own works"
  ON public.works FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own works"
  ON public.works FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own works"
  ON public.works FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_works_updated_at
  BEFORE UPDATE ON public.works
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
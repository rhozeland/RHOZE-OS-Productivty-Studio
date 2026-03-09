
-- Add new columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS mediums text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS headline text;

-- Create connections table (follow + connect model)
CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'follow', -- 'follow' or 'connect'
  status text NOT NULL DEFAULT 'active', -- 'active', 'pending', 'declined'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id, type)
);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Follow: anyone authenticated can follow anyone
CREATE POLICY "Users can follow others"
  ON public.connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

-- Users can view connections they're part of
CREATE POLICY "Users can view own connections"
  ON public.connections FOR SELECT
  TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- Users can update connections they received (accept/decline connect requests)
CREATE POLICY "Users can update received connections"
  ON public.connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = following_id);

-- Users can delete connections they initiated
CREATE POLICY "Users can remove own connections"
  ON public.connections FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- Create avatar-uploads storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatar-uploads', 'avatar-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatar uploads
CREATE POLICY "Users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatar-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatar-uploads');

CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatar-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatar-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

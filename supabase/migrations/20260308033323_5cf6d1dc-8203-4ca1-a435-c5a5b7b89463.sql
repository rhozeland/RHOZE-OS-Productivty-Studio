-- Create storage bucket for moodboard files
INSERT INTO storage.buckets (id, name, public) VALUES ('moodboard', 'moodboard', true);

-- Storage policies
CREATE POLICY "Anyone can view moodboard files" ON storage.objects FOR SELECT USING (bucket_id = 'moodboard');
CREATE POLICY "Auth users can upload moodboard files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'moodboard' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own moodboard files" ON storage.objects FOR DELETE USING (bucket_id = 'moodboard' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Table to track moodboard items per project
CREATE TABLE public.moodboard_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.moodboard_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own moodboard items" ON public.moodboard_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert moodboard items" ON public.moodboard_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own moodboard items" ON public.moodboard_items FOR DELETE USING (auth.uid() = user_id);
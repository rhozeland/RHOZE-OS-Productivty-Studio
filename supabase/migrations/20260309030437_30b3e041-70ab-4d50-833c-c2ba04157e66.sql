-- Create storage bucket for flow item uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('flow-uploads', 'flow-uploads', true);

-- RLS for flow-uploads bucket
CREATE POLICY "Anyone can view flow uploads" ON storage.objects FOR SELECT USING (bucket_id = 'flow-uploads');
CREATE POLICY "Authenticated users can upload to flow-uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'flow-uploads');
CREATE POLICY "Users can delete own flow uploads" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'flow-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Create storage bucket for smartboard files
INSERT INTO storage.buckets (id, name, public) VALUES ('smartboard-files', 'smartboard-files', true);

-- RLS for smartboard-files bucket
CREATE POLICY "Anyone can view smartboard files" ON storage.objects FOR SELECT USING (bucket_id = 'smartboard-files');
CREATE POLICY "Authenticated users can upload to smartboard-files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'smartboard-files');
CREATE POLICY "Users can delete own smartboard files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'smartboard-files' AND (storage.foldername(name))[1] = auth.uid()::text);
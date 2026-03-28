CREATE POLICY "Users can upload flow content"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'flow-uploads' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Users can update own flow uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'flow-uploads' AND (storage.foldername(name))[1] = (auth.uid())::text)
WITH CHECK (bucket_id = 'flow-uploads' AND (storage.foldername(name))[1] = (auth.uid())::text);
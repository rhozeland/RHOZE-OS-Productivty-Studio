CREATE POLICY "Studio owners can update media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'studio-media' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.studios WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'studio-media' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.studios WHERE owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anyone can view moodboard files" ON storage.objects;

CREATE POLICY "Owner can view moodboard files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'moodboard' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

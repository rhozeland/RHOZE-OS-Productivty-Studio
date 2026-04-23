DROP POLICY IF EXISTS "Authenticated users can upload to smartboard-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own smartboard files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own smartboard files" ON storage.objects;

CREATE POLICY "Board owners and editors can upload smartboard files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'smartboard-files'
  AND EXISTS (
    SELECT 1
    FROM public.smartboards sb
    WHERE sb.id::text = split_part(name, '/', 1)
      AND sb.user_id = auth.uid()
  )
  OR (
    bucket_id = 'smartboard-files'
    AND EXISTS (
      SELECT 1
      FROM public.smartboard_members sm
      WHERE sm.smartboard_id::text = split_part(name, '/', 1)
        AND sm.user_id = auth.uid()
        AND sm.role = ANY (ARRAY['editor', 'admin'])
    )
  )
);

CREATE POLICY "Board owners and editors can update smartboard files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'smartboard-files'
  AND public.can_read_smartboard_file(auth.uid(), name)
)
WITH CHECK (
  bucket_id = 'smartboard-files'
  AND public.can_read_smartboard_file(auth.uid(), name)
);

CREATE POLICY "Board owners and editors can delete smartboard files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'smartboard-files'
  AND public.can_read_smartboard_file(auth.uid(), name)
);
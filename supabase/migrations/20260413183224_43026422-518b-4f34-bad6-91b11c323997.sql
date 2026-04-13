-- 1. Fix smartboard-files: replace public read with ownership/membership check
DROP POLICY IF EXISTS "Anyone can view smartboard files" ON storage.objects;

CREATE OR REPLACE FUNCTION public.can_read_smartboard_file(_user_id uuid, _file_path text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.smartboards
    WHERE user_id = _user_id
      AND id::text = split_part(_file_path, '/', 1)
  )
  OR EXISTS (
    SELECT 1 FROM public.smartboard_members
    WHERE user_id = _user_id
      AND smartboard_id::text = split_part(_file_path, '/', 1)
  )
$$;

CREATE POLICY "Owners and members can view smartboard files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'smartboard-files'
    AND public.can_read_smartboard_file(auth.uid(), name)
  );

-- 2. Fix chat_group_members broken admin check (self-referential tautology)
DROP POLICY IF EXISTS "Group admins can add members" ON public.chat_group_members;

CREATE POLICY "Group admins can add members"
  ON public.chat_group_members FOR INSERT TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.chat_group_members AS m
      WHERE m.group_id = chat_group_members.group_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.chat_groups
      WHERE chat_groups.id = chat_group_members.group_id
        AND chat_groups.creator_id = auth.uid()
    ))
  );

-- 3. Fix drop_room_posts: restrict SELECT to room members
DROP POLICY IF EXISTS "Members can view room posts" ON public.drop_room_posts;

CREATE POLICY "Members can view room posts"
  ON public.drop_room_posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drop_room_members
      WHERE drop_room_members.room_id = drop_room_posts.room_id
        AND drop_room_members.user_id = auth.uid()
    )
  );

-- 4. Fix studio_settings: remove public read, admins-only already exists
DROP POLICY IF EXISTS "Anyone can view studio settings" ON public.studio_settings;

-- 5. Fix flow-uploads upload: add path scoping
DROP POLICY IF EXISTS "Authenticated users can upload to flow-uploads" ON storage.objects;

CREATE POLICY "Authenticated users can upload to flow-uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'flow-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. Fix listing-media upload: add path scoping
DROP POLICY IF EXISTS "Users can upload listing media" ON storage.objects;

CREATE POLICY "Users can upload listing media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 7. Fix smartboard-files upload: add path scoping
DROP POLICY IF EXISTS "Authenticated users can upload to smartboard-files" ON storage.objects;

CREATE POLICY "Authenticated users can upload to smartboard-files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'smartboard-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
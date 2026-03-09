
-- Drop Rooms: temporary collaboration spaces
CREATE TABLE public.drop_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  cover_color text DEFAULT '#7c3aed',
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  max_members integer DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Room members
CREATE TABLE public.drop_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.drop_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Room posts (ideas / drops)
CREATE TABLE public.drop_room_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.drop_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  post_type text NOT NULL DEFAULT 'idea',
  file_url text,
  upvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drop_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drop_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drop_room_posts ENABLE ROW LEVEL SECURITY;

-- Drop Rooms policies
CREATE POLICY "Anyone can view active rooms" ON public.drop_rooms
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Users can create rooms" ON public.drop_rooms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update own rooms" ON public.drop_rooms
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete own rooms" ON public.drop_rooms
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Members policies
CREATE POLICY "Anyone can view room members" ON public.drop_room_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can join rooms" ON public.drop_room_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms" ON public.drop_room_members
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Posts policies
CREATE POLICY "Members can view room posts" ON public.drop_room_posts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can create posts" ON public.drop_room_posts
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.drop_room_members WHERE room_id = drop_room_posts.room_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update own posts" ON public.drop_room_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" ON public.drop_room_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for posts and members
ALTER PUBLICATION supabase_realtime ADD TABLE public.drop_room_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drop_room_members;


-- Chat groups (Circles)
CREATE TABLE public.chat_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  creator_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;

-- Chat group members
CREATE TABLE public.chat_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;

-- Chat group messages
CREATE TABLE public.chat_group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_group_messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime for group messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_messages;

-- Helper: check if user is member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

-- RLS for chat_groups
CREATE POLICY "Members can view their groups"
ON public.chat_groups FOR SELECT
TO authenticated
USING (public.is_group_member(auth.uid(), id));

CREATE POLICY "Users can create groups"
ON public.chat_groups FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creator can update group"
ON public.chat_groups FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id);

CREATE POLICY "Creator can delete group"
ON public.chat_groups FOR DELETE
TO authenticated
USING (auth.uid() = creator_id);

-- RLS for chat_group_members
CREATE POLICY "Members can view group members"
ON public.chat_group_members FOR SELECT
TO authenticated
USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group admins can add members"
ON public.chat_group_members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE group_id = chat_group_members.group_id
      AND user_id = auth.uid()
      AND role = 'admin'
  )
  OR
  -- Creator can add first members (including themselves)
  EXISTS (
    SELECT 1 FROM public.chat_groups
    WHERE id = chat_group_members.group_id
      AND creator_id = auth.uid()
  )
);

CREATE POLICY "Members can leave"
ON public.chat_group_members FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.chat_group_members m
  WHERE m.group_id = chat_group_members.group_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
));

-- RLS for chat_group_messages
CREATE POLICY "Members can view group messages"
ON public.chat_group_messages FOR SELECT
TO authenticated
USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Members can send group messages"
ON public.chat_group_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id AND public.is_group_member(auth.uid(), group_id));

-- Updated at trigger for chat_groups
CREATE TRIGGER update_chat_groups_updated_at
BEFORE UPDATE ON public.chat_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

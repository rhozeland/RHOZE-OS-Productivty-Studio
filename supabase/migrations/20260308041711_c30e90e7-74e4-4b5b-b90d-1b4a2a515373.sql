
-- Smartboards table
CREATE TABLE public.smartboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  cover_color TEXT DEFAULT '#2dd4a8',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.smartboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create smartboards" ON public.smartboards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own smartboards" ON public.smartboards FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users can update own smartboards" ON public.smartboards FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own smartboards" ON public.smartboards FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Smartboard members table
CREATE TABLE public.smartboard_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  smartboard_id UUID NOT NULL REFERENCES public.smartboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(smartboard_id, user_id)
);

ALTER TABLE public.smartboard_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view membership" ON public.smartboard_members FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR auth.uid() IN (SELECT user_id FROM public.smartboards WHERE id = smartboard_id)
);
CREATE POLICY "Board owners can manage members" ON public.smartboard_members FOR INSERT TO authenticated WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.smartboards WHERE id = smartboard_id)
);
CREATE POLICY "Board owners can remove members" ON public.smartboard_members FOR DELETE TO authenticated USING (
  auth.uid() IN (SELECT user_id FROM public.smartboards WHERE id = smartboard_id) OR auth.uid() = user_id
);

-- Smartboard items table
CREATE TABLE public.smartboard_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  smartboard_id UUID NOT NULL REFERENCES public.smartboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'note',
  title TEXT,
  content TEXT,
  file_url TEXT,
  link_url TEXT,
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.smartboard_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view smartboard items" ON public.smartboard_items FOR SELECT TO authenticated USING (
  smartboard_id IN (
    SELECT id FROM public.smartboards WHERE user_id = auth.uid() OR is_public = true
    UNION
    SELECT smartboard_id FROM public.smartboard_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY "Users can add items to accessible boards" ON public.smartboard_items FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND smartboard_id IN (
    SELECT id FROM public.smartboards WHERE user_id = auth.uid()
    UNION
    SELECT smartboard_id FROM public.smartboard_members WHERE user_id = auth.uid() AND role IN ('editor', 'admin')
  )
);
CREATE POLICY "Users can delete own items" ON public.smartboard_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Smartboard messages for integrated chat
CREATE TABLE public.smartboard_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  smartboard_id UUID NOT NULL REFERENCES public.smartboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.smartboard_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view board messages" ON public.smartboard_messages FOR SELECT TO authenticated USING (
  smartboard_id IN (
    SELECT id FROM public.smartboards WHERE user_id = auth.uid() OR is_public = true
    UNION
    SELECT smartboard_id FROM public.smartboard_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY "Users can send board messages" ON public.smartboard_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND smartboard_id IN (
    SELECT id FROM public.smartboards WHERE user_id = auth.uid()
    UNION
    SELECT smartboard_id FROM public.smartboard_members WHERE user_id = auth.uid()
  )
);

-- Flow content items (shared content for discovery feed)
CREATE TABLE public.flow_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'image',
  file_url TEXT,
  link_url TEXT,
  category TEXT NOT NULL DEFAULT 'design',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view flow items" ON public.flow_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create flow items" ON public.flow_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own flow items" ON public.flow_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Flow interactions (swipes)
CREATE TABLE public.flow_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  flow_item_id UUID NOT NULL REFERENCES public.flow_items(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  smartboard_id UUID REFERENCES public.smartboards(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, flow_item_id)
);

ALTER TABLE public.flow_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interactions" ON public.flow_interactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create interactions" ON public.flow_interactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update interactions" ON public.flow_interactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for smartboard messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.smartboard_messages;

-- Updated_at triggers
CREATE TRIGGER update_smartboards_updated_at BEFORE UPDATE ON public.smartboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

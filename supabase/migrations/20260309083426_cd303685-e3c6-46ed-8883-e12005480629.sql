
-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- System can insert (via triggers with SECURITY DEFINER)
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Index for fast lookups
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read) WHERE read = false;

-- Trigger function: new message notification
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT display_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id LIMIT 1;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.receiver_id,
    'message',
    'New message from ' || COALESCE(sender_name, 'someone'),
    LEFT(NEW.content, 100),
    '/messages'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- Trigger function: new inquiry notification
CREATE OR REPLACE FUNCTION public.notify_new_inquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
  listing_title TEXT;
BEGIN
  SELECT display_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id LIMIT 1;
  SELECT title INTO listing_title FROM public.marketplace_listings WHERE id = NEW.listing_id LIMIT 1;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.receiver_id,
    'inquiry',
    'New inquiry from ' || COALESCE(sender_name, 'someone'),
    'Re: ' || COALESCE(listing_title, 'a listing') || ' — ' || LEFT(NEW.message, 80),
    '/messages?tab=inquiries'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_inquiry
AFTER INSERT ON public.listing_inquiries
FOR EACH ROW EXECUTE FUNCTION public.notify_new_inquiry();

-- Trigger function: new purchase notification (notify seller)
CREATE OR REPLACE FUNCTION public.notify_new_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_name TEXT;
  listing_title TEXT;
BEGIN
  SELECT display_name INTO buyer_name FROM public.profiles WHERE user_id = NEW.buyer_id LIMIT 1;
  SELECT title INTO listing_title FROM public.marketplace_listings WHERE id = NEW.listing_id LIMIT 1;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.seller_id,
    'purchase',
    COALESCE(buyer_name, 'Someone') || ' purchased your listing',
    COALESCE(listing_title, 'Listing') || ' for ' || NEW.credits_paid || ' credits',
    '/credits?tab=purchases'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_purchase
AFTER INSERT ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.notify_new_purchase();

-- Trigger function: new review notification (notify seller)
CREATE OR REPLACE FUNCTION public.notify_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer_name TEXT;
  listing_title TEXT;
BEGIN
  SELECT display_name INTO reviewer_name FROM public.profiles WHERE user_id = NEW.reviewer_id LIMIT 1;
  SELECT title INTO listing_title FROM public.marketplace_listings WHERE id = NEW.listing_id LIMIT 1;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.seller_id,
    'review',
    COALESCE(reviewer_name, 'Someone') || ' left a ' || NEW.rating || '★ review',
    COALESCE(listing_title, 'Listing') || COALESCE(' — ' || LEFT(NEW.comment, 80), ''),
    '/creators/' || NEW.listing_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_review
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.notify_new_review();

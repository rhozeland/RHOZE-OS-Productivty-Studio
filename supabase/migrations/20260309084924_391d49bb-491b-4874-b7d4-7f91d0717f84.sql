ALTER TABLE public.profiles
  ADD COLUMN shipping_address_line1 text DEFAULT NULL,
  ADD COLUMN shipping_address_line2 text DEFAULT NULL,
  ADD COLUMN shipping_city text DEFAULT NULL,
  ADD COLUMN shipping_state text DEFAULT NULL,
  ADD COLUMN shipping_zip text DEFAULT NULL,
  ADD COLUMN shipping_country text DEFAULT NULL,
  ADD COLUMN email_notif_messages boolean DEFAULT true,
  ADD COLUMN email_notif_inquiries boolean DEFAULT true,
  ADD COLUMN email_notif_purchases boolean DEFAULT true,
  ADD COLUMN email_notif_reviews boolean DEFAULT true;
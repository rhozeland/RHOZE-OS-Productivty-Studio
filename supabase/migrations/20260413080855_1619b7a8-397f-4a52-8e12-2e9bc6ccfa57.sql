-- Admins can delete any flow item
CREATE POLICY "Admins can delete any flow item"
ON public.flow_items
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete any marketplace listing
CREATE POLICY "Admins can delete any listing"
ON public.marketplace_listings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can view all flow items
CREATE POLICY "Admins can view all flow items"
ON public.flow_items
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can view all listings (including inactive)
CREATE POLICY "Admins can view all listings"
ON public.marketplace_listings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
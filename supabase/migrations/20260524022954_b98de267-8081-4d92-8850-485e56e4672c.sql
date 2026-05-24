-- Lock private profile fields behind RPC-only access
-- (shipping_*, wallet_address, luma_ics_url, ics_last_synced_at).
-- We revoke SELECT on the profiles table from anon + authenticated, then
-- re-grant column-level SELECT on the 54 safe columns. Owners still read
-- their private fields via the existing get_my_private_profile_fields() RPC.
REVOKE SELECT ON TABLE public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, user_id, display_name, avatar_url, bio, skills, portfolio_url,
  available, created_at, updated_at, is_public, mediums, location, headline,
  banner_gradient, profile_background, email_notif_messages,
  email_notif_inquiries, email_notif_purchases, email_notif_reviews,
  show_seller_stats, show_offerings, show_public_boards, instagram_url,
  tiktok_url, twitter_url, youtube_url, banner_url, dashboard_layout,
  profile_layout, show_flow_posts, dock_config, username, ban_status,
  banned_at, ban_reason, wallet_locked, flow_feed_scope,
  flow_preferred_categories, verification_status, verified_at, region_code,
  creator_roles, primary_role, archetype, featured_pin_until, featured_tier,
  verified_pro_at, dm_subscribers_only, show_token_chip, user_type,
  token_mint_address, token_ticker, luma_url
) ON TABLE public.profiles TO anon, authenticated;

-- Explicit admin-only SELECT policy on waitlist so that even if a future
-- table-level grant is added, only admins can read emails via RLS.
DROP POLICY IF EXISTS "Admins can read waitlist" ON public.waitlist;
CREATE POLICY "Admins can read waitlist"
ON public.waitlist
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
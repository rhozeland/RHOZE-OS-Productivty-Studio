-- 1. Restrict column access on profiles for client roles
REVOKE SELECT ON public.profiles FROM authenticated, anon;

GRANT SELECT (
  id, user_id, display_name, avatar_url, bio, skills, portfolio_url,
  available, created_at, updated_at, is_public, mediums, location, headline,
  banner_gradient, profile_background,
  email_notif_messages, email_notif_inquiries, email_notif_purchases, email_notif_reviews,
  show_seller_stats, show_offerings, show_public_boards,
  instagram_url, tiktok_url, twitter_url, youtube_url,
  banner_url, dashboard_layout, profile_layout, show_flow_posts, dock_config,
  username, wallet_address, ban_status, banned_at, wallet_locked,
  flow_feed_scope, flow_preferred_categories,
  verification_status, verified_at, region_code, creator_roles, primary_role,
  archetype, featured_pin_until, featured_tier, verified_pro_at,
  dm_subscribers_only, show_token_chip, user_type,
  token_mint_address, token_ticker, luma_url
) ON public.profiles TO authenticated, anon;

-- Sensitive columns explicitly NOT granted:
-- shipping_address_line1, shipping_address_line2, shipping_city,
-- shipping_state, shipping_zip, shipping_country,
-- luma_ics_url, ics_last_synced_at, ban_reason

-- 2. Admin helper to read ban_reason (and ban metadata) for any user
CREATE OR REPLACE FUNCTION public.get_admin_user_ban_info(_user_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, ban_reason text, ban_status text, banned_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
    SELECT p.user_id, p.ban_reason, p.ban_status, p.banned_at
    FROM public.profiles p
    WHERE (_user_id IS NULL OR p.user_id = _user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_ban_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_ban_info(uuid) TO authenticated;
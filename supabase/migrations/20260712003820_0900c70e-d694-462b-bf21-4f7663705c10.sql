
-- ============================================================
-- 1. Profiles: hide sensitive columns from anon/authenticated
-- ============================================================
-- Revoke broad table-level SELECT, then grant SELECT only on safe columns.
-- Owners still access sensitive fields via get_my_private_profile_fields RPC.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, user_id, display_name, avatar_url, bio, skills, portfolio_url, available,
  created_at, updated_at, is_public, mediums, location, headline, banner_gradient,
  profile_background, email_notif_messages, email_notif_inquiries,
  email_notif_purchases, email_notif_reviews, show_seller_stats, show_offerings,
  show_public_boards, instagram_url, tiktok_url, twitter_url, youtube_url,
  banner_url, dashboard_layout, profile_layout, show_flow_posts, dock_config,
  username, ban_status, banned_at, ban_reason, flow_feed_scope,
  flow_preferred_categories, verification_status, verified_at, region_code,
  creator_roles, primary_role, archetype, featured_pin_until, featured_tier,
  verified_pro_at, luma_ics_url, ics_last_synced_at, dm_subscribers_only,
  show_token_chip, user_type, token_mint_address, token_ticker, luma_url,
  token_mint_address_pending, token_ticker_pending, token_submission_status,
  token_submitted_at, token_reviewed_at, token_review_note,
  ar_splitter_share_bps, upcoming_links, spotify_url, soundcloud_url,
  bandcamp_url, onboarding_completed_at, archetypes
) ON public.profiles TO anon, authenticated;

-- INSERT/UPDATE stay as-is (owner RLS still enforces row scope, and updates
-- to sensitive columns require column-level UPDATE which authenticated already has).
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- ============================================================
-- 2. Drop room members: only fellow members + admins can enumerate
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_drop_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drop_room_members
    WHERE room_id = _room_id AND user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Anyone can view room members" ON public.drop_room_members;

CREATE POLICY "Members and admins can view room members"
ON public.drop_room_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_drop_room_member(room_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

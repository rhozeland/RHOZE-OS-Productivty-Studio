
DROP FUNCTION IF EXISTS public.get_public_profile(uuid);

CREATE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS TABLE(
  id uuid, user_id uuid, display_name text, username text, avatar_url text, bio text,
  headline text, location text, skills text[], mediums text[], available boolean,
  is_public boolean, banner_url text, banner_gradient text, profile_background text,
  portfolio_url text, instagram_url text, tiktok_url text, twitter_url text,
  youtube_url text, wallet_address text,
  show_flow_posts boolean, show_offerings boolean, show_public_boards boolean,
  show_seller_stats boolean, profile_layout jsonb,
  created_at timestamp with time zone, updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.user_id, p.display_name, p.username, p.avatar_url, p.bio, p.headline,
    p.location, p.skills, p.mediums, p.available, p.is_public,
    p.banner_url, p.banner_gradient, p.profile_background, p.portfolio_url,
    p.instagram_url, p.tiktok_url, p.twitter_url, p.youtube_url, p.wallet_address,
    p.show_flow_posts, p.show_offerings, p.show_public_boards, p.show_seller_stats,
    p.profile_layout, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.user_id = _user_id;
$$;

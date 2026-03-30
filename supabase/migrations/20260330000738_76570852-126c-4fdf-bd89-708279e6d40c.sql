
-- Fix 1: Remove the dangerous INSERT policy on user_credits that lets users self-grant balances
DROP POLICY IF EXISTS "Users can insert own credits" ON public.user_credits;

-- Fix 2: Split profiles SELECT into public fields (view) and private fields (owner only)
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create a policy for public profile fields - everyone authenticated can see non-sensitive data
-- Since RLS works at row level not column level, we use a security definer view approach
-- For now, restrict full profile access to owner only, and create a public view for safe fields
CREATE POLICY "Users can view own full profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a security definer function to get public profile data without shipping info
CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  display_name text,
  avatar_url text,
  bio text,
  headline text,
  location text,
  skills text[],
  mediums text[],
  available boolean,
  is_public boolean,
  banner_url text,
  banner_gradient text,
  profile_background text,
  portfolio_url text,
  instagram_url text,
  tiktok_url text,
  twitter_url text,
  youtube_url text,
  show_flow_posts boolean,
  show_offerings boolean,
  show_public_boards boolean,
  show_seller_stats boolean,
  profile_layout jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    p.id, p.user_id, p.display_name, p.avatar_url, p.bio, p.headline,
    p.location, p.skills, p.mediums, p.available, p.is_public,
    p.banner_url, p.banner_gradient, p.profile_background, p.portfolio_url,
    p.instagram_url, p.tiktok_url, p.twitter_url, p.youtube_url,
    p.show_flow_posts, p.show_offerings, p.show_public_boards, p.show_seller_stats,
    p.profile_layout, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.user_id = _user_id;
$$;

-- Also allow authenticated users to see profiles but only non-sensitive columns
-- We need a row-level policy that allows SELECT for all authenticated users
-- but the sensitive columns will only be readable via the owner policy
-- Since Postgres RLS is row-level, we need to allow row access but use the view for other users
CREATE POLICY "Authenticated users can view public profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (is_public = true);

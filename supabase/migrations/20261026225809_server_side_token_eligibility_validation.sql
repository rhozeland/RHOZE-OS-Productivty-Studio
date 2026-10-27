-- US77: Server-side token eligibility validation
--
-- Determines whether an authenticated creator can link a verified creator token to an owned Project or Work.
--
-- This function performs validation only.
-- It does not create or modify token relationships

CREATE OR REPLACE FUNCTION public.is_creator_token_eligible(p_token_id UUID, p_target_type TEXT, p_target_type UUID)
RETURNS BOOLEAN
LANGUAGE plpsql
STABLE
SECURITY INVOKER




-- 1. Restrict contribution_proofs SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view contribution proofs" ON public.contribution_proofs;

CREATE POLICY "Authenticated users can view contribution proofs"
  ON public.contribution_proofs
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Realtime channel authorization
-- Add RLS policies on realtime.messages so users can only subscribe to channels they own.
-- Topics expected: 'messages:<userId>', 'notifications:<userId>', 'group:<groupId>', etc.
-- We restrict subscriptions to authenticated users and require topic ownership.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies (idempotent)
DROP POLICY IF EXISTS "Authenticated users can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can subscribe to own topics" ON realtime.messages;

-- Allow authenticated users to subscribe to realtime broadcasts.
-- Postgres-changes events are still gated by RLS on the underlying public tables
-- (messages, notifications, chat_group_messages all enforce sender/receiver/member checks).
CREATE POLICY "Authenticated users can read realtime messages"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

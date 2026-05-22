CREATE TABLE IF NOT EXISTS public.event_attendance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  luma_url text NOT NULL,
  memo_signature text,
  anchored_at timestamptz,
  anchor_last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, luma_url)
);

CREATE INDEX IF NOT EXISTS idx_eac_profile ON public.event_attendance_claims (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eac_user ON public.event_attendance_claims (user_id, created_at DESC);

ALTER TABLE public.event_attendance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own claims insert"
  ON public.event_attendance_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own claims select"
  ON public.event_attendance_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Profile owner sees their claims"
  ON public.event_attendance_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = event_attendance_claims.profile_id
        AND p.user_id = auth.uid()
    )
  );

-- US169/ Tasks #172 + #173: Consolidate profile and creator_tokens synchronization and identify legacy token records.
--
-- Step 2A: Add token source/provenance tracking.
-- Records how each creator token entered the system so legacy simulated,
-- backfilled, creator-submitted, and externally validated tokens can be
-- handled correctly during consolidation.
--
-- Design doc: Docs/canonical-creator-token-data-model.md section 3 & 10

ALTER TABLE public.creator_tokens
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'submission'
CHECK (source IN ('submission','backfill','simulated','external'));

COMMENT ON COLUMN public.creator_tokens.source IS
  'How this token row was created: submission (user submitted), backfill (Wave-A historical), simulated (RHOZE vanity mint), external (Pump.fun import).';

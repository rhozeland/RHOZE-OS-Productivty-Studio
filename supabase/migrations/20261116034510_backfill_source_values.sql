-- US169/ Tasks #172 + #173: Consolidate profile and creator_tokens synchronization and identify legacy token records.
--
-- Step 2B: Classify historical creator_tokens records by source.
-- Part of canonicalization Step 2: add token provenance and quarantine
-- legacy simulated records before creator_tokens becomes authoritative.
--
-- Design: Docs/canonical-creator-token-data-model.md -- Sections 3 & 10

UPDATE public.creator_tokens
   SET source = CASE
                  WHEN mint_address LIKE '%RHOZE' THEN 'simulated'
                  ELSE 'backfill'
                END
 WHERE source = 'submission'
   AND created_at < now();
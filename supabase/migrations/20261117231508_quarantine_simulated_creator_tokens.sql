-- US169/ Tasks #172 + #173: Consolidate profile and creator_tokens synchronization and identify legacy token records.
--
-- Step 2C: Quarantine simulated creator tokens
-- Mark historically auto-approved simulated tokens as rejected so they
-- are no longer treated as valid creator tokens.
--
-- Design: Docs/canonical-creator-token-data-model.md 


UPDATE public.creator_tokens
   SET status        = 'rejected',
       reject_reason = 'Quarantined: simulated launchpad token (RHOZE vanity mint), auto-approved by historical backfill',
       is_primary    = false,
       updated_at    = now()
 WHERE source = 'simulated'
   AND status = 'approved';

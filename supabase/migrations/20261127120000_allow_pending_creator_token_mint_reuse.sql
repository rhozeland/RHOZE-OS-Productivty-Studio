-- Task #158: Pending and rejected creator-token rows must not reserve a mint.
--
-- Supabase's migration runner wraps this file in one transaction. Keep the
-- replacement indexes ahead of the old-constraint drop so a failure rolls
-- back the entire migration without a uniqueness gap.

DO $$
DECLARE
  v_table regclass := to_regclass('public.creator_tokens');
  v_mint_attnum smallint;
  v_global_constraint_index oid;
BEGIN
  IF v_table IS NULL THEN
    RAISE EXCEPTION
      'Task #158 expected public.creator_tokens to exist';
  END IF;

  SELECT a.attnum
    INTO v_mint_attnum
    FROM pg_attribute AS a
   WHERE a.attrelid = v_table
     AND a.attname = 'mint_address'
     AND a.attnotnull
     AND NOT a.attisdropped;

  IF v_mint_attnum IS NULL OR NOT EXISTS (
    SELECT 1
      FROM pg_attribute AS a
     WHERE a.attrelid = v_table
       AND a.attname = 'user_id'
       AND a.attnotnull
       AND NOT a.attisdropped
  ) THEN
    RAISE EXCEPTION
      'Task #158 expected non-null creator_tokens.user_id and mint_address columns';
  END IF;

  SELECT c.conindid
    INTO v_global_constraint_index
    FROM pg_constraint AS c
   WHERE c.conrelid = v_table
     AND c.conname = 'creator_tokens_mint_address_key'
     AND c.contype = 'u'
     AND c.convalidated
     AND NOT c.condeferrable
     AND c.conkey = ARRAY[v_mint_attnum]::smallint[];

  IF v_global_constraint_index IS NULL THEN
    RAISE EXCEPTION
      'Task #158 expected creator_tokens_mint_address_key to be a validated, non-deferrable UNIQUE constraint on mint_address';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_index AS i
     WHERE i.indrelid = v_table
       AND i.indisunique
       AND i.indpred IS NULL
       AND i.indnkeyatts = 1
       AND pg_get_indexdef(i.indexrelid, 1, true) = 'mint_address'
       AND i.indexrelid <> v_global_constraint_index
  ) THEN
    RAISE EXCEPTION
      'Task #158 found an additional global UNIQUE index on creator_tokens.mint_address';
  END IF;

  IF to_regclass('public.creator_tokens_one_approved_per_mint') IS NOT NULL
     OR to_regclass('public.creator_tokens_one_mint_per_user') IS NOT NULL
     OR EXISTS (
       SELECT 1
         FROM pg_constraint AS c
        WHERE c.conrelid = v_table
          AND c.conname = 'creator_tokens_one_mint_per_user'
     ) THEN
    RAISE EXCEPTION
      'Task #158 replacement uniqueness objects already exist; inspect schema before applying';
  END IF;
END;
$$;

CREATE UNIQUE INDEX creator_tokens_one_approved_per_mint
  ON public.creator_tokens (mint_address)
  WHERE status = 'approved';

ALTER TABLE public.creator_tokens
  ADD CONSTRAINT creator_tokens_one_mint_per_user
  UNIQUE (user_id, mint_address);

ALTER TABLE public.creator_tokens
  DROP CONSTRAINT creator_tokens_mint_address_key;

-- Audit trail for capital_underwriting_rules
CREATE TABLE public.capital_underwriting_rules_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_uw_rules_audit_changed_at
  ON public.capital_underwriting_rules_audit (changed_at DESC);

ALTER TABLE public.capital_underwriting_rules_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can read the audit log
CREATE POLICY "Admins can view underwriting rules audit"
  ON public.capital_underwriting_rules_audit
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- No direct INSERT/UPDATE/DELETE policies: rows are written exclusively by the
-- SECURITY DEFINER trigger below, so users cannot forge or modify history.

-- Trigger function: capture diffs on every UPDATE
CREATE OR REPLACE FUNCTION public.log_capital_underwriting_rules_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_json jsonb;
  new_json jsonb;
  diff_keys text[];
BEGIN
  old_json := to_jsonb(OLD) - 'updated_at' - 'updated_by';
  new_json := to_jsonb(NEW) - 'updated_at' - 'updated_by';

  SELECT COALESCE(array_agg(key ORDER BY key), '{}')
  INTO diff_keys
  FROM jsonb_each(new_json) n
  WHERE n.value IS DISTINCT FROM (old_json -> n.key);

  -- Skip no-op updates
  IF array_length(diff_keys, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.capital_underwriting_rules_audit
    (changed_by, old_values, new_values, changed_fields)
  VALUES
    (COALESCE(NEW.updated_by, auth.uid()), old_json, new_json, diff_keys);

  RETURN NEW;
END;
$$;

CREATE TRIGGER capital_underwriting_rules_audit_trg
AFTER UPDATE ON public.capital_underwriting_rules
FOR EACH ROW
EXECUTE FUNCTION public.log_capital_underwriting_rules_change();
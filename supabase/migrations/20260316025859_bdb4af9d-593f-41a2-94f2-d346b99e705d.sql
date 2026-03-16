-- Add stage hierarchy to project_goals (parent_id for sub-items under stages)
ALTER TABLE public.project_goals ADD COLUMN parent_id uuid REFERENCES public.project_goals(id) ON DELETE CASCADE;
ALTER TABLE public.project_goals ADD COLUMN budget_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.project_goals ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.project_goals ADD COLUMN stage_date_start timestamp with time zone;
ALTER TABLE public.project_goals ADD COLUMN stage_date_end timestamp with time zone;
ALTER TABLE public.project_goals ADD COLUMN location text;

-- Add project-level budget fields
ALTER TABLE public.projects ADD COLUMN total_budget numeric NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN is_estimate boolean NOT NULL DEFAULT true;
ALTER TABLE public.projects ADD COLUMN currency text NOT NULL DEFAULT 'CAD';
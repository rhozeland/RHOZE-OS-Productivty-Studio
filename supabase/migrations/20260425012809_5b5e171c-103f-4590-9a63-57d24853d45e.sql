-- Remove the seeded filler Flow Mode posts. These were all inserted in a single
-- batch by the seed-flow-items edge function and share an identical timestamp,
-- which makes them safe to target by exact created_at. Real user posts have
-- distinct timestamps and are not affected.
DELETE FROM public.flow_interactions
WHERE flow_item_id IN (
  SELECT id FROM public.flow_items
  WHERE created_at = '2026-04-23 05:57:22.090964+00'
);

DELETE FROM public.flow_items
WHERE created_at = '2026-04-23 05:57:22.090964+00';
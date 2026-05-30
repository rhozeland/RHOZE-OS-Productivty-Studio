-- Token-attached works: let any work declare a coin it backs
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS linked_token_mint TEXT;
CREATE INDEX IF NOT EXISTS idx_works_linked_token_mint ON public.works (linked_token_mint) WHERE linked_token_mint IS NOT NULL;

-- A&R splitter wallet (admin-managed; profiles already exists with RLS)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ar_splitter_address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ar_splitter_share_bps INT;

-- Concierge tier + splitter address surfacing
ALTER TABLE public.concierge_requests ADD COLUMN IF NOT EXISTS splitter_address TEXT;
ALTER TABLE public.concierge_requests
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'curated'
    CHECK (tier IN ('diy','curated','roster'));
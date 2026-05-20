
-- Creator subscription tiers (which tiers each creator offers)
create table public.creator_subscription_tiers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  tier text not null check (tier in ('basic','standard','premium')),
  stripe_price_id text,
  monthly_price_usd integer not null,
  perks jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, tier)
);

create index idx_cst_creator on public.creator_subscription_tiers(creator_id);

alter table public.creator_subscription_tiers enable row level security;

create policy "Tiers viewable by everyone"
  on public.creator_subscription_tiers for select
  using (true);

create policy "Creators manage own tiers"
  on public.creator_subscription_tiers for all
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

create trigger trg_cst_updated_at
  before update on public.creator_subscription_tiers
  for each row execute function public.update_updated_at_column();

-- Active subscriptions (one row per subscriber/creator pair)
create table public.creator_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  tier text not null check (tier in ('basic','standard','premium')),
  stripe_subscription_id text unique,
  stripe_customer_id text,
  status text not null default 'pending'
    check (status in ('pending','active','past_due','canceled','expired')),
  monthly_price_usd integer not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscriber_id, creator_id)
);

create index idx_cs_subscriber on public.creator_subscriptions(subscriber_id);
create index idx_cs_creator on public.creator_subscriptions(creator_id);
create index idx_cs_status on public.creator_subscriptions(status);

alter table public.creator_subscriptions enable row level security;

create policy "Subscribers see own subs"
  on public.creator_subscriptions for select
  using (auth.uid() = subscriber_id);

create policy "Creators see their subscribers"
  on public.creator_subscriptions for select
  using (auth.uid() = creator_id);

-- No client inserts/updates — webhook (service role) handles all writes.

create trigger trg_cs_updated_at
  before update on public.creator_subscriptions
  for each row execute function public.update_updated_at_column();

-- Helper: is the current user actively subscribed to a creator at >= a tier?
create or replace function public.is_subscribed_to(
  _creator_id uuid,
  _min_tier text default 'basic'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.creator_subscriptions
    where subscriber_id = auth.uid()
      and creator_id = _creator_id
      and status = 'active'
      and case _min_tier
        when 'basic'    then tier in ('basic','standard','premium')
        when 'standard' then tier in ('standard','premium')
        when 'premium'  then tier = 'premium'
        else false
      end
  )
$$;

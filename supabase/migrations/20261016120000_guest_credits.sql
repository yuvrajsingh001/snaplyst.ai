-- Guest credits for Snaplyst anonymous sessions.
--
-- Apply this in the Supabase SQL editor BEFORE deploying the app change.
-- Also enable Authentication → Providers → Anonymous sign-ins.
--
-- Guests are real auth.users rows (is_anonymous = true) with their own uid,
-- so existing owner_id RLS keeps their stacks and images off other accounts.
-- Credit writes go through service-role RPCs. The browser can only read its
-- own balance.

create table if not exists public.guest_credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  credits_remaining integer not null default 5 check (credits_remaining >= 0),
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_ip_quotas (
  ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
  accounts_created integer not null default 0 check (accounts_created >= 0),
  window_start timestamptz not null default now()
);

create table if not exists public.guest_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (char_length(action) between 1 and 64),
  delta integer not null check (delta between -5 and 5 and delta <> 0),
  created_at timestamptz not null default now()
);

create index if not exists guest_credit_ledger_user_id_idx
  on public.guest_credit_ledger (user_id, created_at desc);

alter table public.guest_credits enable row level security;
alter table public.guest_ip_quotas enable row level security;
alter table public.guest_credit_ledger enable row level security;

-- Guests (and any signed-in user) may read only their own balance.
-- No insert/update/delete policies: the browser cannot mint or edit credits.
drop policy if exists "read own guest credits" on public.guest_credits;
create policy "read own guest credits"
  on public.guest_credits
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Optional ownership column. Nullable so this migration does not break
-- existing rows. The app writes it when the column exists.
alter table public.product_images
  add column if not exists owner_id uuid references public.profiles (id) on delete cascade;

create index if not exists product_images_owner_id_idx
  on public.product_images (owner_id);

-- ---------------------------------------------------------------------------
-- grant_guest_credits: one 5-credit balance per anonymous user.
-- At most 3 new guest balances per hashed IP in a rolling 24 hour window.
-- ---------------------------------------------------------------------------
create or replace function public.grant_guest_credits(p_user_id uuid, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anonymous boolean;
  v_existing integer;
  v_quota integer;
  v_window timestamptz;
  v_limit integer := 3;
  v_window_hours integer := 24;
  v_initial integer := 5;
  v_inserted uuid;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_ip_hash');
  end if;

  select is_anonymous
    into v_anonymous
  from auth.users
  where id = p_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  if coalesce(v_anonymous, false) = false then
    return jsonb_build_object(
      'ok', true,
      'is_guest', false,
      'unlimited', true,
      'credits_remaining', null
    );
  end if;

  select credits_remaining
    into v_existing
  from public.guest_credits
  where user_id = p_user_id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'is_guest', true,
      'unlimited', false,
      'credits_remaining', v_existing,
      'created', false
    );
  end if;

  insert into public.guest_ip_quotas as quotas (ip_hash, accounts_created, window_start)
  values (p_ip_hash, 0, now())
  on conflict (ip_hash) do nothing;

  select accounts_created, window_start
    into v_quota, v_window
  from public.guest_ip_quotas
  where ip_hash = p_ip_hash
  for update;

  if v_window < now() - make_interval(hours => v_window_hours) then
    update public.guest_ip_quotas
      set accounts_created = 0,
          window_start = now()
      where ip_hash = p_ip_hash;
    v_quota := 0;
  end if;

  if v_quota >= v_limit then
    insert into public.guest_credits (user_id, credits_remaining, ip_hash)
    values (p_user_id, 0, p_ip_hash)
    on conflict (user_id) do nothing;

    select credits_remaining
      into v_existing
    from public.guest_credits
    where user_id = p_user_id;

    return jsonb_build_object(
      'ok', false,
      'error', 'guest_quota_exceeded',
      'is_guest', true,
      'unlimited', false,
      'credits_remaining', coalesce(v_existing, 0)
    );
  end if;

  insert into public.guest_credits (user_id, credits_remaining, ip_hash)
  values (p_user_id, v_initial, p_ip_hash)
  on conflict (user_id) do nothing
  returning user_id into v_inserted;

  if v_inserted is null then
    select credits_remaining
      into v_existing
    from public.guest_credits
    where user_id = p_user_id;

    return jsonb_build_object(
      'ok', true,
      'is_guest', true,
      'unlimited', false,
      'credits_remaining', v_existing,
      'created', false
    );
  end if;

  update public.guest_ip_quotas
    set accounts_created = accounts_created + 1
    where ip_hash = p_ip_hash;

  insert into public.guest_credit_ledger (user_id, action, delta)
  values (p_user_id, 'grant', v_initial);

  return jsonb_build_object(
    'ok', true,
    'is_guest', true,
    'unlimited', false,
    'credits_remaining', v_initial,
    'created', true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_guest_credit: atomic decrement. Signed-in users are unlimited.
-- A guest with no row (grant never ran) fails closed with 0 credits.
-- ---------------------------------------------------------------------------
create or replace function public.consume_guest_credit(p_user_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anonymous boolean;
  v_remaining integer;
begin
  if p_action not in ('background_removal', 'vision') then
    return jsonb_build_object('ok', false, 'error', 'unknown_action');
  end if;

  select is_anonymous
    into v_anonymous
  from auth.users
  where id = p_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  if coalesce(v_anonymous, false) = false then
    return jsonb_build_object(
      'ok', true,
      'is_guest', false,
      'unlimited', true,
      'credits_remaining', null
    );
  end if;

  update public.guest_credits
    set credits_remaining = credits_remaining - 1,
        updated_at = now()
    where user_id = p_user_id
      and credits_remaining > 0
    returning credits_remaining into v_remaining;

  if found then
    insert into public.guest_credit_ledger (user_id, action, delta)
    values (p_user_id, p_action, -1);

    return jsonb_build_object(
      'ok', true,
      'is_guest', true,
      'unlimited', false,
      'credits_remaining', v_remaining,
      'action', p_action
    );
  end if;

  select credits_remaining
    into v_remaining
  from public.guest_credits
  where user_id = p_user_id;

  return jsonb_build_object(
    'ok', false,
    'error', 'insufficient_credits',
    'is_guest', true,
    'unlimited', false,
    'credits_remaining', coalesce(v_remaining, 0)
  );
end;
$$;

-- Refund a single credit after a paid call fails. Capped at the starting 5
-- so a retry loop cannot mint a balance above the guest allowance.
create or replace function public.refund_guest_credit(p_user_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anonymous boolean;
  v_remaining integer;
begin
  if p_action not in ('background_removal', 'vision') then
    return jsonb_build_object('ok', false, 'error', 'unknown_action');
  end if;

  select is_anonymous
    into v_anonymous
  from auth.users
  where id = p_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  if coalesce(v_anonymous, false) = false then
    return jsonb_build_object(
      'ok', true,
      'is_guest', false,
      'unlimited', true,
      'credits_remaining', null
    );
  end if;

  update public.guest_credits
    set credits_remaining = least(credits_remaining + 1, 5),
        updated_at = now()
    where user_id = p_user_id
      and credits_remaining < 5
    returning credits_remaining into v_remaining;

  if not found then
    select credits_remaining
      into v_remaining
    from public.guest_credits
    where user_id = p_user_id;

    return jsonb_build_object(
      'ok', true,
      'is_guest', true,
      'unlimited', false,
      'credits_remaining', coalesce(v_remaining, 0),
      'refunded', false
    );
  end if;

  insert into public.guest_credit_ledger (user_id, action, delta)
  values (p_user_id, p_action, 1);

  return jsonb_build_object(
    'ok', true,
    'is_guest', true,
    'unlimited', false,
    'credits_remaining', v_remaining,
    'refunded', true
  );
end;
$$;

revoke all on function public.grant_guest_credits(uuid, text) from public;
revoke all on function public.grant_guest_credits(uuid, text) from anon;
revoke all on function public.grant_guest_credits(uuid, text) from authenticated;
grant execute on function public.grant_guest_credits(uuid, text) to service_role;

revoke all on function public.consume_guest_credit(uuid, text) from public;
revoke all on function public.consume_guest_credit(uuid, text) from anon;
revoke all on function public.consume_guest_credit(uuid, text) from authenticated;
grant execute on function public.consume_guest_credit(uuid, text) to service_role;

revoke all on function public.refund_guest_credit(uuid, text) from public;
revoke all on function public.refund_guest_credit(uuid, text) from anon;
revoke all on function public.refund_guest_credit(uuid, text) from authenticated;
grant execute on function public.refund_guest_credit(uuid, text) to service_role;

-- Storage isolation is not changed automatically. Policies are OR'd, so adding
-- a stricter policy would not close a wide one. In Dashboard → Storage →
-- product-images, remove any policy that lets every authenticated user read
-- or write the whole bucket, and keep a policy equivalent to:
--
--   bucket_id = 'product-images'
--   and (storage.foldername(name))[1] = auth.uid()::text
--
-- The background-removal service also refuses a storage_path whose first
-- folder is not the signed-in user's id. That check matters because the
-- service uploads with the service role, which bypasses storage RLS.

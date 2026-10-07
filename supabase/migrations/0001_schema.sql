-- =====================================================================
-- ApparelFlow ERP — Cutting Operations & Gatekeeper Verification Terminal
-- Migration 0001: schema, state machine guards, audit immutability, RLS
-- Run this in Supabase Dashboard → SQL Editor (or `supabase db push`).
-- =====================================================================

-- gen_random_uuid() is built into Postgres 13+ (no extension needed)

-- ---------- Enums ----------------------------------------------------
do $$ begin
  create type user_role as enum ('cutting_supervisor', 'cutting_verifier', 'sewing_supervisor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'CUTTING_IN_PROGRESS',
    'PENDING_VERIFICATION',
    'VERIFIED',
    'REJECTED',
    'SEWING_IN_PROGRESS'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_status as enum ('GREEN', 'YELLOW', 'RED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_decision as enum ('APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

-- ---------- users (profile table; password hash lives in auth.users) -
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null,
  role        user_role not null,
  created_at  timestamptz not null default now()
);

-- ---------- recipes (Bill of Materials header) -----------------------
create table if not exists public.recipes (
  id                uuid primary key default gen_random_uuid(),
  recipe_code       text not null unique,
  name              text not null,
  category          text not null,
  std_fabric_yards  numeric(8,3) not null check (std_fabric_yards > 0),
  wastage_cap       numeric(5,2) not null check (wastage_cap >= 0),
  created_at        timestamptz not null default now()
);

create table if not exists public.recipe_components (
  id                  uuid primary key default gen_random_uuid(),
  recipe_id           uuid not null references public.recipes(id) on delete cascade,
  component_name      text not null,
  pieces_per_garment  integer not null check (pieces_per_garment > 0),
  image_url           text,
  sort_order          integer not null default 0,
  unique (recipe_id, component_name)
);

-- ---------- cutting orders -------------------------------------------
create sequence if not exists public.cutting_order_seq start 1001;

create table if not exists public.cutting_orders (
  id                 uuid primary key default gen_random_uuid(),
  order_no           text not null unique
                       default ('CO-' || nextval('public.cutting_order_seq')::text),
  recipe_id          uuid not null references public.recipes(id),
  target_qty         integer not null check (target_qty > 0 and target_qty <= 100000),
  fabric_roll_id     text not null check (length(trim(fabric_roll_id)) > 0),
  actual_fabric_yds  numeric(10,2) not null check (actual_fabric_yds > 0),
  status             order_status not null default 'CUTTING_IN_PROGRESS',
  created_by         uuid not null references public.users(id),
  -- immutable audit snapshot copied on VERIFIED
  verified_by        uuid references public.users(id),
  verified_at        timestamptz,
  wastage_pct        numeric(8,2),
  last_rejection_note text,
  sewing_started_by  uuid references public.users(id),
  sewing_started_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists cutting_orders_status_idx on public.cutting_orders(status);

-- ---------- verification items (one per component per order) ---------
create table if not exists public.verification_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.cutting_orders(id) on delete cascade,
  component_id  uuid not null references public.recipe_components(id),
  expected_qty  integer not null check (expected_qty > 0),
  actual_qty    integer check (actual_qty is null or actual_qty >= 0),
  status        item_status,
  variance      integer generated always as (actual_qty - expected_qty) stored,
  unique (order_id, component_id)
);

-- ---------- verification logs (append-only audit trail) --------------
create table if not exists public.verification_logs (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.cutting_orders(id) on delete cascade,
  verifier_id     uuid not null references public.users(id),
  decision        verification_decision not null,
  rejection_note  text,
  wastage_pct     numeric(8,2),
  variances       jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  constraint rejection_needs_note check (
    decision = 'APPROVED' or (rejection_note is not null and length(trim(rejection_note)) >= 5)
  )
);

-- =====================================================================
-- DATABASE-LEVEL GUARDS (last line of defence, even if the API is bypassed)
-- =====================================================================

-- 1) Legal state transitions only
create or replace function public.enforce_order_state_machine()
returns trigger language plpgsql as $$
declare
  bad_items integer;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'CUTTING_IN_PROGRESS' then
      raise exception 'New orders must start in CUTTING_IN_PROGRESS' using errcode = 'P0001';
    end if;
    return new;
  end if;

  new.updated_at := now();

  -- once verified, audit columns are frozen
  if old.status in ('VERIFIED', 'SEWING_IN_PROGRESS') then
    if new.verified_by is distinct from old.verified_by
       or new.verified_at is distinct from old.verified_at
       or new.wastage_pct is distinct from old.wastage_pct
       or new.target_qty <> old.target_qty
       or new.actual_fabric_yds <> old.actual_fabric_yds then
      raise exception 'Verified audit data is immutable' using errcode = 'P0001';
    end if;
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not (
       (old.status = 'CUTTING_IN_PROGRESS'  and new.status = 'PENDING_VERIFICATION')
    or (old.status = 'PENDING_VERIFICATION' and new.status in ('VERIFIED', 'REJECTED'))
    or (old.status = 'REJECTED'             and new.status = 'CUTTING_IN_PROGRESS')
    or (old.status = 'VERIFIED'             and new.status = 'SEWING_IN_PROGRESS')
  ) then
    raise exception 'Illegal status transition % -> %', old.status, new.status using errcode = 'P0001';
  end if;

  -- HARD STOP: cannot become VERIFIED with any RED / uncounted component
  if new.status = 'VERIFIED' then
    select count(*) into bad_items
      from public.verification_items
     where order_id = new.id
       and (actual_qty is null or actual_qty < expected_qty);
    if bad_items > 0 then
      raise exception 'HARD STOP: % component(s) short or uncounted', bad_items using errcode = 'P0001';
    end if;
    if new.verified_by is null or new.verified_at is null or new.wastage_pct is null then
      raise exception 'Verified orders require verifier attribution' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_order_state_machine on public.cutting_orders;
create trigger trg_order_state_machine
  before insert or update on public.cutting_orders
  for each row execute function public.enforce_order_state_machine();

-- 2) Verification logs are append-only
create or replace function public.block_log_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'verification_logs is append-only' using errcode = 'P0001';
end $$;

drop trigger if exists trg_logs_immutable on public.verification_logs;
create trigger trg_logs_immutable
  before update or delete on public.verification_logs
  for each row execute function public.block_log_mutation();

-- =====================================================================
-- TRANSACTIONAL RPC: record a verification decision atomically.
-- Called ONLY by the Next.js server with the service-role key, after the
-- server has authenticated the user and checked role + business rules.
-- =====================================================================
create or replace function public.finalize_verification(
  p_order_id     uuid,
  p_verifier_id  uuid,
  p_decision     verification_decision,
  p_note         text,
  p_wastage_pct  numeric,
  p_items        jsonb      -- [{ "item_id": uuid, "actual_qty": int, "status": "GREEN" }]
) returns void language plpgsql as $$
declare
  v_status order_status;
  v_item   jsonb;
begin
  -- row lock prevents two verifiers racing on the same order
  select status into v_status from public.cutting_orders where id = p_order_id for update;
  if v_status is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_status <> 'PENDING_VERIFICATION' then
    raise exception 'ORDER_NOT_PENDING' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    update public.verification_items
       set actual_qty = (v_item->>'actual_qty')::int,
           status     = (v_item->>'status')::item_status
     where id = (v_item->>'item_id')::uuid
       and order_id = p_order_id;
  end loop;

  insert into public.verification_logs(order_id, verifier_id, decision, rejection_note, wastage_pct, variances)
  select p_order_id, p_verifier_id, p_decision, p_note, p_wastage_pct,
         coalesce(jsonb_agg(jsonb_build_object(
           'component', rc.component_name,
           'expected', vi.expected_qty,
           'actual', vi.actual_qty,
           'variance', vi.variance,
           'status', vi.status) order by rc.sort_order), '[]'::jsonb)
    from public.verification_items vi
    join public.recipe_components rc on rc.id = vi.component_id
   where vi.order_id = p_order_id;

  if p_decision = 'APPROVED' then
    update public.cutting_orders
       set status = 'VERIFIED', verified_by = p_verifier_id, verified_at = now(),
           wastage_pct = p_wastage_pct
     where id = p_order_id;
  else
    update public.cutting_orders
       set status = 'REJECTED', last_rejection_note = p_note
     where id = p_order_id;
  end if;
end $$;

-- Only the service role may call the RPC.
revoke all on function public.finalize_verification(uuid, uuid, verification_decision, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_verification(uuid, uuid, verification_decision, text, numeric, jsonb) to service_role;

-- =====================================================================
-- ROW LEVEL SECURITY (defence in depth for anyone using the anon key
-- directly against Supabase's REST API). All writes go through the
-- Next.js server using the service-role key, so there are NO write policies.
-- =====================================================================
create or replace function public.current_role_name()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

alter table public.users              enable row level security;
alter table public.recipes            enable row level security;
alter table public.recipe_components  enable row level security;
alter table public.cutting_orders     enable row level security;
alter table public.verification_items enable row level security;
alter table public.verification_logs  enable row level security;

drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users for select to authenticated using (id = auth.uid());

drop policy if exists recipes_read on public.recipes;
create policy recipes_read on public.recipes for select to authenticated using (true);

drop policy if exists components_read on public.recipe_components;
create policy components_read on public.recipe_components for select to authenticated using (true);

drop policy if exists orders_read on public.cutting_orders;
create policy orders_read on public.cutting_orders for select to authenticated using (
  case public.current_role_name()
    when 'cutting_supervisor' then true
    when 'cutting_verifier'   then status in ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')
    when 'sewing_supervisor'  then status in ('VERIFIED', 'SEWING_IN_PROGRESS')
    else false
  end
);

drop policy if exists items_read on public.verification_items;
create policy items_read on public.verification_items for select to authenticated using (
  exists (select 1 from public.cutting_orders o where o.id = order_id)  -- inherits orders_read
);

drop policy if exists logs_read on public.verification_logs;
create policy logs_read on public.verification_logs for select to authenticated using (
  exists (select 1 from public.cutting_orders o where o.id = order_id)
);

-- =====================================================================
-- TRANSACTIONAL RPC: create an order + its expected component rows atomically.
-- Expected quantities are computed by the server (multiplier engine) AND
-- re-checked here against the recipe so a tampered payload cannot pass.
-- =====================================================================
create or replace function public.create_cutting_order(
  p_recipe_id          uuid,
  p_target_qty         integer,
  p_fabric_roll_id     text,
  p_actual_fabric_yds  numeric,
  p_created_by         uuid,
  p_items              jsonb   -- [{ "component_id": uuid, "expected_qty": int }]
) returns table (id uuid, order_no text) language plpgsql as $$
#variable_conflict use_column
declare
  v_order public.cutting_orders%rowtype;
  v_mismatch integer;
begin
  insert into public.cutting_orders(recipe_id, target_qty, fabric_roll_id, actual_fabric_yds, created_by)
  values (p_recipe_id, p_target_qty, p_fabric_roll_id, p_actual_fabric_yds, p_created_by)
  returning * into v_order;

  insert into public.verification_items(order_id, component_id, expected_qty)
  select v_order.id, (e->>'component_id')::uuid, (e->>'expected_qty')::int
    from jsonb_array_elements(p_items) e;

  -- every recipe component present, and expected = target × pieces_per_garment
  select count(*) into v_mismatch
    from public.recipe_components rc
    left join public.verification_items vi
      on vi.component_id = rc.id and vi.order_id = v_order.id
   where rc.recipe_id = p_recipe_id
     and (vi.id is null or vi.expected_qty <> p_target_qty * rc.pieces_per_garment);
  if v_mismatch > 0 or (select count(*) from public.verification_items where order_id = v_order.id)
                      <> (select count(*) from public.recipe_components where recipe_id = p_recipe_id) then
    raise exception 'Component multiplier mismatch' using errcode = 'P0001';
  end if;

  return query select v_order.id, v_order.order_no;
end $$;

revoke all on function public.create_cutting_order(uuid, integer, text, numeric, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_cutting_order(uuid, integer, text, numeric, uuid, jsonb) to service_role;

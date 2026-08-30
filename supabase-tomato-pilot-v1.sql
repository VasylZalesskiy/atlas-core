begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.atlas_tomato_pilots (
  slug text primary key,
  enabled boolean not null default true,
  building_apartments integer not null default 170 check (building_apartments between 1 and 10000),
  kg_per_apartment numeric(8,2) not null default 5 check (kg_per_apartment > 0),
  total_kg numeric(12,2) not null default 850 check (total_kg > 0),
  pickup_title_uk text not null default 'Вечірня видача під будинком',
  pickup_title_en text not null default 'Evening pickup by the building',
  pickup_details_uk text not null default 'Дату першої видачі повідомимо після набору заявок. Видача — під будинком.',
  pickup_details_en text not null default 'We will announce the first pickup date after collecting requests. Pickup is by the building.',
  pickup_slots jsonb not null default '["18:00–19:00","19:00–20:00"]'::jsonb,
  reserved_kg numeric(12,2) not null default 0 check (reserved_kg >= 0),
  received_kg numeric(12,2) not null default 0 check (received_kg >= 0),
  order_count integer not null default 0 check (order_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_tomato_pilot_slots_check check (
    jsonb_typeof(pickup_slots) = 'array'
    and jsonb_array_length(pickup_slots) between 1 and 6
  ),
  constraint atlas_tomato_pilot_capacity_check check (total_kg >= kg_per_apartment)
);

create table if not exists public.atlas_tomato_orders (
  id uuid primary key default gen_random_uuid(),
  pilot_slug text not null references public.atlas_tomato_pilots(slug) on update cascade on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  apartment_number integer not null check (apartment_number > 0),
  quantity_kg numeric(8,2) not null default 5 check (quantity_kg > 0),
  pickup_slot text not null check (char_length(pickup_slot) between 3 and 40),
  status text not null default 'requested' check (status in ('requested','ready','received','cancelled')),
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_tomato_order_received_state check (
    (status = 'received' and received_at is not null)
    or (status <> 'received' and received_at is null)
  )
);

create unique index if not exists atlas_tomato_active_apartment_uidx
  on public.atlas_tomato_orders(pilot_slug, apartment_number)
  where status <> 'cancelled';

create unique index if not exists atlas_tomato_active_owner_uidx
  on public.atlas_tomato_orders(pilot_slug, owner_id)
  where status <> 'cancelled';

create index if not exists atlas_tomato_orders_status_created_idx
  on public.atlas_tomato_orders(pilot_slug, status, created_at);

create index if not exists atlas_tomato_orders_owner_idx
  on public.atlas_tomato_orders(owner_id);

create or replace function private.guard_atlas_tomato_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pilot public.atlas_tomato_pilots%rowtype;
  committed_kg numeric(12,2);
begin
  select * into pilot
  from public.atlas_tomato_pilots
  where slug = new.pilot_slug
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'tomato-pilot-not-found';
  end if;

  if new.apartment_number > pilot.building_apartments then
    raise exception using errcode = 'P0001', message = 'tomato-apartment-invalid';
  end if;

  if new.quantity_kg <> pilot.kg_per_apartment then
    raise exception using errcode = 'P0001', message = 'tomato-quantity-invalid';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements_text(pilot.pickup_slots) as slot(value)
    where slot.value = new.pickup_slot
  ) then
    raise exception using errcode = 'P0001', message = 'tomato-pickup-slot-invalid';
  end if;

  if tg_op = 'INSERT' and not pilot.enabled then
    raise exception using errcode = 'P0001', message = 'tomato-pilot-closed';
  end if;

  if new.status <> 'cancelled'
    and (tg_op = 'INSERT' or old.status = 'cancelled') then
    select coalesce(sum(quantity_kg), 0)
      into committed_kg
    from public.atlas_tomato_orders
    where pilot_slug = new.pilot_slug
      and status <> 'cancelled'
      and (tg_op = 'INSERT' or id <> new.id);

    if committed_kg + new.quantity_kg > pilot.total_kg then
      raise exception using errcode = 'P0001', message = 'tomato-pilot-sold-out';
    end if;
  end if;

  new.updated_at := now();
  if new.status = 'received' then
    new.received_at := coalesce(new.received_at, now());
  else
    new.received_at := null;
  end if;

  return new;
end;
$$;

create or replace function private.sync_atlas_tomato_pilot_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_slug text := coalesce(new.pilot_slug, old.pilot_slug);
begin
  update public.atlas_tomato_pilots p
  set
    reserved_kg = totals.reserved_kg,
    received_kg = totals.received_kg,
    order_count = totals.order_count,
    updated_at = now()
  from (
    select
      coalesce(sum(quantity_kg) filter (where status <> 'cancelled'), 0) as reserved_kg,
      coalesce(sum(quantity_kg) filter (where status = 'received'), 0) as received_kg,
      count(*) filter (where status <> 'cancelled')::integer as order_count
    from public.atlas_tomato_orders
    where pilot_slug = target_slug
  ) totals
  where p.slug = target_slug;

  return null;
end;
$$;

revoke all on function private.guard_atlas_tomato_order() from public, anon, authenticated;
revoke all on function private.sync_atlas_tomato_pilot_totals() from public, anon, authenticated;

drop trigger if exists atlas_tomato_order_guard on public.atlas_tomato_orders;
create trigger atlas_tomato_order_guard
before insert or update on public.atlas_tomato_orders
for each row execute function private.guard_atlas_tomato_order();

drop trigger if exists atlas_tomato_order_sync_totals on public.atlas_tomato_orders;
create trigger atlas_tomato_order_sync_totals
after insert or update or delete on public.atlas_tomato_orders
for each row execute function private.sync_atlas_tomato_pilot_totals();

insert into public.atlas_tomato_pilots (
  slug, enabled, building_apartments, kg_per_apartment, total_kg,
  pickup_title_uk, pickup_title_en, pickup_details_uk, pickup_details_en, pickup_slots
)
values (
  'building-170-tomatoes', true, 170, 5, 850,
  'Вечірня видача під будинком',
  'Evening pickup by the building',
  'Дату першої видачі повідомимо після набору заявок. Видача — під будинком.',
  'We will announce the first pickup date after collecting requests. Pickup is by the building.',
  '["18:00–19:00","19:00–20:00"]'::jsonb
)
on conflict (slug) do nothing;

alter table public.atlas_tomato_pilots enable row level security;
alter table public.atlas_tomato_orders enable row level security;

drop policy if exists "tomato pilot public read" on public.atlas_tomato_pilots;
create policy "tomato pilot public read"
  on public.atlas_tomato_pilots for select
  to anon, authenticated
  using (slug = 'building-170-tomatoes');

drop policy if exists "tomato pilot admin update" on public.atlas_tomato_pilots;
create policy "tomato pilot admin update"
  on public.atlas_tomato_pilots for update
  to authenticated
  using (
    coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
    and exists (select 1 from public.atlas_catalog_admins)
  )
  with check (
    coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
    and exists (select 1 from public.atlas_catalog_admins)
  );

drop policy if exists "tomato orders owner or admin read" on public.atlas_tomato_orders;
create policy "tomato orders owner or admin read"
  on public.atlas_tomato_orders for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or (
      coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
      and exists (select 1 from public.atlas_catalog_admins)
    )
  );

drop policy if exists "tomato orders owner insert" on public.atlas_tomato_orders;
create policy "tomato orders owner insert"
  on public.atlas_tomato_orders for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and pilot_slug = 'building-170-tomatoes'
    and status = 'requested'
  );

drop policy if exists "tomato orders owner cancel or admin update" on public.atlas_tomato_orders;
create policy "tomato orders owner cancel or admin update"
  on public.atlas_tomato_orders for update
  to authenticated
  using (
    (
      (select auth.uid()) = owner_id
      and status in ('requested','ready')
    )
    or (
      coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
      and exists (select 1 from public.atlas_catalog_admins)
    )
  )
  with check (
    (
      (select auth.uid()) = owner_id
      and status = 'cancelled'
    )
    or (
      coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
      and exists (select 1 from public.atlas_catalog_admins)
    )
  );

revoke all on table public.atlas_tomato_pilots from anon, authenticated;
revoke all on table public.atlas_tomato_orders from anon, authenticated;

grant select on table public.atlas_tomato_pilots to anon, authenticated;
grant update(enabled) on table public.atlas_tomato_pilots to authenticated;
grant select, insert on table public.atlas_tomato_orders to authenticated;
grant update(status) on table public.atlas_tomato_orders to authenticated;

commit;

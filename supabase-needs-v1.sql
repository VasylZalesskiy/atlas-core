begin;

create extension if not exists pgcrypto;

create table if not exists public.atlas_needs (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.atlas_passports(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_key text not null default 'vegetables' check (group_key = 'vegetables'),
  item_key text not null default 'tomatoes' check (item_key = 'tomatoes'),
  quantity numeric(12,2) not null check (quantity > 0 and quantity <= 1000000),
  unit text not null default 'kg' check (unit = 'kg'),
  needed_from date not null default current_date,
  needed_until date not null,
  status text not null default 'not_received' check (status in ('not_received','received')),
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_needs_valid_date_range check (needed_until >= needed_from),
  constraint atlas_needs_received_state check (
    (status = 'received' and received_at is not null)
    or (status = 'not_received' and received_at is null)
  )
);

create index if not exists atlas_needs_passport_created_idx
  on public.atlas_needs(passport_id, created_at desc);
create index if not exists atlas_needs_owner_created_idx
  on public.atlas_needs(owner_id, created_at desc);
create index if not exists atlas_needs_active_search_idx
  on public.atlas_needs(group_key, item_key, needed_until)
  where status = 'not_received';

alter table public.atlas_needs enable row level security;

drop policy if exists "atlas needs owner read" on public.atlas_needs;
create policy "atlas needs owner read"
  on public.atlas_needs for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "atlas needs owner insert" on public.atlas_needs;
create policy "atlas needs owner insert"
  on public.atlas_needs for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.atlas_passports p
      where p.id = passport_id and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists "atlas needs owner update" on public.atlas_needs;
create policy "atlas needs owner update"
  on public.atlas_needs for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "atlas needs owner delete" on public.atlas_needs;
create policy "atlas needs owner delete"
  on public.atlas_needs for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.atlas_needs from anon;
grant select, insert, update, delete on public.atlas_needs to authenticated;

commit;

begin;

create extension if not exists pgcrypto;

create table if not exists public.atlas_passports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  city text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists atlas_passports_owner_uidx
  on public.atlas_passports(owner_id);

create table if not exists public.atlas_private_contacts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  contact text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_opportunities (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.atlas_passports(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'other' check (kind in ('help','share','sell','give','lend','rent','other')),
  text text not null check (char_length(text) between 2 and 1500),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists atlas_opportunities_passport_idx
  on public.atlas_opportunities(passport_id, created_at desc);
create index if not exists atlas_opportunities_owner_idx
  on public.atlas_opportunities(owner_id, created_at desc);

alter table public.atlas_passports enable row level security;
alter table public.atlas_private_contacts enable row level security;
alter table public.atlas_opportunities enable row level security;

-- Passports are intentionally public, but they contain no private contact data.
drop policy if exists "atlas passports public read" on public.atlas_passports;
create policy "atlas passports public read"
  on public.atlas_passports for select
  using (true);

drop policy if exists "atlas passports owner insert" on public.atlas_passports;
create policy "atlas passports owner insert"
  on public.atlas_passports for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "atlas passports owner update" on public.atlas_passports;
create policy "atlas passports owner update"
  on public.atlas_passports for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "atlas passports owner delete" on public.atlas_passports;
create policy "atlas passports owner delete"
  on public.atlas_passports for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Private contact data is visible only to the passport owner.
drop policy if exists "atlas private owner read" on public.atlas_private_contacts;
create policy "atlas private owner read"
  on public.atlas_private_contacts for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "atlas private owner insert" on public.atlas_private_contacts;
create policy "atlas private owner insert"
  on public.atlas_private_contacts for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "atlas private owner update" on public.atlas_private_contacts;
create policy "atlas private owner update"
  on public.atlas_private_contacts for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "atlas private owner delete" on public.atlas_private_contacts;
create policy "atlas private owner delete"
  on public.atlas_private_contacts for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Active opportunities can be searched by Atlas. Only the owner can change them.
drop policy if exists "atlas opportunities public read active" on public.atlas_opportunities;
create policy "atlas opportunities public read active"
  on public.atlas_opportunities for select
  using (is_active = true or auth.uid() = owner_id);

drop policy if exists "atlas opportunities owner insert" on public.atlas_opportunities;
create policy "atlas opportunities owner insert"
  on public.atlas_opportunities for insert
  to authenticated
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.atlas_passports p
      where p.id = passport_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "atlas opportunities owner update" on public.atlas_opportunities;
create policy "atlas opportunities owner update"
  on public.atlas_opportunities for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "atlas opportunities owner delete" on public.atlas_opportunities;
create policy "atlas opportunities owner delete"
  on public.atlas_opportunities for delete
  to authenticated
  using (auth.uid() = owner_id);

grant usage on schema public to anon, authenticated;
grant select on public.atlas_passports to anon, authenticated;
grant select on public.atlas_opportunities to anon, authenticated;
grant select, insert, update, delete on public.atlas_passports to authenticated;
grant select, insert, update, delete on public.atlas_opportunities to authenticated;
revoke all on public.atlas_private_contacts from anon;
grant select, insert, update, delete on public.atlas_private_contacts to authenticated;

-- Transitional safety: the old demo table may still contain a `contact` column.
-- Keep legacy search fields readable, but remove public access to the contact itself.
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'revoke select on table public.profiles from anon, authenticated';
    execute 'grant select (slug,name,city,headline,can_help,can_share,needs) on public.profiles to anon, authenticated';
  end if;
end $$;

commit;

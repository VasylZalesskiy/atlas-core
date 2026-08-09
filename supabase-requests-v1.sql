begin;

create table if not exists public.atlas_requests (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.atlas_passports(id) on delete cascade,
  opportunity_id uuid references public.atlas_opportunities(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_name text not null default '',
  message text not null check (char_length(message) between 2 and 1000),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  owner_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> owner_id)
);

create index if not exists atlas_requests_owner_idx
  on public.atlas_requests(owner_id, created_at desc);
create index if not exists atlas_requests_requester_idx
  on public.atlas_requests(requester_id, created_at desc);
create index if not exists atlas_requests_passport_idx
  on public.atlas_requests(passport_id, created_at desc);

alter table public.atlas_requests enable row level security;

drop policy if exists "atlas requests parties read" on public.atlas_requests;
create policy "atlas requests parties read"
  on public.atlas_requests for select
  to authenticated
  using (auth.uid() = owner_id or auth.uid() = requester_id);

drop policy if exists "atlas requests requester insert" on public.atlas_requests;
create policy "atlas requests requester insert"
  on public.atlas_requests for insert
  to authenticated
  with check (
    auth.uid() = requester_id
    and requester_id <> owner_id
    and status = 'pending'
    and owner_contact is null
    and exists (
      select 1 from public.atlas_passports p
      where p.id = passport_id and p.owner_id = owner_id
    )
    and (
      opportunity_id is null
      or exists (
        select 1 from public.atlas_opportunities o
        where o.id = opportunity_id
          and o.passport_id = passport_id
          and o.owner_id = owner_id
          and o.is_active = true
      )
    )
  );

drop policy if exists "atlas requests owner update" on public.atlas_requests;
create policy "atlas requests owner update"
  on public.atlas_requests for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

revoke all on public.atlas_requests from anon, authenticated;
grant select, insert on public.atlas_requests to authenticated;
grant update (status, owner_contact, updated_at) on public.atlas_requests to authenticated;

commit;

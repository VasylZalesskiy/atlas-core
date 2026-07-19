-- Atlas 2.5 Sprint 2: apply manually after review. This migration does not modify profiles.
create table if not exists public.passport_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('can','have','share','need','ready')),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  category text not null,
  custom_category text check (custom_category is null or char_length(custom_category) <= 80),
  provision_formats jsonb not null default '[]'::jsonb check (jsonb_typeof(provision_formats) = 'array'),
  territory jsonb not null default '{"mode":"nearby"}'::jsonb check (jsonb_typeof(territory) = 'object'),
  availability jsonb not null default '{"mode":"always"}'::jsonb check (jsonb_typeof(availability) = 'object'),
  visibility jsonb not null default '{"scope":"private","communityId":null}'::jsonb check (jsonb_typeof(visibility) = 'object'),
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists passport_entries_owner_id_idx on public.passport_entries(owner_id);
create index if not exists passport_entries_entry_type_idx on public.passport_entries(entry_type);
create index if not exists passport_entries_category_idx on public.passport_entries(category);
create index if not exists passport_entries_status_idx on public.passport_entries(status);

create or replace function public.set_passport_entry_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists passport_entries_updated_at on public.passport_entries;
create trigger passport_entries_updated_at before update on public.passport_entries for each row execute function public.set_passport_entry_updated_at();

alter table public.passport_entries enable row level security;
create policy "passport_entries_select_own" on public.passport_entries for select to authenticated using ((select auth.uid()) = owner_id);
create policy "passport_entries_insert_own" on public.passport_entries for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "passport_entries_update_own" on public.passport_entries for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "passport_entries_delete_own" on public.passport_entries for delete to authenticated using ((select auth.uid()) = owner_id);

-- Public city, Atlas, Internet and community discovery must be added later through
-- security-reviewed views or RPC functions. No broad public RLS policy is opened here.

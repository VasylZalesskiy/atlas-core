-- Atlas building pilot: public clients may only read the activation window.
-- Change enabled/starts_at/ends_at from the Supabase SQL Editor to start,
-- extend or stop the pilot without publishing a new mobile build.

create table if not exists public.atlas_pilot_config (
  slug text primary key,
  enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  message_uk text not null default 'Тест Atlas у вашому будинку тимчасово призупинено.',
  message_en text not null default 'The Atlas building pilot is temporarily paused.',
  updated_at timestamptz not null default now(),
  constraint atlas_pilot_valid_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

alter table public.atlas_pilot_config enable row level security;
revoke all on table public.atlas_pilot_config from anon, authenticated;
grant select on table public.atlas_pilot_config to anon, authenticated;

drop policy if exists "Anyone can read Atlas pilot status" on public.atlas_pilot_config;
create policy "Anyone can read Atlas pilot status"
on public.atlas_pilot_config
for select
to anon, authenticated
using (slug = 'building-170');

insert into public.atlas_pilot_config (slug,enabled,starts_at,ends_at)
values ('building-170',true,now(),now()+interval '30 days')
on conflict (slug) do nothing;

-- Stop immediately:
-- update public.atlas_pilot_config set enabled=false,updated_at=now() where slug='building-170';
-- Resume / extend:
-- update public.atlas_pilot_config set enabled=true,ends_at=now()+interval '30 days',updated_at=now() where slug='building-170';

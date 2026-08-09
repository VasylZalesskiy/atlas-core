begin;

create table if not exists public.atlas_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null check (char_length(message) between 2 and 2000),
  lang text not null default 'uk',
  page_url text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists atlas_feedback_created_idx
  on public.atlas_feedback(created_at desc);

alter table public.atlas_feedback enable row level security;

drop policy if exists "atlas feedback authenticated insert"
  on public.atlas_feedback;

create policy "atlas feedback authenticated insert"
  on public.atlas_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

revoke all on public.atlas_feedback from anon, authenticated;
grant insert on public.atlas_feedback to authenticated;

commit;

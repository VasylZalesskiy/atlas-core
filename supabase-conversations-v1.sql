begin;

alter table public.atlas_requests
  add column if not exists requester_passport_id uuid references public.atlas_passports(id) on delete set null,
  add column if not exists subject text not null default '',
  add column if not exists initiator_side text not null default 'need_owner',
  add column if not exists last_message_at timestamptz not null default now();

alter table public.atlas_requests
  drop constraint if exists atlas_requests_request_kind_check;
alter table public.atlas_requests
  add constraint atlas_requests_request_kind_check
  check (request_kind in ('opportunity','availability_check','passport_message'));

alter table public.atlas_requests
  drop constraint if exists atlas_requests_initiator_side_check;
alter table public.atlas_requests
  add constraint atlas_requests_initiator_side_check
  check (initiator_side in ('provider','need_owner'));

alter table public.atlas_requests
  drop constraint if exists atlas_requests_subject_check;
alter table public.atlas_requests
  add constraint atlas_requests_subject_check
  check (char_length(subject) <= 240);

update public.atlas_requests r
set requester_passport_id = n.passport_id
from public.atlas_needs n
where r.requester_passport_id is null
  and r.need_id = n.id;

update public.atlas_requests r
set requester_passport_id = (
  select candidate.id
  from public.atlas_passports candidate
  where candidate.owner_id = r.requester_id
    and candidate.id <> r.passport_id
  order by candidate.updated_at desc
  limit 1
)
where r.requester_passport_id is null;

update public.atlas_requests
set initiator_side = case
  when coalesce(initiator_id, requester_id) = owner_id then 'provider'
  else 'need_owner'
end,
last_message_at = greatest(coalesce(updated_at, created_at), created_at)
where true;

create index if not exists atlas_requests_requester_passport_idx
  on public.atlas_requests(requester_passport_id, last_message_at desc);
create index if not exists atlas_requests_last_message_idx
  on public.atlas_requests(last_message_at desc);

create table if not exists public.atlas_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.atlas_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_side text not null check (sender_side in ('provider','need_owner')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists atlas_request_messages_thread_idx
  on public.atlas_request_messages(request_id, created_at asc);
create index if not exists atlas_request_messages_unread_idx
  on public.atlas_request_messages(request_id, sender_side, created_at desc)
  where read_at is null;

insert into public.atlas_request_messages(request_id, sender_id, sender_side, body, created_at)
select r.id,
       coalesce(r.initiator_id, r.requester_id),
       r.initiator_side,
       r.message,
       r.created_at
from public.atlas_requests r
where trim(r.message) <> ''
  and not exists (
    select 1 from public.atlas_request_messages m where m.request_id = r.id
  );

alter table public.atlas_request_messages enable row level security;

drop policy if exists "request messages parties read" on public.atlas_request_messages;
create policy "request messages parties read"
  on public.atlas_request_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.atlas_requests r
      where r.id = request_id
        and (
          (select auth.uid()) in (r.owner_id, r.requester_id)
          or atlas_internal.has_passport_access(r.passport_id)
          or atlas_internal.has_passport_access(r.requester_passport_id)
        )
    )
  );

drop policy if exists "request messages parties insert" on public.atlas_request_messages;
create policy "request messages parties insert"
  on public.atlas_request_messages for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (
      select 1
      from public.atlas_requests r
      where r.id = request_id
        and r.status in ('pending','accepted','provided')
        and (
          (select auth.uid()) in (r.owner_id, r.requester_id)
          or atlas_internal.has_passport_access(r.passport_id)
          or atlas_internal.has_passport_access(r.requester_passport_id)
        )
    )
  );

drop policy if exists "request messages parties mark read" on public.atlas_request_messages;
create policy "request messages parties mark read"
  on public.atlas_request_messages for update
  to authenticated
  using (
    exists (
      select 1
      from public.atlas_requests r
      where r.id = request_id
        and (
          (select auth.uid()) in (r.owner_id, r.requester_id)
          or atlas_internal.has_passport_access(r.passport_id)
          or atlas_internal.has_passport_access(r.requester_passport_id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.atlas_requests r
      where r.id = request_id
        and (
          (select auth.uid()) in (r.owner_id, r.requester_id)
          or atlas_internal.has_passport_access(r.passport_id)
          or atlas_internal.has_passport_access(r.requester_passport_id)
        )
    )
  );

revoke all on public.atlas_request_messages from anon, authenticated;
grant select, insert on public.atlas_request_messages to authenticated;
grant update (read_at) on public.atlas_request_messages to authenticated;

commit;

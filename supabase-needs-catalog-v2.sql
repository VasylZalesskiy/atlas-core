begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.atlas_catalog_admins (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_need_groups (
  group_key text primary key check (group_key ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  name_uk text not null check (char_length(name_uk) between 2 and 80),
  name_en text not null default '' check (char_length(name_en) <= 80),
  icon text not null default '📦' check (char_length(icon) between 1 and 8),
  is_active boolean not null default false,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_need_items (
  group_key text not null references public.atlas_need_groups(group_key) on update cascade on delete restrict,
  item_key text not null check (item_key ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  name_uk text not null check (char_length(name_uk) between 2 and 80),
  name_en text not null default '' check (char_length(name_en) <= 80),
  icon text not null default '📦' check (char_length(icon) between 1 and 8),
  unit text not null default 'шт' check (char_length(unit) between 1 and 12),
  is_active boolean not null default false,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_key,item_key)
);

create index if not exists atlas_need_groups_sort_idx
  on public.atlas_need_groups(sort_order,name_uk);
create index if not exists atlas_need_items_group_sort_idx
  on public.atlas_need_items(group_key,sort_order,name_uk);

insert into public.atlas_catalog_admins(email_hash)
values ('4bb80cecd72095898ee1b0bb322447be69adf2fa5121437a55693e9add9311d5')
on conflict (email_hash) do nothing;

insert into public.atlas_need_groups(group_key,name_uk,name_en,icon,is_active,sort_order) values
  ('vegetables','Овочі','Vegetables','🥬',true,10),
  ('fruit','Фрукти та ягоди','Fruit and berries','🍎',false,20),
  ('dairy','Молочні продукти','Dairy','🥛',false,30),
  ('meat','М’ясо та риба','Meat and fish','🐟',false,40),
  ('materials','Матеріали','Materials','🧱',false,50),
  ('services','Послуги','Services','🛠️',false,60)
on conflict (group_key) do nothing;

insert into public.atlas_need_items(group_key,item_key,name_uk,name_en,icon,unit,is_active,sort_order) values
  ('vegetables','tomatoes','Томати','Tomatoes','🍅','кг',true,10),
  ('vegetables','cucumbers','Огірки','Cucumbers','🥒','кг',false,20),
  ('vegetables','potatoes','Картопля','Potatoes','🥔','кг',false,30),
  ('vegetables','onions','Цибуля','Onions','🧅','кг',false,40)
on conflict (group_key,item_key) do nothing;

alter table public.atlas_needs drop constraint if exists atlas_needs_group_key_check;
alter table public.atlas_needs drop constraint if exists atlas_needs_item_key_check;
alter table public.atlas_needs drop constraint if exists atlas_needs_unit_check;
alter table public.atlas_needs drop constraint if exists atlas_needs_catalog_item_fkey;
alter table public.atlas_needs
  add constraint atlas_needs_group_key_format check (group_key ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  add constraint atlas_needs_item_key_format check (item_key ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  add constraint atlas_needs_unit_format check (char_length(unit) between 1 and 12),
  add constraint atlas_needs_catalog_item_fkey foreign key (group_key,item_key)
    references public.atlas_need_items(group_key,item_key) on update cascade on delete restrict;

alter table public.atlas_catalog_admins enable row level security;
alter table public.atlas_need_groups enable row level security;
alter table public.atlas_need_items enable row level security;

drop policy if exists "catalog admin can read own grant" on public.atlas_catalog_admins;
create policy "catalog admin can read own grant"
  on public.atlas_catalog_admins for select
  to authenticated
  using (
    coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
    and email_hash = pg_catalog.encode(
      extensions.digest(pg_catalog.lower(coalesce((select auth.jwt())->>'email','')),'sha256'),
      'hex'
    )
  );

drop policy if exists "need groups public read" on public.atlas_need_groups;
create policy "need groups public read"
  on public.atlas_need_groups for select
  to anon, authenticated
  using (true);

drop policy if exists "need groups admin insert" on public.atlas_need_groups;
create policy "need groups admin insert"
  on public.atlas_need_groups for insert
  to authenticated
  with check (
    coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
    and exists (select 1 from public.atlas_catalog_admins)
  );

drop policy if exists "need groups admin update" on public.atlas_need_groups;
create policy "need groups admin update"
  on public.atlas_need_groups for update
  to authenticated
  using (
    coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
    and exists (select 1 from public.atlas_catalog_admins)
  )
  with check (
    coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
    and exists (select 1 from public.atlas_catalog_admins)
  );

drop policy if exists "need groups admin delete" on public.atlas_need_groups;
create policy "need groups admin delete"
  on public.atlas_need_groups for delete
  to authenticated
  using (
    coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
    and exists (select 1 from public.atlas_catalog_admins)
  );

drop policy if exists "need items public read" on public.atlas_need_items;
create policy "need items public read"
  on public.atlas_need_items for select
  to anon, authenticated
  using (true);

drop policy if exists "need items admin insert" on public.atlas_need_items;
create policy "need items admin insert"
  on public.atlas_need_items for insert
  to authenticated
  with check (
    coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
    and exists (select 1 from public.atlas_catalog_admins)
  );

drop policy if exists "need items admin update" on public.atlas_need_items;
create policy "need items admin update"
  on public.atlas_need_items for update
  to authenticated
  using (
    coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
    and exists (select 1 from public.atlas_catalog_admins)
  )
  with check (
    coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
    and exists (select 1 from public.atlas_catalog_admins)
  );

drop policy if exists "need items admin delete" on public.atlas_need_items;
create policy "need items admin delete"
  on public.atlas_need_items for delete
  to authenticated
  using (
    coalesce((select auth.jwt())->>'is_anonymous','true') = 'false'
    and exists (select 1 from public.atlas_catalog_admins)
  );

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
    and exists (
      select 1 from public.atlas_need_items i
      join public.atlas_need_groups g on g.group_key = i.group_key
      where i.group_key = atlas_needs.group_key
        and i.item_key = atlas_needs.item_key
        and i.is_active = true
        and g.is_active = true
    )
  );

revoke all on public.atlas_catalog_admins from anon, authenticated;
grant select on public.atlas_catalog_admins to authenticated;
grant select on public.atlas_need_groups to anon, authenticated;
grant select on public.atlas_need_items to anon, authenticated;
grant insert,update,delete on public.atlas_need_groups to authenticated;
grant insert,update,delete on public.atlas_need_items to authenticated;
revoke update on public.atlas_needs from authenticated;
grant update(status,received_at,updated_at) on public.atlas_needs to authenticated;

commit;

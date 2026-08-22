begin;

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

commit;

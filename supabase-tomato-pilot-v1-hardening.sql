begin;

create index if not exists atlas_tomato_orders_owner_idx
  on public.atlas_tomato_orders(owner_id);

drop policy if exists "tomato orders owner read" on public.atlas_tomato_orders;
drop policy if exists "tomato orders admin read" on public.atlas_tomato_orders;
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

drop policy if exists "tomato orders owner cancel" on public.atlas_tomato_orders;
drop policy if exists "tomato orders admin update" on public.atlas_tomato_orders;
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

commit;

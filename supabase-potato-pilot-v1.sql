begin;

-- Building pilot: keep the catalog intact, but expose only potatoes when a
-- resident creates a new need. Existing needs remain unchanged.
update public.atlas_need_items
set is_active = (group_key = 'vegetables' and item_key = 'veg-potato-table'),
    updated_at = now();

update public.atlas_need_items
set name_uk = 'Картопля',
    name_en = 'Potatoes',
    unit = 'кг',
    sort_order = 10,
    updated_at = now()
where group_key = 'vegetables'
  and item_key = 'veg-potato-table';

update public.atlas_need_groups
set is_active = (group_key = 'vegetables'),
    updated_at = now();

commit;

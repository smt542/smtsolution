-- Apply a complete client-side order with one database round-trip and one statement.
create or replace function public.reorder_building_types(p_ordered_ids bigint[])
returns void
language sql
set search_path = public
as $$
  update public.building_types as item
  set sort_order = ordered.position::integer - 1
  from unnest(coalesce(p_ordered_ids, '{}'::bigint[]))
    with ordinality as ordered(id, position)
  where item.id = ordered.id
    and item.org_id = public.current_user_org();
$$;

revoke execute on function public.reorder_building_types(bigint[]) from public, anon;
grant execute on function public.reorder_building_types(bigint[]) to authenticated;

create or replace function public.reorder_fee_items(p_ordered_ids bigint[])
returns void
language sql
set search_path = public
as $$
  update public.fee_items as item
  set sort_order = ordered.position::integer - 1
  from unnest(coalesce(p_ordered_ids, '{}'::bigint[]))
    with ordinality as ordered(id, position)
  where item.id = ordered.id
    and item.org_id = public.current_user_org()
    and item.deleted_at is null;
$$;

revoke execute on function public.reorder_fee_items(bigint[]) from public, anon;
grant execute on function public.reorder_fee_items(bigint[]) to authenticated;

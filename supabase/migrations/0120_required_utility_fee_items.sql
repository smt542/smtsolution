-- Every building type must always have the utility items used by the billing
-- and moving-settlement flows. The UI also repairs drafts, while this migration
-- guarantees the invariant for existing data and non-UI inserts.

create or replace function public.ensure_required_utility_fee_items(p_type_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id bigint;
begin
  select org_id into v_org_id
  from public.building_types
  where id = p_type_id;

  if not found then
    return;
  end if;

  insert into public.fee_items (
    org_id,
    type_id,
    name,
    rounding,
    daily_proration,
    carry_over,
    is_required,
    sort_order,
    deleted_at
  )
  select
    v_org_id,
    p_type_id,
    required_item.name,
    'round'::fee_rounding,
    true,
    true,
    true,
    required_item.sort_order,
    null
  from (values
    ('전기'::text, 0),
    ('수도료'::text, 1),
    ('가스'::text, 2)
  ) as required_item(name, sort_order)
  on conflict (type_id, name) do update set
    is_required = true,
    deleted_at = null,
    sort_order = excluded.sort_order;
end;
$$;

revoke all on function public.ensure_required_utility_fee_items(bigint) from public, anon, authenticated;

-- Repair every existing building type, including previously soft-deleted rows.
select public.ensure_required_utility_fee_items(id)
from public.building_types;

-- Keep the three locked rows first while preserving the relative order of all
-- remaining active rows.
with normalized_order as (
  select
    id,
    row_number() over (
      partition by type_id
      order by
        case name when '전기' then 0 when '수도료' then 1 when '가스' then 2 else 3 end,
        sort_order,
        id
    ) - 1 as next_sort_order
  from public.fee_items
  where deleted_at is null
)
update public.fee_items as item
set sort_order = normalized_order.next_sort_order::integer
from normalized_order
where item.id = normalized_order.id;

alter table public.fee_items
  add constraint fee_items_required_utility_active
  check (
    name not in ('전기', '수도료', '가스')
    or (is_required and deleted_at is null)
  );

create or replace function public.seed_required_utility_fee_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_required_utility_fee_items(new.id);
  return new;
end;
$$;

revoke all on function public.seed_required_utility_fee_items() from public, anon, authenticated;

create trigger building_types_seed_required_utility_fee_items
after insert on public.building_types
for each row execute function public.seed_required_utility_fee_items();

-- If a required row is physically deleted or renamed outside the UI, restore
-- the canonical row. During a building-type cascade the parent no longer exists,
-- so the ensure function intentionally becomes a no-op.
create or replace function public.restore_required_utility_fee_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_required_utility_fee_items(old.type_id);
  if tg_op = 'UPDATE' and new.type_id is distinct from old.type_id then
    perform public.ensure_required_utility_fee_items(new.type_id);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.restore_required_utility_fee_items() from public, anon, authenticated;

create trigger fee_items_restore_deleted_required_utility
after delete on public.fee_items
for each row
when (old.name in ('전기', '수도료', '가스'))
execute function public.restore_required_utility_fee_items();

create trigger fee_items_restore_renamed_required_utility
after update of name, type_id on public.fee_items
for each row
when (
  old.name in ('전기', '수도료', '가스')
  and (new.name is distinct from old.name or new.type_id is distinct from old.type_id)
)
execute function public.restore_required_utility_fee_items();

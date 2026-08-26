-- 0104_receipts_workspace_rpc.sql
-- 수납 워크스페이스의 조직×월분 조회를 단일 왕복으로 통합한다.
-- 기존 list_payment_rows/list_billing/list_overdue_aggregates의 결과를 그대로 조합하며,
-- SECURITY DEFINER 내부에서 호출자 조직을 다시 검증한다.

create or replace function list_receipts_workspace(
  p_org_id bigint,
  p_period date
)
returns table(
  building_id bigint,
  building_code text,
  building_name text,
  building_address text,
  unit_id bigint,
  unit_no text,
  dong text,
  occupancy_id bigint,
  tenant_name text,
  is_vacant boolean,
  is_auto_debit boolean,
  due_date date,
  payer_no text,
  payer_name text,
  charged integer,
  paid integer,
  unpaid integer,
  pay_status text,
  phone text,
  overdue_occupancy_id bigint,
  overdue_months integer,
  overdue_amount bigint,
  last_payment_date date,
  billing_available boolean,
  period_charge_start_date date,
  period_charge_end_date date,
  period_due_date date,
  period_setting_saved boolean,
  occupancy jsonb,
  billing_items jsonb,
  fee_item_totals jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then
    raise exception 'no org for caller';
  end if;
  if p_org_id is null or p_org_id <> v_org then
    raise exception 'organization not available to caller';
  end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month';
  end if;

  return query
  with org_buildings as (
    select b.id, b.code, b.name, b.address
    from buildings b
    where b.org_id = p_org_id
      and b.deleted_at is null
  ),
  payment_rows as (
    select b.id as building_id, pr.*
    from org_buildings b
    cross join lateral list_payment_rows(b.id, p_period) pr
  ),
  billing_rows as (
    select b.id as building_id, br.*
    from org_buildings b
    cross join lateral list_billing(b.id, p_period) br
  ),
  billing_by_unit as (
    select
      br.building_id,
      br.unit_id,
      jsonb_agg(
        to_jsonb(br) - 'building_id'
        order by br.sort_order, br.fee_item_id
      ) as billing_items
    from billing_rows br
    group by br.building_id, br.unit_id
  ),
  fee_totals as (
    select
      br.building_id,
      br.fee_item_id,
      br.fee_item_name,
      min(br.sort_order) as sort_order,
      sum(br.amount)::bigint as amount
    from billing_rows br
    where br.charged
    group by br.building_id, br.fee_item_id, br.fee_item_name
  ),
  fee_totals_by_building as (
    select
      ft.building_id,
      jsonb_agg(
        jsonb_build_object(
          'fee_item_id', ft.fee_item_id,
          'fee_item_name', ft.fee_item_name,
          'amount', ft.amount
        )
        order by ft.sort_order, ft.fee_item_id
      ) as fee_item_totals
    from fee_totals ft
    group by ft.building_id
  ),
  period_settings as (
    select
      b.id as building_id,
      coalesce(
        ps.charge_start_date,
        date_trunc('month', p_period - interval '1 month')::date + 15
      ) as charge_start_date,
      coalesce(ps.charge_end_date, p_period + 14) as charge_end_date,
      ps.due_date,
      ps.id is not null as is_saved
    from org_buildings b
    left join billing_period_settings ps
      on ps.building_id = b.id
     and ps.period = p_period
  ),
  overdue_occupancies as (
    select distinct on (o.unit_id)
      u.building_id,
      o.id as occupancy_id,
      o.unit_id,
      o.tenant_name,
      o.payer_name,
      o.phone,
      o.resident_count,
      o.vehicle_no,
      o.move_in_date,
      o.move_out_date,
      o.status,
      o.memo,
      u.memo as unit_memo,
      u.area_pyeong,
      u.room_count
    from occupancies o
    join units u on u.id = o.unit_id and u.deleted_at is null
    join org_buildings b on b.id = u.building_id
    where o.status = 'occupied'
      and o.deleted_at is null
    order by o.unit_id, o.id desc
  ),
  overdue_rows as (
    select b.id as building_id, oa.*
    from org_buildings b
    cross join lateral list_overdue_aggregates(
      b.id,
      extract(year from p_period)::int,
      extract(month from p_period)::int,
      'current'
    ) oa
  )
  select
    b.id as building_id,
    b.code as building_code,
    b.name as building_name,
    b.address as building_address,
    pr.unit_id,
    pr.unit_no,
    pr.dong,
    pr.occupancy_id,
    pr.tenant_name,
    pr.is_vacant,
    pr.is_auto_debit,
    coalesce(pr.due_date, ps.due_date) as due_date,
    pr.payer_no,
    pr.payer_name,
    pr.charged,
    pr.paid,
    case when pr.charged is null then null else pr.charged - pr.paid end as unpaid,
    case
      when pr.charged is null then 'unbilled'
      when pr.charged <= 0 then case when pr.paid > 0 then 'over' else 'paid' end
      when pr.paid <= 0 then 'unpaid'
      when pr.paid < pr.charged then 'partial'
      when pr.paid = pr.charged then 'paid'
      else 'over'
    end as pay_status,
    oo.phone,
    oo.occupancy_id as overdue_occupancy_id,
    coalesce(od.overdue_months, 0)::integer as overdue_months,
    coalesce(od.overdue_amount, 0)::bigint as overdue_amount,
    od.last_payment_date,
    coalesce(od.billing_available, false) as billing_available,
    ps.charge_start_date as period_charge_start_date,
    ps.charge_end_date as period_charge_end_date,
    ps.due_date as period_due_date,
    ps.is_saved as period_setting_saved,
    case when oo.occupancy_id is null then null else jsonb_build_object(
      'occupancy_id', oo.occupancy_id,
      'tenant_name', oo.tenant_name,
      'payer_name', oo.payer_name,
      'phone', oo.phone,
      'resident_count', oo.resident_count,
      'vehicle_no', oo.vehicle_no,
      'move_in_date', oo.move_in_date,
      'move_out_date', oo.move_out_date,
      'status', oo.status,
      'memo', oo.memo,
      'unit_memo', oo.unit_memo,
      'area_pyeong', oo.area_pyeong,
      'room_count', oo.room_count
    ) end as occupancy,
    coalesce(bu.billing_items, '[]'::jsonb) as billing_items,
    coalesce(ft.fee_item_totals, '[]'::jsonb) as fee_item_totals
  from payment_rows pr
  join org_buildings b on b.id = pr.building_id
  join period_settings ps on ps.building_id = b.id
  left join billing_by_unit bu
    on bu.building_id = b.id
   and bu.unit_id = pr.unit_id
  left join fee_totals_by_building ft on ft.building_id = b.id
  left join overdue_occupancies oo
    on oo.building_id = b.id
   and oo.unit_id = pr.unit_id
  left join overdue_rows od
    on od.building_id = b.id
   and od.unit_id = pr.unit_id
   and od.occupancy_id = oo.occupancy_id
  order by b.code, pr.unit_no;
end;
$$;

revoke execute on function list_receipts_workspace(bigint, date) from public, anon;
grant execute on function list_receipts_workspace(bigint, date) to authenticated;


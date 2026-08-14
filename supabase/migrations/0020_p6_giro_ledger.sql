-- 0020_p6_giro_ledger.sql
-- P6 Phase D: 지로 수납 원장 조회 RPC (method='giro' 재사용)
-- 의존: P6 Phase A(payments), P1a(units), P3b(occupancies)
-- 모듈 게이트: payment(조회 org 개방)

create or replace function list_giro_payments(p_building_id bigint, p_period date)
returns table(id bigint, unit_no text, dong text, tenant_name text, amount int, paid_at date, status text, memo text)
language sql stable security definer set search_path = public as $$
  with u as (
    select id, unit_no, dong from units
    where building_id=p_building_id and deleted_at is null
      and building_id in (select id from buildings where org_id=current_user_org())
  ),
  occ as (
    select distinct on (o.unit_id) o.unit_id, o.tenant_name
    from occupancies o join u on u.id=o.unit_id
    where o.deleted_at is null
    order by o.unit_id, o.created_at desc, o.id desc
  )
  select p.id, u.unit_no, u.dong, occ.tenant_name, p.amount, p.paid_at, p.status, p.memo
  from payments p
  join u on u.id=p.unit_id
  left join occ on occ.unit_id=u.id
  where p.period=p_period and p.method='giro'
  order by p.paid_at desc, p.id desc
$$;
revoke execute on function list_giro_payments(bigint, date) from public, anon;
grant execute on function list_giro_payments(bigint, date) to authenticated;

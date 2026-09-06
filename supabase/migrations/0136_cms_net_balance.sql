-- 0136_cms_net_balance.sql
-- Collect only the unpaid balance for each confirmed billing occupancy.

create or replace function list_cms_debit_rows(p_building_id bigint, p_period date)
returns table(cms_member_no text, holder text, unit_no text, dong text, tenant_name text, charged int)
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
  ),
  acct as (
    select distinct on (a.unit_id) a.unit_id, a.cms_member_no, a.holder
    from unit_accounts a join u on u.id=a.unit_id
    where a.kind='mgmt' and a.cms_member_no is not null
    order by a.unit_id, a.id desc
  )
  select
    acct.cms_member_no,
    acct.holder,
    u.unit_no,
    u.dong,
    occ.tenant_name,
    greatest(bc.total_amount::bigint - coalesce(sum(p.amount), 0)::bigint, 0::bigint)::int as charged
  from acct
  join u on u.id=acct.unit_id
  left join occ on occ.unit_id=u.id
  left join billing_confirmations bc on bc.unit_id=u.id and bc.period=p_period
  left join payments p
    on p.occupancy_id=bc.occupancy_id
   and p.unit_id=bc.unit_id
   and p.period=bc.period
   and p.status='active'
  group by acct.cms_member_no, acct.holder, u.unit_no, u.dong, occ.tenant_name, bc.total_amount
  having greatest(bc.total_amount::bigint - coalesce(sum(p.amount), 0)::bigint, 0::bigint) > 0
  order by acct.cms_member_no asc
$$;
revoke execute on function list_cms_debit_rows(bigint, date) from public, anon;
grant execute on function list_cms_debit_rows(bigint, date) to authenticated;

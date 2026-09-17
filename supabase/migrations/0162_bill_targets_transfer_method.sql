-- 고지 대상 조회에 세대별 실제 이체방식을 포함한다.
drop function if exists list_bill_targets(bigint, date);
create or replace function list_bill_targets(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, occupancy_id bigint,
  tenant_name text, phone text, phone2 text, fax_number text,
  total_amount integer, auto_debit boolean,
  issue_type text, due_date date, send_status text, issued_at timestamptz,
  single_print boolean, water_cutoff boolean, scheduled_at timestamptz,
  message_schedule_id bigint, kakao_send_status text, fax_send_status text,
  transfer_method text
) language sql stable security definer set search_path = public as $$
  select
    u.id, u.unit_no, u.dong, bc.occupancy_id,
    o.tenant_name, o.phone, o.phone2, o.fax_number,
    bc.total_amount,
    exists (
      select 1 from unit_accounts ua
      where ua.unit_id = u.id and ua.kind = 'mgmt' and nullif(ua.cms_member_no, '') is not null
    ) as auto_debit,
    latest.issue_type, latest.due_date,
    kakao.send_status, latest.issued_at,
    coalesce(o.single_print, false),
    coalesce(paper.water_cutoff, o.single_print, false),
    kakao.scheduled_at, kakao.message_schedule_id,
    kakao.send_status, fax.send_status,
    coalesce(o.transfer_method, 'none')
  from billing_confirmations bc
  join units u on u.id = bc.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.id = p_building_id and b.org_id = current_user_org()
  left join occupancies o on o.id = bc.occupancy_id
  left join lateral (
    select x.issue_type, x.due_date, x.issued_at
    from bill_issues x
    where x.unit_id = u.id and x.period = p_period
    order by x.issued_at desc, x.id desc limit 1
  ) latest on true
  left join lateral (
    select x.water_cutoff
    from bill_issues x
    where x.unit_id = u.id and x.period = p_period and x.issue_type in ('a4', 'giro')
    order by x.issued_at desc, x.id desc limit 1
  ) paper on true
  left join lateral (
    select x.send_status, x.scheduled_at, x.message_schedule_id
    from bill_issues x
    where x.unit_id = u.id and x.period = p_period and x.issue_type = 'kakao'
    order by x.issued_at desc, x.id desc limit 1
  ) kakao on true
  left join lateral (
    select x.send_status
    from bill_issues x
    where x.unit_id = u.id and x.period = p_period and x.issue_type = 'fax'
    order by x.issued_at desc, x.id desc limit 1
  ) fax on true
  where bc.period = p_period and bc.confirmed_at is not null
  order by u.unit_no
$$;
revoke execute on function list_bill_targets(bigint, date) from public, anon;
grant execute on function list_bill_targets(bigint, date) to authenticated;

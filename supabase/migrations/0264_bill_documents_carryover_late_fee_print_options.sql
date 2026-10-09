-- 0264: 개선3차 항목 2·3 — 지로·팩스 고지서 이월 미납·연체료 + 셋업 출력 옵션
--  2: 고지서 데이터(get_bill_documents, load_fax_document)에 세입자 상세(resident_bill_detail, 0262)와
--     같은 정의의 연체료를 추가한다.
--       late_fee           = 당월 미납 × 누적요율(bill_issues 최신 납기 → 현재 KST 월) × late_fee_factor(org, occupancy)
--       carryover_unpaid   = bill_carryover(unit, period).carryover_unpaid
--       carryover_late_fee = bill_carryover(unit, period).carryover_late_fee
--     총액 = 당월 부과액 + 이월 미납 + (당월+이월 연체료) — 세입자 앱 금액과 일치.
--  3: 수도 단가·증감 출력용 meter_readings(당월 포함 6개월) 와 팩스용 셋업 출력 옵션·부과기간을 함께 반환.
-- get_bill_documents 는 반환 컬럼이 늘어 DROP 후 재생성한다(본문은 실DB pg_get_functiondef 기준 + 추가 컬럼).

-- 공용 헬퍼: 고지서 1장(세대·월)의 연체료·이월·검침 이력. SECURITY DEFINER RPC 내부에서만 호출한다.
create or replace function public.bill_document_extras(p_unit_id bigint, p_period date)
returns table(late_fee integer, carryover_unpaid integer, carryover_late_fee integer, meters jsonb)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select
    coalesce(round(
      greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate * late_fee_factor(b.org_id, bc.occupancy_id) / 100.0
    ), 0)::int as late_fee,
    co.carryover_unpaid,
    co.carryover_late_fee,
    coalesce(m.meters, '[]'::jsonb) as meters
  from billing_confirmations bc
  join units u on u.id = bc.unit_id
  join buildings b on b.id = u.building_id
  cross join lateral bill_carryover(bc.unit_id, bc.period) co
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from payments p
    where p.unit_id = bc.unit_id
      and p.occupancy_id = bc.occupancy_id
      and p.period = bc.period
      and p.status = 'active'
  ) pay on true
  left join lateral (
    select bi.due_date
    from bill_issues bi
    where bi.unit_id = bc.unit_id
      and bi.period = bc.period
    order by bi.issued_at desc, bi.id desc
    limit 1
  ) issue on true
  left join lateral (
    select coalesce(sum(
      (
        select t.monthly_rate
        from late_fee_rate_tiers t
        where t.org_id = b.org_id
          and k.k > t.from_month
          and (t.to_month is null or k.k <= t.to_month)
        order by t.tier_order
        limit 1
      )
    ), 0)::numeric as cumulative_rate
    from generate_series(1,
      case
        when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0
             and issue.due_date is not null
        then greatest(
          (extract(year from timezone('Asia/Seoul', now()))::int - extract(year from issue.due_date)::int) * 12
          + (extract(month from timezone('Asia/Seoul', now()))::int - extract(month from issue.due_date)::int),
          0
        )
        else 0
      end
    ) as k(k)
  ) lf on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'utility', mr.utility,
        'period', to_char(mr.period, 'YYYY-MM'),
        'usage', mr.usage,
        'previous_reading', mr.previous_reading,
        'current_reading', mr.current_reading,
        'unit_price', mr.unit_price
      ) order by mr.period desc, mr.utility
    ) as meters
    from meter_readings mr
    where mr.unit_id = bc.unit_id
      and mr.period between (p_period - interval '5 months')::date and p_period
  ) m on true
  where bc.unit_id = p_unit_id
    and bc.period = p_period
    and bc.confirmed_at is not null;
$function$;

revoke all on function public.bill_document_extras(bigint, date) from public, anon, authenticated;
grant execute on function public.bill_document_extras(bigint, date) to service_role;

drop function if exists public.get_bill_documents(bigint, date, jsonb);

create function public.get_bill_documents(p_building_id bigint, p_period date, p_unit_ids jsonb)
 returns table(unit_id bigint, unit_no text, dong text, tenant_name text, total_amount integer, auto_debit boolean, items jsonb, billing_note text, unit_notice text, late_fee integer, carryover_unpaid integer, carryover_late_fee integer, meters jsonb)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    u.id, u.unit_no, u.dong, o.tenant_name,
    bc.total_amount,
    exists (select 1 from unit_accounts ua where ua.unit_id = u.id and ua.kind = 'mgmt' and nullif(ua.cms_member_no,'') is not null) as auto_debit,
    coalesce(bh.items, '[]'::jsonb) as items, bc.billing_note, bc.unit_notice,
    coalesce(ex.late_fee, 0), coalesce(ex.carryover_unpaid, 0), coalesce(ex.carryover_late_fee, 0),
    coalesce(ex.meters, '[]'::jsonb)
  from billing_confirmations bc
  join units u on u.id = bc.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.id = p_building_id and b.org_id = current_user_org()
  left join occupancies o on o.id = bc.occupancy_id
  left join lateral (
    select h.items from billing_history h
    where h.unit_id = u.id and h.period = p_period
    order by h.confirmed_at desc, h.id desc limit 1
  ) bh on true
  left join lateral bill_document_extras(u.id, p_period) ex on true
  where bc.period = p_period and bc.confirmed_at is not null
    and bc.unit_id in (select jsonb_array_elements_text(coalesce(p_unit_ids,'[]'::jsonb))::bigint)
  order by u.unit_no
$function$;

revoke all on function public.get_bill_documents(bigint, date, jsonb) from public, anon;
grant execute on function public.get_bill_documents(bigint, date, jsonb) to authenticated, service_role;

create or replace function public.load_fax_document(p_bill_issue_id bigint)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_org bigint;
  v_result jsonb;
begin
  v_org := public.current_user_org();
  if v_org is null then
    raise exception 'no org for caller' using errcode = '42501';
  end if;
  if not public.current_user_has_module('bill_publish') then
    raise exception 'forbidden: bill_publish required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'bill_issue_id', bi.id,
    'org_id', b.org_id,
    'company_name', org.name,
    'building', jsonb_build_object('id', b.id, 'name', b.name, 'address', b.address),
    'unit_id', u.id,
    'unit_no', u.unit_no,
    'dong', u.dong,
    'period', to_char(bi.period, 'YYYY-MM'),
    'tenant_name', o.tenant_name,
    'payer_name', o.payer_name,
    'payer_no', ua.payer_no,
    'bill_name_display', coalesce(o.bill_name_display, bi.unit_label_mode, 'name'),
    'phone', o.phone,
    'fax_number', o.fax_number,
    'auto_debit', bi.auto_debit,
    'amount', bc.total_amount,
    'items', coalesce(bh.items, '[]'::jsonb),
    'unit_notice', bc.unit_notice,
    'customer_notice', sc.customer_notice,
    'due_date', to_char(bi.due_date, 'YYYY-MM-DD'),
    'mgmt_bank1', sc.mgmt_bank1, 'mgmt_acct1', sc.mgmt_acct1, 'mgmt_holder1', sc.mgmt_holder1,
    'mgmt_print1', coalesce(sc.mgmt_print1, false),
    'mgmt_bank2', sc.mgmt_bank2, 'mgmt_acct2', sc.mgmt_acct2, 'mgmt_holder2', sc.mgmt_holder2,
    'mgmt_print2', coalesce(sc.mgmt_print2, false)
  ) || jsonb_build_object(
    'late_fee', coalesce(ex.late_fee, 0),
    'carryover_unpaid', coalesce(ex.carryover_unpaid, 0),
    'carryover_late_fee', coalesce(ex.carryover_late_fee, 0),
    'meters', coalesce(ex.meters, '[]'::jsonb),
    'late_fee_merge', coalesce(sc.late_fee_merge, false),
    'print_water_unit_price', coalesce(sc.print_water_unit_price, false),
    'print_billing_period', coalesce(sc.print_billing_period, false),
    'print_delta', coalesce(sc.print_delta, false),
    'charge_start_date', to_char(bps.charge_start_date, 'YYYY-MM-DD'),
    'charge_end_date', to_char(bps.charge_end_date, 'YYYY-MM-DD')
  )
  into v_result
  from public.bill_issues bi
  join public.units u on u.id = bi.unit_id and u.deleted_at is null
  join public.buildings b on b.id = u.building_id and b.org_id = v_org
  join public.billing_confirmations bc
    on bc.unit_id = u.id and bc.period = bi.period and bc.confirmed_at is not null
  left join public.occupancies o on o.id = bi.occupancy_id
  left join public.unit_accounts ua on ua.unit_id = u.id and ua.kind = 'mgmt'
  left join lateral (
    select h.items from public.billing_history h
    where h.unit_id = u.id and h.period = bi.period
    order by h.confirmed_at desc, h.id desc limit 1
  ) bh on true
  left join lateral public.bill_document_extras(u.id, bi.period) ex on true
  left join public.billing_period_settings bps on bps.building_id = b.id and bps.period = bi.period
  left join public.setup_config sc on sc.org_id = v_org
  join public.organizations org on org.id = v_org
  where bi.id = p_bill_issue_id and bi.issue_type = 'fax';

  if v_result is null then
    return jsonb_build_object('ok', false, 'code', 'BILL_ISSUE_NOT_FOUND');
  end if;
  return jsonb_build_object('ok', true) || v_result;
end
$function$;

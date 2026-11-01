-- QA #56 단전·단수 예고 자동 판정 (2026-11-01)
--
-- 문제: list_bill_targets.water_cutoff = coalesce(저장값, 자동판정) 이라, 셋업을 켜기 전·미납이 생기기 전에
--       한 번 출력해 저장된 water_cutoff=false 가 자동판정을 영구히 덮었다(지로 재출력·알림톡도 false 유지).
-- 수정:
--   1) 판정을 공용 함수 bill_utility_cutoff_due(unit, occupancy, period) 하나로 모은다.
--      - setup_config.print_utility_cutoff 가 켜져 있고 cutoff_months(N) 가 있을 때,
--      - 현재 입주(occupancy) 귀속 + 부과확정 + 대상 월 이전 + 납기 경과(billing_effective_due_date < 오늘, KST)인
--        최근 N개 부과월이 모두 미수납(total_amount - 활성 수납 > 0)이면 true (연속 미납 N개월, 금액 무관).
--      - 예: N=2, 8·9월 납기 경과 미납 → 10월 고지서에 단전·단수 예고.
--   2) list_bill_targets.water_cutoff = 셋업 출력 여부 AND (저장값(수동 강제) OR 자동판정).
--      셋업 출력 여부가 꺼져 있으면 표시하지 않는다. 저장된 false 는 더 이상 자동판정을 막지 않는다.
--   3) issue_bills 는 화면이 넘긴 단수 세대 목록에 자동판정 대상을 OR 병합해 저장한다(서버 기준).
--   지로 도장(DocumentOutputModal)·알림톡 장기미납 템플릿(billNoticeKind) 모두 list_bill_targets.water_cutoff 를 쓴다.

create or replace function public.bill_utility_cutoff_due(p_unit_id bigint, p_occupancy_id bigint, p_period date)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((
    select
      sc.print_utility_cutoff is true
      and sc.cutoff_months is not null
      and sc.cutoff_months > 0
      and (
        -- 납기 경과한 최근 N개 부과월이 모두 미납이어야 한다(연속 미납 N개월).
        select count(*) = sc.cutoff_months and bool_and(recent.unpaid > 0)
        from (
          select pbc.total_amount - coalesce((
            select sum(pay.amount)
            from payments pay
            where pay.occupancy_id = pbc.occupancy_id and pay.unit_id = pbc.unit_id
              and pay.period = pbc.period and pay.status = 'active' and pay.late_fee_split_id is null
          ), 0) as unpaid
          from billing_confirmations pbc
          join occupancies po
            on po.id = pbc.occupancy_id and po.unit_id = pbc.unit_id and po.deleted_at is null
          where pbc.unit_id = p_unit_id
            and pbc.occupancy_id = p_occupancy_id
            and pbc.period < p_period
            and pbc.confirmed_at is not null
            and public.billing_effective_due_date(pbc.unit_id, pbc.period) < (timezone('Asia/Seoul', now()))::date
          order by pbc.period desc
          limit sc.cutoff_months
        ) recent
      )
    from units u
    join buildings b on b.id = u.building_id
    join setup_config sc on sc.org_id = b.org_id
    where u.id = p_unit_id
  ), false);
$function$;

revoke all on function public.bill_utility_cutoff_due(bigint, bigint, date) from public, anon, authenticated;
grant execute on function public.bill_utility_cutoff_due(bigint, bigint, date) to service_role;

CREATE OR REPLACE FUNCTION public.list_bill_targets(p_building_id bigint, p_period date)
 RETURNS TABLE(unit_id bigint, unit_no text, dong text, occupancy_id bigint, tenant_name text, phone text, phone2 text, fax_number text, total_amount integer, auto_debit boolean, issue_type text, due_date date, send_status text, issued_at timestamp with time zone, single_print boolean, water_cutoff boolean, scheduled_at timestamp with time zone, message_schedule_id bigint, kakao_send_status text, fax_send_status text, transfer_method text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    u.id, u.unit_no, u.dong, bc.occupancy_id,
    o.tenant_name, o.phone, o.phone2, o.fax_number,
    bc.total_amount,
    coalesce(o.transfer_method = 'auto_transfer', false) as auto_debit,
    latest.issue_type, latest.due_date,
    kakao.send_status, latest.issued_at,
    coalesce(o.single_print, false),
    -- 셋업 출력 여부 off 면 표시 안 함. 저장값은 수동 강제(true)일 때만 의미, 자동판정은 항상 적용.
    coalesce(sc.print_utility_cutoff, false)
      and (
        coalesce(paper.water_cutoff, false)
        or public.bill_utility_cutoff_due(u.id, bc.occupancy_id, p_period)
      ),
    kakao.scheduled_at, kakao.message_schedule_id,
    kakao.send_status, fax.send_status,
    coalesce(o.transfer_method, 'none')
  from billing_confirmations bc
  join units u on u.id = bc.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.id = p_building_id and b.org_id = current_user_org()
  left join setup_config sc on sc.org_id = b.org_id
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
$function$;

CREATE OR REPLACE FUNCTION public.issue_bills(p_building_id bigint, p_period date, p_unit_ids jsonb, p_issue_type text, p_due_date date, p_unit_label_mode text, p_water_cutoff_unit_ids jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org bigint; v_unit_id bigint; v_count int := 0;
  v_total int; v_occ_id bigint; v_auto boolean; v_water_cutoff boolean;
  v_mode text := coalesce(p_unit_label_mode, 'code');
  v_default_cutoff bigint[] := '{}';
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('bill_publish') then raise exception 'forbidden: bill_publish required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_issue_type not in ('a4','giro','kakao','fax') then raise exception 'invalid issue_type'; end if;
  if v_mode not in ('code','name') then raise exception 'invalid unit_label_mode'; end if;

  -- 단수 지정 목록이 없으면 청구 대상 목록의 기본값(list_bill_targets.water_cutoff)을 발행 전에 한 번만 계산한다.
  if p_water_cutoff_unit_ids is null then
    select coalesce(array_agg(t.unit_id), '{}') into v_default_cutoff
    from list_bill_targets(p_building_id, p_period) t where t.water_cutoff;
  end if;

  for v_unit_id in select jsonb_array_elements_text(coalesce(p_unit_ids, '[]'::jsonb))::bigint loop
    select bc.total_amount, bc.occupancy_id into v_total, v_occ_id
    from billing_confirmations bc
    join units u on u.id = bc.unit_id and u.building_id = p_building_id and u.deleted_at is null
    where bc.unit_id = v_unit_id and bc.period = p_period and bc.confirmed_at is not null;
    if not found then raise exception 'unit % not confirmed for period', v_unit_id; end if;

    v_auto := exists (select 1 from occupancies ao where ao.id = v_occ_id and ao.transfer_method = 'auto_transfer');
    if p_water_cutoff_unit_ids is null then
      v_water_cutoff := v_unit_id = any(v_default_cutoff);
    else
      -- 화면 지정(수동 강제) OR 자동판정 대상(서버 기준) — 자동 대상이 false 로 저장되지 않게 한다.
      v_water_cutoff := exists (
        select 1 from jsonb_array_elements_text(p_water_cutoff_unit_ids) x(value)
        where x.value::bigint = v_unit_id
      ) or public.bill_utility_cutoff_due(v_unit_id, v_occ_id, p_period);
    end if;

    insert into bill_issues(
      unit_id, period, occupancy_id, issue_type, group_no, due_date,
      unit_label_mode, auto_debit, total_amount, water_cutoff, issued_by
    ) values (
      v_unit_id, p_period, v_occ_id, p_issue_type, 1, p_due_date,
      v_mode, v_auto, coalesce(v_total, 0), v_water_cutoff, auth.uid()
    ) on conflict (unit_id, period, issue_type) do update
      set due_date = excluded.due_date,
          unit_label_mode = excluded.unit_label_mode,
          auto_debit = excluded.auto_debit,
          total_amount = excluded.total_amount,
          occupancy_id = excluded.occupancy_id,
          water_cutoff = excluded.water_cutoff,
          issued_by = excluded.issued_by,
          issued_at = now();
    v_count := v_count + 1;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILL_ISSUE', 'bill_issues', p_building_id::text,
      jsonb_build_object('period', p_period, 'issue_type', p_issue_type, 'count', v_count));

  return jsonb_build_object('count', v_count);
end $function$;

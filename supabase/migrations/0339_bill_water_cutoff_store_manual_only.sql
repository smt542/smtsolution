-- QA #56 fix round 1 (2026-11-01): bill_issues.water_cutoff 는 수동 강제만 저장한다.
--
-- 문제(0338): 화면이 자동판정 대상 세대까지 p_water_cutoff_unit_ids 로 넘기고 issue_bills 가 true 로 저장 →
--   list_bill_targets 가 이를 수동 강제로 보고, 같은 달 안에 납부해도 도장·장기미납 알림톡 템플릿이 남았다.
-- 수정: issue_bills 는 목록(또는 기본값)에 있으면서 발행 시점 자동판정이 false 인 세대만 true 로 저장한다.
--   자동판정 대상은 false 로 저장하고 list_bill_targets 가 읽을 때 bill_utility_cutoff_due 로 다시 계산한다.
-- bill_issues.water_cutoff 를 읽는 곳은 list_bill_targets(paper lateral) 하나뿐이다(DB 함수·뷰·Edge·Next 코드 확인).
-- 데이터 보정: 기존 giro/a4 저장 true 중 현재 자동판정 대상인 행은 자동 결과가 저장된 것이므로 false 로 정규화한다.

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
      v_water_cutoff := exists (
        select 1 from jsonb_array_elements_text(p_water_cutoff_unit_ids) x(value)
        where x.value::bigint = v_unit_id
      );
    end if;
    -- 저장값은 "수동 강제"만 뜻한다. 발행 시점에 자동판정 대상이면 false 로 저장해
    -- 읽을 때(list_bill_targets) 자동판정이 다시 계산되게 한다(납부 후 도장·장기미납 템플릿이 남지 않게).
    v_water_cutoff := v_water_cutoff and not public.bill_utility_cutoff_due(v_unit_id, v_occ_id, p_period);

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

update bill_issues bi
set water_cutoff = false
where bi.water_cutoff
  and bi.issue_type in ('a4', 'giro')
  and public.bill_utility_cutoff_due(bi.unit_id, bi.occupancy_id, bi.period);

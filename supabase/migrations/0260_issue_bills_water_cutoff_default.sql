-- issue_bills: p_water_cutoff_unit_ids 가 null 일 때 단수(斷水) 예고 기본값이 端數 출력 플래그(single_print)로 채워지던 문제 수정.
-- list_bill_targets(0259)와 동일한 값(직전 종이 발행값 우선, 없으면 연속 미납 자동판정)을 쓴다. 시그니처·권한·나머지 로직은 그대로.
begin;

create or replace function public.issue_bills(p_building_id bigint, p_period date, p_unit_ids jsonb, p_issue_type text, p_due_date date, p_unit_label_mode text, p_water_cutoff_unit_ids jsonb DEFAULT NULL::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

    v_auto := exists (
      select 1 from unit_accounts ua
      where ua.unit_id = v_unit_id and ua.kind = 'mgmt' and nullif(ua.cms_member_no, '') is not null
    );
    if p_water_cutoff_unit_ids is null then
      v_water_cutoff := v_unit_id = any(v_default_cutoff);
    else
      v_water_cutoff := exists (
        select 1 from jsonb_array_elements_text(p_water_cutoff_unit_ids) x(value)
        where x.value::bigint = v_unit_id
      );
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

commit;

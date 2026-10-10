-- 파트너 이사정산 공과금 정산: 검침월·단가를 컨텍스트에 포함.
--
-- 사무실 이사정산(get_settlement_context, 0266)과 같은 기본값을 쓰기 위해 meter_summary 에
--   period     — 검침월(퇴실월 검침이면 previous_reading, 이전 달 검침이면 current_reading 이 「전월 지침」)
--   unit_price — 그 달 검침 단가(셋업 정책 3.3: 수도·전기 단가 반영=반영 고정 → 단가 기본값)
-- 를 더한다. 나머지는 기존과 같다.

create or replace function public.partner_get_settlement_context(p_unit_id bigint, p_settlement_id bigint default null::bigint)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_unit jsonb;
  v_occupancy jsonb;
  v_settlement_id bigint;
  v_settlement jsonb;
  v_account jsonb;
  v_checklist jsonb;
  v_meter_summary jsonb;
  v_period date;
  v_billing_unpaid bigint;
begin
  select b.org_id into v_org
    from units u
    join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null
      and b.id in (select partner_my_building_ids());
  if v_org is null then raise exception 'unit not assigned to caller'; end if;

  select jsonb_build_object(
      'id', u.id, 'unit_no', u.unit_no, 'dong', u.dong,
      'building_id', u.building_id, 'building_name', b.name
    ) into v_unit
    from units u
    join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null;

  select jsonb_build_object(
      'id', o.id, 'tenant_name', o.tenant_name, 'phone', o.phone,
      'alimtalk_opt_in', coalesce(o.alimtalk_opt_in, false),
      'move_in_date', o.move_in_date, 'settlement_note', o.settlement_note,
      'billing_note', o.billing_note, 'status', o.status
    ) into v_occupancy
    from occupancies o
    where o.unit_id = p_unit_id and o.deleted_at is null
    order by o.created_at desc limit 1;

  if p_settlement_id is not null then
    select s.id, to_jsonb(s) into v_settlement_id, v_settlement
      from moving_settlements s
      where s.id = p_settlement_id and s.unit_id = p_unit_id;
  else
    select s.id, to_jsonb(s) into v_settlement_id, v_settlement
      from moving_settlements s
      where s.unit_id = p_unit_id and s.status in ('draft','saved')
      order by s.created_at desc limit 1;
  end if;

  -- 검침 기준월: 정산건의 퇴실월. 신규 작성(퇴실일 미입력)이면 null → 최신 검침을 쓴다.
  v_period := date_trunc('month', (v_settlement->>'move_out_date')::date)::date;

  select jsonb_build_object(
      'settle_bank', sc.settle_bank, 'settle_acct', sc.settle_acct,
      'settle_holder', sc.settle_holder
    ) into v_account
    from setup_config sc where sc.org_id = v_org;
  v_account := coalesce(v_account, jsonb_build_object(
    'settle_bank', null, 'settle_acct', null, 'settle_holder', null
  ));

  select coalesce(jsonb_agg(
      jsonb_build_object('id', sci.id, 'label', sci.label,
                         'checked', coalesce(scr.checked, false), 'note', scr.note)
      order by sci.sort_order, sci.id
    ), '[]'::jsonb) into v_checklist
    from settlement_check_items sci
    left join settlement_checklist_results scr
      on scr.check_item_id = sci.id and scr.settlement_id = v_settlement_id
    where sci.org_id = v_org and sci.deleted_at is null;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'utility', utility_row.utility,
        'period', cur.period,
        'previous_reading', coalesce(cur.previous_reading, prev.current_reading),
        'current_reading', cur.current_reading,
        'unit_price', cur.unit_price,
        'usage', coalesce(
          cur.usage,
          case when cur.current_reading is not null and coalesce(cur.previous_reading, prev.current_reading) is not null
            then cur.current_reading - coalesce(cur.previous_reading, prev.current_reading)
          end
        )
      ) order by utility_row.sort_order
    ), '[]'::jsonb) into v_meter_summary
    from (values ('water', 1), ('elec', 2), ('gas', 3)) as utility_row(utility, sort_order)
    left join lateral (
      select mr.* from meter_readings mr
      where mr.unit_id = p_unit_id and mr.utility = utility_row.utility
        and (v_period is null or mr.period <= v_period)
      order by mr.period desc limit 1
    ) cur on true
    left join meter_readings prev
      on prev.unit_id = p_unit_id and prev.utility = utility_row.utility
      and prev.period = (cur.period - interval '1 month')::date;

  -- ③ 미납(미납관리비 + 연체료). occupancy 가 없으면 0.
  v_billing_unpaid := case
    when v_occupancy is null then 0
    else settlement_billing_unpaid(p_unit_id, (v_occupancy->>'id')::bigint)
  end;

  return jsonb_build_object(
    'unit', v_unit,
    'occupancy', v_occupancy,
    'latest_settlement', v_settlement,
    'settle_account', v_account,
    'checklist', v_checklist,
    'meter_summary', v_meter_summary,
    'billing_unpaid', v_billing_unpaid
  );
end $function$;

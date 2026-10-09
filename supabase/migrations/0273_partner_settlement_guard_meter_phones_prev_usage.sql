-- 0273: 개선3차 31·33·34·35 — 현장 관리자(partner) 이사정산·검침 자료
--  31 partner_save_moving_settlement: 미수금 < 0(extra.paid > settlement_amount)이면 저장 거부.
--     settlement_amount = ①공과금 + ②관리비 + ③미납(settlement_billing_unpaid, 0268) + ④청소·기타(수납 차감 전).
--     partner_get_settlement_context 가 같은 occupancy 기준 ③(billing_unpaid)을 돌려줘 화면 미수금이 서버와 같은 식이 된다.
--  35 partner_save_moving_settlement: 금액·지침·일수(표준 컬럼 + extra) 음수 거부.
--  33 partner_list_meter_cards: 부번호까지 정규화한 phones_more text[] 반환(2차 #10 partner_get_occupancy 와 같은 식).
--  34 meter_readings.prev_usage_override: 검침 화면에서 고친 전.량(전월 사용량). 저장 RPC가 기록하고
--     partner_list_meter_cards 가 prev_usage_overrides 로 돌려준다(없으면 화면이 직전 달 usage 를 상속).
--  모든 함수는 실DB 정의(pg_get_functiondef)에서 출발했다.

-- ── 34: 전.량 수정값 컬럼 ─────────────────────────────────────────────────
alter table public.meter_readings
  add column if not exists prev_usage_override numeric(12,2);
comment on column public.meter_readings.prev_usage_override is
  '현장 검침 화면에서 수정한 전.량(전월 사용량). null 이면 직전 달 usage 를 상속한다(개선3차 34).';

-- ── 31·35: partner 이사정산 저장 가드 ───────────────────────────────────────
create or replace function public.partner_save_moving_settlement(p_unit_id bigint, p_occupancy_id bigint, p_settlement_id bigint, p_data jsonb, p_checklist jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_settlement_id bigint := p_settlement_id;
  v_amount integer;
  v_unpaid integer;
  v_item jsonb;
  v_check_item_id bigint;
  v_extra jsonb;
begin
  select b.org_id into v_org from units u join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null and b.id in (select partner_my_building_ids());
  if v_org is null then raise exception 'unit not assigned to caller'; end if;
  if p_occupancy_id is not null and not exists (
    select 1 from occupancies o where o.id = p_occupancy_id and o.unit_id = p_unit_id and o.deleted_at is null
  ) then raise exception 'occupancy not in unit'; end if;
  -- settlement_amount = 수납 차감 전 정산요금(①+②+③미납+④). staff save_moving_settlement 와 같은 정의(0266).
  v_unpaid := settlement_billing_unpaid(p_unit_id, p_occupancy_id)::integer;
  v_amount := calculate_moving_settlement_amount(p_data) + v_unpaid;
  v_extra := case when jsonb_typeof(p_data->'extra') = 'object' then p_data->'extra' else null end;

  -- 개선3차 35: 금액·지침·단가·일수는 0 이상만 저장한다.
  if exists (
       select 1
         from unnest(array[
           p_data->>'mgmt_fee_monthly', p_data->>'mgmt_fee_prorated',
           p_data->>'water_charge', p_data->>'elec_charge', p_data->>'gas_charge',
           p_data->>'repair_amount', p_data->>'cleaning_cost',
           v_extra->>'paid', v_extra->>'adv', v_extra->>'dTotal', v_extra->>'dDays'
         ]) as a(v)
        where nullif(btrim(a.v), '')::numeric < 0
     )
     or exists (
       select 1
         from jsonb_array_elements(case when jsonb_typeof(v_extra->'util') = 'array' then v_extra->'util' else '[]'::jsonb end) e
        where nullif(btrim(e->>'prev'), '')::numeric < 0
           or nullif(btrim(e->>'cur'), '')::numeric < 0
           or nullif(btrim(e->>'price'), '')::numeric < 0
     )
     or exists (
       select 1
         from jsonb_array_elements(case when jsonb_typeof(v_extra->'feeItems') = 'array' then v_extra->'feeItems' else '[]'::jsonb end) e
        where nullif(btrim(e->>'charged'), '')::numeric < 0
     )
     or exists (
       select 1
         from jsonb_array_elements(case when jsonb_typeof(v_extra->'etcItems') = 'array' then v_extra->'etcItems' else '[]'::jsonb end) e
        where nullif(btrim(e->>'amount'), '')::numeric < 0
     )
  then
    raise exception '입력값을 다시 확인해 주세요. 금액은 0 이상만 저장할 수 있어요.';
  end if;

  -- 개선3차 31: 미수금 = settlement_amount − 수납액(extra.paid) < 0 이면 저장 차단(정책 현장 관리자_이사정산 3.9).
  if coalesce(nullif(btrim(v_extra->>'paid'), '')::numeric, 0) > v_amount then
    raise exception '입력값을 다시 확인해 주세요. 수납액이 정산 금액보다 많아 미수금이 음수예요.';
  end if;

  if v_settlement_id is null then
    insert into moving_settlements(
      unit_id, occupancy_id, move_out_date, mgmt_fee_monthly, mgmt_fee_prorated,
      water_charge, elec_charge, gas_charge, elec_paid_date, gas_paid_date,
      repair_amount, repair_attribution, repair_memo,
      settle_bank, settle_acct, settle_holder, settlement_amount,
      note, settlement_note, cleaning_cost, unpaid_amount, extra, checked_by, status
    ) values (
      p_unit_id, p_occupancy_id, nullif(p_data->>'move_out_date','')::date,
      nullif(p_data->>'mgmt_fee_monthly','')::integer, nullif(p_data->>'mgmt_fee_prorated','')::integer,
      nullif(p_data->>'water_charge','')::integer, nullif(p_data->>'elec_charge','')::integer, nullif(p_data->>'gas_charge','')::integer,
      nullif(p_data->>'elec_paid_date','')::date, nullif(p_data->>'gas_paid_date','')::date,
      nullif(p_data->>'repair_amount','')::integer, nullif(p_data->>'repair_attribution',''), nullif(p_data->>'repair_memo',''),
      nullif(p_data->>'settle_bank',''), nullif(p_data->>'settle_acct',''), nullif(p_data->>'settle_holder',''),
      v_amount, nullif(p_data->>'note',''), nullif(p_data->>'settlement_note',''),
      nullif(p_data->>'cleaning_cost','')::integer, v_unpaid, v_extra, (select auth.uid()), 'saved'
    ) returning id into v_settlement_id;
  else
    update moving_settlements set
      occupancy_id = p_occupancy_id,
      move_out_date = nullif(p_data->>'move_out_date','')::date,
      mgmt_fee_monthly = nullif(p_data->>'mgmt_fee_monthly','')::integer,
      mgmt_fee_prorated = nullif(p_data->>'mgmt_fee_prorated','')::integer,
      water_charge = nullif(p_data->>'water_charge','')::integer,
      elec_charge = nullif(p_data->>'elec_charge','')::integer,
      gas_charge = nullif(p_data->>'gas_charge','')::integer,
      elec_paid_date = nullif(p_data->>'elec_paid_date','')::date,
      gas_paid_date = nullif(p_data->>'gas_paid_date','')::date,
      repair_amount = nullif(p_data->>'repair_amount','')::integer,
      repair_attribution = coalesce(nullif(p_data->>'repair_attribution',''), repair_attribution),
      repair_memo = nullif(p_data->>'repair_memo',''),
      settle_bank = coalesce(settle_bank, nullif(p_data->>'settle_bank','')),
      settle_acct = coalesce(settle_acct, nullif(p_data->>'settle_acct','')),
      settle_holder = coalesce(settle_holder, nullif(p_data->>'settle_holder','')),
      settlement_amount = v_amount,
      note = nullif(p_data->>'note',''),
      settlement_note = nullif(p_data->>'settlement_note',''),
      cleaning_cost = nullif(p_data->>'cleaning_cost','')::integer,
      unpaid_amount = v_unpaid,
      extra = v_extra,
      checked_by = (select auth.uid()),
      status = 'saved',
      processed_at = null
      where id = v_settlement_id and unit_id = p_unit_id and status in ('draft','saved');
    if not found then raise exception 'editable settlement not in unit'; end if;
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) loop
    v_check_item_id := (v_item->>'check_item_id')::bigint;
    if not exists (
      select 1 from settlement_check_items sci where sci.id = v_check_item_id and sci.org_id = v_org and sci.deleted_at is null
    ) then raise exception 'check item % not in org', v_check_item_id; end if;
    insert into settlement_checklist_results as r(settlement_id, check_item_id, checked, note)
      values (v_settlement_id, v_check_item_id, coalesce((v_item->>'checked')::boolean, false), nullif(v_item->>'note', ''))
      on conflict (settlement_id, check_item_id) do update set
        checked = excluded.checked,
        note = case when v_item ? 'note' then excluded.note else r.note end;
  end loop;
  return jsonb_build_object('settlement_id', v_settlement_id, 'settlement_amount', v_amount);
end $function$;

-- ── 31: partner 정산 컨텍스트에 ③ 미납(billing_unpaid) 추가 ──────────────────
--  저장 RPC 는 화면이 보내는 p_occupancy_id(= 이 컨텍스트의 occupancy.id)로 ③을 계산하므로 같은 occupancy 로 계산한다.
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
        'previous_reading', coalesce(cur.previous_reading, prev.current_reading),
        'current_reading', cur.current_reading,
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

-- ── 34: partner 검침 저장 — 전.량 수정값 기록 ──────────────────────────────
--  항목에 prev_usage 키가 있으면 그 값(빈 값 = null, 상속으로 복귀)으로 갱신하고, 키가 없으면 기존 값을 유지한다.
create or replace function public.partner_save_meter_readings(p_building_id bigint, p_period date, p_readings jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_item jsonb; v_unit bigint; v_util text; v_prev numeric; v_cur numeric; v_use numeric; v_pu numeric; v_has_pu boolean;
begin
  if p_building_id not in (select partner_my_building_ids()) then
    raise exception 'forbidden: not your building';
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_readings, '[]'::jsonb)) loop
    v_unit := (v_item->>'unit_id')::bigint;
    v_util := v_item->>'utility';
    if v_util not in ('water', 'elec', 'gas') then continue; end if;
    if exists (
      select 1 from utility_confirmations uc
      where uc.building_id = p_building_id and uc.utility = v_util
        and uc.period = date_trunc('month', p_period)::date and uc.confirmed_at is not null
    ) then
      raise exception '이미 확정된 검침월입니다. 확정된 달의 지침은 수정할 수 없습니다. (%, %)', v_util, to_char(p_period, 'YYYY-MM');
    end if;
    if not exists (select 1 from units where id = v_unit and building_id = p_building_id and deleted_at is null) then
      continue;
    end if;
    v_prev := nullif(v_item->>'previous_reading', '')::numeric;
    v_cur := nullif(v_item->>'current_reading', '')::numeric;
    v_use := case when v_cur is not null and v_prev is not null then greatest(0, v_cur - v_prev) else null end;
    v_has_pu := v_item ? 'prev_usage';
    v_pu := nullif(btrim(v_item->>'prev_usage'), '')::numeric;
    if v_pu < 0 then raise exception '전.량은 0 이상만 저장할 수 있어요. (%)', v_util; end if;
    update meter_readings set previous_reading = v_prev, current_reading = v_cur, usage = v_use,
        prev_usage_override = case when v_has_pu then v_pu else prev_usage_override end
      where unit_id = v_unit and utility = v_util and period = p_period;
    if not found then
      insert into meter_readings(unit_id, utility, period, previous_reading, current_reading, usage, prev_usage_override)
        values (v_unit, v_util, p_period, v_prev, v_cur, v_use, v_pu);
    end if;
  end loop;
end $function$;

-- ── 33·34: 검침 카드 — 부번호(phones_more) · 전.량 수정값(prev_usage_overrides) ─────
--  반환 컬럼이 늘어 create or replace 로는 바꿀 수 없으므로 함수만 교체한다(데이터 영향 없음).
drop function if exists public.partner_list_meter_cards(bigint, date);
create function public.partner_list_meter_cards(p_building_id bigint, p_period date)
 returns table(
   unit_id bigint, occupancy_id bigint, move_in_date date, phone text, notes jsonb,
   usage_history jsonb, overdue_periods jsonb, phones_more text[], prev_usage_overrides jsonb
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with u as (
    select un.id, o.id as occupancy_id, o.move_in_date, o.phone, o.late_fee_enabled,
      array(
        select btrim(p.v)
        from unnest(array[o.phone2, o.phone3] || coalesce(o.phones_extra, '{}'::text[]))
          with ordinality as p(v, ord)
        where nullif(btrim(p.v), '') is not null
        order by p.ord
      ) as phones_more
    from units un
    left join occupancies o
      on o.unit_id = un.id and o.deleted_at is null and o.status = 'occupied'
    where un.building_id = p_building_id and un.deleted_at is null
      and un.building_id in (select partner_my_building_ids())
  )
  select
    u.id,
    u.occupancy_id,
    u.move_in_date,
    u.phone,
    coalesce((
      select jsonb_object_agg(mr.utility, btrim(mr.note))
      from meter_readings mr
      where mr.unit_id = u.id
        and mr.period = p_period
        and nullif(btrim(mr.note), '') is not null
    ), '{}'::jsonb),
    (
      select jsonb_object_agg(k.utility, (
        select jsonb_agg(h.usage order by h.back)
        from (
          select b.back, (
            select mr.usage
            from meter_readings mr
            where mr.unit_id = u.id
              and mr.utility = k.utility
              and mr.period = (p_period - make_interval(months => b.back))::date
          ) as usage
          from generate_series(1, 3) as b(back)
        ) h
      ))
      from (values ('water'), ('elec'), ('gas')) as k(utility)
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object(
          'period', pb.period,
          'unpaid_principal', pb.outstanding,
          'due_date', coalesce(
            bps.due_date,
            (date_trunc('month', pb.period) + interval '1 month' - interval '1 day')::date
          ),
          'late_fee_enabled', coalesce(u.late_fee_enabled, true)
        ) order by pb.period)
      from (
        select
          bc.period,
          greatest(bc.total_amount::bigint - coalesce(sum(p.amount), 0)::bigint, 0::bigint) as outstanding
        from billing_confirmations bc
        left join payments p
          on p.occupancy_id = bc.occupancy_id
         and p.unit_id = bc.unit_id
         and p.period = bc.period
         and p.status = 'active'
        where bc.occupancy_id = u.occupancy_id
          and bc.unit_id = u.id
          and bc.confirmed_at is not null
          and bc.period <= p_period
        group by bc.period, bc.total_amount
      ) pb
      left join billing_period_settings bps
        on bps.building_id = p_building_id
       and bps.period = pb.period
      where pb.outstanding > 0
    ), '[]'::jsonb),
    u.phones_more,
    coalesce((
      select jsonb_object_agg(mr.utility, mr.prev_usage_override)
      from meter_readings mr
      where mr.unit_id = u.id
        and mr.period = p_period
        and mr.prev_usage_override is not null
    ), '{}'::jsonb)
  from u
  order by u.id;
$function$;

revoke all on function public.partner_list_meter_cards(bigint, date) from public, anon;
grant execute on function public.partner_list_meter_cards(bigint, date) to authenticated, service_role;

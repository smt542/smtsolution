-- 0266: 개선3차 항목 7·8·9 — 사무실 이사정산
--  7: 이사 지침 정본 = moving_settlements.extra.util (staff·partner 공통, partner mobile-ms-new/_ms.ts 와 같은 키)
--       extra.util = [{ k: 'water'|'elec'|'gas', prev: 전월 지침, cur: 이사 지침, price: 단가, acct: 입금계좌, payDate: 'YYYY-MM-DD' }]
--     금액 = round(max(0, cur - prev) × price) (정책 3.5 · 계산규칙 6절 ②).
--     - save_moving_settlement: p_data.util(배열)이 오면 extra.util 만 교체하고 extra 의 나머지 키는 보존한다.
--     - list_utility_rows / save_meter_readings: 그 달(퇴실월) 행이 아직 없을 때만 이사 지침(cur)을
--       previous_reading 기본값으로 쓴다(기존 지침 소급 없음).
--     - list_settlement_inquiries: 전월·이사 검침과 량을 extra.util 값 우선으로 반환한다.
--     - get_settlement_context.meter_summary 에 period(검침월)를 더해 화면이 전월 지침 기본값을 고를 수 있게 한다.
--  8: settlement_amount 정의 고정 = 수납 차감 전 정산요금
--       = ① 공과금(water+elec+gas) + ② 관리비(mgmt_fee_prorated) + ③ 미납(unpaid_amount) + ④ 청소비(cleaning_cost)·기타(repair_amount)
--     unpaid_amount = 저장 시점 settlement_billing_unpaid(unit) 스냅샷(get_settlement_context.billing_unpaid 와 같은 식).
--     트리거 set_moving_settlement_amount 가 위 식으로 계산한다(staff·partner 저장, 조회화면 청소비 수정 모두 같은 경로).
--  9: mid_moveout_settlement — 완료 가드, alimtalk_opt_in=true, billing_note 덧붙이기(중복 방지).

alter table public.moving_settlements add column if not exists unpaid_amount integer;
comment on column public.moving_settlements.unpaid_amount is
  '저장 시점 확정 부과 미납 스냅샷(settlement_billing_unpaid). settlement_amount 의 ③ 미납 항목.';
comment on column public.moving_settlements.settlement_amount is
  '수납 차감 전 정산요금 = 공과금(water+elec+gas) + 관리비(mgmt_fee_prorated) + 미납(unpaid_amount) + 청소비(cleaning_cost) + 기타(repair_amount). 미수금 = settlement_amount - 수납액.';

-- ③ 미납: 확정 부과된 period 의 (부과액 - 유효수납) 합. get_settlement_context.billing_unpaid 정본 식(0132 자동수납 귀속).
create or replace function public.settlement_billing_unpaid(p_unit_id bigint)
returns bigint
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(sum(greatest(0, per_period.unpaid)), 0)::bigint
    from (
      select (bc.total_amount - coalesce(sum(p.amount) filter (where p.status = 'active'), 0))::bigint as unpaid
      from billing_confirmations bc
      left join payments p
        on p.unit_id = bc.unit_id
       and p.period = bc.period
       and p.occupancy_id = bc.occupancy_id
      where bc.unit_id = p_unit_id
        and bc.confirmed_at is not null
      group by bc.period, bc.occupancy_id, bc.total_amount
    ) per_period
$function$;
revoke all on function public.settlement_billing_unpaid(bigint) from public, anon, authenticated;

-- extra.util 에서 유틸 한 행. 이사 지침(cur)이 숫자이고 0보다 클 때만 유효한 행으로 본다(파트너 미입력=0).
create or replace function public.settlement_util_row(p_extra jsonb, p_utility text)
returns jsonb
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select e
    from jsonb_array_elements(
      case when jsonb_typeof(p_extra->'util') = 'array' then p_extra->'util' else '[]'::jsonb end
    ) e
   where e->>'k' = p_utility
     and case when jsonb_typeof(e->'cur') = 'number' then (e->>'cur')::numeric > 0 else false end
   limit 1
$function$;
revoke all on function public.settlement_util_row(jsonb, text) from public, anon, authenticated;

-- 공과금 신규 지침의 「전월」 기본값: 그 달(p_period)에 퇴실한 가장 최근 정산의 이사 지침.
create or replace function public.settlement_move_reading(p_unit_id bigint, p_utility text, p_period date)
returns numeric
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select (settlement_util_row(s.extra, p_utility)->>'cur')::numeric
    from moving_settlements s
   where s.unit_id = p_unit_id
     and s.status <> 'draft'
     and s.move_out_date >= p_period
     and s.move_out_date < (p_period + interval '1 month')::date
     and settlement_util_row(s.extra, p_utility) is not null
   order by s.move_out_date desc, s.id desc
   limit 1
$function$;
revoke all on function public.settlement_move_reading(bigint, text, date) from public, anon, authenticated;

-- ===== 8: settlement_amount 트리거 =====
create or replace function public.set_moving_settlement_amount()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- settlement_amount = 수납 차감 전 정산요금 = ①공과금 + ②관리비 + ③미납(unpaid_amount 스냅샷) + ④청소비·기타 (0266)
  new.settlement_amount := calculate_moving_settlement_amount(
    jsonb_build_object(
      'mgmt_fee_prorated', new.mgmt_fee_prorated,
      'water_charge', new.water_charge,
      'elec_charge', new.elec_charge,
      'gas_charge', new.gas_charge,
      'repair_amount', new.repair_amount,
      'cleaning_cost', new.cleaning_cost
    )
  ) + coalesce(new.unpaid_amount, 0);
  return new;
end $function$;

drop trigger if exists trg_moving_settlement_amount on public.moving_settlements;
create trigger trg_moving_settlement_amount
  before insert or update of mgmt_fee_prorated, water_charge, elec_charge, gas_charge, repair_amount, cleaning_cost, unpaid_amount
  on public.moving_settlements
  for each row execute function public.set_moving_settlement_amount();

-- ===== 7·8: save_moving_settlement (staff) =====
create or replace function public.save_moving_settlement(p_unit_id bigint, p_occupancy_id bigint, p_settlement_id bigint, p_data jsonb, p_checklist jsonb)
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
  v_util jsonb;
  v_item jsonb;
  v_check_item_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;
  if not exists (
    select 1 from units u join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null and b.org_id = v_org
  ) then raise exception 'unit not in org'; end if;
  if p_occupancy_id is not null and not exists (
    select 1 from occupancies o
    where o.id = p_occupancy_id and o.unit_id = p_unit_id and o.deleted_at is null
  ) then raise exception 'occupancy not in unit'; end if;

  -- settlement_amount = 수납 차감 전 정산요금(①+②+③미납+④). 트리거도 같은 식으로 계산한다(0266).
  v_unpaid := settlement_billing_unpaid(p_unit_id)::integer;
  v_amount := calculate_moving_settlement_amount(p_data) + v_unpaid;
  -- 이사 지침(extra.util) — partner 와 같은 키. 오지 않으면 기존 extra 를 그대로 둔다.
  v_util := case when jsonb_typeof(p_data->'util') = 'array' then p_data->'util' else null end;

  if v_settlement_id is null then
    insert into moving_settlements(
      unit_id, occupancy_id, move_out_date, mgmt_fee_monthly, mgmt_fee_prorated,
      water_charge, elec_charge, gas_charge, elec_paid_date, gas_paid_date,
      repair_amount, repair_attribution, repair_memo,
      settle_bank, settle_acct, settle_holder, settlement_amount,
      note, settlement_note, cleaning_cost, unpaid_amount, extra, status
    ) values (
      p_unit_id, p_occupancy_id, nullif(p_data->>'move_out_date','')::date,
      nullif(p_data->>'mgmt_fee_monthly','')::integer,
      nullif(p_data->>'mgmt_fee_prorated','')::integer,
      nullif(p_data->>'water_charge','')::integer,
      nullif(p_data->>'elec_charge','')::integer,
      nullif(p_data->>'gas_charge','')::integer,
      nullif(p_data->>'elec_paid_date','')::date,
      nullif(p_data->>'gas_paid_date','')::date,
      nullif(p_data->>'repair_amount','')::integer,
      nullif(p_data->>'repair_attribution',''),
      nullif(p_data->>'repair_memo',''),
      nullif(p_data->>'settle_bank',''),
      nullif(p_data->>'settle_acct',''),
      nullif(p_data->>'settle_holder',''),
      v_amount,
      nullif(p_data->>'note',''),
      nullif(p_data->>'settlement_note',''),
      nullif(p_data->>'cleaning_cost','')::integer,
      v_unpaid,
      case when v_util is null then null else jsonb_build_object('util', v_util) end,
      'saved'
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
      repair_attribution = nullif(p_data->>'repair_attribution',''),
      repair_memo = nullif(p_data->>'repair_memo',''),
      settle_bank = nullif(p_data->>'settle_bank',''),
      settle_acct = nullif(p_data->>'settle_acct',''),
      settle_holder = nullif(p_data->>'settle_holder',''),
      settlement_amount = v_amount,
      note = nullif(p_data->>'note',''),
      settlement_note = nullif(p_data->>'settlement_note',''),
      cleaning_cost = nullif(p_data->>'cleaning_cost','')::integer,
      unpaid_amount = v_unpaid,
      extra = case
        when v_util is null then extra
        else coalesce(extra, '{}'::jsonb) || jsonb_build_object('util', v_util)
      end,
      status = 'saved',
      processed_at = null
      where id = v_settlement_id and unit_id = p_unit_id and status in ('draft','saved');
    if not found then raise exception 'editable settlement not in unit'; end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) loop
    v_check_item_id := (v_item->>'check_item_id')::bigint;
    if not exists (
      select 1 from settlement_check_items sci
      where sci.id = v_check_item_id and sci.org_id = v_org and sci.deleted_at is null
    ) then raise exception 'check item % not in org', v_check_item_id; end if;

    insert into settlement_checklist_results as r(settlement_id, check_item_id, checked, note)
      values (
        v_settlement_id, v_check_item_id,
        coalesce((v_item->>'checked')::boolean, false),
        nullif(v_item->>'note', '')
      )
      on conflict (settlement_id, check_item_id) do update set
        checked = excluded.checked,
        note = case when v_item ? 'note' then excluded.note else r.note end;
  end loop;

  return jsonb_build_object('settlement_id', v_settlement_id, 'settlement_amount', v_amount);
end $function$;

-- ===== 8: partner_save_moving_settlement — 같은 settlement_amount 정의 =====
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
  v_unpaid := settlement_billing_unpaid(p_unit_id)::integer;
  v_amount := calculate_moving_settlement_amount(p_data) + v_unpaid;
  v_extra := case when jsonb_typeof(p_data->'extra') = 'object' then p_data->'extra' else null end;
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

-- ===== 9: mid_moveout_settlement =====
create or replace function public.mid_moveout_settlement(p_settlement_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_unit_id bigint;
  v_occupancy_id bigint;
  v_status text;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;

  select s.unit_id, s.occupancy_id, s.status into v_unit_id, v_occupancy_id, v_status
    from moving_settlements s
    join units u on u.id = s.unit_id
    join buildings b on b.id = u.building_id and b.org_id = v_org
    where s.id = p_settlement_id
    for update of s;
  if not found then raise exception 'settlement not in org'; end if;
  -- 완료 가드(정책 3.12 "완료 후 폼·액션 잠금"): 이미 중도퇴실이면 그대로 반환, 퇴실완료 건은 뒤집지 않는다.
  if v_status = 'mid_moveout' then return jsonb_build_object('ok', true, 'already', true); end if;
  if v_status = 'completed' then raise exception 'settlement already completed'; end if;
  if v_occupancy_id is null then raise exception 'settlement has no occupancy'; end if;

  update moving_settlements set status = 'mid_moveout'
    where id = p_settlement_id;
  -- 정책 3.12 · 계산규칙 6절: 공실 처리 없음, 알림톡 수신 「동의」 전환(종이→카톡), 적요에 '중도퇴실' 덧붙임.
  update occupancies set
      billing_note = case
        when position('중도퇴실' in coalesce(billing_note, '')) > 0 then billing_note
        else concat_ws(' · ', nullif(btrim(billing_note), ''), '중도퇴실')
      end,
      alimtalk_opt_in = true,
      print_enabled = false
    where id = v_occupancy_id and unit_id = v_unit_id and deleted_at is null;
  if not found then raise exception 'occupancy not in unit'; end if;

  return jsonb_build_object('ok', true);
end $function$;

-- ===== 7·8: get_settlement_context — meter_summary.period 추가, 미납은 공용 헬퍼 =====
create or replace function public.get_settlement_context(p_unit_id bigint, p_settlement_id bigint default null::bigint)
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
  v_settings jsonb;
  v_checklist jsonb;
  v_meter_summary jsonb;
  v_period date;
  v_billing_unpaid bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;

  select jsonb_build_object(
      'id', u.id,
      'unit_no', u.unit_no,
      'dong', u.dong,
      'building_id', u.building_id,
      'building_name', b.name
    ) into v_unit
    from units u
    join buildings b on b.id = u.building_id and b.org_id = v_org
    where u.id = p_unit_id and u.deleted_at is null;
  if v_unit is null then raise exception 'unit not in org'; end if;

  select jsonb_build_object(
      'id', o.id,
      'tenant_name', o.tenant_name,
      'phone', o.phone,
      'alimtalk_opt_in', coalesce(o.alimtalk_opt_in, false),
      'move_in_date', o.move_in_date,
      'settlement_note', o.settlement_note,
      'billing_note', o.billing_note,
      'status', o.status
    ) into v_occupancy
    from occupancies o
    where o.unit_id = p_unit_id and o.deleted_at is null
    order by o.created_at desc limit 1;

  if p_settlement_id is not null then
    -- 지정 건은 status 로 거르지 않는다(완료된 과거 건도 열어봐야 한다).
    -- unit_id 로 묶어 조회하므로 위에서 검증한 org 스코프를 벗어나지 않는다.
    select s.id, to_jsonb(s) into v_settlement_id, v_settlement
      from moving_settlements s
      where s.id = p_settlement_id and s.unit_id = p_unit_id;
    if v_settlement is null then raise exception 'settlement not in unit'; end if;
  else
    select s.id, to_jsonb(s) into v_settlement_id, v_settlement
      from moving_settlements s
      where s.unit_id = p_unit_id and s.status in ('draft','saved')
      order by s.created_at desc limit 1;
  end if;

  -- 검침 기준월: 정산건의 퇴실월. 신규 작성(퇴실일 미입력)이면 null → 최신 검침을 쓴다.
  v_period := date_trunc('month', (v_settlement->>'move_out_date')::date)::date;

  select jsonb_build_object(
      'settle_bank', sc.settle_bank,
      'settle_acct', sc.settle_acct,
      'settle_holder', sc.settle_holder
    ) into v_account
    from setup_config sc where sc.org_id = v_org;
  v_account := coalesce(v_account, jsonb_build_object(
    'settle_bank', null, 'settle_acct', null, 'settle_holder', null
  ));

  select jsonb_build_object(
      'water_unit_reflect', coalesce(sc.water_unit_reflect, true),
      'electric_unit_reflect', coalesce(sc.electric_unit_reflect, true),
      'vacancy_payment_mode', coalesce(sc.vacancy_payment_mode, 'manual')
    ) into v_settings
    from setup_config sc where sc.org_id = v_org;
  v_settings := coalesce(v_settings, jsonb_build_object(
    'water_unit_reflect', true, 'electric_unit_reflect', true, 'vacancy_payment_mode', 'manual'
  ));

  -- billing 미납액: 확정 부과된 period 의 (부과액 - 유효수납) 합. 0132 자동수납 루프와 동일 귀속.
  -- 저장 시 settlement_amount 의 ③ 미납 스냅샷(unpaid_amount)과 같은 헬퍼다(0266).
  v_billing_unpaid := settlement_billing_unpaid(p_unit_id);

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', sci.id,
        'label', sci.label,
        'checked', coalesce(scr.checked, false),
        'note', scr.note
      ) order by sci.sort_order, sci.id
    ), '[]'::jsonb) into v_checklist
    from settlement_check_items sci
    left join settlement_checklist_results scr
      on scr.check_item_id = sci.id and scr.settlement_id = v_settlement_id
    where sci.org_id = v_org and sci.deleted_at is null;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'utility', utility_row.utility,
        -- 검침월(0266). 퇴실월 검침이면 previous_reading 이, 그 이전 달 검침이면 current_reading 이 이사정산의 「전월 지침」이다.
        'period', cur.period,
        'previous_reading', coalesce(cur.previous_reading, prev.current_reading),
        'current_reading', cur.current_reading,
        'unit_price', cur.unit_price,
        'discount_amount', cur.discount_amount,
        -- 실효 요금: 수동 보정 우선, 없으면 계산요금(할인 반영됨). 0014:410 · 0130:383 과 동일한 식.
        'charge', coalesce(cur.manual_charge, cur.calc_charge),
        'usage', coalesce(
          cur.usage,
          case
            when cur.current_reading is not null
              and coalesce(cur.previous_reading, prev.current_reading) is not null
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

  return jsonb_build_object(
    'unit', v_unit,
    'occupancy', v_occupancy,
    'latest_settlement', v_settlement,
    'settle_account', v_account,
    'settlement_settings', v_settings,
    'billing_unpaid', v_billing_unpaid,
    'checklist', v_checklist,
    'meter_summary', v_meter_summary
  );
end $function$;

-- ===== 7: list_utility_rows — 신규(그 달 행 없음) 지침의 전월 = 이사 지침 =====
create or replace function public.list_utility_rows(p_building_id bigint, p_utility text, p_period date)
 returns table(unit_id bigint, unit_no text, dong text, occupancy_id bigint, tenant_name text, occupancy_status occupancy_status, move_in_date date, move_out_date date, move_out_scheduled_date date, phone text, resident_count integer, customer_no text, meter_no text, previous_reading numeric, current_reading numeric, usage numeric, previous_usage numeric, unit_price numeric, calc_charge integer, discount_amount integer, manual_charge integer, note text, processed_at timestamp with time zone, discount_type text, resolved_unit_price numeric, needs_review boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    u.id,
    u.unit_no,
    u.dong,
    o.id,
    o.tenant_name,
    o.status,
    o.move_in_date,
    o.move_out_date,
    o.move_out_scheduled_date,
    o.phone,
    o.resident_count,
    m.customer_no,
    m.meter_no,
    -- 0266: 그 달 행이 아직 없으면 그 달 퇴실 이사정산의 이사 지침을 전월로 쓴다(저장된 지침은 소급하지 않음).
    coalesce(
      cur.previous_reading,
      case when cur.unit_id is null then settlement_move_reading(u.id, p_utility, p_period) end,
      prev.current_reading
    ) as previous_reading,
    cur.current_reading,
    cur.usage,
    prev.usage as previous_usage,
    cur.unit_price,
    cur.calc_charge,
    coalesce(cur.discount_amount, wd.amount) as discount_amount,
    cur.manual_charge,
    cur.note,
    cur.processed_at,
    wd.discount_type,
    coalesce(
      (select uup.unit_price
       from unit_meters um
       join building_customer_numbers bcn
         on bcn.building_id = p_building_id
        and bcn.kind = p_utility
        and bcn.customer_no = um.customer_no
        and bcn.deleted_at is null
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where um.unit_id = u.id and um.utility = p_utility),
      (select usp.unit_price
       from utility_scoped_prices usp
       where usp.building_id = p_building_id
         and usp.utility = p_utility
         and usp.usage_type = u.usage_type
         and usp.floor = u.floor),
      (select usp.unit_price
       from utility_scoped_prices usp
       where usp.building_id = p_building_id
         and usp.utility = p_utility
         and usp.usage_type = u.usage_type
         and usp.floor is null),
      (select max(uup.unit_price)
       from building_customer_numbers bcn
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where bcn.building_id = p_building_id
         and bcn.kind = p_utility
         and bcn.deleted_at is null
         and nullif(m.customer_no, '') is null
       having count(*) = 1)
    ) as resolved_unit_price,
    coalesce(cur.needs_review, false) as needs_review
  from units u
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select *
    from occupancies oc
    where oc.unit_id = u.id and oc.deleted_at is null
    order by oc.created_at desc, oc.id desc
    limit 1
  ) o on true
  left join unit_meters m on m.unit_id = u.id and m.utility = p_utility
  left join meter_readings cur
    on cur.unit_id = u.id and cur.utility = p_utility and cur.period = p_period
  left join meter_readings prev
    on prev.unit_id = u.id
   and prev.utility = p_utility
   and prev.period = (p_period - interval '1 month')::date
  left join water_discounts wd on wd.unit_id = u.id and p_utility = 'water'
  where u.building_id = p_building_id and u.deleted_at is null
  order by u.unit_no
$function$;

-- ===== 7: save_meter_readings — previous_reading 미지정 신규 행은 이사 지침을 전월로 =====
create or replace function public.save_meter_readings(p_building_id bigint, p_utility text, p_period date, p_rows jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint := current_user_org();
  v_item jsonb;
  v_count int := 0;
  v_unit_id bigint;
  v_prev numeric;
  v_cur numeric;
  v_usage numeric;
  v_explicit_usage numeric;
  v_has_explicit_usage boolean;
  v_fixed_usage numeric;
  v_usage_type text;
  v_floor int;
  v_disc integer;
  v_price numeric;
  v_calc integer;
  v_needs_review boolean;
  v_total_calc bigint := 0;
begin
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('utilities') then
    raise exception 'forbidden: utilities required';
  end if;
  if p_utility not in ('water','elec','gas') then
    raise exception 'bad utility %', p_utility;
  end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org';
  end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month';
  end if;
  if p_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'rows must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'row entries must be objects';
    end if;
    v_unit_id := nullif(v_item->>'unit_id', '')::bigint;
    if v_unit_id is null or not exists (
      select 1
      from units u
      join buildings b on b.id = u.building_id
      where u.id = v_unit_id
        and u.building_id = p_building_id
        and u.deleted_at is null
        and b.org_id = v_org
    ) then
      raise exception 'unit % not in building/org', v_unit_id;
    end if;

    v_cur := nullif(v_item->>'current_reading', '')::numeric;
    if v_item ? 'previous_reading' then
      v_prev := nullif(v_item->>'previous_reading', '')::numeric;
    else
      v_prev := null;
      -- 0266: 그 달 행이 아직 없을 때만 이사 지침(그 달 퇴실 이사정산 extra.util.cur)을 전월로 쓴다.
      if not exists (
        select 1 from meter_readings
        where unit_id = v_unit_id and utility = p_utility and period = p_period
      ) then
        v_prev := settlement_move_reading(v_unit_id, p_utility, p_period);
      end if;
      if v_prev is null then
        select current_reading into v_prev
        from meter_readings
        where unit_id = v_unit_id
          and utility = p_utility
          and period = (p_period - interval '1 month')::date;
      end if;
    end if;

    select usage_type, floor into v_usage_type, v_floor
    from units
    where id = v_unit_id;

    v_fixed_usage := null;
    select f.value into v_fixed_usage
    from unit_fixed_values f
    where f.unit_id = v_unit_id
      and f.utility = p_utility
      and f.kind = 'usage'
      and f.from_period <= p_period
    order by f.from_period desc
    limit 1;

    -- H5: 달별 이력에서 가장 최근 시작월의 값을 사용한다. null 은 해당 달부터 해제다.
    v_explicit_usage := nullif(v_item->>'usage', '')::numeric;
    v_has_explicit_usage := (v_item ? 'usage') and v_explicit_usage is not null;

    -- H6: 직접 넣은 량이 지침 차이보다 우선한다(정본, 2026-09-30 사용자 결정).
    v_usage := case
      when v_fixed_usage is not null then v_fixed_usage
      when v_has_explicit_usage then v_explicit_usage
      when v_cur is not null and v_prev is not null then v_cur - v_prev
    end;

    -- H4: a negative computed usage (rollover/replacement) is flagged for review;
    --   it is never silently charged ₩0. Fixed/explicit usage is trusted as entered.
    v_needs_review := (
      v_fixed_usage is null
      and not v_has_explicit_usage
      and v_usage is not null
      and v_usage < 0
    );

    select amount into v_disc
    from water_discounts
    where unit_id = v_unit_id and p_utility = 'water';

    select coalesce(
      (select uup.unit_price
       from unit_meters um
       join building_customer_numbers bcn
         on bcn.building_id = p_building_id
        and bcn.kind = p_utility
        and bcn.customer_no = um.customer_no
        and bcn.deleted_at is null
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where um.unit_id = v_unit_id and um.utility = p_utility),
      (select usp.unit_price
       from utility_scoped_prices usp
       where usp.building_id = p_building_id
         and usp.utility = p_utility
         and usp.usage_type = v_usage_type
         and usp.floor = v_floor),
      (select usp.unit_price
       from utility_scoped_prices usp
       where usp.building_id = p_building_id
         and usp.utility = p_utility
         and usp.usage_type = v_usage_type
         and usp.floor is null),
      (select max(uup.unit_price)
       from building_customer_numbers bcn
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where bcn.building_id = p_building_id
         and bcn.kind = p_utility
         and bcn.deleted_at is null
         and not exists (
           select 1
           from unit_meters um
           where um.unit_id = v_unit_id
             and um.utility = p_utility
             and nullif(um.customer_no, '') is not null
         )
       having count(*) = 1)
    ) into v_price;

    -- Flagged rows carry no auto charge so they can never be confirmed as a real ₩0.
    v_calc := case
      when v_needs_review then null
      when v_usage is not null and v_price is not null
        then greatest(0, round_charge(v_usage * v_price, 'round') - coalesce(v_disc, 0))
      else null
    end;

    insert into meter_readings(
      unit_id, utility, period, previous_reading, current_reading, usage,
      unit_price, calc_charge, discount_amount, manual_charge, note, needs_review, processed_at
    ) values (
      v_unit_id, p_utility, p_period, v_prev, v_cur, v_usage,
      v_price, v_calc, v_disc,
      nullif(v_item->>'manual_charge', '')::integer,
      nullif(v_item->>'note', ''),
      v_needs_review,
      now()
    )
    on conflict (unit_id, utility, period) do update set
      previous_reading = excluded.previous_reading,
      current_reading = excluded.current_reading,
      usage = excluded.usage,
      unit_price = excluded.unit_price,
      calc_charge = excluded.calc_charge,
      discount_amount = excluded.discount_amount,
      manual_charge = excluded.manual_charge,
      note = excluded.note,
      needs_review = excluded.needs_review,
      processed_at = excluded.processed_at;

    v_count := v_count + 1;
    v_total_calc := v_total_calc + coalesce(v_calc, 0);
  end loop;

  return jsonb_build_object(
    'saved', v_count,
    'period', p_period,
    'total_calc', v_total_calc
  );
end $function$;

-- ===== 7: list_settlement_inquiries — 전월·이사 검침은 extra.util 우선 =====
create or replace function public.list_settlement_inquiries(p_type text, p_building_id bigint, p_from date, p_to date, p_search text, p_status text, p_sort text, p_limit integer, p_offset integer, p_applied_from date)
 returns table(settlement_id bigint, building_id bigint, building_code text, building_name text, building_address text, unit_id bigint, occupancy_id bigint, dong text, unit_no text, tenant_name text, status text, move_out_date date, move_in_date date, mgmt_fee_prorated integer, water_charge integer, elec_charge integer, gas_charge integer, meter_no text, customer_no text, elec_previous_reading numeric, elec_current_reading numeric, elec_usage numeric, gas_previous_reading numeric, gas_current_reading numeric, gas_usage numeric, water_previous_reading numeric, water_current_reading numeric, water_usage numeric, elec_paid_date date, gas_paid_date date, water_paid_date date, repair_amount integer, cleaning_cost integer, checked_by_name text, settlement_amount integer, processed_at timestamp with time zone, created_at timestamp with time zone, total_count bigint)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then
    raise exception 'forbidden: moving required';
  end if;
  if p_type not in ('water', 'elec', 'gas', 'all') then
    raise exception 'invalid inquiry type';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid date range';
  end if;
  if p_status is not null and p_status not in (
    'draft', 'saved', 'mid_moveout', 'completed', 'incomplete'
  ) then
    raise exception 'invalid settlement status';
  end if;
  if p_sort not in ('code', 'date') then
    raise exception 'invalid inquiry sort';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'limit must be between 1 and 500';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'offset must be zero or greater';
  end if;

  return query
  select
    s.id,
    b.id,
    b.code,
    b.name,
    b.address,
    u.id,
    s.occupancy_id,
    u.dong,
    u.unit_no,
    o.tenant_name,
    s.status,
    s.move_out_date,
    o.move_in_date,
    s.mgmt_fee_prorated,
    s.water_charge,
    s.elec_charge,
    s.gas_charge,
    um.meter_no,
    um.customer_no,
    -- 0266: 이사정산 extra.util(전월·이사 지침)이 있으면 그 값을, 없으면 퇴실월 이하 최근 월 검침을 쓴다.
    case when eu.r is not null then (eu.r->>'prev')::numeric
         else coalesce(elec.previous_reading, elec_prev.current_reading) end,
    case when eu.r is not null then (eu.r->>'cur')::numeric else elec.current_reading end,
    case when eu.r is not null then greatest(0, (eu.r->>'cur')::numeric - coalesce((eu.r->>'prev')::numeric, 0))
         else coalesce(
           elec.usage,
           elec.current_reading - coalesce(elec.previous_reading, elec_prev.current_reading)
         ) end,
    case when gu.r is not null then (gu.r->>'prev')::numeric
         else coalesce(gas.previous_reading, gas_prev.current_reading) end,
    case when gu.r is not null then (gu.r->>'cur')::numeric else gas.current_reading end,
    case when gu.r is not null then greatest(0, (gu.r->>'cur')::numeric - coalesce((gu.r->>'prev')::numeric, 0))
         else coalesce(
           gas.usage,
           gas.current_reading - coalesce(gas.previous_reading, gas_prev.current_reading)
         ) end,
    case when wu.r is not null then (wu.r->>'prev')::numeric
         else coalesce(water.previous_reading, water_prev.current_reading) end,
    case when wu.r is not null then (wu.r->>'cur')::numeric else water.current_reading end,
    case when wu.r is not null then greatest(0, (wu.r->>'cur')::numeric - coalesce((wu.r->>'prev')::numeric, 0))
         else coalesce(
           water.usage,
           water.current_reading - coalesce(water.previous_reading, water_prev.current_reading)
         ) end,
    s.elec_paid_date,
    s.gas_paid_date,
    s.water_paid_date,
    s.repair_amount,
    s.cleaning_cost,
    checker.full_name,
    s.settlement_amount,
    s.processed_at,
    s.created_at,
    count(*) over ()
  from public.moving_settlements s
  join public.units u on u.id = s.unit_id and u.deleted_at is null
  join public.buildings b
    on b.id = u.building_id and b.org_id = v_org and b.deleted_at is null
  left join public.occupancies o on o.id = s.occupancy_id
  left join public.profiles checker on checker.user_id = s.checked_by
  left join public.unit_meters um
    on um.unit_id = u.id and um.utility = p_type
  cross join lateral (select public.settlement_util_row(s.extra, 'elec') as r) eu
  cross join lateral (select public.settlement_util_row(s.extra, 'gas') as r) gu
  cross join lateral (select public.settlement_util_row(s.extra, 'water') as r) wu
  left join lateral (
    select reading.*
    from public.meter_readings reading
    where reading.unit_id = u.id
      and reading.utility = 'elec'
      and reading.period <= date_trunc('month', s.move_out_date)::date
    order by reading.period desc
    limit 1
  ) elec on true
  left join public.meter_readings elec_prev
    on elec_prev.unit_id = u.id
    and elec_prev.utility = 'elec'
    and elec_prev.period = (elec.period - interval '1 month')::date
  left join lateral (
    select reading.*
    from public.meter_readings reading
    where reading.unit_id = u.id
      and reading.utility = 'gas'
      and reading.period <= date_trunc('month', s.move_out_date)::date
    order by reading.period desc
    limit 1
  ) gas on true
  left join public.meter_readings gas_prev
    on gas_prev.unit_id = u.id
    and gas_prev.utility = 'gas'
    and gas_prev.period = (gas.period - interval '1 month')::date
  left join lateral (
    select reading.*
    from public.meter_readings reading
    where reading.unit_id = u.id
      and reading.utility = 'water'
      and reading.period <= date_trunc('month', s.move_out_date)::date
    order by reading.period desc
    limit 1
  ) water on true
  left join public.meter_readings water_prev
    on water_prev.unit_id = u.id
    and water_prev.utility = 'water'
    and water_prev.period = (water.period - interval '1 month')::date
  where s.move_out_date between p_from and p_to
    and (p_applied_from is null or (s.created_at at time zone 'Asia/Seoul')::date >= p_applied_from)
    and (p_building_id is null or b.id = p_building_id)
    and (
      p_status is null
      or (p_status = 'incomplete' and s.status <> 'completed')
      or (p_status <> 'incomplete' and s.status = p_status)
    )
    and (
      p_search is null
      or nullif(btrim(p_search), '') is null
      or b.name ilike '%' || btrim(p_search) || '%'
      or coalesce(b.address, '') ilike '%' || btrim(p_search) || '%'
      or coalesce(u.dong, '') ilike '%' || btrim(p_search) || '%'
      or u.unit_no ilike '%' || btrim(p_search) || '%'
      or coalesce(o.tenant_name, '') ilike '%' || btrim(p_search) || '%'
    )
    and (
      p_type = 'all'
      or (p_type = 'water' and s.water_charge is not null)
      or (p_type = 'elec' and s.elec_charge is not null)
      or (p_type = 'gas' and s.gas_charge is not null)
    )
  order by
    case when p_sort = 'code' then b.code end,
    case when p_sort = 'code' then b.name end,
    case when p_sort = 'code' then u.unit_no end,
    case when p_sort = 'date' then s.move_out_date end desc,
    s.created_at desc,
    s.id desc
  limit p_limit offset p_offset;
end $function$;

-- ===== 8: 백필 — 기존 정산의 ③ 미납 스냅샷 =====
-- 과거 저장 시점 미납은 재구성할 수 없어(수납 created_at 이 처리 시각 이후인 시드 데이터 존재) 현재 미납으로 채운다.
-- 이는 지금 정산 화면을 열었을 때의 합계(get_settlement_context.billing_unpaid 포함)와 같은 값이다.
-- 트리거(update of unpaid_amount)가 settlement_amount 를 다시 계산한다.
update public.moving_settlements s
   set unpaid_amount = public.settlement_billing_unpaid(s.unit_id)::integer
 where s.unpaid_amount is null;

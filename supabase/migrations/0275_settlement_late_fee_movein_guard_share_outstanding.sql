-- 0275: 최종 리뷰 보정(F1·F2·F3·F4·F6·F7)
--
-- F1 이사정산 ③ 연체료: settlement_billing_unpaid(unit, occ)가 bill_document_extras.late_fee 를 쓰면
--    bill_issues.due_date 가 없는 period 는 연체료 0 이 된다. 납기 fallback 을 bill_carryover 와 같게
--    coalesce(최신 bill_issues.due_date, billing_period_settings.due_date, 해당 월 말일)로 두고,
--    누적요율(납기 월 → 현재 KST 월) × late_fee_factor 로 직접 계산한다(bill_document_extras 와 같은 식,
--    bill_document_extras 자체는 바꾸지 않아 지로·팩스·입주민 출력은 그대로다).
-- F2 occupancy 행은 세대당 1:1 재사용되므로 정산 입주자의 입주월(date_trunc('month', move_in_date)) 이전 period 는
--    ③과 complete_moving_settlement 자동수납에서 제외한다(move_in_date 가 없으면 하한 없음).
-- F3 complete_moving_settlement / mid_moveout_settlement: occupancy 의 현재 move_in_date > 정산 퇴실일이면
--    (재사용 행에 새 입주자) 처리를 거절해 새 입주자 정보가 초기화되지 않게 한다.
-- F4 public_settlement_by_token: 공유 링크 금액 = 미수금(settlement_amount − extra.paid),
--    정산구분 <0 환급 / >0 추가납부 / =0 완납 (계산 규칙 6절 정산요금·미수금).
-- F6 partner_save_meter_readings: 저장 후 저장한 utility 마다 utility_allocate_period 재배분, anon/public 실행 회수.
-- F7 save_utility_customer_bills: 확정(utility_confirmations.confirmed_at)된 검침월은 총액 저장 거절.

-- ─── F1·F2: ③ 헬퍼 ───────────────────────────────────────────────────────────
create or replace function public.settlement_billing_unpaid(p_unit_id bigint, p_occupancy_id bigint)
 returns bigint
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  -- ③ = Σ(정산 occupancy·정산 입주자 입주월 이후 확정 부과 period) [ max(0, 부과액 − 유효수납) + 연체료 ]
  -- 연체료 = 미납 × 누적요율(납기 월 → 현재 KST 월) × late_fee_factor / 100
  --   납기 = coalesce(최신 bill_issues.due_date, billing_period_settings.due_date, 해당 월 말일) (bill_carryover 와 같은 fallback)
  with occ as (
    select o.id, date_trunc('month', o.move_in_date)::date as move_in_month
    from occupancies o
    where o.id = p_occupancy_id
  ),
  per_period as (
    select
      bc.unit_id,
      bc.period,
      b.id as building_id,
      b.org_id,
      greatest(0, bc.total_amount - coalesce(sum(p.amount) filter (where p.status = 'active'), 0))::bigint as principal
    from billing_confirmations bc
    join occ on occ.id = bc.occupancy_id
    join units u on u.id = bc.unit_id
    join buildings b on b.id = u.building_id
    left join payments p
      on p.unit_id = bc.unit_id
     and p.period = bc.period
     and p.occupancy_id = bc.occupancy_id
    where bc.unit_id = p_unit_id
      and bc.occupancy_id = p_occupancy_id
      and bc.confirmed_at is not null
      and (occ.move_in_month is null or bc.period >= occ.move_in_month)
    group by bc.id, bc.unit_id, bc.period, bc.total_amount, b.id, b.org_id
  ),
  dated as (
    select
      pp.*,
      coalesce(
        (select bi.due_date
           from bill_issues bi
          where bi.unit_id = pp.unit_id
            and bi.period = pp.period
          order by bi.issued_at desc, bi.id desc
          limit 1),
        (select bps.due_date
           from billing_period_settings bps
          where bps.building_id = pp.building_id
            and bps.period = pp.period),
        (date_trunc('month', pp.period) + interval '1 month' - interval '1 day')::date
      ) as due_date
    from per_period pp
  )
  select coalesce(sum(
    d.principal
    + case when d.principal > 0 then coalesce(round(
        d.principal * (
          select coalesce(sum((
            select t.monthly_rate
            from late_fee_rate_tiers t
            where t.org_id = d.org_id
              and k.k > t.from_month
              and (t.to_month is null or k.k <= t.to_month)
            order by t.tier_order
            limit 1
          )), 0)::numeric
          from generate_series(1, greatest(
            (extract(year from timezone('Asia/Seoul', now()))::int - extract(year from d.due_date)::int) * 12
            + (extract(month from timezone('Asia/Seoul', now()))::int - extract(month from d.due_date)::int),
            0
          )) as k(k)
        ) * late_fee_factor(d.org_id, p_occupancy_id) / 100.0
      ), 0)::bigint
      else 0 end
  ), 0)::bigint
  from dated d
$function$;

revoke execute on function public.settlement_billing_unpaid(bigint, bigint) from public, anon, authenticated;

-- 백필: 미완료 정산(completed·mid_moveout 제외)의 ③ 스냅샷을 새 정의로 갱신(트리거가 settlement_amount 재계산).
update public.moving_settlements s
   set unpaid_amount = public.settlement_billing_unpaid(s.unit_id, s.occupancy_id)::integer
 where s.status not in ('completed', 'mid_moveout')
   and s.occupancy_id is not null
   and s.unpaid_amount is distinct from public.settlement_billing_unpaid(s.unit_id, s.occupancy_id)::integer;

-- ─── F2·F3: 퇴실 완료 ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_moving_settlement(p_settlement_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org bigint;
  v_unit_id bigint;
  v_occupancy_id bigint;
  v_move_out_date date;
  v_move_in_date date;
  v_status text;
  v_mode text;
  v_row record;
  v_pay_id bigint;
  v_collected_count int := 0;
  v_collected_total bigint := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;

  select s.unit_id, s.occupancy_id, s.move_out_date, s.status
    into v_unit_id, v_occupancy_id, v_move_out_date, v_status
    from moving_settlements s
    join units u on u.id = s.unit_id
    join buildings b on b.id = u.building_id and b.org_id = v_org
    where s.id = p_settlement_id
    for update of s;
  if not found then raise exception 'settlement not in org'; end if;
  if v_status = 'completed' then return jsonb_build_object('ok', true); end if;
  if v_occupancy_id is null then raise exception 'settlement has no occupancy'; end if;
  if v_move_out_date is null then raise exception 'move out date required'; end if;

  -- reset_occupancy_on_vacate 가 move_in_date 를 비우므로 먼저 잡는다(F2 자동수납 하한).
  select o.move_in_date into v_move_in_date
    from occupancies o
    where o.id = v_occupancy_id and o.unit_id = v_unit_id and o.deleted_at is null
    for update of o;
  if not found then raise exception 'occupancy not in unit'; end if;
  -- F3: 재사용 occupancy 에 정산 퇴실일 이후 입주한 새 입주자가 있으면 초기화하지 않는다.
  if v_move_in_date is not null and v_move_in_date > v_move_out_date then
    raise exception '이 세대에는 정산 퇴실일(%) 이후 입주한 새 입주자(입주일 %)가 있어 퇴실 처리할 수 없습니다. 정산 건을 확인해 주세요.',
      v_move_out_date, v_move_in_date
      using errcode = '55000', hint = 'SETTLEMENT_OCCUPANCY_REUSED';
  end if;

  select coalesce(sc.vacancy_payment_mode, 'manual') into v_mode
    from setup_config sc where sc.org_id = v_org;
  v_mode := coalesce(v_mode, 'manual');

  update moving_settlements
    set status = 'completed', processed_at = now()
    where id = p_settlement_id;

  -- 공실화 + 25필드 초기화 + 전화 포함 전출 이력 + 임대정보 삭제(12번).
  perform reset_occupancy_on_vacate(v_occupancy_id, v_move_out_date);
  update occupancies set settlement_note = null where id = v_occupancy_id;

  if v_mode = 'auto' then
    -- 미납 관리비 자동수납: 정산 대상 occupancy 의 확정 부과 period 마다 잔여 미납 원금을 수납 기록.
    -- 범위는 ③ settlement_billing_unpaid(unit, occupancy)와 동일(bc.occupancy_id = 정산 occupancy,
    -- 정산 입주자 입주월 이후 period, 0275).
    -- payments 에 연체료 컬럼이 없어 연체료는 수납하지 않는다(원금만).
    for v_row in
      select bc.period,
             bc.occupancy_id as charged_occupancy_id,
             (bc.total_amount - coalesce(sum(p.amount) filter (where p.status = 'active'), 0))::int as unpaid
      from billing_confirmations bc
      left join payments p
        on p.unit_id = bc.unit_id
       and p.period = bc.period
       and p.occupancy_id = bc.occupancy_id   -- reader(list_overdue)와 동일 귀속 합산 → 실행 후 미납=0 보장
      where bc.unit_id = v_unit_id
        and bc.occupancy_id = v_occupancy_id
        and bc.confirmed_at is not null
        and (v_move_in_date is null or bc.period >= date_trunc('month', v_move_in_date)::date)
      group by bc.period, bc.occupancy_id, bc.total_amount
      having (bc.total_amount - coalesce(sum(p.amount) filter (where p.status = 'active'), 0)) > 0
      order by bc.period
    loop
      insert into payments(
        org_id, unit_id, period, occupancy_id, amount, method, kind, memo, paid_at, source, created_by
      ) values (
        v_org, v_unit_id, v_row.period, v_row.charged_occupancy_id, v_row.unpaid,
        'other', 'full', '퇴실정산 자동수납', v_move_out_date, 'manual', auth.uid()
      ) returning id into v_pay_id;

      v_collected_count := v_collected_count + 1;
      v_collected_total := v_collected_total + v_row.unpaid;
    end loop;
  end if;

  if v_collected_count > 0 then
    insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
      values (v_org, auth.uid(), 'SETTLEMENT_AUTOCOLLECT', 'moving_settlements', p_settlement_id::text,
        jsonb_build_object(
          'unit_id', v_unit_id,
          'occupancy_id', v_occupancy_id,
          'move_out_date', v_move_out_date,
          'collected_count', v_collected_count,
          'collected_total', v_collected_total));
  end if;

  -- 수도지침은 다음 월 list_utility_rows가 전월 current를 previous로 읽으므로 별도 이월 write가 없다.
  return jsonb_build_object(
    'ok', true,
    'vacancy_payment_mode', v_mode,
    'collected_count', v_collected_count,
    'collected_total', v_collected_total);
end $function$;

-- ─── F3: 중도퇴실 ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mid_moveout_settlement(p_settlement_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org bigint;
  v_unit_id bigint;
  v_occupancy_id bigint;
  v_move_out_date date;
  v_move_in_date date;
  v_status text;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;

  select s.unit_id, s.occupancy_id, s.move_out_date, s.status
    into v_unit_id, v_occupancy_id, v_move_out_date, v_status
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

  -- F3(0275): 재사용 occupancy 에 정산 퇴실일 이후 입주한 새 입주자가 있으면 그 입주자 정보를 바꾸지 않는다.
  select o.move_in_date into v_move_in_date
    from occupancies o
    where o.id = v_occupancy_id and o.unit_id = v_unit_id and o.deleted_at is null;
  if not found then raise exception 'occupancy not in unit'; end if;
  if v_move_out_date is not null and v_move_in_date is not null and v_move_in_date > v_move_out_date then
    raise exception '이 세대에는 정산 퇴실일(%) 이후 입주한 새 입주자(입주일 %)가 있어 중도퇴실 처리할 수 없습니다. 정산 건을 확인해 주세요.',
      v_move_out_date, v_move_in_date
      using errcode = '55000', hint = 'SETTLEMENT_OCCUPANCY_REUSED';
  end if;

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

-- ─── F4: 공유 링크 미수금 ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.public_settlement_by_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- 계산 규칙 6절: 미수금 = 정산요금(settlement_amount) − 수납액(extra.paid). 음수면 환급.
  select jsonb_build_object(
    'move_out_date',
      case when sst.expires_at > now() then s.move_out_date else null end,
    'settlement_kind',
      case
        when sst.expires_at <= now() or s.settlement_amount is null then null
        when x.outstanding < 0 then '환급'
        when x.outstanding > 0 then '추가납부'
        else '완납'
      end,
    'settlement_amount',
      case when sst.expires_at > now() then x.outstanding else null end,
    'unit_label',
      case
        when sst.expires_at > now()
        then concat_ws(' ', nullif(trim(u.dong), ''), u.unit_no)
        else null
      end,
    'building_name',
      case when sst.expires_at > now() then b.name else null end,
    'is_expired', sst.expires_at <= now()
  )
  from public.settlement_share_tokens sst
  join public.moving_settlements s on s.id = sst.settlement_id
  cross join lateral (
    select s.settlement_amount
           - coalesce(case when jsonb_typeof(s.extra -> 'paid') in ('number', 'string')
                           and (s.extra ->> 'paid') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
                      then (s.extra ->> 'paid')::numeric end, 0) as outstanding
  ) x
  join public.units u on u.id = s.unit_id
  join public.buildings b
    on b.id = u.building_id
   and b.org_id = sst.org_id
  where sst.token = p_token;
$function$;

-- ─── F6: 협력사 검침 저장 → 재배분, anon 회수 ────────────────────────────────
CREATE OR REPLACE FUNCTION public.partner_save_meter_readings(p_building_id bigint, p_period date, p_readings jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_item jsonb; v_unit bigint; v_util text; v_prev numeric; v_cur numeric; v_use numeric; v_pu numeric; v_has_pu boolean;
  v_utils text[] := array[]::text[];
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
    if not (v_util = any(v_utils)) then v_utils := v_utils || v_util; end if;
  end loop;

  -- 0275: 고객번호 청구총액이 있으면 사용량 비례 재배분(총액 없으면 no-op, 가스는 함수 내부에서 제외).
  foreach v_util in array v_utils loop
    perform utility_allocate_period(p_building_id, v_util, p_period);
  end loop;
end $function$;

revoke execute on function public.partner_save_meter_readings(bigint, date, jsonb) from public, anon;
grant execute on function public.partner_save_meter_readings(bigint, date, jsonb) to authenticated, service_role;

-- ─── F7: 확정월 총액 저장 거절 ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_utility_customer_bills(p_building_id bigint, p_utility text, p_period date, p_bills jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org bigint := current_user_org();
  v_item jsonb;
  v_id bigint;
  v_amount numeric;
  v_customer_no text;
  v_removed text[] := array[]::text[];
  v_rows jsonb;
  v_count int := 0;
begin
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('utilities') then
    raise exception 'forbidden: utilities required';
  end if;
  if p_utility not in ('water', 'elec') then
    raise exception 'customer bill allocation supports water/elec only';
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
  -- 0275: 확정된 검침월은 총액(=호실 부과액 재배분)을 바꾸지 않는다(협력사 검침 저장과 같은 가드).
  if exists (
    select 1 from utility_confirmations uc
    where uc.building_id = p_building_id and uc.utility = p_utility
      and uc.period = p_period and uc.confirmed_at is not null
  ) then
    raise exception '이미 확정된 검침월입니다. 확정된 달의 청구총액은 수정할 수 없습니다. (%, %)', p_utility, to_char(p_period, 'YYYY-MM');
  end if;
  if jsonb_typeof(coalesce(p_bills, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'bills must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_bills, '[]'::jsonb)) loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'bill entries must be objects';
    end if;
    v_id := nullif(v_item->>'customer_number_id', '')::bigint;
    select customer_no into v_customer_no
    from building_customer_numbers
    where id = v_id and building_id = p_building_id and kind = p_utility and deleted_at is null;
    if v_id is null or v_customer_no is null then
      raise exception 'customer number % not in building/utility', v_id;
    end if;
    v_amount := nullif(v_item->>'amount', '')::numeric;

    if v_amount is null then
      delete from utility_customer_bills
        where building_customer_number_id = v_id and period = p_period;
      if found then v_removed := v_removed || v_customer_no; end if;
    else
      if v_amount < 0 or v_amount <> trunc(v_amount) then
        raise exception 'amount must be a non-negative integer';
      end if;
      insert into utility_customer_bills(building_customer_number_id, period, amount, updated_by)
        values (v_id, p_period, v_amount::int, auth.uid())
        on conflict (building_customer_number_id, period) do update
          set amount = excluded.amount, updated_at = now(), updated_by = excluded.updated_by;
    end if;
    v_count := v_count + 1;
  end loop;

  -- 총액을 지운 고객번호: 기존 계산(단가×량−할인)으로 되돌린다.
  if array_length(v_removed, 1) > 0 then
    -- 저장값을 그대로 다시 넣는다. previous_reading 키는 null 이어도 유지해 전월을 다시 찾지 않게 하고,
    -- needs_review 행은 usage 를 비워 지침 차이로 다시 판정되게 한다(JSON null → 미지정).
    select coalesce(jsonb_agg(jsonb_build_object(
      'unit_id', mr.unit_id,
      'previous_reading', mr.previous_reading,
      'current_reading', mr.current_reading,
      'usage', case when mr.needs_review then null else mr.usage end,
      'manual_charge', mr.manual_charge,
      'note', mr.note
    )), '[]'::jsonb)
    into v_rows
    from units u
    join unit_meters um on um.unit_id = u.id and um.utility = p_utility and um.customer_no = any(v_removed)
    join meter_readings mr on mr.unit_id = u.id and mr.utility = p_utility and mr.period = p_period
    where u.building_id = p_building_id and u.deleted_at is null;
    if jsonb_array_length(v_rows) > 0 then
      perform save_meter_readings(p_building_id, p_utility, p_period, v_rows);
    end if;
  end if;

  return jsonb_build_object(
    'saved', v_count,
    'allocation', utility_allocate_period(p_building_id, p_utility, p_period)
  );
end $function$;

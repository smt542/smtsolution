-- 세입자 고지서 공과금(항목 금액)이 사무실 관리자 화면과 다르게 보이던 문제.
--
-- 원인(차이비교.md):
--   1) 세입자 고지서(resident_bill_detail·public_bill_by_signed)는 항목 금액을 fee_item_charges 에서 읽었다.
--      관리비 저장은 손댄 칸만 fee_item_charges 에 쓰고, confirm_billing 은 빈 칸을 공과금 부과액·이월값으로 채우고
--      일할 계산까지 해 billing_history.items(확정 스냅샷)·billing_confirmations.total_amount 로만 남긴다.
--      → 사무실 고지서 출력·팩스(get_bill_documents·load_fax_document = 스냅샷)와 세입자 화면이 달랐다.
--   2) 관리비 확정 뒤 공과금(meter_readings)이 다시 계산·수정돼도 관리비 부과 화면에 '재확정 필요'가 뜨지 않았다.
--   3) 공과금 부과액이 없는 달에 공과금 항목(전기·수도료·가스, carry_over=true)이 서버 기본값 계산에서 전월 금액으로 이월됐다.
--      (화면의 '전월 반영'은 이미 필수 공과금 항목을 제외한다.)
--
-- 변경:
--   1) 세입자 고지서 항목 금액 = 그 달 최신 확정 스냅샷(billing_history, 사무실 고지서와 같은 행).
--      스냅샷이 없는 과거 자료만 fee_item_charges 로 대체. 사용량은 공과금 화면과 같이 (당월 − 전월 지침) 보정.
--   2) list_billing.is_dirty: 확정 후 필수 공과금 부과액이 스냅샷 금액과 달라지면 true(부과 안 함으로 둔 항목은 제외).
--   3) list_billing·confirm_billing·charge_new_occupancies: 전월 이월 기본값에서 필수 공과금 항목 제외.
-- 이미 확정·발송된 고지서 금액은 바꾸지 않는다. 직원이 관리비 부과에서 '공과금 계산' → 저장하면 반영된다.

create or replace function public.resident_bill_detail(p_period date)
 returns table(period date, building_name text, unit_no text, tenant_name text, total_amount integer, paid_amount integer, unpaid_amount integer, late_fee integer, due_date date, confirmed_at timestamp with time zone, items jsonb, mgmt_bank text, mgmt_acct text, mgmt_holder text, carryover_unpaid integer, carryover_late_fee integer)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with linked as (
    select * from resident_linked_unit()
  )
  select
    bc.period,
    b.name,
    u.unit_no,
    l.tenant_name,
    bc.total_amount,
    coalesce(pay.paid_amount, 0)::int,
    greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int,
    (greatest(coalesce(
      case when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0 then bc.late_fee_override end,
      round(
      greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate * late_fee_factor(l.org_id, bc.occupancy_id) / 100.0
    )::int) - lfs.split_total, 0) + lfs.split_unpaid)::int as late_fee,
    issue.due_date,
    bc.confirmed_at,
    coalesce(charges.items, '[]'::jsonb),
    sc.mgmt_bank1,
    sc.mgmt_acct1,
    sc.mgmt_holder1,
    co.carryover_unpaid,
    co.carryover_late_fee
  from linked l
  join units u on u.id = l.unit_id
  join buildings b on b.id = l.building_id and b.org_id = l.org_id
  join billing_confirmations bc
    on bc.unit_id = l.unit_id
   and bc.occupancy_id = l.occupancy_id
   and bc.period = p_period
   and bc.confirmed_at is not null
  left join setup_config sc on sc.org_id = l.org_id
  cross join lateral bill_carryover(l.unit_id, bc.period) co
  cross join lateral late_fee_split_balance(l.unit_id, bc.period) lfs
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from payments p
    where p.unit_id = l.unit_id
      and p.occupancy_id = bc.occupancy_id
      and p.period = bc.period
      and p.status = 'active'
      and p.late_fee_split_id is null
  ) pay on true
  left join lateral (
    -- 0288: 납부기한 = 발행 고지서 → 건물·월 납기일 → 회사 기본 납부일 → 그 달 말일
    select coalesce(
      (select bi.due_date
         from public.bill_issues bi
        where bi.unit_id = l.unit_id and bi.period = bc.period and bi.due_date is not null
        order by bi.issued_at desc, bi.id desc
        limit 1),
      (select bps.due_date
         from public.billing_period_settings bps
        where bps.building_id = l.building_id and bps.period = bc.period),
      public.billing_default_due_date(l.unit_id, bc.period)
    ) as due_date
  ) issue on true
  left join lateral (
    select coalesce(sum(
      (
        select t.monthly_rate
        from late_fee_rate_tiers t
        where t.org_id = l.org_id
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
  -- 0324: 사무실 고지서(get_bill_documents)와 같은 확정 스냅샷.
  left join lateral (
    select h.items
    from billing_history h
    where h.unit_id = l.unit_id and h.period = bc.period
    order by h.confirmed_at desc, h.id desc
    limit 1
  ) bh on true
  left join lateral (
    -- 0286: 건물 유형의 관리비 항목 전체를 보여준다(그 달 부과가 없으면 0원). 부과됐다가 지워진 항목도 남긴다.
    -- 개별 사용료(수도·전기·가스)는 필수 공과금 항목만 — '공용전기료' 같은 공용 항목이 개별로 잡히지 않게.
    -- 0324: 금액은 확정 스냅샷 기준. 스냅샷이 없는 과거 자료만 fee_item_charges.
    select jsonb_agg(
      jsonb_build_object(
        'fee_item_id', fi.id,
        'name', fi.name,
        'amount', case when bh.items is not null then coalesce(snap.amount, 0) else coalesce(fic.amount, 0) end,
        'charged', case when bh.items is not null then snap.fee_item_id is not null else coalesce(fic.charged, false) end,
        'utility', util.u,
        'usage', coalesce(mr.usage, mr.current_reading - coalesce(mr.previous_reading, 0)),
        'prev_usage', coalesce(prev.usage, prev.current_reading - coalesce(prev.previous_reading, 0))
      ) order by fi.sort_order, fi.id
    ) as items
    from public.fee_items fi
    left join lateral (
      select (e->>'fee_item_id')::bigint as fee_item_id, sum((e->>'amount')::int)::int as amount
      from jsonb_array_elements(coalesce(bh.items, '[]'::jsonb)) e
      where (e->>'fee_item_id')::bigint = fi.id
      group by 1
    ) snap on true
    left join public.fee_item_charges fic
      on bh.items is null
     and fic.fee_item_id = fi.id
     and fic.unit_id = u.id
     and fic.period = bc.period
     and fic.charged = true
    cross join lateral (
      select case
        when not fi.is_required then null
        when fi.name like '%수도%' then 'water'
        when fi.name like '%전기%' then 'elec'
        when fi.name like '%가스%' then 'gas'
        else null
      end as u
    ) util
    left join public.meter_readings mr
      on mr.unit_id = u.id and mr.period = bc.period and mr.utility = util.u
    left join public.meter_readings prev
      on prev.unit_id = u.id
     and prev.period = (bc.period - interval '1 month')::date
     and prev.utility = util.u
    where (fi.org_id = b.org_id and fi.type_id = b.type_id and fi.deleted_at is null)
       or snap.fee_item_id is not null
       or fic.id is not null
  ) charges on true
  -- 0293: 입주 기간 조건 없음 — 본인 입주(occupancy_id) 부과분은 모두 표시;
$function$;

create or replace function public.public_bill_by_signed(p_building_id bigint, p_unit_no text, p_period date, p_sig text, p_issued_day integer)
 returns table(period date, building_name text, unit_no text, total_amount integer, paid_amount integer, unpaid_amount integer, late_fee integer, due_date date, items jsonb, mgmt_bank text, mgmt_acct text, mgmt_holder text, expires_at timestamp with time zone, is_expired boolean, carryover_unpaid integer, carryover_late_fee integer)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with sig as (
    select (
      p_sig is not null
      and case
        when p_issued_day is null
        then p_sig = public.bill_signature(p_building_id, p_unit_no, p_period)
        else p_sig = public.bill_signature(p_building_id, p_unit_no, p_period, p_issued_day)
      end
    ) as ok
  )
  select
    bc.period, b.name, u.unit_no,
    case when now() < exp.expires_at then bc.total_amount else null end,
    case when now() < exp.expires_at then coalesce(pay.paid_amount, 0)::int else null end,
    case when now() < exp.expires_at
      then greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int else null end,
    case when now() < exp.expires_at
      then (greatest(coalesce(case when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0 then bc.late_fee_override end,
        round(greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)
        * lf.cumulative_rate * public.late_fee_factor(b.org_id, bc.occupancy_id) / 100.0)::int) - lfs.split_total, 0) + lfs.split_unpaid)::int else null end,
    case when now() < exp.expires_at then issue.due_date else null end,
    case when now() < exp.expires_at then coalesce(charges.items, '[]'::jsonb) else null end,
    case when now() < exp.expires_at then sc.mgmt_bank1 else null end,
    case when now() < exp.expires_at then sc.mgmt_acct1 else null end,
    case when now() < exp.expires_at then sc.mgmt_holder1 else null end,
    exp.expires_at,
    now() >= exp.expires_at,
    case when now() < exp.expires_at then co.carryover_unpaid else null end,
    case when now() < exp.expires_at then co.carryover_late_fee else null end
  from sig
  join public.buildings b on b.id = p_building_id
  join public.units u
    on u.building_id = b.id and u.unit_no = p_unit_no and u.deleted_at is null
  join public.billing_confirmations bc
    on bc.unit_id = u.id and bc.period = p_period and bc.confirmed_at is not null
  left join public.setup_config sc on sc.org_id = b.org_id
  cross join lateral public.bill_carryover(u.id, bc.period) co
  cross join lateral public.late_fee_split_balance(u.id, bc.period) lfs
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from public.payments p
    where p.unit_id = u.id and p.period = bc.period and p.status = 'active' and p.late_fee_split_id is null
  ) pay on true
  left join lateral (
    -- 0288: 납부기한 = 발행 고지서 → 건물·월 납기일 → 회사 기본 납부일 → 그 달 말일
    select coalesce(
      (select bi.due_date
         from public.bill_issues bi
        where bi.unit_id = u.id and bi.period = bc.period and bi.due_date is not null
        order by bi.issued_at desc, bi.id desc
        limit 1),
      (select bps.due_date
         from public.billing_period_settings bps
        where bps.building_id = u.building_id and bps.period = bc.period),
      public.billing_default_due_date(u.id, bc.period)
    ) as due_date
  ) issue on true
  cross join lateral (
    select (date_trunc('month', p_period) + interval '12 months')::timestamptz as expires_at
  ) exp
  left join lateral (
    select coalesce(sum((
      select t.monthly_rate
      from public.late_fee_rate_tiers t
      where t.org_id = b.org_id
        and k.k > t.from_month
        and (t.to_month is null or k.k <= t.to_month)
      order by t.tier_order limit 1
    )), 0)::numeric as cumulative_rate
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
  -- 0324: 사무실 고지서(get_bill_documents)와 같은 확정 스냅샷.
  left join lateral (
    select h.items
    from public.billing_history h
    where h.unit_id = u.id and h.period = bc.period
    order by h.confirmed_at desc, h.id desc
    limit 1
  ) bh on true
  left join lateral (
    -- 0286: 건물 유형의 관리비 항목 전체를 보여준다(그 달 부과가 없으면 0원). 부과됐다가 지워진 항목도 남긴다.
    -- 개별 사용료(수도·전기·가스)는 필수 공과금 항목만 — '공용전기료' 같은 공용 항목이 개별로 잡히지 않게.
    -- 0324: 금액은 확정 스냅샷 기준. 스냅샷이 없는 과거 자료만 fee_item_charges.
    select jsonb_agg(
      jsonb_build_object(
        'fee_item_id', fi.id,
        'name', fi.name,
        'amount', case when bh.items is not null then coalesce(snap.amount, 0) else coalesce(fic.amount, 0) end,
        'charged', case when bh.items is not null then snap.fee_item_id is not null else coalesce(fic.charged, false) end,
        'utility', util.u,
        'usage', coalesce(mr.usage, mr.current_reading - coalesce(mr.previous_reading, 0)),
        'prev_usage', coalesce(prev.usage, prev.current_reading - coalesce(prev.previous_reading, 0))
      ) order by fi.sort_order, fi.id
    ) as items
    from public.fee_items fi
    left join lateral (
      select (e->>'fee_item_id')::bigint as fee_item_id, sum((e->>'amount')::int)::int as amount
      from jsonb_array_elements(coalesce(bh.items, '[]'::jsonb)) e
      where (e->>'fee_item_id')::bigint = fi.id
      group by 1
    ) snap on true
    left join public.fee_item_charges fic
      on bh.items is null
     and fic.fee_item_id = fi.id
     and fic.unit_id = u.id
     and fic.period = bc.period
     and fic.charged = true
    cross join lateral (
      select case
        when not fi.is_required then null
        when fi.name like '%수도%' then 'water'
        when fi.name like '%전기%' then 'elec'
        when fi.name like '%가스%' then 'gas'
        else null
      end as u
    ) util
    left join public.meter_readings mr
      on mr.unit_id = u.id and mr.period = bc.period and mr.utility = util.u
    left join public.meter_readings prev
      on prev.unit_id = u.id
     and prev.period = (bc.period - interval '1 month')::date
     and prev.utility = util.u
    where (fi.org_id = b.org_id and fi.type_id = b.type_id and fi.deleted_at is null)
       or snap.fee_item_id is not null
       or fic.id is not null
  ) charges on true
  where sig.ok;
$function$;

create or replace function public.list_billing(p_building_id bigint, p_period date)
 returns table(unit_id bigint, unit_no text, dong text, room_type_label text, occupancy_id bigint, tenant_name text, move_in_date date, is_vacant boolean, fee_item_id bigint, fee_item_name text, carry_over boolean, daily_proration boolean, rounding text, is_required boolean, sort_order integer, charged boolean, amount integer, confirmed_at timestamp with time zone, confirmed_by_name text, total_amount integer, billing_note text, unit_notice text, is_dirty boolean, area_pyeong numeric, mgmt_fee_amount bigint)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with b as (
    select id, type_id from buildings where id = p_building_id and org_id = current_user_org()
  ),
  fi as (
    select * from fee_items where type_id = (select type_id from b) and deleted_at is null
  ),
  u as (
    select id, unit_no, dong, area_pyeong from units where building_id = p_building_id and deleted_at is null
  ),
  occ as (
    select distinct on (o.unit_id)
      o.unit_id, o.id as occupancy_id, o.tenant_name, o.move_in_date, o.status, o.room_type_id,
      o.mgmt_fee_amount
    from occupancies o join u on u.id = o.unit_id
    where o.deleted_at is null
    order by o.unit_id, o.created_at desc, o.id desc
  ),
  -- 0324: 확정 후 공과금 부과액이 확정 스냅샷과 달라진 세대(부과 안 함 항목 제외).
  util_dirty as (
    select u.id as unit_id
    from u
    join billing_confirmations bc on bc.unit_id = u.id and bc.period = p_period and bc.confirmed_at is not null
    cross join lateral (
      select h.items from billing_history h
      where h.unit_id = u.id and h.period = p_period
      order by h.confirmed_at desc, h.id desc limit 1
    ) bh
    join fi rf on rf.is_required
    cross join lateral (select billing_utility_default(u.id, p_period, true, rf.name) as charge) cur
    where cur.charge is not null
      and not exists (
        select 1 from fee_item_charges x
        where x.unit_id = u.id and x.period = p_period and x.fee_item_id = rf.id and not x.charged
      )
      and cur.charge is distinct from coalesce((
        select sum((e->>'amount')::int)::int from jsonb_array_elements(bh.items) e
        where (e->>'fee_item_id')::bigint = rf.id
      ), 0)
    group by u.id
  )
  select
    u.id, u.unit_no, u.dong, rt.label,
    occ.occupancy_id, occ.tenant_name, occ.move_in_date,
    coalesce(occ.status = 'vacant', true) as is_vacant,
    fi.id, fi.name, fi.carry_over, fi.daily_proration, fi.rounding, fi.is_required, fi.sort_order,
    coalesce(fic.charged, true) as charged,
    coalesce(
      fic.amount,
      billing_utility_default(u.id, p_period, fi.is_required, fi.name),
      -- 0324: 필수 공과금은 이월하지 않는다(원천 = 공과금 화면 부과액).
      case when fi.carry_over and not fi.is_required then prev.amount else 0 end,
      0
    ) as amount,
    bc.confirmed_at, pr.full_name as confirmed_by_name, bc.total_amount,
    bc.billing_note, bc.unit_notice,
    coalesce(bc.confirmed_at is not null and (
      exists (
        select 1 from fee_item_charges x
        where x.unit_id = u.id and x.period = p_period and x.updated_at > bc.confirmed_at
      )
      or ud.unit_id is not null
    ), false) as is_dirty,
    u.area_pyeong,
    occ.mgmt_fee_amount
  from u
  cross join fi
  left join occ on occ.unit_id = u.id
  left join room_types rt on rt.id = occ.room_type_id
  left join fee_item_charges fic on fic.unit_id = u.id and fic.fee_item_id = fi.id and fic.period = p_period
  left join fee_item_charges prev on prev.unit_id = u.id and prev.fee_item_id = fi.id
       and prev.period = (p_period - interval '1 month')::date
  left join billing_confirmations bc on bc.unit_id = u.id and bc.period = p_period
  left join profiles pr on pr.user_id = bc.confirmed_by
  left join util_dirty ud on ud.unit_id = u.id
  order by u.unit_no, fi.sort_order
$function$;

CREATE OR REPLACE FUNCTION public.confirm_billing(p_building_id bigint, p_period date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org bigint; v_unit record; v_item record;
  v_items jsonb; v_total bigint; v_amt int;
  v_days int; v_occupied int; v_count int := 0; v_grand bigint := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('billing') then raise exception 'forbidden: billing required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed'; end if;

  v_days := extract(day from ((p_period + interval '1 month')::date - 1))::int;

  for v_unit in
    select u.id as unit_id, occ.id as occ_id, occ.tenant_name, occ.move_in_date, occ.status
    from units u
    left join lateral (
      select * from occupancies o where o.unit_id = u.id and o.deleted_at is null
      order by o.created_at desc, o.id desc limit 1
    ) occ on true
    where u.building_id = p_building_id and u.deleted_at is null
  loop
    if coalesce(v_unit.status = 'vacant', true) then continue; end if;  -- 공실 제외

    if v_unit.move_in_date is not null
       and v_unit.move_in_date between p_period and ((p_period + interval '1 month')::date - 1) then
      v_occupied := ((p_period + interval '1 month')::date - v_unit.move_in_date);  -- 입주일 포함
    else
      v_occupied := v_days;
    end if;

    v_items := '[]'::jsonb; v_total := 0;
    for v_item in
      select
        fi.id as fee_item_id,
        fi.name,
        coalesce(
          fic.amount,
          billing_utility_default(v_unit.unit_id, p_period, fi.is_required, fi.name),
          -- 0324: 필수 공과금은 이월하지 않는다.
          case when fi.carry_over and not fi.is_required then prev.amount else 0 end,
          0
        ) as amount,
        fi.daily_proration,
        fi.rounding
      from buildings b
      join fee_items fi
        on fi.type_id = b.type_id and fi.org_id = v_org and fi.deleted_at is null
      left join fee_item_charges fic
        on fic.unit_id = v_unit.unit_id and fic.fee_item_id = fi.id and fic.period = p_period
      left join fee_item_charges prev
        on prev.unit_id = v_unit.unit_id and prev.fee_item_id = fi.id
       and prev.period = (p_period - interval '1 month')::date
      where b.id = p_building_id and coalesce(fic.charged, true)
      order by fi.sort_order, fi.id
    loop
      if v_item.daily_proration and v_occupied < v_days then
        -- 계산규칙 1.1: 일할 분모 고정 30일(중간입주 판정은 v_days 유지)
        v_amt := round_charge(v_item.amount::numeric * v_occupied / 30, v_item.rounding);
      else
        v_amt := v_item.amount;
      end if;
      v_items := v_items || jsonb_build_object('fee_item_id', v_item.fee_item_id, 'name', v_item.name, 'charged', true, 'amount', v_amt);
      v_total := v_total + v_amt;
    end loop;

    insert into billing_confirmations(unit_id, period, occupancy_id, total_amount, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_total, now(), auth.uid())
      on conflict (unit_id, period) do update
        set occupancy_id = excluded.occupancy_id, total_amount = excluded.total_amount,
            confirmed_at = excluded.confirmed_at, confirmed_by = excluded.confirmed_by;

    insert into billing_history(unit_id, period, occupancy_id, tenant_name, total_amount, items, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_unit.tenant_name, v_total, v_items, now(), auth.uid());

    v_count := v_count + 1; v_grand := v_grand + v_total;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILLING_CONFIRM', 'billing_confirmations', p_building_id::text,
      jsonb_build_object('period', p_period, 'unit_count', v_count, 'total', v_grand));

  return jsonb_build_object('unit_count', v_count, 'total', v_grand);
end $function$;

CREATE OR REPLACE FUNCTION public.charge_new_occupancies(p_building_id bigint, p_period date, p_unit_ids bigint[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org bigint; v_unit record; v_item record;
  v_items jsonb; v_total bigint; v_amt int;
  v_days int; v_occupied int; v_count int := 0; v_grand bigint := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('billing') then raise exception 'forbidden: billing required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed'; end if;

  v_days := extract(day from ((p_period + interval '1 month')::date - 1))::int;

  -- 감지대상(list_uncharged_new_occupancies와 동일 필터) ∩ p_unit_ids 만 처리(임의 세대 차단)
  for v_unit in
    select u.id as unit_id, occ.id as occ_id, occ.tenant_name, occ.move_in_date, occ.status, occ.created_at
    from units u
    left join lateral (
      select * from occupancies o where o.unit_id = u.id and o.deleted_at is null
      order by o.created_at desc, o.id desc limit 1
    ) occ on true
    where u.building_id = p_building_id and u.deleted_at is null
      and u.id = any(p_unit_ids)
      and coalesce(occ.status, 'vacant') = 'occupied'
      and occ.created_at > (
        select max(bc.confirmed_at) from billing_confirmations bc
        join units u2 on u2.id = bc.unit_id
        where u2.building_id = p_building_id and bc.period = p_period and bc.confirmed_at is not null
      )
      and not exists (
        select 1 from billing_confirmations bc
        where bc.unit_id = u.id and bc.period = p_period and bc.confirmed_at is not null
      )
  loop
    if v_unit.move_in_date is not null
       and v_unit.move_in_date between p_period and ((p_period + interval '1 month')::date - 1) then
      v_occupied := ((p_period + interval '1 month')::date - v_unit.move_in_date);  -- 입주일 포함
    else
      v_occupied := v_days;
    end if;

    v_items := '[]'::jsonb; v_total := 0;
    for v_item in
      select fi.id as fee_item_id, fi.name,
        coalesce(
          fic.amount,
          billing_utility_default(v_unit.unit_id, p_period, fi.is_required, fi.name),
          -- 0324: 필수 공과금은 이월하지 않는다.
          case when fi.carry_over and not fi.is_required then prev.amount else 0 end,
          0
        ) as amount,
        fi.daily_proration, fi.rounding
      from buildings b
      join fee_items fi on fi.type_id = b.type_id and fi.org_id = v_org and fi.deleted_at is null
      left join fee_item_charges fic on fic.unit_id = v_unit.unit_id and fic.fee_item_id = fi.id and fic.period = p_period
      left join fee_item_charges prev on prev.unit_id = v_unit.unit_id and prev.fee_item_id = fi.id
           and prev.period = (p_period - interval '1 month')::date
      where b.id = p_building_id and coalesce(fic.charged, true)
      order by fi.sort_order, fi.id
    loop
      if v_item.daily_proration and v_occupied < v_days then
        -- 계산규칙 1.1: 일할 분모 고정 30일 (confirm_billing 0021과 동일)
        v_amt := round_charge(v_item.amount::numeric * v_occupied / 30, v_item.rounding);
      else
        v_amt := v_item.amount;
      end if;
      v_items := v_items || jsonb_build_object('fee_item_id', v_item.fee_item_id, 'name', v_item.name, 'charged', true, 'amount', v_amt);
      v_total := v_total + v_amt;
    end loop;

    insert into billing_confirmations(unit_id, period, occupancy_id, total_amount, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_total, now(), auth.uid())
      on conflict (unit_id, period) do update
        set occupancy_id = excluded.occupancy_id, total_amount = excluded.total_amount,
            confirmed_at = excluded.confirmed_at, confirmed_by = excluded.confirmed_by;

    insert into billing_history(unit_id, period, occupancy_id, tenant_name, total_amount, items, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_unit.tenant_name, v_total, v_items, now(), auth.uid());

    v_count := v_count + 1; v_grand := v_grand + v_total;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILLING_CHARGE_NEW', 'billing_confirmations', p_building_id::text,
      jsonb_build_object('period', p_period, 'unit_count', v_count, 'total', v_grand));

  return jsonb_build_object('unit_count', v_count, 'total', v_grand);
end $function$;

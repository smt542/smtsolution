-- 입주민 고지서 '총 관리비'에 이월 미납과 그 연체료를 넣는다.
--  - 정책(세입자_관리비 상세고지서 3.4): 총 관리비 = 당월 부과액 + 미납액(전월 이월) + 연체료.
--  - resident_bill_detail / public_bill_by_signed 는 해당 월 미납만 돌려줘, 전월까지의 미납이 빠졌다.
--  - 이월 미납·연체료는 사무실 조정표와 같은 기준으로 계산한다(list_overdue_periods + lib/billing/lateFee).
--      · 대상: 같은 입주(occupancy)의 이전 월 확정 부과 중 미납 원금이 남은 달
--      · 납기: billing_period_settings.due_date, 없으면 그 달 말일
--      · 연체료: 미납 원금 × 누적 요율(late_fee_rate_tiers), 기준월 = 고지서 월
--      · 조직(setup_config.late_fee_enabled)·입주(occupancies.late_fee_enabled) 연체료 미사용이면 0
--  - 두 RPC에 carryover_unpaid, carryover_late_fee 컬럼을 추가한다(기존 컬럼은 그대로).

create or replace function public.bill_carryover(p_unit_id bigint, p_period date)
returns table(carryover_unpaid integer, carryover_late_fee integer)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with cur as (
    select bc.occupancy_id, u.building_id, b.org_id
    from billing_confirmations bc
    join units u on u.id = bc.unit_id
    join buildings b on b.id = u.building_id
    where bc.unit_id = p_unit_id
      and bc.period = p_period
  ),
  prior as (
    select
      greatest(
        bc.total_amount::bigint - coalesce((
          select sum(p.amount)
          from payments p
          where p.occupancy_id = bc.occupancy_id
            and p.unit_id = bc.unit_id
            and p.period = bc.period
            and p.status = 'active'
        ), 0)::bigint,
        0::bigint
      ) as outstanding,
      coalesce(
        bps.due_date,
        (date_trunc('month', bc.period) + interval '1 month' - interval '1 day')::date
      ) as due_date
    from cur
    join billing_confirmations bc
      on bc.unit_id = p_unit_id
     and bc.occupancy_id = cur.occupancy_id
     and bc.period < p_period
     and bc.confirmed_at is not null
    left join billing_period_settings bps
      on bps.building_id = cur.building_id
     and bps.period = bc.period
  ),
  fee as (
    select
      pr.outstanding,
      case
        when coalesce(sc.late_fee_enabled, true) and coalesce(o.late_fee_enabled, true)
        then round(pr.outstanding * (
          -- 누적요율(%) = Σ_{k=1..개월수} rateForMonth(k); tier_order 순 첫 매칭
          select coalesce(sum((
            select t.monthly_rate
            from late_fee_rate_tiers t
            where t.org_id = cur.org_id
              and k.k > t.from_month
              and (t.to_month is null or k.k <= t.to_month)
            order by t.tier_order
            limit 1
          )), 0)
          from generate_series(1, greatest(
            (extract(year from p_period)::int - extract(year from pr.due_date)::int) * 12
            + (extract(month from p_period)::int - extract(month from pr.due_date)::int),
            0
          )) as k(k)
        ) / 100.0)
        else 0
      end as late_fee
    from prior pr
    cross join cur
    left join setup_config sc on sc.org_id = cur.org_id
    left join occupancies o on o.id = cur.occupancy_id
    where pr.outstanding > 0
  )
  select coalesce(sum(outstanding), 0)::int, coalesce(sum(late_fee), 0)::int
  from fee;
$function$;

revoke execute on function public.bill_carryover(bigint, date) from public, anon, authenticated;

-- ── resident_bill_detail ───────────────────────────────────────────────
drop function if exists public.resident_bill_detail(date);

create function public.resident_bill_detail(p_period date)
returns table(
  period date, building_name text, unit_no text, tenant_name text,
  total_amount integer, paid_amount integer, unpaid_amount integer, late_fee integer,
  due_date date, confirmed_at timestamp with time zone, items jsonb,
  mgmt_bank text, mgmt_acct text, mgmt_holder text,
  carryover_unpaid integer, carryover_late_fee integer
)
language sql
stable
security definer
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
    round(
      greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate / 100.0
    )::int as late_fee,
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
   and bc.period = p_period
   and bc.confirmed_at is not null
  left join setup_config sc on sc.org_id = l.org_id
  cross join lateral bill_carryover(l.unit_id, bc.period) co
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from payments p
    where p.unit_id = l.unit_id
      and p.period = bc.period
      and p.status = 'active'
  ) pay on true
  left join lateral (
    select bi.due_date
    from bill_issues bi
    where bi.unit_id = l.unit_id
      and bi.period = bc.period
    order by bi.issued_at desc, bi.id desc
    limit 1
  ) issue on true
  left join lateral (
    -- 누적요율(%) = Σ_{k=1..months_overdue} rateForMonth(k); tier_order 순 첫 매칭
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
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'fee_item_id', fic.fee_item_id,
        'name', fi.name,
        'amount', fic.amount,
        'charged', fic.charged,
        'utility', util.u,
        'usage', mr.usage,
        'prev_usage', prev.usage
      ) order by fi.sort_order, fi.id
    ) as items
    from fee_item_charges fic
    join fee_items fi on fi.id = fic.fee_item_id
    cross join lateral (
      select case
        when fi.name like '%수도%' then 'water'
        when fi.name like '%전기%' then 'elec'
        when fi.name like '%가스%' then 'gas'
        else null
      end as u
    ) util
    left join meter_readings mr
      on mr.unit_id = fic.unit_id
     and mr.period = fic.period
     and mr.utility = util.u
    left join meter_readings prev
      on prev.unit_id = fic.unit_id
     and prev.period = (fic.period - interval '1 month')::date
     and prev.utility = util.u
    where fic.unit_id = l.unit_id
      and fic.period = bc.period
      and fic.charged = true
  ) charges on true
  where l.move_in is not null
    and p_period >= date_trunc('month', l.move_in)::date
    and (
      l.move_out is null
      or p_period <= date_trunc('month', l.move_out)::date
    );
$function$;

revoke execute on function public.resident_bill_detail(date) from public, anon;
grant execute on function public.resident_bill_detail(date) to authenticated, service_role;

-- ── public_bill_by_signed (5-arg 본체 + 4-arg 레거시 래퍼) ─────────────────
drop function if exists public.public_bill_by_signed(bigint, text, date, text);
drop function if exists public.public_bill_by_signed(bigint, text, date, text, integer);

create function public.public_bill_by_signed(
  p_building_id bigint, p_unit_no text, p_period date, p_sig text, p_issued_day integer
)
returns table(
  period date, building_name text, unit_no text,
  total_amount integer, paid_amount integer, unpaid_amount integer, late_fee integer,
  due_date date, items jsonb, mgmt_bank text, mgmt_acct text, mgmt_holder text,
  expires_at timestamp with time zone, is_expired boolean,
  carryover_unpaid integer, carryover_late_fee integer
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with sig as (
    select
      (
        p_sig is not null
        and case
          when p_issued_day is null
          then p_sig = public.bill_signature(p_building_id, p_unit_no, p_period)
          else p_sig = public.bill_signature(
            p_building_id,
            p_unit_no,
            p_period,
            p_issued_day
          )
        end
      ) as ok
  )
  select
    bc.period,
    b.name,
    u.unit_no,
    case when now() < exp.expires_at then bc.total_amount else null end,
    case when now() < exp.expires_at then coalesce(pay.paid_amount, 0)::int else null end,
    case
      when now() < exp.expires_at
      then greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int
      else null
    end,
    case
      when now() < exp.expires_at
      then round(
        greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate / 100.0
      )::int
      else null
    end,
    case when now() < exp.expires_at then issue.due_date else null end,
    case
      when now() < exp.expires_at
      then coalesce(charges.items, '[]'::jsonb)
      else null
    end,
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
    on u.building_id = b.id
   and u.unit_no = p_unit_no
   and u.deleted_at is null
  join public.billing_confirmations bc
    on bc.unit_id = u.id
   and bc.period = p_period
   and bc.confirmed_at is not null
  left join public.setup_config sc on sc.org_id = b.org_id
  cross join lateral public.bill_carryover(u.id, bc.period) co
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from public.payments p
    where p.unit_id = u.id
      and p.period = bc.period
      and p.status = 'active'
  ) pay on true
  left join lateral (
    select bi.due_date
    from public.bill_issues bi
    where bi.unit_id = u.id
      and bi.period = bc.period
    order by bi.issued_at desc, bi.id desc
    limit 1
  ) issue on true
  left join lateral (
    select case
      when p_issued_day is not null
      then (
        to_timestamp(p_issued_day::double precision * 86400)
          + interval '30 days'
      )::timestamptz
      -- This legacy branch exists only for links issued before 0175 and can
      -- be removed once the longest legacy window has passed. It preserves
      -- the exact 0149 due-date-or-period-month-start expiry rule.
      else (
        coalesce(issue.due_date, date_trunc('month', p_period)::date)
          + interval '1 month'
      )::timestamptz
    end as expires_at
  ) exp on true
  left join lateral (
    select coalesce(sum(
      (
        select t.monthly_rate
        from public.late_fee_rate_tiers t
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
        'name', fi.name,
        'amount', fic.amount,
        'utility', util.u,
        'usage', mr.usage,
        'prev_usage', prev.usage
      ) order by fi.sort_order, fi.id
    ) as items
    from public.fee_item_charges fic
    join public.fee_items fi on fi.id = fic.fee_item_id
    cross join lateral (
      select case
        when fi.name like '%수도%' then 'water'
        when fi.name like '%전기%' then 'elec'
        when fi.name like '%가스%' then 'gas'
        else null
      end as u
    ) util
    left join public.meter_readings mr
      on mr.unit_id = fic.unit_id
     and mr.period = fic.period
     and mr.utility = util.u
    left join public.meter_readings prev
      on prev.unit_id = fic.unit_id
     and prev.period = (fic.period - interval '1 month')::date
     and prev.utility = util.u
    where fic.unit_id = u.id
      and fic.period = bc.period
      and fic.charged = true
  ) charges on true
  where sig.ok;
$function$;

create function public.public_bill_by_signed(
  p_building_id bigint, p_unit_no text, p_period date, p_sig text
)
returns table(
  period date, building_name text, unit_no text,
  total_amount integer, paid_amount integer, unpaid_amount integer, late_fee integer,
  due_date date, items jsonb, mgmt_bank text, mgmt_acct text, mgmt_holder text,
  expires_at timestamp with time zone, is_expired boolean,
  carryover_unpaid integer, carryover_late_fee integer
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select *
  from public.public_bill_by_signed(p_building_id, p_unit_no, p_period, p_sig, null::integer);
$function$;

revoke execute on function public.public_bill_by_signed(bigint, text, date, text, integer) from public;
revoke execute on function public.public_bill_by_signed(bigint, text, date, text) from public;
grant execute on function public.public_bill_by_signed(bigint, text, date, text, integer) to anon, authenticated, service_role;
grant execute on function public.public_bill_by_signed(bigint, text, date, text) to anon, authenticated, service_role;

-- 0351: QA #31 리뷰 수정(Fix round 1)
--  1) 이사정산: 퇴실월 고지에 적용된 전월과수납은 그 달 고지가 일할 관리비로 대체되므로 환급 잔액으로 되돌린다.
--     (입주월 이전 달에 적용된 분도 같은 이유로 되돌린다 — settlement 미납 범위와 대칭)
--  2) 여러 달 배분: 입주월 이전 고지(settlement 미납 범위 밖)는 배분 대상에서 뺀다. 기존 수납 데이터는 바꾸지 않는다.
--  3) list_billing: 전월과수납이 적용된 달의 당월계가 확정 스냅샷과 달라지면(set_billing_override) is_dirty=true(재확정 필요).

create or replace function public.allocate_payment_excess(p_payment_id bigint)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_pay record; v_excess integer; v_left integer; v_q record; v_paid bigint; v_principal integer;
  v_lf integer; v_due integer; v_take integer; v_split_total integer;
  v_alloc_periods date[] := '{}'; v_alloc_amounts integer[] := '{}'; v_alloc_kinds text[] := '{}';
  v_sum integer := 0; i int;
begin
  select p.* into v_pay from payments p
   where p.id = p_payment_id and p.status = 'active' and p.late_fee_split_id is null
   for update;
  if not found or v_pay.occupancy_id is null then return 0; end if;

  v_excess := overpayment_excess(v_pay.unit_id, v_pay.period);
  v_left := least(v_excess, v_pay.amount);
  if v_left <= 0 then return 0; end if;

  for v_q in
    select bc.period, bc.total_amount, bc.late_fee_override
      from billing_confirmations bc
      join occupancies o on o.id = bc.occupancy_id
     where bc.unit_id = v_pay.unit_id and bc.occupancy_id = v_pay.occupancy_id
       and bc.period < v_pay.period and bc.confirmed_at is not null
       -- 0351: 이사정산(settlement_billing_unpaid)과 같은 범위 — 입주월 이전 고지는 배분하지 않는다.
       and (o.move_in_date is null or bc.period >= date_trunc('month', o.move_in_date)::date)
     order by bc.period
  loop
    exit when v_left <= 0;
    select coalesce(sum(p.amount), 0) into v_paid from payments p
     where p.unit_id = v_pay.unit_id and p.period = v_q.period and p.status = 'active'
       and p.late_fee_split_id is null and p.occupancy_id = v_pay.occupancy_id;
    v_principal := greatest(v_q.total_amount - v_paid, 0)::int;
    continue when v_principal <= 0;
    select coalesce(s.split_total, 0) into v_split_total from late_fee_split_balance(v_pay.unit_id, v_q.period) s;
    v_lf := case when v_q.late_fee_override is not null then greatest(v_q.late_fee_override - v_split_total, 0)
                 else greatest(overpay_late_fee(v_pay.unit_id, v_q.period, v_principal, v_pay.paid_at) - v_split_total, 0) end;
    v_due := v_principal + v_lf;
    v_take := least(v_due, v_left);
    v_alloc_periods := array_append(v_alloc_periods, v_q.period);
    v_alloc_amounts := array_append(v_alloc_amounts, v_take);
    v_alloc_kinds := array_append(v_alloc_kinds, case when v_take < v_due then 'partial' else 'full' end);
    v_left := v_left - v_take;
    v_sum := v_sum + v_take;
  end loop;

  if v_sum <= 0 then return 0; end if;

  for i in 1 .. coalesce(array_length(v_alloc_periods, 1), 0) loop
    if i = 1 and v_sum = v_pay.amount then
      -- 수납 전체가 초과분이면 이 행을 가장 오래된 미납 달로 옮긴다.
      update payments
         set period = v_alloc_periods[1], amount = v_alloc_amounts[1], kind = v_alloc_kinds[1],
             memo = left(concat_ws(' ', nullif(v_pay.memo, ''), to_char(v_pay.period, 'YYYY-MM') || ' 입금 배분'), 500)
       where id = v_pay.id;
    else
      insert into payments(org_id, unit_id, period, occupancy_id, amount, fee, method, kind, memo, paid_at, source, created_by, deposit_type)
        values (v_pay.org_id, v_pay.unit_id, v_alloc_periods[i], v_pay.occupancy_id, v_alloc_amounts[i], 0,
                v_pay.method, v_alloc_kinds[i], to_char(v_pay.period, 'YYYY-MM') || ' 입금 배분',
                v_pay.paid_at, 'manual', auth.uid(), v_pay.deposit_type);
    end if;
  end loop;
  if v_sum < v_pay.amount then
    update payments set amount = v_pay.amount - v_sum where id = v_pay.id;
  end if;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_pay.org_id, auth.uid(), 'PAYMENT_ALLOCATE', 'payments', v_pay.id::text,
      jsonb_build_object('unit_id', v_pay.unit_id, 'period', v_pay.period, 'allocated', v_sum,
                         'periods', to_jsonb(v_alloc_periods), 'amounts', to_jsonb(v_alloc_amounts)));
  return v_sum;
end;
$function$;

revoke all on function public.allocate_payment_excess(bigint) from public, anon, authenticated;

create or replace function public.list_billing(p_building_id bigint, p_period date)
 returns table(unit_id bigint, unit_no text, dong text, room_type_label text, occupancy_id bigint, tenant_name text, move_in_date date, is_vacant boolean, fee_item_id bigint, fee_item_name text, carry_over boolean, daily_proration boolean, rounding text, is_required boolean, sort_order integer, charged boolean, amount integer, confirmed_at timestamp with time zone, confirmed_by_name text, total_amount integer, billing_note text, unit_notice text, is_dirty boolean, area_pyeong numeric, mgmt_fee_amount bigint, system_code text)
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
  ),
  -- 0350: 이 달 전월과수납 적용분과, 적용 후 원 과수납이 취소·감액돼 재확정이 필요한 세대
  credit as (
    select a.unit_id,
           sum(a.amount)::int as applied,
           bool_or(o.status = 'canceled'
                   or o.amount < (select sum(a2.amount) from unit_overpayment_applications a2 where a2.overpayment_id = o.id)) as stale
      from unit_overpayment_applications a
      join unit_overpayments o on o.id = a.overpayment_id
     where a.applied_period = p_period and a.unit_id in (select id from u)
     group by a.unit_id
  )
  select
    u.id, u.unit_no, u.dong, rt.label,
    occ.occupancy_id, occ.tenant_name, occ.move_in_date,
    coalesce(occ.status = 'vacant', true) as is_vacant,
    fi.id, fi.name, fi.carry_over, fi.daily_proration, fi.rounding, fi.is_required, fi.sort_order,
    case when fi.system_code is not null then true else coalesce(fic.charged, true) end as charged,
    case
      when fi.system_code is not null then
        -- 0350: 확정된 달은 적용분, 미확정은 차감 예정 잔액(확정 때 그 달 합계 한도로 줄어든다)
        case when bc.confirmed_at is not null then -coalesce(cr.applied, 0)
             else -overpayment_available(u.id, occ.occupancy_id, p_period) end
      else coalesce(
        -- 0326: 필수 공과금은 공과금 화면 부과액 우선
        case when fi.is_required then billing_utility_default(u.id, p_period, fi.is_required, fi.name) end,
        fic.amount,
        billing_utility_default(u.id, p_period, fi.is_required, fi.name),
        -- 0324: 필수 공과금은 이월하지 않는다(원천 = 공과금 화면 부과액).
        case when fi.carry_over and not fi.is_required then prev.amount else 0 end,
        0
      )
    end as amount,
    bc.confirmed_at, pr.full_name as confirmed_by_name, bc.total_amount,
    bc.billing_note, bc.unit_notice,
    coalesce(bc.confirmed_at is not null and (
      exists (
        select 1 from fee_item_charges x
        where x.unit_id = u.id and x.period = p_period and x.updated_at > bc.confirmed_at
      )
      or ud.unit_id is not null
      or coalesce(cr.stale, false)
      -- 0351: 전월과수납이 적용된 달의 당월계를 확정 후 직접 바꾼 경우(수납 이력 당월계 입력) — 차감이 어긋나므로 재확정 필요
      or (cr.unit_id is not null and bc.total_amount is distinct from (
            select h.total_amount from billing_history h
             where h.unit_id = u.id and h.period = p_period
             order by h.confirmed_at desc, h.id desc limit 1))
    ), false) as is_dirty,
    u.area_pyeong,
    occ.mgmt_fee_amount,
    fi.system_code
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
  left join credit cr on cr.unit_id = u.id
  order by u.unit_no, fi.sort_order
$function$;
revoke all on function public.list_billing(bigint, date) from public, anon;
grant execute on function public.list_billing(bigint, date) to authenticated, service_role;

create or replace function public.settlement_billing_unpaid(p_unit_id bigint, p_occupancy_id bigint, p_move_out date default null::date)
 returns bigint
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
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
      bc.late_fee_override,
      greatest(0, bc.total_amount - coalesce(sum(p.amount) filter (where p.status = 'active' and p.late_fee_split_id is null), 0))::bigint as principal
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
      lfs.split_total,
      lfs.split_unpaid,
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
        public.billing_default_due_date(pp.unit_id, pp.period)
      ) as due_date
    from per_period pp
    cross join lateral late_fee_split_balance(pp.unit_id, pp.period) lfs
  ),
  unpaid as (
    select coalesce(sum(
      d.principal
      + d.split_unpaid
      + greatest(case when d.principal > 0 then coalesce(d.late_fee_override, round(
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
        else 0 end - d.split_total, 0)
    ), 0)::bigint as amount
    from dated d
    where d.due_date < (timezone('Asia/Seoul', now()))::date
      and (p_move_out is null or d.period <> date_trunc('month', p_move_out)::date)
  ),
  -- 0350: 이 입주 건의 아직 차감되지 않은 과수납 잔액(환급 대상)
  -- 0351: 위 미납 범위에 들어간 달(입주월 이후·퇴실월 제외)의 고지에서 차감된 금액만 '사용됨'으로 본다.
  --       퇴실월 고지는 일할 관리비(①, 전월과수납 제외)로 대체되므로 그 달에 적용된 전월과수납은 환급으로 돌려준다.
  credit as (
    select coalesce(sum(greatest(o.amount - coalesce((
             select sum(a.amount) from unit_overpayment_applications a
              where a.overpayment_id = o.id
                and (p_move_out is null or a.applied_period <> date_trunc('month', p_move_out)::date)
                and (occ.move_in_month is null or a.applied_period >= occ.move_in_month)), 0), 0)), 0)::bigint as amount
      from unit_overpayments o
      cross join occ
     where o.unit_id = p_unit_id and o.occupancy_id = p_occupancy_id
       and o.amount > 0 and o.status in ('open', 'applied')
  )
  select unpaid.amount - credit.amount from unpaid, credit
$function$;

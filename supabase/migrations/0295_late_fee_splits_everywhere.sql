-- 수.연 연체료 미수금(0292)을 미납·연체료를 계산하는 나머지 화면에도 반영 (0293 미납관리 후속)
--
-- 규칙(수납 이력 · 미납관리와 동일):
--   미납 원금   = 당월계 − 연체료 수납(payments.late_fee_split_id)을 뺀 수납 합계
--   그 달 연체료 = max(자동/수동 연체료 − 나눈 연체료 합계, 0) + 아직 받지 못한 연체료 미수금
--   원금을 다 냈어도 연체료 미수금이 남은 달은 미납으로 본다.
-- 수동 연체료(0291 late_fee_override)도 고지서 이월·이사정산·파트너 카드에 같이 맞춘다.
--
-- 0) late_fee_split_balance(unit, period) — 그 달 나눈 연체료 합계·미수금
-- 1) bill_carryover · bill_document_extras        — 고지서 이월 미납/연체료, 당월 연체료
-- 2) resident_bill_months · resident_bill_detail  — 세입자 관리비 내역·상세
--    public_bill_by_signed                         — 고지서 공유 링크
-- 3) settlement_billing_unpaid(2개) · complete_moving_settlement — 이사정산 미납·자동수납
-- 4) count_overdue_households                      — 대시보드 미납 세대 수
-- 5) list_bill_targets                             — 고지서 대상(단수 대상 판정)
-- 6) partner_list_meter_cards · partner_list_unit_payments — 파트너 검침 카드 미납·입주자 수납 내역

create or replace function public.late_fee_split_balance(p_unit_id bigint, p_period date)
 returns table(split_total integer, split_unpaid integer)
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  select
    coalesce(sum(s.amount), 0)::int,
    coalesce(sum(greatest(s.amount - coalesce((
      select sum(p.amount) from payments p
       where p.late_fee_split_id = s.id and p.status = 'active'
    ), 0), 0)), 0)::int
  from payment_late_fee_splits s
  where s.unit_id = p_unit_id and s.period = p_period and s.status = 'active'
$function$;
comment on function public.late_fee_split_balance(bigint, date) is '수.연 연체료 미수금: 그 달 나눈 금액 합계(split_total)·아직 받지 못한 금액(split_unpaid)';
revoke all on function public.late_fee_split_balance(bigint, date) from public, anon;
grant execute on function public.late_fee_split_balance(bigint, date) to authenticated, service_role;

-- 1-a) bill_carryover: 전월까지 이월 미납 원금·연체료
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
            and p.late_fee_split_id is null
        ), 0)::bigint,
        0::bigint
      ) as outstanding,
      coalesce(
        bps.due_date,
        public.billing_default_due_date(bc.unit_id, bc.period)
      ) as due_date,
      bc.late_fee_override,
      lfs.split_total,
      lfs.split_unpaid
    from cur
    join billing_confirmations bc
      on bc.unit_id = p_unit_id
     and bc.occupancy_id = cur.occupancy_id
     and bc.period < p_period
     and bc.confirmed_at is not null
    left join billing_period_settings bps
      on bps.building_id = cur.building_id
     and bps.period = bc.period
    cross join lateral late_fee_split_balance(bc.unit_id, bc.period) lfs
  ),
  fee as (
    select
      pr.outstanding,
      greatest(coalesce(
        case when pr.outstanding > 0 then pr.late_fee_override end,
        case
          when coalesce(sc.late_fee_enabled, true) and coalesce(o.late_fee_enabled, true)
          then round(pr.outstanding * (
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
        end
      ) - pr.split_total, 0) + pr.split_unpaid as late_fee
    from prior pr
    cross join cur
    left join setup_config sc on sc.org_id = cur.org_id
    left join occupancies o on o.id = cur.occupancy_id
    where pr.outstanding > 0 or pr.split_unpaid > 0
  )
  select coalesce(sum(outstanding), 0)::int, coalesce(sum(late_fee), 0)::int
  from fee;
$function$;

do $migration$
declare
  v_def text;
  v_new text;

begin
  -- 1-b) bill_document_extras: 당월 연체료
  v_def := pg_get_functiondef('public.bill_document_extras(bigint,date)'::regprocedure);
  if position('late_fee_split_balance' in v_def) = 0 then
    v_new := replace(v_def,
      E'    coalesce(round(\n      greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate * late_fee_factor(b.org_id, bc.occupancy_id) / 100.0\n    ), 0)::int as late_fee,',
      E'    (greatest(coalesce(\n      case when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0 then bc.late_fee_override end,\n      round(\n      greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate * late_fee_factor(b.org_id, bc.occupancy_id) / 100.0\n    ), 0) - lfs.split_total, 0) + lfs.split_unpaid)::int as late_fee,');
    v_new := replace(v_new,
      E'  cross join lateral bill_carryover(bc.unit_id, bc.period) co\n',
      E'  cross join lateral bill_carryover(bc.unit_id, bc.period) co\n  cross join lateral late_fee_split_balance(bc.unit_id, bc.period) lfs\n');
    v_new := replace(v_new,
      E'      and p.period = bc.period\n      and p.status = ''active''\n  ) pay on true',
      E'      and p.period = bc.period\n      and p.status = ''active''\n      and p.late_fee_split_id is null\n  ) pay on true');
    if (length(v_new) - length(replace(v_new, 'lfs.split', ''))) / length('lfs.split') <> 2
       or position('late_fee_split_balance' in v_new) = 0
       or position('p.late_fee_split_id is null' in v_new) = 0 then
      raise exception 'bill_document_extras patch failed';
    end if;
    execute v_new;
  end if;

  -- 2-a) resident_bill_months
  v_def := pg_get_functiondef('public.resident_bill_months()'::regprocedure);
  if position('late_fee_split_balance' in v_def) = 0 then
    v_new := replace(v_def,
      E'      bc.late_fee_override,\n',
      E'      bc.late_fee_override,\n      lfs.split_total,\n      lfs.split_unpaid,\n');
    v_new := replace(v_new,
      E'        and p.status = ''active''\n    ) pay on true',
      E'        and p.status = ''active''\n        and p.late_fee_split_id is null\n    ) pay on true\n    cross join lateral late_fee_split_balance(l.unit_id, bc.period) lfs');
    v_new := replace(v_new,
      'coalesce(case when s.unpaid_amount > 0 then s.late_fee_override end, round(s.unpaid_amount * lf.cumulative_rate * late_fee_factor(s.org_id, s.occupancy_id) / 100.0)::int) as late_fee',
      '(greatest(coalesce(case when s.unpaid_amount > 0 then s.late_fee_override end, round(s.unpaid_amount * lf.cumulative_rate * late_fee_factor(s.org_id, s.occupancy_id) / 100.0)::int) - s.split_total, 0) + s.split_unpaid)::int as late_fee');
    v_new := replace(v_new,
      E'      when s.total_amount > 0 and s.unpaid_amount = 0 then ''paid''',
      E'      when s.total_amount > 0 and s.unpaid_amount = 0 and s.split_unpaid > 0 then ''partial''\n      when s.total_amount > 0 and s.unpaid_amount = 0 then ''paid''');
    if (length(v_new) - length(replace(v_new, 'split_unpaid', ''))) / length('split_unpaid') <> 3
       or position('p.late_fee_split_id is null' in v_new) = 0 then
      raise exception 'resident_bill_months patch failed';
    end if;
    execute v_new;
  end if;

  -- 2-b) resident_bill_detail
  v_def := pg_get_functiondef('public.resident_bill_detail(date)'::regprocedure);
  if position('late_fee_split_balance' in v_def) = 0 then
    v_new := replace(v_def,
      E'    coalesce(\n      case when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0 then bc.late_fee_override end,',
      E'    (greatest(coalesce(\n      case when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0 then bc.late_fee_override end,');
    v_new := replace(v_new,
      E'    )::int) as late_fee,',
      E'    )::int) - lfs.split_total, 0) + lfs.split_unpaid)::int as late_fee,');
    v_new := replace(v_new,
      E'  cross join lateral bill_carryover(l.unit_id, bc.period) co\n',
      E'  cross join lateral bill_carryover(l.unit_id, bc.period) co\n  cross join lateral late_fee_split_balance(l.unit_id, bc.period) lfs\n');
    v_new := replace(v_new,
      E'      and p.status = ''active''\n  ) pay on true',
      E'      and p.status = ''active''\n      and p.late_fee_split_id is null\n  ) pay on true');
    if (length(v_new) - length(replace(v_new, 'lfs.split', ''))) / length('lfs.split') <> 2
       or position('late_fee_split_balance' in v_new) = 0
       or position('p.late_fee_split_id is null' in v_new) = 0 then
      raise exception 'resident_bill_detail patch failed';
    end if;
    execute v_new;
  end if;

  -- 2-c) public_bill_by_signed
  v_def := pg_get_functiondef('public.public_bill_by_signed(bigint,text,date,text,integer)'::regprocedure);
  if position('late_fee_split_balance' in v_def) = 0 then
    v_new := replace(v_def,
      'then coalesce(case when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0 then bc.late_fee_override end,',
      'then (greatest(coalesce(case when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0 then bc.late_fee_override end,');
    v_new := replace(v_new,
      '* lf.cumulative_rate * public.late_fee_factor(b.org_id, bc.occupancy_id) / 100.0)::int) else null end,',
      '* lf.cumulative_rate * public.late_fee_factor(b.org_id, bc.occupancy_id) / 100.0)::int) - lfs.split_total, 0) + lfs.split_unpaid)::int else null end,');
    v_new := replace(v_new,
      E'  cross join lateral public.bill_carryover(u.id, bc.period) co\n',
      E'  cross join lateral public.bill_carryover(u.id, bc.period) co\n  cross join lateral public.late_fee_split_balance(u.id, bc.period) lfs\n');
    v_new := replace(v_new,
      'where p.unit_id = u.id and p.period = bc.period and p.status = ''active''',
      'where p.unit_id = u.id and p.period = bc.period and p.status = ''active'' and p.late_fee_split_id is null');
    if (length(v_new) - length(replace(v_new, 'lfs.split', ''))) / length('lfs.split') <> 2
       or position('late_fee_split_balance' in v_new) = 0
       or position('p.late_fee_split_id is null' in v_new) = 0 then
      raise exception 'public_bill_by_signed patch failed';
    end if;
    execute v_new;
  end if;

  -- 3-a) settlement_billing_unpaid(unit, occupancy): 이사정산 ③ 미납(원금+연체료)
  v_def := pg_get_functiondef('public.settlement_billing_unpaid(bigint,bigint)'::regprocedure);
  if position('late_fee_split_balance' in v_def) = 0 then
    v_new := replace(v_def,
      'filter (where p.status = ''active'')',
      'filter (where p.status = ''active'' and p.late_fee_split_id is null)');
    v_new := replace(v_new,
      E'      b.org_id,\n      greatest(0,',
      E'      b.org_id,\n      bc.late_fee_override,\n      greatest(0,');
    v_new := replace(v_new,
      E'      pp.*,\n',
      E'      pp.*,\n      lfs.split_total,\n      lfs.split_unpaid,\n');
    v_new := replace(v_new,
      E'    from per_period pp\n  )',
      E'    from per_period pp\n    cross join lateral late_fee_split_balance(pp.unit_id, pp.period) lfs\n  )');
    v_new := replace(v_new,
      E'    d.principal\n    + case when d.principal > 0 then coalesce(round(',
      E'    d.principal\n    + d.split_unpaid\n    + greatest(case when d.principal > 0 then coalesce(d.late_fee_override, round(');
    v_new := replace(v_new,
      E'      else 0 end\n  ), 0)::bigint',
      E'      else 0 end - d.split_total, 0)\n  ), 0)::bigint');
    if position('d.split_total' in v_new) = 0 or position('d.split_unpaid' in v_new) = 0
       or position('lfs.split_unpaid' in v_new) = 0 or position('d.late_fee_override' in v_new) = 0
       or position('bc.late_fee_override' in v_new) = 0
       or position('p.late_fee_split_id is null' in v_new) = 0 then
      raise exception 'settlement_billing_unpaid(bigint,bigint) patch failed';
    end if;
    execute v_new;
  end if;

  -- 3-b) settlement_billing_unpaid(unit): 원금만
  v_def := pg_get_functiondef('public.settlement_billing_unpaid(bigint)'::regprocedure);
  if position('late_fee_split_id' in v_def) = 0 then
    v_new := replace(v_def,
      'filter (where p.status = ''active'')',
      'filter (where p.status = ''active'' and p.late_fee_split_id is null)');
    if v_new = v_def then raise exception 'settlement_billing_unpaid(bigint) patch failed'; end if;
    execute v_new;
  end if;

  -- 3-c) complete_moving_settlement: 자동수납 원금 = 연체료 수납을 뺀 잔액
  v_def := pg_get_functiondef('public.complete_moving_settlement(bigint)'::regprocedure);
  if position('late_fee_split_id' in v_def) = 0 then
    v_new := replace(v_def,
      'filter (where p.status = ''active'')',
      'filter (where p.status = ''active'' and p.late_fee_split_id is null)');
    if (length(v_new) - length(replace(v_new, 'late_fee_split_id', ''))) / length('late_fee_split_id') <> 2 then
      raise exception 'complete_moving_settlement patch failed';
    end if;
    execute v_new;
  end if;

  -- 4) count_overdue_households: 원금 또는 연체료 미수금이 남은 세대
  v_def := pg_get_functiondef('public.count_overdue_households(integer,integer)'::regprocedure);
  if position('late_fee_split' in v_def) = 0 then
    v_new := replace(v_def, E'\r\n', E'\n');
    v_new := replace(v_new,
      E'     and payment.status = ''active''\n    where confirmation.confirmed_at',
      E'     and payment.status = ''active''\n     and payment.late_fee_split_id is null\n    where confirmation.confirmed_at');
    v_new := replace(v_new,
      E'      ) as outstanding\n',
      E'      ) as outstanding,\n      (select balance.split_unpaid\n         from public.late_fee_split_balance(confirmation.unit_id, confirmation.period) balance) as split_unpaid\n');
    v_new := replace(v_new,
      'having sum(period_balance.outstanding) > 0',
      'having sum(period_balance.outstanding) > 0 or sum(period_balance.split_unpaid) > 0');
    if position('payment.late_fee_split_id is null' in v_new) = 0
       or position('as split_unpaid' in v_new) = 0
       or position('sum(period_balance.split_unpaid)' in v_new) = 0 then
      raise exception 'count_overdue_households patch failed';
    end if;
    execute v_new;
  end if;

  -- 5) list_bill_targets: 단수 대상(전월 미납 원금) 판정
  v_def := pg_get_functiondef('public.list_bill_targets(bigint,date)'::regprocedure);
  if position('late_fee_split_id' in v_def) = 0 then
    v_new := replace(v_def,
      'and pay.period = pbc.period and pay.status = ''active''',
      'and pay.period = pbc.period and pay.status = ''active'' and pay.late_fee_split_id is null');
    if v_new = v_def then raise exception 'list_bill_targets patch failed'; end if;
    execute v_new;
  end if;

  -- 6-a) partner_list_meter_cards: 미납 월 목록에 연체료 미수금·수동 연체료 포함
  v_def := pg_get_functiondef('public.partner_list_meter_cards(bigint,date)'::regprocedure);
  if position('late_fee_split' in v_def) = 0 then
    v_new := replace(v_def,
      E'         and p.status = ''active''\n        where bc.occupancy_id = u.occupancy_id',
      E'         and p.status = ''active''\n         and p.late_fee_split_id is null\n        where bc.occupancy_id = u.occupancy_id');
    v_new := replace(v_new,
      E'          bc.period,\n          greatest(bc.total_amount::bigint - coalesce(sum(p.amount), 0)::bigint, 0::bigint) as outstanding',
      E'          bc.period,\n          bc.late_fee_override,\n          greatest(bc.total_amount::bigint - coalesce(sum(p.amount), 0)::bigint, 0::bigint) as outstanding');
    v_new := replace(v_new,
      E'        group by bc.period, bc.total_amount\n      ) pb\n',
      E'        group by bc.period, bc.total_amount, bc.late_fee_override\n      ) pb\n      cross join lateral late_fee_split_balance(u.id, pb.period) lfs\n');
    v_new := replace(v_new,
      E'          ''late_fee_enabled'', coalesce(u.late_fee_enabled, true)\n',
      E'          ''late_fee_enabled'', coalesce(u.late_fee_enabled, true),\n          ''late_fee_override'', pb.late_fee_override,\n          ''late_fee_split_total'', lfs.split_total,\n          ''late_fee_split_unpaid'', lfs.split_unpaid\n');
    v_new := replace(v_new,
      E'      where pb.outstanding > 0\n    ), ''[]''::jsonb)',
      E'      where pb.outstanding > 0 or lfs.split_unpaid > 0\n    ), ''[]''::jsonb)');
    if (length(v_new) - length(replace(v_new, 'lfs.split', ''))) / length('lfs.split') <> 3
       or position('p.late_fee_split_id is null' in v_new) = 0
       or position('pb.late_fee_override' in v_new) = 0
       or position('late_fee_split_balance' in v_new) = 0 then
      raise exception 'partner_list_meter_cards patch failed';
    end if;
    execute v_new;
  end if;

  -- 6-b) partner_list_unit_payments: 수납(원금) = 연체료 수납 제외 → 미납 원금이 수납 이력과 같게
  v_def := pg_get_functiondef('public.partner_list_unit_payments(bigint,date,integer)'::regprocedure);
  if position('late_fee_split_id' in v_def) = 0 then
    v_new := replace(v_def,
      'sum(payment.amount)::integer as paid,',
      '(sum(payment.amount) filter (where payment.late_fee_split_id is null))::integer as paid,');
    if v_new = v_def then raise exception 'partner_list_unit_payments patch failed'; end if;
    execute v_new;
  end if;
end
$migration$;

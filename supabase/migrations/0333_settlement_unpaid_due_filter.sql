-- 0333 (QA #48): 이사정산 ③ 미납 소계 = 납기 경과분만, 퇴실월 제외.
--  * 기준일 = KST 오늘. due_date < 기준일 인 period 만 합산(연체료는 포함된 행에만 기존 식 그대로).
--  * 퇴실월(period = date_trunc('month', 퇴실일)) 은 ② 관리비에서 일할 계산되므로 제외(이중 계상 방지).
--  * 헬퍼에 p_move_out 인자 추가(2-arg 는 3-arg 로 대체). 4개 RPC 의 호출부는 라이브 정의를 치환해 퇴실일을 전달.
begin;

drop function if exists public.settlement_billing_unpaid(bigint, bigint);

create or replace function public.settlement_billing_unpaid(
  p_unit_id bigint, p_occupancy_id bigint, p_move_out date default null)
returns bigint
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  -- ③ = Σ(정산 occupancy·입주월 이후 확정 부과 period 중 납기 < KST 오늘 이고 퇴실월이 아닌 것) [ max(0, 부과액 − 유효수납) + 연체료 ]
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
  )
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
  ), 0)::bigint
  from dated d
  where d.due_date < (timezone('Asia/Seoul', now()))::date
    and (p_move_out is null or d.period <> date_trunc('month', p_move_out)::date)
$function$;

-- 호출부 치환(라이브 정의 기준). 치환 대상이 없으면 예외로 중단.
do $do$
declare
  r record;
  v_def text;
  v_new text;
begin
  for r in
    select * from (values
      ('public.save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb)'::regprocedure,
        'settlement_billing_unpaid(p_unit_id, p_occupancy_id)',
        'settlement_billing_unpaid(p_unit_id, p_occupancy_id, nullif(p_data->>''move_out_date'','''')::date)'),
      ('public.partner_save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb)'::regprocedure,
        'settlement_billing_unpaid(p_unit_id, p_occupancy_id)',
        'settlement_billing_unpaid(p_unit_id, p_occupancy_id, nullif(p_data->>''move_out_date'','''')::date)'),
      ('public.get_settlement_context(bigint,bigint)'::regprocedure,
        'coalesce((v_settlement->>''occupancy_id'')::bigint, (v_occupancy->>''id'')::bigint));',
        'coalesce((v_settlement->>''occupancy_id'')::bigint, (v_occupancy->>''id'')::bigint), nullif(v_settlement->>''move_out_date'','''')::date);'),
      ('public.partner_get_settlement_context(bigint,bigint)'::regprocedure,
        'settlement_billing_unpaid(p_unit_id, (v_occupancy->>''id'')::bigint)',
        'settlement_billing_unpaid(p_unit_id, (v_occupancy->>''id'')::bigint, nullif(v_settlement->>''move_out_date'','''')::date)')
    ) t(fn, old_s, new_s)
  loop
    v_def := pg_get_functiondef(r.fn);
    if position(r.old_s in v_def) = 0 then
      raise exception 'patch target not found in %', r.fn;
    end if;
    v_new := replace(v_def, r.old_s, r.new_s);
    execute v_new;
  end loop;
end
$do$;

commit;

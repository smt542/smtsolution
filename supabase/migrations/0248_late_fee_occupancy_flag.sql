-- 연체료 계산에 조직·세대 연체료 설정을 반영한다.
--  - 정책(부과·정산 계산 규칙 3, 셋업 설정): 조직 연체 설정 on/off, 세대별 연체료 부과 여부(O/X)로 대상 제어.
--  - 입주민 고지서(월 목록·상세·공유 링크)의 연체료와 파트너 검침 카드의 미납 정보가 이 설정을 보지 않았다.
--  - late_fee_factor(org, occupancy): 둘 다 사용이면 1, 하나라도 미사용이면 0. 연체료 식에 곱한다.
--  - partner_list_meter_cards: 미납 월마다 late_fee_enabled(입주 설정)를 함께 돌려준다(화면 계산이 반영).

create or replace function public.late_fee_factor(p_org_id bigint, p_occupancy_id bigint)
returns integer
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select case
    when coalesce((select sc.late_fee_enabled from setup_config sc where sc.org_id = p_org_id), true)
     and coalesce((select o.late_fee_enabled from occupancies o where o.id = p_occupancy_id), true)
    then 1 else 0
  end;
$function$;

revoke execute on function public.late_fee_factor(bigint, bigint) from public, anon, authenticated;

-- 상세·공유 링크: 당월 연체료 식에 late_fee_factor 를 곱한다(본문은 0247 정의 그대로).
do $patch$
declare
  v_def text;
  v_new text;
  v_target record;
begin
  for v_target in
    select * from (values
      ('public.resident_bill_detail(date)', 'l.org_id'),
      ('public.public_bill_by_signed(bigint,text,date,text,integer)', 'b.org_id')
    ) as t(sig, org_expr)
  loop
    v_def := pg_get_functiondef(v_target.sig::regprocedure);
    if position('late_fee_factor' in v_def) > 0 then continue; end if;
    v_new := replace(
      v_def,
      'lf.cumulative_rate / 100.0',
      format('lf.cumulative_rate * late_fee_factor(%s, bc.occupancy_id) / 100.0', v_target.org_expr)
    );
    if (length(v_new) - length(v_def)) <> length(format(' * late_fee_factor(%s, bc.occupancy_id)', v_target.org_expr)) then
      raise exception 'late fee expression not found exactly once in %', v_target.sig;
    end if;
    execute v_new;
  end loop;
end $patch$;

-- 월 목록: 같은 방식으로 각 월 부과의 입주 설정을 반영한다.
create or replace function public.resident_bill_months()
returns table(
  period date, total_amount integer, paid_amount integer, unpaid_amount integer, late_fee integer,
  paid_date date, pay_status text, due_date date, confirmed_at timestamp with time zone
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with linked as (
    select * from resident_linked_unit()
  ), amounts as (
    select
      l.org_id,
      bc.occupancy_id,
      bc.period,
      bc.total_amount,
      coalesce(pay.paid_amount, 0)::int as paid_amount,
      greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int as unpaid_amount,
      pay.paid_date,
      issue.due_date,
      bc.confirmed_at
    from linked l
    join billing_confirmations bc
      on bc.unit_id = l.unit_id
     and bc.confirmed_at is not null
    left join lateral (
      select coalesce(sum(p.amount), 0)::int as paid_amount,
             max(p.paid_at) as paid_date
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
    where l.move_in is not null
      and bc.period >= date_trunc('month', l.move_in)::date
      and (
        l.move_out is null
        or bc.period <= date_trunc('month', l.move_out)::date
      )
  ), scored as (
    select
      a.*,
      case
        when a.unpaid_amount > 0 and a.due_date is not null then
          greatest(
            (extract(year from timezone('Asia/Seoul', now()))::int - extract(year from a.due_date)::int) * 12
            + (extract(month from timezone('Asia/Seoul', now()))::int - extract(month from a.due_date)::int),
            0
          )
        else 0
      end as months_overdue
    from amounts a
  )
  select
    s.period,
    s.total_amount,
    s.paid_amount,
    s.unpaid_amount,
    round(s.unpaid_amount * lf.cumulative_rate * late_fee_factor(s.org_id, s.occupancy_id) / 100.0)::int as late_fee,
    s.paid_date,
    case
      when s.total_amount > 0 and s.unpaid_amount = 0 then 'paid'
      when s.paid_amount > 0 and s.paid_amount < s.total_amount then 'partial'
      when s.paid_amount = 0 and s.total_amount > 0 then 'unpaid'
      else 'none'
    end as pay_status,
    s.due_date,
    s.confirmed_at
  from scored s
  left join lateral (
    -- 누적요율(%) = Σ_{k=1..months_overdue} rateForMonth(k); tier_order 순 첫 매칭
    select coalesce(sum(
      (
        select t.monthly_rate
        from late_fee_rate_tiers t
        where t.org_id = s.org_id
          and k.k > t.from_month
          and (t.to_month is null or k.k <= t.to_month)
        order by t.tier_order
        limit 1
      )
    ), 0)::numeric as cumulative_rate
    from generate_series(1, greatest(s.months_overdue, 0)) as k(k)
  ) lf on true
  order by s.period desc;
$function$;

-- 파트너 검침 카드: 미납 월마다 입주의 연체료 부과 여부를 함께 준다.
create or replace function public.partner_list_meter_cards(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, occupancy_id bigint, move_in_date date, phone text,
  notes jsonb, usage_history jsonb, overdue_periods jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with u as (
    select un.id, o.id as occupancy_id, o.move_in_date, o.phone, o.late_fee_enabled
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
    ), '[]'::jsonb)
  from u
  order by u.id;
$function$;

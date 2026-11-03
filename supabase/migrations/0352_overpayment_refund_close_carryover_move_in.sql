-- 0352: 최종 리뷰 Important 1·2 수정 (QA #31 #22)
--  1) 과수납 원장 환급 마감: 이사정산이 퇴실완료(completed)되면 그 입주 건(occupancy)의 남은 과수납 잔액은
--     이사정산에서 환급된 것이므로 unit_overpayments 를 refunded 로 닫고 정산 건·환급액을 기록한다.
--     퇴실 취소 등으로 completed 를 벗어나거나 정산이 삭제되면 open/applied 로 되돌린다(이중 차감·이중 환급 방지).
--     환급액 = 0351 settlement_billing_unpaid 의 credit 과 같은 식(입주월 이후·퇴실월 제외 달에 적용된 분만 사용됨).
--     완료 후에도 정산 화면의 환급액이 유지되도록 settlement_billing_unpaid 는 refunded 행의 refunded_amount 를 더한다.
--  2) 이월 미납(bill_carryover → resident_bill_carryover·고지서): 0351 배분·이사정산과 같은 입주월 조건
--     (o.move_in_date is null or bc.period >= date_trunc('month', o.move_in_date)) 으로 입주월 이전 고지를 뺀다.
--     직원 미납 목록은 바꾸지 않는다. resident_bill_carryover() 는 그대로(무인자·SECURITY DEFINER·search_path·anon 불가).
-- 기존 데이터 백필 없음(2026-11-02 기준 unit_overpayments 0행, completed 정산과 겹치는 open 원장 0건).

-- ───────────────────────── 1. 원장 환급 컬럼 ─────────────────────────
alter table public.unit_overpayments
  add column if not exists refunded_settlement_id bigint references public.moving_settlements(id) on delete set null,
  add column if not exists refunded_amount integer check (refunded_amount is null or refunded_amount >= 0);

create index if not exists unit_overpayments_refunded_settlement_idx
  on public.unit_overpayments (refunded_settlement_id) where refunded_settlement_id is not null;

comment on column public.unit_overpayments.refunded_settlement_id is
  '0352: 이 과수납 잔액을 환급한 이사정산(퇴실완료). 퇴실 취소·정산 삭제 시 null 로 되돌린다.';
comment on column public.unit_overpayments.refunded_amount is
  '0352: 이사정산으로 환급한 금액(퇴실완료 시점 잔액).';

-- ───────────────────────── 2. 환급 마감 / 되돌리기 ─────────────────────────
create or replace function public.overpayment_mark_refunded(p_settlement_id bigint)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_s record; v_move_in_month date; v_move_out_month date; v_count integer := 0;
begin
  select s.id, s.unit_id, s.occupancy_id, s.move_out_date into v_s
    from moving_settlements s where s.id = p_settlement_id;
  if not found or v_s.occupancy_id is null then return 0; end if;

  select date_trunc('month', o.move_in_date)::date into v_move_in_month
    from occupancies o where o.id = v_s.occupancy_id;
  v_move_out_month := date_trunc('month', v_s.move_out_date)::date;

  with remain as (
    select o.id,
           greatest(o.amount - coalesce((
             select sum(a.amount) from unit_overpayment_applications a
              where a.overpayment_id = o.id
                and (v_move_out_month is null or a.applied_period <> v_move_out_month)
                and (v_move_in_month is null or a.applied_period >= v_move_in_month)), 0), 0)::int as amt
      from unit_overpayments o
     where o.unit_id = v_s.unit_id and o.occupancy_id = v_s.occupancy_id
       and o.amount > 0 and o.status in ('open', 'applied')
     for update of o
  )
  update unit_overpayments o
     set status = 'refunded', refunded_settlement_id = v_s.id, refunded_amount = r.amt
    from remain r
   where o.id = r.id and r.amt > 0;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function public.overpayment_unmark_refunded(p_settlement_id bigint)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_o record; v_count integer := 0;
begin
  for v_o in
    select o.id, o.unit_id, o.source_period from unit_overpayments o
     where o.refunded_settlement_id = p_settlement_id
     for update
  loop
    update unit_overpayments
       set status = 'open', refunded_settlement_id = null, refunded_amount = null
     where id = v_o.id;
    -- 환급 중 고정됐던 금액·상태를 현재 수납 기준으로 다시 계산
    perform sync_unit_overpayment(v_o.unit_id, v_o.source_period);
    perform overpayment_refresh_status(v_o.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

create or replace function public.trg_moving_settlement_overpayment_refund()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'DELETE' then
    perform overpayment_unmark_refunded(old.id);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status = 'completed'
     and (new.status is distinct from 'completed' or new.occupancy_id is distinct from old.occupancy_id) then
    perform overpayment_unmark_refunded(old.id);
  end if;
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed' or new.occupancy_id is distinct from old.occupancy_id) then
    perform overpayment_mark_refunded(new.id);
  end if;
  return null;
end;
$function$;

-- 퇴실완료(complete_moving_settlement)는 status 갱신 직후 reset_occupancy_on_vacate 로 move_in_date 를 지우므로
-- status UPDATE 문 직후 발화하는 AFTER ROW 트리거에서 입주월을 읽는다.
drop trigger if exists moving_settlements_overpayment_refund on public.moving_settlements;
create trigger moving_settlements_overpayment_refund
  after insert or update of status, occupancy_id on public.moving_settlements
  for each row execute function public.trg_moving_settlement_overpayment_refund();

-- 삭제는 FK(on delete set null)보다 먼저 되돌려야 하므로 BEFORE DELETE.
drop trigger if exists moving_settlements_overpayment_unrefund on public.moving_settlements;
create trigger moving_settlements_overpayment_unrefund
  before delete on public.moving_settlements
  for each row execute function public.trg_moving_settlement_overpayment_refund();

revoke all on function public.overpayment_mark_refunded(bigint) from public, anon, authenticated;
revoke all on function public.overpayment_unmark_refunded(bigint) from public, anon, authenticated;
revoke all on function public.trg_moving_settlement_overpayment_refund() from public, anon, authenticated;

-- ───────────────────────── 3. 이사정산 credit: 환급 마감분 유지 ─────────────────────────
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
  -- 0350/0351: 이 입주 건의 아직 차감되지 않은 과수납 잔액(환급 대상)
  -- 0352: 퇴실완료로 환급 마감(refunded)된 분은 마감 시점 환급액을 그대로 보여준다.
  credit as (
    select coalesce(sum(case
             when o.status = 'refunded' then coalesce(o.refunded_amount, 0)
             else greatest(o.amount - coalesce((
               select sum(a.amount) from unit_overpayment_applications a
                where a.overpayment_id = o.id
                  and (p_move_out is null or a.applied_period <> date_trunc('month', p_move_out)::date)
                  and (occ.move_in_month is null or a.applied_period >= occ.move_in_month)), 0), 0)
           end), 0)::bigint as amount
      from unit_overpayments o
      cross join occ
     where o.unit_id = p_unit_id and o.occupancy_id = p_occupancy_id
       and o.amount > 0
       and (o.status in ('open', 'applied')
            or (o.status = 'refunded' and o.refunded_settlement_id is not null))
  )
  select unpaid.amount - credit.amount from unpaid, credit
$function$;

-- ───────────────────────── 4. 이월 미납: 입주월 이전 고지 제외 ─────────────────────────
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
    -- 0352: 0351 배분·이사정산과 같은 범위 — 입주월 이전 고지는 이월하지 않는다.
    join occupancies o on o.id = bc.occupancy_id
     and (o.move_in_date is null or bc.period >= date_trunc('month', o.move_in_date)::date)
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

revoke all on function public.bill_carryover(bigint, date) from public, anon, authenticated;
grant execute on function public.bill_carryover(bigint, date) to service_role;

-- resident_bill_carryover() 0348 보안 속성 재확인(본문 변경 없음)
revoke all on function public.resident_bill_carryover() from public, anon;
grant execute on function public.resident_bill_carryover() to authenticated;

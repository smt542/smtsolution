-- 0350: QA #31 전월과수납 — 과수납 원장 + 전월과수납 시스템 항목 + 익월 자동 차감 + 여러 달 배분.
--
-- 규칙(2026-11-01 QA 반영)
--  1) 과수납 = 그 달 수납 합계(수.연 연결분 제외) − (당월계 + 그 달 연체료).
--     연체료 = 수동 override 우선, 없으면 그 달 원금을 마감한 수납 건의 수납일 기준으로
--     lib/billing/lateFee.ts 와 같은 식(구간 누적요율 + 납기후 가산금, 납기 전이면 0)으로 서버가 계산하고
--     수.연으로 옮긴 연체료(split_total)만큼 뺀다. 연체료 한도 안의 초과는 연체료 수납으로 본다.
--     수.연 미수금에 연결된 수납이 그 미수금을 넘은 금액도 과수납이다.
--  2) 과수납은 (unit, source_period) 한 건으로 unit_overpayments 에 기록되고, payments / billing_confirmations /
--     payment_late_fee_splits 변경 트리거가 그 달 값을 다시 계산한다(0 이하면 canceled).
--  3) confirm_billing(P): 같은 occupancy 의 source_period < P 인 과수납 잔액 전부를 「전월과수납」(음수)로
--     차감하되 그 달 다른 항목 합계를 넘지 않는다(total ≥ 0). 남은 잔액은 다음 확정으로 이월.
--     차감 내역은 unit_overpayment_applications(overpayment, applied_period) 로 남기고, 재확정 때 그 달
--     적용분을 지우고 다시 적용한다(멱등).
--  4) save_payment_history 의 record(수.연 미연결) 수납이 선택한 달의 미납을 넘으면, 넘는 금액을 같은
--     세대(같은 occupancy)의 더 오래된 미납 달부터 별도 payments 행으로 나눠 기록하고 남는 금액만 과수납으로 둔다.
--  5) 「전월과수납」 fee_items(system_code='prev_overpay'): 모든 건물 유형에 1건, 명칭 변경·삭제·필수/이월/일할 불가,
--     금액 직접 입력 불가(fee_item_charges 에 저장되지 않음), 공과금(is_required) 아님.
--  6) 퇴실 세대: 이사정산 미납(settlement_billing_unpaid 3-인자)에서 그 occupancy 의 남은 과수납 잔액을 뺀다(음수=환급).
-- 기존 초과 수납 데이터(2026-07~10)는 백필하지 않는다 — 트리거는 이후 변경된 달부터 원장을 만든다.

-- ───────────────────────── 1. 시스템 항목 ─────────────────────────
alter table public.fee_items add column if not exists system_code text;

alter table public.fee_items drop constraint if exists fee_items_system_code_check;
alter table public.fee_items add constraint fee_items_system_code_check
  check (system_code is null or system_code = 'prev_overpay');

alter table public.fee_items drop constraint if exists fee_items_system_item_locked;
alter table public.fee_items add constraint fee_items_system_item_locked
  check (system_code is null or (deleted_at is null and not is_required and not carry_over and not daily_proration));

create unique index if not exists fee_items_type_system_code_uidx
  on public.fee_items (type_id, system_code) where system_code is not null;

comment on column public.fee_items.system_code is
  '시스템 항목 코드(prev_overpay=전월과수납). 명칭·삭제·필수/이월/일할 잠금, 금액은 confirm_billing 이 자동 산입.';

create or replace function public.ensure_required_utility_fee_items(p_type_id bigint)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org_id bigint;
begin
  select org_id into v_org_id
  from public.building_types
  where id = p_type_id;

  if not found then
    return;
  end if;

  insert into public.fee_items (org_id, type_id, name, rounding, daily_proration, carry_over, is_required, sort_order, deleted_at)
  select v_org_id, p_type_id, required_item.name, 'round'::fee_rounding, false, true, true, required_item.sort_order, null
  from (values ('전기'::text, 0), ('수도료'::text, 1), ('가스'::text, 2)) as required_item(name, sort_order)
  on conflict (type_id, name) do update set
    is_required = true,
    daily_proration = false,
    deleted_at = null,
    sort_order = excluded.sort_order;

  -- 0350: 전월과수납 시스템 항목(항상 마지막 순서).
  insert into public.fee_items (org_id, type_id, name, rounding, daily_proration, carry_over, is_required, sort_order, deleted_at, system_code)
  values (v_org_id, p_type_id, '전월과수납', 'raw'::fee_rounding, false, false, false, 999, null, 'prev_overpay')
  on conflict (type_id, name) do update set
    system_code = 'prev_overpay',
    is_required = false,
    carry_over = false,
    daily_proration = false,
    deleted_at = null,
    sort_order = 999;
end;
$function$;

-- 명칭·코드·유형 변경 차단
create or replace function public.guard_system_fee_item()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if old.system_code is not null and (
       new.name is distinct from old.name
       or new.system_code is distinct from old.system_code
       or new.type_id is distinct from old.type_id) then
    raise exception '전월과수납은 시스템 항목이라 명칭을 바꾸거나 삭제할 수 없어요';
  end if;
  return new;
end;
$function$;

drop trigger if exists fee_items_guard_system_item on public.fee_items;
create trigger fee_items_guard_system_item
  before update on public.fee_items
  for each row execute function public.guard_system_fee_item();

-- 하드 삭제되면 다시 만든다(유형 삭제 cascade 면 유형이 없어 ensure 가 아무것도 안 한다).
drop trigger if exists fee_items_restore_deleted_system_item on public.fee_items;
create trigger fee_items_restore_deleted_system_item
  after delete on public.fee_items
  for each row when (old.system_code is not null)
  execute function public.restore_required_utility_fee_items();

-- 시스템 항목 금액은 저장하지 않는다(confirm_billing 이 원장에서 계산).
create or replace function public.skip_system_fee_item_charge()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if exists (select 1 from fee_items fi where fi.id = new.fee_item_id and fi.system_code is not null) then
    return null;
  end if;
  return new;
end;
$function$;

drop trigger if exists fee_item_charges_skip_system_item on public.fee_item_charges;
create trigger fee_item_charges_skip_system_item
  before insert or update on public.fee_item_charges
  for each row execute function public.skip_system_fee_item_charge();

-- 기존 모든 건물 유형에 시드
select public.ensure_required_utility_fee_items(bt.id) from public.building_types bt;

-- ───────────────────────── 2. 과수납 원장 ─────────────────────────
create table if not exists public.unit_overpayments (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations(id) on delete cascade,
  unit_id bigint not null references public.units(id) on delete cascade,
  occupancy_id bigint references public.occupancies(id) on delete set null,
  source_period date not null check (source_period = date_trunc('month', source_period)::date),
  amount integer not null default 0 check (amount >= 0),
  status text not null default 'open' check (status in ('open', 'applied', 'canceled', 'refunded')),
  applied_period date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, source_period)
);
comment on table public.unit_overpayments is
  '0350 과수납 원장: (unit, source_period) 초과 수납액. open=차감 대기, applied=전액 차감, canceled=초과분 없음, refunded=환급.';

create table if not exists public.unit_overpayment_applications (
  id bigint generated always as identity primary key,
  overpayment_id bigint not null references public.unit_overpayments(id) on delete cascade,
  unit_id bigint not null references public.units(id) on delete cascade,
  applied_period date not null check (applied_period = date_trunc('month', applied_period)::date),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (overpayment_id, applied_period)
);
create index if not exists unit_overpayment_applications_unit_period_idx
  on public.unit_overpayment_applications (unit_id, applied_period);
create index if not exists unit_overpayments_occupancy_idx
  on public.unit_overpayments (occupancy_id) where occupancy_id is not null;

drop trigger if exists trg_unit_overpayments_updated on public.unit_overpayments;
create trigger trg_unit_overpayments_updated before update on public.unit_overpayments
  for each row execute function public.set_updated_at();

alter table public.unit_overpayments enable row level security;
alter table public.unit_overpayment_applications enable row level security;
revoke insert, update, delete, truncate on public.unit_overpayments from anon, authenticated;
revoke insert, update, delete, truncate on public.unit_overpayment_applications from anon, authenticated;
revoke all on public.unit_overpayments from anon;
revoke all on public.unit_overpayment_applications from anon;
grant select on public.unit_overpayments to authenticated;
grant select on public.unit_overpayment_applications to authenticated;

drop policy if exists uop_select on public.unit_overpayments;
create policy uop_select on public.unit_overpayments for select to authenticated
  using ((unit_id in (select u.id from units u join buildings b on b.id = u.building_id
                      where b.org_id in (select my_org_ids())))
         and (select current_user_is_office_staff()));

drop policy if exists uopa_select on public.unit_overpayment_applications;
create policy uopa_select on public.unit_overpayment_applications for select to authenticated
  using ((unit_id in (select u.id from units u join buildings b on b.id = u.building_id
                      where b.org_id in (select my_org_ids())))
         and (select current_user_is_office_staff()));

-- ───────────────────────── 3. 계산 함수 ─────────────────────────
-- 그 달 원금 p_principal 에 대한 p_as_of 시점 연체료(lib/billing/lateFee.ts 와 같은 식). override 는 호출부가 처리.
create or replace function public.overpay_late_fee(p_unit_id bigint, p_period date, p_principal integer, p_as_of date)
 returns integer
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with ctx as (
    select b.org_id, bc.occupancy_id, public.billing_effective_due_date(p_unit_id, p_period) as due_date
    from billing_confirmations bc
    join units u on u.id = bc.unit_id
    join buildings b on b.id = u.building_id
    where bc.unit_id = p_unit_id and bc.period = p_period
  )
  select coalesce((
    select case
      when coalesce(p_principal, 0) <= 0 or ctx.due_date is null or p_as_of is null or p_as_of <= ctx.due_date
        or late_fee_factor(ctx.org_id, ctx.occupancy_id) = 0 then 0
      else (
        round(p_principal * (
          select coalesce(sum((
            select t.monthly_rate from late_fee_rate_tiers t
             where t.org_id = ctx.org_id and k.k > t.from_month and (t.to_month is null or k.k <= t.to_month)
             order by t.tier_order limit 1
          )), 0)::numeric
          from generate_series(1, greatest(
            (extract(year from p_as_of)::int - extract(year from ctx.due_date)::int) * 12
            + (extract(month from p_as_of)::int - extract(month from ctx.due_date)::int), 0)) as k(k)
        ) / 100.0)
        + round(p_principal * coalesce((select sc.late_fee_post_due_rate from setup_config sc where sc.org_id = ctx.org_id), 2.0)
                / 100.0 / 10.0) * 10
      )::int
    end
    from ctx
  ), 0);
$function$;

-- 그 달 초과 수납액(과수납). 확정 부과가 없으면 0.
create or replace function public.overpayment_excess(p_unit_id bigint, p_period date)
 returns integer
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_bc record; v_paid bigint; v_cum bigint := 0; v_pay record;
  v_principal_before integer := 0; v_as_of date; v_cap integer := 0; v_split_total integer;
  v_main bigint := 0; v_split_excess bigint;
begin
  select bc.total_amount, bc.occupancy_id, bc.late_fee_override into v_bc
    from billing_confirmations bc
   where bc.unit_id = p_unit_id and bc.period = p_period and bc.confirmed_at is not null;
  if not found then return 0; end if;

  select coalesce(sum(p.amount), 0) into v_paid
    from payments p
   where p.unit_id = p_unit_id and p.period = p_period and p.status = 'active'
     and p.late_fee_split_id is null and p.occupancy_id is not distinct from v_bc.occupancy_id;

  if v_paid > v_bc.total_amount then
    select coalesce(s.split_total, 0) into v_split_total from late_fee_split_balance(p_unit_id, p_period) s;
    if v_bc.late_fee_override is not null then
      v_cap := greatest(v_bc.late_fee_override - v_split_total, 0);
    else
      -- 원금을 마감한 수납 건: 그 직전 남은 원금과 그 수납일로 연체료를 계산한다.
      for v_pay in
        select p.amount, p.paid_at from payments p
         where p.unit_id = p_unit_id and p.period = p_period and p.status = 'active'
           and p.late_fee_split_id is null and p.occupancy_id is not distinct from v_bc.occupancy_id
         order by p.paid_at, p.id
      loop
        if v_cum + v_pay.amount >= v_bc.total_amount then
          v_principal_before := greatest(v_bc.total_amount - v_cum, 0)::int;
          v_as_of := v_pay.paid_at;
          exit;
        end if;
        v_cum := v_cum + v_pay.amount;
      end loop;
      v_cap := greatest(overpay_late_fee(p_unit_id, p_period, v_principal_before, v_as_of) - v_split_total, 0);
    end if;
    v_main := greatest(v_paid - v_bc.total_amount - v_cap, 0);
  end if;

  select coalesce(sum(greatest(coalesce(sp.paid, 0) - s.amount, 0)), 0) into v_split_excess
    from payment_late_fee_splits s
    left join lateral (
      select sum(p.amount) as paid from payments p where p.late_fee_split_id = s.id and p.status = 'active'
    ) sp on true
   where s.unit_id = p_unit_id and s.period = p_period and s.status = 'active';

  return least(v_main + v_split_excess, 2147483647)::int;
end;
$function$;

create or replace function public.overpayment_refresh_status(p_overpayment_id bigint)
 returns void
 language sql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  update unit_overpayments o
     set status = case
                    when o.status = 'refunded' then 'refunded'
                    when o.amount <= 0 then 'canceled'
                    when coalesce(a.applied, 0) >= o.amount then 'applied'
                    else 'open'
                  end,
         applied_period = a.last_period
    from (
      select coalesce(sum(x.amount), 0) as applied, max(x.applied_period) as last_period
        from unit_overpayment_applications x where x.overpayment_id = p_overpayment_id
    ) a
   where o.id = p_overpayment_id
     and (o.status is distinct from case
                    when o.status = 'refunded' then 'refunded'
                    when o.amount <= 0 then 'canceled'
                    when coalesce(a.applied, 0) >= o.amount then 'applied'
                    else 'open'
                  end
          or o.applied_period is distinct from a.last_period);
$function$;

create or replace function public.sync_unit_overpayment(p_unit_id bigint, p_period date)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_excess integer; v_row record; v_occ bigint; v_org bigint; v_id bigint;
begin
  if p_unit_id is null or p_period is null then return; end if;
  v_excess := overpayment_excess(p_unit_id, p_period);
  select o.id, o.status, o.amount into v_row
    from unit_overpayments o where o.unit_id = p_unit_id and o.source_period = p_period
    for update;
  if not found then
    if v_excess <= 0 then return; end if;
    select bc.occupancy_id into v_occ from billing_confirmations bc
     where bc.unit_id = p_unit_id and bc.period = p_period;
    select b.org_id into v_org from units u join buildings b on b.id = u.building_id where u.id = p_unit_id;
    insert into unit_overpayments(org_id, unit_id, occupancy_id, source_period, amount, status)
      values (v_org, p_unit_id, v_occ, p_period, v_excess, 'open')
      returning id into v_id;
    return;
  end if;
  if v_row.status = 'refunded' then return; end if;  -- 환급 처리된 건은 고정
  if v_row.amount is distinct from greatest(v_excess, 0) then
    update unit_overpayments set amount = greatest(v_excess, 0),
           occupancy_id = coalesce((select bc.occupancy_id from billing_confirmations bc
                                     where bc.unit_id = p_unit_id and bc.period = p_period), occupancy_id)
     where id = v_row.id;
  end if;
  perform overpayment_refresh_status(v_row.id);
end;
$function$;

-- 같은 occupancy 의 source_period < p_period 과수납 중 p_period 외의 달에 아직 쓰지 않은 잔액.
create or replace function public.overpayment_available(p_unit_id bigint, p_occupancy_id bigint, p_period date)
 returns integer
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(sum(greatest(o.amount - coalesce((
           select sum(a.amount) from unit_overpayment_applications a
            where a.overpayment_id = o.id and a.applied_period <> p_period), 0), 0)), 0)::int
    from unit_overpayments o
   where o.unit_id = p_unit_id
     and o.occupancy_id = p_occupancy_id
     and o.source_period < p_period
     and o.amount > 0
     and o.status in ('open', 'applied');
$function$;

-- confirm_billing 내부용: p_period 적용분을 다시 계산해 기록하고 차감액(양수)을 돌려준다.
create or replace function public.apply_unit_overpayments(p_unit_id bigint, p_occupancy_id bigint, p_period date, p_cap bigint)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_left bigint := greatest(coalesce(p_cap, 0), 0); v_take integer; v_total integer := 0; v_o record; v_ids bigint[];
begin
  select coalesce(array_agg(distinct a.overpayment_id), '{}') into v_ids
    from unit_overpayment_applications a where a.unit_id = p_unit_id and a.applied_period = p_period;
  delete from unit_overpayment_applications a where a.unit_id = p_unit_id and a.applied_period = p_period;

  if p_occupancy_id is not null then
    for v_o in
      select o.id, greatest(o.amount - coalesce((
               select sum(a.amount) from unit_overpayment_applications a where a.overpayment_id = o.id), 0), 0) as avail
        from unit_overpayments o
       where o.unit_id = p_unit_id and o.occupancy_id = p_occupancy_id
         and o.source_period < p_period and o.amount > 0 and o.status in ('open', 'applied')
       order by o.source_period, o.id
       for update of o
    loop
      exit when v_left <= 0;
      continue when v_o.avail <= 0;
      v_take := least(v_o.avail, v_left)::int;
      insert into unit_overpayment_applications(overpayment_id, unit_id, applied_period, amount)
        values (v_o.id, p_unit_id, p_period, v_take);
      v_left := v_left - v_take;
      v_total := v_total + v_take;
      v_ids := array_append(v_ids, v_o.id);
    end loop;
  end if;

  perform overpayment_refresh_status(x) from unnest(v_ids) as x;
  return v_total;
end;
$function$;

-- ───────────────────────── 4. 재계산 트리거 ─────────────────────────
create or replace function public.trg_sync_overpayment_payments()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform sync_unit_overpayment(old.unit_id, old.period);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.unit_id is distinct from old.unit_id or new.period is distinct from old.period) then
    perform sync_unit_overpayment(new.unit_id, new.period);
  end if;
  return null;
end;
$function$;

drop trigger if exists payments_sync_overpayment on public.payments;
create trigger payments_sync_overpayment
  after insert or delete or update of amount, status, period, unit_id, occupancy_id, late_fee_split_id, paid_at
  on public.payments
  for each row execute function public.trg_sync_overpayment_payments();

drop trigger if exists billing_confirmations_sync_overpayment on public.billing_confirmations;
create trigger billing_confirmations_sync_overpayment
  after insert or delete or update of total_amount, late_fee_override, occupancy_id, confirmed_at
  on public.billing_confirmations
  for each row execute function public.trg_sync_overpayment_payments();

drop trigger if exists late_fee_splits_sync_overpayment on public.payment_late_fee_splits;
create trigger late_fee_splits_sync_overpayment
  after insert or delete or update of amount, status
  on public.payment_late_fee_splits
  for each row execute function public.trg_sync_overpayment_payments();

-- ───────────────────────── 5. 여러 달 배분 ─────────────────────────
-- p_payment_id(수.연 미연결 수납)가 그 달 미납을 넘긴 금액을 같은 occupancy 의 더 오래된 미납 달부터
-- 별도 payments 행으로 옮긴다. 옮긴 금액을 돌려준다. 남는 초과분은 과수납 원장에 남는다.
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
     where bc.unit_id = v_pay.unit_id and bc.occupancy_id = v_pay.occupancy_id
       and bc.period < v_pay.period and bc.confirmed_at is not null
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

revoke all on function public.overpay_late_fee(bigint, date, integer, date) from public, anon, authenticated;
revoke all on function public.overpayment_excess(bigint, date) from public, anon, authenticated;
revoke all on function public.overpayment_refresh_status(bigint) from public, anon, authenticated;
revoke all on function public.sync_unit_overpayment(bigint, date) from public, anon, authenticated;
revoke all on function public.overpayment_available(bigint, bigint, date) from public, anon, authenticated;
revoke all on function public.apply_unit_overpayments(bigint, bigint, date, bigint) from public, anon, authenticated;
revoke all on function public.allocate_payment_excess(bigint) from public, anon, authenticated;
revoke all on function public.trg_sync_overpayment_payments() from public, anon, authenticated;
revoke all on function public.guard_system_fee_item() from public, anon, authenticated;
revoke all on function public.skip_system_fee_item_charge() from public, anon, authenticated;

-- ───────────────────────── 6. save_payment_history: record 후 배분 ─────────────────────────
create or replace function public.save_payment_history(p_ops jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_op jsonb;
  v_res jsonb;
  v_split bigint;
  v_canceled int := 0;
  v_recorded int := 0;
  v_edited int := 0;
  v_restored int := 0;
  v_alloc_ids bigint[] := '{}';
  v_alloc_id bigint;
  v_allocated int := 0;
begin
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then raise exception 'ops must be an array'; end if;

  for v_op in select value from jsonb_array_elements(p_ops) loop
    case v_op->>'op'
      when 'cancel' then
        perform cancel_payment((v_op->>'payment_id')::bigint);
        v_canceled := v_canceled + 1;
      when 'restore' then
        perform restore_payment((v_op->>'payment_id')::bigint);
        v_restored := v_restored + 1;
      when 'record' then
        v_res := record_payment(
          (v_op->>'unit_id')::bigint, (v_op->>'period')::date, (v_op->>'amount')::int,
          v_op->>'method', v_op->>'kind', v_op->>'memo', (v_op->>'paid_at')::date,
          coalesce((v_op->>'fee')::int, 0), v_op->>'deposit_type');
        perform link_payment_late_fee_split((v_res->>'payment_id')::bigint, (v_op->>'late_fee_split_id')::bigint);
        -- 0350: 수.연 미수금에 연결되지 않은 수납은 저장 끝에 여러 달 배분 대상
        if (v_op->>'late_fee_split_id') is null then
          v_alloc_ids := array_append(v_alloc_ids, (v_res->>'payment_id')::bigint);
        end if;
        v_recorded := v_recorded + 1;
      when 'edit' then
        select p.late_fee_split_id into v_split from payments p where p.id = (v_op->>'old_payment_id')::bigint;
        v_res := record_payment_edit(
          (v_op->>'old_payment_id')::bigint,
          (v_op->>'unit_id')::bigint, (v_op->>'period')::date, (v_op->>'amount')::int,
          v_op->>'method', v_op->>'kind', v_op->>'memo', (v_op->>'paid_at')::date,
          (v_op->>'fee')::int, null, v_op->>'deposit_type');
        perform link_payment_late_fee_split((v_res->>'payment_id')::bigint, v_split);
        v_edited := v_edited + 1;
      when 'bill' then
        perform set_billing_override(
          (v_op->>'unit_id')::bigint, (v_op->>'period')::date,
          (v_op->>'charged')::int, coalesce((v_op->>'set_charged')::boolean, false),
          (v_op->>'late_fee')::int, coalesce((v_op->>'set_late_fee')::boolean, false));
      when 'split' then
        v_split := create_late_fee_split(
          (v_op->>'unit_id')::bigint, (v_op->>'period')::date,
          (v_op->>'split_amount')::int, v_op->>'split_memo');
        if coalesce((v_op->>'amount')::int, 0) > 0 then
          v_res := record_payment(
            (v_op->>'unit_id')::bigint, (v_op->>'period')::date, (v_op->>'amount')::int,
            v_op->>'method', v_op->>'kind', v_op->>'memo', (v_op->>'paid_at')::date,
            coalesce((v_op->>'fee')::int, 0), v_op->>'deposit_type');
          perform link_payment_late_fee_split((v_res->>'payment_id')::bigint, v_split);
          v_recorded := v_recorded + 1;
        end if;
      when 'cancel_split' then
        perform cancel_late_fee_split((v_op->>'split_id')::bigint);
        v_canceled := v_canceled + 1;
      else
        raise exception 'invalid op: %', v_op->>'op';
    end case;
  end loop;

  foreach v_alloc_id in array v_alloc_ids loop
    v_allocated := v_allocated + allocate_payment_excess(v_alloc_id);
  end loop;

  return jsonb_build_object('ok', true, 'canceled', v_canceled, 'recorded', v_recorded,
    'edited', v_edited, 'restored', v_restored, 'allocated', v_allocated);
end $function$;

-- ───────────────────────── 7. confirm_billing: 전월과수납 차감 ─────────────────────────
create or replace function public.confirm_billing(p_building_id bigint, p_period date)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint; v_unit record; v_item record;
  v_items jsonb; v_total bigint; v_amt int;
  v_days int; v_occupied int; v_count int := 0; v_grand bigint := 0;
  v_sys_id bigint; v_sys_name text; v_credit int;
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

  -- 0350: 이 건물 유형의 전월과수납 시스템 항목
  select fi.id, fi.name into v_sys_id, v_sys_name
    from buildings b join fee_items fi on fi.type_id = b.type_id and fi.org_id = v_org
   where b.id = p_building_id and fi.system_code = 'prev_overpay' and fi.deleted_at is null;

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
          -- 0326: 필수 공과금은 공과금 화면 부과액 우선
          case when fi.is_required then billing_utility_default(v_unit.unit_id, p_period, fi.is_required, fi.name) end,
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
        and fi.system_code is null  -- 0350: 시스템 항목은 아래에서 원장으로 계산
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

    -- 0350: 전월과수납 — 같은 occupancy 의 이전 달 과수납 잔액을 그 달 다른 항목 합계 한도로 차감(재확정 멱등).
    v_credit := apply_unit_overpayments(v_unit.unit_id, v_unit.occ_id, p_period, greatest(v_total, 0));
    if v_credit > 0 then
      v_items := v_items || jsonb_build_object('fee_item_id', v_sys_id, 'name', coalesce(v_sys_name, '전월과수납'),
                                               'charged', true, 'amount', -v_credit);
      v_total := v_total - v_credit;
    end if;

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

-- ───────────────────────── 8. charge_new_occupancies: 시스템 항목 제외 ─────────────────────────
create or replace function public.charge_new_occupancies(p_building_id bigint, p_period date, p_unit_ids bigint[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
          -- 0326: 필수 공과금은 공과금 화면 부과액 우선
          case when fi.is_required then billing_utility_default(v_unit.unit_id, p_period, fi.is_required, fi.name) end,
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
        and fi.system_code is null  -- 0350: 신규 입주 건은 이전 과수납이 없다
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

-- ───────────────────────── 9. list_billing: system_code 열 + 전월과수납 미리보기 ─────────────────────────
drop function if exists public.list_billing(bigint, date);
create function public.list_billing(p_building_id bigint, p_period date)
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

-- ───────────────────────── 10. 이사정산: 퇴실 세대 과수납 잔액 차감(음수=환급) ─────────────────────────
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
  credit as (
    select coalesce(sum(greatest(o.amount - coalesce((
             select sum(a.amount) from unit_overpayment_applications a where a.overpayment_id = o.id), 0), 0)), 0)::bigint as amount
      from unit_overpayments o
     where o.unit_id = p_unit_id and o.occupancy_id = p_occupancy_id
       and o.amount > 0 and o.status in ('open', 'applied')
  )
  select unpaid.amount - credit.amount from unpaid, credit
$function$;

-- ───────────────────────── 11. 이사정산 관리비 항목: 시스템 항목 제외 ─────────────────────────
create or replace function public.partner_get_settlement_fee_items(p_unit_id bigint, p_period date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_type_id bigint;
begin
  select b.org_id, b.type_id into v_org, v_type_id
    from units u
    join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null
      and b.id in (select partner_my_building_ids());
  if v_org is null then raise exception 'unit not assigned to caller'; end if;
  if p_period is not null and p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'fee_item_id', fi.id,
        'name', fi.name,
        'daily', fi.daily_proration,
        'rounding', fi.rounding,
        'charged', coalesce(fic.amount, 0)
      ) order by fi.sort_order, fi.id
    )
    from fee_items fi
    left join fee_item_charges fic
      on fic.fee_item_id = fi.id and fic.unit_id = p_unit_id
     and fic.period = p_period and fic.charged
    where fi.org_id = v_org and fi.type_id = v_type_id
      and fi.deleted_at is null and not fi.is_required
      and fi.system_code is null  -- 0350: 전월과수납은 일할 정산 대상이 아니다
  ), '[]'::jsonb);
end $function$;

-- 0015_p6_payments.sql
-- P6: 수납 처리 Phase A (payments 원장 + 수동 수납/원금/분할/취소)
-- 의존: P0(profiles·audit_log·set_updated_at), P1a(units), P2a(current_user_org·current_user_has_module·my_org_ids),
--       P3b(occupancies·unit_accounts), P5(billing_confirmations), P5 bill_publish(bill_issues)
-- 모듈 게이트: payment

-- ===== 테이블 =====
create table payments (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  unit_id bigint not null references units(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  occupancy_id bigint references occupancies(id) on delete set null,
  amount integer not null check (amount > 0),
  method text not null default 'transfer'
    check (method in ('cash','transfer','auto_debit','giro','card','other')),
  kind text not null check (kind in ('full','principal','partial')),
  memo text,
  paid_at date not null default current_date,
  status text not null default 'active' check (status in ('active','canceled')),
  canceled_at timestamptz,
  canceled_by uuid references profiles(user_id) on delete set null,
  source text not null default 'manual' check (source in ('manual','bank_excel','cms')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(user_id) on delete set null
);
create index on payments (unit_id, period);
create index on payments (org_id, period);

create trigger trg_payments_updated before update on payments
  for each row execute function set_updated_at();

-- ===== RLS: SELECT org 개방 / 쓰기 payment 모듈 =====
alter table payments enable row level security;
create policy pay_select on payments for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy pay_write on payments for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('payment'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('payment'));

-- ===== 수납 기록 =====
create or replace function record_payment(
  p_unit_id bigint, p_period date, p_amount int,
  p_method text, p_kind text, p_memo text, p_paid_at date
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_occ bigint; v_id bigint; v_charged int; v_paid int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if not exists (select 1 from units u join buildings b on b.id=u.building_id
                 where u.id=p_unit_id and b.org_id=v_org and u.deleted_at is null) then
    raise exception 'unit not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'amount must be positive'; end if;
  if p_method not in ('cash','transfer','auto_debit','giro','card','other') then raise exception 'invalid method'; end if;
  if p_kind not in ('full','principal','partial') then raise exception 'invalid kind'; end if;

  select o.id into v_occ from occupancies o
   where o.unit_id=p_unit_id and o.deleted_at is null
   order by o.created_at desc, o.id desc limit 1;

  insert into payments(org_id, unit_id, period, occupancy_id, amount, method, kind, memo, paid_at, source, created_by)
    values (v_org, p_unit_id, p_period, v_occ, p_amount, p_method, p_kind, nullif(p_memo,''),
            coalesce(p_paid_at, current_date), 'manual', auth.uid())
    returning id into v_id;

  select bc.total_amount into v_charged from billing_confirmations bc
    where bc.unit_id=p_unit_id and bc.period=p_period;
  select coalesce(sum(amount),0)::int into v_paid from payments
    where unit_id=p_unit_id and period=p_period and status='active';

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_RECORD', 'payments', v_id::text,
      jsonb_build_object('unit_id',p_unit_id,'period',p_period,'amount',p_amount,'kind',p_kind,'method',p_method));

  return jsonb_build_object('ok',true,'payment_id',v_id,'charged',v_charged,'paid',v_paid,
    'unpaid', case when v_charged is null then null else v_charged - v_paid end);
end $$;
revoke execute on function record_payment(bigint, date, int, text, text, text, date) from public, anon;
grant execute on function record_payment(bigint, date, int, text, text, text, date) to authenticated;

-- ===== 수납 취소(소프트) =====
create or replace function cancel_payment(p_payment_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_unit bigint; v_period date; v_charged int; v_paid int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;

  update payments p set status='canceled', canceled_at=now(), canceled_by=auth.uid()
   where p.id=p_payment_id and p.status='active' and p.org_id=v_org
     and exists (select 1 from units u join buildings b on b.id=u.building_id
                 where u.id=p.unit_id and b.org_id=v_org)
   returning p.unit_id, p.period into v_unit, v_period;
  if v_unit is null then raise exception 'payment not found or already canceled'; end if;

  select bc.total_amount into v_charged from billing_confirmations bc
    where bc.unit_id=v_unit and bc.period=v_period;
  select coalesce(sum(amount),0)::int into v_paid from payments
    where unit_id=v_unit and period=v_period and status='active';

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_CANCEL', 'payments', p_payment_id::text,
      jsonb_build_object('unit_id',v_unit,'period',v_period));

  return jsonb_build_object('ok',true,'unit_id',v_unit,'period',v_period,'charged',v_charged,'paid',v_paid,
    'unpaid', case when v_charged is null then null else v_charged - v_paid end);
end $$;
revoke execute on function cancel_payment(bigint) from public, anon;
grant execute on function cancel_payment(bigint) to authenticated;

-- ===== 세대별 수납 현황(건물·기간) =====
create or replace function list_payment_rows(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, occupancy_id bigint, tenant_name text,
  is_vacant boolean, is_auto_debit boolean, due_date date, charged int, paid int
) language sql stable security definer set search_path = public as $$
  with u as (
    select id, unit_no, dong from units
    where building_id=p_building_id and deleted_at is null
      and building_id in (select id from buildings where org_id=current_user_org())
  ),
  occ as (
    select distinct on (o.unit_id) o.unit_id, o.id as occupancy_id, o.tenant_name, o.status
    from occupancies o join u on u.id=o.unit_id
    where o.deleted_at is null
    order by o.unit_id, o.created_at desc, o.id desc
  ),
  pay as (
    select p.unit_id, coalesce(sum(p.amount),0)::int as paid
    from payments p join u on u.id=p.unit_id
    where p.period=p_period and p.status='active'
    group by p.unit_id
  )
  select
    u.id, u.unit_no, u.dong, occ.occupancy_id, occ.tenant_name,
    coalesce(occ.status='vacant', true) as is_vacant,
    (ua.cms_member_no is not null) as is_auto_debit,
    bi.due_date,
    bc.total_amount as charged,
    coalesce(pay.paid, 0) as paid
  from u
  left join occ on occ.unit_id=u.id
  left join pay on pay.unit_id=u.id
  left join billing_confirmations bc on bc.unit_id=u.id and bc.period=p_period
  left join lateral (
    select cms_member_no from unit_accounts a
    where a.unit_id=u.id and a.kind='mgmt' order by a.id desc limit 1
  ) ua on true
  left join lateral (
    select due_date from bill_issues x
    where x.unit_id=u.id and x.period=p_period
    order by x.issued_at desc nulls last, x.id desc limit 1
  ) bi on true
  order by u.unit_no
$$;
revoke execute on function list_payment_rows(bigint, date) from public, anon;
grant execute on function list_payment_rows(bigint, date) to authenticated;

-- ===== 세대 수납 이력(취소 포함) =====
create or replace function list_unit_payments(p_unit_id bigint, p_period date)
returns table(id bigint, amount int, method text, kind text, memo text,
              paid_at date, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.amount, p.method, p.kind, p.memo, p.paid_at, p.status, p.created_at
  from payments p
  join units u on u.id=p.unit_id
  join buildings b on b.id=u.building_id and b.org_id=current_user_org()
  where p.unit_id=p_unit_id and p.period=p_period
  order by p.created_at desc, p.id desc
$$;
revoke execute on function list_unit_payments(bigint, date) from public, anon;
grant execute on function list_unit_payments(bigint, date) to authenticated;

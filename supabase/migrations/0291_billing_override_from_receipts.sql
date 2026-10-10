-- 수납 이력 「추가」 행에서 당월계·연체를 직접 입력해 실제 부과·연체로 반영한다.
--
-- 당월계 = 그 달 고지 확정 금액(billing_confirmations.total_amount). 확정이 없던 달이면 새로 확정한다.
--          (예전 전산에서 넘어온 과거 달 수납을 넣을 때 쓰는 용도. 항목 내역(fee_item_charges)은 만들지 않는다.)
-- 연체   = 그 달 수동 연체료(billing_confirmations.late_fee_override). null 이면 지금처럼 자동 계산.
--          수동 연체료는 그 달 미납 원금이 남아 있을 때만 적용한다(완납이면 0).
--
-- 1) billing_confirmations.late_fee_override
-- 2) set_billing_override(unit, period, charged, set_charged, late_fee, set_late_fee) — 수납 권한, 감사 로그
-- 3) save_payment_history 에 op 'bill' 추가(수납 저장과 한 트랜잭션)
-- 4) 수동 연체료 노출·적용: list_payment_rows · list_overdue_periods(반환 컬럼) ·
--    resident_bill_months · resident_bill_detail · public_bill_by_signed(연체료 계산)

alter table public.billing_confirmations add column if not exists late_fee_override integer;
alter table public.billing_confirmations drop constraint if exists billing_confirmations_late_fee_override_check;
alter table public.billing_confirmations add constraint billing_confirmations_late_fee_override_check
  check (late_fee_override is null or late_fee_override >= 0);
comment on column public.billing_confirmations.late_fee_override is '수납 이력에서 직접 지정한 그 달 연체료. null=자동 계산';

create or replace function public.set_billing_override(
  p_unit_id bigint,
  p_period date,
  p_charged integer default null,
  p_set_charged boolean default false,
  p_late_fee integer default null,
  p_set_late_fee boolean default false
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_occ bigint;
  v_before jsonb;
  v_after jsonb;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if not exists (select 1 from units u join buildings b on b.id = u.building_id
                 where u.id = p_unit_id and b.org_id = v_org and u.deleted_at is null) then
    raise exception 'unit not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_set_charged and (p_charged is null or p_charged < 0) then
    raise exception '당월계는 0 이상으로 입력해 주세요.'; end if;
  if p_set_late_fee and p_late_fee is not null and p_late_fee < 0 then
    raise exception '연체는 0 이상으로 입력해 주세요.'; end if;

  select to_jsonb(bc) into v_before from billing_confirmations bc where bc.unit_id = p_unit_id and bc.period = p_period;

  if p_set_charged then
    -- 귀속: 기존 확정이 있으면 그 입주, 없으면 최근 입주(record_payment 와 같은 규칙)
    select bc.occupancy_id into v_occ from billing_confirmations bc where bc.unit_id = p_unit_id and bc.period = p_period;
    if v_occ is null then
      select o.id into v_occ from occupancies o
       where o.unit_id = p_unit_id and o.deleted_at is null
       order by o.created_at desc, o.id desc limit 1;
    end if;
    insert into billing_confirmations(unit_id, period, occupancy_id, total_amount, confirmed_at, confirmed_by)
    values (p_unit_id, p_period, v_occ, p_charged, now(), auth.uid())
    on conflict (unit_id, period) do update
      set total_amount = excluded.total_amount,
          occupancy_id = coalesce(billing_confirmations.occupancy_id, excluded.occupancy_id),
          confirmed_at = coalesce(billing_confirmations.confirmed_at, excluded.confirmed_at),
          confirmed_by = coalesce(billing_confirmations.confirmed_by, excluded.confirmed_by);
  end if;

  if p_set_late_fee then
    update billing_confirmations set late_fee_override = p_late_fee
     where unit_id = p_unit_id and period = p_period;
    if not found then raise exception '당월계(고지 확정)가 없는 달은 연체를 지정할 수 없어요. 당월계를 먼저 입력해 주세요.'; end if;
  end if;

  select to_jsonb(bc) into v_after from billing_confirmations bc where bc.unit_id = p_unit_id and bc.period = p_period;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
  values (v_org, auth.uid(), 'BILLING_OVERRIDE', 'billing_confirmations', p_unit_id::text || ':' || p_period::text,
          v_before, v_after);

  return jsonb_build_object('ok', true, 'total_amount', v_after->'total_amount', 'late_fee_override', v_after->'late_fee_override');
end $function$;

revoke all on function public.set_billing_override(bigint, date, integer, boolean, integer, boolean) from public, anon;
grant execute on function public.set_billing_override(bigint, date, integer, boolean, integer, boolean) to authenticated, service_role;

do $$
declare
  v_def text;
  v_new text;
begin
  -- 3) save_payment_history: op 'bill'
  v_def := pg_get_functiondef('public.save_payment_history(jsonb)'::regprocedure);
  if position('''bill''' in v_def) = 0 then
    v_new := replace(v_def, $o$      else
        raise exception 'invalid op: %', v_op->>'op';$o$, $n$      when 'bill' then
        -- 0291: 추가 행 당월계·연체(실제 부과·연체 반영). 같은 달 수납보다 먼저 처리되도록 화면이 앞에 둔다.
        perform set_billing_override(
          (v_op->>'unit_id')::bigint, (v_op->>'period')::date,
          (v_op->>'charged')::int, coalesce((v_op->>'set_charged')::boolean, false),
          (v_op->>'late_fee')::int, coalesce((v_op->>'set_late_fee')::boolean, false));
      else
        raise exception 'invalid op: %', v_op->>'op';$n$);
    if v_new = v_def then raise exception 'save_payment_history patch failed'; end if;
    execute v_new;
  end if;

  -- 4-a) list_payment_rows: late_fee_override 반환
  v_def := pg_get_functiondef('public.list_payment_rows(bigint,date)'::regprocedure);
  if position('late_fee_override' in v_def) = 0 then
    v_new := replace(v_def, 'payer_no text, payer_name text)', 'payer_no text, payer_name text, late_fee_override integer)');
    v_new := replace(v_new, E'    occ.payer_name\n  from u', E'    occ.payer_name,\n    bc.late_fee_override\n  from u');
    if (length(v_new) - length(replace(v_new, 'late_fee_override', ''))) / length('late_fee_override') <> 2 then
      raise exception 'list_payment_rows patch failed';
    end if;
    drop function public.list_payment_rows(bigint, date);
    execute v_new;
    grant execute on function public.list_payment_rows(bigint, date) to authenticated, service_role;
  end if;

  -- 4-b) list_overdue_periods: late_fee_override 반환
  v_def := pg_get_functiondef('public.list_overdue_periods(bigint,integer,integer,text)'::regprocedure);
  if position('late_fee_override' in v_def) = 0 then
    v_new := replace(v_def, 'unpaid_principal bigint, due_date date)', 'unpaid_principal bigint, due_date date, late_fee_override integer)');
    v_new := regexp_replace(v_new, '\) as due_date(\s*)from period_balances pb',
      ') as due_date,\1  (select x.late_fee_override from billing_confirmations x where x.unit_id = pb.unit_id and x.period = pb.period) as late_fee_override\1from period_balances pb');
    if (length(v_new) - length(replace(v_new, 'late_fee_override', ''))) / length('late_fee_override') <> 3 then
      raise exception 'list_overdue_periods patch failed';
    end if;
    drop function public.list_overdue_periods(bigint, integer, integer, text);
    execute v_new;
    grant execute on function public.list_overdue_periods(bigint, integer, integer, text) to authenticated, service_role;
  end if;

  -- 4-c) resident_bill_months: 수동 연체료 우선(미납 원금이 남은 달만)
  v_def := pg_get_functiondef('public.resident_bill_months()'::regprocedure);
  if position('late_fee_override' in v_def) = 0 then
    v_new := replace(v_def, E'      bc.total_amount,\n', E'      bc.total_amount,\n      bc.late_fee_override,\n');
    v_new := replace(v_new,
      'round(s.unpaid_amount * lf.cumulative_rate * late_fee_factor(s.org_id, s.occupancy_id) / 100.0)::int as late_fee',
      'coalesce(case when s.unpaid_amount > 0 then s.late_fee_override end, round(s.unpaid_amount * lf.cumulative_rate * late_fee_factor(s.org_id, s.occupancy_id) / 100.0)::int) as late_fee');
    if (length(v_new) - length(replace(v_new, 'late_fee_override', ''))) / length('late_fee_override') <> 2 then
      raise exception 'resident_bill_months patch failed';
    end if;
    execute v_new;
  end if;

  -- 4-d) resident_bill_detail · public_bill_by_signed: 수동 연체료 우선
  v_def := pg_get_functiondef('public.resident_bill_detail(date)'::regprocedure);
  if position('late_fee_override' in v_def) = 0 then
    v_new := replace(v_def,
      E'round(\n      greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate * late_fee_factor(l.org_id, bc.occupancy_id) / 100.0\n    )::int',
      E'coalesce(\n      case when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0 then bc.late_fee_override end,\n      round(\n      greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate * late_fee_factor(l.org_id, bc.occupancy_id) / 100.0\n    )::int)');
    if v_new = v_def then raise exception 'resident_bill_detail patch failed'; end if;
    execute v_new;
  end if;

  v_def := pg_get_functiondef('public.public_bill_by_signed(bigint,text,date,text,integer)'::regprocedure);
  if position('late_fee_override' in v_def) = 0 then
    v_new := replace(v_def,
      E'round(greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)\n        * lf.cumulative_rate * public.late_fee_factor(b.org_id, bc.occupancy_id) / 100.0)::int',
      E'coalesce(case when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0 then bc.late_fee_override end,\n        round(greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)\n        * lf.cumulative_rate * public.late_fee_factor(b.org_id, bc.occupancy_id) / 100.0)::int)');
    if v_new = v_def then raise exception 'public_bill_by_signed patch failed'; end if;
    execute v_new;
  end if;
end $$;

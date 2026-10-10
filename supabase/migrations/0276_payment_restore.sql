-- 삭제(취소)한 수납을 되살린다.
--  - 수납 이력에서 '삭제'는 payments.status='canceled' 소프트 취소다. 이를 다시 active 로 되돌리는 restore_payment 를 추가한다.
--  - 수정(record_payment_edit)도 기존 건을 취소하고 새 건을 기록하므로, 수정으로 대체된 취소 건을 되살리면 이중 수납이 된다.
--    payments.replaced_by 로 대체 관계를 남기고, 대체된 건은 되살릴 수 없게 한다(기존 이력은 감사 로그 PAYMENT_EDIT 로 백필).
--  - 수납 이력 일괄 저장(save_payment_history)에 'restore' op 를 추가하고, 목록 RPC 가 replaced_by 를 함께 돌려준다.

alter table public.payments
  add column if not exists replaced_by bigint references public.payments(id);

-- 백필: PAYMENT_EDIT 감사 로그(row_pk = 새 건, after.old_id = 대체된 건)
update public.payments p
   set replaced_by = a.row_pk::bigint
  from public.audit_log a
 where a.action = 'PAYMENT_EDIT'
   and a.table_name = 'payments'
   and a.after ? 'old_id'
   and p.id = (a.after->>'old_id')::bigint
   and p.status = 'canceled'
   and p.replaced_by is null
   and exists (select 1 from public.payments n where n.id = a.row_pk::bigint);

-- 수정 시 대체 관계 기록
create or replace function public.record_payment_edit(p_old_payment_id bigint, p_unit_id bigint, p_period date, p_amount integer, p_method text, p_kind text, p_memo text, p_paid_at date DEFAULT NULL::date, p_fee integer DEFAULT NULL::integer, p_source text DEFAULT NULL::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_org bigint; v_occ bigint; v_id bigint; v_charged int; v_paid int;
        v_old_fee int; v_old_source text; v_old_paid_at date; v_old_ref text;
        v_fee int; v_source text; v_paid_at date;
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
  if p_fee is not null and p_fee < 0 then raise exception 'fee must be >= 0'; end if;
  if p_method not in ('cash','transfer','auto_debit','giro','card','other') then raise exception 'invalid method'; end if;
  if p_kind not in ('full','principal','partial') then raise exception 'invalid kind'; end if;
  if p_source is not null and p_source not in ('manual','bank_excel','cms','giro_file') then raise exception 'invalid source'; end if;

  -- 1) 기존 수납 취소 (본인 org·동일 세대·active만) + 원본 provenance 캡처
  update payments p set status='canceled', canceled_at=now(), canceled_by=auth.uid()
   where p.id=p_old_payment_id and p.status='active' and p.org_id=v_org and p.unit_id=p_unit_id
     and exists (select 1 from units u join buildings b on b.id=u.building_id
                 where u.id=p.unit_id and b.org_id=v_org)
   returning p.fee, p.source, p.paid_at, p.external_ref into v_old_fee, v_old_source, v_old_paid_at, v_old_ref;
  if not found then raise exception 'original payment not found or already canceled'; end if;

  -- 미지정 필드는 원본값 승계(은행/지로/CMS 수납 수정 시 fee·source·paid_at 유실 방지).
  v_fee := coalesce(p_fee, v_old_fee, 0);
  v_source := coalesce(p_source, v_old_source, 'manual');
  v_paid_at := coalesce(p_paid_at, v_old_paid_at, current_date);

  -- 2) 새 수납 기록 (같은 트랜잭션 — 실패 시 취소도 롤백)
  --    귀속: 해당 (unit, period) 확정부과 occupancy 우선, 없으면 최근 occupancy 폴백.
  select bc.occupancy_id into v_occ from billing_confirmations bc
   where bc.unit_id=p_unit_id and bc.period=p_period;
  if v_occ is null then
    select o.id into v_occ from occupancies o
     where o.unit_id=p_unit_id and o.deleted_at is null
     order by o.created_at desc, o.id desc limit 1;
  end if;

  insert into payments(org_id, unit_id, period, occupancy_id, amount, fee, method, kind, memo, paid_at, source, external_ref, created_by)
    values (v_org, p_unit_id, p_period, v_occ, p_amount, v_fee, p_method, p_kind, nullif(p_memo,''),
            v_paid_at, v_source, case when v_source = 'giro_file' then v_old_ref else null end, auth.uid())
    returning id into v_id;

  -- 3) 대체 관계 기록 — 대체된 취소 건은 되살릴 수 없다(restore_payment).
  update payments set replaced_by = v_id where id = p_old_payment_id;

  select bc.total_amount into v_charged from billing_confirmations bc
    where bc.unit_id=p_unit_id and bc.period=p_period;
  select coalesce(sum(amount),0)::int into v_paid from payments
    where unit_id=p_unit_id and period=p_period and status='active';

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_EDIT', 'payments', v_id::text,
      jsonb_build_object('old_id',p_old_payment_id,'unit_id',p_unit_id,'period',p_period,
                         'amount',p_amount,'fee',v_fee,'kind',p_kind,'method',p_method,'source',v_source));

  return jsonb_build_object('ok',true,'payment_id',v_id,'canceled_id',p_old_payment_id,
    'charged',v_charged,'paid',v_paid,
    'unpaid', case when v_charged is null then null else v_charged - v_paid end);
end $function$;

-- 삭제(취소)한 수납 되살리기
create or replace function public.restore_payment(p_payment_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_org bigint; v_unit bigint; v_period date; v_status text; v_replaced bigint;
        v_charged int; v_paid int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;

  select p.unit_id, p.period, p.status, p.replaced_by into v_unit, v_period, v_status, v_replaced
    from payments p
   where p.id = p_payment_id and p.org_id = v_org
     and exists (select 1 from units u join buildings b on b.id=u.building_id
                 where u.id=p.unit_id and b.org_id=v_org and u.deleted_at is null)
   for update of p;
  if v_unit is null then raise exception 'payment not found'; end if;
  if v_status <> 'canceled' then raise exception '이미 정상 상태인 수납이에요'; end if;
  if v_replaced is not null then raise exception '수정으로 대체된 수납은 되살릴 수 없어요'; end if;

  begin
    update payments set status='active', canceled_at=null, canceled_by=null
     where id = p_payment_id;
  exception when unique_violation then
    raise exception '같은 내역의 수납이 이미 있어 되살릴 수 없어요';
  end;

  select bc.total_amount into v_charged from billing_confirmations bc
    where bc.unit_id=v_unit and bc.period=v_period;
  select coalesce(sum(amount),0)::int into v_paid from payments
    where unit_id=v_unit and period=v_period and status='active';

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_RESTORE', 'payments', p_payment_id::text,
      jsonb_build_object('unit_id',v_unit,'period',v_period));

  return jsonb_build_object('ok',true,'unit_id',v_unit,'period',v_period,'charged',v_charged,'paid',v_paid,
    'unpaid', case when v_charged is null then null else v_charged - v_paid end);
end $function$;

revoke execute on function public.restore_payment(bigint) from public, anon;
grant execute on function public.restore_payment(bigint) to authenticated;

-- 일괄 저장에 restore op 추가
create or replace function public.save_payment_history(p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_op jsonb;
  v_canceled int := 0;
  v_recorded int := 0;
  v_edited int := 0;
  v_restored int := 0;
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
        perform record_payment(
          (v_op->>'unit_id')::bigint, (v_op->>'period')::date, (v_op->>'amount')::int,
          v_op->>'method', v_op->>'kind', v_op->>'memo', (v_op->>'paid_at')::date,
          coalesce((v_op->>'fee')::int, 0));
        v_recorded := v_recorded + 1;
      when 'edit' then
        perform record_payment_edit(
          (v_op->>'old_payment_id')::bigint,
          (v_op->>'unit_id')::bigint, (v_op->>'period')::date, (v_op->>'amount')::int,
          v_op->>'method', v_op->>'kind', v_op->>'memo', (v_op->>'paid_at')::date,
          (v_op->>'fee')::int, null);
        v_edited := v_edited + 1;
      else
        raise exception 'invalid op: %', v_op->>'op';
    end case;
  end loop;

  return jsonb_build_object('ok', true, 'canceled', v_canceled, 'recorded', v_recorded,
    'edited', v_edited, 'restored', v_restored);
end $function$;

-- 목록 RPC: replaced_by 포함 (반환 컬럼이 바뀌므로 drop 후 재생성)
drop function if exists public.list_unit_payments(bigint, date);
create function public.list_unit_payments(p_unit_id bigint, p_period date)
returns table(id bigint, amount integer, fee integer, method text, kind text, memo text, paid_at date, status text, created_at timestamp with time zone, replaced_by bigint)
language sql
stable security definer
set search_path to 'public'
as $function$
  select p.id, p.amount, p.fee, p.method, p.kind, p.memo, p.paid_at, p.status, p.created_at, p.replaced_by
  from payments p
  join units u on u.id=p.unit_id
  join buildings b on b.id=u.building_id and b.org_id=current_user_org()
  where p.unit_id=p_unit_id and p.period=p_period
  order by p.created_at desc, p.id desc
$function$;

revoke execute on function public.list_unit_payments(bigint, date) from public, anon;
grant execute on function public.list_unit_payments(bigint, date) to authenticated;

create or replace function public.get_payment_statement_data(p_building_id bigint, p_unit_id bigint, p_start_period date, p_end_period date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_result jsonb;
begin
  v_org := current_user_org();
  if v_org is null then
    raise exception 'no org for caller';
  end if;
  if not exists (
    select 1
    from buildings b
    where b.id = p_building_id
      and b.org_id = v_org
      and b.deleted_at is null
  ) then
    raise exception 'building not in org';
  end if;
  if p_start_period is null
     or p_end_period is null
     or p_start_period <> date_trunc('month', p_start_period)::date
     or p_end_period <> date_trunc('month', p_end_period)::date
     or p_start_period > p_end_period then
    raise exception 'invalid statement period range';
  end if;
  if p_unit_id is not null and not exists (
    select 1
    from units u
    where u.id = p_unit_id
      and u.building_id = p_building_id
      and u.deleted_at is null
  ) then
    raise exception 'unit not in building';
  end if;

  with periods as (
    select generate_series(
      p_start_period::timestamp,
      p_end_period::timestamp,
      interval '1 month'
    )::date as period
  ),
  payment_rows as (
    select periods.period, pr.*
    from periods
    cross join lateral list_payment_rows(p_building_id, periods.period) pr
    where p_unit_id is null or pr.unit_id = p_unit_id
  ),
  statement_units as (
    select pr.period, jsonb_agg(pr.unit_id order by pr.unit_no) as unit_ids
    from payment_rows pr
    group by pr.period
  ),
  documents as (
    select su.period, doc.*
    from statement_units su
    cross join lateral get_bill_documents(
      p_building_id,
      su.period,
      su.unit_ids
    ) doc
  ),
  payment_history as (
    select
      p.id,
      p.unit_id,
      p.period,
      p.amount,
      p.fee,
      p.method,
      p.kind,
      p.memo,
      p.paid_at,
      p.status,
      p.created_at,
      p.replaced_by
    from payments p
    join units u on u.id = p.unit_id
    join buildings b
      on b.id = u.building_id
     and b.org_id = v_org
    where u.building_id = p_building_id
      and (p_unit_id is null or p.unit_id = p_unit_id)
      and p.period between p_start_period and p_end_period
  ),
  utility_kinds as (
    select *
    from (values
      ('electricity'::text, 'elec'::text),
      ('water'::text, 'water'::text),
      ('gas'::text, 'gas'::text)
    ) as value(utility_type, db_utility)
  ),
  utility_rows as (
    select periods.period, uk.utility_type, ur.*
    from periods
    cross join utility_kinds uk
    cross join lateral list_utility_rows(
      p_building_id,
      uk.db_utility,
      periods.period
    ) ur
    where p_unit_id is null or ur.unit_id = p_unit_id
  )
  select jsonb_build_object(
    'payment_rows', coalesce((
      select jsonb_agg(to_jsonb(pr) order by pr.period, pr.unit_no)
      from payment_rows pr
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(
        to_jsonb(ph)
        order by
          case when p_unit_id is null then ph.paid_at end asc,
          case when p_unit_id is not null then ph.created_at end desc,
          ph.id desc
      )
      from payment_history ph
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(doc) order by doc.period, doc.unit_no)
      from documents doc
    ), '[]'::jsonb),
    'utilities', jsonb_build_object(
      'electricity', coalesce((
        select jsonb_agg(
          to_jsonb(ur) - 'utility_type'
          order by ur.period, ur.unit_no
        )
        from utility_rows ur
        where ur.utility_type = 'electricity'
      ), '[]'::jsonb),
      'water', coalesce((
        select jsonb_agg(
          to_jsonb(ur) - 'utility_type'
          order by ur.period, ur.unit_no
        )
        from utility_rows ur
        where ur.utility_type = 'water'
      ), '[]'::jsonb),
      'gas', coalesce((
        select jsonb_agg(
          to_jsonb(ur) - 'utility_type'
          order by ur.period, ur.unit_no
        )
        from utility_rows ur
        where ur.utility_type = 'gas'
      ), '[]'::jsonb)
    )
  ) into v_result;

  return v_result;
end;
$function$;

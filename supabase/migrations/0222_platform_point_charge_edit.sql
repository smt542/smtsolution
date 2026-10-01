-- 2026-10-01 QA 2차 관리자 4 — Figma 신규 팝빌 포인트 모달(충전 기록 수정·삭제).

-- point_transactions has no inbound foreign keys or cached balance. Charge rows
-- can therefore be hard-deleted after the same balance/reservation checks used
-- by platform_record_point_adjustment.

-- The ledger is append-only for direct callers. These two RPCs are the only
-- controlled exception, scoped to one charge row and one operation per call.
create or replace function public.prevent_point_transaction_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Organization purge is the existing, explicitly scoped exception.
  if tg_op = 'DELETE'
     and old.org_id is not null
     and current_setting('app.purge_org_id', true) = old.org_id::text then
    return old;
  end if;

  -- Charge edit/delete RPCs set both values locally and only after locking the
  -- target organization and charge row.
  if old.type = 'charge'::public.point_tx_type
     and current_setting('app.point_charge_mutation_id', true) = old.id::text
     and current_setting('app.point_charge_mutation_operation', true) = tg_op then
    if tg_op = 'DELETE' then
      return old;
    end if;
    if tg_op = 'UPDATE'
       and new.id = old.id
       and new.org_id = old.org_id
       and new.type = old.type then
      return new;
    end if;
  end if;

  -- auth.users deletion may still null point_transactions.created_by.
  if tg_op = 'UPDATE'
     and old.created_by is not null
     and new.created_by is null
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by')
     and not exists (
       select 1
       from auth.users auth_user
       where auth_user.id = old.created_by
     ) then
    return new;
  end if;

  raise exception 'point transactions are append-only' using errcode = '55000';
end
$$;

revoke all on function public.prevent_point_transaction_mutation() from public, anon, authenticated;

create or replace function public.platform_update_point_charge(
  p_tx_id bigint default null,
  p_points integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id bigint;
  v_ledger_balance bigint;
  v_reserved_points bigint;
  v_after_balance bigint;
  v_delta bigint;
  v_charge public.point_transactions%rowtype;
  v_updated_charge public.point_transactions%rowtype;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_tx_id is null or p_tx_id <= 0 then
    raise exception 'invalid transaction id: positive integer required' using errcode = '22023';
  end if;
  if p_points is null or p_points <= 0 then
    raise exception 'invalid points: positive integer required' using errcode = '22023';
  end if;

  select point_transaction.org_id
  into v_org_id
  from public.point_transactions point_transaction
  where point_transaction.id = p_tx_id
    and point_transaction.type = 'charge'::public.point_tx_type;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'POINT_CHARGE_NOT_FOUND');
  end if;

  perform 1
  from public.organizations organization
  where organization.id = v_org_id
  for update;
  if not found then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;

  select *
  into v_charge
  from public.point_transactions point_transaction
  where point_transaction.id = p_tx_id
    and point_transaction.type = 'charge'::public.point_tx_type
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'POINT_CHARGE_NOT_FOUND');
  end if;

  select coalesce(sum(point_transaction.points), 0)::bigint
  into v_ledger_balance
  from public.point_transactions point_transaction
  where point_transaction.org_id = v_org_id;

  select coalesce(sum(reservation.reserved_points), 0)::bigint
  into v_reserved_points
  from public.message_point_reservations reservation
  where reservation.org_id = v_org_id
    and reservation.status in ('reserved', 'provider_pending', 'reconcile_required');

  v_delta := p_points::bigint - v_charge.points::bigint;
  v_after_balance := v_ledger_balance + v_delta;
  if v_delta < 0 and v_after_balance < v_reserved_points then
    return jsonb_build_object(
      'ok', false,
      'code', case when v_reserved_points > 0 then 'POINTS_RESERVED' else 'INSUFFICIENT_POINTS' end,
      'ledger_balance', v_ledger_balance,
      'reserved_points', v_reserved_points
    );
  end if;

  perform set_config('app.point_charge_mutation_id', p_tx_id::text, true);
  perform set_config('app.point_charge_mutation_operation', 'UPDATE', true);

  update public.point_transactions
  set points = p_points,
      amount_krw = p_points
  where id = p_tx_id
    and org_id = v_org_id
    and type = 'charge'::public.point_tx_type
  returning * into v_updated_charge;

  perform set_config('app.point_charge_mutation_id', '', true);
  perform set_config('app.point_charge_mutation_operation', '', true);

  insert into public.audit_log(
    org_id, actor_id, action, table_name, row_pk, before, after
  ) values (
    v_org_id,
    (select auth.uid()),
    'PLATFORM_POINT_CHARGE_UPDATE',
    'point_transactions',
    p_tx_id::text,
    to_jsonb(v_charge),
    to_jsonb(v_updated_charge)
  );

  return jsonb_build_object(
    'ok', true,
    'transaction_id', p_tx_id,
    'points', p_points,
    'amount_krw', p_points
  );
end
$$;

revoke all on function public.platform_update_point_charge(bigint, integer)
  from public, anon;
grant execute on function public.platform_update_point_charge(bigint, integer)
  to authenticated;

create or replace function public.platform_delete_point_charge(
  p_tx_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id bigint;
  v_ledger_balance bigint;
  v_reserved_points bigint;
  v_after_balance bigint;
  v_charge public.point_transactions%rowtype;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_tx_id is null or p_tx_id <= 0 then
    raise exception 'invalid transaction id: positive integer required' using errcode = '22023';
  end if;

  select point_transaction.org_id
  into v_org_id
  from public.point_transactions point_transaction
  where point_transaction.id = p_tx_id
    and point_transaction.type = 'charge'::public.point_tx_type;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'POINT_CHARGE_NOT_FOUND');
  end if;

  perform 1
  from public.organizations organization
  where organization.id = v_org_id
  for update;
  if not found then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;

  select *
  into v_charge
  from public.point_transactions point_transaction
  where point_transaction.id = p_tx_id
    and point_transaction.type = 'charge'::public.point_tx_type
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'POINT_CHARGE_NOT_FOUND');
  end if;

  select coalesce(sum(point_transaction.points), 0)::bigint
  into v_ledger_balance
  from public.point_transactions point_transaction
  where point_transaction.org_id = v_org_id;

  select coalesce(sum(reservation.reserved_points), 0)::bigint
  into v_reserved_points
  from public.message_point_reservations reservation
  where reservation.org_id = v_org_id
    and reservation.status in ('reserved', 'provider_pending', 'reconcile_required');

  v_after_balance := v_ledger_balance - v_charge.points;
  if v_after_balance < v_reserved_points then
    return jsonb_build_object(
      'ok', false,
      'code', case when v_reserved_points > 0 then 'POINTS_RESERVED' else 'INSUFFICIENT_POINTS' end,
      'ledger_balance', v_ledger_balance,
      'reserved_points', v_reserved_points
    );
  end if;

  perform set_config('app.point_charge_mutation_id', p_tx_id::text, true);
  perform set_config('app.point_charge_mutation_operation', 'DELETE', true);

  delete from public.point_transactions
  where id = p_tx_id
    and org_id = v_org_id
    and type = 'charge'::public.point_tx_type;

  perform set_config('app.point_charge_mutation_id', '', true);
  perform set_config('app.point_charge_mutation_operation', '', true);

  insert into public.audit_log(
    org_id, actor_id, action, table_name, row_pk, before, after
  ) values (
    v_org_id,
    (select auth.uid()),
    'PLATFORM_POINT_CHARGE_DELETE',
    'point_transactions',
    p_tx_id::text,
    to_jsonb(v_charge),
    null
  );

  return jsonb_build_object('ok', true, 'transaction_id', p_tx_id);
end
$$;

revoke all on function public.platform_delete_point_charge(bigint)
  from public, anon;
grant execute on function public.platform_delete_point_charge(bigint)
  to authenticated;

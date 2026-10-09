-- 개선3차 36·39: 포인트 원장은 본사 단일 풀이다. 충전은 org_id null(본사)로 기록하고,
-- 테넌트 완전삭제(platform_purge_organization)가 원장 행을 지우지 않도록 FK를 SET NULL로 바꾼다.
-- (기존 행의 org_id는 그대로 둔다. 조직이 삭제될 때만 FK가 null로 바꾼다.)

alter table public.point_transactions alter column org_id drop not null;

alter table public.point_transactions drop constraint point_transactions_org_id_fkey;
alter table public.point_transactions
  add constraint point_transactions_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete set null;

alter table public.point_transactions drop constraint point_transactions_message_log_id_fkey;
alter table public.point_transactions
  add constraint point_transactions_message_log_id_fkey
  foreign key (message_log_id) references public.message_logs(id) on delete set null;

alter table public.point_transactions drop constraint point_transactions_reservation_id_fkey;
alter table public.point_transactions
  add constraint point_transactions_reservation_id_fkey
  foreign key (reservation_id) references public.message_point_reservations(id) on delete set null;

-- append-only 트리거: 부모(조직·예약·메시지로그·auth 사용자) 삭제로 인한 FK SET NULL만 허용한다.
create or replace function public.prevent_point_transaction_mutation()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if tg_op = 'DELETE'
     and old.org_id is not null
     and current_setting('app.purge_org_id', true) = old.org_id::text then
    return old;
  end if;

  if old.type = 'charge'::public.point_tx_type
     and current_setting('app.point_charge_mutation_id', true) = old.id::text
     and current_setting('app.point_charge_mutation_operation', true) = tg_op then
    if tg_op = 'DELETE' then
      return old;
    end if;
    if tg_op = 'UPDATE'
       and new.id = old.id
       and new.org_id is not distinct from old.org_id
       and new.type = old.type then
      return new;
    end if;
  end if;

  -- 부모 행 삭제에 따른 FK SET NULL (created_by / org_id / reservation_id / message_log_id).
  -- 나머지 컬럼은 동일해야 하고, null로 바뀌는 컬럼의 부모는 실제로 사라져 있어야 한다.
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'created_by' - 'org_id' - 'reservation_id' - 'message_log_id')
         = (to_jsonb(old) - 'created_by' - 'org_id' - 'reservation_id' - 'message_log_id')
     and (new.created_by is not distinct from old.created_by
          or (old.created_by is not null and new.created_by is null
              and not exists (select 1 from auth.users u where u.id = old.created_by)))
     and (new.org_id is not distinct from old.org_id
          or (old.org_id is not null and new.org_id is null
              and not exists (select 1 from public.organizations o where o.id = old.org_id)))
     and (new.reservation_id is not distinct from old.reservation_id
          or (old.reservation_id is not null and new.reservation_id is null
              and not exists (select 1 from public.message_point_reservations r where r.id = old.reservation_id)))
     and (new.message_log_id is not distinct from old.message_log_id
          or (old.message_log_id is not null and new.message_log_id is null
              and not exists (select 1 from public.message_logs l where l.id = old.message_log_id))) then
    return new;
  end if;

  raise exception 'point transactions are append-only' using errcode = '55000';
end
$function$;

-- 충전: p_org_id null = 본사 충전(조직 귀속 없음). 값이 있으면 기존처럼 조직 존재를 확인한다.
create or replace function public.platform_record_point_charge(p_org_id bigint, p_points integer, p_amount_krw integer, p_memo text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_transaction_id bigint;
begin
  if not public.current_user_can_manage_hq_accounts() then
    raise exception 'forbidden: hq master/operations required' using errcode = '42501';
  end if;
  if p_points is null or p_points <= 0 then
    raise exception 'invalid points: positive integer required' using errcode = '22023';
  end if;
  if p_amount_krw is null or p_amount_krw < 0 then
    raise exception 'invalid amount: zero or positive integer required' using errcode = '22023';
  end if;
  if length(coalesce(p_memo, '')) > 200 then
    raise exception 'invalid memo: 200 characters or fewer required' using errcode = '22023';
  end if;

  if p_org_id is not null then
    perform 1
    from public.organizations organization
    where organization.id = p_org_id
    for update;
    if not found then
      raise exception 'organization not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.point_transactions(
    org_id, type, points, amount_krw, memo, created_by
  ) values (
    p_org_id,
    'charge'::public.point_tx_type,
    p_points,
    p_amount_krw,
    nullif(btrim(coalesce(p_memo, '')), ''),
    (select auth.uid())
  ) returning id into v_transaction_id;

  return jsonb_build_object('ok', true, 'transaction_id', v_transaction_id);
end
$function$;

-- 충전 수정: org_id null(본사) 충전 행도 처리한다.
create or replace function public.platform_update_point_charge(p_tx_id bigint default null::bigint, p_points integer default null::integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_org_id bigint;
  v_ledger_balance bigint;
  v_reserved_points bigint;
  v_after_balance bigint;
  v_delta bigint;
  v_charge public.point_transactions%rowtype;
  v_updated_charge public.point_transactions%rowtype;
begin
  if not public.current_user_can_manage_hq_accounts() then
    raise exception 'forbidden: hq master/operations required' using errcode = '42501';
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

  if v_org_id is not null then
    perform 1
    from public.organizations organization
    where organization.id = v_org_id
    for update;
    if not found then
      raise exception 'organization not found' using errcode = 'P0002';
    end if;
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

  perform public.lock_point_pool();
  select coalesce(sum(point_transaction.points), 0)::bigint
  into v_ledger_balance
  from public.point_transactions point_transaction;

  select coalesce(sum(reservation.reserved_points), 0)::bigint
  into v_reserved_points
  from public.message_point_reservations reservation
  where reservation.status in ('reserved', 'provider_pending', 'reconcile_required');

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
    and org_id is not distinct from v_org_id
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
$function$;

create or replace function public.platform_delete_point_charge(p_tx_id bigint default null::bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_org_id bigint;
  v_ledger_balance bigint;
  v_reserved_points bigint;
  v_after_balance bigint;
  v_charge public.point_transactions%rowtype;
begin
  if not public.current_user_can_manage_hq_accounts() then
    raise exception 'forbidden: hq master/operations required' using errcode = '42501';
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

  if v_org_id is not null then
    perform 1
    from public.organizations organization
    where organization.id = v_org_id
    for update;
    if not found then
      raise exception 'organization not found' using errcode = 'P0002';
    end if;
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

  perform public.lock_point_pool();
  select coalesce(sum(point_transaction.points), 0)::bigint
  into v_ledger_balance
  from public.point_transactions point_transaction;

  select coalesce(sum(reservation.reserved_points), 0)::bigint
  into v_reserved_points
  from public.message_point_reservations reservation
  where reservation.status in ('reserved', 'provider_pending', 'reconcile_required');

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
    and org_id is not distinct from v_org_id
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
$function$;

-- 거래 목록: 본사 충전(org_id null)도 보이도록 organizations를 left join.
create or replace function public.platform_list_point_transactions(p_type text default null::text, p_before_created_at timestamp with time zone default null::timestamp with time zone, p_before_id bigint default null::bigint, p_limit integer default 50)
 returns table(id bigint, org_id bigint, organization_name text, type point_tx_type, points integer, amount_krw integer, memo text, created_by uuid, created_by_name text, created_at timestamp with time zone, total_count bigint)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_type is not null and p_type not in ('charge', 'usage', 'adjustment') then
    raise exception 'invalid point transaction type' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'limit must be between 1 and 100' using errcode = '22023';
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'cursor timestamp and id must be provided together' using errcode = '22023';
  end if;

  return query
  with joined_transactions as (
    select
      point_transaction.id,
      point_transaction.org_id,
      organization.name as organization_name,
      point_transaction.type,
      point_transaction.points,
      point_transaction.amount_krw,
      point_transaction.memo,
      point_transaction.created_by,
      profile.full_name as created_by_name,
      point_transaction.created_at,
      count(*) over ()::bigint as total_count
    from public.point_transactions point_transaction
    left join public.organizations organization on organization.id = point_transaction.org_id
    left join public.profiles profile on profile.user_id = point_transaction.created_by
    where p_type is null or point_transaction.type::text = p_type
  )
  select
    point_transaction.id,
    point_transaction.org_id,
    point_transaction.organization_name,
    point_transaction.type,
    point_transaction.points,
    point_transaction.amount_krw,
    point_transaction.memo,
    point_transaction.created_by,
    point_transaction.created_by_name,
    point_transaction.created_at,
    point_transaction.total_count
  from joined_transactions point_transaction
  where p_before_created_at is null
    or (point_transaction.created_at, point_transaction.id) < (p_before_created_at, p_before_id)
  order by point_transaction.created_at desc, point_transaction.id desc
  limit p_limit;
end
$function$;

-- 테넌트 완전삭제: 포인트 원장(point_transactions)은 지우지 않는다(FK SET NULL로 보존).
create or replace function public.platform_purge_organization(p_org_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_contract_paths text[];
  v_user_ids uuid[];
  v_contract_objects text[];
  v_attachment_objects text[];
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;

  select coalesce(organization.contract_file_paths, '{}'::text[])
    || case when organization.contract_file_path is null then '{}'::text[] else array[organization.contract_file_path] end
  into v_contract_paths
  from public.organizations organization
  where organization.id = p_org_id
  for update;
  if not found then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.org_members member
    where member.org_id = p_org_id
      and member.role = 'platform_admin'::public.org_member_role
  ) then
    raise exception 'organization has platform admin members'
      using errcode = 'P0001', hint = 'PLATFORM_ADMIN_MEMBER';
  end if;

  -- 로그인 계정까지 지울 직원: 이 조직에만 속하고 세입자 계정도 아닌 사람.
  select coalesce(array_agg(member.user_id), '{}')
  into v_user_ids
  from public.org_members member
  where member.org_id = p_org_id
    and not exists (
      select 1 from public.org_members other
      where other.user_id = member.user_id and other.org_id <> p_org_id
    )
    and not exists (
      select 1 from public.resident_identities identity
      where identity.user_id = member.user_id
    );

  select coalesce(array_agg(object.name), '{}')
  into v_contract_objects
  from storage.objects object
  where object.bucket_id = 'org-contracts'
    and (object.name like p_org_id::text || '/%' or object.name = any(v_contract_paths));

  select coalesce(array_agg(object.name), '{}')
  into v_attachment_objects
  from storage.objects object
  where object.bucket_id = 'attachments'
    and object.name like p_org_id::text || '/%';

  perform set_config('app.purge_org_id', p_org_id::text, true);

  delete from public.provider_dispatch_jobs job where job.org_id = p_org_id;
  -- point_transactions는 본사 단일 풀 원장이라 삭제하지 않는다(org_id/reservation_id/message_log_id는 FK가 null 처리).
  delete from public.message_point_reservations reservation where reservation.org_id = p_org_id;
  delete from public.platform_billing_invoices invoice where invoice.org_id = p_org_id;
  delete from public.organizations organization where organization.id = p_org_id;
  delete from public.audit_log log where log.org_id = p_org_id;
  delete from public.access_log log where log.org_id = p_org_id;

  return jsonb_build_object(
    'user_ids', to_jsonb(v_user_ids),
    'contract_objects', to_jsonb(v_contract_objects),
    'attachment_objects', to_jsonb(v_attachment_objects)
  );
end
$function$;

-- 항목 39: 화면 잔액·경고용. 실제 발송 허용 판정과 같은 point_pool_balance()를 본사 전용으로 감싼다.
create or replace function public.platform_get_point_pool_balance()
 returns table(ledger_balance bigint, reserved_points bigint, available_points bigint)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  return query select * from public.point_pool_balance();
end
$function$;

revoke all on function public.platform_get_point_pool_balance() from public, anon;
grant execute on function public.platform_get_point_pool_balance() to authenticated, service_role;

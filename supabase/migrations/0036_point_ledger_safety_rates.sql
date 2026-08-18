-- P4-point 1/2: 포인트 원장 안전화 + 메시지 채널 단가
-- 의존: 0000(organizations, audit_log), 0011(point_transactions, platform_admin),
--       0033(organizations.deleted_at), 0035(point_tx_type.adjustment)

-- ===== 채널별 버전 단가 =====
create table public.message_point_rates (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('sms', 'alimtalk')),
  points integer not null check (points > 0),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

create unique index message_point_rates_one_active
  on public.message_point_rates(channel)
  where effective_to is null;

create index message_point_rates_history_idx
  on public.message_point_rates(channel, effective_from desc);

alter table public.message_point_rates enable row level security;
revoke insert, update, delete, truncate on public.message_point_rates
  from anon, authenticated;

insert into public.message_point_rates(channel, points)
select seed.channel, seed.points
from (values ('sms', 1), ('alimtalk', 1)) as seed(channel, points)
where not exists (
  select 1
  from public.message_point_rates rate
  where rate.channel = seed.channel and rate.effective_to is null
);

-- ===== 포인트 원장 append-only =====
drop policy if exists pt_platform on public.point_transactions;
drop policy if exists pt_platform_select on public.point_transactions;
create policy pt_platform_select on public.point_transactions
  for select to authenticated
  using (public.current_user_is_platform_admin());

revoke insert, update, delete, truncate on public.point_transactions
  from anon, authenticated;

create or replace function public.prevent_point_transaction_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'point transactions are append-only' using errcode = '55000';
end
$$;

revoke all on function public.prevent_point_transaction_mutation() from public;

drop trigger if exists trg_point_transactions_append_only
  on public.point_transactions;
create trigger trg_point_transactions_append_only
  before update or delete on public.point_transactions
  for each row execute function public.prevent_point_transaction_mutation();

-- ===== 단가 조회·변경 RPC =====
create or replace function public.list_current_message_point_rates()
returns table (
  id bigint,
  channel text,
  points integer,
  effective_from timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select rate.id, rate.channel, rate.points, rate.effective_from
  from public.message_point_rates rate
  where rate.effective_to is null
  order by rate.channel;
end
$$;

revoke all on function public.list_current_message_point_rates() from public, anon;
grant execute on function public.list_current_message_point_rates() to authenticated;

create or replace function public.platform_list_message_point_rates(
  p_include_history boolean default false
)
returns table (
  id bigint,
  channel text,
  points integer,
  effective_from timestamptz,
  effective_to timestamptz,
  is_active boolean,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;

  return query
  select
    rate.id,
    rate.channel,
    rate.points,
    rate.effective_from,
    rate.effective_to,
    rate.effective_to is null,
    rate.created_by,
    rate.created_at
  from public.message_point_rates rate
  where coalesce(p_include_history, false) or rate.effective_to is null
  order by rate.channel, rate.effective_from desc, rate.id desc;
end
$$;

revoke all on function public.platform_list_message_point_rates(boolean)
  from public, anon;
grant execute on function public.platform_list_message_point_rates(boolean)
  to authenticated;

create or replace function public.platform_set_message_point_rates(
  p_sms_points integer,
  p_alimtalk_points integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_before jsonb;
  v_after jsonb;
  v_sms_current integer;
  v_alimtalk_current integer;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_sms_points is null or p_sms_points <= 0
    or p_alimtalk_points is null or p_alimtalk_points <= 0 then
    raise exception 'invalid rates: positive integers required' using errcode = '22023';
  end if;

  lock table public.message_point_rates in share row exclusive mode;

  select coalesce(
    jsonb_object_agg(rate.channel, rate.points),
    '{}'::jsonb
  )
  into v_before
  from public.message_point_rates rate
  where rate.effective_to is null;

  select rate.points into v_sms_current
  from public.message_point_rates rate
  where rate.channel = 'sms' and rate.effective_to is null;

  select rate.points into v_alimtalk_current
  from public.message_point_rates rate
  where rate.channel = 'alimtalk' and rate.effective_to is null;

  if v_sms_current is distinct from p_sms_points then
    update public.message_point_rates
      set effective_to = v_now
      where channel = 'sms' and effective_to is null;
    insert into public.message_point_rates(
      channel, points, effective_from, created_by
    ) values ('sms', p_sms_points, v_now, (select auth.uid()));
  end if;

  if v_alimtalk_current is distinct from p_alimtalk_points then
    update public.message_point_rates
      set effective_to = v_now
      where channel = 'alimtalk' and effective_to is null;
    insert into public.message_point_rates(
      channel, points, effective_from, created_by
    ) values ('alimtalk', p_alimtalk_points, v_now, (select auth.uid()));
  end if;

  select coalesce(
    jsonb_object_agg(rate.channel, rate.points),
    '{}'::jsonb
  )
  into v_after
  from public.message_point_rates rate
  where rate.effective_to is null;

  if v_before is distinct from v_after then
    insert into public.audit_log(
      org_id, actor_id, action, table_name, row_pk, before, after
    ) values (
      null,
      (select auth.uid()),
      'MESSAGE_POINT_RATE_UPDATE',
      'message_point_rates',
      'global',
      v_before,
      v_after
    );
  end if;

  return jsonb_build_object('ok', true, 'rates', v_after);
end
$$;

revoke all on function public.platform_set_message_point_rates(integer, integer)
  from public, anon;
grant execute on function public.platform_set_message_point_rates(integer, integer)
  to authenticated;

-- ===== 포인트 원장 쓰기 RPC =====
create or replace function public.platform_record_point_charge(
  p_org_id bigint,
  p_points integer,
  p_amount_krw integer,
  p_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_id bigint;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
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

  perform 1
  from public.organizations organization
  where organization.id = p_org_id
  for update;
  if not found then
    raise exception 'organization not found' using errcode = 'P0002';
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

  return jsonb_build_object(
    'ok', true,
    'transaction_id', v_transaction_id
  );
end
$$;

revoke all on function public.platform_record_point_charge(bigint, integer, integer, text)
  from public, anon;
grant execute on function public.platform_record_point_charge(bigint, integer, integer, text)
  to authenticated;

create or replace function public.platform_record_point_adjustment(
  p_org_id bigint,
  p_kind text,
  p_points integer,
  p_amount_krw integer default null,
  p_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_id bigint;
  v_ledger_balance bigint;
  v_after_balance bigint;
  v_label text;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_kind not in ('correction', 'deduction', 'refund') then
    raise exception 'invalid adjustment kind' using errcode = '22023';
  end if;
  if p_points is null or p_points = 0 then
    raise exception 'invalid points: nonzero integer required' using errcode = '22023';
  end if;
  if p_kind in ('deduction', 'refund') and p_points >= 0 then
    raise exception 'invalid points: deduction/refund must be negative' using errcode = '22023';
  end if;
  if p_amount_krw is not null and p_amount_krw < 0 then
    raise exception 'invalid amount: zero or positive integer required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_memo, '')), '') is null
    or length(btrim(p_memo)) > 200 then
    raise exception 'invalid memo: 1-200 characters required' using errcode = '22023';
  end if;

  perform 1
  from public.organizations organization
  where organization.id = p_org_id
  for update;
  if not found then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(point_transaction.points), 0)::bigint
  into v_ledger_balance
  from public.point_transactions point_transaction
  where point_transaction.org_id = p_org_id;
  v_after_balance := v_ledger_balance + p_points;

  if p_points < 0 and v_after_balance < 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INSUFFICIENT_POINTS',
      'ledger_balance', v_ledger_balance,
      'reserved_points', 0
    );
  end if;

  v_label := case p_kind
    when 'correction' then '정정'
    when 'deduction' then '차감'
    when 'refund' then '환불'
  end;

  insert into public.point_transactions(
    org_id, type, points, amount_krw, memo, created_by
  ) values (
    p_org_id,
    'adjustment'::public.point_tx_type,
    p_points,
    case when p_kind = 'refund' then p_amount_krw else null end,
    '[' || v_label || '] ' || btrim(p_memo),
    (select auth.uid())
  ) returning id into v_transaction_id;

  return jsonb_build_object(
    'ok', true,
    'transaction_id', v_transaction_id
  );
end
$$;

revoke all on function public.platform_record_point_adjustment(bigint, text, integer, integer, text)
  from public, anon;
grant execute on function public.platform_record_point_adjustment(bigint, text, integer, integer, text)
  to authenticated;

-- 0037에서 같은 반환형을 유지한 채 활성 예약 합계를 포함하도록 body를 교체한다.
create or replace function public.platform_list_point_balances()
returns table (
  org_id bigint,
  ledger_balance bigint,
  reserved_points bigint,
  available_points bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;

  return query
  select
    organization.id,
    coalesce(sum(point_transaction.points), 0)::bigint,
    0::bigint,
    coalesce(sum(point_transaction.points), 0)::bigint
  from public.organizations organization
  left join public.point_transactions point_transaction
    on point_transaction.org_id = organization.id
  group by organization.id
  order by organization.id;
end
$$;

revoke all on function public.platform_list_point_balances() from public, anon;
grant execute on function public.platform_list_point_balances() to authenticated;

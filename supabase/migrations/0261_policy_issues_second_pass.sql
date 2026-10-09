-- 0261: 정책 문제점 개선 2차
-- - HQ 업무 원문 직접 SELECT 제거
-- - 건물·세대·입주자 주요 행 변경 감사
-- - resident pending 서버 정본/퇴실일 최소 3일
-- - 공개 고지서 고지월+12개월 만료
-- - access_log 90일 보존
-- - partner 다중 연락처 조회

-- ── HQ는 운영 메타데이터만 조회한다 ────────────────────────────────────────
drop policy if exists building_platform_select on public.buildings;
drop policy if exists unit_platform_select on public.units;
drop policy if exists occ_platform_select on public.occupancies;
drop policy if exists room_type_platform_select on public.room_types;

create or replace function public.platform_get_basic_overview()
returns table (
  active_organization_count bigint,
  account_count bigint,
  building_count bigint
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
    (select count(*) from public.organizations o
      where o.status = 'active' and o.deleted_at is null),
    (select count(*) from public.org_members m),
    (select count(*) from public.buildings b where b.deleted_at is null);
end
$$;

revoke all on function public.platform_get_basic_overview() from public, anon;
grant execute on function public.platform_get_basic_overview() to authenticated, service_role;

-- ── 건물·입주자 주요 데이터 변경 감사 ───────────────────────────────────────
create or replace function public.audit_major_data_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
  v_org_id bigint;
  v_row_pk text;
begin
  if tg_op <> 'INSERT' then v_before := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_after := to_jsonb(new); end if;
  v_row := coalesce(v_after, v_before);
  v_row_pk := v_row->>'id';

  case tg_table_name
    when 'buildings' then
      v_org_id := nullif(v_row->>'org_id', '')::bigint;
    when 'units' then
      select b.org_id into v_org_id
      from public.buildings b
      where b.id = nullif(v_row->>'building_id', '')::bigint;
    when 'occupancies' then
      select b.org_id into v_org_id
      from public.units u
      join public.buildings b on b.id = u.building_id
      where u.id = nullif(v_row->>'unit_id', '')::bigint;
    when 'lease_contracts' then
      select b.org_id into v_org_id
      from public.occupancies o
      join public.units u on u.id = o.unit_id
      join public.buildings b on b.id = u.building_id
      where o.id = nullif(v_row->>'occupancy_id', '')::bigint;
    when 'unit_accounts' then
      select b.org_id into v_org_id
      from public.units u
      join public.buildings b on b.id = u.building_id
      where u.id = nullif(v_row->>'unit_id', '')::bigint;
    when 'unit_meters' then
      select b.org_id into v_org_id
      from public.units u
      join public.buildings b on b.id = u.building_id
      where u.id = nullif(v_row->>'unit_id', '')::bigint;
    when 'unit_property_listings' then
      select b.org_id into v_org_id
      from public.units u
      join public.buildings b on b.id = u.building_id
      where u.id = nullif(v_row->>'unit_id', '')::bigint;
    else
      raise exception 'unsupported audit table: %', tg_table_name;
  end case;

  insert into public.audit_log(
    org_id, actor_id, action, table_name, row_pk, before, after
  ) values (
    v_org_id,
    auth.uid(),
    upper(tg_op) || '_' || upper(tg_table_name),
    tg_table_name,
    v_row_pk,
    v_before,
    v_after
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function public.audit_major_data_row() from public, anon, authenticated;

drop trigger if exists trg_audit_buildings on public.buildings;
create trigger trg_audit_buildings
after insert or update or delete on public.buildings
for each row execute function public.audit_major_data_row();

drop trigger if exists trg_audit_units on public.units;
create trigger trg_audit_units
after insert or update or delete on public.units
for each row execute function public.audit_major_data_row();

drop trigger if exists trg_audit_occupancies on public.occupancies;
create trigger trg_audit_occupancies
after insert or update or delete on public.occupancies
for each row execute function public.audit_major_data_row();

drop trigger if exists trg_audit_lease_contracts on public.lease_contracts;
create trigger trg_audit_lease_contracts
after insert or update or delete on public.lease_contracts
for each row execute function public.audit_major_data_row();

drop trigger if exists trg_audit_unit_accounts on public.unit_accounts;
create trigger trg_audit_unit_accounts
after insert or update or delete on public.unit_accounts
for each row execute function public.audit_major_data_row();

drop trigger if exists trg_audit_unit_meters on public.unit_meters;
create trigger trg_audit_unit_meters
after insert or update or delete on public.unit_meters
for each row execute function public.audit_major_data_row();

drop trigger if exists trg_audit_unit_property_listings on public.unit_property_listings;
create trigger trg_audit_unit_property_listings
after insert or update or delete on public.unit_property_listings
for each row execute function public.audit_major_data_row();

-- ── 승인대기 서버 정본 ───────────────────────────────────────────────────────
create or replace function public.resident_pending_state()
returns table (
  claim_id bigint,
  building_name text,
  unit_no text,
  requested_at timestamptz,
  company_name text,
  company_phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    coalesce(b.name, ''),
    coalesce(nullif(u.unit_no, ''), nullif(c.claimed_unit_text, ''), ''),
    c.created_at,
    coalesce(nullif(btrim(sc.company_name), ''), o.name),
    coalesce(nullif(btrim(sc.company_phone), ''), nullif(btrim(o.phone), ''))
  from public.res_claims c
  join public.organizations o
    on o.id = c.org_id
   and o.deleted_at is null
   and o.status in ('active', 'trial')
  left join public.buildings b on b.id = c.building_id and b.deleted_at is null
  left join public.units u on u.id = c.unit_id and u.deleted_at is null
  left join public.setup_config sc on sc.org_id = c.org_id
  where c.resident_user_id = auth.uid()
    and c.status = 'pending'
  order by c.created_at desc, c.id desc
  limit 1;
$$;

revoke all on function public.resident_pending_state() from public, anon;
grant execute on function public.resident_pending_state() to authenticated, service_role;

-- ── 퇴실 희망일: KST 오늘 기준 최소 3일 후 ─────────────────────────────────
create or replace function public.resident_create_move_out(
  p_desired_date date,
  p_reason text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link record;
  v_request_id bigint;
  v_min_date date := timezone('Asia/Seoul', now())::date + 3;
begin
  select * into v_link from public.resident_linked_unit();
  if not found then raise exception 'linked occupancy not found'; end if;
  if p_desired_date is null then
    raise exception 'desired date required' using errcode = '22023';
  end if;
  if p_desired_date < v_min_date then
    raise exception 'desired date must be at least 3 days from today' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.move_out_requests mor
    where mor.resident_user_id = auth.uid()
      and mor.status = 'pending'
      and mor.occupancy_id = v_link.occupancy_id
  ) then
    raise exception 'pending move-out request already exists';
  end if;

  insert into public.move_out_requests(
    org_id, resident_user_id, occupancy_id, unit_id, building_id, desired_date, reason
  ) values (
    v_link.org_id, auth.uid(), v_link.occupancy_id, v_link.unit_id,
    v_link.building_id, p_desired_date, p_reason
  ) returning id into v_request_id;
  return v_request_id;
end
$$;

create or replace function public.resident_update_move_out(p_desired_date date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id bigint;
  v_min_date date := timezone('Asia/Seoul', now())::date + 3;
begin
  if p_desired_date is null then
    raise exception 'desired date required' using errcode = '22023';
  end if;
  if p_desired_date < v_min_date then
    raise exception 'desired date must be at least 3 days from today' using errcode = '22023';
  end if;

  select mor.id into v_request_id
  from public.resident_linked_unit() l
  join public.move_out_requests mor
    on mor.resident_user_id = auth.uid()
   and mor.org_id = l.org_id
   and mor.occupancy_id = l.occupancy_id
   and mor.unit_id = l.unit_id
   and mor.building_id = l.building_id
  order by mor.created_at desc, mor.id desc
  limit 1;

  update public.move_out_requests mor
  set desired_date = p_desired_date,
      status = 'pending',
      resolved_at = null,
      resolved_by = null
  where mor.id = v_request_id
    and mor.status in ('pending', 'confirmed');
  if not found then raise exception 'pending move-out request not found'; end if;
end
$$;

revoke all on function public.resident_create_move_out(date, text) from public, anon;
grant execute on function public.resident_create_move_out(date, text) to authenticated;
revoke all on function public.resident_update_move_out(date) from public, anon;
grant execute on function public.resident_update_move_out(date) to authenticated;

-- ── 접속기록 90일 보존 ──────────────────────────────────────────────────────
create or replace function public.purge_access_log(p_retention_days int default 90)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  if p_retention_days is null or p_retention_days < 90 then
    raise exception 'retention must be at least 90 days, got %', p_retention_days;
  end if;
  delete from public.access_log
  where created_at < now() - make_interval(days => p_retention_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end
$$;

comment on function public.purge_access_log(int) is
  '개인정보 처리방침에 따라 접속기록을 기본 90일 보관한 뒤 삭제한다.';
revoke all on function public.purge_access_log(int) from public, anon, authenticated;
grant execute on function public.purge_access_log(int) to service_role;

-- ── 현장관리자 다중 연락처 ──────────────────────────────────────────────────
drop function if exists public.partner_search_tenants(text);
create function public.partner_search_tenants(p_search text default null)
returns table (
  occupancy_id bigint, unit_id bigint, building_id bigint, building_name text,
  unit_no text, dong text, tenant_name text, phone text, move_in_date date,
  phones_more text[]
)
language sql stable security definer set search_path = public as $$
  select o.id, u.id, b.id, b.name, u.unit_no, u.dong, o.tenant_name,
    o.phone, o.move_in_date,
    array(
      select btrim(p.v)
      from unnest(array[o.phone2, o.phone3] || coalesce(o.phones_extra, '{}'::text[]))
        with ordinality as p(v, ord)
      where nullif(btrim(p.v), '') is not null
      order by p.ord
    )
  from public.occupancies o
  join public.units u on u.id = o.unit_id
  join public.buildings b on b.id = u.building_id
  where o.deleted_at is null and o.status = 'occupied' and u.deleted_at is null
    and b.id in (select public.partner_my_building_ids())
    and (
      p_search is null
      or o.tenant_name ilike '%' || p_search || '%'
      or b.name ilike '%' || p_search || '%'
      or exists (
        select 1
        from unnest(array[o.phone, o.phone2, o.phone3] || coalesce(o.phones_extra, '{}'::text[])) p(v)
        where coalesce(p.v, '') ilike '%' || p_search || '%'
           or (
             regexp_replace(p_search, '\D', '', 'g') <> ''
             and regexp_replace(coalesce(p.v, ''), '\D', '', 'g')
                 like '%' || regexp_replace(p_search, '\D', '', 'g') || '%'
           )
      )
    )
  order by o.tenant_name;
$$;

revoke all on function public.partner_search_tenants(text) from public, anon;
grant execute on function public.partner_search_tenants(text) to authenticated, service_role;

drop function if exists public.partner_get_occupancy(bigint);
create function public.partner_get_occupancy(p_unit_id bigint)
returns table(
  unit_id bigint, building_id bigint, building_name text, unit_no text, dong text,
  tenant_name text, payer_name text, phone text, resident_count integer, vehicle_no text,
  move_in_date date, status text, occupancy_id bigint, phones_more text[]
)
language sql stable security definer set search_path = public as $$
  select u.id, b.id, b.name, u.unit_no, u.dong, o.tenant_name, o.payer_name, o.phone,
         o.resident_count, o.vehicle_no, o.move_in_date, coalesce(o.status::text, 'vacant'), o.id,
         array(
           select btrim(p.v)
           from unnest(array[o.phone2, o.phone3] || coalesce(o.phones_extra, '{}'::text[]))
             with ordinality as p(v, ord)
           where nullif(btrim(p.v), '') is not null
           order by p.ord
         )
  from public.units u
  join public.buildings b on b.id = u.building_id
  left join public.occupancies o
    on o.unit_id = u.id and o.deleted_at is null and o.status = 'occupied'
  where u.id = p_unit_id and b.id in (select public.partner_my_building_ids());
$$;

revoke all on function public.partner_get_occupancy(bigint) from public, anon;
grant execute on function public.partner_get_occupancy(bigint) to authenticated, service_role;

-- ── 공개 고지서 링크: 고지월 + 12개월 ──────────────────────────────────────
create or replace function public.public_bill_by_signed(
  p_building_id bigint, p_unit_no text, p_period date, p_sig text, p_issued_day integer
)
returns table(
  period date, building_name text, unit_no text,
  total_amount integer, paid_amount integer, unpaid_amount integer, late_fee integer,
  due_date date, items jsonb, mgmt_bank text, mgmt_acct text, mgmt_holder text,
  expires_at timestamp with time zone, is_expired boolean,
  carryover_unpaid integer, carryover_late_fee integer
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with sig as (
    select (
      p_sig is not null
      and case
        when p_issued_day is null
        then p_sig = public.bill_signature(p_building_id, p_unit_no, p_period)
        else p_sig = public.bill_signature(p_building_id, p_unit_no, p_period, p_issued_day)
      end
    ) as ok
  )
  select
    bc.period, b.name, u.unit_no,
    case when now() < exp.expires_at then bc.total_amount else null end,
    case when now() < exp.expires_at then coalesce(pay.paid_amount, 0)::int else null end,
    case when now() < exp.expires_at
      then greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int else null end,
    case when now() < exp.expires_at
      then round(greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)
        * lf.cumulative_rate / 100.0)::int else null end,
    case when now() < exp.expires_at then issue.due_date else null end,
    case when now() < exp.expires_at then coalesce(charges.items, '[]'::jsonb) else null end,
    case when now() < exp.expires_at then sc.mgmt_bank1 else null end,
    case when now() < exp.expires_at then sc.mgmt_acct1 else null end,
    case when now() < exp.expires_at then sc.mgmt_holder1 else null end,
    exp.expires_at,
    now() >= exp.expires_at,
    case when now() < exp.expires_at then co.carryover_unpaid else null end,
    case when now() < exp.expires_at then co.carryover_late_fee else null end
  from sig
  join public.buildings b on b.id = p_building_id
  join public.units u
    on u.building_id = b.id and u.unit_no = p_unit_no and u.deleted_at is null
  join public.billing_confirmations bc
    on bc.unit_id = u.id and bc.period = p_period and bc.confirmed_at is not null
  left join public.setup_config sc on sc.org_id = b.org_id
  cross join lateral public.bill_carryover(u.id, bc.period) co
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from public.payments p
    where p.unit_id = u.id and p.period = bc.period and p.status = 'active'
  ) pay on true
  left join lateral (
    select bi.due_date
    from public.bill_issues bi
    where bi.unit_id = u.id and bi.period = bc.period
    order by bi.issued_at desc, bi.id desc limit 1
  ) issue on true
  cross join lateral (
    select (date_trunc('month', p_period) + interval '12 months')::timestamptz as expires_at
  ) exp
  left join lateral (
    select coalesce(sum((
      select t.monthly_rate
      from public.late_fee_rate_tiers t
      where t.org_id = b.org_id
        and k.k > t.from_month
        and (t.to_month is null or k.k <= t.to_month)
      order by t.tier_order limit 1
    )), 0)::numeric as cumulative_rate
    from generate_series(1,
      case
        when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0
             and issue.due_date is not null
        then greatest(
          (extract(year from timezone('Asia/Seoul', now()))::int - extract(year from issue.due_date)::int) * 12
          + (extract(month from timezone('Asia/Seoul', now()))::int - extract(month from issue.due_date)::int),
          0
        )
        else 0
      end
    ) as k(k)
  ) lf on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'name', fi.name, 'amount', fic.amount, 'utility', util.u,
        'usage', mr.usage, 'prev_usage', prev.usage
      ) order by fi.sort_order, fi.id
    ) as items
    from public.fee_item_charges fic
    join public.fee_items fi on fi.id = fic.fee_item_id
    cross join lateral (
      select case
        when fi.name like '%수도%' then 'water'
        when fi.name like '%전기%' then 'elec'
        when fi.name like '%가스%' then 'gas'
        else null
      end as u
    ) util
    left join public.meter_readings mr
      on mr.unit_id = fic.unit_id and mr.period = fic.period and mr.utility = util.u
    left join public.meter_readings prev
      on prev.unit_id = fic.unit_id
     and prev.period = (fic.period - interval '1 month')::date
     and prev.utility = util.u
    where fic.unit_id = u.id and fic.period = bc.period and fic.charged = true
  ) charges on true
  where sig.ok;
$function$;

revoke execute on function public.public_bill_by_signed(bigint, text, date, text, integer) from public;
grant execute on function public.public_bill_by_signed(bigint, text, date, text, integer)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

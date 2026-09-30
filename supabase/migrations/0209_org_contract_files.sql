-- 0209: 테넌트 계약서 사진 여러 장(정본 admin/tenants 드롭존 'JPG · PNG · 여러 장 가능').
--
-- 조직당 경로 하나(contract_file_path)만 저장하던 것을 배열 contract_file_paths로 넓힌다. contract_file_path는
-- 첫 장으로 계속 채워 옛 코드와 호환한다.
-- - platform_list_organizations: 반환 칸에 contract_file_paths 추가(반환 형태가 바뀌어 drop 후 다시 만든다)
-- - platform_update_organization_contract: 마지막 인자 p_contract_file_paths(기본 null) 추가 — 옛 호출(경로 하나)도
--   그대로 동작. 인자 목록이 바뀌므로 오버로드가 생기지 않게 옛 함수를 drop 후 다시 만든다
-- - platform_purge_organization(0204): 배열의 계약서 파일도 저장소 정리 대상에 넣는다

alter table public.organizations
  add column if not exists contract_file_paths text[] not null default '{}'::text[];

update public.organizations
set contract_file_paths = array[contract_file_path]
where contract_file_path is not null
  and contract_file_paths = '{}'::text[];

drop function if exists public.platform_list_organizations(text, boolean, text, integer, integer);
create function public.platform_list_organizations(p_search text DEFAULT NULL::text, p_include_deleted boolean DEFAULT false, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id bigint, name text, slug text, status org_status, created_at timestamp with time zone, phone text, deleted_at timestamp with time zone, contract_start_date date, contract_end_date date, representative_name text, business_registration_number text, fax text, email text, address text, region text, operating_hours text, contract_file_path text, contract_file_paths text[], account_count bigint, building_count bigint, unit_count bigint, employee_count bigint, tenant_count bigint, ledger_balance bigint, reserved_points bigint, available_points bigint, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('operating', 'suspended', 'terminated') then
    raise exception 'invalid organization status filter' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'limit must be between 1 and 100' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'offset must be zero or greater' using errcode = '22023';
  end if;

  return query
  with filtered_organizations as (
    select organization.*
    from public.organizations organization
    where
      case p_status
        when 'operating' then
          organization.deleted_at is null
          and organization.status in ('active'::public.org_status, 'trial'::public.org_status)
        when 'suspended' then
          organization.deleted_at is null
          and organization.status = 'suspended'::public.org_status
        when 'terminated' then organization.deleted_at is not null
        else coalesce(p_include_deleted, false) or organization.deleted_at is null
      end
      and (
        nullif(btrim(coalesce(p_search, '')), '') is null
        or organization.name ilike '%' || btrim(p_search) || '%'
        or coalesce(organization.region, '') ilike '%' || btrim(p_search) || '%'
        or coalesce(organization.slug, '') ilike '%' || btrim(p_search) || '%'
      )
  ),
  paged_organizations as (
    select
      organization.*,
      count(*) over ()::bigint as filtered_total_count
    from filtered_organizations organization
    order by organization.created_at desc, organization.id desc
    limit p_limit
    offset p_offset
  ),
  member_counts as (
    select
      member.org_id,
      count(*)::bigint as account_count,
      count(*) filter (
        where member.role not in (
            'tenant'::public.org_member_role,
            'platform_admin'::public.org_member_role
          )
          and member.staff_type <> 'tenant'::public.staff_type
      )::bigint as employee_count
    from public.org_members member
    where member.org_id in (select organization.id from paged_organizations organization)
    group by member.org_id
  ),
  building_counts as (
    select building.org_id, count(*)::bigint as building_count
    from public.buildings building
    where building.deleted_at is null
      and building.org_id in (select organization.id from paged_organizations organization)
    group by building.org_id
  ),
  unit_counts as (
    select building.org_id, count(unit.id)::bigint as unit_count
    from public.buildings building
    join public.units unit on unit.building_id = building.id
    where building.deleted_at is null
      and unit.deleted_at is null
      and building.org_id in (select organization.id from paged_organizations organization)
    group by building.org_id
  ),
  tenant_counts as (
    select building.org_id, count(occupancy.id)::bigint as tenant_count
    from public.buildings building
    join public.units unit on unit.building_id = building.id
    join public.occupancies occupancy on occupancy.unit_id = unit.id
    where building.deleted_at is null
      and unit.deleted_at is null
      and occupancy.deleted_at is null
      and occupancy.status <> 'vacant'::public.occupancy_status
      and building.org_id in (select organization.id from paged_organizations organization)
    group by building.org_id
  ),
  ledger_balances as (
    select
      point_transaction.org_id,
      coalesce(sum(point_transaction.points), 0)::bigint as ledger_balance
    from public.point_transactions point_transaction
    where point_transaction.org_id in (
      select organization.id from paged_organizations organization
    )
    group by point_transaction.org_id
  ),
  reservation_balances as (
    select
      reservation.org_id,
      coalesce(sum(reservation.reserved_points), 0)::bigint as reserved_points
    from public.message_point_reservations reservation
    where reservation.status in ('reserved', 'provider_pending', 'reconcile_required')
      and reservation.org_id in (
        select organization.id from paged_organizations organization
      )
    group by reservation.org_id
  )
  select
    organization.id,
    organization.name,
    organization.slug,
    organization.status,
    organization.created_at,
    organization.phone,
    organization.deleted_at,
    organization.contract_start_date,
    organization.contract_end_date,
    organization.representative_name,
    organization.business_registration_number,
    organization.fax,
    organization.email,
    organization.address,
    organization.region,
    organization.operating_hours,
    organization.contract_file_path,
    organization.contract_file_paths,
    coalesce(member_count.account_count, 0)::bigint,
    coalesce(building_count.building_count, 0)::bigint,
    coalesce(unit_count.unit_count, 0)::bigint,
    coalesce(member_count.employee_count, 0)::bigint,
    coalesce(tenant_count.tenant_count, 0)::bigint,
    coalesce(ledger_balance.ledger_balance, 0)::bigint,
    coalesce(reservation_balance.reserved_points, 0)::bigint,
    (
      coalesce(ledger_balance.ledger_balance, 0)
      - coalesce(reservation_balance.reserved_points, 0)
    )::bigint,
    organization.filtered_total_count
  from paged_organizations organization
  left join member_counts member_count on member_count.org_id = organization.id
  left join building_counts building_count on building_count.org_id = organization.id
  left join unit_counts unit_count on unit_count.org_id = organization.id
  left join tenant_counts tenant_count on tenant_count.org_id = organization.id
  left join ledger_balances ledger_balance on ledger_balance.org_id = organization.id
  left join reservation_balances reservation_balance on reservation_balance.org_id = organization.id
  order by organization.created_at desc, organization.id desc;
end
$$;

revoke all on function public.platform_list_organizations(text, boolean, text, integer, integer) from public, anon;
grant execute on function public.platform_list_organizations(text, boolean, text, integer, integer) to authenticated, service_role;

drop function if exists public.platform_update_organization_contract(bigint, text, text, text, date, date, text, text, text, text, text, text, text, text);
create function public.platform_update_organization_contract(p_org_id bigint, p_name text, p_slug text, p_phone text, p_contract_start_date date, p_contract_end_date date, p_representative_name text, p_business_registration_number text, p_fax text, p_email text, p_address text, p_region text, p_operating_hours text, p_contract_file_path text, p_contract_file_paths text[] DEFAULT NULL::text[])
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_before jsonb;
  v_organization public.organizations;
  v_paths text[];
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'name required' using errcode = '22023';
  end if;
  if p_contract_start_date is null or p_contract_end_date is null then
    raise exception 'contract dates required' using errcode = '22023';
  end if;
  if p_contract_end_date < p_contract_start_date then
    raise exception 'contract end date must not precede start date' using errcode = '22023';
  end if;

  -- 계약서 사진 경로: 배열이 오면 그것(빈 값 빼고 순서 유지), 옛 호출(경로 하나)이면 그 하나.
  v_paths := case
    when p_contract_file_paths is not null then array(
      select btrim(item.path)
      from unnest(p_contract_file_paths) with ordinality as item(path, ord)
      where nullif(btrim(coalesce(item.path, '')), '') is not null
      order by item.ord
    )
    when nullif(btrim(coalesce(p_contract_file_path, '')), '') is not null then array[btrim(p_contract_file_path)]
    else '{}'::text[]
  end;

  select to_jsonb(organization)
  into v_before
  from public.organizations organization
  where organization.id = p_org_id;

  if v_before is null then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;

  update public.organizations organization
  set
    name = btrim(p_name),
    slug = nullif(lower(btrim(coalesce(p_slug, ''))), ''),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    contract_start_date = p_contract_start_date,
    contract_end_date = p_contract_end_date,
    representative_name = nullif(btrim(coalesce(p_representative_name, '')), ''),
    business_registration_number = nullif(btrim(coalesce(p_business_registration_number, '')), ''),
    fax = nullif(btrim(coalesce(p_fax, '')), ''),
    email = nullif(btrim(coalesce(p_email, '')), ''),
    address = nullif(btrim(coalesce(p_address, '')), ''),
    region = nullif(btrim(coalesce(p_region, '')), ''),
    operating_hours = nullif(btrim(coalesce(p_operating_hours, '')), ''),
    contract_file_path = v_paths[1],
    contract_file_paths = v_paths
  where organization.id = p_org_id
  returning organization.* into v_organization;

  insert into public.audit_log (
    org_id,
    actor_id,
    action,
    table_name,
    row_pk,
    before,
    after
  )
  values (
    p_org_id,
    (select auth.uid()),
    'ORG_CONTRACT_UPDATE',
    'organizations',
    p_org_id::text,
    v_before,
    to_jsonb(v_organization)
  );

  return v_organization;
end
$$;

revoke all on function public.platform_update_organization_contract(bigint, text, text, text, date, date, text, text, text, text, text, text, text, text, text[]) from public, anon;
grant execute on function public.platform_update_organization_contract(bigint, text, text, text, date, date, text, text, text, text, text, text, text, text, text[]) to authenticated, service_role;

create or replace function public.platform_purge_organization(p_org_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  delete from public.point_transactions tx where tx.org_id = p_org_id;
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
$$;

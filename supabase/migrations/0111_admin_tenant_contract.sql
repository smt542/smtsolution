-- Batch 3a: platform tenant contract management.
-- This migration intentionally keeps organization termination as deleted_at soft-delete.

alter table public.organizations
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date date,
  add column if not exists representative_name text,
  add column if not exists business_registration_number text,
  add column if not exists fax text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists region text,
  add column if not exists operating_hours text,
  add column if not exists contract_file_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'org-contracts',
  'org-contracts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists org_contracts_platform_select on storage.objects;
create policy org_contracts_platform_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'org-contracts'
  and public.current_user_is_platform_admin()
);

drop policy if exists org_contracts_platform_insert on storage.objects;
create policy org_contracts_platform_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'org-contracts'
  and public.current_user_is_platform_admin()
);

drop policy if exists org_contracts_platform_update on storage.objects;
create policy org_contracts_platform_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'org-contracts'
  and public.current_user_is_platform_admin()
)
with check (
  bucket_id = 'org-contracts'
  and public.current_user_is_platform_admin()
);

drop policy if exists org_contracts_platform_delete on storage.objects;
create policy org_contracts_platform_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'org-contracts'
  and public.current_user_is_platform_admin()
);

-- Save all editable organization/contract fields through a platform-admin-only RPC.
create or replace function public.platform_update_organization_contract(
  p_org_id bigint,
  p_name text,
  p_slug text,
  p_phone text,
  p_contract_start_date date,
  p_contract_end_date date,
  p_representative_name text,
  p_business_registration_number text,
  p_fax text,
  p_email text,
  p_address text,
  p_region text,
  p_operating_hours text,
  p_contract_file_path text
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_organization public.organizations;
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
    contract_file_path = nullif(btrim(coalesce(p_contract_file_path, '')), '')
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

revoke all on function public.platform_update_organization_contract(
  bigint, text, text, text, date, date, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.platform_update_organization_contract(
  bigint, text, text, text, date, date, text, text, text, text, text, text, text, text
) to authenticated;

-- The return shape changed, so replace the 0108 signature with a status-aware overload.
drop function if exists public.platform_list_organizations(text, boolean, integer, integer);

create function public.platform_list_organizations(
  p_search text default null,
  p_include_deleted boolean default false,
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id bigint,
  name text,
  slug text,
  status public.org_status,
  created_at timestamptz,
  phone text,
  deleted_at timestamptz,
  contract_start_date date,
  contract_end_date date,
  representative_name text,
  business_registration_number text,
  fax text,
  email text,
  address text,
  region text,
  operating_hours text,
  contract_file_path text,
  account_count bigint,
  building_count bigint,
  unit_count bigint,
  employee_count bigint,
  tenant_count bigint,
  ledger_balance bigint,
  reserved_points bigint,
  available_points bigint,
  total_count bigint
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

revoke all on function public.platform_list_organizations(text, boolean, text, integer, integer)
  from public, anon;
grant execute on function public.platform_list_organizations(text, boolean, text, integer, integer)
  to authenticated;

create or replace function public.platform_get_organization_contract_kpis()
returns table (
  operating_count bigint,
  expiring_within_90_days_count bigint,
  suspended_count bigint,
  terminated_last_12_months_count bigint
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
    count(*) filter (
      where organization.deleted_at is null
        and organization.status in ('active'::public.org_status, 'trial'::public.org_status)
    )::bigint,
    count(*) filter (
      where organization.deleted_at is null
        and organization.status in ('active'::public.org_status, 'trial'::public.org_status)
        and organization.contract_end_date between current_date and current_date + 90
    )::bigint,
    count(*) filter (
      where organization.deleted_at is null
        and organization.status = 'suspended'::public.org_status
    )::bigint,
    count(*) filter (
      where organization.deleted_at >= now() - interval '12 months'
    )::bigint
  from public.organizations organization;
end
$$;

revoke all on function public.platform_get_organization_contract_kpis()
  from public, anon;
grant execute on function public.platform_get_organization_contract_kpis()
  to authenticated;

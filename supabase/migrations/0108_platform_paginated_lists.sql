-- SQL-side platform administration lists with joins, counts, and pagination.

create or replace function public.platform_list_organizations(
  p_search text default null,
  p_include_deleted boolean default false,
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
  account_count bigint,
  building_count bigint,
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
    where (p_include_deleted or organization.deleted_at is null)
      and (
        nullif(btrim(coalesce(p_search, '')), '') is null
        or organization.name ilike '%' || btrim(p_search) || '%'
        or coalesce(organization.slug, '') ilike '%' || btrim(p_search) || '%'
      )
  ),
  paged_organizations as (
    select
      organization.*,
      count(*) over ()::bigint as total_count
    from filtered_organizations organization
    order by organization.created_at desc, organization.id desc
    limit p_limit
    offset p_offset
  ),
  member_counts as (
    select member.org_id, count(*)::bigint as account_count
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
    select reservation.org_id, coalesce(sum(reservation.reserved_points), 0)::bigint as reserved_points
    from public.message_point_reservations reservation
    where reservation.status in ('reserved', 'provider_pending', 'reconcile_required')
      and reservation.org_id in (select organization.id from paged_organizations organization)
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
    coalesce(member_count.account_count, 0)::bigint,
    coalesce(building_count.building_count, 0)::bigint,
    coalesce(ledger_balance.ledger_balance, 0)::bigint,
    coalesce(reservation_balance.reserved_points, 0)::bigint,
    (
      coalesce(ledger_balance.ledger_balance, 0)
      - coalesce(reservation_balance.reserved_points, 0)
    )::bigint,
    organization.total_count
  from paged_organizations organization
  left join member_counts member_count on member_count.org_id = organization.id
  left join building_counts building_count on building_count.org_id = organization.id
  left join ledger_balances ledger_balance on ledger_balance.org_id = organization.id
  left join reservation_balances reservation_balance on reservation_balance.org_id = organization.id
  order by organization.created_at desc, organization.id desc;
end
$$;

revoke all on function public.platform_list_organizations(text, boolean, integer, integer)
  from public, anon;
grant execute on function public.platform_list_organizations(text, boolean, integer, integer)
  to authenticated;

create or replace function public.platform_list_accounts(
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  org_id bigint,
  organization_name text,
  user_id uuid,
  username text,
  full_name text,
  role public.org_member_role,
  staff_type public.staff_type,
  feature_permissions jsonb,
  is_active boolean,
  created_at timestamptz,
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
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'limit must be between 1 and 100' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'offset must be zero or greater' using errcode = '22023';
  end if;

  return query
  select
    member.org_id,
    organization.name,
    member.user_id,
    profile.username,
    profile.full_name,
    member.role,
    member.staff_type,
    member.feature_permissions,
    profile.is_active,
    member.created_at,
    count(*) over ()::bigint
  from public.org_members member
  join public.organizations organization on organization.id = member.org_id
  left join public.profiles profile on profile.user_id = member.user_id
  where nullif(btrim(coalesce(p_search, '')), '') is null
    or organization.name ilike '%' || btrim(p_search) || '%'
    or profile.full_name ilike '%' || btrim(p_search) || '%'
    or profile.username ilike '%' || btrim(p_search) || '%'
  order by member.created_at desc, member.org_id, member.user_id
  limit p_limit
  offset p_offset;
end
$$;

revoke all on function public.platform_list_accounts(text, integer, integer)
  from public, anon;
grant execute on function public.platform_list_accounts(text, integer, integer)
  to authenticated;

create or replace function public.platform_list_point_transactions(
  p_type text default null,
  p_before_created_at timestamptz default null,
  p_before_id bigint default null,
  p_limit integer default 50
)
returns table (
  id bigint,
  org_id bigint,
  organization_name text,
  type public.point_tx_type,
  points integer,
  amount_krw integer,
  memo text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz,
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
    join public.organizations organization on organization.id = point_transaction.org_id
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
$$;

revoke all on function public.platform_list_point_transactions(text, timestamptz, bigint, integer)
  from public, anon;
grant execute on function public.platform_list_point_transactions(text, timestamptz, bigint, integer)
  to authenticated;

create or replace function public.platform_list_point_reservations_page(
  p_statuses text[] default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id bigint,
  org_id bigint,
  organization_name text,
  message_log_id bigint,
  status text,
  reserved_points integer,
  charged_points integer,
  age_seconds bigint,
  is_releasable boolean,
  expires_at timestamptz,
  created_at timestamptz,
  requested_by uuid,
  requested_by_name text,
  total_count bigint,
  has_reconcile_required boolean
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
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'limit must be between 1 and 100' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'offset must be zero or greater' using errcode = '22023';
  end if;
  if p_statuses is not null and exists (
    select 1
    from unnest(p_statuses) status_filter
    where status_filter not in (
      'reserved', 'provider_pending', 'settled', 'released', 'reconcile_required'
    )
  ) then
    raise exception 'invalid reservation status' using errcode = '22023';
  end if;

  return query
  select
    reservation.id,
    reservation.org_id,
    organization.name,
    reservation.message_log_id,
    reservation.status,
    reservation.reserved_points,
    reservation.charged_points,
    greatest(0, extract(epoch from (now() - reservation.created_at))::bigint),
    (
      reservation.status = 'reserved'
      and reservation.expires_at <= now()
      and not exists (
        select 1
        from public.provider_dispatch_jobs job
        where job.reservation_id = reservation.id
          and job.receipt_num is not null
      )
    ),
    reservation.expires_at,
    reservation.created_at,
    reservation.requested_by,
    profile.full_name,
    count(*) over ()::bigint,
    bool_or(reservation.status = 'reconcile_required') over ()
  from public.message_point_reservations reservation
  join public.organizations organization on organization.id = reservation.org_id
  left join public.profiles profile on profile.user_id = reservation.requested_by
  where p_statuses is null or reservation.status = any(p_statuses)
  order by reservation.created_at desc, reservation.id desc
  limit p_limit
  offset p_offset;
end
$$;

revoke all on function public.platform_list_point_reservations_page(text[], integer, integer)
  from public, anon;
grant execute on function public.platform_list_point_reservations_page(text[], integer, integer)
  to authenticated;

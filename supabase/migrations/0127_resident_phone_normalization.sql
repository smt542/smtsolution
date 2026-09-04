-- Normalize Kakao and staff-entered phone numbers before resident matching.

create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when normalized.digits = '' then null
    when normalized.digits like '82%' then '0' || substr(normalized.digits, 3)
    else normalized.digits
  end
  from (
    select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as digits
  ) normalized;
$$;

revoke all on function public.normalize_phone(text) from public;
grant execute on function public.normalize_phone(text) to authenticated, service_role;

create or replace function resident_automatch()
returns table (
  org_id bigint,
  building_id bigint,
  building_name text,
  unit_id bigint,
  unit_no text,
  occupancy_id bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select b.org_id, b.id, b.name, u.id, u.unit_no, o.id
  from resident_identities ri
  join occupancies o
    on normalize_phone(o.phone) = normalize_phone(ri.phone)
   and normalize_phone(o.phone) is not null
   and o.status = 'occupied'
   and o.deleted_at is null
  join units u
    on u.id = o.unit_id
   and u.deleted_at is null
  join buildings b
    on b.id = u.building_id
   and b.deleted_at is null
  where ri.user_id = auth.uid()
  order by b.name, u.unit_no, o.id;
end
$$;

create or replace function resident_confirm(p_occupancy_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity resident_identities%rowtype;
  v_org_id bigint;
  v_building_id bigint;
  v_unit_id bigint;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_identity
  from resident_identities
  where user_id = auth.uid();
  if not found then
    raise exception 'resident identity not found';
  end if;

  select b.org_id, b.id, u.id
    into v_org_id, v_building_id, v_unit_id
  from occupancies o
  join units u on u.id = o.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.deleted_at is null
  where o.id = p_occupancy_id
    and normalize_phone(o.phone) = normalize_phone(v_identity.phone)
    and normalize_phone(o.phone) is not null
    and o.status = 'occupied'
    and o.deleted_at is null;
  if not found then
    raise exception 'occupancy does not match resident phone';
  end if;

  insert into res_claims (
    org_id, resident_user_id, kakao_id, kakao_name,
    claimed_name, claimed_phone, building_id, unit_id, occupancy_id,
    status, kind, resolved_at
  ) values (
    v_org_id, auth.uid(), v_identity.kakao_id, v_identity.kakao_name,
    v_identity.kakao_name, v_identity.phone, v_building_id, v_unit_id, p_occupancy_id,
    'linked', 'auto', now()
  )
  on conflict (resident_user_id) where status = 'linked'
  do update set
    org_id = excluded.org_id,
    kakao_id = excluded.kakao_id,
    kakao_name = excluded.kakao_name,
    claimed_name = excluded.claimed_name,
    claimed_phone = excluded.claimed_phone,
    building_id = excluded.building_id,
    unit_id = excluded.unit_id,
    occupancy_id = excluded.occupancy_id,
    kind = 'auto',
    memo = null,
    resolved_at = now(),
    resolved_by = null;
end
$$;

revoke execute on function resident_automatch() from anon, public;
grant execute on function resident_automatch() to authenticated;
revoke execute on function resident_confirm(bigint) from anon, public;
grant execute on function resident_confirm(bigint) to authenticated;

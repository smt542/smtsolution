-- Resident automatch: also return masked tenant name/phone, move-in date, and
-- org (관리주체) name so the "이 세대가 맞나요?" card matches the design canon
-- (docs/prototype/resident/resident-verify.dc.html). Revives the O1-descoped
-- card fields (see lib/resident/onboardingClient.ts HYBRID note). Name/phone are
-- masked in-RPC so full PII is not sent before the resident confirms the match.

drop function if exists resident_automatch();

create function resident_automatch()
returns table (
  org_id bigint,
  building_id bigint,
  building_name text,
  unit_id bigint,
  unit_no text,
  occupancy_id bigint,
  kakao_name text,
  tenant_name_masked text,
  phone_masked text,
  move_in_date date,
  org_name text
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
  with matched as (
    select
      b.org_id,
      b.id as building_id,
      b.name as building_name,
      u.id as unit_id,
      u.unit_no,
      o.id as occupancy_id,
      ri.kakao_name,
      btrim(coalesce(o.tenant_name, '')) as name,
      normalize_phone(o.phone) as digits,
      o.move_in_date,
      org.name as org_name
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
    join organizations org
      on org.id = b.org_id
    where ri.user_id = auth.uid()
  )
  select
    m.org_id,
    m.building_id,
    m.building_name,
    m.unit_id,
    m.unit_no,
    m.occupancy_id,
    m.kakao_name,
    case
      when m.name = '' then null
      when length(m.name) = 1 then m.name
      when length(m.name) = 2 then left(m.name, 1) || 'O'
      else left(m.name, 1) || repeat('O', length(m.name) - 2) || right(m.name, 1)
    end as tenant_name_masked,
    case
      when m.digits is null then null
      when length(m.digits) >= 7 then left(m.digits, 3) || '-****-' || right(m.digits, 4)
      else m.digits
    end as phone_masked,
    m.move_in_date,
    m.org_name
  from matched m
  order by m.building_name, m.unit_no, m.occupancy_id;
end
$$;

revoke execute on function resident_automatch() from anon, public;
grant execute on function resident_automatch() to authenticated;

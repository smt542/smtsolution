-- resident_get_profile: also return the logged-in resident's Kakao name
-- (resident_identities.kakao_name) so resident-facing screens greet by the
-- Kakao account name. UI falls back to "사용자" when it is null.

drop function if exists resident_get_profile();

create function resident_get_profile()
returns table (
  tenant_name text,
  kakao_name text,
  phone text,
  building_name text,
  unit_no text,
  move_in_date date,
  org_id bigint,
  org_name text,
  transfer_method text,
  bill_delivery text,
  alimtalk_opt_in bool,
  sms_opt_in bool,
  linked_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with linked as (
    select * from resident_linked_unit()
  )
  select
    o.tenant_name,
    ri.kakao_name,
    o.phone,
    b.name,
    u.unit_no,
    o.move_in_date,
    l.org_id,
    org.name,
    o.transfer_method,
    o.bill_delivery,
    o.alimtalk_opt_in,
    o.sms_opt_in,
    coalesce(rc.resolved_at, rc.created_at)
  from linked l
  join occupancies o on o.id = l.occupancy_id and o.unit_id = l.unit_id
  join units u on u.id = l.unit_id and u.building_id = l.building_id
  join buildings b on b.id = l.building_id and b.org_id = l.org_id
  join organizations org on org.id = l.org_id
  join res_claims rc
    on rc.resident_user_id = auth.uid()
   and rc.status = 'linked'
   and rc.org_id = l.org_id
   and rc.building_id = l.building_id
   and rc.unit_id = l.unit_id
   and rc.occupancy_id = l.occupancy_id
  left join resident_identities ri on ri.user_id = auth.uid()
  order by rc.created_at desc, rc.id desc
  limit 1;
$$;

revoke execute on function resident_get_profile() from anon, public;
grant execute on function resident_get_profile() to authenticated;

-- resident_identities에 카카오 프로필 사진 URL(nullable)을 저장하고,
-- resident_get_profile()가 이 URL을 함께 반환하도록 재생성한다(0141 구조 + 1필드).
-- 사진은 선택 동의 항목이라 미동의 시 null → UI는 글자 아바타로 폴백한다.

alter table resident_identities
  add column if not exists profile_image_url text;

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
  linked_at timestamptz,
  profile_image_url text
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
    coalesce(rc.resolved_at, rc.created_at),
    ri.profile_image_url
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

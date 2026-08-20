-- 0091_partner_building_detail.sql
-- 파트너 모바일 건물 상세: 기본정보 확장(건물유형·공동현관·건물주) + 업체 정보 읽기 RPC.
-- 기존 staff 테이블/컬럼(buildings.type_id/entrance_password/owner_*, building_types, building_vendors)을
-- 담당 건물(partner_my_building_ids, 0062) 스코프로 읽기만 한다. 신규 스키마 없음, 기존 staff RLS/정책/화면 불변.
-- 의존: 0062(partner_my_building_ids), P1a(building_types), P3a(buildings 확장·building_vendors).

-- 건물 상세(기본 정보 + 유형/공동현관/건물주). 반환 시그니처 확장을 위해 drop 후 재생성.
drop function if exists partner_get_building(bigint);
create function partner_get_building(p_building_id bigint)
returns table (
  id bigint,
  code text,
  name text,
  address text,
  memo text,
  building_type text,
  entrance_password text,
  owner_name text,
  owner_phone text
)
language sql stable security definer set search_path = public as $$
  select b.id, b.code, b.name, b.address, b.memo,
         bt.label, b.entrance_password, b.owner_name, b.owner_phone
  from buildings b
  left join building_types bt on bt.id = b.type_id
  where b.id = p_building_id and b.id in (select partner_my_building_ids());
$$;
revoke execute on function partner_get_building(bigint) from anon;

-- 건물 협력업체 목록(구분·업체명·전화·비고). 소프트삭제 제외, sort_order 정렬.
-- vendor_type 코드: elevator/fire/electric/septic/etc (표시 라벨은 클라이언트가 매핑).
create or replace function partner_list_building_vendors(p_building_id bigint)
returns table (id bigint, vendor_type text, name text, phone text, memo text)
language sql stable security definer set search_path = public as $$
  select v.id, v.vendor_type, v.name, v.phone, v.memo
  from building_vendors v
  where v.building_id = p_building_id
    and v.deleted_at is null
    and v.building_id in (select partner_my_building_ids())
  order by v.sort_order, v.id;
$$;
revoke execute on function partner_list_building_vendors(bigint) from anon;

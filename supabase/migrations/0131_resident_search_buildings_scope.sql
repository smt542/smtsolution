-- 0131_resident_search_buildings_scope.sql
-- 보안(A01 교차조직): resident_search_buildings는 세대 미연결 세입자를 포함한 모든 authenticated
-- 사용자에게 전(全) 조직의 건물명+전체 도로명주소를 반환했다(빈 질의 시 이름순 최대 50건 전량 덤프).
-- 실카카오 오픈 시 아무 카카오 사용자나 전 클라이언트의 건물/주소 디렉터리를 스크래핑할 수 있다.
-- 완화:
--   (1) 최소 질의길이 2자 강제 → 빈/1자 질의의 전량 덤프 차단.
--   (2) 주소를 결과에서 제외(NULL 반환) → 주소 노출 차단.
-- 반환 시그니처(building_id, org_id, name, address)는 그대로 유지한다. 호출부
-- onboardingClient.searchBuildings가 `row.address ?? ""`로 처리하므로 무회귀.
-- 매칭은 이름·주소 모두 유지(수동 클레임 검색 UX 보존, 단 주소 '값'은 반환하지 않음).
-- 세대 연결 후 상세/청구 등에서 노출되는 주소는 별도 스코프 함수라 영향 없음.

create or replace function resident_search_buildings(p_q text default null)
returns table (
  building_id bigint,
  org_id bigint,
  name text,
  address text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.org_id, b.name, null::text as address
  from buildings b
  where b.deleted_at is null
    and char_length(btrim(coalesce(p_q, ''))) >= 2
    and (
      b.name ilike '%' || btrim(p_q) || '%'
      or b.address ilike '%' || btrim(p_q) || '%'
    )
  order by b.name
  limit 50;
$$;

revoke execute on function resident_search_buildings(text) from anon, public;
grant execute on function resident_search_buildings(text) to authenticated;

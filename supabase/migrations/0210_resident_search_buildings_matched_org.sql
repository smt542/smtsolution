-- 0210_resident_search_buildings_matched_org.sql
-- 세입자 매칭 세대 확인(/resident/verify) → [제 세대가 아니에요] → 건물 선택 시트.
-- 정본(resident-verify #rvSheet)은 시트를 열자마자 '관리 중인 건물 N개' 목록(건물명 + 주소)을
-- 보여 주고, 검색은 그 목록 안에서 거른다. 앱은 시트를 열 때 빈 검색어로 한 번 불러오는데
-- 0131이 2자 미만 검색을 막고 주소를 빼서 목록이 늘 비었다(QA 2026-09-30 R5).
--
-- 범위(2026-09-30 사용자 결정): 로그인한 세입자의 카카오 번호로 매칭되는 세대의 관리 조직 건물.
--   · 매칭 조건은 resident_automatch()(0146)를 그대로 쓴다 — 확인 카드에 뜨는 세대의 조직과 같다.
--   · 그 범위 안에서는 빈 검색어 = 전체 목록, 주소를 돌려준다.
--   · 매칭 세대가 없는 사용자는 0행이다. 다른 조직 건물·주소는 여전히 볼 수 없다(0131 교차 조직 차단 유지).
-- 반환 시그니처(building_id, org_id, name, address)와 인자(p_q)는 그대로라 create or replace로 바꾼다.

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
  with matched_orgs as (
    select distinct m.org_id
    from resident_automatch() m
  )
  select b.id, b.org_id, b.name, b.address
  from buildings b
  join matched_orgs mo
    on mo.org_id = b.org_id
  where b.deleted_at is null
    and (
      nullif(btrim(coalesce(p_q, '')), '') is null
      or b.name ilike '%' || btrim(p_q) || '%'
      or b.address ilike '%' || btrim(p_q) || '%'
    )
  order by b.name, b.id;
$$;

revoke execute on function resident_search_buildings(text) from anon, public;
grant execute on function resident_search_buildings(text) to authenticated;

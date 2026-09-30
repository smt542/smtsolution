-- 세입자 홈 '건물 공지' = 직원이 건물 기본정보에 입력한 '건물 상시 공지문'(buildings.basic_extra.standingNotice, 0124).
-- 정본 resident-home.dc.html: 카드·모달 제목은 '건물 공지'로 고정하고 본문에 상시 공지문을 넣는다.
-- 공지문이 비어 있으면 null → 앱은 카드를 그리지 않는다(직원 화면 안내: "비워 두면 세입자 홈에 건물 공지가 표시되지 않아요").
-- 스코프는 다른 세입자 RPC와 같다: resident_linked_unit()(연결된 세대의 현재 입주 건물)만 본다.
create or replace function public.resident_building_notice()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select nullif(btrim(b.basic_extra->>'standingNotice'), '')
  from resident_linked_unit() l
  join buildings b on b.id = l.building_id and b.org_id = l.org_id
  limit 1;
$$;

revoke execute on function public.resident_building_notice() from public, anon;
grant execute on function public.resident_building_notice() to authenticated;

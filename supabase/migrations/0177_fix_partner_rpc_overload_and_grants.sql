-- 0177: 0176이 만든 partner_search_tenants 오버로드 모호성 해소 + PUBLIC execute 회수
--
-- (1) 모호성
-- 0176이 마스킹을 적용하며 1-arg partner_search_tenants(text)를 새로 만들었는데,
-- 0070_partner_field_lookup.sql의 3-arg partner_search_tenants(text, integer, integer)가
-- 그대로 남아 있었다. 3-arg는 인수 세 개가 모두 기본값이라, 앱의 무인수 호출
-- (app/(partner)/partner/(app)/(tabs)/mobile-inquiry/page.tsx 의 rpc("partner_search_tenants"))이
-- 두 후보 모두를 만족해 PostgREST가 PGRST203(HTTP 300)으로 거부했다.
-- limit/offset을 넘기는 호출부는 저장소에 없어 3-arg는 사용되지 않으므로 제거한다.
drop function if exists public.partner_search_tenants(text, integer, integer);

-- (2) PUBLIC execute 잔존
-- 0176은 이 두 함수에 대해 `from anon`만 회수했다. 함수를 새로 만들면 PUBLIC에 execute가
-- 기본 부여되는데 PUBLIC 회수가 없어 anon이 상속받은 권한이 남았다(anon이 security definer
-- 함수를 실행 가능한 상태였다. partner_my_building_ids()가 비어 데이터가 새지는 않았지만
-- 실행 가능 자체가 하드닝 갭이다). mask_phone·list_message_logs·list_occupancy_history는
-- `from public, anon`으로 올바르게 회수돼 있어 이 둘만 맞춘다.
revoke execute on function public.partner_search_tenants(text) from public, anon;
grant execute on function public.partner_search_tenants(text) to authenticated;

revoke execute on function public.partner_list_building_vendors(bigint) from public, anon;
grant execute on function public.partner_list_building_vendors(bigint) to authenticated;

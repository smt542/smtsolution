-- 2026-11-01 QA #60: 현장관리자는 담당 지정과 무관하게 소속 조직의 모든 건물을 조회·입력한다.
-- partner_my_building_ids() 를 조직 전체 건물 범위(partner_org_building_ids)로 재정의한다.
-- (이름은 유지: 이를 사용하는 partner_* RPC 17개의 시그니처/본문 변경 없음.)
-- 유지: AS 수정·삭제는 assigned_to = auth.uid() 본인만, 조직 경계, 확정월 잠금.
begin;

create or replace function public.partner_my_building_ids()
returns setof bigint
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.partner_org_building_ids();
$function$;

commit;

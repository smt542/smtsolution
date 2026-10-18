-- 정지(계약 만료 포함)·삭제된 테넌트에 묶인 세입자 로그인 차단 판정.
--
-- 0254에서 resident_my_link / resident_pending_state가 비운영 조직을 걸러내면서,
-- 정지 조직 세입자는 "세대 없음"으로 보여 로그인 후 본인인증(/resident/auth)으로 흘러갔다.
-- 정책(통합관리자_테넌트 관리 90행): 정지/해지 → 그 테넌트 staff·partner·resident 접속 제한.
-- 이 함수가 true면 세입자 로그인·앱 진입을 막고 세션을 끊는다.
--   - 운영 조직의 연결 세대가 하나라도 있으면 false(다른 조직 세대로 정상 이용).
--   - 연결(linked) 클레임: resident_linked_unit과 같은 유효성(입주 중 점유, 이후 점유 이력 없음)에서 조직만 비운영.
--   - 승인 대기(pending) 클레임: resident_pending_state가 보는 조직(active·trial)이 아닌 경우.

create or replace function public.resident_org_suspended()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select auth.uid() is not null
    and not exists (select 1 from public.resident_linked_unit())
    and not exists (select 1 from public.resident_pending_state())
    and (
      exists (
        select 1
        from res_claims rc
        join occupancies o on o.id = rc.occupancy_id
          and o.deleted_at is null
          and o.status in ('occupied', 'moving_out')
        join units u on u.id = o.unit_id
        join organizations org on org.id = rc.org_id
        where rc.resident_user_id = auth.uid()
          and rc.status = 'linked'
          and (org.status <> 'active' or org.deleted_at is not null)
          and coalesce(rc.resolved_at, rc.created_at) > coalesce((select max(h.created_at) from occupancy_history h where h.unit_id = u.id), '-infinity'::timestamptz)
      )
      or exists (
        select 1
        from res_claims rc
        join organizations org on org.id = rc.org_id
        where rc.resident_user_id = auth.uid()
          and rc.status = 'pending'
          and (org.status not in ('active', 'trial') or org.deleted_at is not null)
      )
    );
$function$;

revoke all on function public.resident_org_suspended() from public, anon;
grant execute on function public.resident_org_suspended() to authenticated;

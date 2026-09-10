-- 0152: get_my_context에 org_name(회사명) 반환 추가 (additive)
-- 목적: 사이드바 프로필 헤더("프로필 · 회사명")가 로그인 컨텍스트에서 회사명을 얻도록 한다.
--       get_my_context는 이미 organizations(o)를 조인하므로 o.name만 반환 말미에 추가한다.
-- 0148 정의를 그대로 계승(security definer·stable·search_path=public), org_name만 append.
-- drop+create이므로 기본 PUBLIC execute를 상속한다(0148과 동일 패턴, 명시 grant 없음).

drop function if exists get_my_context();
create function get_my_context()
returns table (org_id bigint, role org_member_role, org_status org_status,
               username text, full_name text, is_active boolean, must_change_password boolean,
               staff_type staff_type, permissions jsonb, staff_capabilities jsonb, org_name text)
language sql stable security definer set search_path = public as $$
  select m.org_id, m.role, o.status, p.username, p.full_name, p.is_active, p.must_change_password,
         m.staff_type, coalesce(m.feature_permissions, '[]'::jsonb),
         coalesce(m.staff_capabilities, '[]'::jsonb), o.name
  from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid()
  order by (o.status = 'active') desc, m.created_at
  limit 1
$$;

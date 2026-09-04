-- 0133_session_active_enforcement.sql
-- H7: 세션 활성계정 강제 — RLS/모듈 RPC를 뒷받침하는 접근결정 헬퍼 5종이
--     organizations.status='active'만 확인하고 profiles.is_active는 확인하지 않아,
--     비활성화된 계정이라도 살아있는 세션이면 RLS·모듈 RPC를 계속 통과했다.
--     (비활성화가 신규 로그인만 차단하고 기존 세션은 막지 못함)
-- 픽스: 아래 5개 헬퍼에 호출자 profiles.is_active = true 요건을 DB 계층에서 추가한다.
--   - current_user_org()               (기준: 0002_p2a_accounts_permissions.sql)
--   - my_org_ids()                      (기준: 0000_p0_auth_foundation.sql)
--   - current_user_has_module(text)     (기준: 0002_p2a_accounts_permissions.sql)
--   - current_user_is_master()          (기준: 0002_p2a_accounts_permissions.sql)
--   - current_user_is_platform_admin()  (기준: 0011_platform_admin.sql)
-- 보존: security definer / set search_path=public / org status='active' / role·master·platform 로직
--       / 기존 grant·revoke 를 전부 그대로 유지하고 is_active 게이트만 추가한다.
-- 불변: get_my_context()는 절대 수정하지 않는다(로그인/라우트가 is_active를 '읽어' 판단하므로
--       여기서 게이팅하면 로그인 흐름 자체의 is_active 체크가 깨진다).
-- 성능: profiles.user_id 는 PK(unique)라 추가 조회는 인덱스로 저렴하다.
-- 주의: 이 마이그레이션은 어떤 DB에도 적용하지 않는다(라이브 적용은 사용자/Claude가 수행).

-- ── 내부 헬퍼: 호출자 org (0002 기준 + is_active 게이트) ──
create or replace function current_user_org()
returns bigint language sql stable security definer set search_path = public as $$
  select m.org_id from org_members m
    join organizations o on o.id = m.org_id
    join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid() and o.status = 'active' and p.is_active
  order by m.created_at limit 1;
$$;

-- ── my_org_ids (0000 기준 + is_active 게이트) ──
create or replace function my_org_ids() returns setof bigint
  language sql stable security definer set search_path = public as $$
  select m.org_id from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = (select auth.uid()) and o.status = 'active' and p.is_active
$$;

-- ── 마스터 판별 (0002 기준 + is_active 게이트) ──
create or replace function current_user_is_master()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members m
    join organizations o on o.id = m.org_id
    join profiles p on p.user_id = m.user_id
    where m.user_id = (select auth.uid()) and o.status = 'active' and p.is_active
      and m.role in ('org_owner','platform_admin'));
$$;

-- ── 모듈 권한 판별 (0002 기준 + is_active 게이트) ──
create or replace function current_user_has_module(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members m
    join organizations o on o.id = m.org_id
    join profiles p on p.user_id = m.user_id
    where m.user_id = (select auth.uid()) and o.status = 'active' and p.is_active
      and (m.role in ('org_owner','platform_admin') or m.feature_permissions ? p_key));
$$;

-- ── platform_admin 판별 (0011 기준 + is_active 게이트) ──
-- cross-org 운영자: org status 무관이나, 호출자 본인 profile 이 활성일 때만 유효.
create or replace function current_user_is_platform_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid()) and m.role = 'platform_admin'
  )
  and exists (
    select 1 from profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  )
$$;
-- 0011 의 grant/revoke 원본 재발급(불변)
revoke execute on function current_user_is_platform_admin() from public, anon;
grant execute on function current_user_is_platform_admin() to authenticated;

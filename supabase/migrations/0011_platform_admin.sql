-- 0011_platform_admin.sql
-- 통합관리자(platform-admin) 콘솔 — Scope A(cross-org SaaS 운영자).
-- 발송 크레딧(포인트) 원장 + platform_admin cross-org RLS 예외(기존 staff 정책 불변).
-- 의존: P0(organizations, org_members, profiles, auth.users, my_org_ids, org_member_role/org_status enum).
-- 순번: 운영 이력 0007(P5a)·0008(P7a)·0009(P7b)·0010(P4a) 다음 = 0011.

-- ── platform_admin 판별 (security definer: org_members RLS 우회, my_org_ids와 동일 패턴) ──
create or replace function current_user_is_platform_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid()) and m.role = 'platform_admin'
  )
$$;
revoke execute on function current_user_is_platform_admin() from public, anon;
grant execute on function current_user_is_platform_admin() to authenticated;

-- ── 포인트 원장 ──
create type point_tx_type as enum ('charge','usage');

create table point_transactions (
  id         bigint generated always as identity primary key,
  org_id     bigint not null references organizations(id) on delete cascade,
  type       point_tx_type not null,
  points     integer not null,            -- charge: +, usage: −
  amount_krw integer,                     -- charge 결제금액(원); usage는 null
  memo       text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on point_transactions (org_id, created_at desc);

-- 포인트 원장은 통합관리자 전용(현재). 발송 usage INSERT는 P4에서 별도 개방.
alter table point_transactions enable row level security;
create policy pt_platform on point_transactions for all
  using (current_user_is_platform_admin())
  with check (current_user_is_platform_admin());

-- ── cross-org 예외(permissive 정책 추가; 기존 org_select/member_select/profile_select 유지) ──
-- organizations: 전 org 조회 + 상태 변경(UPDATE)
create policy org_platform_select on organizations for select
  using (current_user_is_platform_admin());
create policy org_platform_update on organizations for update
  using (current_user_is_platform_admin())
  with check (current_user_is_platform_admin());
-- org_members / profiles: 계정 화면용 cross-org 조회(읽기 전용)
create policy member_platform_select on org_members for select
  using (current_user_is_platform_admin());
create policy profile_platform_select on profiles for select
  using (current_user_is_platform_admin());

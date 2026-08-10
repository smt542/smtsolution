# P2a 계정·직원 관리(/accounts) + 권한 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/staff/accounts` 화면에서 4유형 계정을 등록·수정·비활성하고, 직원 기능별 권한을 마스터만 변경하도록 DB·RLS·RPC·UI로 실제 작동하게 만든다.

**Architecture:** Supabase(PostgreSQL) 마이그레이션 `0002`로 `org_members` 권한 컬럼·담당역할 테이블·`get_my_context` 수정·권한 헬퍼·계정 RPC를 추가한다. 계정 생성(=`auth.users` 생성)은 service_role이 필요하므로 Next.js 라우트 핸들러가 담당하되, 행 삽입·감사·인가는 SECURITY DEFINER RPC(`provision_member`)로 원자 처리한다(spec §5.2의 "admin 직접 insert"를 RPC 경유로 정제 — 원자성·감사·테스트 용이). 조회·수정·활성/비활성·권한변경은 브라우저에서 RPC 직접 호출. UI는 기존 reactquery + 공통 프리미티브 컨벤션을 그대로 따른다.

**Tech Stack:** Next.js 16 App Router, Supabase(@supabase/ssr·@supabase/supabase-js), React Query v5, react-hook-form + zod, TailwindCSS v4, Vitest + Testing Library.

**기준 spec:** `docs/superpowers/specs/2026-08-10-p2a-accounts-permissions-design.md`

## Global Constraints

- **멀티테넌트 격리:** 모든 신규 테이블/함수는 org 격리. 조회 RPC는 `current_user_org()` 기준, 신규 테이블 RLS는 `my_org_ids()`(P0) 사용.
- **계정 삭제 금지:** 물리 삭제 없음 → `profiles.is_active=false`(비활성). 담당역할은 소프트삭제(`deleted_at`).
- **마스터 = `role in ('org_owner','platform_admin')`.** "관리자 = 마스터 직원", "직원 = 비마스터", 둘 다 `staff_type='manager_staff'`. 별도 `is_master` 컬럼 없음.
- **권한 체크리스트 항목은 `lib/auth/permissions.ts`의 `MODULE_KEYS`(11개)·`MODULE_LABELS`가 canonical.** 새 키를 임의 추가하지 않는다.
- **권한/역할 변경은 마스터만**(DB RPC에서 강제). 비마스터의 `accounts` 권한은 생성·기본수정·활성토글·비번재설정까지.
- **UI 문구는 한국어.** 에러는 친화 토스트(sonner), `throw`/스택 노출 지양.
- **Next.js 버전 주의:** 라우트 핸들러/App Router 작성 전 `node_modules/next/dist/docs/`의 해당 가이드를 확인한다(AGENTS.md — 이 Next.js는 학습데이터와 다를 수 있음).
- **커밋 트레일러:** 모든 커밋 메시지 끝에 다음 줄 추가 —
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **DB 적용은 pending-user:** 마이그레이션·RLS의 라이브 검증은 사용자가 Supabase에 적용 후 수행(P0/P1a와 동일). 자동 테스트는 TS 계층(매퍼·훅·라우트·컴포넌트)만 커버.
- **로컬 env:** `SUPABASE_SERVICE_ROLE_KEY`(서버 전용, `NEXT_PUBLIC_` 아님)를 `.env.local`에 채워야 라우트가 동작(`.env.example`에 문서화됨).

---

## Task 1: DB 마이그레이션 + 검증 SQL

**Files:**
- Create: `supabase/migrations/0002_p2a_accounts_permissions.sql`
- Create: `supabase/verify/p2a_checks.sql`

**Interfaces:**
- Consumes: P0 `organizations`·`org_members`·`profiles`·`audit_log`·`my_org_ids()`·`set_updated_at()`; P0 enum `org_member_role`·`org_status`.
- Produces (후속 태스크가 의존하는 이름):
  - enum `staff_type` = `('manager_staff','field_staff','support_staff','tenant')`
  - `org_members` 컬럼: `staff_type`, `feature_permissions jsonb`, `affiliation text`
  - `profiles.phone_sub text`
  - 테이블 `staff_roles(id,org_id,label,sort_order,deleted_at,...)`, `org_member_roles(org_id,user_id,role_id)`
  - `get_my_context()` → 추가 반환 `staff_type`, `permissions jsonb`
  - `current_user_is_master() → boolean`, `current_user_has_module(text) → boolean`, `current_user_org() → bigint`
  - RPC: `provision_member(uuid,text,text,text,text,org_member_role,staff_type,jsonb,text,bigint[])`, `admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[])`, `admin_update_member_basic(uuid,text,text,text,staff_type,text,bigint[])`, `admin_set_active(uuid,boolean)`, `list_accounts(text,staff_type)`

> DB는 로컬 자동 실행 대상이 아니므로 이 태스크의 "테스트"는 (a) `psql`/Supabase에 적용 가능한 완전한 스크립트 작성 + (b) 검증 SQL 작성이다. 라이브 검증은 pending-user.

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `supabase/migrations/0002_p2a_accounts_permissions.sql`:

```sql
-- P2a: 계정·직원 관리 + 권한 기반
-- 의존: P0(organizations, org_members, profiles, audit_log, my_org_ids, set_updated_at)

-- ===== ENUM =====
create type staff_type as enum ('manager_staff','field_staff','support_staff','tenant');

-- ===== org_members / profiles 확장 =====
alter table org_members
  add column staff_type          staff_type not null default 'manager_staff',
  add column feature_permissions jsonb      not null default '[]'::jsonb
    check (jsonb_typeof(feature_permissions) = 'array'),
  add column affiliation         text;

alter table profiles add column phone_sub text;

-- ===== 담당역할 마스터 + 조인 =====
create table staff_roles (
  id         bigint generated always as identity primary key,
  org_id     bigint not null references organizations(id) on delete cascade,
  label      text not null,
  sort_order int  not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, label)
);
create trigger trg_staff_roles_updated before update on staff_roles
  for each row execute function set_updated_at();

create table org_member_roles (
  org_id  bigint not null references organizations(id) on delete cascade,
  user_id uuid   not null references auth.users(id)    on delete cascade,
  role_id bigint not null references staff_roles(id)   on delete cascade,
  primary key (org_id, user_id, role_id)
);
create index on org_member_roles (role_id);

-- 기존 org 담당역할 시드(관리·검침·청소)
insert into staff_roles (org_id, label, sort_order)
  select o.id, v.label, v.ord
  from organizations o
  cross join (values ('관리',1),('검침',2),('청소',3)) as v(label,ord)
  on conflict (org_id, label) do nothing;

-- ===== 내부 헬퍼: 호출자 org =====
create or replace function current_user_org()
returns bigint language sql stable security definer set search_path = public as $$
  select m.org_id from org_members m join organizations o on o.id = m.org_id
  where m.user_id = auth.uid() order by (o.status = 'active') desc, m.created_at limit 1;
$$;

-- ===== get_my_context 재정의(권한·유형 반환) =====
drop function if exists get_my_context();
create function get_my_context()
returns table (org_id bigint, role org_member_role, org_status org_status,
               username text, full_name text, is_active boolean, must_change_password boolean,
               staff_type staff_type, permissions jsonb)
language sql stable security definer set search_path = public as $$
  select m.org_id, m.role, o.status, p.username, p.full_name, p.is_active, p.must_change_password,
         m.staff_type, coalesce(m.feature_permissions, '[]'::jsonb)
  from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid()
  order by (o.status = 'active') desc, m.created_at
  limit 1
$$;

-- ===== 권한 헬퍼(향후 테이블 RLS에서 재사용) =====
create or replace function current_user_is_master()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members m join organizations o on o.id = m.org_id
    where m.user_id = (select auth.uid()) and o.status = 'active'
      and m.role in ('org_owner','platform_admin'));
$$;

create or replace function current_user_has_module(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members m join organizations o on o.id = m.org_id
    where m.user_id = (select auth.uid()) and o.status = 'active'
      and (m.role in ('org_owner','platform_admin') or m.feature_permissions ? p_key));
$$;

-- ===== 계정 프로비저닝(라우트에서 auth.users 생성 후 호출) =====
create or replace function provision_member(
  p_user_id uuid, p_username text, p_full_name text, p_phone text, p_phone_sub text,
  p_role org_member_role, p_staff_type staff_type, p_permissions jsonb,
  p_affiliation text, p_role_ids bigint[]
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
  -- 비마스터는 역할/권한 강제 축소(권한 상승 차단)
  if not current_user_is_master() then p_role := 'staff'; p_permissions := '[]'::jsonb; end if;
  insert into profiles(user_id, username, full_name, phone, phone_sub, must_change_password)
    values (p_user_id, lower(p_username), p_full_name, nullif(p_phone,''), nullif(p_phone_sub,''), true);
  insert into org_members(org_id, user_id, role, staff_type, feature_permissions, affiliation)
    values (v_org, p_user_id, p_role, p_staff_type, coalesce(p_permissions,'[]'::jsonb), nullif(p_affiliation,''));
  if p_role_ids is not null then
    insert into org_member_roles(org_id, user_id, role_id) select v_org, p_user_id, unnest(p_role_ids);
  end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'ACCOUNT_CREATE', 'org_members', p_user_id::text,
      jsonb_build_object('username',lower(p_username),'role',p_role,'staff_type',p_staff_type));
end $$;
revoke execute on function provision_member(uuid,text,text,text,text,org_member_role,staff_type,jsonb,text,bigint[]) from anon;

-- ===== 권한/역할 변경(마스터 전용) =====
create or replace function admin_set_member_permissions(
  p_user_id uuid, p_role org_member_role, p_staff_type staff_type,
  p_permissions jsonb, p_role_ids bigint[]
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_other_masters int;
begin
  v_org := current_user_org();
  if not current_user_is_master() then raise exception 'forbidden: master only'; end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  -- 최소 1 마스터 유지: 본인을 마스터 해제하는데 다른 마스터가 없으면 거부
  if p_user_id = auth.uid() and p_role not in ('org_owner','platform_admin') then
    select count(*) into v_other_masters from org_members
      where org_id = v_org and role in ('org_owner','platform_admin') and user_id <> p_user_id;
    if v_other_masters = 0 then raise exception 'must keep at least one master'; end if;
  end if;
  update org_members set role = p_role, staff_type = p_staff_type,
    feature_permissions = coalesce(p_permissions,'[]'::jsonb)
    where user_id = p_user_id and org_id = v_org;
  delete from org_member_roles where user_id = p_user_id and org_id = v_org;
  if p_role_ids is not null then
    insert into org_member_roles(org_id,user_id,role_id) select v_org,p_user_id,unnest(p_role_ids); end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PERMISSION_CHANGE', 'org_members', p_user_id::text,
      jsonb_build_object('role',p_role,'staff_type',p_staff_type,'permissions',p_permissions));
end $$;
revoke execute on function admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[]) from anon;

-- ===== 기본정보 변경(accounts 권한; 역할/권한 미변경) =====
create or replace function admin_update_member_basic(
  p_user_id uuid, p_full_name text, p_phone text, p_phone_sub text,
  p_staff_type staff_type, p_affiliation text, p_role_ids bigint[]
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  update profiles set full_name = p_full_name, phone = nullif(p_phone,''), phone_sub = nullif(p_phone_sub,'')
    where user_id = p_user_id;
  update org_members set staff_type = p_staff_type, affiliation = nullif(p_affiliation,'')
    where user_id = p_user_id and org_id = v_org;
  delete from org_member_roles where user_id = p_user_id and org_id = v_org;
  if p_role_ids is not null then
    insert into org_member_roles(org_id,user_id,role_id) select v_org,p_user_id,unnest(p_role_ids); end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk)
    values (v_org, auth.uid(), 'ACCOUNT_UPDATE', 'profiles', p_user_id::text);
end $$;
revoke execute on function admin_update_member_basic(uuid,text,text,text,staff_type,text,bigint[]) from anon;

-- ===== 활성/비활성(삭제 금지) =====
create or replace function admin_set_active(p_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  update profiles set is_active = p_active where user_id = p_user_id;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), case when p_active then 'ACCOUNT_ACTIVATE' else 'ACCOUNT_DEACTIVATE' end,
      'profiles', p_user_id::text, jsonb_build_object('is_active',p_active));
end $$;
revoke execute on function admin_set_active(uuid,boolean) from anon;

-- ===== 계정 디렉터리 조회 =====
create or replace function list_accounts(p_search text default null, p_type staff_type default null)
returns table (user_id uuid, username text, full_name text, phone text, phone_sub text,
               role org_member_role, staff_type staff_type, affiliation text, is_active boolean,
               permissions jsonb, role_labels text[])
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.full_name, p.phone, p.phone_sub,
         m.role, m.staff_type, m.affiliation, p.is_active,
         coalesce(m.feature_permissions,'[]'::jsonb),
         coalesce(array_agg(sr.label order by sr.sort_order) filter (where sr.id is not null), '{}')
  from org_members m
  join profiles p on p.user_id = m.user_id
  left join org_member_roles omr on omr.user_id = m.user_id and omr.org_id = m.org_id
  left join staff_roles sr on sr.id = omr.role_id and sr.deleted_at is null
  where m.org_id = current_user_org()
    and (p_type is null or m.staff_type = p_type)
    and (p_search is null or p.full_name ilike '%'||p_search||'%'
         or p.username ilike '%'||p_search||'%'
         or p.phone ilike '%'||p_search||'%' or p.phone_sub ilike '%'||p_search||'%')
  group by p.user_id, p.username, p.full_name, p.phone, p.phone_sub,
           m.role, m.staff_type, m.affiliation, p.is_active, m.feature_permissions
  order by p.full_name
$$;
revoke execute on function list_accounts(text,staff_type) from anon;

-- ===== RLS (신규 테이블) =====
alter table staff_roles      enable row level security;
alter table org_member_roles enable row level security;
-- 담당역할 마스터: 활성 org 구성원 CRUD(민감치 않음, P1a 마스터와 동일 수준)
create policy sr_all on staff_roles for all
  using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
-- 조인: 조회만 개방(쓰기는 위 RPC가 definer로 처리)
create policy omr_select on org_member_roles for select
  using (org_id in (select my_org_ids()));
```

- [ ] **Step 2: 검증 SQL 작성**

Create `supabase/verify/p2a_checks.sql`:

```sql
-- P2a 스키마·정책 존재 검증. 적용 후 psql/Supabase SQL editor에서 실행.
-- (권한 동작의 행위 검증은 시드 계정 필요 → E2E, pending-user)

-- 1) 컬럼 추가 확인
select 'org_members.staff_type'          as check, count(*) from information_schema.columns
  where table_name='org_members' and column_name='staff_type';
select 'org_members.feature_permissions' as check, count(*) from information_schema.columns
  where table_name='org_members' and column_name='feature_permissions';
select 'org_members.affiliation'         as check, count(*) from information_schema.columns
  where table_name='org_members' and column_name='affiliation';
select 'profiles.phone_sub'              as check, count(*) from information_schema.columns
  where table_name='profiles' and column_name='phone_sub';

-- 2) 함수 존재(9개)
select proname from pg_proc where proname in (
  'current_user_org','current_user_is_master','current_user_has_module',
  'get_my_context','provision_member','admin_set_member_permissions',
  'admin_update_member_basic','admin_set_active','list_accounts') order by proname;

-- 3) get_my_context 반환에 staff_type/permissions 포함
select p.proname, pg_get_function_result(p.oid) as result
  from pg_proc p where p.proname='get_my_context';

-- 4) 신규 테이블 RLS 정책
select c.relname, pol.polname from pg_policy pol join pg_class c on c.oid=pol.polrelid
  where c.relname in ('staff_roles','org_member_roles') order by 1,2;

-- 5) 담당역할 시드(org별 3개 이상)
select org_id, count(*) as role_count from staff_roles group by org_id order by org_id;

-- 6) anon revoke 확인(정의된 RPC가 anon에 실행권한 없어야 함)
select r.routine_name, has_function_privilege('anon', p.oid, 'execute') as anon_can_exec
  from pg_proc p join information_schema.routines r on r.specific_name = p.proname||'_'||p.oid
  where p.proname in ('provision_member','admin_set_member_permissions','list_accounts');
```

- [ ] **Step 3: 마이그레이션 정합성 자체 점검**

수동 검토(실행 불가 환경): (a) 모든 `create/alter`가 P0/P1a 객체명과 일치하는지, (b) `drop function if exists get_my_context()` 후 재생성 시그니처가 `hooks/reactquery/auth/apis.ts` 매핑(Task 2)과 일치(`staff_type`,`permissions`)하는지, (c) enum 값이 spec §3.1과 일치하는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0002_p2a_accounts_permissions.sql supabase/verify/p2a_checks.sql
git commit -m "feat(db): P2a 계정·권한 스키마·RPC·RLS(0002) + 검증 SQL"
```

---

## Task 2: 인증 컨텍스트에 staff_type 전파

**Files:**
- Modify: `hooks/reactquery/auth/apis.ts`
- Test: `hooks/reactquery/auth/apis.test.ts` (기존 파일 수정)

**Interfaces:**
- Consumes: Task 1의 `get_my_context()`가 반환하는 `staff_type`,`permissions`.
- Produces: `StaffType` 타입, `MyContext.staffType` — Task 5/9/10/11이 import.

- [ ] **Step 1: 기존 테스트를 staff_type 기대하도록 수정(실패 유도)**

In `hooks/reactquery/auth/apis.test.ts`, `getMyContext` 성공 케이스의 rpc mock 입력과 기대값에 staff_type을 추가:

```ts
  it("rpc 결과 첫 행을 카멜케이스로 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      org_id: 1, role: "staff", org_status: "active",
      username: "hong", full_name: "홍길동", is_active: true, must_change_password: false,
      staff_type: "manager_staff", permissions: ["buildings"],
    }], error: null });
    const ctx = await getMyContext();
    expect(ctx).toEqual({
      orgId: 1, role: "staff", orgStatus: "active",
      username: "hong", fullName: "홍길동", isActive: true, mustChangePassword: false,
      staffType: "manager_staff", permissions: ["buildings"],
    });
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- hooks/reactquery/auth/apis.test.ts`
Expected: FAIL — 반환 객체에 `staffType` 없음(`toEqual` 불일치).

- [ ] **Step 3: apis.ts에 StaffType + 매핑 추가**

In `hooks/reactquery/auth/apis.ts`, `OrgMemberRole` 아래에 타입 추가하고 `MyContext`·`getMyContext`를 수정:

```ts
export type StaffType = "manager_staff" | "field_staff" | "support_staff" | "tenant";

export interface MyContext {
  orgId: number;
  role: OrgMemberRole;
  orgStatus: "active" | "suspended" | "trial";
  username: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  /** 계정 유형(PRD "유형"). role과 직교. */
  staffType: StaffType;
  /** Module permission keys granted to this user (empty for org_owner who has all). */
  permissions: string[];
}
```

그리고 `getMyContext`의 반환 매핑에 `staffType`을 추가:

```ts
  return {
    orgId: row.org_id,
    role: row.role,
    orgStatus: row.org_status,
    username: row.username,
    fullName: row.full_name,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    staffType: row.staff_type,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
  };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- hooks/reactquery/auth/apis.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add hooks/reactquery/auth/apis.ts hooks/reactquery/auth/apis.test.ts
git commit -m "feat(auth): MyContext.staffType 전파(get_my_context 확장 대응)"
```

---

## Task 3: service_role admin 클라이언트 + 계정 생성 라우트(POST)

**Files:**
- Create: `lib/supabase/admin.ts`
- Create: `app/api/accounts/route.ts`
- Test: `app/api/accounts/route.test.ts`

**Interfaces:**
- Consumes: `@/lib/supabase/server` `createClient`, `@/lib/auth/email` `loginEmail`, Task 1 RPC `get_my_context`·`provision_member`.
- Produces: `createAdminClient()`; `POST /api/accounts` (요청 body: `{username,password,fullName,phone?,phoneSub?,role,staffType,permissions,affiliation?,roleIds}`; 응답 `201 {userId}` / `401|403|409|422|500 {error}`) — Task 5 `createAccount`가 호출.

> 구현 전: `node_modules/next/dist/docs/`의 Route Handler 가이드 확인(AGENTS.md).

- [ ] **Step 1: 실패 테스트 작성**

Create `app/api/accounts/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { POST } from "./route";

function serverClient({ user, ctx }: { user: any; ctx: any }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    rpc: vi.fn().mockImplementation((name: string) =>
      name === "get_my_context"
        ? Promise.resolve({ data: ctx ? [ctx] : [], error: null })
        : Promise.resolve({ error: null })),
    from: vi.fn().mockReturnvalue ? undefined : vi.fn(() => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { slug: "demo" }, error: null }) }) }),
    })),
  };
}
function req(body: any) {
  return new Request("http://localhost/api/accounts", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
const validBody = {
  username: "kim", password: "pw12", fullName: "김직원",
  role: "staff", staffType: "manager_staff", permissions: [], roleIds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN = "staff.gwanribiseo.app";
});

describe("POST /api/accounts", () => {
  it("미인증 → 401", async () => {
    createClient.mockResolvedValue(serverClient({ user: null, ctx: null }));
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
  });

  it("accounts 권한 없는 직원 → 403", async () => {
    createClient.mockResolvedValue(serverClient({
      user: { id: "u1" }, ctx: { org_id: 1, role: "staff", permissions: [] },
    }));
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
  });

  it("마스터 정상 → 201 + provision_member 호출", async () => {
    const rpc = vi.fn().mockImplementation((name: string) =>
      name === "get_my_context"
        ? Promise.resolve({ data: [{ org_id: 1, role: "org_owner", permissions: [] }], error: null })
        : Promise.resolve({ error: null }));
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
      rpc,
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { slug: "demo" }, error: null }) }) }),
      })),
    });
    const createUser = vi.fn().mockResolvedValue({ data: { user: { id: "new-uid" } }, error: null });
    createAdminClient.mockReturnValue({ auth: { admin: { createUser, deleteUser: vi.fn() } } });

    const res = await POST(req(validBody));
    expect(res.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "demo.kim@staff.gwanribiseo.app", password: "pw12", email_confirm: true,
    }));
    expect(rpc).toHaveBeenCalledWith("provision_member", expect.objectContaining({
      p_user_id: "new-uid", p_username: "kim", p_staff_type: "manager_staff",
    }));
  });
});
```

> 참고: `serverClient` 헬퍼는 첫 두 케이스용 간이 버전. 셋째 케이스는 인라인으로 완전한 mock을 구성한다(위 코드 그대로 사용).

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- app/api/accounts/route.test.ts`
Expected: FAIL — `./route`·`@/lib/supabase/admin` 미존재.

- [ ] **Step 3: admin 클라이언트 작성**

Create `lib/supabase/admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

// 서버 전용. service_role 키 사용 — 절대 클라이언트 번들에 포함 금지(NEXT_PUBLIC_ 아님).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

- [ ] **Step 4: 라우트 작성**

Create `app/api/accounts/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginEmail } from "@/lib/auth/email";

export async function POST(req: Request) {
  const supabase = await createClient();

  // 1) 인증
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  // 2) 인가
  const { data: ctxRows } = await supabase.rpc("get_my_context");
  const ctx = Array.isArray(ctxRows) ? ctxRows[0] : ctxRows;
  if (!ctx) return NextResponse.json({ error: "조직 정보를 찾을 수 없습니다." }, { status: 403 });
  const isMaster = ctx.role === "org_owner" || ctx.role === "platform_admin";
  const perms: string[] = Array.isArray(ctx.permissions) ? ctx.permissions : [];
  if (!isMaster && !perms.includes("accounts"))
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  // 3) 검증
  const body = await req.json().catch(() => null);
  const { username, password, fullName, phone, phoneSub, role, staffType, permissions, affiliation, roleIds } = body ?? {};
  if (!username || !password || !fullName || !staffType)
    return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 422 });

  // 4) 회사코드(slug)
  const { data: org } = await supabase.from("organizations").select("slug").eq("id", ctx.org_id).single();
  if (!org?.slug)
    return NextResponse.json({ error: "회사코드(slug)가 설정되지 않았습니다." }, { status: 409 });

  // 5) auth 사용자 생성
  const admin = createAdminClient();
  const email = loginEmail(org.slug, username);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !created?.user) {
    const dup = /already|exists|registered/i.test(createErr?.message ?? "");
    return NextResponse.json(
      { error: dup ? "이미 존재하는 아이디입니다." : "계정 생성에 실패했습니다." },
      { status: dup ? 409 : 500 });
  }

  // 6) 행 삽입(RPC, 원자·감사·비마스터 역할축소는 RPC 내부에서)
  const { error: rpcErr } = await supabase.rpc("provision_member", {
    p_user_id: created.user.id, p_username: username, p_full_name: fullName,
    p_phone: phone ?? null, p_phone_sub: phoneSub ?? null,
    p_role: role ?? "staff", p_staff_type: staffType,
    p_permissions: permissions ?? [], p_affiliation: affiliation ?? null,
    p_role_ids: roleIds ?? null,
  });
  if (rpcErr) {
    await admin.auth.admin.deleteUser(created.user.id); // 롤백(고아 방지)
    return NextResponse.json({ error: "계정 정보 저장에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ userId: created.user.id }, { status: 201 });
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- app/api/accounts/route.test.ts`
Expected: PASS (401/403/201).

- [ ] **Step 6: 커밋**

```bash
git add lib/supabase/admin.ts app/api/accounts/route.ts app/api/accounts/route.test.ts
git commit -m "feat(api): 계정 생성 라우트(service_role) + provision_member 연동"
```

---

## Task 4: 비밀번호 재설정 라우트(PATCH)

**Files:**
- Create: `app/api/accounts/[userId]/route.ts`
- Test: `app/api/accounts/[userId]/route.test.ts`

**Interfaces:**
- Consumes: `@/lib/supabase/server`, `@/lib/supabase/admin`, Task 1 `get_my_context`·`list_accounts`.
- Produces: `PATCH /api/accounts/:userId` (body `{password}`; `200 {ok}` / `401|403|404|422|500`) — Task 5 `resetPassword`가 호출.

> Next 16 동적 세그먼트: 두 번째 인자 `{ params }`의 `params`는 Promise일 수 있음 — 가이드 확인 후 `await params`.

- [ ] **Step 1: 실패 테스트 작성**

Create `app/api/accounts/[userId]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { PATCH } from "./route";

function ctxRpc(ctx: any, accounts: any[]) {
  return vi.fn().mockImplementation((name: string) =>
    name === "get_my_context"
      ? Promise.resolve({ data: ctx ? [ctx] : [], error: null })
      : name === "list_accounts"
      ? Promise.resolve({ data: accounts, error: null })
      : Promise.resolve({ error: null }));
}
const params = Promise.resolve({ userId: "target-uid" });
function req(body: any) {
  return new Request("http://localhost/api/accounts/target-uid", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/accounts/:userId", () => {
  it("미인증 → 401", async () => {
    createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }, rpc: vi.fn() });
    const res = await PATCH(req({ password: "new" }), { params });
    expect(res.status).toBe(401);
  });

  it("권한 없음 → 403", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      rpc: ctxRpc({ org_id: 1, role: "staff", permissions: [] }, []),
    });
    const res = await PATCH(req({ password: "new" }), { params });
    expect(res.status).toBe(403);
  });

  it("마스터 정상 → 200 + updateUserById 호출", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      rpc: ctxRpc({ org_id: 1, role: "org_owner", permissions: [] }, [{ user_id: "target-uid" }]),
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } });
    const res = await PATCH(req({ password: "newpw" }), { params });
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("target-uid", { password: "newpw" });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- "app/api/accounts/[userId]/route.test.ts"`
Expected: FAIL — `./route` 미존재.

- [ ] **Step 3: 라우트 작성**

Create `app/api/accounts/[userId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: ctxRows } = await supabase.rpc("get_my_context");
  const ctx = Array.isArray(ctxRows) ? ctxRows[0] : ctxRows;
  const isMaster = ctx?.role === "org_owner" || ctx?.role === "platform_admin";
  const perms: string[] = Array.isArray(ctx?.permissions) ? ctx.permissions : [];
  if (!ctx || (!isMaster && !perms.includes("accounts")))
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  // 대상이 동일 org인지 확인(list_accounts는 org 격리됨)
  const { data: accounts } = await supabase.rpc("list_accounts");
  const inOrg = Array.isArray(accounts) && accounts.some((a: { user_id: string }) => a.user_id === userId);
  if (!inOrg) return NextResponse.json({ error: "대상 계정을 찾을 수 없습니다." }, { status: 404 });

  const { password } = (await req.json().catch(() => ({}))) ?? {};
  if (!password) return NextResponse.json({ error: "비밀번호를 입력해 주세요." }, { status: 422 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- "app/api/accounts/[userId]/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add "app/api/accounts/[userId]/route.ts" "app/api/accounts/[userId]/route.test.ts"
git commit -m "feat(api): 계정 비밀번호 재설정 라우트(PATCH)"
```

---

## Task 5: accounts 데이터 훅

**Files:**
- Create: `hooks/reactquery/accounts/apis.ts`, `keys.ts`, `queries.ts`, `mutations.ts`, `index.ts`
- Test: `hooks/reactquery/accounts/apis.test.ts`

**Interfaces:**
- Consumes: `@/lib/supabase/client`, `@/hooks/reactquery/auth` `StaffType`/`OrgMemberRole`, Task 1 RPC들, Task 3/4 라우트.
- Produces: `Account`,`AccountCreateInput`,`AccountBasicInput`,`PermissionInput`; `useAccounts`,`useCreateAccount`,`useUpdateAccountBasic`,`useUpdatePermissions`,`useSetActive`,`useResetPassword`; `accountKeys` — Task 9/10/11이 사용.

- [ ] **Step 1: 실패 테스트 작성**

Create `hooks/reactquery/accounts/apis.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
import { listAccounts, updatePermissions, setActive, createAccount } from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("accounts apis", () => {
  it("listAccounts: snake→camel 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      user_id: "u1", username: "kim", full_name: "김직원", phone: "010", phone_sub: null,
      role: "staff", staff_type: "manager_staff", affiliation: null, is_active: true,
      permissions: ["buildings"], role_labels: ["관리"],
    }], error: null });
    const r = await listAccounts({ search: "김" });
    expect(rpc).toHaveBeenCalledWith("list_accounts", { p_search: "김", p_type: null });
    expect(r[0]).toMatchObject({ userId: "u1", fullName: "김직원", staffType: "manager_staff", roleLabels: ["관리"] });
  });

  it("updatePermissions: admin_set_member_permissions 인자 매핑", async () => {
    rpc.mockResolvedValue({ error: null });
    await updatePermissions("u1", { role: "org_owner", staffType: "manager_staff", permissions: ["accounts"], roleIds: [2] });
    expect(rpc).toHaveBeenCalledWith("admin_set_member_permissions", {
      p_user_id: "u1", p_role: "org_owner", p_staff_type: "manager_staff",
      p_permissions: ["accounts"], p_role_ids: [2],
    });
  });

  it("setActive: admin_set_active 호출", async () => {
    rpc.mockResolvedValue({ error: null });
    await setActive("u1", false);
    expect(rpc).toHaveBeenCalledWith("admin_set_active", { p_user_id: "u1", p_active: false });
  });

  it("createAccount: POST /api/accounts 실패 시 에러 메시지 throw", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "이미 존재하는 아이디입니다." }) }) as any;
    await expect(createAccount({
      username: "kim", password: "pw", fullName: "김", role: "staff",
      staffType: "manager_staff", permissions: [], roleIds: [],
    })).rejects.toThrow("이미 존재하는 아이디입니다.");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- hooks/reactquery/accounts/apis.test.ts`
Expected: FAIL — `./apis` 미존재.

- [ ] **Step 3: 모듈 파일 작성**

Create `hooks/reactquery/accounts/apis.ts`:

```ts
import { createClient } from "@/lib/supabase/client";
import type { OrgMemberRole, StaffType } from "@/hooks/reactquery/auth";

export interface Account {
  userId: string; username: string; fullName: string;
  phone: string | null; phoneSub: string | null;
  role: OrgMemberRole; staffType: StaffType; affiliation: string | null;
  isActive: boolean; permissions: string[]; roleLabels: string[];
}
export interface AccountCreateInput {
  username: string; password: string; fullName: string;
  phone?: string; phoneSub?: string;
  role: OrgMemberRole; staffType: StaffType;
  permissions: string[]; affiliation?: string; roleIds: number[];
}
export interface AccountBasicInput {
  fullName: string; phone?: string; phoneSub?: string;
  staffType: StaffType; affiliation?: string; roleIds: number[];
}
export interface PermissionInput {
  role: OrgMemberRole; staffType: StaffType; permissions: string[]; roleIds: number[];
}

const rowToAccount = (r: any): Account => ({
  userId: r.user_id, username: r.username, fullName: r.full_name,
  phone: r.phone, phoneSub: r.phone_sub, role: r.role, staffType: r.staff_type,
  affiliation: r.affiliation, isActive: r.is_active,
  permissions: Array.isArray(r.permissions) ? r.permissions : [],
  roleLabels: Array.isArray(r.role_labels) ? r.role_labels : [],
});

export async function listAccounts(params?: { search?: string; type?: StaffType }): Promise<Account[]> {
  const { data, error } = await createClient().rpc("list_accounts", {
    p_search: params?.search ?? null, p_type: params?.type ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToAccount);
}

export async function createAccount(input: AccountCreateInput): Promise<{ userId: string }> {
  const res = await fetch("/api/accounts", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "계정 생성에 실패했습니다.");
  return json;
}

export async function updateAccountBasic(userId: string, input: AccountBasicInput): Promise<void> {
  const { error } = await createClient().rpc("admin_update_member_basic", {
    p_user_id: userId, p_full_name: input.fullName, p_phone: input.phone ?? null,
    p_phone_sub: input.phoneSub ?? null, p_staff_type: input.staffType,
    p_affiliation: input.affiliation ?? null, p_role_ids: input.roleIds,
  });
  if (error) throw new Error(error.message);
}

export async function updatePermissions(userId: string, input: PermissionInput): Promise<void> {
  const { error } = await createClient().rpc("admin_set_member_permissions", {
    p_user_id: userId, p_role: input.role, p_staff_type: input.staffType,
    p_permissions: input.permissions, p_role_ids: input.roleIds,
  });
  if (error) throw new Error(error.message);
}

export async function setActive(userId: string, active: boolean): Promise<void> {
  const { error } = await createClient().rpc("admin_set_active", { p_user_id: userId, p_active: active });
  if (error) throw new Error(error.message);
}

export async function resetPassword(userId: string, password: string): Promise<void> {
  const res = await fetch(`/api/accounts/${userId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? "비밀번호 변경에 실패했습니다.");
  }
}
```

Create `hooks/reactquery/accounts/keys.ts`:

```ts
export const accountKeys = {
  all: ["accounts"] as const,
  list: (search?: string, type?: string) => ["accounts", "list", search ?? "", type ?? ""] as const,
};
```

Create `hooks/reactquery/accounts/queries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { listAccounts } from "./apis";
import type { StaffType } from "@/hooks/reactquery/auth";
import { accountKeys } from "./keys";

export function useAccounts(params?: { search?: string; type?: StaffType }) {
  return useQuery({
    queryKey: accountKeys.list(params?.search, params?.type),
    queryFn: () => listAccounts(params),
  });
}
```

Create `hooks/reactquery/accounts/mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createAccount, updateAccountBasic, updatePermissions, setActive, resetPassword,
  type AccountCreateInput, type AccountBasicInput, type PermissionInput,
} from "./apis";
import { accountKeys } from "./keys";

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: AccountCreateInput) => createAccount(i),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
export function useUpdateAccountBasic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AccountBasicInput }) => updateAccountBasic(userId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
export function useUpdatePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: PermissionInput }) => updatePermissions(userId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
export function useSetActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) => setActive(userId, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
export function useResetPassword() {
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) => resetPassword(userId, password),
  });
}
```

Create `hooks/reactquery/accounts/index.ts`:

```ts
export * from "./apis"; export * from "./keys"; export * from "./queries"; export * from "./mutations";
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- hooks/reactquery/accounts/apis.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add hooks/reactquery/accounts
git commit -m "feat(accounts): 계정 데이터 훅(list/create/basic/permissions/active/password)"
```

---

## Task 6: staffRoles(담당역할) 데이터 훅

**Files:**
- Create: `hooks/reactquery/staffRoles/apis.ts`, `keys.ts`, `queries.ts`, `mutations.ts`, `index.ts`
- Test: `hooks/reactquery/staffRoles/apis.test.ts`

**Interfaces:**
- Consumes: `@/lib/supabase/client`, Task 1 `staff_roles` 테이블(RLS).
- Produces: `StaffRole`,`StaffRoleInput`; `useStaffRoles`,`useCreateStaffRole`,`useRenameStaffRole`,`useDeleteStaffRole`; `staffRoleKeys` — Task 9/11이 사용.

- [ ] **Step 1: 실패 테스트 작성**

Create `hooks/reactquery/staffRoles/apis.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listStaffRoles, createStaffRole, deleteStaffRole } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("staffRoles apis", () => {
  it("listStaffRoles: 소프트삭제 제외 + 매핑", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 1, org_id: 9, label: "관리", sort_order: 1 }], error: null });
    const is = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: () => ({ is }) });
    const r = await listStaffRoles();
    expect(is).toHaveBeenCalledWith("deleted_at", null);
    expect(r[0]).toMatchObject({ id: 1, label: "관리", sortOrder: 1 });
  });

  it("createStaffRole: org_id 포함 insert", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 2, org_id: 9, label: "검침", sort_order: 2 }, error: null });
    const sel = vi.fn(() => ({ single })); const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await createStaffRole({ orgId: 9, label: "검침", sortOrder: 2 });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id: 9, label: "검침", sort_order: 2 }));
  });

  it("deleteStaffRole: soft delete(deleted_at)", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null }); const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await deleteStaffRole(1);
    expect(upd).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- hooks/reactquery/staffRoles/apis.test.ts`
Expected: FAIL — `./apis` 미존재.

- [ ] **Step 3: 모듈 작성**

Create `hooks/reactquery/staffRoles/apis.ts`:

```ts
import { createClient } from "@/lib/supabase/client";

export interface StaffRole { id: number; orgId: number; label: string; sortOrder: number; }
export interface StaffRoleInput { orgId: number; label: string; sortOrder?: number; }

const rowTo = (r: any): StaffRole => ({ id: r.id, orgId: r.org_id, label: r.label, sortOrder: r.sort_order });

export async function listStaffRoles(): Promise<StaffRole[]> {
  const { data, error } = await createClient()
    .from("staff_roles").select("*").is("deleted_at", null).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowTo);
}
export async function createStaffRole(input: StaffRoleInput): Promise<StaffRole> {
  const { data, error } = await createClient().from("staff_roles")
    .insert({ org_id: input.orgId, label: input.label, sort_order: input.sortOrder ?? 0 })
    .select().single();
  if (error) throw new Error(error.message);
  return rowTo(data);
}
export async function renameStaffRole(id: number, label: string): Promise<void> {
  const { error } = await createClient().from("staff_roles").update({ label }).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteStaffRole(id: number): Promise<void> {
  const { error } = await createClient().from("staff_roles")
    .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
```

Create `hooks/reactquery/staffRoles/keys.ts`:

```ts
export const staffRoleKeys = { all: ["staffRoles"] as const };
```

Create `hooks/reactquery/staffRoles/queries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { listStaffRoles } from "./apis";
import { staffRoleKeys } from "./keys";
export function useStaffRoles() {
  return useQuery({ queryKey: staffRoleKeys.all, queryFn: listStaffRoles });
}
```

Create `hooks/reactquery/staffRoles/mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createStaffRole, renameStaffRole, deleteStaffRole, type StaffRoleInput } from "./apis";
import { staffRoleKeys } from "./keys";
export function useCreateStaffRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: StaffRoleInput) => createStaffRole(i),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffRoleKeys.all }) });
}
export function useRenameStaffRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, label }: { id: number; label: string }) => renameStaffRole(id, label),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffRoleKeys.all }) });
}
export function useDeleteStaffRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deleteStaffRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffRoleKeys.all }) });
}
```

Create `hooks/reactquery/staffRoles/index.ts`:

```ts
export * from "./apis"; export * from "./keys"; export * from "./queries"; export * from "./mutations";
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- hooks/reactquery/staffRoles/apis.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add hooks/reactquery/staffRoles
git commit -m "feat(accounts): 담당역할(staff_roles) 데이터 훅"
```

---

## Task 7: 계정 폼 zod 스키마

**Files:**
- Create: `components/forms/schema/account.ts`
- Test: `components/forms/schema/account.test.ts`

**Interfaces:**
- Produces: `accountCreateSchema`,`accountEditSchema`,`AccountCreateValues`,`AccountEditValues`,`STAFF_TYPES` — Task 9가 사용.

- [ ] **Step 1: 실패 테스트 작성**

Create `components/forms/schema/account.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { accountCreateSchema, accountEditSchema } from "./account";

describe("accountCreateSchema", () => {
  it("username·password·fullName·staffType 필수", () => {
    expect(accountCreateSchema.safeParse({ staffType: "manager_staff" }).success).toBe(false);
    expect(accountCreateSchema.safeParse({
      username: "kim", password: "pw12", fullName: "김직원", staffType: "manager_staff",
    }).success).toBe(true);
  });
  it("password 4자 미만 실패", () => {
    expect(accountCreateSchema.safeParse({
      username: "kim", password: "1", fullName: "김", staffType: "manager_staff",
    }).success).toBe(false);
  });
  it("잘못된 staffType 거부", () => {
    expect(accountCreateSchema.safeParse({
      username: "kim", password: "pw12", fullName: "김", staffType: "boss",
    }).success).toBe(false);
  });
});

describe("accountEditSchema", () => {
  it("username/password 없이도 통과(fullName 필수)", () => {
    expect(accountEditSchema.safeParse({ fullName: "김직원", staffType: "manager_staff" }).success).toBe(true);
    expect(accountEditSchema.safeParse({ fullName: "", staffType: "manager_staff" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- components/forms/schema/account.test.ts`
Expected: FAIL — `./account` 미존재.

- [ ] **Step 3: 스키마 작성**

Create `components/forms/schema/account.ts`:

```ts
import { z } from "zod";

export const STAFF_TYPES = ["manager_staff", "field_staff", "support_staff", "tenant"] as const;

const base = {
  fullName: z.string().min(1, "이름을 입력해 주세요"),
  phone: z.string().optional(),
  phoneSub: z.string().optional(),
  staffType: z.enum(STAFF_TYPES),
  isMaster: z.boolean().default(false),
  affiliation: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  roleIds: z.array(z.number()).default([]),
};

export const accountCreateSchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(4, "비밀번호는 4자 이상 입력해 주세요"),
  ...base,
});
export const accountEditSchema = z.object({ ...base });

export type AccountCreateValues = z.infer<typeof accountCreateSchema>;
export type AccountEditValues = z.infer<typeof accountEditSchema>;
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- components/forms/schema/account.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add components/forms/schema/account.ts components/forms/schema/account.test.ts
git commit -m "feat(accounts): 계정 폼 zod 스키마(create/edit)"
```

---

## Task 8: PermissionChecklist + StaffRoleSelect 컴포넌트

**Files:**
- Create: `app/(staff)/staff/accounts/components/PermissionChecklist.tsx`
- Create: `app/(staff)/staff/accounts/components/StaffRoleSelect.tsx`
- Test: `app/(staff)/staff/accounts/components/PermissionChecklist.test.tsx`

**Interfaces:**
- Consumes: `@/lib/auth/permissions` `MODULE_KEYS`·`MODULE_LABELS`·`ModuleKey`; `@/components/common` `Checkbox`; `@/hooks/reactquery/staffRoles` `StaffRole`.
- Produces: `<PermissionChecklist value onChange disabled? allGranted? />`, `<StaffRoleSelect roles value onChange disabled? />` — Task 9가 사용.

> `Checkbox`는 `label:string` prop이 필수(`components/common/Checkbox.tsx`) — `<Checkbox label=... checked=... onChange=... disabled=... />`.

- [ ] **Step 1: 실패 테스트 작성**

Create `app/(staff)/staff/accounts/components/PermissionChecklist.test.tsx`:

```tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PermissionChecklist } from "./PermissionChecklist";

describe("PermissionChecklist", () => {
  it("11개 모듈 라벨 렌더", () => {
    render(<PermissionChecklist value={[]} onChange={() => {}} />);
    expect(screen.getByText("계정 관리")).toBeInTheDocument();
    expect(screen.getByText("부과 확정")).toBeInTheDocument();
  });

  it("disabled면 클릭해도 onChange 미호출", () => {
    const onChange = vi.fn();
    render(<PermissionChecklist value={[]} onChange={onChange} disabled />);
    fireEvent.click(screen.getByText("계정 관리"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("체크 클릭 시 해당 키 토글", () => {
    const onChange = vi.fn();
    render(<PermissionChecklist value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("계정 관리"));
    expect(onChange).toHaveBeenCalledWith(["accounts"]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- app/(staff)/staff/accounts/components/PermissionChecklist.test.tsx`
Expected: FAIL — 컴포넌트 미존재.

- [ ] **Step 3: 컴포넌트 작성**

Create `app/(staff)/staff/accounts/components/PermissionChecklist.tsx`:

```tsx
"use client";
import { Checkbox } from "@/components/common";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "@/lib/auth/permissions";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  /** 마스터(전체 통과)면 모두 체크·비활성 표시 */
  allGranted?: boolean;
}

export function PermissionChecklist({ value, onChange, disabled, allGranted }: Props) {
  const toggle = (k: ModuleKey) => {
    if (disabled || allGranted) return;
    onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {MODULE_KEYS.map((k) => (
        <Checkbox
          key={k}
          label={MODULE_LABELS[k]}
          checked={allGranted || value.includes(k)}
          disabled={disabled || allGranted}
          onChange={() => toggle(k)}
        />
      ))}
    </div>
  );
}
```

Create `app/(staff)/staff/accounts/components/StaffRoleSelect.tsx`:

```tsx
"use client";
import { Checkbox } from "@/components/common";
import type { StaffRole } from "@/hooks/reactquery/staffRoles";

interface Props {
  roles: StaffRole[];
  value: number[];
  onChange: (v: number[]) => void;
  disabled?: boolean;
}

export function StaffRoleSelect({ roles, value, onChange, disabled }: Props) {
  const toggle = (id: number) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  if (roles.length === 0) return <p className="text-xs text-t4">등록된 담당역할이 없습니다.</p>;
  return (
    <div className="flex flex-wrap gap-3">
      {roles.map((r) => (
        <Checkbox key={r.id} label={r.label} checked={value.includes(r.id)} disabled={disabled}
          onChange={() => toggle(r.id)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- app/(staff)/staff/accounts/components/PermissionChecklist.test.tsx`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/accounts/components/PermissionChecklist.tsx" "app/(staff)/staff/accounts/components/StaffRoleSelect.tsx" "app/(staff)/staff/accounts/components/PermissionChecklist.test.tsx"
git commit -m "feat(accounts): 권한 체크리스트 + 담당역할 선택 컴포넌트"
```

---

## Task 9: AccountFormModal (등록·수정 폼)

**Files:**
- Create: `app/(staff)/staff/accounts/components/AccountFormModal.tsx`
- Test: `app/(staff)/staff/accounts/components/AccountFormModal.test.tsx`

**Interfaces:**
- Consumes: `@/components/common`(Modal,Input,Select,Button), react-hook-form + zodResolver, Task 7 스키마, Task 8 컴포넌트, `@/hooks/reactquery/staffRoles` `StaffRole`, `@/hooks/reactquery/accounts` `Account`.
- Produces: `<AccountFormModal open onClose editing roles canEditPermissions onCreate onUpdateBasic onUpdatePermissions isPending />` — Task 11이 사용.
  - `editing: Account | null` (null=등록)
  - `canEditPermissions: boolean` (마스터 여부 → 권한 체크리스트 편집 가능)
  - `onCreate(input: AccountCreateInput): Promise<void>`
  - `onUpdateBasic(userId, input: AccountBasicInput): Promise<void>`
  - `onUpdatePermissions(userId, input: PermissionInput): Promise<void>`

> 세입자(`tenant`)는 등록 시 유형 선택 불가(읽기전용 안내). role은 `isMaster` 체크박스로 `org_owner`↔`staff` 결정(manager_staff 한정).

- [ ] **Step 1: 실패 테스트 작성**

Create `app/(staff)/staff/accounts/components/AccountFormModal.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AccountFormModal } from "./AccountFormModal";
import type { Account } from "@/hooks/reactquery/accounts";

const noop = async () => {};
const baseProps = {
  open: true, onClose: () => {}, roles: [{ id: 1, orgId: 9, label: "관리", sortOrder: 1 }],
  canEditPermissions: true, onCreate: noop, onUpdateBasic: noop, onUpdatePermissions: noop, isPending: false,
};

describe("AccountFormModal", () => {
  it("등록 모드: 아이디·비밀번호 입력 노출", () => {
    render(<AccountFormModal {...baseProps} editing={null} />);
    expect(screen.getByText("계정 등록")).toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
  });

  it("manager_staff 유형에서 권한 체크리스트 노출", () => {
    render(<AccountFormModal {...baseProps} editing={null} />);
    // 기본 유형 manager_staff → 권한 섹션 제목
    expect(screen.getByText("기능별 권한")).toBeInTheDocument();
  });

  it("canEditPermissions=false면 권한 체크리스트 disabled 안내", () => {
    render(<AccountFormModal {...baseProps} editing={null} canEditPermissions={false} />);
    expect(screen.getByText(/마스터 직원만/)).toBeInTheDocument();
  });

  it("수정 모드(tenant): 읽기전용 안내 노출", () => {
    const tenant: Account = {
      userId: "t1", username: "tenant1", fullName: "세입자", phone: null, phoneSub: null,
      role: "tenant", staffType: "tenant", affiliation: null, isActive: true, permissions: [], roleLabels: [],
    };
    render(<AccountFormModal {...baseProps} editing={tenant} />);
    expect(screen.getByText(/입주자 상세에서/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- app/(staff)/staff/accounts/components/AccountFormModal.test.tsx`
Expected: FAIL — 컴포넌트 미존재.

- [ ] **Step 3: 컴포넌트 작성**

Create `app/(staff)/staff/accounts/components/AccountFormModal.tsx`:

```tsx
"use client";
import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal, Input, Select, Button } from "@/components/common";
import { accountCreateSchema, accountEditSchema, STAFF_TYPES } from "@/components/forms/schema/account";
import { PermissionChecklist } from "./PermissionChecklist";
import { StaffRoleSelect } from "./StaffRoleSelect";
import type { StaffRole } from "@/hooks/reactquery/staffRoles";
import type {
  Account, AccountCreateInput, AccountBasicInput, PermissionInput,
} from "@/hooks/reactquery/accounts";
import type { StaffType } from "@/hooks/reactquery/auth";

const STAFF_TYPE_OPTIONS: { value: StaffType; label: string }[] = [
  { value: "manager_staff", label: "직원(내근)" },
  { value: "field_staff", label: "현장직원" },
  { value: "support_staff", label: "스태프(청소·관리실 등)" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Account | null;
  roles: StaffRole[];
  canEditPermissions: boolean;
  onCreate: (input: AccountCreateInput) => Promise<void>;
  onUpdateBasic: (userId: string, input: AccountBasicInput) => Promise<void>;
  onUpdatePermissions: (userId: string, input: PermissionInput) => Promise<void>;
  isPending: boolean;
}

interface FormValues {
  username: string; password: string; fullName: string;
  phone: string; phoneSub: string; staffType: StaffType;
  isMaster: boolean; affiliation: string; permissions: string[]; roleIds: number[];
}

export function AccountFormModal({
  open, onClose, editing, roles, canEditPermissions,
  onCreate, onUpdateBasic, onUpdatePermissions, isPending,
}: Props) {
  const isEdit = !!editing;
  const isTenant = editing?.staffType === "tenant";

  const defaults: FormValues = editing
    ? {
        username: editing.username, password: "", fullName: editing.fullName,
        phone: editing.phone ?? "", phoneSub: editing.phoneSub ?? "",
        staffType: editing.staffType, isMaster: editing.role === "org_owner" || editing.role === "platform_admin",
        affiliation: editing.affiliation ?? "", permissions: editing.permissions,
        roleIds: [], // 편집 시 roleLabels만 알고 있으므로 재선택(간이). 상세 매핑은 후속.
      }
    : {
        username: "", password: "", fullName: "", phone: "", phoneSub: "",
        staffType: "manager_staff", isMaster: false, affiliation: "", permissions: [], roleIds: [],
      };

  const { register, control, handleSubmit, watch, reset, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(isEdit ? accountEditSchema : accountCreateSchema) as any,
      defaultValues: defaults,
    });

  React.useEffect(() => { if (open) reset(defaults); }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const staffType = watch("staffType");
  const isMaster = watch("isMaster");
  const showPermissions = staffType === "manager_staff";

  const onValid = async (v: FormValues) => {
    const role = v.isMaster ? "org_owner" : v.staffType === "field_staff" ? "field" : "staff";
    if (!isEdit) {
      await onCreate({
        username: v.username, password: v.password, fullName: v.fullName,
        phone: v.phone || undefined, phoneSub: v.phoneSub || undefined,
        role, staffType: v.staffType, permissions: showPermissions ? v.permissions : [],
        affiliation: v.affiliation || undefined, roleIds: v.roleIds,
      });
    } else if (editing) {
      await onUpdateBasic(editing.userId, {
        fullName: v.fullName, phone: v.phone || undefined, phoneSub: v.phoneSub || undefined,
        staffType: v.staffType, affiliation: v.affiliation || undefined, roleIds: v.roleIds,
      });
      if (canEditPermissions && showPermissions) {
        await onUpdatePermissions(editing.userId, {
          role, staffType: v.staffType, permissions: v.permissions, roleIds: v.roleIds,
        });
      }
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "계정 수정" : "계정 등록"}>
      {isTenant ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-t2">
            세입자 계정은 <b>입주자 상세에서</b> 생성·관리합니다. 이 화면에서는 조회·비활성·비밀번호 재설정만 가능합니다.
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
          {/* 이름 */}
          <div>
            <label htmlFor="fullName" className="mb-1 block text-xs font-semibold text-t3">이름</label>
            <Input id="fullName" {...register("fullName")} placeholder="예: 김직원"
              className={errors.fullName ? "border-danger" : ""} />
            {errors.fullName && <p className="mt-1 text-xs text-danger">{errors.fullName.message as string}</p>}
          </div>

          {/* 연락처 주/부 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="phone" className="mb-1 block text-xs font-semibold text-t3">연락처(주)</label>
              <Input id="phone" {...register("phone")} placeholder="010-0000-0000" />
            </div>
            <div>
              <label htmlFor="phoneSub" className="mb-1 block text-xs font-semibold text-t3">연락처(부)</label>
              <Input id="phoneSub" {...register("phoneSub")} placeholder="선택" />
            </div>
          </div>

          {/* 유형 */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-t3">유형</label>
            <Controller control={control} name="staffType" render={({ field }) => (
              <Select options={STAFF_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={field.value} onChange={(e) => field.onChange(e.target.value as StaffType)} />
            )} />
          </div>

          {/* 아이디·비밀번호 (등록 시만) */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="username" className="mb-1 block text-xs font-semibold text-t3">아이디</label>
                <Input id="username" {...register("username")} placeholder="영문 아이디"
                  className={errors.username ? "border-danger" : ""} />
                {errors.username && <p className="mt-1 text-xs text-danger">{errors.username.message as string}</p>}
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-xs font-semibold text-t3">비밀번호</label>
                <Input id="password" type="password" {...register("password")} placeholder="4자 이상"
                  className={errors.password ? "border-danger" : ""} />
                {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message as string}</p>}
              </div>
            </div>
          )}

          {/* 소속 (스태프 유형) */}
          {staffType === "support_staff" && (
            <div>
              <label htmlFor="affiliation" className="mb-1 block text-xs font-semibold text-t3">소속</label>
              <Input id="affiliation" {...register("affiliation")} placeholder="예: A청소팀" />
            </div>
          )}

          {/* 담당역할 */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-t3">담당역할</label>
            <Controller control={control} name="roleIds" render={({ field }) => (
              <StaffRoleSelect roles={roles} value={field.value} onChange={field.onChange} />
            )} />
          </div>

          {/* 마스터 + 권한 (manager_staff) */}
          {showPermissions && (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-brand disabled:opacity-70"
                  {...register("isMaster")} disabled={!canEditPermissions} />
                <span>마스터 직원(관리자) — 전체 권한</span>
              </label>
              <p className="text-xs font-semibold text-t3">기능별 권한</p>
              {!canEditPermissions && <p className="text-xs text-t4">마스터 직원만 권한을 변경할 수 있습니다.</p>}
              <Controller control={control} name="permissions" render={({ field }) => (
                <PermissionChecklist value={field.value} onChange={field.onChange}
                  disabled={!canEditPermissions} allGranted={isMaster} />
              )} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "저장 중…" : isEdit ? "수정" : "등록"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- app/(staff)/staff/accounts/components/AccountFormModal.test.tsx`
Expected: PASS.

> 만약 `Select`/`Input`의 실제 prop이 위 사용과 다르면(예: `id` 미지원) 해당 프리미티브 시그니처에 맞춰 최소 수정. `VendorFormModal.tsx`의 사용례가 기준.

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/accounts/components/AccountFormModal.tsx" "app/(staff)/staff/accounts/components/AccountFormModal.test.tsx"
git commit -m "feat(accounts): 계정 등록·수정 폼 모달(유형 분기·권한·세입자 읽기전용)"
```

---

## Task 10: AccountTable (목록 + 상태 토글)

**Files:**
- Create: `app/(staff)/staff/accounts/components/AccountTable.tsx`
- Test: `app/(staff)/staff/accounts/components/AccountTable.test.tsx`

**Interfaces:**
- Consumes: `@/components/common` `DataTable`,`Button`; `@/hooks/reactquery/accounts` `Account`; `@/lib/auth/permissions` `isMaster`.
- Produces: `<AccountTable accounts onRowClick onToggleActive />` — Task 11이 사용.
  - `onRowClick(account: Account): void`, `onToggleActive(account: Account): void`

- [ ] **Step 1: 실패 테스트 작성**

Create `app/(staff)/staff/accounts/components/AccountTable.test.tsx`:

```tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AccountTable } from "./AccountTable";
import type { Account } from "@/hooks/reactquery/accounts";

const accounts: Account[] = [
  { userId: "u1", username: "kim", fullName: "김직원", phone: "010-1", phoneSub: null,
    role: "staff", staffType: "manager_staff", affiliation: null, isActive: true, permissions: ["buildings"], roleLabels: ["관리"] },
  { userId: "u2", username: "boss", fullName: "이관리", phone: null, phoneSub: null,
    role: "org_owner", staffType: "manager_staff", affiliation: null, isActive: false, permissions: [], roleLabels: [] },
];

describe("AccountTable", () => {
  it("이름·유형 라벨 렌더 + 마스터 표기", () => {
    render(<AccountTable accounts={accounts} onRowClick={() => {}} onToggleActive={() => {}} />);
    expect(screen.getByText("김직원")).toBeInTheDocument();
    expect(screen.getByText("이관리")).toBeInTheDocument();
    expect(screen.getByText("관리자")).toBeInTheDocument(); // org_owner → 관리자
  });

  it("행 클릭 시 onRowClick", () => {
    const onRowClick = vi.fn();
    render(<AccountTable accounts={accounts} onRowClick={onRowClick} onToggleActive={() => {}} />);
    fireEvent.click(screen.getByText("김직원"));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" }));
  });

  it("상태 버튼 클릭 시 onToggleActive", () => {
    const onToggleActive = vi.fn();
    render(<AccountTable accounts={accounts} onRowClick={() => {}} onToggleActive={onToggleActive} />);
    fireEvent.click(screen.getByRole("button", { name: /김직원 비활성/ }));
    expect(onToggleActive).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" }));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- app/(staff)/staff/accounts/components/AccountTable.test.tsx`
Expected: FAIL — 컴포넌트 미존재.

- [ ] **Step 3: 컴포넌트 작성**

Create `app/(staff)/staff/accounts/components/AccountTable.tsx`:

```tsx
"use client";
import { DataTable, Button } from "@/components/common";
import { isMaster } from "@/lib/auth/permissions";
import type { Account } from "@/hooks/reactquery/accounts";
import type { StaffType } from "@/hooks/reactquery/auth";

const TYPE_LABEL: Record<StaffType, string> = {
  manager_staff: "직원", field_staff: "현장직원", support_staff: "스태프", tenant: "입주자",
};

function typeLabel(a: Account): string {
  if (a.staffType === "manager_staff" && isMaster(a.role)) return "관리자";
  return TYPE_LABEL[a.staffType];
}

interface Props {
  accounts: Account[];
  onRowClick: (a: Account) => void;
  onToggleActive: (a: Account) => void;
}

export function AccountTable({ accounts, onRowClick, onToggleActive }: Props) {
  const columns = [
    { key: "name", label: "이름" },
    { key: "type", label: "유형" },
    { key: "username", label: "아이디" },
    { key: "phone", label: "연락처" },
    { key: "grade", label: "권한등급" },
    { key: "roles", label: "담당역할" },
    { key: "status", label: "상태" },
  ];
  const rows = accounts.map((a) => ({
    name: <span onClick={() => onRowClick(a)}>{a.fullName}</span>,
    type: typeLabel(a),
    username: a.username,
    phone: a.phone ?? "-",
    grade: isMaster(a.role) ? "마스터" : "일반",
    roles: a.roleLabels.length ? a.roleLabels.join(", ") : "-",
    status: (
      <Button
        type="button"
        variant="ghost"
        aria-label={`${a.fullName} ${a.isActive ? "비활성" : "활성"}`}
        onClick={(e) => { e.stopPropagation(); onToggleActive(a); }}
        className={a.isActive ? "text-brand" : "text-t4"}
      >
        {a.isActive ? "활성" : "비활성"}
      </Button>
    ),
  }));
  return <DataTable columns={columns} rows={rows} onRowClick={(r) => {
    const idx = rows.indexOf(r as (typeof rows)[number]);
    if (idx >= 0) onRowClick(accounts[idx]);
  }} />;
}
```

> `DataTable`은 `onRowClick(row)`에 렌더된 row 객체를 넘긴다. 위처럼 인덱스로 원본 `Account`를 역참조한다(이름 셀의 개별 onClick은 중복 방지를 위해 제거해도 무방 — 테스트는 이름 클릭 시 onRowClick 1회 이상 호출을 검증). 상태 버튼은 `stopPropagation`으로 행 클릭과 분리.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- app/(staff)/staff/accounts/components/AccountTable.test.tsx`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/accounts/components/AccountTable.tsx" "app/(staff)/staff/accounts/components/AccountTable.test.tsx"
git commit -m "feat(accounts): 계정 목록 테이블(유형 라벨·상태 토글)"
```

---

## Task 11: accounts 페이지 + 유형탭·검색·게이팅 + nav 활성화

**Files:**
- Create: `app/(staff)/staff/accounts/page.tsx`
- Test: `app/(staff)/staff/accounts/page.test.tsx`
- Modify: `components/shell/navItems.ts` (accounts `built: false` → `true`)

**Interfaces:**
- Consumes: Task 5/6 훅, Task 9/10 컴포넌트, `@/hooks/reactquery/auth` `useMe`, `@/lib/auth/permissions` `canManageAccounts`·`isMaster`, `@/components/common`(Tabs,SearchBar,Button,EmptyState), `sonner`.

- [ ] **Step 1: 실패 테스트 작성**

Create `app/(staff)/staff/accounts/page.test.tsx`:

```tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/hooks/reactquery/accounts", () => ({
  useAccounts: vi.fn(), useCreateAccount: vi.fn(), useUpdateAccountBasic: vi.fn(),
  useUpdatePermissions: vi.fn(), useSetActive: vi.fn(), useResetPassword: vi.fn(),
}));
vi.mock("@/hooks/reactquery/staffRoles", () => ({ useStaffRoles: vi.fn() }));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import AccountsPage from "./page";
import {
  useAccounts, useCreateAccount, useUpdateAccountBasic, useUpdatePermissions, useSetActive, useResetPassword,
} from "@/hooks/reactquery/accounts";
import { useStaffRoles } from "@/hooks/reactquery/staffRoles";
import { useMe } from "@/hooks/reactquery/auth";

const mutate = { mutateAsync: vi.fn(), isPending: false };
const master = {
  orgId: 1, role: "org_owner", orgStatus: "active", username: "boss", fullName: "이관리",
  isActive: true, mustChangePassword: false, staffType: "manager_staff", permissions: [],
};
const sampleAccounts = [{
  userId: "u1", username: "kim", fullName: "김직원", phone: "010", phoneSub: null,
  role: "staff", staffType: "manager_staff", affiliation: null, isActive: true, permissions: [], roleLabels: [],
}];

function setup(me: any = master) {
  vi.mocked(useMe).mockReturnValue({ data: me } as any);
  vi.mocked(useAccounts).mockReturnValue({ data: sampleAccounts, isLoading: false } as any);
  vi.mocked(useStaffRoles).mockReturnValue({ data: [] } as any);
  vi.mocked(useCreateAccount).mockReturnValue(mutate as any);
  vi.mocked(useUpdateAccountBasic).mockReturnValue(mutate as any);
  vi.mocked(useUpdatePermissions).mockReturnValue(mutate as any);
  vi.mocked(useSetActive).mockReturnValue(mutate as any);
  vi.mocked(useResetPassword).mockReturnValue(mutate as any);
}

beforeEach(() => { vi.clearAllMocks(); setup(); });

describe("AccountsPage", () => {
  it("계정 목록 + 등록 버튼 렌더", () => {
    render(<AccountsPage />);
    expect(screen.getByText("김직원")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /계정 등록/ })).toBeInTheDocument();
  });

  it("+ 계정 등록 클릭 시 모달 오픈", async () => {
    render(<AccountsPage />);
    fireEvent.click(screen.getByRole("button", { name: /계정 등록/ }));
    await waitFor(() => expect(screen.getByText("계정 등록", { selector: "h2, h3" })).toBeInTheDocument());
  });

  it("accounts 권한 없는 사용자는 권한없음 안내", () => {
    setup({ ...master, role: "staff", permissions: [] });
    render(<AccountsPage />);
    expect(screen.getByText(/권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText("김직원")).toBeNull();
  });
});
```

> 모달 타이틀 selector는 `Modal.tsx`의 제목 태그에 맞춘다(대개 `h2`/`h3`). 실제 태그 확인 후 selector 조정.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- app/(staff)/staff/accounts/page.test.tsx`
Expected: FAIL — 페이지 미존재.

- [ ] **Step 3: 페이지 작성**

Create `app/(staff)/staff/accounts/page.tsx`:

```tsx
"use client";
import React, { useState } from "react";
import { toast } from "sonner";
import { Tabs, SearchBar, Button, EmptyState } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { canManageAccounts, isMaster } from "@/lib/auth/permissions";
import type { StaffType } from "@/hooks/reactquery/auth";
import {
  useAccounts, useCreateAccount, useUpdateAccountBasic, useUpdatePermissions, useSetActive,
  type Account, type AccountCreateInput, type AccountBasicInput, type PermissionInput,
} from "@/hooks/reactquery/accounts";
import { useStaffRoles } from "@/hooks/reactquery/staffRoles";
import { AccountTable } from "./components/AccountTable";
import { AccountFormModal } from "./components/AccountFormModal";

const TABS = [
  { id: "all", label: "전체" }, { id: "admin", label: "관리자" }, { id: "staff", label: "직원" },
  { id: "field", label: "현장직원" }, { id: "support", label: "스태프" }, { id: "tenant", label: "입주자" },
];
const TYPE_BY_TAB: Record<string, StaffType | undefined> = {
  all: undefined, admin: "manager_staff", staff: "manager_staff",
  field: "field_staff", support: "support_staff", tenant: "tenant",
};

export default function AccountsPage() {
  const { data: me } = useMe();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const type = TYPE_BY_TAB[tab];
  const { data: accounts = [] } = useAccounts({ search: search || undefined, type });
  const { data: roles = [] } = useStaffRoles();
  const createM = useCreateAccount();
  const basicM = useUpdateAccountBasic();
  const permM = useUpdatePermissions();
  const activeM = useSetActive();

  if (!canManageAccounts(me)) {
    return (
      <div className="p-6">
        <EmptyState title="권한이 없습니다" description="계정·직원 관리 권한이 필요합니다." />
      </div>
    );
  }

  // 관리자/직원 탭은 role로 클라이언트 세분 필터
  const filtered = accounts.filter((a) =>
    tab === "admin" ? isMaster(a.role) : tab === "staff" ? !isMaster(a.role) : true);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (a: Account) => { setEditing(a); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const onCreate = async (input: AccountCreateInput) => {
    try { await createM.mutateAsync(input); toast.success("저장되었습니다"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "오류가 발생했습니다"); throw e; }
  };
  const onUpdateBasic = async (userId: string, input: AccountBasicInput) => {
    try { await basicM.mutateAsync({ userId, input }); toast.success("저장되었습니다"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "오류가 발생했습니다"); throw e; }
  };
  const onUpdatePermissions = async (userId: string, input: PermissionInput) => {
    try { await permM.mutateAsync({ userId, input }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "권한 변경 실패"); throw e; }
  };
  const onToggleActive = async (a: Account) => {
    try { await activeM.mutateAsync({ userId: a.userId, active: !a.isActive }); toast.success("변경되었습니다"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "오류가 발생했습니다"); }
  };

  return (
    <div className="flex h-full min-h-screen flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-t1">계정·직원 관리</h1>
        <Button variant="primary" onClick={openCreate}>+ 계정 등록</Button>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="max-w-md">
        <SearchBar value={search} onChange={setSearch} placeholder="이름·아이디·연락처 검색" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="조건에 맞는 계정이 없습니다" description="유형·검색 조건을 변경해 보세요." />
      ) : (
        <AccountTable accounts={filtered} onRowClick={openEdit} onToggleActive={onToggleActive} />
      )}

      <AccountFormModal
        open={modalOpen}
        onClose={closeModal}
        editing={editing}
        roles={roles}
        canEditPermissions={isMaster(me)}
        onCreate={onCreate}
        onUpdateBasic={onUpdateBasic}
        onUpdatePermissions={onUpdatePermissions}
        isPending={createM.isPending || basicM.isPending || permM.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 4: nav 활성화**

In `components/shell/navItems.ts`, `계정·직원 관리` 항목의 `built: false`를 `true`로 변경:

```ts
      { label: "계정·직원 관리", href: "/staff/accounts", module: "accounts", built: true, icon: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 20a8 8 0 0 1 16 0" },
```

- [ ] **Step 5: 통과 확인**

Run: `npm test -- app/(staff)/staff/accounts/page.test.tsx`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add "app/(staff)/staff/accounts/page.tsx" "app/(staff)/staff/accounts/page.test.tsx" components/shell/navItems.ts
git commit -m "feat(accounts): /accounts 페이지(유형탭·검색·게이팅) + nav 활성화"
```

---

## Task 12: 비활성 계정 로그인 차단(ActiveGuard)

**Files:**
- Create: `components/AccountActiveGuard.tsx`
- Modify: `app/(staff)/layout.tsx`
- Test: `components/AccountActiveGuard.test.tsx`

**Interfaces:**
- Consumes: `@/hooks/reactquery/auth` `useMe`, `@/lib/supabase/client` `createClient`, `next/navigation` `useRouter`.
- Produces: `<AccountActiveGuard />` (null 렌더; `me.isActive===false`면 signOut + `/staff/login` 이동).

- [ ] **Step 1: 실패 테스트 작성**

Create `components/AccountActiveGuard.test.tsx`:

```tsx
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const signOut = vi.fn();
const replace = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));

import { AccountActiveGuard } from "./AccountActiveGuard";
import { useMe } from "@/hooks/reactquery/auth";

beforeEach(() => vi.clearAllMocks());

describe("AccountActiveGuard", () => {
  it("활성 계정은 아무 동작 없음", () => {
    vi.mocked(useMe).mockReturnValue({ data: { isActive: true } } as any);
    render(<AccountActiveGuard />);
    expect(signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("비활성 계정은 signOut + 로그인 이동", async () => {
    signOut.mockResolvedValue({});
    vi.mocked(useMe).mockReturnValue({ data: { isActive: false } } as any);
    render(<AccountActiveGuard />);
    // useEffect 실행 대기
    await Promise.resolve();
    expect(signOut).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/staff/login");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- components/AccountActiveGuard.test.tsx`
Expected: FAIL — 컴포넌트 미존재.

- [ ] **Step 3: 컴포넌트 작성**

Create `components/AccountActiveGuard.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/reactquery/auth";
import { createClient } from "@/lib/supabase/client";

/** 비활성(is_active=false) 계정은 즉시 로그아웃 + 로그인으로. */
export function AccountActiveGuard() {
  const { data: me } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me && me.isActive === false) {
      void createClient().auth.signOut().finally(() => router.replace("/staff/login"));
    }
  }, [me, router]);
  return null;
}
```

- [ ] **Step 4: 레이아웃에 마운트**

In `app/(staff)/layout.tsx`:

```tsx
import { AuthBoot } from "@/components/AuthBoot";
import { AccountActiveGuard } from "@/components/AccountActiveGuard";
import { AppShell } from "@/components/shell/AppShell";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (<><AuthBoot /><AccountActiveGuard /><AppShell>{children}</AppShell></>);
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm test -- components/AccountActiveGuard.test.tsx`
Expected: PASS.

- [ ] **Step 6: 전체 스위트 + 린트**

Run: `npm test`
Expected: 전체 PASS.
Run: `npm run lint`
Expected: 통과(경고 없이).

- [ ] **Step 7: 커밋**

```bash
git add components/AccountActiveGuard.tsx components/AccountActiveGuard.test.tsx "app/(staff)/layout.tsx"
git commit -m "feat(auth): 비활성 계정 로그인 차단 가드"
```

---

## 마무리 검증 (전체)

- [ ] `npm test` 전체 통과
- [ ] `npm run build` 성공(타입 오류 없음)
- [ ] **pending-user**: Supabase에 `0002` 마이그레이션 적용 → `supabase/verify/p2a_checks.sql` 실행하여 컬럼·함수·정책·시드 확인
- [ ] **pending-user**: `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 설정 후 `npm run dev` → 마스터 로그인 → 직원 생성 → 권한 부여 → 일반직원 로그인 시 GNB 게이팅 반영 → 비활성 후 로그인 차단 확인(E2E)

---

## Self-Review 결과 (계획↔spec 대조)

**Spec 커버리지:**
- §3.1~3.5 스키마 → Task 1 ✅ (enum·org_members·profiles·staff_roles·org_member_roles)
- §3.6 get_my_context 수정 → Task 1(SQL) + Task 2(TS 매핑) ✅
- §4.1 헬퍼 → Task 1 (`current_user_is_master`·`current_user_has_module`) ✅
- §4.2 RPC 5종 → Task 1 (`provision_member`는 §5.2 정제분, `admin_set_member_permissions`·`admin_update_member_basic`·`admin_set_active`·`list_accounts`) ✅
- §4.3 신규 테이블 RLS → Task 1 ✅
- §5 프로비저닝(admin 클라이언트·POST·PATCH) → Task 3·4 ✅
- §6 데이터 훅(accounts·staffRoles) → Task 5·6 ✅
- §7 페이지·컴포넌트(폼·체크리스트·테이블·유형탭·게이팅·nav) → Task 7~11 ✅
- §8 인증 플러밍(staffType·is_active·페이지 게이트) → Task 2·11·12 ✅
- §11 테스트 전략 → 각 Task TDD + verify SQL ✅

**Placeholder 스캔:** 없음(모든 스텝에 실제 코드·명령·기대결과 포함). "pending-user" 항목은 로컬 DB 부재로 인한 명시적 수동 절차이며 플레이스홀더가 아님.

**타입 정합성:** `StaffType`(Task 2 정의) → Task 5·9·10·11에서 동일 import. RPC 인자명(`p_user_id`·`p_permissions`·`p_role_ids` 등)이 Task 1 정의 ↔ Task 5 호출 ↔ Task 3 라우트에서 일치. `Account` 필드가 `rowToAccount`(Task 5) ↔ AccountTable/FormModal(Task 9·10)에서 일치. `provision_member` 인자 순서(Task 1) ↔ 라우트 호출 키(Task 3) 일치.

**알려진 간소화(후속 개선 여지, 실행에 지장 없음):**
- Task 9 편집 모드에서 기존 담당역할 `roleIds` 선매핑은 생략(재선택 방식) — `list_accounts`가 label만 반환하기 때문. 필요 시 RPC에 role_ids 배열 추가로 개선(후속).
- Task 4 비밀번호 재설정 시 `must_change_password=true` 재설정은 MVP에서 생략(후속).

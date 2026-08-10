# 관리비서 — P2a 계정·직원 관리(`/accounts`) + 권한 기반 설계 (spec)

- **작성일:** 2026-08-10
- **스택:** Next.js 16(App Router) + Supabase(PostgreSQL·Auth) + React Query + TailwindCSS
- **기준 정본:** `docs/superpowers/specs/2026-08-10-prd-synthesis.md` §A/§B.14/§C(계정·권한 taxonomy)/§E, `docs/prototype/prd/staff-management.md`
- **로드맵:** `docs/superpowers/plans/2026-08-10-roadmap.md` — 본 문서는 로드맵 **P2를 P2a/P2b로 분해**한 것의 P2a.
- **선행:** P0(인증·조직·`org_members`·`get_my_context`·`my_org_ids()`·`audit_log`), P1a(마스터데이터·소프트삭제 패턴), P1-DS(셸·`lib/auth/permissions.ts`·`navItems.ts`)

---

## 0. 배경 & 위치

로드맵의 **P2(계정·권한 & 셋업)**는 규모가 커서 둘로 분해한다: **P2a(본 문서 — `/accounts` + 권한 기반)** · **P2b(`/setup` 5탭)**.

현재 상태의 핵심 문제: `org_members`에 권한 저장 컬럼이 **없고**, `get_my_context()` RPC가 `permissions`를 **반환하지 않아** 프론트의 `MyContext.permissions`가 항상 `[]`다. 즉 권한 게이팅은 실질적으로 `org_owner`(마스터)만 동작한다. P2a가 이 권한 체계를 **DB·RLS·프로비저닝·UI**로 실제 작동하게 만든다. 이후 모든 단계가 이 기반을 참조한다(횡단원칙: "P2에서 module-permission RLS 시작").

---

## 1. 목표 & 범위

**In scope**
- **`/staff/accounts` 화면**: 계정 유형별(관리자/직원/현장직원/스태프/세입자) 등록·수정·비활성, 검색·유형필터, **기능별 권한 체크리스트**(마스터 직원만 편집).
- **권한 DB 스키마**: `org_members.staff_type`·`feature_permissions`, 담당역할 마스터(`staff_roles`)+조인(`org_member_roles`), `profiles.phone_sub`(부번호).
- **권한 RLS·RPC 기반**: 재사용 헬퍼 `current_user_has_module()`, 마스터 게이트 RPC(권한·역할 변경), `accounts` 권한 게이트 RPC(기본정보·활성), 계정 디렉터리 조회 RPC.
- **계정 프로비저닝**: Next.js 서버 라우트 + service_role admin 클라이언트(`auth.users` 생성).
- **`get_my_context()` 수정**(필수 버그픽스): `permissions`·`staff_type` 반환.
- **인증 플러밍**: `MyContext.staffType`, 비활성 계정 로그인 차단, `/accounts` 페이지 권한 게이트.
- reactquery 훅(`accounts/`, `staffRoles/`), 폼 스키마, 테스트, 검증 SQL.

**Out of scope (후속 단계)**
- **`/setup` 5탭** → **P2b**. (module-permission RLS를 `setup_config`에 처음 부착하는 것도 P2b.)
- **세입자 계정 생성** → **P3**(입주자 상세 `tenant-detail`에서 세대 연결 필수). P2a는 세입자 **조회·발급/비활성만**(현재 0건, 읽기전용 노출).
- **건물↔담당자 FK 연결** → **P3**. `buildings.manager_name`/`meter_staff_name`/`cleaning_staff_name`는 free-text 유지. P2a의 `staff_roles`는 계정 태깅용.
- **기존 P1a 도메인 테이블(buildings/units/fee_items 등) 모듈 게이팅 소급** → 이후 단계에서 테이블별 적용. P2a는 헬퍼만 확립, 기존 테이블은 org 격리 유지.
- **카카오 OAuth**(세입자·모바일 트랙), support_staff의 시스템 접근 범위(PRD §C.1 미확정 — P2a는 로그인 계정 발급까지만).

---

## 2. 확정된 결정

| # | 결정 | 값 | 근거 |
|---|---|---|---|
| 1 | P2a 범위 | `/accounts` + 권한 기반만. `/setup`은 P2b | 사용자 확정 |
| 2 | 계정 생성 방식 | **Next.js 서버 라우트 + service_role** | `.env.example`에 `SUPABASE_SERVICE_ROLE_KEY` 준비됨. 단일 배포·테스트 용이 |
| 3 | RLS 강도 | **기반 + 마스터 게이트만** — `current_user_has_module()` 헬퍼 확립 + `org_members` 권한/역할 변경 마스터 DB강제. 도메인 테이블 소급 X | 사용자 확정, 회귀 위험 최소화 |
| 4 | 관리자/직원/마스터 모델링 | **관리자 = 마스터 직원(`role=org_owner`)**, 직원 = 비마스터(`role=staff`), 둘 다 `staff_type=manager_staff`. 별도 `is_master` 컬럼 없이 기존 `role`·`isMaster()` 재사용 | 사용자 확정(PRD 필터탭 vs 폼 모호성 해소) |
| 5 | 권한 저장 형태 | `org_members.feature_permissions jsonb`(문자열 배열, `MODULE_KEYS` 값). 마스터는 무시(전체 통과) | 로드맵 "jsonb 키 목록 정규화" + 기존 `permissions.ts` 11키 |
| 6 | 권한 체크리스트 항목 | 기존 `lib/auth/permissions.ts`의 `MODULE_KEYS`(11개)·`MODULE_LABELS` 그대로 canonical | 이미 §C.3 기반으로 정의됨 |
| 7 | 담당역할 | `staff_roles` 마스터(관리·검침·청소 시드) + `org_member_roles` 다대다 | PRD 폼 "담당역할" 컬럼 |
| 8 | 프로필 편집 안전성 | 직접 UPDATE 잠금 유지, 편집은 **SECURITY DEFINER RPC 경유**(RLS는 컬럼 제한 불가) | P0 주석의 보류 사항 해소 |
| 9 | 비활성 처리 | 삭제 금지 → `profiles.is_active=false`. 로그인/부팅 시 차단 | §E 2026-07-14 결정 |
| 10 | 유형 필터탭 | 전체/관리자/직원/**현장직원**/스태프/입주자 | PRD §3.0은 현장직원 탭 미기재이나 폼(§3.2)이 현장 유형 생성 → 관리 가시성 위해 탭 추가 |

---

## 3. DB 스키마 — `supabase/migrations/0002_p2a_accounts_permissions.sql`

> P0(`org_members`·`profiles`·`get_my_context`·`audit_log`·`set_updated_at`)에 의존.

### 3.1 ENUM

```sql
-- 계정 유형(PRD "유형"). role(보안역할)과 직교:
--   manager_staff = 내근 직원(관리자[master]/직원[비master] 공통, PC 웹)
--   field_staff   = 현장직원(모바일 전용)
--   support_staff = 스태프(청소담당자·관리실 직원 등; 발송 수신처)
--   tenant        = 세입자(카카오, 생성은 P3)
create type staff_type as enum ('manager_staff','field_staff','support_staff','tenant');
```

### 3.2 org_members 확장

```sql
alter table org_members
  add column staff_type          staff_type not null default 'manager_staff',
  add column feature_permissions jsonb      not null default '[]'::jsonb
    check (jsonb_typeof(feature_permissions) = 'array'),
  add column affiliation         text;   -- 스태프 소속(청소팀 등) free-text. P2b에서 cleaning_teams 마스터 링크로 승격
```

- `role`(P0 enum)은 **보안역할**로 유지: `org_owner`/`platform_admin`=마스터, `staff`=일반직원, `field`=현장, `tenant`=세입자.
- "마스터 여부" 체크박스 → `role`을 `org_owner`↔`staff` 토글(§2-#4).
- `affiliation`은 `support_staff` 유형에만 노출(청소팀 등); P2a는 free-text, P2b `cleaning_teams` 마스터 드롭다운으로 대체.

### 3.3 profiles 확장

```sql
alter table profiles add column phone_sub text;   -- 부번호(발송 수신처). 기존 phone=주번호
```

### 3.4 staff_roles (담당역할 마스터 — org 격리, 소프트삭제)

```sql
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
```

시드: 조직 생성 시 관리/검침/청소 3개(시드 스크립트 또는 P2a 마이그레이션에서 기존 org 대상 backfill — 검증 SQL에 스니펫).

### 3.5 org_member_roles (계정 ↔ 담당역할 다대다)

```sql
create table org_member_roles (
  org_id  bigint not null references organizations(id) on delete cascade,
  user_id uuid   not null references auth.users(id)    on delete cascade,
  role_id bigint not null references staff_roles(id)   on delete cascade,
  primary key (org_id, user_id, role_id)
);
create index on org_member_roles (role_id);
```

### 3.6 get_my_context() 재정의 (반환 타입 변경 → drop+create)

```sql
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
```

---

## 4. 권한 RLS·RPC (기반 + 마스터 게이트)

### 4.1 재사용 헬퍼 (향후 테이블 공용 패턴)

```sql
-- 마스터인가? (RPC 가드용)
create or replace function current_user_is_master()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m join organizations o on o.id = m.org_id
    where m.user_id = (select auth.uid()) and o.status = 'active'
      and m.role in ('org_owner','platform_admin'));
$$;

-- 해당 모듈 사용 가능? 마스터거나 feature_permissions에 키 포함.
-- P2b setup_config 등 민감 테이블 RLS에서 `using (current_user_has_module('settings'))` 형태로 재사용.
create or replace function current_user_has_module(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m join organizations o on o.id = m.org_id
    where m.user_id = (select auth.uid()) and o.status = 'active'
      and (m.role in ('org_owner','platform_admin') or m.feature_permissions ? p_key));
$$;
```

### 4.2 계정 관리 RPC

모두 SECURITY DEFINER → 정의자 권한으로 실행되어 RLS 우회(쓰기는 RPC로만). `revoke execute ... from anon`.

- **`admin_set_member_permissions(p_user_id uuid, p_role org_member_role, p_staff_type staff_type, p_permissions jsonb, p_role_ids bigint[])`** — **마스터 전용**.
  - `current_user_is_master()` 아니면 `raise exception 'forbidden'`. 대상이 **동일 org**인지 확인.
  - `org_members.role/staff_type/feature_permissions` 갱신 + `org_member_roles` 재동기화(delete→insert).
  - **최소 1 마스터 유지 가드**: 대상이 본인이고 마스터 해제 시 다른 마스터 없으면 거부.
  - `audit_log` `PERMISSION_CHANGE` 기록.
- **`admin_update_member_basic(p_user_id uuid, p_full_name text, p_phone text, p_phone_sub text, p_staff_type staff_type, p_affiliation text, p_role_ids bigint[])`** — **`accounts` 권한/마스터**.
  - `current_user_has_module('accounts')` 확인, 동일 org 확인.
  - `profiles.full_name/phone/phone_sub`, `org_members.staff_type/affiliation`, `org_member_roles` 갱신. **`role`·`feature_permissions`는 건드리지 않음**(권한 상승 차단).
  - `audit_log` `ACCOUNT_UPDATE`.
- **`admin_set_active(p_user_id uuid, p_active boolean)`** — **`accounts` 권한/마스터**. `profiles.is_active` 토글. `audit_log` `ACCOUNT_DEACTIVATE`/`ACCOUNT_ACTIVATE`. (삭제 없음.)
- **`list_accounts(p_search text default null, p_type staff_type default null)`** — 조회. 호출자 org의 계정 디렉터리(profiles+org_members+담당역할 label 집계) 반환. org 격리는 함수 내부에서 `auth.uid()`의 org로 제한(PostgREST FK 임베딩 불가 구조 → RPC 조인).

### 4.3 신규 테이블 RLS

```sql
alter table staff_roles       enable row level security;
alter table org_member_roles  enable row level security;

-- 담당역할 마스터: 활성 org 구성원 조회/편집(P1a 마스터와 동일 수준; 민감치 않음)
create policy sr_all on staff_roles for all
  using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));

-- 조인: 조회만 개방(쓰기는 4.2 RPC 경유)
create policy omr_select on org_member_roles for select
  using (org_id in (select my_org_ids()));
```

> `profiles`는 P0의 select 정책 유지(동일 org 구성원 조회 가능). UPDATE 정책은 계속 두지 않음 → 편집은 4.2 RPC로만(컬럼 위조 차단).

### 4.4 audit_log 이벤트 확장 (스키마 변경 없음)

`action` 문자열에 `ACCOUNT_CREATE`·`ACCOUNT_UPDATE`·`ACCOUNT_DEACTIVATE`·`ACCOUNT_ACTIVATE`·`PERMISSION_CHANGE` 추가 사용.

---

## 5. 계정 프로비저닝 (Next.js 서버 라우트)

### 5.1 admin 클라이언트 — `lib/supabase/admin.ts`

```ts
import { createClient } from "@supabase/supabase-js";
// 서버 전용. 절대 클라이언트 번들에 포함 금지(NEXT_PUBLIC_ 아님).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

### 5.2 라우트 — `app/api/accounts/route.ts` (POST 생성)

플로우:
1. **인증**: `lib/supabase/server.ts`(쿠키) → `auth.getUser()`. 없으면 `401`.
2. **인가**: 쿠키 클라이언트로 `get_my_context()` → `orgId`·`role`. `accounts` 권한/마스터 아니면 `403`. **역할·권한 지정은 마스터만** — 비마스터 호출자는 생성 계정을 `role=staff`·`feature_permissions=[]`로 강제(입력 무시).
3. **검증**: zod(`account.ts`). org 내 `username` 중복 확인(email 유일성으로 최종 방어).
4. **auth 사용자 생성**: `admin.createUser({ email: loginEmail(회사코드, username), password, email_confirm: true })`. 회사코드 = 호출자 org의 `organizations.slug`(admin으로 조회). **전제**: `slug`가 null이면 `409`(로그인 불가 상태 — org 셋업 필요) 반환.
5. **행 삽입**(admin, RLS 우회): `profiles`(username·full_name·phone·phone_sub·`must_change_password=true`) + `org_members`(org_id·user_id·role·staff_type·feature_permissions·affiliation) + `org_member_roles`. 실패 시 생성한 auth user를 `admin.deleteUser`로 롤백(고아 방지).
6. `audit_log` `ACCOUNT_CREATE`. 요약 반환(`201`).

### 5.3 라우트 — `app/api/accounts/[userId]/route.ts` (PATCH 비번 재설정)

- 인증+`accounts`권한/마스터, 대상 동일 org 확인.
- `admin.updateUserById(userId, { password })` + `profiles.must_change_password=true`(admin). `audit_log`.

> 기본정보·유형·담당역할·활성·권한 변경은 5.x 라우트가 아니라 **4.2 RPC**(브라우저에서 직접 호출). 라우트는 `auth.users`를 만져야 하는 **생성·비번**만 담당.

---

## 6. 데이터 계층 (reactquery)

P0/P1a 컨벤션(`apis/keys/queries/mutations/index` + 테스트). snake↔camel 매핑은 `apis.ts`.

### 6.1 `hooks/reactquery/accounts/`

| 함수 | 구현 | 게이트 |
|---|---|---|
| `listAccounts({search?, type?})` | `rpc('list_accounts', …)` | 조회 |
| `createAccount(input)` | `fetch POST /api/accounts` | 서버측 인가 |
| `updateAccountBasic(userId, input)` | `rpc('admin_update_member_basic', …)` | accounts |
| `updatePermissions(userId, {role, staffType, permissions, roleIds})` | `rpc('admin_set_member_permissions', …)` | 마스터 |
| `setActive(userId, active)` | `rpc('admin_set_active', …)` | accounts |
| `resetPassword(userId, password)` | `fetch PATCH /api/accounts/[userId]` | accounts |

훅: `useAccounts(filter)`, `useCreateAccount`, `useUpdateAccountBasic`, `useUpdatePermissions`, `useSetActive`, `useResetPassword`. 성공 시 `accountKeys.all` 무효화.

타입: `Account`(userId·username·fullName·phone·phoneSub·role·staffType·affiliation·isActive·permissions·roleLabels), `AccountCreateInput`, `AccountBasicInput`, `PermissionInput`. `list_accounts`도 `affiliation` 반환.

### 6.2 `hooks/reactquery/staffRoles/`

`useStaffRoles`, `useCreateStaffRole`, `useRenameStaffRole`, `useDeleteStaffRole`(소프트), `useReorderStaffRoles` — RLS 직결(`staff_roles`).

---

## 7. 페이지 — `app/(staff)/staff/accounts/`

### 7.1 page.tsx (`"use client"`)
- **게이트**: `useMe()` → `canManageAccounts(ctx)` 아니면 접근 불가 안내(현장직원·미권한 직원 차단).
- 상단: 유형 탭(전체/관리자/직원/현장직원/스태프/입주자) + 검색(이름·아이디·연락처) + `+ 계정 등록`.
- 본문: `AccountTable`. 하단: `AccountFormModal`.

### 7.2 components/
- **`AccountTable`**: 컬럼 이름/유형/아이디/연락처(주·부)/권한등급(마스터·일반)/담당역할/상태(활성·비활성 토글). 행 클릭 → 수정.
- **`AccountFormModal`**: 등록/수정 모드 분기(한 모달). 공통: 이름·연락처(주·부)·유형. 유형별:
  - `manager_staff`: 아이디/비밀번호(등록 시)/**마스터 여부**/담당역할/**PermissionChecklist**.
  - `field_staff`: 아이디/비밀번호/모바일 전용 안내.
  - `support_staff`: 아이디/비밀번호/담당역할/소속(청소팀 등, 텍스트).
  - `tenant`: **읽기전용** — 조회·비활성·비번재설정만, "신규 생성은 입주자 상세에서" 안내(등록 폼에서 유형 선택지 비활성).
- **`PermissionChecklist`**: `MODULE_KEYS`×`MODULE_LABELS` 체크박스. **`isMaster(me)`일 때만 편집**, 아니면 읽기전용(disabled). 마스터 여부 체크 시 전체 통과 안내로 비활성.
- **`StaffRoleSelect`**: `staff_roles` 다중선택.
- 저장: 신규=`useCreateAccount`; 수정=`useUpdateAccountBasic`(+마스터면 `useUpdatePermissions` 분리 호출); 상태=`useSetActive`; 비번=`useResetPassword`. 성공 토스트(sonner), 실패 친화 메시지.

### 7.3 navItems.ts
`계정·직원 관리`(`/staff/accounts`, module `accounts`) → `built: true`.

---

## 8. 인증 플러밍

- **`hooks/reactquery/auth/apis.ts`**: `MyContext`에 `staffType` 추가, `getMyContext`에서 `row.staff_type → staffType` 매핑. `permissions`는 이제 RPC가 실제 반환(§3.6).
- **비활성 차단**: 컨텍스트 로드 후 `!isActive`면 로그아웃+로그인 리다이렉트(메시지). `AppShell` 또는 부팅 가드에 추가(로그인 직후·복귀 세션 모두 커버). `login()` 성공 후에도 컨텍스트 확인.
- **페이지 게이트**: `/accounts`는 `canManageAccounts`(기존 `lib/auth/permissions.ts`) 사용.

---

## 9. 에러 처리 & UX
- 라우트: `401/403/409(중복)/422(검증)` + 한국어 메시지 JSON. 훅에서 친화 토스트로 변환.
- 비번 정책: 등록 시 마스터가 초기 비번 입력, `must_change_password=true`(최초 로그인 변경 유도 — 변경 UI는 후속).
- 삭제 없음(비활성만) — UI에서 "삭제" 대신 "비활성" 명시.
- 마스터 자기강등/최소1마스터 위반 → RPC 예외를 폼에서 사전 경고 + 실패 메시지.

## 10. 환경 / 마이그레이션 적용
- **신규 env**: `SUPABASE_SERVICE_ROLE_KEY`(서버 전용) — 로컬 `.env.local`에 채워야 함(`.env.example`에 이미 문서화). `NEXT_PUBLIC_STAFF_EMAIL_DOMAIN`은 기존.
- 적용(사용자): `supabase/migrations/0002_p2a_accounts_permissions.sql` 실행 → `supabase/verify/p2a_checks.sql`로 정책·RPC·시드 검증.

## 11. 테스트 전략 (TDD)
- **RLS·RPC(SQL 검증, `supabase/verify/p2a_checks.sql`)**:
  - 비마스터가 `admin_set_member_permissions` 호출 → 예외.
  - `current_user_has_module`/`current_user_is_master` 반환값(마스터·권한보유·미보유).
  - `get_my_context`가 `permissions`·`staff_type` 반환.
  - `list_accounts`·`staff_roles`·`org_member_roles` **타 org 격리**.
  - 최소 1 마스터 유지 가드.
- **단위(Vitest)**: `account.ts` zod(등록 vs 수정, 유형별 필수), `accounts/apis.ts` 매퍼·RPC/fetch 모킹, 라우트 인가 분기(미인증/비마스터/마스터), `staffRoles` 훅.
- **컴포넌트(RTL)**: `PermissionChecklist` 마스터만 편집, 폼 유형 분기, 세입자 읽기전용, 상태 토글.
- **E2E(라이브 Supabase 후, pending-user)**: 마스터가 직원 생성→권한 부여→일반직원 로그인 시 GNB 게이팅 반영→비활성 후 로그인 차단.

## 12. 열린 항목 / 향후
- support_staff의 PC/모바일 **접근 범위** 확정(PRD §C.1 미정) — P2a는 로그인 계정 발급까지.
- 세입자 계정 **생성**·카카오 연동 → P3/모바일.
- 건물↔담당자 **FK 연결**(현재 free-text) → P3.
- 도메인 테이블 **모듈 게이팅 소급** → 이후 단계(헬퍼는 P2a에서 확립).
- **비밀번호 변경 UI**(`must_change_password` 소비) → 후속.
- `setup_config` 등 민감 테이블에 `current_user_has_module()` RLS **최초 부착** → P2b.

## 부록. PRD 필드 → P2a 배치
- staff-management.md §3.2 유형별 항목 → §3.1 enum + §7.2 폼 분기.
- §3.3 기능별 권한 체크리스트 → `feature_permissions` jsonb + `PermissionChecklist`(MODULE_KEYS).
- §5 "담당자 참조/수신처 참조" → `staff_roles`/`org_member_roles` + `phone_sub`(발송 모듈은 P4에서 소비).
- 세입자 양방향 연동(§3.2) → P3에서 입주자 상세와 연결(P2a는 읽기전용 훅만).

# 주택관리 ERP — P0 인증·세션·조직 기반 설계 (spec)

- **작성일:** 2026-08-07
- **스택:** Next.js(App Router) + Supabase(PostgreSQL·Auth) + React Query + TailwindCSS + shadcn/ui
- **스캐폴딩 기준:** `generate-frontend-projects` 스킬 (route handler 없음, 타입은 `hooks/reactquery/[도메인]/apis.ts`, Supabase 직접 호출)
- **레거시:** PowerBuilder 10.5 + MySQL 5.0 (역설계 결과 기반)
- **관련 문서:** `06_ERP_전체기능명세서.md`, `05_기술전략_브리핑.md`, `07_의사결정_옵션비교.md`, `04b/04c 스키마추가.sql`, `09_신규스키마_ERD.mermaid`

---

## 0. 배경 & 이 문서의 위치

레거시 주택관리 ERP(관리비서)를 **React + Supabase**로 현대화한다. 프로토타입(`*.dc.html`, Amplify staging)의 **staff 화면 전부**를 기획·구현하며, 규모가 커서 **단계(하위 프로젝트)로 분할**한다. 각 단계는 `스펙 → 구현 계획 → 구현`을 반복한다.

| 단계 | 내용 | 화면 |
|---|---|---|
| **P0 (본 문서)** | **인증·세션·조직 기반** | `login`, 라우트 가드 |
| P1 | 기초정보·설정 | building-list, fee-item, vendor-management, management-fee-setting, staff-management, setup |
| P2 | 검침 | utility-electric/water/gas/lookup |
| P3 | 부과·수납·미납 | bill-publish, receipt-management, overdue-management |
| P4 | 이사정산 | moving-settlement/status/elec/water/gas |
| P5 | 부가 | messaging, long-term-repair |

P0는 로그인 페이지의 백엔드/DB이자 **모든 후속 화면의 전제**(세션·조직·역할·RLS·감사)다.

---

## 1. 목표 & 범위 (P0)

**In scope**
- 직원(staff) **아이디 로그인** → Supabase Auth 세션 발급
- 로그인 후 **조직(org)·역할(role)·조직상태(active)** 해석
- **자동 로그인**(세션 지속/비지속)
- 미인증 접근 **라우트 가드**(미들웨어) → 로그인으로 리다이렉트
- **감사로그 LOGIN** 기록
- 위를 뒷받침하는 **DB 슬라이스**(organizations, profiles, org_members, audit_log) + **RLS**
- 스킬 컨벤션에 따른 **프로젝트 스캐폴딩**(Supabase 클라이언트, QueryProvider, `hooks/reactquery/auth`, 로그인 폼)

**Out of scope (후속 단계)**
- 계정 발급 UI(초대·권한 부여/회수) → P1 `staff-management`(SYS-03). *단, P0에서 시드 계정 1개 수동 생성.*
- 세입자/현장/최종관리자 인증(휴대폰 인증·매직링크·SaaS 콘솔)
- 레거시 `apt_user` 대량 이관 → 별도 마이그레이션 프로젝트 (P0는 스키마로 **수용 가능**하게만)
- 개인정보 컬럼암호화(Vault)·PITR 백업 등 비기능요구 → 별도

---

## 2. 확정된 결정

| # | 결정 | 값 | 근거 |
|---|---|---|---|
| 1 | 로그인 식별자 | **아이디 + 합성 이메일 매핑** | 프로토타입/레거시(apt_user.id) 습관 유지 + Supabase Auth·RLS·감사 그대로 |
| 2 | 인가 판정 | **`org_members` 테이블** | JWT `raw_user_meta_data`는 변조 가능 → 신뢰 금지 (Supabase 공식 경고) |
| 3 | 멀티테넌시 | 단일 DB + `org_id` + **RLS** | 의사결정표 1번 권장안 |
| 4 | 아이디 유일성 | **전역 유일** | 프로토타입에 회사 선택 없음. 확장 시 서브도메인으로 org 구분 |
| 5 | 합성 이메일 도메인 | env `NEXT_PUBLIC_STAFF_EMAIL_DOMAIN` (기본 `staff.gwanribiseo.app`) | 실제 수신 불필요(관리자 발급). Supabase 이메일 확인 비활성 |
| 6 | 자동 로그인 | 체크=세션 지속 / 해제=브라우저 종료 시 만료 | 프로토타입 UX |
| 7 | 로그인 후 홈 | `/staff/receipt-management` | 프로토타입 리다이렉트 (추후 대시보드로 변경 가능) |
| 8 | 감사로그 | 트리거 + 앱로그 병행, `audit_log` append-only, LOGIN 기록 | 의사결정표 9번 권장안 |
| 9 | Supabase 연결 | **`.env`에 URL+anon key**, SDK 통신 (MCP 미사용) | 사용자 지정. SQL은 대시보드에서 수동 적용 |

---

## 3. 아키텍처

```
[브라우저: 로그인 폼]
   │ 아이디 hong + 비번
   ▼
클라이언트: email = `${username}@${STAFF_EMAIL_DOMAIN}`
   │ supabase.auth.signInWithPassword({ email, password })
   ▼
[Supabase Auth]  ──성공──▶ 세션(JWT + refresh) 발급/저장
   │
   ▼
클라이언트: rpc get_my_context()  (SECURITY DEFINER)
   │  → { org_id, role, org_status, username, full_name, must_change_password }
   ├─ org 없음 → "권한 없음"
   ├─ org_status ≠ active → "정지된 조직"
   └─ 정상 → rpc record_login() → audit_log(LOGIN)
   ▼
/staff/receipt-management 로 이동

[이후 모든 /staff/* 요청]
   └─ middleware.ts: 세션 확인 → 없으면 /staff/login 리다이렉트
   └─ 데이터 접근: RLS가 org_id 기준으로 강제
```

**핵심 원칙**
- 로그인 자격증명 검증은 **Supabase Auth**가 담당(비번 해시·레이트리밋·세션 관리 위임).
- 인가·조직 판정은 **DB(`org_members`)** 기준. RLS로 서버측 강제.
- 아이디→이메일은 **순수 함수**(클라이언트에서 조합) → 별도 서버 라우트 불필요 → 스킬 원칙 부합, 아이디 열거 불가.

---

## 4. DB 스키마 (P0 마이그레이션)

> v0.1 기준 스키마(`supabase_schema_draft.sql`) 파일이 인계 폴더에 없어, 인증 슬라이스는 **P0에서 직접 생성**한다. 후속 단계(P1~)가 이 위에 `buildings/units/...`를 쌓는다.
> 파일: `supabase/migrations/0000_p0_auth_foundation.sql` (예정)

### 4.1 ENUM & 공통 함수

```sql
create type org_status       as enum ('active','suspended','trial');
create type org_member_role  as enum ('platform_admin','org_owner','manager','staff','field','tenant');

create or replace function set_updated_at() returns trigger
  language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
```

### 4.2 organizations (관리회사/테넌트)

```sql
create table organizations (
  id         bigint generated always as identity primary key,
  name       text        not null,
  slug       text        unique,                 -- 향후 서브도메인 매핑용
  status     org_status  not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_org_updated before update on organizations
  for each row execute function set_updated_at();
```

### 4.3 profiles (auth.users 1:1 — 아이디 로그인·표시·발급)

```sql
create table profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  username             text not null unique,      -- 로그인 아이디 (전역 유일). 레거시 apt_user.id 수용
  full_name            text not null,
  phone                text,
  is_active            boolean not null default true,
  must_change_password boolean not null default false,  -- 레거시 이관/발급 시 최초변경 강제
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
```

### 4.4 org_members (소속·역할 — 인가 기준)

```sql
create table org_members (
  org_id     bigint          not null references organizations(id) on delete cascade,
  user_id    uuid            not null references auth.users(id) on delete cascade,
  role       org_member_role not null default 'staff',
  created_at timestamptz     not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on org_members (user_id);
```

### 4.5 audit_log (감사 — append-only)

```sql
create table audit_log (
  id         bigint generated always as identity primary key,
  org_id     bigint,
  actor_id   uuid,               -- auth.uid()
  action     text not null,      -- 'LOGIN' / INSERT / UPDATE / DELETE ...
  table_name text,
  row_pk     text,
  before     jsonb,
  after      jsonb,
  ip         inet,
  created_at timestamptz not null default now()
);
create index audit_log_org_time_idx on audit_log (org_id, created_at);
```

### 4.6 로그인 지원 RPC (SECURITY DEFINER)

RLS 재귀·정지조직 판별을 깔끔히 하려고, 로그인 직후 컨텍스트 조회와 감사기록은 정의자 권한 함수로 처리한다.

```sql
-- 현재 사용자의 조직/역할/상태/프로필. 정지 조직도 상태를 돌려줘 UX 분기 가능.
create or replace function get_my_context()
returns table (org_id bigint, role org_member_role, org_status org_status,
               username text, full_name text, is_active boolean, must_change_password boolean)
language sql stable security definer set search_path = public as $$
  select m.org_id, m.role, o.status, p.username, p.full_name, p.is_active, p.must_change_password
  from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid()
  order by (o.status = 'active') desc      -- 활성 조직 우선
  limit 1
$$;

-- 로그인 감사 기록
create or replace function record_login(p_ip text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  select m.org_id into v_org from org_members m
    join organizations o on o.id = m.org_id
    where m.user_id = auth.uid()
    order by (o.status = 'active') desc, m.created_at limit 1;
  insert into audit_log(org_id, actor_id, action, ip)
  values (v_org, auth.uid(), 'LOGIN', nullif(p_ip,'')::inet);
end $$;
```

---

## 5. 인증 플로우

### 5.1 로그인
1. 폼 검증(zod): 아이디·비밀번호 비어있지 않음.
2. `email = ${username}@${NEXT_PUBLIC_STAFF_EMAIL_DOMAIN}`.
3. `supabase.auth.signInWithPassword({ email, password })`.
   - 실패 → **일반 메시지** "아이디 또는 비밀번호가 올바르지 않습니다." (열거 방지)
4. `get_my_context()` 호출:
   - 결과 없음 → "접근 권한이 없는 계정입니다." 후 `signOut()`.
   - `is_active = false` → "비활성화된 계정입니다. 관리자에게 문의해 주세요." 후 `signOut()`.
   - `org_status ≠ 'active'` → "정지되었거나 사용할 수 없는 조직입니다." 후 `signOut()`.
   - `must_change_password = true` → 비밀번호 변경 화면으로(후속). *P0에서는 배너/토스트 안내까지.*
5. `record_login()` 호출(감사).
6. 자동 로그인 설정 반영(§5.3) 후 `/staff/receipt-management`로 이동.

### 5.2 로그아웃
- `supabase.auth.signOut()` → React Query 캐시 무효화 → `/staff/login`.

### 5.3 세션 / 자동 로그인
- Supabase `createBrowserClient`는 기본적으로 세션을 `localStorage`에 **지속**.
- **자동 로그인 해제 시**: `sessionStorage`에 "탭 생존" 마커를 두고, 앱 초기화 시 마커가 없고(=새 브라우저 세션) 사용자가 비지속을 택했으면 `signOut()` 처리. (브라우저 종료 시 로그아웃 효과)
- 프로토타입의 `localStorage['erp_login_auto']`(아이디 기억)는 **아이디 프리필 UX**로만 유지(자격증명 저장 아님).

### 5.4 라우트 가드
- `middleware.ts` + `lib/supabase/server.ts`(SSR)로 매 요청 세션 확인.
- 미인증 + 경로가 `/staff/*` (단 `/staff/login` 제외) → `/staff/login`으로 리다이렉트.
- 인증됨 + `/staff/login` 접근 → `/staff/receipt-management`로.
- 조직 정지(`suspended`) 사용자는 로그인 자체를 §5.1-4에서 차단.

---

## 6. RLS 정책 (P0 테이블)

```sql
alter table organizations enable row level security;
alter table profiles      enable row level security;
alter table org_members   enable row level security;
alter table audit_log     enable row level security;

-- 내 활성 조직 id 집합 (정의자 권한 → org_members 재귀 회피)
create or replace function my_org_ids() returns setof bigint
  language sql stable security definer set search_path = public as $$
  select m.org_id from org_members m
  join organizations o on o.id = m.org_id
  where m.user_id = (select auth.uid()) and o.status = 'active'
$$;

-- organizations: 내 활성 조직만 조회
create policy org_select on organizations for select
  using (id in (select my_org_ids()));

-- org_members: 내 조직의 멤버 행 조회
create policy member_select on org_members for select
  using (org_id in (select my_org_ids()));

-- profiles: 본인 또는 같은 조직 구성원
create policy profile_select on profiles for select
  using (
    user_id = (select auth.uid())
    or user_id in (select m.user_id from org_members m where m.org_id in (select my_org_ids()))
  );
create policy profile_update_self on profiles for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- audit_log: 내 조직 기록 조회만. INSERT는 record_login()(정의자)로만, UPDATE/DELETE 정책 없음 → append-only
create policy audit_select on audit_log for select
  using (org_id in (select my_org_ids()));
```

- `service_role` 키는 RLS 우회 → **서버 전용**(관리자 발급 스크립트). 클라이언트는 anon key만.
- 성능: `org_members(user_id)` 인덱스 존재, 정책 내 `auth.uid()`는 `(select auth.uid())`로 감싸 캐시.

---

## 7. 프론트엔드 구조 (스킬 컨벤션)

```
home_erp/
├── app/
│   ├── layout.tsx                      # QueryProvider + Toaster + ThemeProvider
│   ├── (staff)/
│   │   ├── layout.tsx                  # staff 공통(세션 컨텍스트)
│   │   └── staff/
│   │       ├── login/
│   │       │   ├── page.tsx
│   │       │   └── components/LoginForm.tsx
│   │       └── receipt-management/     # (P3에서 구현; P0는 가드 도착지로만)
│   │           └── page.tsx            # 임시 플레이스홀더
│   └── page.tsx                        # / → /staff/login 리다이렉트
├── components/forms/schema/auth.ts     # zod (username+password+autoLogin)
├── hooks/
│   ├── reactquery/auth/{apis,keys,queries,mutations,index}.ts
│   └── common/{useToast,useLocalStorage,...}.ts
├── lib/
│   ├── supabase/{client,server}.ts
│   ├── providers/QueryProvider.tsx
│   └── axios/client.ts                 # (후속 외부 API용, P0 미사용 가능)
├── middleware.ts                       # 세션 가드
└── .env.local
```

### 7.1 훅 계약 (`hooks/reactquery/auth/apis.ts`)

```ts
export type OrgMemberRole =
  | 'platform_admin' | 'org_owner' | 'manager' | 'staff' | 'field' | 'tenant';

export interface LoginInput { username: string; password: string; autoLogin: boolean }

export interface MyContext {
  orgId: number;
  role: OrgMemberRole;
  orgStatus: 'active' | 'suspended' | 'trial';
  username: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
}

export async function login(input: LoginInput): Promise<void>;     // email 조합 → signInWithPassword → 세션지속 분기
export async function logout(): Promise<void>;                     // signOut
export async function getMyContext(): Promise<MyContext | null>;   // rpc get_my_context
export async function recordLogin(ip?: string): Promise<void>;     // rpc record_login
```

- `keys.ts`: `authKeys = { me: () => ['auth','me'] as const }`
- `queries.ts`: `useMe()` → `getMyContext()`
- `mutations.ts`: `useLogin()`(성공 시 컨텍스트 검증·감사·리다이렉트), `useLogout()`
- `index.ts`: 전체 re-export

### 7.2 폼 스키마 (`components/forms/schema/auth.ts`)

```ts
import { z } from "zod";
export const loginSchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
  autoLogin: z.boolean().default(false),
});
export type LoginFormValues = z.infer<typeof loginSchema>;
```

> 스킬 기본 `auth.ts`는 email 기반이나, 본 프로젝트는 **username 기반**으로 대체한다.

### 7.3 LoginForm
- React Hook Form + zodResolver + `useLogin`.
- 프로토타입 UI 재현: 아이디/비번(눈모양 토글)/자동로그인 체크/에러 배너(`lgErr`)/로그인 버튼 로딩상태.
- 에러는 `errors.field.message` + 서버 에러 배너, `isPending` 동안 버튼 비활성화.

---

## 8. 에러 처리 & UX
- 자격증명 실패: 일반 메시지(열거 방지).
- 권한 없음 / 정지 조직: 명확한 개별 메시지 + 강제 `signOut`.
- 네트워크/서버 오류: 사용자 친화 토스트("잠시 후 다시 시도해 주세요"). `throw`/`console.error` 노출 지양(스킬 원칙).
- `must_change_password`: 안내 후 변경 유도(변경 화면은 후속, P0는 배너).

---

## 9. 레거시 apt_user 수용 & 계정 발급
- 매핑: `username ← apt_user.id`, `full_name ← name`, `phone ← tel`.
- 레거시 `pw`(평문 varchar(10))는 그대로 이관 불가 → **임시 비밀번호 발급 + `must_change_password=true`**로 최초 로그인 시 변경 강제.
- 아이디가 회사별로만 유일했던 레거시 특성상, **전역 유일화** 과정에서 충돌 시 회사코드 접두 등으로 정규화(마이그레이션 프로젝트에서 처리).
- **계정 발급(P0 범위 밖, 시드용 수동 절차):** Supabase Admin API(service_role)로 `email = ${username}@${DOMAIN}` 사용자 생성(`email_confirm: true`) → `profiles`·`org_members` 삽입. P1 `staff-management`에서 UI화.

---

## 10. 환경변수 (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=            # 새 ERP 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # anon public key
NEXT_PUBLIC_STAFF_EMAIL_DOMAIN=staff.gwanribiseo.app
# service_role key는 서버 전용 발급 스크립트에서만 사용 (클라이언트 노출 금지)
```

Supabase 대시보드 설정: **이메일 확인(Confirm email) 비활성화**(관리자 발급 모델), 자체 회원가입 비활성화.

---

## 11. 테스트 전략
- **단위:** 아이디→이메일 조합 함수, zod 스키마, `useLogin` 성공/실패 분기(Supabase 모킹).
- **RLS(SQL):** 타 조직 사용자가 `organizations/org_members/profiles/audit_log` 접근 불가, 정지 조직 사용자 차단, `audit_log` UPDATE/DELETE 거부.
- **통합/E2E:** 시드 계정으로 로그인 성공→리다이렉트, 실패 메시지, 미인증 `/staff/*` 접근 시 리다이렉트, 자동로그인 on/off 세션 동작.
- 구현 시 **TDD**(실패 테스트 → 구현 → 통과) 적용.

---

## 12. 열린 항목 / 향후
- 비밀번호 변경 화면(`must_change_password`) — P1과 함께.
- 조직 정지 시 **read-only** 전환(부분 접근) — 현재는 로그인 차단으로 단순화.
- SSO(직원) — 명세서 SYS-04 언급, 현재 미도입.
- `subscriptions`(좌석/요금 read-only 전환) — SaaS 콘솔 단계.

---

## 부록 A. staff 화면 인벤토리 (22)
`login`, `index`(홈) · `building-list`, `fee-item`, `vendor-management`, `management-fee-setting`, `staff-management`, `setup` · `utility-electric/water/gas/lookup` · `bill-publish`, `receipt-management`, `overdue-management` · `moving-settlement/status/elec/water/gas` · `messaging`, `long-term-repair`

## 부록 B. 참고 — 레거시 apt_user
`cust`(회사코드, PK) · `id`(아이디, PK) · `pw`(평문) · `name` · `tel` · `pw1/pw2`(보조) · `id1`. 로그인이 (회사코드+아이디)로 유일 → 신규는 전역 유일 아이디로 정규화.

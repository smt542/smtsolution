# P0 인증·세션·조직 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 빈 `home_erp` 저장소에 Next.js+Supabase 프로젝트를 스캐폴딩하고, 직원 아이디 로그인·세션·조직/역할 해석·라우트 가드·감사(LOGIN)를 동작하는 코드로 구현한다.

**Architecture:** 아이디를 클라이언트에서 합성 이메일(`{username}@{STAFF_EMAIL_DOMAIN}`)로 바꿔 Supabase Auth로 로그인한다. 인가는 로그인 후 `org_members`(SECURITY DEFINER RPC `get_my_context`) 조회로 판정하고, 단일 DB + `org_id` + RLS로 서버측 격리한다. 미인증 접근은 `middleware.ts`가 `/staff/login`으로 리다이렉트한다.

**Tech Stack:** Next.js(App Router, TS), `@supabase/ssr`, `@tanstack/react-query`, `react-hook-form`+`zod`, `sonner`, TailwindCSS, shadcn/ui, Vitest + @testing-library/react.

**관련 스펙:** `docs/superpowers/specs/2026-08-07-p0-auth-foundation-design.md`

## Global Constraints

- **route handler(app/api/) 생성 금지** — 모든 API는 Supabase 직접 호출.
- **타입은 각 도메인 `apis.ts`에** 정의 — 별도 models/ 폴더 없음.
- **인가는 `org_members` 기준** — JWT `raw_user_meta_data` 신뢰 금지.
- **아이디는 전역 유일**. 합성 이메일 도메인 = env `NEXT_PUBLIC_STAFF_EMAIL_DOMAIN` (기본 `staff.gwanribiseo.app`).
- **로그인 후 홈** = `/staff/receipt-management`.
- **에러 노출 지양** — 자격증명 실패는 일반 메시지("아이디 또는 비밀번호가 올바르지 않습니다.").
- **`audit_log`는 append-only**. `service_role` 키는 클라이언트 노출 금지.
- **커밋**: 각 Task 종료 시 커밋. 메시지 말미에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `lib/auth/email.ts` | `usernameToEmail()` 순수 함수 |
| `lib/auth/sessionPersistence.ts` | 자동로그인 부트 판정 `shouldSignOutOnBoot()` |
| `components/forms/schema/auth.ts` | zod `loginSchema` |
| `lib/supabase/client.ts` / `server.ts` / `middleware.ts` | Supabase SSR 클라이언트 |
| `supabase/migrations/0000_p0_auth_foundation.sql` | ENUM·테이블·RPC·RLS |
| `supabase/verify/p0_checks.sql` | RLS 검증 스니펫 |
| `hooks/reactquery/auth/{apis,keys,queries,mutations,index}.ts` | 인증 데이터 계층 |
| `lib/providers/QueryProvider.tsx` | React Query Provider |
| `app/layout.tsx` / `app/page.tsx` | 루트 레이아웃 / `/`→`/staff/login` |
| `app/(staff)/layout.tsx` + `components/AuthBoot.tsx` | staff 공통 + 자동로그인 부트 |
| `app/(staff)/staff/login/{page.tsx,components/LoginForm.tsx}` | 로그인 화면 |
| `app/(staff)/staff/receipt-management/page.tsx` | 가드 도착지 플레이스홀더(P3에서 대체) |
| `middleware.ts` | 세션 가드 |
| `scripts/seed-staff.mjs` | 시드 직원 계정 생성(service_role) |

---

## Task 1: 프로젝트 부트스트랩 (Next.js + 의존성)

**Files:** repo 루트 전체 생성 (create-next-app)

**Interfaces:**
- Produces: 동작하는 Next.js 앱, `@/*` alias, Tailwind, 의존성 설치 완료.

- [ ] **Step 1: 임시 디렉터리에 create-next-app 실행** (기존 repo에는 `docs/`·`.omc/`가 있어 in-place 스캐폴딩이 거부되므로 임시 경로 사용)

```bash
npx create-next-app@latest /tmp/home_erp_init \
  --ts --app --tailwind --eslint --no-src-dir \
  --import-alias "@/*" --use-npm --no-turbopack --yes
```
Expected: `Success! Created home_erp_init` 출력.

- [ ] **Step 2: 생성물(dotfile 포함)을 repo 루트로 병합**

```bash
cp -r /tmp/home_erp_init/. .
rm -rf /tmp/home_erp_init README.md
```
Expected: 루트에 `app/`, `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`(또는 v4 `postcss`), `.gitignore` 생성. `docs/`는 유지.

- [ ] **Step 3: 런타임/폼/데이터 의존성 설치**

```bash
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query @tanstack/react-query-devtools react-hook-form @hookform/resolvers zod sonner next-themes
```
Expected: 설치 성공, 종료코드 0.

- [ ] **Step 4: `.gitignore`에 로컬 상태 추가**

`.gitignore` 끝에 다음 줄 추가:
```
.omc/
.env.local
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: `Compiled successfully` (경고 무방, 에러 없음).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(p0): scaffold Next.js app + core deps

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 테스트 도구 (Vitest + RTL)

**Files:**
- Create: `vitest.config.ts`, `test/setup.ts`, `package.json`(스크립트 수정)

**Interfaces:**
- Produces: `npm test` 실행 가능, jsdom 환경, `@/*` alias 해석.

- [ ] **Step 1: 테스트 의존성 설치**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom vite-tsconfig-paths
```

- [ ] **Step 2: `vitest.config.ts` 작성**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
});
```

- [ ] **Step 3: `test/setup.ts` 작성**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: `package.json` scripts에 test 추가**

`"scripts"`에 다음 키 추가:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: 스모크 테스트로 러너 확인**

`test/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => { it("runs", () => { expect(1 + 1).toBe(2); }); });
```
Run: `npm test`
Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(p0): add Vitest + RTL test setup

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 아이디→이메일 순수 함수 (TDD)

**Files:**
- Create: `lib/auth/email.ts`, `lib/auth/email.test.ts`

**Interfaces:**
- Produces: `usernameToEmail(username: string): string`

- [ ] **Step 1: 실패 테스트 작성** — `lib/auth/email.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { usernameToEmail } from "./email";

describe("usernameToEmail", () => {
  beforeEach(() => { process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN = "staff.gwanribiseo.app"; });

  it("아이디를 합성 이메일로 변환", () => {
    expect(usernameToEmail("hong")).toBe("hong@staff.gwanribiseo.app");
  });
  it("공백 트림 + 소문자화", () => {
    expect(usernameToEmail("  Hong ")).toBe("hong@staff.gwanribiseo.app");
  });
  it("빈 아이디는 에러", () => {
    expect(() => usernameToEmail("")).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test lib/auth/email.test.ts`
Expected: FAIL (`usernameToEmail` not exported).

- [ ] **Step 3: 최소 구현** — `lib/auth/email.ts`

```ts
const DEFAULT_DOMAIN = "staff.gwanribiseo.app";

export function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase();
  if (!u) throw new Error("username is required");
  const domain = process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN || DEFAULT_DOMAIN;
  return `${u}@${domain}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test lib/auth/email.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/email.ts lib/auth/email.test.ts
git commit -m "feat(p0): usernameToEmail 합성 이메일 매핑

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 로그인 zod 스키마 (TDD)

**Files:**
- Create: `components/forms/schema/auth.ts`, `components/forms/schema/auth.test.ts`

**Interfaces:**
- Produces: `loginSchema`, `type LoginFormValues = { username: string; password: string; autoLogin: boolean }`

- [ ] **Step 1: 실패 테스트** — `components/forms/schema/auth.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { loginSchema } from "./auth";

describe("loginSchema", () => {
  it("정상 입력 통과", () => {
    const r = loginSchema.safeParse({ username: "hong", password: "pw123456", autoLogin: true });
    expect(r.success).toBe(true);
  });
  it("빈 아이디 실패 메시지", () => {
    const r = loginSchema.safeParse({ username: "", password: "x", autoLogin: false });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("아이디를 입력해 주세요");
  });
  it("autoLogin 기본값 false", () => {
    const r = loginSchema.parse({ username: "a", password: "b" });
    expect(r.autoLogin).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test components/forms/schema/auth.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: 구현** — `components/forms/schema/auth.ts`

```ts
import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
  autoLogin: z.boolean().default(false),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
```

- [ ] **Step 4: 통과 확인**

Run: `npm test components/forms/schema/auth.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add components/forms/schema/auth.ts components/forms/schema/auth.test.ts
git commit -m "feat(p0): 로그인 zod 스키마(username 기반)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 자동로그인 부트 판정 (TDD)

**Files:**
- Create: `lib/auth/sessionPersistence.ts`, `lib/auth/sessionPersistence.test.ts`

**Interfaces:**
- Produces: `shouldSignOutOnBoot(autoLoginPref: boolean, sessionAlive: boolean): boolean`
- 규칙: 자동로그인 미설정(`false`)이고 새 브라우저 세션(`sessionAlive=false`)이면 로그아웃(`true`).

- [ ] **Step 1: 실패 테스트** — `lib/auth/sessionPersistence.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { shouldSignOutOnBoot } from "./sessionPersistence";

describe("shouldSignOutOnBoot", () => {
  it("자동로그인 off + 새 세션 → 로그아웃", () => {
    expect(shouldSignOutOnBoot(false, false)).toBe(true);
  });
  it("자동로그인 off + 기존 탭 세션 → 유지", () => {
    expect(shouldSignOutOnBoot(false, true)).toBe(false);
  });
  it("자동로그인 on → 항상 유지", () => {
    expect(shouldSignOutOnBoot(true, false)).toBe(false);
    expect(shouldSignOutOnBoot(true, true)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test lib/auth/sessionPersistence.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현** — `lib/auth/sessionPersistence.ts`

```ts
export const AUTO_LOGIN_KEY = "erp_login_auto";        // localStorage: '1' | (username 프리필과 별도 플래그)
export const SESSION_ALIVE_KEY = "erp_session_alive";  // sessionStorage marker

export function shouldSignOutOnBoot(autoLoginPref: boolean, sessionAlive: boolean): boolean {
  return !autoLoginPref && !sessionAlive;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test lib/auth/sessionPersistence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/sessionPersistence.ts lib/auth/sessionPersistence.test.ts
git commit -m "feat(p0): 자동로그인 부트 판정 함수

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Supabase 클라이언트 (browser/server/middleware)

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `.env.example`

**Interfaces:**
- Produces: browser `createClient()`, server `createClient()`(async), `updateSession(request)`.

- [ ] **Step 1: `.env.example` 작성**

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_STAFF_EMAIL_DOMAIN=staff.gwanribiseo.app
# 서버 전용(발급 스크립트에서만). 절대 커밋/클라이언트 노출 금지:
SUPABASE_SERVICE_ROLE_KEY=
```
그리고 로컬 `.env.local`을 같은 키로 생성(값은 새 ERP 프로젝트에서 채움).

- [ ] **Step 2: `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: `lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch { /* Server Component에서 set 호출 시 무시 (middleware가 갱신) */ }
        },
      },
    },
  );
}
```

- [ ] **Step 4: `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  return { response, user };
}
```

- [ ] **Step 5: 타입체크 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase .env.example
git commit -m "feat(p0): Supabase SSR 클라이언트(browser/server/middleware)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: DB 마이그레이션 + RLS + 검증 체크리스트

**Files:**
- Create: `supabase/migrations/0000_p0_auth_foundation.sql`, `supabase/verify/p0_checks.sql`

**Interfaces:**
- Produces: 테이블 `organizations/profiles/org_members/audit_log`, RPC `get_my_context()`/`record_login()`, RLS 정책. (프론트 `apis.ts`가 이 RPC/테이블 이름에 의존.)

- [ ] **Step 1: 마이그레이션 SQL 작성** — `supabase/migrations/0000_p0_auth_foundation.sql`

```sql
-- ===== ENUM & 공통 =====
create type org_status      as enum ('active','suspended','trial');
create type org_member_role as enum ('platform_admin','org_owner','manager','staff','field','tenant');

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ===== organizations =====
create table organizations (
  id         bigint generated always as identity primary key,
  name       text not null,
  slug       text unique,
  status     org_status not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_org_updated before update on organizations
  for each row execute function set_updated_at();

-- ===== profiles (auth.users 1:1) =====
create table profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  username             text not null unique,
  full_name            text not null,
  phone                text,
  is_active            boolean not null default true,
  must_change_password boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- ===== org_members =====
create table org_members (
  org_id     bigint not null references organizations(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  role       org_member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on org_members (user_id);

-- ===== audit_log (append-only) =====
create table audit_log (
  id         bigint generated always as identity primary key,
  org_id     bigint,
  actor_id   uuid,
  action     text not null,
  table_name text,
  row_pk     text,
  before     jsonb,
  after      jsonb,
  ip         inet,
  created_at timestamptz not null default now()
);
create index audit_log_org_time_idx on audit_log (org_id, created_at);

-- ===== RPC =====
create or replace function get_my_context()
returns table (org_id bigint, role org_member_role, org_status org_status,
               username text, full_name text, is_active boolean, must_change_password boolean)
language sql stable security definer set search_path = public as $$
  select m.org_id, m.role, o.status, p.username, p.full_name, p.is_active, p.must_change_password
  from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid()
  order by (o.status = 'active') desc
  limit 1
$$;

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

-- ===== RLS =====
alter table organizations enable row level security;
alter table profiles      enable row level security;
alter table org_members   enable row level security;
alter table audit_log     enable row level security;

create or replace function my_org_ids() returns setof bigint
  language sql stable security definer set search_path = public as $$
  select m.org_id from org_members m
  join organizations o on o.id = m.org_id
  where m.user_id = (select auth.uid()) and o.status = 'active'
$$;

create policy org_select    on organizations for select using (id in (select my_org_ids()));
create policy member_select on org_members   for select using (org_id in (select my_org_ids()));
create policy profile_select on profiles for select using (
  user_id = (select auth.uid())
  or user_id in (select m.user_id from org_members m where m.org_id in (select my_org_ids()))
);
create policy profile_update_self on profiles for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy audit_select on audit_log for select using (org_id in (select my_org_ids()));
```

- [ ] **Step 2: 검증 스니펫 작성** — `supabase/verify/p0_checks.sql`

```sql
-- Supabase SQL 에디터에서 실행. 시드(Task 13) 이후 검증.
-- 1) 테이블/정책 존재
select tablename, rowsecurity from pg_tables where schemaname='public'
  and tablename in ('organizations','profiles','org_members','audit_log');
-- 기대: 4행, rowsecurity=true

-- 2) audit_log append-only(정책상 update/delete 불가) — anon/authenticated 롤에서 실패해야 정상
--    (SQL 에디터는 service_role이라 우회됨. 앱 anon 세션으로 확인 권장.)

-- 3) get_my_context 스모크(로그인 사용자 컨텍스트에서)
select * from get_my_context();
-- 기대: 시드 사용자의 org/role/active 1행
```

- [ ] **Step 3: 적용 (사용자 수동)**

Supabase 대시보드 → SQL Editor에 `0000_p0_auth_foundation.sql` 전체 붙여넣고 실행.
Expected: `Success. No rows returned`.
그리고 Authentication → Providers/Settings에서 **Confirm email OFF**, **자체 가입 비활성**.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat(p0): auth 기반 스키마·RPC·RLS 마이그레이션 + 검증 스니펫

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 인증 API 계층 `apis.ts` (TDD, Supabase 모킹)

**Files:**
- Create: `hooks/reactquery/auth/apis.ts`, `hooks/reactquery/auth/apis.test.ts`

**Interfaces:**
- Consumes: `usernameToEmail`(Task 3), Supabase browser `createClient`(Task 6).
- Produces:
  - `type OrgMemberRole`, `type LoginInput`, `type MyContext`
  - `login(input: LoginInput): Promise<void>`
  - `logout(): Promise<void>`
  - `getMyContext(): Promise<MyContext | null>`
  - `recordLogin(ip?: string): Promise<void>`

- [ ] **Step 1: 실패 테스트** — `hooks/reactquery/auth/apis.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const signInWithPassword = vi.fn();
const signOut = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword, signOut }, rpc }),
}));

import { login, getMyContext } from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN = "staff.gwanribiseo.app";
});

describe("login", () => {
  it("아이디를 합성 이메일로 바꿔 signInWithPassword 호출", async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: null });
    await login({ username: "hong", password: "pw", autoLogin: false });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "hong@staff.gwanribiseo.app", password: "pw",
    });
  });
  it("실패 시 일반 메시지로 throw", async () => {
    signInWithPassword.mockResolvedValue({ data: null, error: { message: "Invalid" } });
    await expect(login({ username: "hong", password: "x", autoLogin: false }))
      .rejects.toThrow("아이디 또는 비밀번호가 올바르지 않습니다.");
  });
});

describe("getMyContext", () => {
  it("rpc 결과 첫 행을 카멜케이스로 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      org_id: 1, role: "staff", org_status: "active",
      username: "hong", full_name: "홍길동", is_active: true, must_change_password: false,
    }], error: null });
    const ctx = await getMyContext();
    expect(ctx).toEqual({
      orgId: 1, role: "staff", orgStatus: "active",
      username: "hong", fullName: "홍길동", isActive: true, mustChangePassword: false,
    });
  });
  it("결과 없으면 null", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getMyContext()).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test hooks/reactquery/auth/apis.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: 구현** — `hooks/reactquery/auth/apis.ts`

```ts
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/auth/email";

export type OrgMemberRole =
  | "platform_admin" | "org_owner" | "manager" | "staff" | "field" | "tenant";

export interface LoginInput { username: string; password: string; autoLogin: boolean }

export interface MyContext {
  orgId: number;
  role: OrgMemberRole;
  orgStatus: "active" | "suspended" | "trial";
  username: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
}

const INVALID_CREDS = "아이디 또는 비밀번호가 올바르지 않습니다.";

export async function login(input: LoginInput): Promise<void> {
  const supabase = createClient();
  const email = usernameToEmail(input.username);
  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error) throw new Error(INVALID_CREDS);
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function getMyContext(): Promise<MyContext | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_context");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    orgId: row.org_id,
    role: row.role,
    orgStatus: row.org_status,
    username: row.username,
    fullName: row.full_name,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
  };
}

export async function recordLogin(ip?: string): Promise<void> {
  const supabase = createClient();
  await supabase.rpc("record_login", { p_ip: ip ?? null });
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test hooks/reactquery/auth/apis.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add hooks/reactquery/auth/apis.ts hooks/reactquery/auth/apis.test.ts
git commit -m "feat(p0): auth API 계층(login/logout/getMyContext/recordLogin)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: React Query 훅 (keys/queries/mutations, TDD)

**Files:**
- Create: `hooks/reactquery/auth/keys.ts`, `queries.ts`, `mutations.ts`, `index.ts`, `mutations.test.tsx`

**Interfaces:**
- Consumes: `apis.ts`(Task 8).
- Produces: `authKeys`, `useMe()`, `useLogin()`, `useLogout()`.
- `useLogin().mutateAsync(input)`: login → getMyContext 검증(권한/활성/조직상태) → recordLogin → 성공. 검증 실패 시 signOut + throw(메시지).

- [ ] **Step 1: 실패 테스트** — `hooks/reactquery/auth/mutations.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const api = {
  login: vi.fn(), logout: vi.fn(), getMyContext: vi.fn(), recordLogin: vi.fn(),
};
vi.mock("./apis", () => api);
const signOut = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

import { useLogin } from "./mutations";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe("useLogin", () => {
  it("성공: 활성 조직 컨텍스트면 recordLogin 호출", async () => {
    api.login.mockResolvedValue(undefined);
    api.getMyContext.mockResolvedValue({ orgId: 1, role: "staff", orgStatus: "active", username: "hong", fullName: "홍", isActive: true, mustChangePassword: false });
    api.recordLogin.mockResolvedValue(undefined);
    const { result } = renderHook(() => useLogin(), { wrapper });
    await result.current.mutateAsync({ username: "hong", password: "pw", autoLogin: false });
    expect(api.recordLogin).toHaveBeenCalled();
  });

  it("컨텍스트 없음: 권한 없음 에러 + signOut", async () => {
    api.login.mockResolvedValue(undefined);
    api.getMyContext.mockResolvedValue(null);
    const { result } = renderHook(() => useLogin(), { wrapper });
    await expect(result.current.mutateAsync({ username: "x", password: "y", autoLogin: false }))
      .rejects.toThrow("접근 권한이 없는 계정입니다.");
    expect(signOut).toHaveBeenCalled();
  });

  it("정지 조직: 차단 + signOut", async () => {
    api.login.mockResolvedValue(undefined);
    api.getMyContext.mockResolvedValue({ orgId: 1, role: "staff", orgStatus: "suspended", username: "h", fullName: "홍", isActive: true, mustChangePassword: false });
    const { result } = renderHook(() => useLogin(), { wrapper });
    await expect(result.current.mutateAsync({ username: "x", password: "y", autoLogin: false }))
      .rejects.toThrow("정지되었거나 사용할 수 없는 조직입니다.");
    expect(signOut).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test hooks/reactquery/auth/mutations.test.tsx`
Expected: FAIL.

- [ ] **Step 3: 구현**

`hooks/reactquery/auth/keys.ts`:
```ts
export const authKeys = { me: () => ["auth", "me"] as const };
```

`hooks/reactquery/auth/queries.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { getMyContext } from "./apis";
import { authKeys } from "./keys";

export function useMe() {
  return useQuery({ queryKey: authKeys.me(), queryFn: getMyContext, staleTime: 60_000 });
}
```

`hooks/reactquery/auth/mutations.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { login, logout, getMyContext, recordLogin, type LoginInput } from "./apis";
import { authKeys } from "./keys";

const NO_ACCESS = "접근 권한이 없는 계정입니다.";
const INACTIVE  = "비활성화된 계정입니다. 관리자에게 문의해 주세요.";
const SUSPENDED = "정지되었거나 사용할 수 없는 조직입니다.";

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      await login(input);
      const ctx = await getMyContext();
      const bail = async (msg: string) => { await createClient().auth.signOut(); throw new Error(msg); };
      if (!ctx) return bail(NO_ACCESS);
      if (!ctx.isActive) return bail(INACTIVE);
      if (ctx.orgStatus !== "active") return bail(SUSPENDED);
      await recordLogin();
      return ctx;
    },
    onSuccess: (ctx) => { qc.setQueryData(authKeys.me(), ctx); },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => { qc.setQueryData(authKeys.me(), null); qc.clear(); },
  });
}
```

`hooks/reactquery/auth/index.ts`:
```ts
export * from "./apis";
export * from "./keys";
export * from "./queries";
export * from "./mutations";
```

- [ ] **Step 4: 통과 확인**

Run: `npm test hooks/reactquery/auth/mutations.test.tsx`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add hooks/reactquery/auth
git commit -m "feat(p0): auth React Query 훅(useMe/useLogin/useLogout)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Providers + 루트 레이아웃

**Files:**
- Create: `lib/providers/QueryProvider.tsx`, `lib/providers/index.ts`
- Modify: `app/layout.tsx`, `app/page.tsx`

**Interfaces:**
- Consumes: 없음. Produces: 앱 전역 QueryClient + Toaster.

- [ ] **Step 1: `lib/providers/QueryProvider.tsx`**

```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: `lib/providers/index.ts`**

```ts
export { QueryProvider } from "./QueryProvider";
```

- [ ] **Step 3: `app/layout.tsx` 교체**

```tsx
import type { Metadata } from "next";
import { QueryProvider } from "@/lib/providers";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = { title: "관리비서", description: "주택관리 ERP" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: `app/page.tsx` 교체**

```tsx
import { redirect } from "next/navigation";
export default function RootPage() { redirect("/staff/login"); }
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 6: Commit**

```bash
git add lib/providers app/layout.tsx app/page.tsx
git commit -m "feat(p0): QueryProvider + 루트 레이아웃/리다이렉트

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: LoginForm 컴포넌트 (TDD, RTL)

**Files:**
- Create: `app/(staff)/staff/login/components/LoginForm.tsx`, `LoginForm.test.tsx`

**Interfaces:**
- Consumes: `loginSchema`(Task 4), `useLogin`(Task 9).
- Produces: `<LoginForm />` — 아이디/비번/자동로그인/에러배너/제출.

- [ ] **Step 1: 실패 테스트** — `.../components/LoginForm.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const mutateAsync = vi.fn();
vi.mock("@/hooks/reactquery/auth", () => ({ useLogin: () => ({ mutateAsync, isPending: false }) }));

import { LoginForm } from "./LoginForm";

beforeEach(() => vi.clearAllMocks());

describe("LoginForm", () => {
  it("빈 제출 시 검증 메시지", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByText("아이디를 입력해 주세요")).toBeInTheDocument();
  });

  it("정상 입력 → mutateAsync 호출 후 이동", async () => {
    mutateAsync.mockResolvedValue({});
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("아이디"), "hong");
    await userEvent.type(screen.getByLabelText("비밀번호"), "pw123456");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(mutateAsync).toHaveBeenCalledWith({ username: "hong", password: "pw123456", autoLogin: false });
    expect(push).toHaveBeenCalledWith("/staff/receipt-management");
  });

  it("로그인 실패 시 에러 배너", async () => {
    mutateAsync.mockRejectedValue(new Error("아이디 또는 비밀번호가 올바르지 않습니다."));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("아이디"), "hong");
    await userEvent.type(screen.getByLabelText("비밀번호"), "bad");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByText("아이디 또는 비밀번호가 올바르지 않습니다.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test "app/(staff)/staff/login/components/LoginForm.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: 구현** — `LoginForm.tsx`

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginSchema, type LoginFormValues } from "@/components/forms/schema/auth";
import { useLogin } from "@/hooks/reactquery/auth";

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", autoLogin: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    try {
      await login.mutateAsync(values);
      router.push("/staff/receipt-management");
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm font-bold text-gray-500">아이디</label>
        <input id="username" autoComplete="username" placeholder="아이디를 입력해 주세요"
          className="h-12 rounded-xl border px-3.5" {...register("username")} />
        {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-bold text-gray-500">비밀번호</label>
        <input id="password" type="password" autoComplete="current-password" placeholder="비밀번호를 입력해 주세요"
          className="h-12 rounded-xl border px-3.5" {...register("password")} />
        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" {...register("autoLogin")} /> 자동 로그인
      </label>
      {serverError && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-bold text-red-500">{serverError}</div>
      )}
      <button type="submit" disabled={login.isPending}
        className="h-12 rounded-xl bg-teal-600 font-bold text-white disabled:opacity-70">
        {login.isPending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test "app/(staff)/staff/login/components/LoginForm.test.tsx"`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add "app/(staff)/staff/login/components"
git commit -m "feat(p0): LoginForm(RHF+zod+useLogin)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: 로그인 페이지 + (staff) 레이아웃 + AuthBoot + 도착지 플레이스홀더

**Files:**
- Create: `app/(staff)/staff/login/page.tsx`, `app/(staff)/layout.tsx`, `components/AuthBoot.tsx`, `app/(staff)/staff/receipt-management/page.tsx`

**Interfaces:**
- Consumes: `LoginForm`(Task 11), `shouldSignOutOnBoot`(Task 5), Supabase client(Task 6).
- Produces: `/staff/login` 화면, staff 공통 레이아웃, 자동로그인 부트 처리.

- [ ] **Step 1: 로그인 페이지** — `app/(staff)/staff/login/page.tsx`

```tsx
import { LoginForm } from "./components/LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-extrabold">로그인</h1>
        <p className="mt-1.5 text-sm text-gray-400">발급받은 계정으로 로그인해 주세요.</p>
      </div>
      <LoginForm />
      <p className="text-center text-xs text-gray-400">계정 문의는 마스터 관리자에게 요청해 주세요.</p>
    </div>
  );
}
```

- [ ] **Step 2: AuthBoot** — `components/AuthBoot.tsx` (자동로그인 미설정 시 새 세션에서 로그아웃)

```tsx
"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { shouldSignOutOnBoot, AUTO_LOGIN_KEY, SESSION_ALIVE_KEY } from "@/lib/auth/sessionPersistence";

export function AuthBoot() {
  useEffect(() => {
    const autoLogin = localStorage.getItem(AUTO_LOGIN_KEY) === "1";
    const sessionAlive = sessionStorage.getItem(SESSION_ALIVE_KEY) === "1";
    if (shouldSignOutOnBoot(autoLogin, sessionAlive)) {
      createClient().auth.signOut();
    }
    sessionStorage.setItem(SESSION_ALIVE_KEY, "1");
  }, []);
  return null;
}
```

- [ ] **Step 3: (staff) 레이아웃** — `app/(staff)/layout.tsx`

```tsx
import { AuthBoot } from "@/components/AuthBoot";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (<><AuthBoot />{children}</>);
}
```

- [ ] **Step 4: 도착지 플레이스홀더** — `app/(staff)/staff/receipt-management/page.tsx`

```tsx
export default function ReceiptManagementPage() {
  return (
    <div className="p-10">
      <h1 className="text-xl font-bold">수납관리</h1>
      <p className="mt-2 text-gray-500">P3에서 구현됩니다. (로그인 성공 도착지)</p>
    </div>
  );
}
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: `/staff/login`, `/staff/receipt-management` 라우트 생성, 성공.

- [ ] **Step 6: Commit**

```bash
git add "app/(staff)" components/AuthBoot.tsx
git commit -m "feat(p0): 로그인 페이지 + staff 레이아웃 + AuthBoot + 도착지 placeholder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: 미들웨어 가드 + 시드 계정 + 수동 E2E 검증

**Files:**
- Create: `middleware.ts`, `scripts/seed-staff.mjs`

**Interfaces:**
- Consumes: `updateSession`(Task 6).
- Produces: `/staff/*` 세션 가드, 시드 직원 1명.

- [ ] **Step 1: `middleware.ts`**

```ts
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/staff/login";
  const isStaff = pathname.startsWith("/staff");

  if (isStaff && !isLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff/login";
    return NextResponse.redirect(url);
  }
  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff/receipt-management";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ["/staff/:path*"] };
```

- [ ] **Step 2: 시드 스크립트** — `scripts/seed-staff.mjs` (service_role, 로컬 전용)

```js
// 실행: node scripts/seed-staff.mjs (환경변수 필요: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAFF_EMAIL_DOMAIN)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN || "staff.gwanribiseo.app";
const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

const USERNAME = "admin", PASSWORD = "erp!12345", FULL_NAME = "관리자";

const { data: org } = await admin.from("organizations")
  .insert({ name: "테스트 관리회사", slug: "demo", status: "active" }).select().single();

const { data: created, error: uerr } = await admin.auth.admin.createUser({
  email: `${USERNAME}@${domain}`, password: PASSWORD, email_confirm: true,
});
if (uerr) throw uerr;
const uid = created.user.id;

await admin.from("profiles").insert({ user_id: uid, username: USERNAME, full_name: FULL_NAME, is_active: true });
await admin.from("org_members").insert({ org_id: org.id, user_id: uid, role: "org_owner" });

console.log(`seeded: ${USERNAME}/${PASSWORD} @ org ${org.id}`);
```

- [ ] **Step 3: 시드 실행 (사용자, 로컬)**

`.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 채운 뒤:
```bash
node --env-file=.env.local scripts/seed-staff.mjs
```
Expected: `seeded: admin/erp!12345 @ org 1`.

- [ ] **Step 4: 수동 E2E 검증**

```bash
npm run dev
```
브라우저 체크리스트:
1. `/` 접속 → `/staff/login` 리다이렉트. ✓
2. 미로그인 상태로 `/staff/receipt-management` 직접 접속 → `/staff/login` 리다이렉트. ✓
3. 틀린 비번 → "아이디 또는 비밀번호가 올바르지 않습니다." 배너. ✓
4. `admin` / `erp!12345` 로그인 → `/staff/receipt-management` 이동. ✓
5. 로그인 상태로 `/staff/login` 접속 → 자동으로 수납관리로. ✓
6. 자동로그인 **해제** 로그인 → 브라우저 완전 종료 후 재접속 시 로그인 요구. 자동로그인 **체크** 시 유지. ✓
7. Supabase 대시보드 `audit_log`에 `action='LOGIN'` 행 생성 확인. ✓

- [ ] **Step 5: 전체 테스트 + 빌드**

Run: `npm test && npm run build`
Expected: 전 테스트 PASS, 빌드 성공.

- [ ] **Step 6: Commit**

```bash
git add middleware.ts scripts/seed-staff.mjs
git commit -m "feat(p0): 세션 가드 미들웨어 + 시드 스크립트 + E2E 검증

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (작성자 체크)

**Spec coverage (스펙 §별):**
- §2 결정 1(아이디+합성이메일)→T3/T8, 2(org_members 인가)→T7/T8/T9, 3(RLS)→T7, 4(전역유일)→T7(unique), 5(도메인 env)→T3/T6, 6(자동로그인)→T5/T12, 7(홈)→T11/T12, 8(감사 LOGIN)→T7/T9, 9(.env)→T6.
- §4 스키마(organizations/profiles/org_members/audit_log/ENUM/RPC)→T7. §5 플로우→T9(검증분기)/T11/T13. §6 RLS→T7. §7 프론트 구조/훅 계약→T8~T12. §8 에러/UX→T9/T11. §9 레거시 수용→T7(must_change_password 컬럼)+T13(시드). §10 env→T6. §11 테스트→각 TDD Task + T13 검증.
- 갭: `must_change_password` **화면 처리**는 스펙 §12에서 P0 범위 밖(배너 후속)으로 명시 → 계획 미포함(의도적).

**Placeholder scan:** "TBD/추후구현" 형태 없음. receipt-management는 의도된 placeholder(도착지)로 스펙에 명시됨.

**Type consistency:** `MyContext`(orgId/role/orgStatus/username/fullName/isActive/mustChangePassword)가 T8 정의 ↔ T9 사용 일치. RPC 반환 컬럼(org_id/role/org_status/username/full_name/is_active/must_change_password)이 T7 SQL ↔ T8 매핑 일치. `usernameToEmail`·`createClient`·`authKeys.me()` 시그니처 태스크 간 일치.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-07-p0-auth-foundation.md`.

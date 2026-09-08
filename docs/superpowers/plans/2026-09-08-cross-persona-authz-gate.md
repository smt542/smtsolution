# 크로스-persona 서버 인가 게이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4개 persona(staff·platform-admin·partner·resident)가 단일 `auth.users` 세션을 공유하는 상태에서, 잘못된 persona가 다른 그룹의 페이지·API에 접근하는 것을 서버 사이드에서 차단한다.

**Architecture:** persona 판정을 DB 술어 함수(EXISTS-any)로 단일화하고, (1) 각 route group에 nested `(app)` 서버 레이아웃 게이트를 두고(partner의 기존 패턴 복제), (2) persona 민감 API 핸들러를 `requireOrgContext`→`requirePersonaApi`로 승격한다. 토큰이 아니라 매 요청 DB resolve(역할변경 즉시 반영). 가산(HAS persona) semantics로 향후 겸직/capabilities를 자동 수용.

**Tech Stack:** Next.js App Router(이 저장소 버전 — `node_modules/next/dist/docs/` 규약 우선), Supabase(`@supabase/ssr`), PostgreSQL(SECURITY DEFINER 함수 + 마이그레이션), TypeScript, vitest.

## Global Constraints

- **신규 단위테스트 작성 금지**(프로젝트 정책 2026-08-28). 검증 = `npx tsc --noEmit` 0 / `npm run lint` 0 / `npm run build` OK / 기존 `npx vitest run` 그린 + 최종 4×4 수동 매트릭스. TDD 스킬 기본값보다 이 정책이 우선.
- **마이그 번호**: 커밋 직전 `origin/master` 최대 + **로컬 미커밋 마이그** 재확인. 현재 0145(resident_profile_image)·0146(resident 서명URL, 로컬 WIP) 선점 → 본 플랜은 **0147** 가정, 충돌 시 +1.
- **가산 semantics**: persona는 "세션이 어느 걸로 로그인됐나"가 아니라 "유저가 그 persona를 보유했나". 배타 처리 금지.
- **작업 트리 보존**: 워킹트리에 다른 세션의 resident 서명URL WIP(`app/(resident)/rb/**`, `supabase/migrations/0146_*.sql`, `hooks/reactquery/residentBilling/*` 등)이 섞여 있음. **이 파일들을 절대 stage/커밋하지 말 것.** 각 커밋은 본 플랜이 만든 파일만 `git add`.
- **에러 문구**: 기존 스타일 유지 — 401 `"인증이 필요합니다."`, 403 `"권한이 없습니다."`.
- **브랜치**: `security/persona-authz-gate` (스펙 커밋이 이미 존재).
- **정본 스펙**: `docs/superpowers/specs/2026-09-08-cross-persona-authz-gate-design.md`.

---

## File Structure

- Create: `supabase/migrations/0147_persona_predicates.sql` — `current_user_is_manager_staff()`, `current_user_is_field_partner()` 술어 함수.
- Create: `lib/api/requirePersona.ts` — API 핸들러용 `requirePersonaApi(sb, persona)`.
- Create: `lib/auth/requirePersona.ts` — 서버 컴포넌트용 `requirePersona(persona, loginPath)` + `requireResidentLink()`.
- Create: `app/(staff)/staff/(app)/layout.tsx` — staff 서버 게이트.
- Create: `app/(platform-admin)/platform-admin/(app)/layout.tsx` — platform-admin 서버 게이트.
- Create: `app/(resident)/resident/(app)/layout.tsx` — resident 서버 게이트.
- Modify: 11개 API route 핸들러(아래 Task 3 목록).
- Move(git mv): 각 그룹 보호 페이지 폴더 → 해당 그룹 `(app)/` 하위(URL 불변, route group).

---

## Phase 1 — 데이터 술어 + API 게이트 (실데이터 누수 차단, 저위험)

### Task 1: persona 술어 함수 (신규 마이그레이션)

**Files:**
- Create: `supabase/migrations/0147_persona_predicates.sql`

**Interfaces:**
- Produces: SQL 함수 `current_user_is_manager_staff() -> boolean`, `current_user_is_field_partner() -> boolean`. `authenticated` 롤에 execute grant. `current_user_is_platform_admin()`(기존 0133)와 동일 스타일.

- [ ] **Step 1: 마이그레이션 파일 작성**

`current_user_is_platform_admin()`(0133) 패턴을 그대로 복제(role→staff_type). `staff_type` enum 값은 `manager_staff|field_staff|support_staff|tenant`(0002 정의).

```sql
-- 0147_persona_predicates.sql
-- persona 서버 인가용 술어. current_user_is_platform_admin()(0133)과 동일 스타일(EXISTS-any + profile active).
-- 가산 semantics: 유저가 해당 staff_type 멤버십을 "보유"하면 true(다중 멤버십 정확 판정).

create or replace function current_user_is_manager_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid()) and m.staff_type = 'manager_staff'
  )
  and exists (
    select 1 from profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  )
$$;
revoke execute on function current_user_is_manager_staff() from public, anon;
grant execute on function current_user_is_manager_staff() to authenticated;

create or replace function current_user_is_field_partner() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid()) and m.staff_type in ('field_staff','support_staff')
  )
  and exists (
    select 1 from profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  )
$$;
revoke execute on function current_user_is_field_partner() from public, anon;
grant execute on function current_user_is_field_partner() to authenticated;
```

- [ ] **Step 2: 로컬 파일 검증(적용은 Claude가 라이브 DB에)**

이 저장소는 마이그 적용을 CLI가 아니라 Claude가 Management API로 수행(메모리 `supabase-migration-apply-method`). 워커는 파일만 작성. 적용은 리뷰 후 Claude가 `scripts/db-query.mjs`/Management API(ref `amhtprmapxlizdnsgbeg`)로 실행.

Run: `git status --short supabase/migrations/0147_persona_predicates.sql`
Expected: `?? supabase/migrations/0147_persona_predicates.sql` (신규 파일만)

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0147_persona_predicates.sql
git commit -m "feat(security): persona 술어 함수(manager_staff/field_partner)"
```

---

### Task 2: API용 `requirePersonaApi`

**Files:**
- Create: `lib/api/requirePersona.ts`

**Interfaces:**
- Consumes: Supabase 서버 클라이언트(`@/lib/supabase/server`의 `createClient()` 결과), Task 1 술어 rpc.
- Produces: `requirePersonaApi(sb: SupabaseClient, persona: "manager_staff"|"platform_admin"|"field_partner"): Promise<{ ok: true; ctx: OrgContext } | { ok: false; response: Response }>`. `requireOrgContext`와 반환 형태 동일(드롭인). 무세션 401, persona 불일치 403.

- [ ] **Step 1: 헬퍼 작성**

`lib/api/requireOrgContext.ts`의 반환 계약(`{ ok:true; ctx } | { ok:false; response }`)을 그대로 따른다.

```ts
// lib/api/requirePersona.ts
import type { SupabaseClient } from "@supabase/supabase-js";

type OrgContext = {
  org_id?: number | null;
  role?: string | null;
  staff_type?: string | null;
  permissions?: unknown;
  [key: string]: unknown;
};

const PREDICATE = {
  manager_staff: "current_user_is_manager_staff",
  platform_admin: "current_user_is_platform_admin",
  field_partner: "current_user_is_field_partner",
} as const;

export type WorkforcePersona = keyof typeof PREDICATE;

/**
 * 라우트 핸들러 서버 인가: 세션 유저가 요구 persona를 보유했는지 단언한다.
 * 무세션 401, persona 불일치 403. org_id가 필요한 핸들러를 위해 ctx도 반환(requireOrgContext 드롭인).
 */
export async function requirePersonaApi(
  sb: SupabaseClient,
  persona: WorkforcePersona,
): Promise<{ ok: true; ctx: OrgContext } | { ok: false; response: Response }> {
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) {
    return { ok: false, response: Response.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  const { data: allowed, error } = await sb.rpc(PREDICATE[persona]);
  if (error || allowed !== true) {
    return { ok: false, response: Response.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  const { data: ctxData } = await sb.rpc("get_my_context");
  const ctx = (Array.isArray(ctxData) ? ctxData[0] : ctxData) as OrgContext | null;
  return { ok: true, ctx: ctx ?? {} };
}
```

- [ ] **Step 2: 타입 검증**

Run: `npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 3: 커밋**

```bash
git add lib/api/requirePersona.ts
git commit -m "feat(security): requirePersonaApi 라우트 핸들러 인가 헬퍼"
```

---

### Task 3: 11개 API route에 persona 게이트 적용

**주의(안전성 근거):** staff 로그인(`/api/staff/login`)이 `manager_staff` 멤버십만 세션 발급하므로, staff 앱에서 오는 모든 세션은 `manager_staff`다 → `manager_staff` 단언은 org_owner 포함 정당한 staff를 전부 통과시키고 field/support/resident만 배제한다(회귀 없음).

**Files (Pattern A — `requireOrgContext` → `requirePersonaApi`, 6건):**
- Modify: `app/api/buildings/[id]/tenant-cards/route.ts`
- Modify: `app/api/buildings/export/route.ts`
- Modify: `app/api/customer-numbers/export/route.ts`
- Modify: `app/api/fee-items/export/route.ts`
- Modify: `app/api/payment/cms/route.ts`
- Modify: `app/api/utilities/ledger/route.ts`

**Files (Pattern B — 기존 inline get_my_context+permission 유지, persona 단언 추가, 5건):**
- Modify: `app/api/accounts/route.ts`
- Modify: `app/api/accounts/[userId]/route.ts`
- Modify: `app/api/bill/fax/send/route.ts`
- Modify: `app/api/messaging/send/route.ts`
- Modify: `app/api/setup/sender/route.ts`

**Files (Pattern C — 이중경로 분기 1건):**
- Modify: `app/api/messaging/dispatch-scheduled/route.ts`

**Interfaces:**
- Consumes: `requirePersonaApi`(Task 2).

- [ ] **Step 1: Pattern A — import 교체 + 호출 교체 (6개 파일)**

각 파일에서 import 라인
```ts
import { requireOrgContext } from "@/lib/api/requireOrgContext";
```
을
```ts
import { requirePersonaApi } from "@/lib/api/requirePersona";
```
로 바꾸고, 호출부(대표 예 `app/api/buildings/export/route.ts:17-19`)
```ts
  const sb = await createClient();
  const gate = await requireOrgContext(sb);
  if (!gate.ok) return gate.response;
```
를
```ts
  const sb = await createClient();
  const gate = await requirePersonaApi(sb, "manager_staff");
  if (!gate.ok) return gate.response;
```
로 바꾼다. 6개 파일 모두 `requireOrgContext(sb)` 호출은 이 형태다(핸들러들은 `gate.ctx`를 참조하지 않음 — 정찰 확인). 각 파일에서 `requireOrgContext` 참조가 0이 되도록 한다.

- [ ] **Step 2: Pattern A 검증 — 잔여 참조 없음 확인**

Run: `npx tsc --noEmit`
Expected: 에러 0
(또한 위 6개 파일에 `requireOrgContext` 문자열이 남지 않았는지 grep로 확인.)

- [ ] **Step 3: Pattern B — 기존 가드 뒤에 persona 단언 삽입 (5개 파일)**

Pattern B 라우트는 이미 `auth.getUser()` + `get_my_context()` + 권한(`org_owner`/`platform_admin`/특정 permission)을 inline 검사한다. 그 **기존 검사를 그대로 두고**, 검사를 통과한 직후(핸들러가 본 작업을 수행하기 직전)에 아래 단언을 삽입한다. 이미 만든 supabase 서버 클라이언트 변수(파일마다 `sb`/`supabase` 등 — 기존 변수명 사용)를 재사용한다.

```ts
  // persona 게이트: field/support 파트너·세입자 세션 배제(기존 권한검사에 더한 방어).
  const { data: isManagerStaff } = await sb.rpc("current_user_is_manager_staff");
  if (isManagerStaff !== true) {
    return Response.json({ error: "권한이 없습니다." }, { status: 403 });
  }
```

파일별 supabase 변수명이 다르면 해당 이름으로 맞춘다(예: `supabase.rpc(...)`). 응답 방식이 `NextResponse.json`을 쓰는 파일이면 그 파일의 기존 관례에 맞춰 403을 반환한다(형태만 일치, 상태코드 403 고정).

- [ ] **Step 4: Pattern C — dispatch-scheduled 이중경로**

`app/api/messaging/dispatch-scheduled/route.ts`는 (a) `CRON_SECRET` 머신 경로와 (b) `auth.getUser()`+org+`messaging` permission 대화형 경로를 가진다. **(a) 머신 경로는 그대로 둔다**(persona 무관, 스케줄러). (b) 대화형 경로에서 기존 권한검사 통과 직후 Step 3과 동일한 `current_user_is_manager_staff` 단언을 삽입한다. CRON_SECRET 분기에는 절대 넣지 않는다.

- [ ] **Step 5: 검증**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 0 / 경고 기존 수준

Run: `npx vitest run`
Expected: 기존 테스트 그린(신규 작성 없음). 실패 시 원인 분석 후 수정.

- [ ] **Step 6: 커밋**

```bash
git add app/api/buildings/[id]/tenant-cards/route.ts app/api/buildings/export/route.ts app/api/customer-numbers/export/route.ts app/api/fee-items/export/route.ts app/api/payment/cms/route.ts app/api/utilities/ledger/route.ts app/api/accounts/route.ts app/api/accounts/[userId]/route.ts app/api/bill/fax/send/route.ts app/api/messaging/send/route.ts app/api/setup/sender/route.ts app/api/messaging/dispatch-scheduled/route.ts
git commit -m "feat(security): persona 민감 API 11건에 manager_staff 게이트"
```

---

## Phase 2 — staff 페이지 서버 게이트 (게이트 전무 → 신규)

### Task 4: 서버 컴포넌트용 페이지 게이트 헬퍼

**Files:**
- Create: `lib/auth/requirePersona.ts`

**Interfaces:**
- Consumes: `@/lib/supabase/server`의 `createClient()`, `next/navigation`의 `redirect`, Task 1 술어 + 기존 `resident_my_link`.
- Produces: `requirePersona(persona: "manager_staff"|"platform_admin"|"field_partner", loginPath: string): Promise<void>` (무세션→loginPath, 불일치→`/`), `requireResidentLink(): Promise<void>` (무세션→`/resident/login`, 미링크→`/resident/verify`).

- [ ] **Step 1: 헬퍼 작성**

`redirect()`는 예외를 던져 렌더를 중단하므로 반환 타입은 `void`로 충분(파트너 레이아웃과 동일 방식).

```ts
// lib/auth/requirePersona.ts — 서버 컴포넌트 전용(내부에서 next/headers cookies 사용).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PREDICATE = {
  manager_staff: "current_user_is_manager_staff",
  platform_admin: "current_user_is_platform_admin",
  field_partner: "current_user_is_field_partner",
} as const;

export type WorkforcePersona = keyof typeof PREDICATE;

/** 무세션→loginPath, persona 불일치→중립 '/'(게이트 밖, 루프 방지). */
export async function requirePersona(persona: WorkforcePersona, loginPath: string): Promise<void> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect(loginPath);
  const { data: allowed } = await sb.rpc(PREDICATE[persona]);
  if (allowed !== true) redirect("/");
}

/** resident: 무세션→/resident/login, 미링크→/resident/verify. */
export async function requireResidentLink(): Promise<void> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/resident/login");
  const { data: rows } = await sb.rpc("resident_my_link");
  const link = Array.isArray(rows) ? rows[0] : rows;
  if (!link) redirect("/resident/verify");
}
```

- [ ] **Step 2: 타입 검증**

Run: `npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 3: 커밋**

```bash
git add lib/auth/requirePersona.ts
git commit -m "feat(security): 서버 컴포넌트 persona 게이트 헬퍼"
```

---

### Task 5: staff 그룹 nested (app) 게이트

**Files:**
- Create: `app/(staff)/staff/(app)/layout.tsx`
- Move(git mv): 아래 보호 페이지 폴더/파일 → `app/(staff)/staff/(app)/` 하위 (URL 불변).

**Interfaces:**
- Consumes: `requirePersona`(Task 4).

**배경:** `app/(staff)/layout.tsx`(AppShell 제공)는 login 포함 전부를 감싼다. login을 건드리지 않고 보호 페이지에만 서버 게이트를 걸기 위해, partner의 `(app)` 패턴을 복제한다. 최상위 layout은 그대로 두므로 login·AppShell 렌더는 불변이고, `(app)` 레이아웃이 게이트만 추가한다.

- [ ] **Step 1: 게이트 레이아웃 생성**

```tsx
// app/(staff)/staff/(app)/layout.tsx
import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";

export default async function StaffGuardedLayout({ children }: { children: ReactNode }) {
  await requirePersona("manager_staff", "/staff/login");
  return <>{children}</>;
}
```

- [ ] **Step 2: 보호 페이지 폴더를 (app) 하위로 이동 (login 제외)**

`login`만 제외하고 `app/(staff)/staff/` 직하위 항목 전부를 `(app)/`로 옮긴다. route group `(app)`은 URL을 바꾸지 않는다.

```bash
git mv "app/(staff)/staff/page.tsx"            "app/(staff)/staff/(app)/page.tsx"
git mv "app/(staff)/staff/buildings"           "app/(staff)/staff/(app)/buildings"
git mv "app/(staff)/staff/long-term-repair"    "app/(staff)/staff/(app)/long-term-repair"
git mv "app/(staff)/staff/messaging"           "app/(staff)/staff/(app)/messaging"
git mv "app/(staff)/staff/notices"             "app/(staff)/staff/(app)/notices"
git mv "app/(staff)/staff/vendor-management"   "app/(staff)/staff/(app)/vendor-management"
git mv "app/(staff)/staff/accounts"            "app/(staff)/staff/(app)/accounts"
git mv "app/(staff)/staff/customer-numbers"    "app/(staff)/staff/(app)/customer-numbers"
git mv "app/(staff)/staff/utilities"           "app/(staff)/staff/(app)/utilities"
git mv "app/(staff)/staff/bill"                "app/(staff)/staff/(app)/bill"
git mv "app/(staff)/staff/fee-items"           "app/(staff)/staff/(app)/fee-items"
git mv "app/(staff)/staff/moving-settlement"   "app/(staff)/staff/(app)/moving-settlement"
git mv "app/(staff)/staff/setup"               "app/(staff)/staff/(app)/setup"
git mv "app/(staff)/staff/management-fee"      "app/(staff)/staff/(app)/management-fee"
git mv "app/(staff)/staff/receipts"            "app/(staff)/staff/(app)/receipts"
git mv "app/(staff)/staff/overdue"             "app/(staff)/staff/(app)/overdue"
```

- [ ] **Step 3: import 경로 회귀 확인**

이동한 페이지들이 `@/` 절대경로를 쓰면 무영향. 상대경로(`../`, `./`)로 그룹 밖을 참조하던 게 있으면 깨질 수 있으므로 타입체크로 확인.

Run: `npx tsc --noEmit`
Expected: 에러 0 (에러가 나면 해당 상대 import를 `@/` 절대경로로 교정)

- [ ] **Step 4: 빌드 검증(라우트 충돌·레이아웃 중첩 확인)**

Run: `npm run build`
Expected: 성공. `/staff/*` 라우트가 이전과 동일하게 생성되고 `/staff/login`은 게이트 밖.

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/(app)/layout.tsx"
git add -A "app/(staff)/staff"
git commit -m "feat(security): staff 페이지 서버 persona 게이트((app) 그룹)"
```

---

## Phase 3 — platform-admin·resident 페이지 게이트 (클라 → 서버 승격)

### Task 6: platform-admin 그룹 nested (app) 게이트

**Files:**
- Create: `app/(platform-admin)/platform-admin/(app)/layout.tsx`
- Move(git mv): 보호 페이지 폴더/파일 → `app/(platform-admin)/platform-admin/(app)/` (login 제외).

**배경:** 최상위 `layout.tsx`→`PlatformAdminLayoutContent`(클라, pathname으로 login 예외 + PlatformShell + 클라 가드)는 유지한다. `(app)` 서버 게이트를 authoritative 계층으로 추가한다(서버가 먼저 리다이렉트 → 콘텐츠 플래시 제거). 기존 클라 `PlatformAdminGuard`는 이제 중복이지만 무해하므로 유지(후속 정리 가능).

- [ ] **Step 1: 게이트 레이아웃 생성**

```tsx
// app/(platform-admin)/platform-admin/(app)/layout.tsx
import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";

export default async function PlatformAdminGuardedLayout({ children }: { children: ReactNode }) {
  await requirePersona("platform_admin", "/platform-admin/login");
  return <>{children}</>;
}
```

- [ ] **Step 2: 보호 페이지 이동 (login 제외)**

```bash
git mv "app/(platform-admin)/platform-admin/page.tsx"       "app/(platform-admin)/platform-admin/(app)/page.tsx"
git mv "app/(platform-admin)/platform-admin/organizations"  "app/(platform-admin)/platform-admin/(app)/organizations"
git mv "app/(platform-admin)/platform-admin/points"         "app/(platform-admin)/platform-admin/(app)/points"
git mv "app/(platform-admin)/platform-admin/accounts"       "app/(platform-admin)/platform-admin/(app)/accounts"
git mv "app/(platform-admin)/platform-admin/billing"        "app/(platform-admin)/platform-admin/(app)/billing"
git mv "app/(platform-admin)/platform-admin/settings"       "app/(platform-admin)/platform-admin/(app)/settings"
```

- [ ] **Step 3: 타입·빌드 검증**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 0 / 빌드 성공. `/platform-admin/login`은 게이트 밖, 나머지는 서버 게이트 적용.

- [ ] **Step 4: 커밋**

```bash
git add "app/(platform-admin)/platform-admin/(app)/layout.tsx"
git add -A "app/(platform-admin)/platform-admin"
git commit -m "feat(security): platform-admin 페이지 서버 persona 게이트((app) 그룹)"
```

---

### Task 7: resident 그룹 nested (app) 게이트

**Files:**
- Create: `app/(resident)/resident/(app)/layout.tsx`
- Move(git mv): 보호 페이지(home·bill·notice·me·notify) → `app/(resident)/resident/(app)/`.

**배경:** 공개 signed-URL 조회는 `r/**`·`rb/**`(= `resident/` 밖)라 이미 게이트와 무관. `resident/` 내 onboarding/legal(login·auth·verify·pending·nomatch·privacy·terms)은 `(app)` 밖에 남긴다. 기존 클라 `useResidentGuard`는 페이지가 `link` 데이터로 계속 사용하므로 유지(서버 게이트는 추가 방어).

**선행 검증(위험):** resident 세션이 쿠키 기반이어야 서버 `auth.getUser()`가 인식한다. `lib/resident/session.ts`가 `@supabase/ssr` password 세션을 만들면 쿠키에 실린다 → 정상. Step 3에서 실제로 확인.

- [ ] **Step 1: 게이트 레이아웃 생성**

```tsx
// app/(resident)/resident/(app)/layout.tsx
import type { ReactNode } from "react";
import { requireResidentLink } from "@/lib/auth/requirePersona";

export default async function ResidentGuardedLayout({ children }: { children: ReactNode }) {
  await requireResidentLink();
  return <>{children}</>;
}
```

- [ ] **Step 2: 보호 페이지 이동 (onboarding/legal 제외)**

```bash
git mv "app/(resident)/resident/home"    "app/(resident)/resident/(app)/home"
git mv "app/(resident)/resident/bill"    "app/(resident)/resident/(app)/bill"
git mv "app/(resident)/resident/notice"  "app/(resident)/resident/(app)/notice"
git mv "app/(resident)/resident/me"      "app/(resident)/resident/(app)/me"
git mv "app/(resident)/resident/notify"  "app/(resident)/resident/(app)/notify"
```

`login`·`auth`·`verify`·`pending`·`nomatch`·`privacy`·`terms`는 이동하지 않는다.

- [ ] **Step 3: 타입·빌드 검증 + 세션 쿠키 확인**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 0 / 빌드 성공.

수동 확인: dev 서버(master 체크아웃, `localhost:3000`)에서 세입자 스텁 로그인(201호) 후 `/resident/home` 접근 시 정상 렌더(서버 게이트 통과)되는지, 로그아웃/미링크 상태에서 `/resident/home`이 `/resident/login`·`/resident/verify`로 서버 리다이렉트되는지 확인. (정본 화면 회귀 없음.)

- [ ] **Step 4: 커밋**

```bash
git add "app/(resident)/resident/(app)/layout.tsx"
git add -A "app/(resident)/resident"
git commit -m "feat(security): resident 페이지 서버 게이트((app) 그룹)"
```

---

## Phase 4 — 검증

### Task 8: 4×4 persona 매트릭스 + 전체 그린

**Files:** 없음(검증 전용). 마이그 라이브 적용은 Claude가 Task 1 파일로 수행.

- [ ] **Step 1: 정적 검증 전체**

Run: `npx tsc --noEmit && npm run lint && npm run build && npx vitest run`
Expected: tsc 0 / lint 기존수준 / build OK / vitest 기존 그린.

- [ ] **Step 2: 마이그레이션 라이브 적용 (Claude)**

Task 1의 `0147_persona_predicates.sql`을 Management API로 적용(ref `amhtprmapxlizdnsgbeg`). 적용 후 `select current_user_is_manager_staff();`류가 함수로 존재하는지, `authenticated`에 grant됐는지 확인.

- [ ] **Step 3: 4×4 매트릭스 수동 검증**

4 persona 세션 × 4 경로그룹. 각 셀에서 기대:
- 페이지: 올바른 persona = 정상 렌더 / 그 외 = `/`(또는 그룹 login)으로 서버 리다이렉트, 콘텐츠 미노출.
- API(대표 라우트로): 올바른 persona = 200 / 무세션 = 401 / 그 외 persona = 403.
- 특히 **field/support(partner) 세션 → staff 페이지 & `/api/buildings/export` 등 = 차단(리다이렉트/403)** 확인(원 최악 시나리오).

| 세션↓ / 경로→ | /staff | /platform-admin | /partner | /resident |
|---|---|---|---|---|
| manager_staff | 통과 | 차단 | 차단 | 차단 |
| platform_admin | 차단 | 통과 | 차단 | 차단 |
| field/support | 차단 | 차단 | 통과 | 차단 |
| resident(linked) | 차단 | 차단 | 차단 | 통과 |

- [ ] **Step 4: 공개 플로우 회귀 확인**

- 4개 login(`/api/staff/login`·`/api/platform/login`·`/api/partner/login`·resident kakao) 정상.
- 공개 signed-URL(`/r/**`·`/rb/**`) 로그인 없이 조회 정상.
- 크론 경로(`/api/delivery/reconcile`·`/api/messaging/dispatch-scheduled` CRON_SECRET 분기) 정상.

- [ ] **Step 5: 최종 상태 확인 및 PR 준비**

Run: `git log --oneline origin/master..HEAD`
Expected: Task 1~7의 커밋 + 스펙 커밋. 워킹트리에 resident 서명URL WIP는 여전히 uncommitted(본 작업과 분리 유지).

PR 생성은 Claude가 리뷰 후 수행.

---

## Self-Review 결과(작성자 체크)

- **스펙 커버리지**: 스펙 §4.2(술어)=Task1 / §4.4(API)=Task2·3 / §4.3(페이지, staff·platform·resident)=Task4·5·6·7 / §5(루프 방지, 중립 `/`)=Task4 헬퍼 / §6(4×4)=Task8. partner는 기존 게이트가 스펙 준수 → 무변경(정찰 확인). ✅
- **범위 밖 준수**: 테이블 분리·데이터 RPC persona-scoping·JWT claims·겸직 capabilities 미포함(스펙 §3). ✅
- **타입 일관성**: `requirePersonaApi`(API, 반환 `{ok,ctx|response}`) vs `requirePersona`(페이지, `void`)를 별도 파일·별도 이름으로 분리(혼동 제거). 술어명 3종 두 헬퍼에서 동일 상수. ✅
- **미해결/위험**: (a) Pattern B 5건은 org_owner/platform_admin도 호출 가능 — staff-login 제약상 staff 세션은 manager_staff라 안전하나, platform_admin이 이 org-스코프 라우트를 쓰는 경우가 있으면 재검토(대개 `/api/platform/*` 사용). (b) resident 서버 게이트는 세션 쿠키 전제 — Task7 Step3에서 확인. (c) 페이지 이동(git mv)로 상대 import 회귀 가능 — 각 Task tsc로 검출.

# P1b 계정·권한 (staff-management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리회사(org) 내 직원 계정을 발급·관리하고, 모듈 권한을 화면과 DB(RLS) 양쪽에서 강제한다.

**Architecture:** 권한 = `org_members.role` + `permissions`(jsonb 모듈키 배열, org_owner=전체). 계정 발급/수정/비번재발급은 Supabase Edge Function(service_role, 호출자 JWT 인가 검증). 민감 테이블은 RLS를 `select`(org 멤버 조회) / `write`(모듈 권한 필요)로 분리해 쓰기를 차단. 화면은 `useMe().permissions`로 게이팅. 스펙: `docs/superpowers/specs/2026-08-10-p1b-staff-management-design.md`.

**Tech Stack:** Next.js 16.3(App Router)·React 19·Tailwind v4·React Query·@supabase/ssr·Supabase Edge Functions(Deno)·Vitest+RTL·zod.

## Global Constraints

- 백엔드 접근은 route handler 없이 Supabase 직접 호출. 데이터 도메인은 `hooks/reactquery/<도메인>/{apis,keys,queries,mutations,index}.ts`, snake↔camel 매퍼 `rowToX`/부분안전 `inputToRow`(제공된 필드만; 강제 null 금지).
- 클라이언트 Supabase = `createClient()` from `@/lib/supabase/client`(anon 키). RLS는 `my_org_ids()` 기반.
- **service_role 키는 Edge Function(Deno) 내부에서만** 사용. 클라이언트 노출·커밋 금지. Edge Function은 **반드시 호출자 JWT를 검증**한 뒤 실행.
- 로그인 이메일 = `loginEmail(companyCode, username)` = `{회사코드}.{아이디}@도메인`. `username`은 org 내에서만 유일(전역 UNIQUE 아님).
- **org_owner(마스터)=전체 권한**: 권한 검사 시 role=org_owner면 배열과 무관하게 통과(short-circuit).
- 비밀번호는 화면에 표시/저장하지 않는다.
- 삭제는 소프트삭제(`deleted_at`) 또는 비활성화(`is_active=false`). 계정은 삭제 대신 비활성화.
- 모듈 권한 강제는 **쓰기(write) 차단**까지. 같은 org 조회는 허용(교차모듈 화면).
- TDD: 순수 로직·데이터계층·스키마·컴포넌트는 실패테스트 → 구현 → 통과. 마이그레이션 SQL·Edge Function(Deno)은 이 레포에 러너가 없으므로 **완성코드 + 리뷰 체크리스트**로 대체하고 런타임 검증은 pending-user.
- 각 태스크 완료 시 `npx tsc --noEmit`·`npx vitest run` green 확인 후 커밋.

## File Structure

- Create `supabase/migrations/0002_p1b_permissions.sql` — permissions 컬럼, tenant_user_id, `has_permission()`, `get_my_context()` 재정의, `list_staff()`, 민감테이블 RLS 분리.
- Create `lib/auth/permissions.ts` (+`.test.ts`) — 모듈키·라벨, `isMaster`/`hasModule`/`canManageAccounts`, 자기보호 가드.
- Modify `hooks/reactquery/auth/apis.ts` (+`apis.test.ts`) — `MyContext.permissions` 추가.
- Create `components/forms/schema/staff.ts` (+`.test.ts`) — 생성/수정/비번 zod.
- Create `hooks/reactquery/staff/{apis,keys,queries,mutations,index}.ts` (+`apis.test.ts`) — 직원 도메인.
- Create `supabase/functions/_shared/authz.ts`, `supabase/functions/_shared/guards.ts` — Deno 공통.
- Create `supabase/functions/admin-create-staff/index.ts`, `admin-update-staff/index.ts`, `admin-reset-password/index.ts`.
- Create `app/(staff)/staff/staff-management/page.tsx` (+`page.test.tsx`) 및 `./components/{StaffList,TenantOverview,StaffFormModal}.tsx`.

---

### Task 1: 마이그레이션 0002 (DB 기반)

**Files:**
- Create: `supabase/migrations/0002_p1b_permissions.sql`

**Interfaces:**
- Produces (런타임): `has_permission(text)->bool`, `list_staff()->setof`, `get_my_context()`(+permissions jsonb), `org_members.permissions jsonb`, `occupancies.tenant_user_id uuid`, 민감테이블 select/write 정책.

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/0002_p1b_permissions.sql`:
```sql
-- ===== P1b: 권한 컬럼 =====
alter table org_members add column permissions jsonb not null default '[]'::jsonb;

-- 입주자 탭 '연결상태' 표시용(현재 전부 미연결). tenant 포털 붙을 때 사용.
alter table occupancies add column tenant_user_id uuid references auth.users(id) on delete set null;

-- ===== 권한 검사 =====
create or replace function has_permission(p_module text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid())
      and m.org_id in (select my_org_ids())
      and (m.role = 'org_owner' or m.permissions ? p_module)
  );
$$;

-- ===== get_my_context: permissions 반환 추가 =====
create or replace function get_my_context()
returns table (org_id bigint, role org_member_role, org_status org_status,
               username text, full_name text, is_active boolean,
               must_change_password boolean, permissions jsonb)
language sql stable security definer set search_path = public as $$
  select m.org_id, m.role, o.status, p.username, p.full_name, p.is_active,
         p.must_change_password, m.permissions
  from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid()
  order by (o.status = 'active') desc, m.created_at
  limit 1
$$;

-- ===== 직원 리스트(FK 임베드 회피) =====
create or replace function list_staff()
returns table (user_id uuid, role org_member_role, permissions jsonb,
               username text, full_name text, phone text,
               is_active boolean, must_change_password boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.role, m.permissions,
         p.username, p.full_name, p.phone, p.is_active, p.must_change_password
  from org_members m
  join profiles p on p.user_id = m.user_id
  where m.org_id in (select my_org_ids())
  order by (m.role = 'org_owner') desc, p.full_name
$$;
revoke execute on function list_staff() from anon;

-- ===== 민감 테이블 RLS: select(조회 open) / write(모듈 권한) 분리 =====
-- buildings/units/occupancies -> 'buildings', fee_items -> 'fee_items',
-- vendors/vendor_categories -> 'vendors', building_types -> 'buildings'
drop policy bt_all  on building_types;
create policy bt_select on building_types for select using (org_id in (select my_org_ids()));
create policy bt_write  on building_types for all
  using (org_id in (select my_org_ids()) and has_permission('buildings'))
  with check (org_id in (select my_org_ids()) and has_permission('buildings'));

drop policy bld_all on buildings;
create policy bld_select on buildings for select using (org_id in (select my_org_ids()));
create policy bld_write  on buildings for all
  using (org_id in (select my_org_ids()) and has_permission('buildings'))
  with check (org_id in (select my_org_ids()) and has_permission('buildings'));

drop policy fi_all on fee_items;
create policy fi_select on fee_items for select using (org_id in (select my_org_ids()));
create policy fi_write  on fee_items for all
  using (org_id in (select my_org_ids()) and has_permission('fee_items'))
  with check (org_id in (select my_org_ids()) and has_permission('fee_items'));

drop policy vc_all on vendor_categories;
create policy vc_select on vendor_categories for select using (org_id in (select my_org_ids()));
create policy vc_write  on vendor_categories for all
  using (org_id in (select my_org_ids()) and has_permission('vendors'))
  with check (org_id in (select my_org_ids()) and has_permission('vendors'));

drop policy vnd_all on vendors;
create policy vnd_select on vendors for select using (org_id in (select my_org_ids()));
create policy vnd_write  on vendors for all
  using (org_id in (select my_org_ids()) and has_permission('vendors'))
  with check (org_id in (select my_org_ids()) and has_permission('vendors'));

drop policy unit_all on units;
create policy unit_select on units for select
  using (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy unit_write on units for all
  using (building_id in (select id from buildings where org_id in (select my_org_ids())) and has_permission('buildings'))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())) and has_permission('buildings'));

drop policy occ_all on occupancies;
create policy occ_select on occupancies for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy occ_write on occupancies for all
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and has_permission('buildings'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and has_permission('buildings'));
```

- [ ] **Step 2: 리뷰 체크리스트(러너 없음 → 수기 검증)**

확인:
- `has_permission`의 `permissions ? p_module` 는 jsonb 배열 원소 존재 검사(`'["a"]'::jsonb ? 'a'` = true). org_owner는 배열 무관 통과.
- select/write 분리: INSERT/UPDATE/DELETE는 write 정책만 적용(권한 필요), SELECT는 select 정책으로 org 멤버 허용(permissive OR). 소프트삭제 RPC(`soft_delete_building/unit`, SECURITY INVOKER)는 write 정책을 통과해야 하므로 권한 없으면 0행.
- `get_my_context`/`list_staff`는 `security definer set search_path=public`. `list_staff`는 anon revoke.
- `0000`/`0001` 미적용 상태여도 0002는 그 위에 순차 적용되는 전제(파일 순서).

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0002_p1b_permissions.sql
git commit -m "feat(p1b): 0002 마이그레이션 — permissions/has_permission/list_staff/RLS 분리"
```

---

### Task 2: 권한 헬퍼 `lib/auth/permissions.ts` (TDD)

**Files:**
- Create: `lib/auth/permissions.ts`
- Test: `lib/auth/permissions.test.ts`

**Interfaces:**
- Consumes: `OrgMemberRole` from `@/hooks/reactquery/auth`.
- Produces: `MODULE_KEYS`, `ModuleKey`, `MODULE_LABELS`, `isMaster(role)`, `hasModule(ctx,key)`, `canManageAccounts(ctx)`, `guardDeactivate(args)->string|null`, `guardDemote(args)->string|null`.

- [ ] **Step 1: 실패 테스트 작성**

Create `lib/auth/permissions.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isMaster, hasModule, canManageAccounts, guardDeactivate, guardDemote, MODULE_KEYS } from "./permissions";

describe("permissions", () => {
  it("isMaster: org_owner만 true", () => {
    expect(isMaster("org_owner")).toBe(true);
    expect(isMaster("manager")).toBe(false);
    expect(isMaster(null)).toBe(false);
  });
  it("hasModule: 마스터는 항상 true", () => {
    expect(hasModule({ role: "org_owner", permissions: [] }, "billing")).toBe(true);
  });
  it("hasModule: 일반은 배열 포함 여부", () => {
    expect(hasModule({ role: "manager", permissions: ["fee_items"] }, "fee_items")).toBe(true);
    expect(hasModule({ role: "manager", permissions: ["fee_items"] }, "billing")).toBe(false);
    expect(hasModule(null, "billing")).toBe(false);
  });
  it("canManageAccounts: accounts 권한 또는 마스터", () => {
    expect(canManageAccounts({ role: "org_owner", permissions: [] })).toBe(true);
    expect(canManageAccounts({ role: "manager", permissions: ["accounts"] })).toBe(true);
    expect(canManageAccounts({ role: "manager", permissions: ["billing"] })).toBe(false);
  });
  it("MODULE_KEYS 12개 포함", () => {
    expect(MODULE_KEYS).toContain("accounts");
    expect(MODULE_KEYS.length).toBe(12);
  });
  it("guardDeactivate: 본인/마지막 마스터 차단", () => {
    expect(guardDeactivate({ actorUserId: "a", targetUserId: "a", targetRole: "manager", ownerCount: 2 })).toMatch(/본인/);
    expect(guardDeactivate({ actorUserId: "a", targetUserId: "b", targetRole: "org_owner", ownerCount: 1 })).toMatch(/마스터/);
    expect(guardDeactivate({ actorUserId: "a", targetUserId: "b", targetRole: "manager", ownerCount: 1 })).toBeNull();
  });
  it("guardDemote: 마지막/본인 마스터 강등 차단", () => {
    expect(guardDemote({ actorUserId: "a", targetUserId: "b", currentRole: "org_owner", nextRole: "manager", ownerCount: 1 })).toMatch(/마지막/);
    expect(guardDemote({ actorUserId: "a", targetUserId: "a", currentRole: "org_owner", nextRole: "manager", ownerCount: 2 })).toMatch(/본인/);
    expect(guardDemote({ actorUserId: "a", targetUserId: "b", currentRole: "manager", nextRole: "field", ownerCount: 1 })).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run lib/auth/permissions` → FAIL(모듈 없음).

- [ ] **Step 3: 구현**

Create `lib/auth/permissions.ts`:
```ts
import type { OrgMemberRole } from "@/hooks/reactquery/auth";

export const MODULE_KEYS = [
  "buildings", "billing", "fee_items", "documents", "arrears", "vendors",
  "longterm", "sms", "utilities", "move_settle", "accounts", "setup",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  buildings: "건물·입주자", billing: "관리비부과", fee_items: "항목등록",
  documents: "서류발행", arrears: "미납", vendors: "협력업체",
  longterm: "장기수선", sms: "문자", utilities: "공과금",
  move_settle: "이사정산", accounts: "계정·직원", setup: "셋업",
};

type Ctx = { role?: OrgMemberRole | null; permissions?: string[] | null } | null | undefined;

export function isMaster(role?: OrgMemberRole | null): boolean {
  return role === "org_owner";
}
export function hasModule(ctx: Ctx, key: ModuleKey): boolean {
  if (!ctx) return false;
  if (isMaster(ctx.role)) return true;
  return (ctx.permissions ?? []).includes(key);
}
export function canManageAccounts(ctx: Ctx): boolean {
  return hasModule(ctx, "accounts");
}

// 자기보호 가드: 위반 시 사용자 메시지, 정상이면 null
export function guardDeactivate(a: {
  actorUserId: string; targetUserId: string; targetRole: OrgMemberRole; ownerCount: number;
}): string | null {
  if (a.actorUserId === a.targetUserId) return "본인 계정은 비활성화할 수 없습니다";
  if (a.targetRole === "org_owner" && a.ownerCount <= 1) return "마지막 마스터는 비활성화할 수 없습니다";
  return null;
}
export function guardDemote(a: {
  actorUserId: string; targetUserId: string; currentRole: OrgMemberRole; nextRole: OrgMemberRole; ownerCount: number;
}): string | null {
  const demoting = a.currentRole === "org_owner" && a.nextRole !== "org_owner";
  if (demoting && a.ownerCount <= 1) return "마지막 마스터는 강등할 수 없습니다";
  if (demoting && a.actorUserId === a.targetUserId) return "본인 마스터 권한은 스스로 내릴 수 없습니다";
  return null;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run lib/auth/permissions` → PASS.
- [ ] **Step 5: 커밋** — `git commit -m "feat(p1b): 권한 헬퍼(모듈키·게이팅·자기보호 가드)"`

---

### Task 3: MyContext에 permissions 추가 (TDD)

**Files:**
- Modify: `hooks/reactquery/auth/apis.ts`
- Test: `hooks/reactquery/auth/apis.test.ts`

**Interfaces:**
- Consumes: `get_my_context` RPC(Task 1)이 `permissions jsonb` 반환.
- Produces: `MyContext.permissions: string[]`.

- [ ] **Step 1: 테스트 갱신(실패)**

`hooks/reactquery/auth/apis.test.ts`의 getMyContext 성공 케이스를 교체:
```ts
  it("rpc 결과 첫 행을 카멜케이스로 매핑(permissions 포함)", async () => {
    rpc.mockResolvedValue({ data: [{
      org_id: 1, role: "manager", org_status: "active",
      username: "hong", full_name: "홍길동", is_active: true, must_change_password: false,
      permissions: ["fee_items", "arrears"],
    }], error: null });
    const ctx = await getMyContext();
    expect(ctx).toEqual({
      orgId: 1, role: "manager", orgStatus: "active",
      username: "hong", fullName: "홍길동", isActive: true, mustChangePassword: false,
      permissions: ["fee_items", "arrears"],
    });
  });
```
그리고 "결과 없으면 null" 케이스는 유지.

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run hooks/reactquery/auth/apis` → FAIL(permissions 없음).

- [ ] **Step 3: 구현** — `hooks/reactquery/auth/apis.ts`:

`MyContext` 인터페이스에 필드 추가:
```ts
  mustChangePassword: boolean;
  permissions: string[];
}
```
`getMyContext`의 반환 매핑에 추가(마지막 줄):
```ts
    mustChangePassword: row.must_change_password,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
  };
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run hooks/reactquery/auth/apis` → PASS. 이어 `npx tsc --noEmit` green.
- [ ] **Step 5: 커밋** — `git commit -m "feat(p1b): MyContext에 permissions 추가"`

---

### Task 4: 직원 zod 스키마 (TDD)

**Files:**
- Create: `components/forms/schema/staff.ts`
- Test: `components/forms/schema/staff.test.ts`

**Interfaces:**
- Consumes: `MODULE_KEYS`(Task 2).
- Produces: `staffCreateSchema`, `staffUpdateSchema`, `resetPasswordSchema`, `StaffRole`(`"org_owner"|"manager"|"field"`).

- [ ] **Step 1: 실패 테스트**

Create `components/forms/schema/staff.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { staffCreateSchema, resetPasswordSchema } from "./staff";

describe("staffCreateSchema", () => {
  it("정상 입력 통과", () => {
    const r = staffCreateSchema.safeParse({
      username: "kim1", fullName: "김직원", phone: "010-1", role: "manager",
      permissions: ["fee_items"], initialPassword: "pw123456",
    });
    expect(r.success).toBe(true);
  });
  it("짧은 초기비번 실패", () => {
    const r = staffCreateSchema.safeParse({
      username: "kim1", fullName: "김직원", role: "manager", permissions: [], initialPassword: "123",
    });
    expect(r.success).toBe(false);
  });
  it("잘못된 모듈키 실패", () => {
    const r = staffCreateSchema.safeParse({
      username: "kim1", fullName: "김", role: "manager", permissions: ["nope"], initialPassword: "pw123456",
    });
    expect(r.success).toBe(false);
  });
});
describe("resetPasswordSchema", () => {
  it("8자 미만 실패", () => {
    expect(resetPasswordSchema.safeParse({ newPassword: "123" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run components/forms/schema/staff` → FAIL.

- [ ] **Step 3: 구현**

Create `components/forms/schema/staff.ts`:
```ts
import { z } from "zod";
import { MODULE_KEYS } from "@/lib/auth/permissions";

export type StaffRole = "org_owner" | "manager" | "field";
const roleEnum = z.enum(["org_owner", "manager", "field"]);
const moduleEnum = z.enum(MODULE_KEYS);

export const staffCreateSchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요").regex(/^[a-zA-Z0-9._-]+$/, "영문·숫자·._- 만 가능"),
  fullName: z.string().min(1, "이름을 입력해 주세요"),
  phone: z.string().optional(),
  role: roleEnum,
  permissions: z.array(moduleEnum).default([]),
  initialPassword: z.string().min(8, "비밀번호는 8자 이상"),
});
export type StaffCreateValues = z.input<typeof staffCreateSchema>;

export const staffUpdateSchema = z.object({
  fullName: z.string().min(1, "이름을 입력해 주세요"),
  phone: z.string().optional(),
  role: roleEnum,
  permissions: z.array(moduleEnum).default([]),
  isActive: z.boolean().default(true),
});
export type StaffUpdateValues = z.input<typeof staffUpdateSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "비밀번호는 8자 이상"),
});
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run components/forms/schema/staff` → PASS.
- [ ] **Step 5: 커밋** — `git commit -m "feat(p1b): 직원 계정 zod 스키마"`

---

### Task 5: 직원 데이터 계층 `hooks/reactquery/staff/` (TDD)

**Files:**
- Create: `hooks/reactquery/staff/apis.ts`, `keys.ts`, `queries.ts`, `mutations.ts`, `index.ts`
- Test: `hooks/reactquery/staff/apis.test.ts`

**Interfaces:**
- Consumes: `createClient()`, `list_staff` RPC(Task 1), Edge Functions(Task 6), `OrgMemberRole`.
- Produces: `StaffAccount`, `listStaff()`, `createStaff(input)`, `updateStaff(userId,patch)`, `resetStaffPassword(userId,pw)`, `listTenantOverview()`, hooks `useStaff/useTenantOverview/useCreateStaff/useUpdateStaff/useResetStaffPassword`.

- [ ] **Step 1: 실패 테스트**

Create `hooks/reactquery/staff/apis.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
const rpc = vi.fn();
const invoke = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from, rpc, functions: { invoke } }) }));
import { listStaff, createStaff, updateStaff, resetStaffPassword, listTenantOverview } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("staff apis", () => {
  it("listStaff: list_staff RPC → camel 매핑", async () => {
    rpc.mockResolvedValue({ data: [{ user_id: "u1", role: "manager", permissions: ["fee_items"], username: "kim", full_name: "김", phone: "010", is_active: true, must_change_password: false }], error: null });
    const r = await listStaff();
    expect(rpc).toHaveBeenCalledWith("list_staff");
    expect(r[0]).toMatchObject({ userId: "u1", role: "manager", permissions: ["fee_items"], username: "kim", fullName: "김", isActive: true });
  });
  it("createStaff: admin-create-staff invoke", async () => {
    invoke.mockResolvedValue({ data: { ok: true, userId: "u2" }, error: null });
    await createStaff({ username: "kim", fullName: "김", role: "manager", permissions: [], initialPassword: "pw123456" });
    expect(invoke).toHaveBeenCalledWith("admin-create-staff", { body: expect.objectContaining({ username: "kim", role: "manager" }) });
  });
  it("createStaff: 서버 ok:false면 에러 메시지 throw", async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: "이미 사용 중인 아이디입니다" }, error: null });
    await expect(createStaff({ username: "kim", fullName: "김", role: "manager", permissions: [], initialPassword: "pw123456" }))
      .rejects.toThrow("이미 사용 중인 아이디입니다");
  });
  it("updateStaff: userId 병합해 invoke", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await updateStaff("u1", { isActive: false });
    expect(invoke).toHaveBeenCalledWith("admin-update-staff", { body: { userId: "u1", isActive: false } });
  });
  it("resetStaffPassword: invoke", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await resetStaffPassword("u1", "newpass12");
    expect(invoke).toHaveBeenCalledWith("admin-reset-password", { body: { userId: "u1", newPassword: "newpass12" } });
  });
  it("listTenantOverview: 연결상태 매핑", async () => {
    const isFn = vi.fn().mockResolvedValue({ data: [{ id: 1, tenant_name: "홍", phone: "010", tenant_user_id: null, units: { unit_no: "101", buildings: { name: "그린빌라" } } }], error: null });
    from.mockReturnValue({ select: () => ({ is: isFn }) });
    const r = await listTenantOverview();
    expect(r[0]).toMatchObject({ id: 1, tenantName: "홍", unitNo: "101", buildingName: "그린빌라", linked: false });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run hooks/reactquery/staff/apis` → FAIL.

- [ ] **Step 3: 구현 apis.ts**

Create `hooks/reactquery/staff/apis.ts`:
```ts
import { createClient } from "@/lib/supabase/client";
import type { OrgMemberRole } from "@/hooks/reactquery/auth";

export interface StaffAccount {
  userId: string; role: OrgMemberRole; permissions: string[];
  username: string; fullName: string; phone: string | null;
  isActive: boolean; mustChangePassword: boolean;
}
const rowToStaff = (r: any): StaffAccount => ({
  userId: r.user_id, role: r.role,
  permissions: Array.isArray(r.permissions) ? r.permissions : [],
  username: r.username, fullName: r.full_name, phone: r.phone,
  isActive: r.is_active, mustChangePassword: r.must_change_password,
});

export interface StaffCreateInput {
  username: string; fullName: string; phone?: string;
  role: OrgMemberRole; permissions: string[]; initialPassword: string;
}
export interface StaffUpdateInput {
  fullName?: string; phone?: string; role?: OrgMemberRole; permissions?: string[]; isActive?: boolean;
}

// functions.invoke 결과 처리: 전송 에러 or 서버 ok:false 모두 throw
function unwrap(data: any, error: any): void {
  if (error) throw new Error(error.message ?? "요청 실패");
  if (data && data.ok === false) throw new Error(data.error ?? "요청 실패");
}

export async function listStaff(): Promise<StaffAccount[]> {
  const { data, error } = await createClient().rpc("list_staff");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToStaff);
}
export async function createStaff(input: StaffCreateInput): Promise<void> {
  const { data, error } = await createClient().functions.invoke("admin-create-staff", { body: input });
  unwrap(data, error);
}
export async function updateStaff(userId: string, patch: StaffUpdateInput): Promise<void> {
  const { data, error } = await createClient().functions.invoke("admin-update-staff", { body: { userId, ...patch } });
  unwrap(data, error);
}
export async function resetStaffPassword(userId: string, newPassword: string): Promise<void> {
  const { data, error } = await createClient().functions.invoke("admin-reset-password", { body: { userId, newPassword } });
  unwrap(data, error);
}

export interface TenantOverviewRow {
  id: number; tenantName: string | null; phone: string | null;
  unitNo: string; buildingName: string; linked: boolean;
}
export async function listTenantOverview(): Promise<TenantOverviewRow[]> {
  const { data, error } = await createClient()
    .from("occupancies")
    .select("id,tenant_name,phone,tenant_user_id, units!inner(unit_no, buildings!inner(name))")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id, tenantName: r.tenant_name, phone: r.phone,
    unitNo: r.units?.unit_no ?? "", buildingName: r.units?.buildings?.name ?? "",
    linked: r.tenant_user_id != null,
  }));
}
```

- [ ] **Step 4: keys/queries/mutations/index**

Create `hooks/reactquery/staff/keys.ts`:
```ts
export const staffKeys = {
  all: ["staff"] as const,
  list: () => ["staff", "list"] as const,
  tenants: () => ["staff", "tenants"] as const,
};
```
Create `hooks/reactquery/staff/queries.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { listStaff, listTenantOverview } from "./apis";
import { staffKeys } from "./keys";
export function useStaff() { return useQuery({ queryKey: staffKeys.list(), queryFn: listStaff }); }
export function useTenantOverview() { return useQuery({ queryKey: staffKeys.tenants(), queryFn: listTenantOverview }); }
```
Create `hooks/reactquery/staff/mutations.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createStaff, updateStaff, resetStaffPassword, type StaffCreateInput, type StaffUpdateInput } from "./apis";
import { staffKeys } from "./keys";
export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: StaffCreateInput) => createStaff(i), onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all }) });
}
export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ userId, patch }: { userId: string; patch: StaffUpdateInput }) => updateStaff(userId, patch), onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all }) });
}
export function useResetStaffPassword() {
  return useMutation({ mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) => resetStaffPassword(userId, newPassword) });
}
```
Create `hooks/reactquery/staff/index.ts`:
```ts
export * from "./apis";
export * from "./keys";
export * from "./queries";
export * from "./mutations";
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run hooks/reactquery/staff/apis` → PASS. `npx tsc --noEmit` green.
- [ ] **Step 6: 커밋** — `git commit -m "feat(p1b): 직원 데이터 계층(staff 도메인)"`

---

### Task 6: Edge Functions (Deno) — 계정 발급/수정/비번재발급

**Files:**
- Create: `supabase/functions/_shared/authz.ts`, `supabase/functions/_shared/guards.ts`
- Create: `supabase/functions/admin-create-staff/index.ts`, `admin-update-staff/index.ts`, `admin-reset-password/index.ts`

**Interfaces:**
- Consumes(런타임 env): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STAFF_EMAIL_DOMAIN`.
- Produces(런타임): 세 함수. 응답 규약 = `{ ok:true, ... }` 또는 `{ ok:false, error }`(HTTP 200), 예기치 못한 오류만 4xx/5xx.

> **주의:** 이 레포에 Deno 테스트 러너가 없다. 완성코드 + 리뷰 체크리스트로 대체하고 런타임 검증은 pending-user. `_shared/guards.ts`의 규칙은 `lib/auth/permissions.ts`(Task 2)의 `guardDeactivate/guardDemote`와 **동일 규칙의 Deno 복제**이며 둘은 동기화되어야 한다(런타임/번들 경계 때문).

- [ ] **Step 1: `_shared/authz.ts`**
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
// 호출자 JWT 검증 + 계정관리 권한(org_owner OR accounts) 확인. 실패 시 throw {status,message}.
export async function requireAccountManager(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!jwt) throw { status: 401, message: "인증이 필요합니다" };
  const svc = serviceClient();
  const { data: u, error } = await svc.auth.getUser(jwt);
  if (error || !u?.user) throw { status: 401, message: "유효하지 않은 세션입니다" };
  const actorId = u.user.id;
  const { data: mem } = await svc.from("org_members").select("org_id, role, permissions").eq("user_id", actorId).limit(1).maybeSingle();
  if (!mem) throw { status: 403, message: "권한이 없습니다" };
  const perms = Array.isArray(mem.permissions) ? mem.permissions : [];
  if (mem.role !== "org_owner" && !perms.includes("accounts")) throw { status: 403, message: "계정 관리 권한이 없습니다" };
  return { svc, actorId, orgId: mem.org_id as number };
}
// 대상 직원이 호출자와 같은 org인지 확인하고 현재 role 반환
export async function requireSameOrgMember(svc: ReturnType<typeof serviceClient>, orgId: number, targetUserId: string) {
  const { data: m } = await svc.from("org_members").select("role").eq("org_id", orgId).eq("user_id", targetUserId).maybeSingle();
  if (!m) throw { status: 404, message: "대상 직원을 찾을 수 없습니다" };
  return m.role as string;
}
export async function ownerCount(svc: ReturnType<typeof serviceClient>, orgId: number): Promise<number> {
  const { count } = await svc.from("org_members").select("user_id", { count: "exact", head: true }).eq("org_id", orgId).eq("role", "org_owner");
  return count ?? 0;
}
```

- [ ] **Step 2: `_shared/guards.ts`** (Task 2 규칙의 Deno 복제)
```ts
export function guardDeactivate(a: { actorUserId: string; targetUserId: string; targetRole: string; ownerCount: number }): string | null {
  if (a.actorUserId === a.targetUserId) return "본인 계정은 비활성화할 수 없습니다";
  if (a.targetRole === "org_owner" && a.ownerCount <= 1) return "마지막 마스터는 비활성화할 수 없습니다";
  return null;
}
export function guardDemote(a: { actorUserId: string; targetUserId: string; currentRole: string; nextRole: string; ownerCount: number }): string | null {
  const demoting = a.currentRole === "org_owner" && a.nextRole !== "org_owner";
  if (demoting && a.ownerCount <= 1) return "마지막 마스터는 강등할 수 없습니다";
  if (demoting && a.actorUserId === a.targetUserId) return "본인 마스터 권한은 스스로 내릴 수 없습니다";
  return null;
}
```

- [ ] **Step 3: `admin-create-staff/index.ts`**
```ts
import { requireAccountManager, json } from "../_shared/authz.ts";

const DOMAIN = Deno.env.get("STAFF_EMAIL_DOMAIN") ?? "staff.gwanribiseo.app";
const loginEmail = (slug: string, username: string) =>
  `${slug.trim().toLowerCase()}.${username.trim().toLowerCase()}@${DOMAIN}`;

Deno.serve(async (req) => {
  try {
    const { svc, orgId } = await requireAccountManager(req);
    const { username, fullName, phone, role, permissions, initialPassword } = await req.json();
    if (!username || !fullName || !role || !initialPassword) return json({ ok: false, error: "필수 항목이 누락되었습니다" });
    if (!["org_owner", "manager", "field"].includes(role)) return json({ ok: false, error: "잘못된 유형입니다" });
    if (String(initialPassword).length < 8) return json({ ok: false, error: "비밀번호는 8자 이상이어야 합니다" });

    const { data: org } = await svc.from("organizations").select("slug").eq("id", orgId).single();
    if (!org?.slug) return json({ ok: false, error: "조직 정보 오류" }, 500);

    // 같은 org 내 username 중복 확인(profiles↔org_members 직접 FK 없음 → 2단 조회)
    const { data: profs } = await svc.from("profiles").select("user_id").eq("username", username);
    const ids = (profs ?? []).map((p: any) => p.user_id);
    if (ids.length) {
      const { data: dup } = await svc.from("org_members").select("user_id").eq("org_id", orgId).in("user_id", ids);
      if (dup && dup.length) return json({ ok: false, error: "이미 사용 중인 아이디입니다" });
    }

    const { data: created, error: cerr } = await svc.auth.admin.createUser({
      email: loginEmail(org.slug, username), password: initialPassword, email_confirm: true,
    });
    if (cerr || !created?.user) return json({ ok: false, error: cerr?.message ?? "계정 생성 실패" }, 500);
    const uid = created.user.id;
    const rollback = async () => { await svc.auth.admin.deleteUser(uid); };

    const { error: perr } = await svc.from("profiles").insert({
      user_id: uid, username, full_name: fullName, phone: phone ?? null, is_active: true, must_change_password: true,
    });
    if (perr) { await rollback(); return json({ ok: false, error: "프로필 생성 실패" }, 500); }

    const { error: merr } = await svc.from("org_members").insert({
      org_id: orgId, user_id: uid, role, permissions: role === "org_owner" ? [] : (permissions ?? []),
    });
    if (merr) { await rollback(); return json({ ok: false, error: "멤버 생성 실패" }, 500); }

    return json({ ok: true, userId: uid, username });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? "오류가 발생했습니다" }, e?.status ?? 500);
  }
});
```

- [ ] **Step 4: `admin-update-staff/index.ts`**
```ts
import { requireAccountManager, requireSameOrgMember, ownerCount, json } from "../_shared/authz.ts";
import { guardDeactivate, guardDemote } from "../_shared/guards.ts";

Deno.serve(async (req) => {
  try {
    const { svc, actorId, orgId } = await requireAccountManager(req);
    const { userId, fullName, phone, role, permissions, isActive } = await req.json();
    if (!userId) return json({ ok: false, error: "대상이 지정되지 않았습니다" });
    const currentRole = await requireSameOrgMember(svc, orgId, userId);
    const owners = await ownerCount(svc, orgId);

    if (isActive === false) {
      const g = guardDeactivate({ actorUserId: actorId, targetUserId: userId, targetRole: currentRole, ownerCount: owners });
      if (g) return json({ ok: false, error: g });
    }
    if (role && role !== currentRole) {
      if (!["org_owner", "manager", "field"].includes(role)) return json({ ok: false, error: "잘못된 유형입니다" });
      const g = guardDemote({ actorUserId: actorId, targetUserId: userId, currentRole, nextRole: role, ownerCount: owners });
      if (g) return json({ ok: false, error: g });
    }

    // profiles 부분 갱신
    const pPatch: Record<string, unknown> = {};
    if (fullName !== undefined) pPatch.full_name = fullName;
    if (phone !== undefined) pPatch.phone = phone;
    if (isActive !== undefined) pPatch.is_active = isActive;
    if (Object.keys(pPatch).length) {
      const { error } = await svc.from("profiles").update(pPatch).eq("user_id", userId);
      if (error) return json({ ok: false, error: "프로필 갱신 실패" }, 500);
    }
    // org_members 부분 갱신
    const mPatch: Record<string, unknown> = {};
    if (role !== undefined) mPatch.role = role;
    if (permissions !== undefined) mPatch.permissions = role === "org_owner" ? [] : permissions;
    if (Object.keys(mPatch).length) {
      const { error } = await svc.from("org_members").update(mPatch).eq("org_id", orgId).eq("user_id", userId);
      if (error) return json({ ok: false, error: "권한 갱신 실패" }, 500);
    }
    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? "오류가 발생했습니다" }, e?.status ?? 500);
  }
});
```

- [ ] **Step 5: `admin-reset-password/index.ts`**
```ts
import { requireAccountManager, requireSameOrgMember, json } from "../_shared/authz.ts";

Deno.serve(async (req) => {
  try {
    const { svc, orgId } = await requireAccountManager(req);
    const { userId, newPassword } = await req.json();
    if (!userId || !newPassword) return json({ ok: false, error: "필수 항목이 누락되었습니다" });
    if (String(newPassword).length < 8) return json({ ok: false, error: "비밀번호는 8자 이상이어야 합니다" });
    await requireSameOrgMember(svc, orgId, userId);

    const { error: uerr } = await svc.auth.admin.updateUserById(userId, { password: newPassword });
    if (uerr) return json({ ok: false, error: "비밀번호 변경 실패" }, 500);
    await svc.from("profiles").update({ must_change_password: true }).eq("user_id", userId);
    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? "오류가 발생했습니다" }, e?.status ?? 500);
  }
});
```

- [ ] **Step 6: 리뷰 체크리스트**
- 모든 함수가 `requireAccountManager`로 **호출자 JWT 검증 후** 실행(무검증 service_role 실행 없음).
- 대상 직원은 `requireSameOrgMember`로 **같은 org** 확인(교차 org 조작 불가).
- 자기보호 가드: 본인 비활성/강등·마지막 마스터 차단.
- create 실패 시 auth 유저 롤백(deleteUser).
- org_owner 저장 시 permissions는 `[]`로 정규화.
- `_shared/guards.ts` 규칙이 `lib/auth/permissions.ts`와 일치.

- [ ] **Step 7: 커밋** — `git commit -m "feat(p1b): 계정 관리 Edge Functions(create/update/reset + 공통 인가)"`

---

### Task 7: staff-management 화면 — 셸·가드·탭·리스트·입주자조회 (TDD)

**Files:**
- Create: `app/(staff)/staff/staff-management/page.tsx`
- Create: `app/(staff)/staff/staff-management/components/StaffList.tsx`, `components/TenantOverview.tsx`
- Test: `app/(staff)/staff/staff-management/page.test.tsx`

**Interfaces:**
- Consumes: `useMe`, `canManageAccounts`, `useStaff`, `useTenantOverview`, `useUpdateStaff`, `MODULE_LABELS`, common `Tabs`/`Button`/`Spinner`.
- Produces: 페이지(권한 가드 + 탭[사무실/현장/입주자]); StaffFormModal은 Task 8에서 연결(이 태스크는 "신규/수정" 버튼은 두되 열기 핸들러는 no-op placeholder).

- [ ] **Step 1: 실패 테스트**

Create `app/(staff)/staff/staff-management/page.test.tsx`:
```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/staff", () => ({
  useStaff: vi.fn(), useTenantOverview: vi.fn(),
  useCreateStaff: vi.fn(), useUpdateStaff: vi.fn(), useResetStaffPassword: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import StaffManagementPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useStaff, useTenantOverview, useCreateStaff, useUpdateStaff, useResetStaffPassword } from "@/hooks/reactquery/staff";

const mut = { mutateAsync: vi.fn(), isPending: false };
function setup(me: any) {
  vi.mocked(useMe).mockReturnValue({ data: me, isLoading: false } as any);
  vi.mocked(useStaff).mockReturnValue({ data: [
    { userId: "u1", role: "org_owner", permissions: [], username: "admin", fullName: "관리자", phone: "010-1", isActive: true, mustChangePassword: false },
    { userId: "u2", role: "field", permissions: ["buildings"], username: "kim", fullName: "김현장", phone: "010-2", isActive: true, mustChangePassword: false },
  ], isLoading: false } as any);
  vi.mocked(useTenantOverview).mockReturnValue({ data: [
    { id: 1, tenantName: "홍입주", phone: "010-9", unitNo: "101", buildingName: "그린빌라", linked: false },
  ], isLoading: false } as any);
  vi.mocked(useCreateStaff).mockReturnValue(mut as any);
  vi.mocked(useUpdateStaff).mockReturnValue(mut as any);
  vi.mocked(useResetStaffPassword).mockReturnValue(mut as any);
}
beforeEach(() => { vi.clearAllMocks(); });

describe("StaffManagementPage", () => {
  it("권한 없으면 접근 불가 안내", () => {
    setup({ orgId: 1, role: "field", permissions: ["buildings"] });
    render(<StaffManagementPage />);
    expect(screen.getByText(/권한이 없습니다/)).toBeInTheDocument();
  });
  it("마스터: 사무실 탭에 org_owner 노출", () => {
    setup({ orgId: 1, role: "org_owner", permissions: [] });
    render(<StaffManagementPage />);
    expect(screen.getByText("관리자")).toBeInTheDocument();
  });
  it("현장 탭 클릭 시 field 직원 노출", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    setup({ orgId: 1, role: "org_owner", permissions: [] });
    render(<StaffManagementPage />);
    await userEvent.click(screen.getByRole("button", { name: /현장 관리자/ }));
    expect(screen.getByText("김현장")).toBeInTheDocument();
  });
  it("입주자 탭: 연결상태 미연결 노출", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    setup({ orgId: 1, role: "org_owner", permissions: [] });
    render(<StaffManagementPage />);
    await userEvent.click(screen.getByRole("button", { name: /입주자/ }));
    expect(screen.getByText("그린빌라")).toBeInTheDocument();
    expect(screen.getByText("미연결")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run staff-management/page` → FAIL.

- [ ] **Step 3: StaffList 컴포넌트**

Create `app/(staff)/staff/staff-management/components/StaffList.tsx`:
```tsx
"use client";
import type { StaffAccount } from "@/hooks/reactquery/staff";

export function StaffList({ rows, onEdit }: { rows: StaffAccount[]; onEdit: (s: StaffAccount) => void }) {
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-gray-400">직원이 없습니다.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="py-2">이름</th><th>아이디</th><th>연락처</th><th>유형</th><th>상태</th><th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.userId} className="border-b">
            <td className="py-2 font-medium">{s.fullName}</td>
            <td>{s.username}</td>
            <td>{s.phone ?? "-"}</td>
            <td>{s.role === "org_owner" ? "마스터" : "일반"}</td>
            <td>{s.isActive ? "활성" : "비활성"}</td>
            <td className="text-right">
              <button type="button" className="text-teal-600" onClick={() => onEdit(s)} aria-label={`${s.fullName} 수정`}>수정</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: TenantOverview 컴포넌트**

Create `app/(staff)/staff/staff-management/components/TenantOverview.tsx`:
```tsx
"use client";
import type { TenantOverviewRow } from "@/hooks/reactquery/staff";

export function TenantOverview({ rows }: { rows: TenantOverviewRow[] }) {
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-gray-400">입주자 정보가 없습니다.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="py-2">건물</th><th>호실</th><th>입주자</th><th>연락처</th><th>연결상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b">
            <td className="py-2">{r.buildingName}</td>
            <td>{r.unitNo}</td>
            <td>{r.tenantName ?? "-"}</td>
            <td>{r.phone ?? "-"}</td>
            <td>{r.linked ? "연결" : "미연결"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 5: page.tsx (가드 + 탭 + 리스트). StaffFormModal은 Task 8에서 연결 — 이 단계는 모달 없이 버튼만.**

Create `app/(staff)/staff/staff-management/page.tsx`:
```tsx
"use client";
import React, { useState } from "react";
import { Button, Tabs, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { canManageAccounts } from "@/lib/auth/permissions";
import { useStaff, useTenantOverview, type StaffAccount } from "@/hooks/reactquery/staff";
import { StaffList } from "./components/StaffList";
import { TenantOverview } from "./components/TenantOverview";

type TabKey = "office" | "field" | "tenant";

export default function StaffManagementPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const [tab, setTab] = useState<TabKey>("office");

  const { data: staff = [] } = useStaff();
  const { data: tenants = [] } = useTenantOverview();

  if (meLoading) return <div className="p-6"><Spinner /></div>;
  if (!canManageAccounts(me)) {
    return <div className="p-6"><p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-500">계정 관리 권한이 없습니다.</p></div>;
  }

  const office = staff.filter((s) => s.role === "org_owner" || s.role === "manager");
  const field = staff.filter((s) => s.role === "field");
  const openEdit = (_s: StaffAccount) => { /* Task 8: 모달 연결 */ };

  return (
    <div className="flex min-h-screen flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-t1">계정·권한</h1>
        {tab !== "tenant" && <Button variant="primary" onClick={() => openEdit(null as any)}>＋ 계정 등록</Button>}
      </div>
      <Tabs
        tabs={[
          { key: "office", label: "사무실 관리자" },
          { key: "field", label: "현장 관리자" },
          { key: "tenant", label: "입주자" },
        ]}
        activeKey={tab}
        onChange={(k) => setTab(k as TabKey)}
      />
      <div className="mt-4">
        {tab === "office" && <StaffList rows={office} onEdit={openEdit} />}
        {tab === "field" && <StaffList rows={field} onEdit={openEdit} />}
        {tab === "tenant" && <TenantOverview rows={tenants} />}
      </div>
    </div>
  );
}
```

> **주의(구현자):** `Tabs`의 실제 props(키·라벨·activeKey·onChange 시그니처)는 `components/common/Tabs.tsx`를 확인해 맞출 것. 위 시그니처와 다르면 컴포넌트에 맞춰 조정(라벨 텍스트 "사무실 관리자/현장 관리자/입주자"와 버튼 role은 유지해 테스트 통과). `Spinner`/`Button` export도 `components/common/index` 확인.

- [ ] **Step 6: 통과 확인** — Run: `npx vitest run staff-management/page` → PASS. `npx tsc --noEmit` green.
- [ ] **Step 7: 커밋** — `git commit -m "feat(p1b): staff-management 셸·가드·탭·직원/입주자 리스트"`

---

### Task 8: StaffFormModal — 계정 등록/수정/비번재발급 + 권한 칩 (TDD)

**Files:**
- Create: `app/(staff)/staff/staff-management/components/StaffFormModal.tsx`
- Modify: `app/(staff)/staff/staff-management/page.tsx` (모달 상태·핸들러 연결)
- Test: `app/(staff)/staff/staff-management/page.test.tsx` (모달 케이스 추가)

**Interfaces:**
- Consumes: `Modal`/`Input`/`Select`/`Checkbox`/`Button`, `staffCreateSchema`/`staffUpdateSchema`, `MODULE_KEYS`/`MODULE_LABELS`, `useCreateStaff`/`useUpdateStaff`/`useResetStaffPassword`.
- Produces: `StaffFormModal` (유형=마스터면 권한 칩 비활성/전체; 신규만 초기비번; 수정 시 상태 토글·비번재발급 버튼).

- [ ] **Step 1: 테스트 추가(실패)**

`page.test.tsx`에 추가:
```tsx
  it("계정 등록 클릭 → 모달 열림(초기비번 필드 존재)", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    setup({ orgId: 1, role: "org_owner", permissions: [] });
    render(<StaffManagementPage />);
    await userEvent.click(screen.getByRole("button", { name: /계정 등록/ }));
    expect(await screen.findByText("계정 등록")).toBeInTheDocument();
    expect(screen.getByLabelText("초기 비밀번호")).toBeInTheDocument();
  });
  it("유형=마스터 선택 시 권한 칩 비활성(전체)", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    setup({ orgId: 1, role: "org_owner", permissions: [] });
    render(<StaffManagementPage />);
    await userEvent.click(screen.getByRole("button", { name: /계정 등록/ }));
    await userEvent.selectOptions(screen.getByLabelText("유형"), "마스터");
    expect(screen.getByRole("button", { name: "관리비부과" })).toBeDisabled();
  });
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run staff-management/page` → FAIL.

- [ ] **Step 3: StaffFormModal 구현**

Create `app/(staff)/staff/staff-management/components/StaffFormModal.tsx`:
```tsx
"use client";
import React, { useEffect, useState } from "react";
import { Modal, Input, Select, Button } from "@/components/common";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "@/lib/auth/permissions";
import type { StaffAccount } from "@/hooks/reactquery/staff";

export interface StaffFormResult {
  fullName: string; username: string; phone: string;
  role: "org_owner" | "manager" | "field"; permissions: string[];
  initialPassword?: string; isActive: boolean;
}

export function StaffFormModal({
  open, onClose, editing, bucket, onSubmit, isPending,
}: {
  open: boolean; onClose: () => void; editing: StaffAccount | null;
  bucket: "office" | "field"; isPending: boolean;
  onSubmit: (r: StaffFormResult) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"마스터" | "일반">("일반");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [initialPassword, setInitialPassword] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setFullName(editing?.fullName ?? "");
    setUsername(editing?.username ?? "");
    setPhone(editing?.phone ?? "");
    setType(editing?.role === "org_owner" ? "마스터" : "일반");
    setPermissions(editing?.permissions ?? []);
    setInitialPassword("");
    setIsActive(editing?.isActive ?? true);
  }, [open, editing]);

  const isMasterType = type === "마스터";
  const role: StaffFormResult["role"] = isMasterType ? "org_owner" : bucket === "field" ? "field" : "manager";
  const toggle = (k: ModuleKey) => setPermissions((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const submit = async () => {
    await onSubmit({
      fullName, username, phone, role,
      permissions: isMasterType ? [] : permissions,
      initialPassword: editing ? undefined : initialPassword,
      isActive,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "계정 수정" : "계정 등록"}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">이름
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">아이디
          <Input value={username} onChange={(e) => setUsername(e.target.value)} disabled={!!editing} />
        </label>
        <label className="flex flex-col gap-1 text-sm">연락처
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor="staff-type">유형
          <Select id="staff-type" aria-label="유형" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="일반">일반</option>
            <option value="마스터">마스터</option>
          </Select>
        </label>
        {!editing && (
          <label className="flex flex-col gap-1 text-sm" htmlFor="staff-initpw">초기 비밀번호
            <Input id="staff-initpw" aria-label="초기 비밀번호" type="password" value={initialPassword} onChange={(e) => setInitialPassword(e.target.value)} />
          </label>
        )}
        {editing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> 활성
          </label>
        )}
        <div>
          <p className="mb-1 text-sm font-bold text-gray-500">권한</p>
          <div className="flex flex-wrap gap-1.5">
            {MODULE_KEYS.map((k) => (
              <button key={k} type="button" onClick={() => toggle(k)} disabled={isMasterType}
                className={`rounded-full border px-2.5 py-1 text-xs ${permissions.includes(k) && !isMasterType ? "border-teal-500 bg-teal-50 text-teal-700" : "text-gray-500"} disabled:opacity-50`}>
                {MODULE_LABELS[k]}
              </button>
            ))}
          </div>
          {isMasterType && <p className="mt-1 text-xs text-gray-400">마스터는 전체 권한입니다.</p>}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={isPending}>{editing ? "저장" : "등록"}</Button>
        </div>
      </div>
    </Modal>
  );
}
```

> **주의(구현자):** `Modal`/`Input`/`Select`/`Button`의 실제 props는 `components/common/*`를 확인해 맞출 것(예: Modal이 `title`을 받는지, Select가 children options를 받는지). 테스트가 기대하는 접근성 이름("유형","초기 비밀번호","관리비부과" 버튼)과 제목("계정 등록")은 유지.

- [ ] **Step 4: page.tsx 모달 연결**

`page.tsx`에 모달 상태·핸들러 추가(Task 7의 placeholder 교체):
```tsx
// import 추가
import { toast } from "sonner";
import { StaffFormModal, type StaffFormResult } from "./components/StaffFormModal";
import { useCreateStaff, useUpdateStaff } from "@/hooks/reactquery/staff";

// 컴포넌트 내부 상태
const createStaff = useCreateStaff();
const updateStaff = useUpdateStaff();
const [modalOpen, setModalOpen] = useState(false);
const [editing, setEditing] = useState<StaffAccount | null>(null);
const bucket: "office" | "field" = tab === "field" ? "field" : "office";

const openCreate = () => { setEditing(null); setModalOpen(true); };
const openEditReal = (s: StaffAccount) => { setEditing(s); setModalOpen(true); };

const handleSubmit = async (r: StaffFormResult) => {
  try {
    if (editing) {
      await updateStaff.mutateAsync({ userId: editing.userId, patch: { fullName: r.fullName, phone: r.phone, role: r.role, permissions: r.permissions, isActive: r.isActive } });
      toast.success("저장되었습니다");
    } else {
      await createStaff.mutateAsync({ username: r.username, fullName: r.fullName, phone: r.phone, role: r.role, permissions: r.permissions, initialPassword: r.initialPassword ?? "" });
      toast.success("계정이 등록되었습니다");
    }
    setModalOpen(false);
  } catch (e: any) {
    toast.error(e?.message ?? "저장 실패");
  }
};
```
그리고 헤더 버튼 `onClick={() => openEdit(null)}` → `onClick={openCreate}`, `StaffList`의 `onEdit={openEdit}` → `onEdit={openEditReal}`, JSX 하단에 모달 추가:
```tsx
<StaffFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} bucket={bucket} onSubmit={handleSubmit} isPending={createStaff.isPending || updateStaff.isPending} />
```
(placeholder `openEdit`/미사용 import 정리.)

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run staff-management/page` → PASS. `npx tsc --noEmit`·`npx vitest run` 전체 green. `npm run build` 성공.
- [ ] **Step 6: 커밋** — `git commit -m "feat(p1b): StaffFormModal(등록/수정/권한칩) + 페이지 연결"`

---

## Self-Review (작성자 점검 완료)

- **스펙 커버리지:** 권한모델(T1,T2)·화면/DB 강제(T1 RLS, T2 hasModule, T7 가드)·Edge Function 3종+인가(T6)·정식비번/must_change(T6)·입주자 조회(T5,T7)·리스트 RPC(T1,T5)·권한 칩(T8) 모두 태스크 존재.
- **플레이스홀더:** Task 1/6은 러너 부재로 리뷰 체크리스트 사용(명시). 그 외 실제 테스트 코드 포함.
- **타입 일관성:** `MyContext.permissions`(T3)·`StaffAccount`(T5)·`StaffFormResult`(T8) 시그니처 상호 일치. `hasModule`/`canManageAccounts` 시그니처 T2↔T7 일치.
- **공용 컴포넌트 리스크:** Tabs/Modal/Select/Input의 실제 props는 구현자가 `components/common`을 확인해 맞추도록 각 태스크에 주의문 명시(테스트가 기대하는 접근성 이름·제목은 유지).
- **런타임 pending-user:** 0002 적용 + `supabase functions deploy admin-create-staff admin-update-staff admin-reset-password` + env(`STAFF_EMAIL_DOMAIN`) + E2E(마스터→일반발급→최초변경 안내→권한없는 모듈 쓰기 차단).

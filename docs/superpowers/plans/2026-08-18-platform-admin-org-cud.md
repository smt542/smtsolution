# 통합관리자 조직 CUD (P1) 구현 계획

> **For agentic workers:** 이 프로젝트는 codex 위임 워크플로우다(CLAUDE.md). 각 Task를 codex-worker에 위임하고 Claude가 diff를 리뷰한다. Task는 독립 커밋·리뷰 단위이며 체크박스(`- [ ]`)로 추적한다.
> 선행 spec: `docs/superpowers/specs/2026-08-18-platform-admin-cud-design.md` (§P1).

**Goal:** 통합관리자(platform_admin)가 관리회사(organization)를 입점(생성+owner 동시 발급)·정보수정·해지(soft-delete)·복구할 수 있게 한다.

**Architecture:** 조직 생성은 `platform_create_organization` RPC(security definer, 감사) + `/api/platform/organizations` Route Handler가 owner Auth user 생성·`provision_member(cross-org)`를 원자적으로 오케스트레이션(실패 보상). 수정·해지·복구는 기존 `org_platform_update` RLS로 직접 `.from().update()`. 목록은 `deleted_at is null` 필터.

**Tech Stack:** Next.js(App Router) · Supabase(Postgres RLS/RPC) · React Query · react-hook-form + zod · vitest.

## Global Constraints

- **Next.js 규칙**: 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인(AGENTS.md). 훈련 데이터와 API가 다를 수 있음.
- **role enum**(`org_member_role`): `platform_admin` · `org_owner` · `manager` · `staff` · `field` · `tenant`. owner는 문자열 `'org_owner'`. staff_type enum: `manager_staff` · `field_staff` · `support_staff` · `tenant`.
- **마이그 번호**: 현재 브랜치 max=`0030`. 잠정 `0031`. ⚠️ **커밋 직전 `git fetch` 후 `origin/master`의 실제 max를 재확인**해 충돌 회피(병렬 워크트리 `overdue-late-fee`가 `0031` 선점 가능). 충돌 시 다음 번호로 리네임.
- **조회 패턴**: platform 훅은 로그인 supabase client로 직접 `.from()`(RPC 아님). RLS가 소스오브트루스. (`hooks/reactquery/platform/apis.ts` 참조)
- **이메일**: `loginEmail(slug, username)` = `{slug}.{username}@{도메인}` (`lib/auth/email.ts`).
- **가드**: 서버 인가는 `supabase.rpc("current_user_is_platform_admin")`; UI 가드는 기존 `PlatformAdminGuard`.
- **테스트**: vitest. supabase는 `vi.mock("@/lib/supabase/client")` + `from` mock으로 격리(패턴: `hooks/reactquery/platform/apis.test.ts`).
- **커밋 메시지**: `feat(platform-admin): …` / 마지막 줄 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## 파일 구조

| 파일 | 책임 | 액션 |
|---|---|---|
| `supabase/migrations/0031_platform_org_cud.sql` | organizations 컬럼(deleted_at/phone), `platform_create_organization`, `provision_member` cross-org 확장 | Create |
| `hooks/reactquery/platform/apis.ts` | 조직 CUD API 함수 + 목록 deleted_at 필터 | Modify |
| `hooks/reactquery/platform/apis.test.ts` | 위 함수 단위 테스트 | Modify |
| `lib/auth/password.ts` | 임시 비밀번호 생성 유틸 | Create |
| `app/api/platform/organizations/route.ts` | 조직 입점(+owner) Route Handler | Create |
| `hooks/reactquery/platform/mutations.ts` | 조직 CUD React Query mutation | Modify |
| `hooks/reactquery/platform/keys.ts` | (변경 없음 — `organizations()` 재사용) | — |
| `components/forms/schema/platformOrganization.ts` | 입점/수정 zod 스키마 | Create |
| `app/(platform-admin)/platform-admin/organizations/components/OrgFormModal.tsx` | 입점/수정 모달(모드 분기) | Create |
| `app/(platform-admin)/platform-admin/organizations/components/OrgRowActions.tsx` | 행 액션(수정·해지·복구) | Create |
| `app/(platform-admin)/platform-admin/organizations/page.tsx` | 입점 버튼·행 액션·해지포함 토글 배선 | Modify |

---

## Task 1: 마이그레이션 — organizations 확장 + 조직생성 RPC + provision_member cross-org

**Files:**
- Create: `supabase/migrations/0031_platform_org_cud.sql`

**Interfaces (Produces):**
- `platform_create_organization(p_name text, p_slug text, p_phone text default null) returns organizations`
- `provision_member(..., p_target_org_id bigint default null)` — platform_admin이 `p_target_org_id` 지정 시 해당 org에 멤버 생성; 그 외엔 기존대로 `current_user_org()`.
- `organizations.deleted_at timestamptz`, `organizations.phone text`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 0031_platform_org_cud.sql
-- 통합관리자 조직 CUD(P1): organizations 컬럼 + 조직생성 RPC + provision_member cross-org 확장.
-- 의존: 0000(organizations, audit_log), 0002(provision_member, current_user_org 등), 0011(current_user_is_platform_admin).

-- ── organizations 컬럼 ──
alter table organizations add column if not exists deleted_at timestamptz;
alter table organizations add column if not exists phone      text;

-- ── 조직 생성(운영자 전용, 감사) ──
create or replace function platform_create_organization(
  p_name text, p_slug text, p_phone text default null
) returns organizations language plpgsql security definer set search_path = public as $$
declare v_org organizations;
begin
  if not current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin only';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  insert into organizations(name, slug, phone, status)
    values (trim(p_name), nullif(lower(trim(p_slug)),''), nullif(trim(p_phone),''), 'trial')
    returning * into v_org;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org.id, auth.uid(), 'ORG_CREATE', 'organizations', v_org.id::text,
      jsonb_build_object('name', v_org.name, 'slug', v_org.slug));
  return v_org;
end $$;
revoke execute on function platform_create_organization(text,text,text) from anon, public;
grant  execute on function platform_create_organization(text,text,text) to authenticated;

-- ── provision_member cross-org 확장 ──
-- 파라미터 추가(시그니처 변경)이므로 기존 10-arg를 drop 후 11-arg로 재생성.
-- route.ts는 named param 호출이라 p_target_org_id 미지정 시 default null → staff 동작 불변.
drop function if exists provision_member(uuid,text,text,text,text,org_member_role,staff_type,jsonb,text,bigint[]);
create or replace function provision_member(
  p_user_id uuid, p_username text, p_full_name text, p_phone text, p_phone_sub text,
  p_role org_member_role, p_staff_type staff_type, p_permissions jsonb,
  p_affiliation text, p_role_ids bigint[], p_target_org_id bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  -- platform_admin이 대상 org를 지정하면 cross-org; 아니면 호출자 org(기존).
  if current_user_is_platform_admin() and p_target_org_id is not null then
    v_org := p_target_org_id;
  else
    v_org := current_user_org();
  end if;
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
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
revoke execute on function provision_member(uuid,text,text,text,text,org_member_role,staff_type,jsonb,text,bigint[],bigint) from anon;
```

- [ ] **Step 2: 커밋 직전 마이그 번호 재확인**

Run: `git fetch origin && git ls-tree -r origin/master --name-only supabase/migrations | sort | tail -3`
Expected: `origin/master`의 최대 번호 확인. `0031` 이상이 이미 있으면 파일을 다음 번호로 리네임하고 헤더 주석 갱신.

- [ ] **Step 3: 로컬 문법 검증(선택, 가능 시)**

로컬 supabase가 없으면 이 단계는 사용자 라이브 적용 시 검증. `create or replace` 문법·enum 문자열 확인. **DB 라이브 적용은 사용자 PC 담당**(Claude/codex는 네트워크 불가).

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0031_platform_org_cud.sql
git commit -m "feat(platform-admin): 조직 CUD 마이그(deleted_at/phone·조직생성 RPC·provision_member cross-org)"
```

---

## Task 2: apis.ts — 조직 CUD 함수 + 목록 deleted_at 필터

**Files:**
- Modify: `hooks/reactquery/platform/apis.ts`
- Test: `hooks/reactquery/platform/apis.test.ts`

**Interfaces:**
- Consumes: 기존 `PlatformOrganization`, `createClient`.
- Produces:
  - `interface CreateOrgInput { name: string; slug: string; phone?: string | null; owner: { username: string; fullName: string; phone?: string | null } }`
  - `interface CreateOrgResult { organization: { id: number; name: string; slug: string | null }; owner: { username: string; tempPassword: string } }`
  - `createPlatformOrganization(input: CreateOrgInput): Promise<CreateOrgResult>` — `POST /api/platform/organizations` fetch.
  - `interface UpdateOrgInput { name: string; slug: string; phone?: string | null }`
  - `updatePlatformOrganization(id: number, input: UpdateOrgInput): Promise<void>` — `.from("organizations").update({name, slug, phone}).eq("id", id)`.
  - `setPlatformOrganizationDeleted(id: number, deleted: boolean): Promise<void>` — `.update({ deleted_at: deleted ? new Date().toISOString() : null })`.
  - `listPlatformOrganizations(opts?: { includeDeleted?: boolean }): Promise<PlatformOrganization[]>` — 기존에 `deleted_at` 필터 추가(`includeDeleted`가 아니면 `.is("deleted_at", null)`).

- [ ] **Step 1: 목록 필터 실패 테스트 추가**

`apis.test.ts`에 추가(기존 organizations mock의 `select().order()` 체인 사이에 `is`가 끼도록 mock 확장):

```ts
it("listPlatformOrganizations는 기본적으로 deleted_at is null만 조회한다", async () => {
  const order = vi.fn().mockResolvedValue({ data: [], error: null });
  const is = vi.fn(() => ({ order }));
  from.mockImplementation((table: string) => {
    if (table === "organizations") return { select: () => ({ is }) };
    if (table === "org_members") return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    if (table === "point_transactions") return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    return { select: () => ({ is: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
  });
  await listPlatformOrganizations();
  expect(is).toHaveBeenCalledWith("deleted_at", null);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run hooks/reactquery/platform/apis.test.ts -t "deleted_at is null"`
Expected: FAIL (현재 `listPlatformOrganizations`는 `is` 미호출).

- [ ] **Step 3: apis.ts 수정**

`listPlatformOrganizations`의 organizations 쿼리에 `deleted_at` 필터 추가하고 시그니처에 `opts` 추가:

```ts
export async function listPlatformOrganizations(
  opts: { includeDeleted?: boolean } = {},
): Promise<PlatformOrganization[]> {
  const supabase = createClient();
  let orgQuery = supabase
    .from("organizations")
    .select("id, name, slug, status, created_at");
  if (!opts.includeDeleted) orgQuery = orgQuery.is("deleted_at", null);
  const [organizations, members, buildings, points] = await Promise.all([
    orgQuery.order("created_at", { ascending: false }),
    supabase.from("org_members").select("org_id"),
    supabase.from("buildings").select("org_id").is("deleted_at", null),
    supabase.from("point_transactions").select("org_id, points"),
  ]);
  // …기존 매핑 유지…
}
```

그리고 CUD 함수 추가:

```ts
export interface CreateOrgInput {
  name: string; slug: string; phone?: string | null;
  owner: { username: string; fullName: string; phone?: string | null };
}
export interface CreateOrgResult {
  organization: { id: number; name: string; slug: string | null };
  owner: { username: string; tempPassword: string };
}
export async function createPlatformOrganization(input: CreateOrgInput): Promise<CreateOrgResult> {
  const res = await fetch("/api/platform/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "조직 생성에 실패했습니다.");
  return json as CreateOrgResult;
}

export interface UpdateOrgInput { name: string; slug: string; phone?: string | null }
export async function updatePlatformOrganization(id: number, input: UpdateOrgInput): Promise<void> {
  const { error } = await createClient()
    .from("organizations")
    .update({ name: input.name, slug: input.slug || null, phone: input.phone || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
export async function setPlatformOrganizationDeleted(id: number, deleted: boolean): Promise<void> {
  const { error } = await createClient()
    .from("organizations")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: update 함수 테스트 추가**

```ts
it("updatePlatformOrganization은 name/slug/phone을 update한다", async () => {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  from.mockImplementation(() => ({ update }));
  await updatePlatformOrganization(7, { name: "새이름", slug: "newslug", phone: "021234" });
  expect(update).toHaveBeenCalledWith({ name: "새이름", slug: "newslug", phone: "021234" });
  expect(eq).toHaveBeenCalledWith("id", 7);
});

it("setPlatformOrganizationDeleted(false)는 deleted_at을 null로 되돌린다", async () => {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  from.mockImplementation(() => ({ update }));
  await setPlatformOrganizationDeleted(7, false);
  expect(update).toHaveBeenCalledWith({ deleted_at: null });
});
```

- [ ] **Step 5: 전체 테스트 통과 확인**

Run: `npx vitest run hooks/reactquery/platform/apis.test.ts`
Expected: PASS (신규 3건 포함 전건).

- [ ] **Step 6: 커밋**

```bash
git add hooks/reactquery/platform/apis.ts hooks/reactquery/platform/apis.test.ts
git commit -m "feat(platform-admin): 조직 CUD API(생성 fetch·수정·해지/복구·목록 deleted_at 필터)"
```

---

## Task 3: 임시비번 유틸 + 조직 입점 Route Handler

**Files:**
- Create: `lib/auth/password.ts`
- Create: `app/api/platform/organizations/route.ts`
- Test: `lib/auth/password.test.ts`

**Interfaces:**
- Consumes: `createClient`(server), `createAdminClient`, `loginEmail`, RPC `platform_create_organization`·`provision_member`(p_target_org_id).
- Produces: `POST /api/platform/organizations` → 201 `{ organization, owner:{username, tempPassword} }`. 401/403/409/422/500 에러 `{error}`.

- [ ] **Step 1: 임시비번 유틸 테스트**

```ts
// lib/auth/password.test.ts
import { describe, expect, it } from "vitest";
import { generateTempPassword } from "./password";
describe("generateTempPassword", () => {
  it("최소 12자이며 호출마다 다르다", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a.length).toBeGreaterThanOrEqual(12);
    expect(a).not.toEqual(b);
  });
});
```

- [ ] **Step 2: 실패 확인 → 구현**

Run: `npx vitest run lib/auth/password.test.ts` → FAIL(모듈 없음).

```ts
// lib/auth/password.ts
import { randomBytes } from "crypto";
// 서버 전용 임시 비밀번호(16자, URL-safe). 최초 로그인 시 must_change_password=true로 변경 유도.
export function generateTempPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}
```

Run 재실행 → PASS.

- [ ] **Step 3: Route Handler 작성**

`app/api/accounts/route.ts` 패턴을 따른다. 3스텝 + 보상.

```ts
// app/api/platform/organizations/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginEmail } from "@/lib/auth/email";
import { generateTempPassword } from "@/lib/auth/password";

export async function POST(req: Request) {
  const supabase = await createClient();

  // 1) 인증 + platform_admin 인가
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: isPa } = await supabase.rpc("current_user_is_platform_admin");
  if (!isPa) return NextResponse.json({ error: "통합관리자 권한이 필요합니다." }, { status: 403 });

  // 2) 검증
  const body = await req.json().catch(() => null);
  const { name, slug, phone, owner } = body ?? {};
  if (!name || !slug || !owner?.username || !owner?.fullName)
    return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 422 });

  // 3a) 조직 생성(RPC)
  const { data: org, error: orgErr } = await supabase.rpc("platform_create_organization", {
    p_name: name, p_slug: slug, p_phone: phone ?? null,
  });
  if (orgErr || !org) {
    const dup = /duplicate|unique|slug/i.test(orgErr?.message ?? "");
    return NextResponse.json(
      { error: dup ? "이미 존재하는 회사코드입니다." : "조직 생성에 실패했습니다." },
      { status: dup ? 409 : 500 });
  }
  const orgRow = Array.isArray(org) ? org[0] : org;

  // 3b) owner Auth user
  const admin = createAdminClient();
  const email = loginEmail(slug, owner.username);
  const tempPassword = generateTempPassword();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true,
  });
  if (createErr || !created?.user) {
    await admin.from("organizations").delete().eq("id", orgRow.id); // 보상
    const dup = /already|exists|registered/i.test(createErr?.message ?? "");
    return NextResponse.json(
      { error: dup ? "이미 존재하는 아이디입니다." : "관리자 계정 생성에 실패했습니다." },
      { status: dup ? 409 : 500 });
  }

  // 3c) owner provision(cross-org)
  const { error: rpcErr } = await supabase.rpc("provision_member", {
    p_user_id: created.user.id, p_username: owner.username, p_full_name: owner.fullName,
    p_phone: owner.phone ?? null, p_phone_sub: null,
    p_role: "org_owner", p_staff_type: "manager_staff", p_permissions: [],
    p_affiliation: null, p_role_ids: null, p_target_org_id: orgRow.id,
  });
  if (rpcErr) {
    await admin.auth.admin.deleteUser(created.user.id);       // 보상
    await admin.from("organizations").delete().eq("id", orgRow.id); // 보상
    return NextResponse.json({ error: "관리자 계정 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(
    { organization: { id: orgRow.id, name: orgRow.name, slug: orgRow.slug },
      owner: { username: owner.username, tempPassword } },
    { status: 201 });
}
```

- [ ] **Step 4: 빌드·수동 확인**

Run: `npx tsc --noEmit` → 타입 에러 0. Route 로직은 라이브 DB 필요이므로 사용자 환경에서 수동 검증(입점 후 임시비번 노출·owner 로그인).

- [ ] **Step 5: 커밋**

```bash
git add lib/auth/password.ts lib/auth/password.test.ts app/api/platform/organizations/route.ts
git commit -m "feat(platform-admin): 조직 입점 Route Handler(owner 동시 발급·보상)"
```

---

## Task 4: React Query mutation

**Files:**
- Modify: `hooks/reactquery/platform/mutations.ts`

**Interfaces:**
- Consumes: `createPlatformOrganization`·`updatePlatformOrganization`·`setPlatformOrganizationDeleted`(Task 2), `platformKeys.organizations()`, `platformKeys.overview()`.
- Produces: `useCreatePlatformOrganization()`·`useUpdatePlatformOrganization()`·`useSetOrgDeleted()`. 성공 시 `organizations()`·`overview()` invalidate.

- [ ] **Step 1: mutation 추가**

```ts
import {
  chargePoints, updateOrganizationStatus,
  createPlatformOrganization, updatePlatformOrganization, setPlatformOrganizationDeleted,
  type ChargePointsInput, type OrganizationStatus,
  type CreateOrgInput, type UpdateOrgInput,
} from "./apis";

export function useCreatePlatformOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrgInput) => createPlatformOrganization(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformKeys.organizations() });
      void qc.invalidateQueries({ queryKey: platformKeys.overview() });
    },
  });
}
export function useUpdatePlatformOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateOrgInput }) =>
      updatePlatformOrganization(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.organizations() }),
  });
}
export function useSetOrgDeleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleted }: { id: number; deleted: boolean }) =>
      setPlatformOrganizationDeleted(id, deleted),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformKeys.organizations() });
      void qc.invalidateQueries({ queryKey: platformKeys.overview() });
    },
  });
}
```

- [ ] **Step 2: 타입 확인 + 커밋**

Run: `npx tsc --noEmit` → PASS.

```bash
git add hooks/reactquery/platform/mutations.ts
git commit -m "feat(platform-admin): 조직 CUD mutation 훅"
```

---

## Task 5: zod 스키마 + 입점/수정 모달

**Files:**
- Create: `components/forms/schema/platformOrganization.ts`
- Create: `app/(platform-admin)/platform-admin/organizations/components/OrgFormModal.tsx`

**Interfaces:**
- Consumes: `Modal`·`Input`·`Button`(`@/components/common`), react-hook-form + zodResolver (패턴: `points/components/PointChargeModal.tsx`).
- Produces: `OrgFormModal` — `mode: "create" | "edit"`. create는 owner 필드 포함, edit는 회사정보만. `onSubmit(values)` Promise, 성공 후 닫힘.

- [ ] **Step 1: zod 스키마**

```ts
// components/forms/schema/platformOrganization.ts
import { z } from "zod";

const slug = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9-]{2,30}$/, "회사코드는 영문 소문자·숫자·하이픈 2~30자입니다");

export const orgCreateSchema = z.object({
  name: z.string().trim().min(1, "회사명을 입력해 주세요").max(100),
  slug,
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  ownerUsername: z.string().trim().min(1, "관리자 아이디를 입력해 주세요").max(50),
  ownerFullName: z.string().trim().min(1, "관리자 이름을 입력해 주세요").max(50),
  ownerPhone: z.string().trim().max(20).optional().or(z.literal("")),
});
export type OrgCreateFormValues = z.output<typeof orgCreateSchema>;

export const orgEditSchema = z.object({
  name: z.string().trim().min(1, "회사명을 입력해 주세요").max(100),
  slug,
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});
export type OrgEditFormValues = z.output<typeof orgEditSchema>;
```

- [ ] **Step 2: OrgFormModal 컴포넌트**

`PointChargeModal.tsx`의 구조(Modal + useForm + zodResolver + Button)를 따른다. `mode="create"`면 `orgCreateSchema`와 owner 필드(아이디·이름·연락처)를 렌더, `mode="edit"`면 `orgEditSchema`와 회사정보만 + `defaultValues`로 기존 값 주입. 필드: 회사명·회사코드(slug)·연락처(+create 시 관리자 아이디·이름·연락처). 제출 버튼 라벨: create="입점 등록", edit="저장". 유효성 에러는 각 필드 아래 `text-danger`로.

- [ ] **Step 3: 타입·빌드 확인 + 커밋**

Run: `npx tsc --noEmit` → PASS.

```bash
git add components/forms/schema/platformOrganization.ts "app/(platform-admin)/platform-admin/organizations/components/OrgFormModal.tsx"
git commit -m "feat(platform-admin): 조직 입점/수정 스키마·모달"
```

---

## Task 6: 화면 배선 — 입점 버튼·행 액션·해지포함 토글

**Files:**
- Create: `app/(platform-admin)/platform-admin/organizations/components/OrgRowActions.tsx`
- Modify: `app/(platform-admin)/platform-admin/organizations/page.tsx`

**Interfaces:**
- Consumes: `OrgFormModal`(Task 5), `useCreatePlatformOrganization`·`useUpdatePlatformOrganization`·`useSetOrgDeleted`(Task 4), `usePlatformOrganizations`(includeDeleted 반영), `toast`(sonner).
- Produces: 조직 화면 CUD 상호작용.

- [ ] **Step 1: `usePlatformOrganizations`에 includeDeleted 전달 경로 확인**

`hooks/reactquery/platform/queries.ts`의 `usePlatformOrganizations`가 `opts`를 받도록 수정(없으면 추가): `useQuery({ queryKey: platformKeys.organizations(), queryFn: () => listPlatformOrganizations(opts) })` — includeDeleted가 바뀌면 별도 쿼리키가 되도록 `platformKeys.organizations()`에 플래그 반영하거나 클라이언트 필터. **간단화**: 목록은 항상 `includeDeleted:true`로 불러와 클라이언트에서 `showDeleted` 상태로 필터(추가 쿼리키 불필요). 해지 조직도 즉시 토글 표시 가능.

- [ ] **Step 2: OrgRowActions 컴포넌트**

행별 드롭다운/버튼: **수정**(OrgFormModal edit 오픈), **해지**(확인 후 `useSetOrgDeleted({id, deleted:true})`), 해지된 행은 **복구**(`deleted:false`). `deleted_at` 유무로 분기. 액션 후 `toast.success`.

- [ ] **Step 3: page.tsx 배선**

- 상단 헤더에 **[입점] 버튼** → `OrgFormModal mode="create"`. 제출 시 `useCreatePlatformOrganization`; 성공하면 반환된 `owner.tempPassword`를 **복사 가능한 안내 모달/토스트**로 1회 노출("아이디: {username} / 임시비밀번호: {tempPassword} — 안전히 전달하세요").
- 목록에 **[해지 포함]** 체크박스(`showDeleted` state). 해지 행은 흐리게 + 상태 뱃지에 "해지" 표기.
- 각 행 우측에 `OrgRowActions`. 기존 `OrgStatusControl`(상태변경) 유지.
- `listPlatformOrganizations({ includeDeleted: true })`로 불러오고, `showDeleted`가 false면 `deleted_at == null`만 렌더.

- [ ] **Step 4: 빌드·수동 확인**

Run: `npx tsc --noEmit && npx vitest run` → 타입 0·테스트 전건 통과. UI 동작은 라이브 환경에서 수동(입점→목록 반영→수정→해지→복구).

- [ ] **Step 5: 커밋**

```bash
git add "app/(platform-admin)/platform-admin/organizations/"
git commit -m "feat(platform-admin): 조직 입점·수정·해지/복구 화면 배선"
```

---

## Self-Review (spec 대비)

- **조직 생성(+owner 동시)**: Task 1(RPC)·Task 3(Route)·Task 5·6(UI) ✓
- **정보수정**: Task 2(update)·Task 5·6 ✓
- **해지(soft-delete)/복구**: Task 1(deleted_at)·Task 2(setDeleted)·Task 6 ✓
- **상태변경(기존)**: 유지 ✓
- **cross-org owner provision**: Task 1(provision_member 확장) ✓ — staff 하위호환(named param default) ✓
- **감사**: platform_create_organization·provision_member audit_log ✓
- **phone 컬럼**: Task 1·2·5 ✓
- **목록 deleted_at 필터**: Task 2·6 ✓
- **마이그 번호 함정**: Global Constraints + Task 1 Step 2 ✓

**범위 밖(이 플랜 제외, 후속)**: 계정 CUD의 나머지 RPC 확장(`admin_set_member_permissions`·`admin_set_active`·`admin_update_member_basic`)·platform_admin 임명 가드·비번초기화 → **Plan 2(P2 계정 CUD)**. 포인트 조정 → **Plan 3(P3)**.

**미해결 확인 필요**: 없음(모든 인터페이스가 Task 내 정의됨). Route Handler는 라이브 DB 필요라 단위테스트 대신 tsc+수동.

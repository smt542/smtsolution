# 통합관리자 계정 CUD (P2) 구현 계획

> **For agentic workers:** codex 위임 워크플로우(CLAUDE.md). 각 Task를 위임/직접 구현하고 Claude가 리뷰. 체크박스(`- [ ]`)로 추적.
> 선행: spec `2026-08-12-platform-admin-cud-design.md`(§P2) · Plan 1 `2026-08-18-platform-admin-org-cud.md`(완료, 마이그 0032).

**Goal:** 통합관리자(platform_admin)가 임의 org의 계정을 발급·권한(role)변경·활성/비활성·비밀번호 초기화하고, `platform_admin` 자가승격을 차단한다.

**Architecture:** 기존 계정 RPC(`admin_set_member_permissions`·`admin_set_active`)를 `p_target_org_id`로 cross-org 확장(staff 하위호환). 계정 발급·비번초기화는 service_role이 필요해 platform 전용 Route Handler로. 화면은 기존 `/platform-admin/accounts`(전체 org 계정 조회)에 발급 버튼 + 행 액션을 얹는다(행마다 `orgId` 보유).

**Tech Stack:** Next.js · Supabase RPC/Auth Admin · React Query · react-hook-form + zod · vitest.

## Global Constraints

- **role enum**: `platform_admin`·`org_owner`·`manager`·`staff`·`field`·`tenant`. staff_type: `manager_staff`·`field_staff`·`support_staff`·`tenant`.
- **마이그 번호**: Plan 1 = `0032`. P2 잠정 `0033`. ⚠️ 커밋 직전 `git fetch` 후 `origin/master` max 재확인(병렬 선점 함정).
- **하위호환 필수**: staff `/accounts`(`hooks/reactquery/accounts/apis.ts`의 `updatePermissions`/`setActive`)는 `p_target_org_id`를 넘기지 않으므로, RPC 파라미터는 **끝에 `default null`로 추가**하고 drop→recreate.
- **보안**: `platform_admin` role 부여/변경은 **호출자가 platform_admin일 때만**(자가승격 차단). 최소 1 마스터 유지 로직 보존.
- **인가**: platform route는 `current_user_is_platform_admin` 확인 후 service_role(admin client) 사용.
- **테스트**: vitest, `vi.mock("@/lib/supabase/client")` 패턴.
- **커밋**: `feat(platform-admin): …` + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## 파일 구조

| 파일 | 책임 | 액션 |
|---|---|---|
| `supabase/migrations/0033_platform_account_cud.sql` | `admin_set_member_permissions`·`admin_set_active` cross-org 확장 + platform_admin 임명 가드 | Create |
| `hooks/reactquery/platform/accounts.ts` | platform 계정 CUD API(발급 fetch·권한·활성·비번) | Create |
| `hooks/reactquery/platform/accounts.test.ts` | 위 단위 테스트 | Create |
| `hooks/reactquery/platform/mutations.ts` | platform 계정 mutation 훅 추가 | Modify |
| `hooks/reactquery/platform/queries.ts` | `usePlatformAccounts`가 목록 갱신되도록(불변 — invalidate는 mutations에서) | — |
| `hooks/reactquery/platform/apis.ts` | `PlatformAccount`에 `staffType`·`permissions` 추가 매핑(권한변경 초기값) | Modify |
| `app/api/platform/accounts/route.ts` | 계정 발급 POST(org 지정, owner 외 role) | Create |
| `app/api/platform/accounts/[userId]/password/route.ts` | 비밀번호 초기화 PATCH | Create |
| `components/forms/schema/platformAccount.ts` | 발급/권한 zod 스키마 | Create |
| `app/(platform-admin)/platform-admin/accounts/components/AccountCreateModal.tsx` | 발급 모달(org 선택 + 계정) | Create |
| `app/(platform-admin)/platform-admin/accounts/components/AccountRowActions.tsx` | 행 액션(권한변경·활성·비번) | Create |
| `app/(platform-admin)/platform-admin/accounts/page.tsx` | 발급 버튼·행 액션 배선 | Modify |

---

## Task 1: 마이그 — 계정 RPC cross-org 확장 + platform_admin 임명 가드

**Files:** Create `supabase/migrations/0033_platform_account_cud.sql`

**Interfaces (Produces):**
- `admin_set_member_permissions(p_user_id, p_role, p_staff_type, p_permissions, p_role_ids, p_target_org_id bigint default null)`
- `admin_set_active(p_user_id, p_active, p_target_org_id bigint default null)`

- [ ] **Step 1: SQL 작성** (기존 본문은 `0002_p2a_accounts_permissions.sql` 기준, cross-org 분기와 임명 가드만 추가)

```sql
-- 0033_platform_account_cud.sql
-- 통합관리자 계정 CUD(P2): admin_set_member_permissions/admin_set_active cross-org 확장 + platform_admin 임명 가드.
-- 의존: 0002(원본 RPC·current_user_org·current_user_is_master·current_user_has_module), 0011(current_user_is_platform_admin).

-- ── 권한/역할 변경: cross-org + platform_admin 임명 가드 ──
drop function if exists admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[]);
create or replace function admin_set_member_permissions(
  p_user_id uuid, p_role org_member_role, p_staff_type staff_type,
  p_permissions jsonb, p_role_ids bigint[], p_target_org_id bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_other_masters int; v_is_pa boolean;
begin
  v_is_pa := current_user_is_platform_admin();
  if v_is_pa and p_target_org_id is not null then
    v_org := p_target_org_id;                 -- platform_admin cross-org
  else
    if not current_user_is_master() then raise exception 'forbidden: master only'; end if;
    v_org := current_user_org();              -- 기존 staff 경로
  end if;
  -- platform_admin 자가승격 차단: platform_admin 부여는 platform_admin만
  if p_role = 'platform_admin' and not v_is_pa then
    raise exception 'forbidden: platform_admin assignment requires platform_admin';
  end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  -- 최소 1 마스터 유지(본인 강등 방지)
  if p_user_id = auth.uid() and p_role not in ('org_owner','platform_admin') then
    select count(*) into v_other_masters from org_members
      where org_id = v_org and role in ('org_owner','platform_admin') and user_id <> p_user_id;
    if v_other_masters = 0 then raise exception 'must keep at least one master'; end if;
  end if;
  update org_members set role = p_role, staff_type = p_staff_type,
    feature_permissions = coalesce(p_permissions,'[]'::jsonb)
    where user_id = p_user_id and org_id = v_org;
  if p_role_ids is not null then
    delete from org_member_roles where user_id = p_user_id and org_id = v_org;
    insert into org_member_roles(org_id,user_id,role_id) select v_org,p_user_id,unnest(p_role_ids); end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PERMISSION_CHANGE', 'org_members', p_user_id::text,
      jsonb_build_object('role',p_role,'staff_type',p_staff_type,'permissions',p_permissions));
end $$;
revoke execute on function admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[],bigint) from anon;

-- ── 활성/비활성: cross-org ──
drop function if exists admin_set_active(uuid,boolean);
create or replace function admin_set_active(
  p_user_id uuid, p_active boolean, p_target_org_id bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  if current_user_is_platform_admin() and p_target_org_id is not null then
    v_org := p_target_org_id;
  else
    if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
    v_org := current_user_org();
  end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  update profiles set is_active = p_active where user_id = p_user_id;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), case when p_active then 'ACCOUNT_ACTIVATE' else 'ACCOUNT_DEACTIVATE' end,
      'profiles', p_user_id::text, jsonb_build_object('is_active',p_active));
end $$;
revoke execute on function admin_set_active(uuid,boolean,bigint) from anon;
```

- [ ] **Step 2: 마이그 번호 재확인** — `git fetch origin && git ls-tree -r origin/master --name-only supabase/migrations | sort | tail -3`. 충돌 시 리네임.
- [ ] **Step 3: 커밋** — `git add supabase/migrations/0033_platform_account_cud.sql && git commit -m "feat(platform-admin): 계정 RPC cross-org 확장·platform_admin 임명 가드 마이그 0033"`

> DB 라이브 적용은 사용자 PC 담당.

---

## Task 2: platform 계정 API + 테스트

**Files:** Create `hooks/reactquery/platform/accounts.ts`, `hooks/reactquery/platform/accounts.test.ts`

**Interfaces (Produces):**
- `interface PlatformCreateAccountInput { orgId: number; username: string; password: string; fullName: string; phone?: string | null; role: "org_owner" | "manager" | "staff"; staffType: "manager_staff" | "field_staff" | "support_staff" }`
- `createPlatformAccount(input): Promise<{ userId: string }>` — `POST /api/platform/accounts`.
- `platformUpdateRole(orgId: number, userId: string, role: OrgMemberRole, staffType: StaffType, permissions: string[]): Promise<void>` — rpc `admin_set_member_permissions` with `p_target_org_id: orgId`, `p_role_ids: null`.
- `platformSetActive(orgId: number, userId: string, active: boolean): Promise<void>` — rpc `admin_set_active` with `p_target_org_id: orgId`.
- `platformResetPassword(userId: string, password: string): Promise<void>` — `PATCH /api/platform/accounts/{userId}/password`.

- [ ] **Step 1: 실패 테스트**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
import { platformUpdateRole, platformSetActive } from "./accounts";
beforeEach(() => vi.clearAllMocks());

describe("platform account apis", () => {
  it("platformUpdateRole은 target org와 함께 admin_set_member_permissions를 호출한다", async () => {
    rpc.mockResolvedValue({ error: null });
    await platformUpdateRole(7, "u1", "manager", "manager_staff", []);
    expect(rpc).toHaveBeenCalledWith("admin_set_member_permissions", {
      p_user_id: "u1", p_role: "manager", p_staff_type: "manager_staff",
      p_permissions: [], p_role_ids: null, p_target_org_id: 7,
    });
  });
  it("platformSetActive는 target org와 함께 admin_set_active를 호출한다", async () => {
    rpc.mockResolvedValue({ error: null });
    await platformSetActive(7, "u1", false);
    expect(rpc).toHaveBeenCalledWith("admin_set_active", { p_user_id: "u1", p_active: false, p_target_org_id: 7 });
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run hooks/reactquery/platform/accounts.test.ts` → FAIL(모듈 없음).
- [ ] **Step 3: 구현** — `accounts/apis.ts`의 `updatePermissions`/`setActive` 패턴에 `p_target_org_id`를 더한 형태. `createPlatformAccount`/`platformResetPassword`는 fetch. (rpc 에러 시 throw new Error(error.message))
- [ ] **Step 4: 통과 확인** — `npx vitest run hooks/reactquery/platform/accounts.test.ts` → PASS.
- [ ] **Step 5: 커밋** — `feat(platform-admin): platform 계정 API(발급·권한·활성·비번)`

---

## Task 3: Route Handlers — 계정 발급 + 비밀번호 초기화

**Files:** Create `app/api/platform/accounts/route.ts`, `app/api/platform/accounts/[userId]/password/route.ts`

**Interfaces:** Consumes `createAdminClient`·`loginEmail`·`generateTempPassword`·rpc `provision_member`(p_target_org_id, Plan1). Produces `POST /api/platform/accounts` → 201 `{ userId }`; `PATCH …/{userId}/password` → 200 `{ ok:true }`.

- [ ] **Step 1: 발급 POST** — `app/api/platform/organizations/route.ts`(Plan1) 패턴 재사용:
  - platform_admin 인가 확인.
  - body: `{ orgId, username, password?, fullName, phone?, role, staffType }`. password 없으면 `generateTempPassword()`.
  - 대상 org의 slug 조회(`organizations.slug`, admin client) → `loginEmail(slug, username)`.
  - `admin.auth.admin.createUser({email, password, email_confirm:true})`.
  - `supabase.rpc("provision_member", { p_user_id, p_username, p_full_name, p_phone, p_phone_sub:null, p_role, p_staff_type, p_permissions:[], p_affiliation:null, p_role_ids:null, p_target_org_id: orgId })`.
  - 실패 시 `admin.auth.admin.deleteUser` 보상. 201 `{ userId, tempPassword? }`(password 미입력 시 tempPassword 반환).

- [ ] **Step 2: 비번 PATCH** — `app/api/accounts/[userId]/route.ts` 패턴이되 인가를 platform_admin으로, org 확인은 `org_members` 존재로:

```ts
// app/api/platform/accounts/[userId]/password/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: isPa } = await supabase.rpc("current_user_is_platform_admin");
  if (!isPa) return NextResponse.json({ error: "통합관리자 권한이 필요합니다." }, { status: 403 });

  const { password } = await req.json().catch(() => ({}));
  if (!password || String(password).length < 4)
    return NextResponse.json({ error: "비밀번호는 4자 이상 입력해 주세요." }, { status: 422 });

  const admin = createAdminClient();
  // 대상이 실제 org 구성원인지(고아 uid 차단)
  const { count } = await admin.from("org_members").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  if (!count) return NextResponse.json({ error: "대상 계정을 찾을 수 없습니다." }, { status: 404 });

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 3: tsc + 커밋** — `npx tsc --noEmit` → 0. `feat(platform-admin): 계정 발급·비번초기화 Route Handler`

---

## Task 4: platform 계정 mutation 훅 + PlatformAccount 매핑 보강

**Files:** Modify `hooks/reactquery/platform/mutations.ts`, `hooks/reactquery/platform/apis.ts`

- [ ] **Step 1: apis.ts** — `PlatformAccount`에 `staffType: StaffType`·`permissions: string[]` 추가하고 `listPlatformAccounts`에서 `org_members.staff_type`·`feature_permissions` select·매핑(권한변경 모달 초기값). `apis.test.ts`의 계정 테스트는 `objectContaining`이라 회귀 없음(필요 시 mock 보강).
- [ ] **Step 2: mutations.ts** — 추가:

```ts
export function useCreatePlatformAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlatformCreateAccountInput) => createPlatformAccount(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.accounts() }),
  });
}
export function usePlatformUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { orgId: number; userId: string; role: OrgMemberRole; staffType: StaffType; permissions: string[] }) =>
      platformUpdateRole(a.orgId, a.userId, a.role, a.staffType, a.permissions),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.accounts() }),
  });
}
export function usePlatformSetActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { orgId: number; userId: string; active: boolean }) => platformSetActive(a.orgId, a.userId, a.active),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.accounts() }),
  });
}
export function usePlatformResetPassword() {
  return useMutation({
    mutationFn: (a: { userId: string; password: string }) => platformResetPassword(a.userId, a.password),
  });
}
```

- [ ] **Step 3: tsc + 커밋** — `feat(platform-admin): platform 계정 mutation 훅 + PlatformAccount 매핑`

---

## Task 5: 발급 스키마 + 발급 모달 + 행 액션 컴포넌트

**Files:** Create `components/forms/schema/platformAccount.ts`, `app/(platform-admin)/platform-admin/accounts/components/AccountCreateModal.tsx`, `.../AccountRowActions.tsx`

- [ ] **Step 1: zod 스키마** — `platformAccountCreateSchema`: `orgId`(coerce number positive), `username`(min1), `password`(optional min4 — 빈값이면 서버 임시비번), `fullName`(min1), `phone`(optional), `role`(enum org_owner/manager/staff), `staffType`(enum manager_staff/field_staff/support_staff). 한국어 메시지.
- [ ] **Step 2: AccountCreateModal** — `PointChargeModal`/`OrgFormModal` 패턴. org 드롭다운(활성 조직 = `usePlatformOrganizations`에서 `deletedAt==null && status!=='suspended'`), 아이디·비번(선택)·이름·연락처·role·staffType select. 성공 시 tempPassword 있으면 부모가 노출.
- [ ] **Step 3: AccountRowActions** — props `{ account: PlatformAccount; onChangeRole: ()=>void; onToggleActive: ()=>void; onResetPassword: ()=>void; isPending }`. 버튼: **권한변경**(role 드롭다운 or 모달 트리거), **활성/비활성**(현재 isActive 토글), **비번초기화**(confirm → 새 임시비번 노출). platform_admin 대상은 role 강등 시 주의 문구.
- [ ] **Step 4: tsc + 커밋** — `feat(platform-admin): 계정 발급 스키마·모달·행 액션`

---

## Task 6: 계정 화면 배선

**Files:** Modify `app/(platform-admin)/platform-admin/accounts/page.tsx`

- [ ] **Step 1** — 헤더에 **[계정 발급]** 버튼 → `AccountCreateModal`. 성공 시 tempPassword 노출 모달(Plan1 조직 화면과 동일 패턴).
- [ ] **Step 2** — 테이블에 **관리** 열 추가 → `AccountRowActions`(account.orgId·userId로 `usePlatformUpdateRole`·`usePlatformSetActive`·`usePlatformResetPassword`). role은 간단 드롭다운(org_owner/manager/staff; platform_admin 부여는 별도 확인 문구). description 문구도 "계정 발급·권한·활성·비번을 직접 관리합니다"로 갱신.
- [ ] **Step 3: 검증** — `npx tsc --noEmit` → 0; `npx vitest run` → 전건 통과; `npm run build` → 통과. UI 동작은 라이브에서 수동(발급→목록→권한변경→활성토글→비번초기화).
- [ ] **Step 4: 커밋** — `feat(platform-admin): 계정 발급·권한·활성·비번 화면 배선`

---

## Self-Review (spec §P2 대비)

- **계정 발급(cross-org)**: Task 2·3(route+provision_member target)·5·6 ✓
- **권한(role) 변경**: Task 1(RPC 확장)·2·5·6 ✓
- **활성/비활성**: Task 1·2·5·6 ✓
- **비밀번호 초기화**: Task 3(route)·2·5·6 ✓
- **platform_admin 자가승격 차단**: Task 1(임명 가드) ✓ — 기존 벡터(org 마스터가 자신을 platform_admin) 차단
- **staff 하위호환**: Task 1(파라미터 default null, drop→recreate) ✓
- **감사**: 기존 audit_log 유지 ✓

**범위 밖(후속)**: 계정 기본정보(이름/연락처) 수정은 org staff 담당(통합관리자는 role/활성/비번). 포인트 조정 → Plan 3(P3).
**미해결**: 없음(인터페이스 Task 내 정의). Route는 라이브 DB 필요라 tsc+수동 검증.

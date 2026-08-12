# 통합관리자(platform-admin) 포인트 도메인 + Scope A 조정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 이 저장소의 실행 흐름은 **codex 워커 구현 → Claude 검증/커밋**이다([[codex-orchestration-setup]]). 각 Task는 독립적으로 테스트·커밋 가능한 단위이며 체크박스(`- [ ]`)로 추적한다. codex는 파일 작성 + `npx vitest`/`tsc` 실행만, **git 커밋·의존성 설치는 Claude**가 한다.

**Goal:** platform-admin 콘솔을 스펙 §3·§5대로 Scope A(cross-org SaaS 운영자)로 확정하고, 발송 크레딧(포인트) 원장·충전·청구·조직상태관리 도메인을 구현한다.

**Architecture:** 기존 org 격리 RLS(`my_org_ids()`)는 그대로 두고, `current_user_is_platform_admin()` security-definer 함수 기반의 **permissive 예외 정책을 추가**해 platform_admin이 전 org를 조회(organizations/org_members/profiles)·관리(organizations 상태변경, point_transactions 충전)하게 한다. 포인트는 `point_transactions` 단일 원장(charge +/usage −), 잔액은 집계. 화면은 기존 `app/(platform-admin)/` 셸과 `hooks/reactquery/platform/` 도메인을 확장한다.

**Tech Stack:** Next.js(App Router, 이 저장소 전용 fork — `AGENTS.md` 참조), TypeScript, Supabase(Postgres RLS), @tanstack/react-query, react-hook-form + @hookform/resolvers/zod, zod, sonner(toast), 기존 `@/components/common`(Modal/Input/Select/Button/…), vitest.

## Global Constraints

- **DB 순번:** 신규 마이그레이션은 `supabase/migrations/0006_platform_admin.sql`. 현재 트리에 `0000–0003`,`0005` 존재(`0004`=P3a 미머지). **라이브 적용은 P3a `0004` 머지 후 `0004→0005→0006` 순서로**(지금 코드만 작성, 적용 금지).
- **기존 staff/RLS 불변:** 기존 정책(`org_select`/`member_select`/`profile_select` 등)은 건드리지 않고 platform_admin 예외를 **별도 permissive 정책으로 추가**만 한다.
- **enum 재사용:** `org_status`('active'|'suspended'|'trial')·`org_member_role`(…,'platform_admin',…)는 `0000`에 이미 존재 → **새로 만들지 말 것**. 신규 enum은 `point_tx_type`뿐.
- **포인트 부호:** charge = points>0(+amount_krw), usage = points<0(amount_krw null). 잔액 = `sum(points)`.
- **발송 차감(usage)은 P4 발송모듈 몫** — 본 트랙은 스키마 + 운영자 수동 충전까지만. usage INSERT UI 없음.
- **snake_case↔camelCase:** DB row는 snake_case, TS 인터페이스는 camelCase. 기존 `apis.ts` 변환 패턴 준수.
- **공유파일 주의:** `app/(platform-admin)/navItems.ts`는 codex가 임의 수정하는 경향 → nav/copy 변경은 **Claude가 직접**(Task 8). 워커 산출물은 커밋 전 `git diff`로 범위 확인.
- **워크트리:** 작업 경로 `C:/Users/leebj/orca/workspaces/home_erp/platform-admin`, 브랜치 `PracLee/platform-admin`. codex 실행은 `-C <워크트리>`.

---

## File Structure

| 파일 | 책임 | 작성자 |
|---|---|---|
| `supabase/migrations/0006_platform_admin.sql` | 포인트 원장 테이블/enum, `current_user_is_platform_admin()`, cross-org 예외 RLS | **Claude**(보안 SQL) |
| `hooks/reactquery/platform/apis.ts` (수정) | 포인트 잔액/내역/충전 + 조직 상태변경 API, `listPlatformOrganizations`에 `pointBalance` 추가 | codex |
| `hooks/reactquery/platform/keys.ts` (수정) | `transactions` 쿼리키 추가 | codex |
| `hooks/reactquery/platform/queries.ts` (수정) | `usePlatformTransactions` 추가 | codex |
| `hooks/reactquery/platform/mutations.ts` (신규) | `useChargePoints`, `useUpdateOrganizationStatus` | codex |
| `hooks/reactquery/platform/index.ts` (수정) | `export * from "./mutations"` | codex |
| `hooks/reactquery/platform/apis.test.ts` (수정) | 신규 API 단위테스트 | codex |
| `components/forms/schema/pointCharge.ts` (신규) | 충전 폼 zod 스키마 | codex |
| `app/(platform-admin)/platform-admin/points/page.tsx` (수정) | 잔액 목록 + 충전 버튼 + 내역 | codex |
| `app/(platform-admin)/platform-admin/points/components/PointChargeModal.tsx` (신규) | 충전 기록 모달 | codex |
| `app/(platform-admin)/platform-admin/billing/page.tsx` (수정) | charge 결제 내역 | codex |
| `app/(platform-admin)/platform-admin/organizations/page.tsx` (수정) | 포인트잔액 컬럼 + 상태 변경 컨트롤 | codex |
| `app/(platform-admin)/platform-admin/organizations/components/OrgStatusControl.tsx` (신규) | 상태 변경 Select + 확인 + mutation | codex |
| `app/(platform-admin)/platform-admin/page.tsx` (수정) | 총 포인트 잔액 카드 + 최근 충전 | codex |
| `app/(platform-admin)/navItems.ts` (수정) | 라벨/설명 스펙 정렬(결제·구독→청구 관리) | **Claude** |
| `app/(platform-admin)/_components/PageElements.tsx` (수정) | `DataScopeNotice` cross-org 문구 | **Claude** |

**의존 순서:** Task 1(SQL) → Task 2(데이터 계층) → Task 3~7(화면, Task 2에 의존, 상호 독립) → Task 8(nav/copy). 화면 Task들은 서로 다른 파일이라 병렬 가능하나 단일 워크트리·단일 도메인이므로 codex 워커 1개가 순차 처리해도 무방.

---

### Task 1: DB 마이그레이션 0006 (포인트 원장 + cross-org RLS)

**작성자: Claude**(보안 크리티컬 SQL, codex는 SQL 실행 불가). codex는 검증 못 하므로 Claude가 직접 작성·리뷰.

**Files:**
- Create: `supabase/migrations/0006_platform_admin.sql`

**Interfaces:**
- Consumes: `0000`의 `organizations`, `org_members(role org_member_role)`, `profiles`, `auth.users`, `my_org_ids()` 패턴, `set_updated_at()`.
- Produces: 테이블 `point_transactions(id, org_id, type, points, amount_krw, memo, created_by, created_at)`, enum `point_tx_type('charge','usage')`, 함수 `current_user_is_platform_admin() → boolean`, 정책 `pt_platform`/`org_platform_select`/`org_platform_update`/`member_platform_select`/`profile_platform_select`.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 0006_platform_admin.sql
-- 통합관리자(platform-admin) 콘솔 — Scope A(cross-org SaaS 운영자).
-- 발송 크레딧(포인트) 원장 + platform_admin cross-org RLS 예외(기존 staff 정책 불변).
-- 의존: P0(organizations, org_members, profiles, auth.users, my_org_ids, org_member_role/org_status enum).
-- ⚠ 순번: 0004(P3a)·0005(공지/AS) 다음. 라이브 적용은 0004 머지 후 0004→0005→0006 순.

-- ── platform_admin 판별 (security definer: org_members RLS 우회, my_org_ids와 동일 패턴) ──
create or replace function current_user_is_platform_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid()) and m.role = 'platform_admin'
  )
$$;

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
```

- [ ] **Step 2: 정합성 셀프 리뷰(체크리스트)**

  - `point_tx_type` 외 신규 enum 없음(org_status/org_member_role 재사용) ✓
  - 기존 정책 이름과 충돌 없음(신규: `pt_platform`,`org_platform_*`,`member_platform_select`,`profile_platform_select`) ✓
  - `current_user_is_platform_admin()`는 `security definer`+`search_path=public` → org_members RLS 재귀 없음(`my_org_ids()`와 동일 검증된 패턴) ✓
  - Supabase 기본 권한: 신규 public 테이블은 authenticated에 자동 GRANT(0005 notices도 명시 GRANT 없음) → 별도 GRANT 불필요 ✓

- [ ] **Step 3: 빌드 영향 없음 확인**

Run: `npx tsc --noEmit`
Expected: SQL 파일은 TS 컴파일 무관, 통과(기존 상태 유지).

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0006_platform_admin.sql
git commit -m "feat(platform-admin): 0006 포인트 원장 + platform_admin cross-org RLS 예외"
```

---

### Task 2: 플랫폼 데이터 계층 (포인트/청구/조직상태 API + 훅)

**Files:**
- Modify: `hooks/reactquery/platform/apis.ts`
- Modify: `hooks/reactquery/platform/keys.ts`
- Modify: `hooks/reactquery/platform/queries.ts`
- Create: `hooks/reactquery/platform/mutations.ts`
- Modify: `hooks/reactquery/platform/index.ts`
- Test: `hooks/reactquery/platform/apis.test.ts`

**Interfaces:**
- Consumes: `@/lib/supabase/client`의 `createClient()`, Task 1의 `point_transactions`·organizations 스키마, 기존 `OrganizationStatus`/`PlatformOrganization` 타입.
- Produces (later tasks가 사용하는 정확한 시그니처):
  - `export type PointTxType = "charge" | "usage"`
  - `export interface PointTransaction { id: number; orgId: number; organizationName: string; type: PointTxType; points: number; amountKrw: number | null; memo: string | null; createdBy: string | null; createdByName: string | null; createdAt: string }`
  - `export interface ChargePointsInput { orgId: number; points: number; amountKrw: number; memo?: string | null }`
  - `PlatformOrganization`에 `pointBalance: number` 추가
  - `listPointTransactions(opts?: { type?: PointTxType }): Promise<PointTransaction[]>`
  - `chargePoints(input: ChargePointsInput): Promise<void>`
  - `updateOrganizationStatus(id: number, status: OrganizationStatus): Promise<void>`
  - `usePlatformTransactions(opts?: { type?: PointTxType })` → react-query
  - `useChargePoints()`, `useUpdateOrganizationStatus()` → react-query mutations
  - `platformKeys.transactions(opts?)`

- [ ] **Step 1: 실패 테스트 작성 — `apis.test.ts`에 신규 케이스 추가**

기존 `apis.test.ts`의 `from`/`createClient` mock 스타일을 그대로 재사용한다. 파일 상단 import에 신규 함수 추가:

```ts
import {
  getPlatformOverview,
  listPlatformAccounts,
  listPlatformOrganizations,
  listPointTransactions,
  chargePoints,
  updateOrganizationStatus,
} from "./apis";
```

`describe("platform admin apis", ...)` 안에 아래 케이스들을 추가:

```ts
it("조직 목록에 포인트 잔액(sum(points))을 집계한다", async () => {
  from.mockImplementation((table: string) => {
    if (table === "organizations") {
      return {
        select: () => ({
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 1, name: "한빛관리", slug: "hanbit", status: "active", created_at: "2026-01-02T00:00:00Z" },
              { id: 2, name: "새봄관리", slug: null, status: "trial", created_at: "2026-01-01T00:00:00Z" },
            ],
            error: null,
          }),
        }),
      };
    }
    if (table === "org_members") {
      return { select: vi.fn().mockResolvedValue({ data: [{ org_id: 1 }], error: null }) };
    }
    if (table === "point_transactions") {
      return {
        select: vi.fn().mockResolvedValue({
          data: [
            { org_id: 1, points: 1000 },
            { org_id: 1, points: -300 },
            { org_id: 2, points: 500 },
          ],
          error: null,
        }),
      };
    }
    // buildings
    return { select: () => ({ is: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
  });

  const result = await listPlatformOrganizations();
  expect(result).toEqual([
    expect.objectContaining({ id: 1, pointBalance: 700 }),
    expect.objectContaining({ id: 2, pointBalance: 500 }),
  ]);
});

it("포인트 내역을 조직명과 결합해 최신순으로 반환하고 type 필터를 적용한다", async () => {
  const order = vi.fn().mockResolvedValue({
    data: [
      { id: 5, org_id: 1, type: "charge", points: 1000, amount_krw: 110000, memo: "8월", created_by: "u1", created_at: "2026-08-02T00:00:00Z" },
    ],
    error: null,
  });
  const eq = vi.fn(() => ({ order }));
  const profileIn = vi.fn().mockResolvedValue({
    data: [{ user_id: "u1", full_name: "김운영" }],
    error: null,
  });
  from.mockImplementation((table: string) => {
    if (table === "point_transactions") return { select: () => ({ eq, order }) };
    if (table === "organizations") return { select: vi.fn().mockResolvedValue({ data: [{ id: 1, name: "한빛관리" }], error: null }) };
    return { select: () => ({ in: profileIn }) }; // profiles
  });

  const result = await listPointTransactions({ type: "charge" });

  expect(eq).toHaveBeenCalledWith("type", "charge");
  expect(result[0]).toEqual(
    expect.objectContaining({
      id: 5,
      orgId: 1,
      organizationName: "한빛관리",
      type: "charge",
      points: 1000,
      amountKrw: 110000,
      createdByName: "김운영",
    }),
  );
});

it("chargePoints는 로그인 사용자를 created_by로, type=charge로 INSERT한다", async () => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "op-1" } }, error: null });
  authClient.auth = { getUser };
  from.mockImplementation((table: string) => {
    if (table === "point_transactions") return { insert };
    return { select: vi.fn() };
  });

  await chargePoints({ orgId: 3, points: 1000, amountKrw: 110000, memo: "선불" });

  expect(getUser).toHaveBeenCalled();
  expect(insert).toHaveBeenCalledWith({
    org_id: 3,
    type: "charge",
    points: 1000,
    amount_krw: 110000,
    memo: "선불",
    created_by: "op-1",
  });
});

it("updateOrganizationStatus는 organizations status를 갱신한다", async () => {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  from.mockImplementation(() => ({ update }));

  await updateOrganizationStatus(7, "suspended");

  expect(update).toHaveBeenCalledWith({ status: "suspended" });
  expect(eq).toHaveBeenCalledWith("id", 7);
});
```

그리고 mock에서 `auth.getUser`를 쓸 수 있게 파일 상단 mock을 확장한다(기존 `const from = vi.fn()` 아래):

```ts
const authClient: { from: typeof from; auth?: unknown } = { from };
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => authClient,
}));
```
(기존 `vi.mock(... createClient: () => ({ from }))`을 위 형태로 교체 — `authClient`를 통해 테스트에서 `auth`를 주입.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run hooks/reactquery/platform/apis.test.ts`
Expected: FAIL — `listPointTransactions`/`chargePoints`/`updateOrganizationStatus` is not a function, `pointBalance` undefined.

- [ ] **Step 3: `apis.ts` 구현 추가**

기존 `apis.ts` 하단/적절한 위치에 추가하고, `PlatformOrganization`·`listPlatformOrganizations`를 수정한다.

인터페이스/타입 추가:

```ts
export type PointTxType = "charge" | "usage";

export interface PointTransaction {
  id: number;
  orgId: number;
  organizationName: string;
  type: PointTxType;
  points: number;
  amountKrw: number | null;
  memo: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface ChargePointsInput {
  orgId: number;
  points: number;   // > 0
  amountKrw: number; // >= 0
  memo?: string | null;
}

interface PointTxRow {
  id: number;
  org_id: number;
  type: PointTxType;
  points: number;
  amount_krw: number | null;
  memo: string | null;
  created_by: string | null;
  created_at: string;
}
```

`PlatformOrganization`에 필드 추가:

```ts
export interface PlatformOrganization {
  id: number;
  name: string;
  slug: string | null;
  status: OrganizationStatus;
  createdAt: string;
  accountCount: number;
  buildingCount: number;
  pointBalance: number; // sum(points)
}
```

`countByOrganization` 옆에 잔액 집계 헬퍼 추가:

```ts
function sumPointsByOrganization(
  rows: Array<{ org_id: number; points: number }> | null,
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const row of rows ?? []) {
    totals.set(row.org_id, (totals.get(row.org_id) ?? 0) + row.points);
  }
  return totals;
}
```

`listPlatformOrganizations`를 point_transactions 조회를 포함하도록 수정:

```ts
export async function listPlatformOrganizations(): Promise<PlatformOrganization[]> {
  const supabase = createClient();
  const [organizations, members, buildings, points] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("org_members").select("org_id"),
    supabase.from("buildings").select("org_id").is("deleted_at", null),
    supabase.from("point_transactions").select("org_id, points"),
  ]);

  if (organizations.error) throw new Error(organizations.error.message);
  if (members.error) throw new Error(members.error.message);
  if (buildings.error) throw new Error(buildings.error.message);
  if (points.error) throw new Error(points.error.message);

  const accountCounts = countByOrganization(members.data);
  const buildingCounts = countByOrganization(buildings.data);
  const pointBalances = sumPointsByOrganization(
    points.data as Array<{ org_id: number; points: number }> | null,
  );

  return ((organizations.data ?? []) as OrganizationRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    accountCount: accountCounts.get(row.id) ?? 0,
    buildingCount: buildingCounts.get(row.id) ?? 0,
    pointBalance: pointBalances.get(row.id) ?? 0,
  }));
}
```

신규 함수들:

```ts
export async function listPointTransactions(
  opts: { type?: PointTxType } = {},
): Promise<PointTransaction[]> {
  const supabase = createClient();

  let query = supabase
    .from("point_transactions")
    .select("id, org_id, type, points, amount_krw, memo, created_by, created_at");
  if (opts.type) query = query.eq("type", opts.type);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PointTxRow[];

  // 조직명 + 기록자명 결합
  const [organizations, profiles] = await Promise.all([
    supabase.from("organizations").select("id, name"),
    (async () => {
      const ids = [...new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v))];
      if (ids.length === 0) return { data: [] as Array<{ user_id: string; full_name: string }> };
      return supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
    })(),
  ]);
  if (organizations.error) throw new Error(organizations.error.message);
  if ("error" in profiles && profiles.error) throw new Error(profiles.error.message);

  const orgNames = new Map<number, string>(
    (organizations.data ?? []).map((o) => [o.id, o.name]),
  );
  const creatorNames = new Map<string, string>(
    ((profiles.data ?? []) as Array<{ user_id: string; full_name: string }>).map((p) => [
      p.user_id,
      p.full_name,
    ]),
  );

  return rows.map((row) => ({
    id: row.id,
    orgId: row.org_id,
    organizationName: orgNames.get(row.org_id) ?? "알 수 없는 조직",
    type: row.type,
    points: row.points,
    amountKrw: row.amount_krw,
    memo: row.memo,
    createdBy: row.created_by,
    createdByName: row.created_by ? creatorNames.get(row.created_by) ?? null : null,
    createdAt: row.created_at,
  }));
}

export async function chargePoints(input: ChargePointsInput): Promise<void> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);

  const { error } = await supabase.from("point_transactions").insert({
    org_id: input.orgId,
    type: "charge",
    points: input.points,
    amount_krw: input.amountKrw,
    memo: input.memo ?? null,
    created_by: userData.user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateOrganizationStatus(
  id: number,
  status: OrganizationStatus,
): Promise<void> {
  const { error } = await createClient()
    .from("organizations")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
```

> 주의: 테스트의 `chargePoints` 케이스는 `memo: "선불"`을 그대로 기대하므로 `insert` payload에 `memo: input.memo ?? null`을 넣는다(값이 있으면 그대로). null 병합은 memo 미입력 시에만 적용된다.

- [ ] **Step 4: `keys.ts` 수정**

```ts
export const platformKeys = {
  all: ["platform-admin"] as const,
  overview: () => [...platformKeys.all, "overview"] as const,
  organizations: () => [...platformKeys.all, "organizations"] as const,
  accounts: () => [...platformKeys.all, "accounts"] as const,
  transactions: (opts?: { type?: "charge" | "usage" }) =>
    [...platformKeys.all, "transactions", opts?.type ?? "all"] as const,
};
```

- [ ] **Step 5: `queries.ts` 수정 — `usePlatformTransactions` 추가**

```ts
import { useQuery } from "@tanstack/react-query";
import {
  getPlatformOverview,
  listPlatformAccounts,
  listPlatformOrganizations,
  listPointTransactions,
  type PointTxType,
} from "./apis";
import { platformKeys } from "./keys";

// ...기존 usePlatformOverview / usePlatformOrganizations / usePlatformAccounts 유지...

export function usePlatformTransactions(opts?: { type?: PointTxType }) {
  return useQuery({
    queryKey: platformKeys.transactions(opts),
    queryFn: () => listPointTransactions(opts),
  });
}
```

- [ ] **Step 6: `mutations.ts` 생성**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  chargePoints,
  updateOrganizationStatus,
  type ChargePointsInput,
  type OrganizationStatus,
} from "./apis";
import { platformKeys } from "./keys";

export function useChargePoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChargePointsInput) => chargePoints(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: platformKeys.organizations() });
      void queryClient.invalidateQueries({ queryKey: [...platformKeys.all, "transactions"] });
    },
  });
}

export function useUpdateOrganizationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrganizationStatus }) =>
      updateOrganizationStatus(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: platformKeys.organizations() }),
  });
}
```

- [ ] **Step 7: `index.ts` 수정**

```ts
export * from "./apis";
export * from "./keys";
export * from "./queries";
export * from "./mutations";
```

- [ ] **Step 8: 테스트 통과 + 타입 확인**

Run: `npx vitest run hooks/reactquery/platform/apis.test.ts && npx tsc --noEmit`
Expected: PASS(신규 4케이스 포함 전체), tsc 0 에러.

- [ ] **Step 9: 커밋**

```bash
git add hooks/reactquery/platform/
git commit -m "feat(platform-admin): 포인트 잔액·내역·충전 + 조직 상태변경 데이터 계층"
```

---

### Task 3: 포인트 관리 화면 (잔액 목록 + 충전 모달 + 내역)

**Files:**
- Create: `components/forms/schema/pointCharge.ts`
- Create: `app/(platform-admin)/platform-admin/points/components/PointChargeModal.tsx`
- Modify: `app/(platform-admin)/platform-admin/points/page.tsx`
- Test: `app/(platform-admin)/platform-admin/points/components/PointChargeModal.test.tsx`

**Interfaces:**
- Consumes: `usePlatformOrganizations`(잔액·조직명·상태), `usePlatformTransactions`, `useChargePoints`, `PlatformOrganization`, `PointTransaction`. `@/components/common`(Modal/Input/Select/Button/EmptyState/Spinner/SearchBar). `sonner` toast. Task 2의 `ChargePointsInput`.
- Produces: `pointChargeSchema`, `PointChargeFormValues`, `PointChargeModal` 컴포넌트.

- [ ] **Step 1: zod 스키마 작성 — `components/forms/schema/pointCharge.ts`**

```ts
import { z } from "zod";

export const pointChargeSchema = z.object({
  orgId: z.coerce.number().int().positive("조직을 선택해 주세요"),
  points: z.coerce.number().int().positive("충전 포인트는 1 이상이어야 합니다"),
  amountKrw: z.coerce.number().int().min(0, "결제금액은 0 이상이어야 합니다"),
  memo: z.string().max(200, "메모는 200자 이하로 입력해 주세요").optional(),
});

export type PointChargeFormValues = z.output<typeof pointChargeSchema>;
```

- [ ] **Step 2: 모달 검증 실패 테스트 작성 — `PointChargeModal.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PointChargeModal } from "./PointChargeModal";

const orgs = [
  { id: 1, name: "한빛관리", status: "active" as const, pointBalance: 0, slug: null, createdAt: "", accountCount: 0, buildingCount: 0 },
];

it("포인트가 0 이하이면 제출을 막고 오류를 표시한다", async () => {
  const onSubmit = vi.fn();
  render(<PointChargeModal open onClose={() => {}} organizations={orgs} onSubmit={onSubmit} isPending={false} />);
  fireEvent.change(screen.getByLabelText("충전 포인트"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "충전 기록" }));
  await waitFor(() => expect(screen.getByText("충전 포인트는 1 이상이어야 합니다")).toBeInTheDocument());
  expect(onSubmit).not.toHaveBeenCalled();
});

it("유효 입력이면 onSubmit에 coerce된 숫자를 전달한다", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<PointChargeModal open onClose={() => {}} organizations={orgs} onSubmit={onSubmit} isPending={false} />);
  fireEvent.change(screen.getByLabelText("대상 조직"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("충전 포인트"), { target: { value: "1000" } });
  fireEvent.change(screen.getByLabelText("결제금액(원)"), { target: { value: "110000" } });
  fireEvent.click(screen.getByRole("button", { name: "충전 기록" }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 1, points: 1000, amountKrw: 110000 }),
    ),
  );
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run "app/(platform-admin)/platform-admin/points/components/PointChargeModal.test.tsx"`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: `PointChargeModal.tsx` 구현**

`FeeItemFormModal` 패턴(useForm<Input, unknown, Output> + zodResolver) 준수. Select 옵션 라벨에 접근성 `<label>`을 붙이고 `aria-label`/연결로 `getByLabelText`가 동작하도록 한다.

```tsx
"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal, Input, Button } from "@/components/common";
import { pointChargeSchema } from "@/components/forms/schema/pointCharge";
import type { PlatformOrganization } from "@/hooks/reactquery/platform";

type Input$ = z.input<typeof pointChargeSchema>;
type Values = z.output<typeof pointChargeSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  organizations: PlatformOrganization[];
  onSubmit: (values: Values) => Promise<void>;
  isPending: boolean;
}

export function PointChargeModal({ open, onClose, organizations, onSubmit, isPending }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Input$, unknown, Values>({
    resolver: zodResolver(pointChargeSchema),
    defaultValues: { orgId: organizations[0]?.id, points: undefined, amountKrw: undefined, memo: "" },
  });

  React.useEffect(() => {
    if (open) reset({ orgId: organizations[0]?.id, points: undefined, amountKrw: undefined, memo: "" });
  }, [open, organizations, reset]);

  const onValid = async (values: Values) => {
    await onSubmit(values);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="포인트 충전 기록">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <div>
          <label htmlFor="pc-org" className="mb-1 block text-xs font-semibold text-t3">대상 조직</label>
          <select
            id="pc-org"
            aria-label="대상 조직"
            {...register("orgId")}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          {errors.orgId && <p className="mt-1 text-xs text-danger">{errors.orgId.message}</p>}
        </div>

        <div>
          <label htmlFor="pc-points" className="mb-1 block text-xs font-semibold text-t3">충전 포인트</label>
          <Input id="pc-points" aria-label="충전 포인트" type="number" inputMode="numeric" {...register("points")} placeholder="예: 10000" />
          {errors.points && <p className="mt-1 text-xs text-danger">{errors.points.message}</p>}
        </div>

        <div>
          <label htmlFor="pc-amount" className="mb-1 block text-xs font-semibold text-t3">결제금액(원)</label>
          <Input id="pc-amount" aria-label="결제금액(원)" type="number" inputMode="numeric" {...register("amountKrw")} placeholder="예: 110000" />
          {errors.amountKrw && <p className="mt-1 text-xs text-danger">{errors.amountKrw.message}</p>}
        </div>

        <div>
          <label htmlFor="pc-memo" className="mb-1 block text-xs font-semibold text-t3">메모(선택)</label>
          <Input id="pc-memo" aria-label="메모" {...register("memo")} placeholder="예: 8월 선불 충전" />
          {errors.memo && <p className="mt-1 text-xs text-danger">{errors.memo.message}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "기록 중…" : "충전 기록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run "app/(platform-admin)/platform-admin/points/components/PointChargeModal.test.tsx"`
Expected: PASS(2케이스).

- [ ] **Step 6: `points/page.tsx` 구현(placeholder 교체)**

`organizations/page.tsx`의 테이블/상태 UI 패턴을 그대로 따른다. 상단=잔액 목록(+충전 버튼), 하단=충전/사용 내역.

```tsx
"use client";

import { useMemo, useState } from "react";
import { EmptyState, Spinner, Button, SearchBar } from "@/components/common";
import {
  usePlatformOrganizations,
  usePlatformTransactions,
  useChargePoints,
} from "@/hooks/reactquery/platform";
import { toast } from "sonner";
import { PageHeader, QueryError, StatusBadge } from "../../_components/PageElements";
import { PointChargeModal } from "./components/PointChargeModal";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });
const num = (n: number) => n.toLocaleString("ko-KR");

export default function PlatformPointsPage() {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const orgsQuery = usePlatformOrganizations();
  const txQuery = usePlatformTransactions();
  const charge = useChargePoints();

  const organizations = orgsQuery.data ?? [];
  const filtered = useMemo(() => {
    const kw = search.trim().toLocaleLowerCase("ko-KR");
    if (!kw) return organizations;
    return organizations.filter((o) => o.name.toLocaleLowerCase("ko-KR").includes(kw));
  }, [organizations, search]);

  const handleCharge = async (values: { orgId: number; points: number; amountKrw: number; memo?: string }) => {
    try {
      await charge.mutateAsync(values);
      toast.success("포인트 충전을 기록했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "충전 기록에 실패했습니다.");
      throw e;
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <PageHeader eyebrow="POINTS" title="포인트 관리" description="조직별 발송 크레딧(포인트) 잔액과 충전·사용 내역을 관리합니다." />

      {/* 잔액 목록 */}
      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-t1">조직별 포인트 잔액</h3>
            <p className="mt-1 text-xs text-t3">총 {num(organizations.length)}개 조직</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <div className="w-full sm:w-64"><SearchBar value={search} onChange={setSearch} placeholder="조직명 검색" /></div>
            <Button variant="primary" onClick={() => setModalOpen(true)} disabled={organizations.length === 0}>충전 기록</Button>
          </div>
        </div>
        {orgsQuery.isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : orgsQuery.isError ? (
          <div className="p-4"><QueryError onRetry={() => void orgsQuery.refetch()} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState message={search ? "검색 결과가 없습니다" : "조회 가능한 조직이 없습니다"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">조직</th><th className="px-4 py-3">상태</th><th className="px-5 py-3 text-right">포인트 잔액</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4 font-bold text-t1">{o.name}</td>
                    <td className="px-4 py-4"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-4 text-right font-extrabold text-t1 num">{num(o.pointBalance)} P</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 내역 */}
      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line p-4"><h3 className="text-base font-extrabold text-t1">충전·사용 내역</h3></div>
        {txQuery.isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : txQuery.isError ? (
          <div className="p-4"><QueryError onRetry={() => void txQuery.refetch()} /></div>
        ) : (txQuery.data ?? []).length === 0 ? (
          <EmptyState message="내역이 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">일시</th><th className="px-4 py-3">조직</th><th className="px-4 py-3">구분</th>
                  <th className="px-4 py-3 text-right">포인트</th><th className="px-4 py-3">메모</th><th className="px-5 py-3">기록자</th>
                </tr>
              </thead>
              <tbody>
                {(txQuery.data ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4 text-t2 num">{dateFmt.format(new Date(t.createdAt))}</td>
                    <td className="px-4 py-4 text-t1">{t.organizationName}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${t.type === "charge" ? "bg-green-t text-green" : "bg-amber-t text-amber"}`}>
                        {t.type === "charge" ? "충전" : "사용"}
                      </span>
                    </td>
                    <td className={`px-4 py-4 text-right font-bold num ${t.points >= 0 ? "text-green" : "text-red"}`}>{t.points >= 0 ? "+" : ""}{num(t.points)}</td>
                    <td className="px-4 py-4 text-t3">{t.memo ?? "—"}</td>
                    <td className="px-5 py-4 text-t3">{t.createdByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PointChargeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        organizations={organizations}
        onSubmit={handleCharge}
        isPending={charge.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 7: 전체 검증 + 커밋**

Run: `npx vitest run "app/(platform-admin)/platform-admin/points" && npx tsc --noEmit`
Expected: PASS.
```bash
git add "app/(platform-admin)/platform-admin/points" components/forms/schema/pointCharge.ts
git commit -m "feat(platform-admin): 포인트 관리 화면(잔액 목록·충전 모달·내역)"
```

---

### Task 4: 청구 관리 화면 (charge 결제 내역)

**Files:**
- Modify: `app/(platform-admin)/platform-admin/billing/page.tsx`
- Test: `app/(platform-admin)/platform-admin/billing/page.test.tsx`

**Interfaces:**
- Consumes: `usePlatformTransactions({ type: "charge" })`, `PointTransaction`(amountKrw·points·organizationName·createdByName·createdAt).
- Produces: 없음(리프 화면).

- [ ] **Step 1: 렌더 테스트 작성 — `billing/page.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PlatformBillingPage from "./page";

vi.mock("@/hooks/reactquery/platform", () => ({
  usePlatformTransactions: () => ({
    data: [
      { id: 1, orgId: 1, organizationName: "한빛관리", type: "charge", points: 1000, amountKrw: 110000, memo: null, createdBy: "u1", createdByName: "김운영", createdAt: "2026-08-02T00:00:00Z" },
    ],
    isPending: false, isError: false, refetch: vi.fn(),
  }),
}));

it("충전 결제 내역에 금액과 포인트를 표시한다", () => {
  render(<PlatformBillingPage />);
  expect(screen.getByText("한빛관리")).toBeInTheDocument();
  expect(screen.getByText(/110,000/)).toBeInTheDocument();
  expect(screen.getByText(/1,000/)).toBeInTheDocument();
  expect(screen.getByText("김운영")).toBeInTheDocument();
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run "app/(platform-admin)/platform-admin/billing/page.test.tsx"`
Expected: FAIL — placeholder라 조직명 없음.

- [ ] **Step 3: `billing/page.tsx` 구현**

```tsx
"use client";

import { EmptyState, Spinner } from "@/components/common";
import { usePlatformTransactions } from "@/hooks/reactquery/platform";
import { PageHeader, QueryError } from "../../_components/PageElements";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });
const num = (n: number) => n.toLocaleString("ko-KR");

export default function PlatformBillingPage() {
  const { data = [], isPending, isError, refetch } = usePlatformTransactions({ type: "charge" });
  const totalKrw = data.reduce((s, t) => s + (t.amountKrw ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <PageHeader eyebrow="BILLING" title="청구 관리" description="포인트 충전 결제(청구) 내역을 조회합니다." />

      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h3 className="text-base font-extrabold text-t1">충전 결제 내역</h3>
          <p className="text-xs text-t3">누적 결제액 <span className="font-extrabold text-t1 num">{num(totalKrw)}</span> 원</p>
        </div>
        {isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : isError ? (
          <div className="p-4"><QueryError onRetry={() => void refetch()} /></div>
        ) : data.length === 0 ? (
          <EmptyState message="충전 결제 내역이 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">일시</th><th className="px-4 py-3">조직</th>
                  <th className="px-4 py-3 text-right">결제액(원)</th><th className="px-4 py-3 text-right">포인트</th>
                  <th className="px-4 py-3">메모</th><th className="px-5 py-3">기록자</th>
                </tr>
              </thead>
              <tbody>
                {data.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-bg/50">
                    <td className="px-5 py-4 text-t2 num">{dateFmt.format(new Date(t.createdAt))}</td>
                    <td className="px-4 py-4 font-bold text-t1">{t.organizationName}</td>
                    <td className="px-4 py-4 text-right font-extrabold text-t1 num">{num(t.amountKrw ?? 0)}</td>
                    <td className="px-4 py-4 text-right font-bold text-green num">+{num(t.points)}</td>
                    <td className="px-4 py-4 text-t3">{t.memo ?? "—"}</td>
                    <td className="px-5 py-4 text-t3">{t.createdByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 + 커밋**

Run: `npx vitest run "app/(platform-admin)/platform-admin/billing" && npx tsc --noEmit`
Expected: PASS.
```bash
git add "app/(platform-admin)/platform-admin/billing"
git commit -m "feat(platform-admin): 청구 관리 화면(포인트 충전 결제 내역)"
```

---

### Task 5: 조직 관리 화면 — 포인트 잔액 컬럼 + 상태 변경

**Files:**
- Create: `app/(platform-admin)/platform-admin/organizations/components/OrgStatusControl.tsx`
- Modify: `app/(platform-admin)/platform-admin/organizations/page.tsx`
- Test: `app/(platform-admin)/platform-admin/organizations/components/OrgStatusControl.test.tsx`

**Interfaces:**
- Consumes: `useUpdateOrganizationStatus`, `OrganizationStatus`, `PlatformOrganization`. `sonner` toast. `@/components/common` Select.
- Produces: `OrgStatusControl` 컴포넌트.

- [ ] **Step 1: 상태변경 테스트 작성 — `OrgStatusControl.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrgStatusControl } from "./OrgStatusControl";

it("상태를 바꾸면 onChange에 새 상태를 전달한다", async () => {
  const onChange = vi.fn().mockResolvedValue(undefined);
  render(<OrgStatusControl status="trial" onChange={onChange} isPending={false} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "active" } });
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("active"));
});

it("같은 상태를 고르면 onChange를 호출하지 않는다", () => {
  const onChange = vi.fn();
  render(<OrgStatusControl status="active" onChange={onChange} isPending={false} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "active" } });
  expect(onChange).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run "app/(platform-admin)/platform-admin/organizations/components/OrgStatusControl.test.tsx"`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `OrgStatusControl.tsx` 구현**

```tsx
"use client";

import type { OrganizationStatus } from "@/hooks/reactquery/platform";

const OPTIONS: { value: OrganizationStatus; label: string }[] = [
  { value: "trial", label: "체험" },
  { value: "active", label: "운영 중" },
  { value: "suspended", label: "정지" },
];

interface Props {
  status: OrganizationStatus;
  onChange: (next: OrganizationStatus) => Promise<void> | void;
  isPending: boolean;
}

export function OrgStatusControl({ status, onChange, isPending }: Props) {
  return (
    <select
      aria-label="조직 상태 변경"
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as OrganizationStatus;
        if (next !== status) void onChange(next);
      }}
      className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-t1 disabled:opacity-50"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run "app/(platform-admin)/platform-admin/organizations/components/OrgStatusControl.test.tsx"`
Expected: PASS.

- [ ] **Step 5: `organizations/page.tsx` 수정 — 잔액 컬럼 + 상태 컨트롤**

기존 파일에서 `미납 현황` 컬럼(헤더+셀)을 **포인트 잔액**으로 교체하고, 상태 배지 셀에 `OrgStatusControl`을 병기한다. 상단 import·mutation·핸들러 추가:

```tsx
// import 추가
import { toast } from "sonner";
import { usePlatformOrganizations, useUpdateOrganizationStatus, type OrganizationStatus } from "@/hooks/reactquery/platform";
import { OrgStatusControl } from "./components/OrgStatusControl";

// 컴포넌트 본문 상단
const updateStatus = useUpdateOrganizationStatus();
const handleStatus = async (id: number, next: OrganizationStatus) => {
  try {
    await updateStatus.mutateAsync({ id, status: next });
    toast.success("조직 상태를 변경했습니다.");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "상태 변경에 실패했습니다.");
  }
};
```

thead의 `<th>미납 현황</th>`를 `<th className="px-4 py-3 text-right">포인트 잔액</th>`로 바꾸고, tbody의 상태/미납 셀을 다음으로 교체:

```tsx
<td className="px-4 py-4">
  <div className="flex items-center gap-2">
    <StatusBadge status={organization.status} />
    <OrgStatusControl
      status={organization.status}
      isPending={updateStatus.isPending}
      onChange={(next) => handleStatus(organization.id, next)}
    />
  </div>
</td>
{/* 건물/계정 셀은 유지 */}
<td className="px-4 py-4 text-right font-extrabold text-t1 num">{organization.pointBalance.toLocaleString("ko-KR")} P</td>
```

> 열 순서: 조직 · 상태(배지+변경) · 건물 · 계정 · **포인트 잔액** · 등록일. 기존 `min-w-[780px]`는 유지 또는 필요 시 `min-w-[860px]`로 상향.

- [ ] **Step 6: 검증 + 커밋**

Run: `npx vitest run "app/(platform-admin)/platform-admin/organizations" && npx tsc --noEmit`
Expected: PASS.
```bash
git add "app/(platform-admin)/platform-admin/organizations"
git commit -m "feat(platform-admin): 조직 화면 포인트 잔액 컬럼 + 상태 변경"
```

---

### Task 6: 대시보드 — 총 포인트 잔액 + 최근 충전

**Files:**
- Modify: `app/(platform-admin)/platform-admin/page.tsx`
- Test: `app/(platform-admin)/platform-admin/page.test.tsx`

**Interfaces:**
- Consumes: `usePlatformOverview`(기존), `usePlatformOrganizations`(pointBalance 합산), `usePlatformTransactions({type:"charge"})`(최근 N건).
- Produces: 없음.

- [ ] **Step 1: 테스트 작성 — `page.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PlatformDashboardPage from "./page";

vi.mock("@/hooks/reactquery/platform", () => ({
  usePlatformOverview: () => ({ data: { organizationCount: 2, accountCount: 5, buildingCount: 3 }, isPending: false, isError: false, refetch: vi.fn() }),
  usePlatformOrganizations: () => ({ data: [{ id: 1, name: "한빛", pointBalance: 700, status: "active", slug: null, createdAt: "", accountCount: 0, buildingCount: 0 }, { id: 2, name: "새봄", pointBalance: 500, status: "trial", slug: null, createdAt: "", accountCount: 0, buildingCount: 0 }] }),
  usePlatformTransactions: () => ({ data: [{ id: 9, orgId: 1, organizationName: "한빛", type: "charge", points: 1000, amountKrw: 110000, memo: null, createdBy: null, createdByName: null, createdAt: "2026-08-02T00:00:00Z" }] }),
}));

it("총 포인트 잔액(1,200)과 최근 충전을 표시한다", () => {
  render(<PlatformDashboardPage />);
  expect(screen.getByText(/1,200/)).toBeInTheDocument();
  expect(screen.getByText("한빛")).toBeInTheDocument();
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run "app/(platform-admin)/platform-admin/page.test.tsx"`
Expected: FAIL(총 잔액/최근 충전 미표시).

- [ ] **Step 3: `page.tsx` 수정**

기존 3카드 그리드에 "총 포인트 잔액" 카드를 추가하고(카드 4개), "빠른 이동" 아래에 "최근 충전" 섹션을 추가한다. 상단 import/훅:

```tsx
import { usePlatformOverview, usePlatformOrganizations, usePlatformTransactions } from "@/hooks/reactquery/platform";
// ...
const orgs = usePlatformOrganizations();
const recent = usePlatformTransactions({ type: "charge" });
const totalBalance = (orgs.data ?? []).reduce((s, o) => s + o.pointBalance, 0);
```

총 포인트 잔액 카드(그리드를 `lg:grid-cols-4`로) 예:

```tsx
<article className="rounded-2xl border border-line bg-surface p-5 shadow-card">
  <div className="text-sm font-bold text-t2">총 포인트 잔액</div>
  <div className="mt-3 text-[32px] font-extrabold leading-none text-t1 num">{totalBalance.toLocaleString("ko-KR")}</div>
  <div className="mt-2 text-xs text-t4">전 조직 합계(sum of points)</div>
</article>
```

최근 충전 섹션(빠른 이동 섹션 뒤):

```tsx
<section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
  <h3 className="text-base font-extrabold text-t1">최근 충전</h3>
  <ul className="mt-4 divide-y divide-line">
    {(recent.data ?? []).slice(0, 5).map((t) => (
      <li key={t.id} className="flex items-center justify-between py-3 text-sm">
        <span className="font-bold text-t1">{t.organizationName}</span>
        <span className="text-green font-bold num">+{t.points.toLocaleString("ko-KR")} P</span>
      </li>
    ))}
    {(recent.data ?? []).length === 0 && <li className="py-3 text-sm text-t3">최근 충전 내역이 없습니다.</li>}
  </ul>
</section>
```

- [ ] **Step 4: 검증 + 커밋**

Run: `npx vitest run "app/(platform-admin)/platform-admin/page.test.tsx" && npx tsc --noEmit`
Expected: PASS.
```bash
git add "app/(platform-admin)/platform-admin/page.tsx"
git commit -m "feat(platform-admin): 대시보드 총 포인트 잔액 + 최근 충전"
```

---

### Task 7: nav/copy 스펙 정렬 (Claude 직접)

**작성자: Claude**(codex가 navItems를 임의 수정하는 이력 → 공유파일은 오케스트레이터가 직접).

**Files:**
- Modify: `app/(platform-admin)/navItems.ts`
- Modify: `app/(platform-admin)/_components/PageElements.tsx`
- Test: `app/(platform-admin)/navItems.test.ts`(기존; 라벨 변경 시 동기화)

**Interfaces:** Consumes/Produces 없음(정적 카피).

- [ ] **Step 1: navItems 라벨/설명 정렬**

`PLATFORM_NAV_ITEMS`에서:
- `포인트 관리` description: `"포인트 정책·원장"` → `"조직별 잔액·충전"`
- `결제·구독` → label `"청구 관리"`, description `"포인트 충전 결제 내역"`(href `/platform-admin/billing` 유지)

- [ ] **Step 2: DataScopeNotice 문구(Scope A) 갱신 — `PageElements.tsx`**

`my_org_ids()` 활성 org 한정 문구를, platform_admin cross-org 전제로 교체:

```tsx
<p><code className="font-bold">platform_admin</code> 권한으로 전체 관리회사(테넌트) 데이터를 조회·관리합니다.</p>
```

- [ ] **Step 3: navItems 테스트 동기화 + 검증**

`navItems.test.ts`가 옛 라벨(`결제·구독`)을 검증하면 새 라벨로 갱신. 

Run: `npx vitest run "app/(platform-admin)/navItems.test.ts" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add "app/(platform-admin)/navItems.ts" "app/(platform-admin)/navItems.test.ts" "app/(platform-admin)/_components/PageElements.tsx"
git commit -m "chore(platform-admin): nav/문구 스펙 정렬(청구 관리, cross-org)"
```

---

### Task 8: 통합 검증 (빌드 정적생성)

**Files:** 없음(검증 전용).

- [ ] **Step 1: 전체 유닛 테스트**

Run: `npx vitest run`
Expected: 전체 PASS(신규 포함).

- [ ] **Step 2: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 0 에러.

- [ ] **Step 3: 정적 생성 빌드**

Run: `npx next build --webpack`
Expected: 성공. `/platform-admin`·`/points`·`/billing`·`/organizations` 경로 정상 생성. `use client` 페이지가 useSearchParams 등으로 정적생성 실패하지 않는지 확인(과거 setup 버그 유형).

- [ ] **Step 4: WBS 동기화**

주택관리ERP 버킷(9514ec1f) 대상, 커밋들을 `wbs-commit-sync` 스킬로 dev 트랙 반영(완료는 수동). [[wbs-sync-and-worktrees]]

- [ ] **Step 5: master PR(사용자 확인 후)**

`0006` DB 적용은 P3a `0004` 머지 후 `0004→0005→0006` 순. PR 생성은 사용자 확인 후.

---

## Self-Review (계획↔스펙 대조)

**Spec coverage:**
- §3.2 point_transactions → Task 1 ✓
- §3.3 current_user_is_platform_admin() + RLS 예외 → Task 1 ✓(organizations SELECT+UPDATE, org_members/profiles SELECT, point_transactions ALL)
- §3.4 0006 순번 → Global Constraints + Task 1 헤더 ✓
- §4 대시보드(총 잔액·최근 충전) → Task 6 ✓
- §4 테넌트 관리(상태 변경 trial/active/suspended) → Task 5 ✓(사용자 확정 범위)
- §4 포인트 관리(잔액+충전모달+내역) → Task 3 ✓
- §4 청구 관리(charge 내역) → Task 4 ✓
- §4 계정·권한(뼈대 재사용) → 변경 없음, cross-org RLS로 자동 전체 조회 ✓(가드 `isMaster`가 platform_admin 허용 확인)
- §5 apis cross-org + 잔액 join → Task 2(listPlatformOrganizations.pointBalance) ✓
- §5 신규 훅 points(잔액·내역·충전 mutation) → Task 2(queries/mutations) ✓
- §6 zod 검증(points>0, amount_krw≥0) → Task 3(pointChargeSchema) ✓
- §6 vitest(잔액 집계·충전 mutation·목록 훅 매핑·가드) → Task 2·3·4·5·6 테스트 ✓
- §6 next build --webpack → Task 8 ✓

**Type consistency:** `PointTransaction`/`ChargePointsInput`/`PlatformOrganization.pointBalance`/`OrganizationStatus` 시그니처가 Task 2 정의와 Task 3~6 사용처에서 일치. `chargePoints(input)→void`, `updateOrganizationStatus(id,status)→void`, `usePlatformTransactions({type})` 일관.

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. TODO/TBD 없음(발송 usage는 스펙상 P4로 명시 연기이지 플레이스홀더 아님).

## 결정 로그(구현 세부)
- **created_by**: API 계층에서 `supabase.auth.getUser()`로 조회해 INSERT(운영자=로그인 사용자). DB default 대신 명시적·테스트 가능 방식.
- **잔액 집계**: 뷰(security_invoker) 대신 `listPlatformOrganizations`에서 point_transactions 조회 후 클라이언트 합산(`sumPointsByOrganization`) — 기존 `countByOrganization` 패턴과 동일, RLS-뷰 함정 회피, 현 규모에 충분.
- **조직 상태 변경 범위**: 사용자 확정으로 이번 세션 포함(RLS UPDATE 정책 + UI Select).

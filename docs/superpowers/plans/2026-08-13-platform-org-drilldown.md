# 통합관리자 사무소 드릴다운 (건물·입주민·세대 조회) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 통합관리자(platform-admin) 콘솔의 "조직 관리"에서 조직→건물→입주민→세대로 읽기전용 드릴다운 조회를 추가한다.

**Architecture:** platform-admin 브랜치가 이미 만든 콘솔(`(platform-admin)` 셸·`PlatformAdminGuard`·`current_user_is_platform_admin()` 게이트·크로스-org RLS 예외·`hooks/reactquery/platform/*` 직접 `.from()` 조회)을 **재사용**한다. 신규는 ① buildings/units/occupancies/room_types에 platform_admin 크로스-org SELECT 정책, ② 직접 `.from()` 드릴다운 조회 3종, ③ `(platform-admin)/organizations/[orgId]/…` 하위 읽기전용 페이지 3개뿐이다.

**Tech Stack:** Next.js 16(App Router) · Supabase(PostgreSQL·RLS) · React Query v5 · TailwindCSS v4 · vitest + Testing Library

**기반 브랜치:** `PracLee/cuttlefish`(= `PracLee/platform-admin`에서 분기). **작업 워크트리:** `C:/Users/leebj/orca/workspaces/home_erp/cuttlefish`.

## Global Constraints

- **platform-admin 패턴 준수(핵심):** 데이터는 **로그인 Supabase 클라이언트로 직접 `.from()` 조회**(RLS가 크로스-org 허용). **신규 RPC 도입 금지.** 기존 `hooks/reactquery/platform/apis.ts` 스타일(직접 `.from`, 클라이언트 조인/Map 집계, snake→camel 매핑) 따른다.
- **크로스-org 게이트:** 기존 `current_user_is_platform_admin()`(`org_members.role='platform_admin'`). 신규 RLS는 **permissive** `for select using (current_user_is_platform_admin())`이며 **기존 org-scoped select 정책은 그대로 둔다**(PostgreSQL이 permissive 정책을 OR 결합).
- **읽기 전용:** 드릴다운에 mutation/편집/상태변경 UI를 만들지 않는다.
- **UI:** 한국어. 기존 프리미티브 재사용 — `@/components/common`의 `DataTable`·`EmptyState`·`Spinner`, `@/app/(platform-admin)/_components/PageElements`의 `PageHeader`·`QueryError`·`StatusBadge`. blue 토큰 클래스(`text-t1/t2/t3/t4`,`border-line`,`bg-surface`,`shadow-card`) 사용.
- **가드·라우팅:** 페이지는 `(platform-admin)` 그룹에 두어 `PlatformAdminGuard`를 자동 상속한다. **미들웨어·로그인·별도 가드 변경 없음.**
- **Next.js 16:** 라우팅/페이지 작성 전 `node_modules/next/dist/docs/`의 App Router 가이드 확인(AGENTS.md). `next dev`/`next build`가 AGENTS.md의 nextjs 블록을 재생성하면 함께 커밋.
- **DB 적용은 사용자 PC 수동**(로컬 SQL 하니스 없음). **Supabase MCP는 무관 프로젝트라 사용 금지.** DB 태스크 검증 = verify SQL 파일 작성(라이브 실행은 사용자 PC로 이연).
- **마이그 번호:** platform-admin의 `0007_platform_admin` 다음 = **`0008`**. (참고: 타 브랜치 permit/bullhead도 각자 0007을 씀 — 그건 그 브랜치들의 머지 이슈이며, 본 작업은 platform-admin 기준으로 0008이면 정합.)
- **TDD:** 프론트 각 유닛은 실패테스트→최소구현→통과. 개별 실행 `npx vitest run <path>`. Windows 경로에 괄호/대괄호가 있으니 따옴표로 감싼다.
- **커밋 꼬리표:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 커밋만; 푸시·PR은 사용자 지시 시.

---

## File Structure

**DB**
- Create `supabase/migrations/0008_platform_drilldown.sql` — 크로스-org SELECT 정책 4개.
- Create `supabase/verify/platform_drilldown_checks.sql` — 정책 존재 검증.

**데이터**
- Create `hooks/reactquery/platform/drilldown.ts` — `getOrgBuildings`·`getBuildingTenants`·`getUnitOccupancy` + 타입.
- Create `hooks/reactquery/platform/drilldown.test.ts`.
- Modify `hooks/reactquery/platform/keys.ts` — 키 3개 추가.
- Modify `hooks/reactquery/platform/queries.ts` — 훅 3개 추가.
- Modify `hooks/reactquery/platform/index.ts` — `export * from "./drilldown"`.

**UI (모두 `app/(platform-admin)/platform-admin/organizations/…`)**
- Modify `organizations/page.tsx` — 조직명 셀을 상세 링크로.
- Create `[orgId]/page.tsx` + `[orgId]/components/OrgBuildingsList.tsx`(+test).
- Create `[orgId]/buildings/[buildingId]/page.tsx` + `.../components/BuildingTenantsList.tsx`(+test).
- Create `[orgId]/buildings/[buildingId]/units/[unitId]/page.tsx` + `.../components/UnitDetailView.tsx`(+test).

---

## Task 1: DB — 크로스-org SELECT 정책 (0008)

**Files:** Create `supabase/migrations/0008_platform_drilldown.sql`, `supabase/verify/platform_drilldown_checks.sql`

**Interfaces:**
- Consumes: `current_user_is_platform_admin()` (0007_platform_admin).
- Produces: permissive select 정책 `building_platform_select`·`unit_platform_select`·`occ_platform_select`·`room_type_platform_select`.

- [ ] **Step 1: verify SQL(먼저 실패)** — `supabase/verify/platform_drilldown_checks.sql`

```sql
-- 통합관리자 사무소 드릴다운 검증(0008). 실패 시 raise. (사용자 PC psql / Supabase SQL editor)
do $$ begin
  if (select count(*) from pg_policies where policyname in
      ('building_platform_select','unit_platform_select','occ_platform_select','room_type_platform_select')) <> 4
  then raise exception 'platform drilldown cross-org select policies missing'; end if;
end $$;
-- 수동(세션별):
--  platform_admin 세션: 타 org buildings/units/occupancies/room_types SELECT 가능.
--  일반 staff 세션: 기존대로 자기 org만.
```

- [ ] **Step 2: 마이그레이션** — `supabase/migrations/0008_platform_drilldown.sql`

```sql
-- 0008_platform_drilldown.sql
-- 통합관리자(platform_admin) 사무소 드릴다운 — 건물/세대/입주/룸타입 크로스-org 읽기 개방.
-- 의존: 0007_platform_admin(current_user_is_platform_admin), P3a(buildings), P3b(units·occupancies), P2b(room_types).
-- 기존 org-scoped select 정책 유지 + platform_admin permissive select 추가(0007 org_platform_select 패턴).

create policy building_platform_select on buildings for select
  using (current_user_is_platform_admin());
create policy unit_platform_select on units for select
  using (current_user_is_platform_admin());
create policy occ_platform_select on occupancies for select
  using (current_user_is_platform_admin());
create policy room_type_platform_select on room_types for select
  using (current_user_is_platform_admin());
```

- [ ] **Step 3: (라이브 적용은 이연)** — 이 환경엔 DB가 없으므로 psql 실행하지 않는다. SQL이 잘 형성됐는지만 확인하고, 리포트에 "라이브 적용+verify는 사용자 PC로 이연"을 기록. JS 테스트 없음(`npm test` 실행 금지).

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0008_platform_drilldown.sql supabase/verify/platform_drilldown_checks.sql
git commit -m "feat(db): platform_admin 크로스-org SELECT 정책 — buildings/units/occupancies/room_types (0008)"
```

---

## Task 2: 데이터 — getOrgBuildings (조직→건물)

**Files:** Create `hooks/reactquery/platform/drilldown.ts`, `hooks/reactquery/platform/drilldown.test.ts`; Modify `keys.ts`, `queries.ts`, `index.ts`

**Interfaces:**
- Produces:
  - `interface PlatformBuilding { id:number; code:string; name:string; address:string|null }`
  - `interface OrgBuildingsResult { org:{ id:number; name:string; slug:string|null; status:OrganizationStatus }; buildings:PlatformBuilding[] }`
  - `getOrgBuildings(orgId:number): Promise<OrgBuildingsResult>`
  - `platformKeys.orgBuildings(orgId)`, `useOrgBuildings(orgId)`
- Consumes: `OrganizationStatus` from `./apis`.

- [ ] **Step 1: 실패 테스트** — `hooks/reactquery/platform/drilldown.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { getOrgBuildings } from "./drilldown";
beforeEach(() => vi.clearAllMocks());

describe("getOrgBuildings", () => {
  it("조직 + 건물 목록을 camelCase로 반환한다", async () => {
    from.mockImplementation((table: string) => {
      if (table === "organizations") {
        return { select: () => ({ eq: () => ({ single: () =>
          Promise.resolve({ data: { id: 3, name: "가나관리", slug: "gana", status: "active" }, error: null }) }) }) };
      }
      // buildings
      return { select: () => ({ eq: () => ({ is: () => ({ order: () =>
        Promise.resolve({ data: [{ id: 7, code: "B0007", name: "가나빌", address: "서울" }], error: null }) }) }) }) };
    });
    const r = await getOrgBuildings(3);
    expect(r.org).toMatchObject({ id: 3, name: "가나관리", status: "active" });
    expect(r.buildings).toEqual([{ id: 7, code: "B0007", name: "가나빌", address: "서울" }]);
  });

  it("건물 조회 에러는 throw", async () => {
    from.mockImplementation((table: string) => {
      if (table === "organizations") return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 3 }, error: null }) }) }) };
      return { select: () => ({ eq: () => ({ is: () => ({ order: () => Promise.resolve({ data: null, error: { message: "forbidden" } }) }) }) }) };
    });
    await expect(getOrgBuildings(3)).rejects.toThrow("forbidden");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run hooks/reactquery/platform/drilldown.test.ts` → FAIL (`./drilldown` 없음).

- [ ] **Step 3: 구현** — `hooks/reactquery/platform/drilldown.ts`

```ts
import { createClient } from "@/lib/supabase/client";
import type { OrganizationStatus } from "./apis";

export type OccupancyStatus = "occupied" | "vacant" | "moving_out";

// ── 조직 → 건물 ──
export interface PlatformBuilding {
  id: number;
  code: string;
  name: string;
  address: string | null;
}
export interface OrgBuildingsResult {
  org: { id: number; name: string; slug: string | null; status: OrganizationStatus };
  buildings: PlatformBuilding[];
}

export async function getOrgBuildings(orgId: number): Promise<OrgBuildingsResult> {
  const supabase = createClient();
  const [orgRes, buildingsRes] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, status").eq("id", orgId).single(),
    supabase.from("buildings").select("id, code, name, address").eq("org_id", orgId).is("deleted_at", null).order("name"),
  ]);
  if (orgRes.error) throw new Error(orgRes.error.message);
  if (buildingsRes.error) throw new Error(buildingsRes.error.message);
  const org = orgRes.data as { id: number; name: string; slug: string | null; status: OrganizationStatus };
  const buildings = ((buildingsRes.data ?? []) as Array<{ id: number; code: string; name: string; address: string | null }>)
    .map((b) => ({ id: b.id, code: b.code, name: b.name, address: b.address }));
  return { org, buildings };
}
```

- [ ] **Step 4: 키·훅·배럴 배선**

`hooks/reactquery/platform/keys.ts` — `platformKeys` 객체에 3개 추가(Task 3에서도 쓰므로 지금 모두 추가):
```ts
  orgBuildings: (orgId: number) => [...platformKeys.all, "org-buildings", orgId] as const,
  buildingTenants: (buildingId: number) => [...platformKeys.all, "building-tenants", buildingId] as const,
  unit: (unitId: number) => [...platformKeys.all, "unit", unitId] as const,
```
(`transactions` 항목 뒤, 닫는 `}` 앞에 넣는다.)

`hooks/reactquery/platform/queries.ts` — 상단 import에 추가하고 훅 추가:
```ts
import { getOrgBuildings } from "./drilldown";
```
파일 끝에:
```ts
export function useOrgBuildings(orgId: number) {
  return useQuery({
    queryKey: platformKeys.orgBuildings(orgId),
    queryFn: () => getOrgBuildings(orgId),
    enabled: Number.isFinite(orgId) && orgId > 0,
  });
}
```

`hooks/reactquery/platform/index.ts` — 줄 추가:
```ts
export * from "./drilldown";
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run hooks/reactquery/platform/drilldown.test.ts` → PASS.

- [ ] **Step 6: 커밋**

```bash
git add hooks/reactquery/platform/drilldown.ts hooks/reactquery/platform/drilldown.test.ts hooks/reactquery/platform/keys.ts hooks/reactquery/platform/queries.ts hooks/reactquery/platform/index.ts
git commit -m "feat(platform): getOrgBuildings 조직→건물 크로스-org 조회"
```

---

## Task 3: 데이터 — getBuildingTenants + getUnitOccupancy

**Files:** Modify `hooks/reactquery/platform/drilldown.ts`, `hooks/reactquery/platform/drilldown.test.ts`, `queries.ts`

**Interfaces:**
- Produces:
  - `interface PlatformTenantRow { unitId:number; occupancyId:number|null; unitNo:string; tenantName:string|null; residentCount:number|null; moveInDate:string|null; isVacant:boolean }`
  - `interface BuildingTenantsResult { org:{id:number;name:string}; building:{id:number;name:string}; tenants:PlatformTenantRow[] }`
  - `getBuildingTenants(buildingId:number): Promise<BuildingTenantsResult>`
  - `interface PlatformUnitDetail { unitId; unitNo; dong; areaPyeong; roomCount; buildingId; buildingName; orgId; orgName; occupancy: {...}|null }`
  - `getUnitOccupancy(unitId:number): Promise<PlatformUnitDetail>`
  - `useBuildingTenants(buildingId)`, `useUnitOccupancy(unitId)` (keys는 Task 2에서 이미 추가됨).

- [ ] **Step 1: 실패 테스트** — `drilldown.test.ts` 끝에 append

```ts
import { getBuildingTenants, getUnitOccupancy } from "./drilldown";

describe("getBuildingTenants", () => {
  it("건물·조직 + 세대별 최신 입주를 결합한다(입주 없으면 공실)", async () => {
    from.mockImplementation((table: string) => {
      if (table === "buildings") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 7, name: "가나빌", org_id: 3 }, error: null }) }) }) };
      if (table === "organizations") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 3, name: "가나관리" }, error: null }) }) }) };
      if (table === "units") return { select: () => ({ eq: () => ({ is: () => ({ order: () =>
        Promise.resolve({ data: [{ id: 11, unit_no: "101" }, { id: 12, unit_no: "102" }], error: null }) }) }) }) };
      // occupancies
      return { select: () => ({ in: () => ({ is: () => ({ order: () =>
        Promise.resolve({ data: [
          { id: 22, unit_id: 11, tenant_name: "홍길동", resident_count: 2, move_in_date: "2026-01-01", status: "occupied" },
        ], error: null }) }) }) }) };
    });
    const r = await getBuildingTenants(7);
    expect(r.org).toMatchObject({ id: 3, name: "가나관리" });
    expect(r.building).toMatchObject({ id: 7, name: "가나빌" });
    expect(r.tenants).toHaveLength(2);
    expect(r.tenants[0]).toMatchObject({ unitId: 11, occupancyId: 22, tenantName: "홍길동", isVacant: false });
    expect(r.tenants[1]).toMatchObject({ unitId: 12, occupancyId: null, tenantName: null, isVacant: true });
  });
});

describe("getUnitOccupancy", () => {
  it("세대+최신입주+룸타입+상위컨텍스트를 반환한다", async () => {
    from.mockImplementation((table: string) => {
      if (table === "units") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 11, unit_no: "101", dong: "가", area_pyeong: 24, room_count: 2, building_id: 7 }, error: null }) }) }) };
      if (table === "buildings") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 7, name: "가나빌", org_id: 3 }, error: null }) }) }) };
      if (table === "occupancies") return { select: () => ({ eq: () => ({ is: () => ({ order: () => ({ limit: () =>
        Promise.resolve({ data: [{ id: 22, tenant_name: "홍길동", payer_name: "홍길동", phone: "010", phone2: null, phone3: null, vehicle_no: null, resident_count: 2, room_type_id: 5, move_in_date: "2026-01-01", move_out_date: null, status: "occupied", billing_note: null, facility_note: null }], error: null }) }) }) }) }) };
      if (table === "organizations") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { name: "가나관리" }, error: null }) }) }) };
      // room_types
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { label: "원룸" }, error: null }) }) }) };
    });
    const r = await getUnitOccupancy(11);
    expect(r).toMatchObject({ unitId: 11, unitNo: "101", buildingName: "가나빌", orgName: "가나관리" });
    expect(r.occupancy).toMatchObject({ occupancyId: 22, tenantName: "홍길동", roomTypeLabel: "원룸", status: "occupied" });
  });

  it("입주 없으면 occupancy=null(룸타입 조회 안 함)", async () => {
    from.mockImplementation((table: string) => {
      if (table === "units") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 12, unit_no: "102", dong: null, area_pyeong: null, room_count: null, building_id: 7 }, error: null }) }) }) };
      if (table === "buildings") return { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: { id: 7, name: "가나빌", org_id: 3 }, error: null }) }) }) };
      if (table === "occupancies") return { select: () => ({ eq: () => ({ is: () => ({ order: () => ({ limit: () =>
        Promise.resolve({ data: [], error: null }) }) }) }) }) };
      // organizations
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { name: "가나관리" }, error: null }) }) }) };
    });
    const r = await getUnitOccupancy(12);
    expect(r.occupancy).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run hooks/reactquery/platform/drilldown.test.ts` → 새 describe들 FAIL.

- [ ] **Step 3: 구현** — `drilldown.ts` 끝에 append

```ts
// ── 건물 → 입주민(세대 + 최신 입주) ──
export interface PlatformTenantRow {
  unitId: number;
  occupancyId: number | null;
  unitNo: string;
  tenantName: string | null;
  residentCount: number | null;
  moveInDate: string | null;
  isVacant: boolean;
}
export interface BuildingTenantsResult {
  org: { id: number; name: string };
  building: { id: number; name: string };
  tenants: PlatformTenantRow[];
}
interface UnitRow {
  id: number;
  unit_no: string;
}
interface TenantOccRow {
  id: number;
  unit_id: number;
  tenant_name: string | null;
  resident_count: number | null;
  move_in_date: string | null;
  status: OccupancyStatus;
}

export async function getBuildingTenants(buildingId: number): Promise<BuildingTenantsResult> {
  const supabase = createClient();
  const buildingRes = await supabase.from("buildings").select("id, name, org_id").eq("id", buildingId).single();
  if (buildingRes.error) throw new Error(buildingRes.error.message);
  const building = buildingRes.data as { id: number; name: string; org_id: number };

  const [orgRes, unitsRes] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", building.org_id).single(),
    supabase.from("units").select("id, unit_no").eq("building_id", buildingId).is("deleted_at", null).order("unit_no"),
  ]);
  if (orgRes.error) throw new Error(orgRes.error.message);
  if (unitsRes.error) throw new Error(unitsRes.error.message);

  const units = (unitsRes.data ?? []) as UnitRow[];
  const unitIds = units.map((u) => u.id);
  let occRows: TenantOccRow[] = [];
  if (unitIds.length > 0) {
    const occRes = await supabase
      .from("occupancies")
      .select("id, unit_id, tenant_name, resident_count, move_in_date, status")
      .in("unit_id", unitIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (occRes.error) throw new Error(occRes.error.message);
    occRows = (occRes.data ?? []) as TenantOccRow[];
  }

  const latestByUnit = new Map<number, TenantOccRow>();
  for (const o of occRows) if (!latestByUnit.has(o.unit_id)) latestByUnit.set(o.unit_id, o);

  const tenants: PlatformTenantRow[] = units.map((u) => {
    const o = latestByUnit.get(u.id);
    return {
      unitId: u.id,
      occupancyId: o?.id ?? null,
      unitNo: u.unit_no,
      tenantName: o?.tenant_name ?? null,
      residentCount: o?.resident_count ?? null,
      moveInDate: o?.move_in_date ?? null,
      isVacant: o ? o.status === "vacant" : true,
    };
  });

  const org = orgRes.data as { id: number; name: string };
  return { org, building: { id: building.id, name: building.name }, tenants };
}

// ── 세대 → 상세(읽기전용) ──
export interface PlatformUnitOccupancy {
  occupancyId: number;
  tenantName: string | null;
  payerName: string | null;
  phone: string | null;
  phone2: string | null;
  phone3: string | null;
  vehicleNo: string | null;
  residentCount: number | null;
  roomTypeLabel: string | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  status: OccupancyStatus;
  billingNote: string | null;
  facilityNote: string | null;
}
export interface PlatformUnitDetail {
  unitId: number;
  unitNo: string;
  dong: string | null;
  areaPyeong: number | null;
  roomCount: number | null;
  buildingId: number;
  buildingName: string;
  orgId: number;
  orgName: string;
  occupancy: PlatformUnitOccupancy | null;
}
interface UnitFullRow {
  id: number;
  unit_no: string;
  dong: string | null;
  area_pyeong: number | null;
  room_count: number | null;
  building_id: number;
}
interface OccFullRow {
  id: number;
  tenant_name: string | null;
  payer_name: string | null;
  phone: string | null;
  phone2: string | null;
  phone3: string | null;
  vehicle_no: string | null;
  resident_count: number | null;
  room_type_id: number | null;
  move_in_date: string | null;
  move_out_date: string | null;
  status: OccupancyStatus;
  billing_note: string | null;
  facility_note: string | null;
}

export async function getUnitOccupancy(unitId: number): Promise<PlatformUnitDetail> {
  const supabase = createClient();
  const unitRes = await supabase
    .from("units")
    .select("id, unit_no, dong, area_pyeong, room_count, building_id")
    .eq("id", unitId)
    .single();
  if (unitRes.error) throw new Error(unitRes.error.message);
  const unit = unitRes.data as UnitFullRow;

  const [buildingRes, occRes] = await Promise.all([
    supabase.from("buildings").select("id, name, org_id").eq("id", unit.building_id).single(),
    supabase
      .from("occupancies")
      .select("id, tenant_name, payer_name, phone, phone2, phone3, vehicle_no, resident_count, room_type_id, move_in_date, move_out_date, status, billing_note, facility_note")
      .eq("unit_id", unitId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (buildingRes.error) throw new Error(buildingRes.error.message);
  if (occRes.error) throw new Error(occRes.error.message);
  const building = buildingRes.data as { id: number; name: string; org_id: number };

  const orgRes = await supabase.from("organizations").select("name").eq("id", building.org_id).single();
  if (orgRes.error) throw new Error(orgRes.error.message);

  const occ = ((occRes.data ?? []) as OccFullRow[])[0] ?? null;
  let roomTypeLabel: string | null = null;
  if (occ?.room_type_id != null) {
    const rtRes = await supabase.from("room_types").select("label").eq("id", occ.room_type_id).single();
    if (rtRes.error) throw new Error(rtRes.error.message);
    roomTypeLabel = (rtRes.data as { label: string } | null)?.label ?? null;
  }

  return {
    unitId: unit.id,
    unitNo: unit.unit_no,
    dong: unit.dong,
    areaPyeong: unit.area_pyeong,
    roomCount: unit.room_count,
    buildingId: building.id,
    buildingName: building.name,
    orgId: building.org_id,
    orgName: (orgRes.data as { name: string }).name,
    occupancy: occ == null ? null : {
      occupancyId: occ.id,
      tenantName: occ.tenant_name,
      payerName: occ.payer_name,
      phone: occ.phone,
      phone2: occ.phone2,
      phone3: occ.phone3,
      vehicleNo: occ.vehicle_no,
      residentCount: occ.resident_count,
      roomTypeLabel,
      moveInDate: occ.move_in_date,
      moveOutDate: occ.move_out_date,
      status: occ.status,
      billingNote: occ.billing_note,
      facilityNote: occ.facility_note,
    },
  };
}
```

- [ ] **Step 4: 훅 배선** — `hooks/reactquery/platform/queries.ts`

import 줄 갱신:
```ts
import { getOrgBuildings, getBuildingTenants, getUnitOccupancy } from "./drilldown";
```
파일 끝에 추가:
```ts
export function useBuildingTenants(buildingId: number) {
  return useQuery({
    queryKey: platformKeys.buildingTenants(buildingId),
    queryFn: () => getBuildingTenants(buildingId),
    enabled: Number.isFinite(buildingId) && buildingId > 0,
  });
}

export function useUnitOccupancy(unitId: number) {
  return useQuery({
    queryKey: platformKeys.unit(unitId),
    queryFn: () => getUnitOccupancy(unitId),
    enabled: Number.isFinite(unitId) && unitId > 0,
  });
}
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run hooks/reactquery/platform/drilldown.test.ts` → PASS (4 tests).

- [ ] **Step 6: 커밋**

```bash
git add hooks/reactquery/platform/drilldown.ts hooks/reactquery/platform/drilldown.test.ts hooks/reactquery/platform/queries.ts
git commit -m "feat(platform): getBuildingTenants·getUnitOccupancy 크로스-org 조회"
```

---

## Task 4: UI — 조직 상세(건물 목록) + 조직명 링크

**Files:** Create `app/(platform-admin)/platform-admin/organizations/[orgId]/page.tsx`, `.../[orgId]/components/OrgBuildingsList.tsx`, `.../[orgId]/components/OrgBuildingsList.test.tsx`; Modify `.../organizations/page.tsx`

**Interfaces:** Consumes `useOrgBuildings` (Task 2), `DataTable`/`EmptyState`/`Spinner` (`@/components/common`), `PageHeader`/`QueryError`/`StatusBadge` (`@/app/(platform-admin)/_components/PageElements`).

- [ ] **Step 1: 실패 테스트** — `.../[orgId]/components/OrgBuildingsList.test.tsx`

```tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/reactquery/platform", () => ({ useOrgBuildings: vi.fn() }));
import { OrgBuildingsList } from "./OrgBuildingsList";
import { useOrgBuildings } from "@/hooks/reactquery/platform";
beforeEach(() => vi.clearAllMocks());

describe("OrgBuildingsList", () => {
  it("로딩 상태", () => {
    vi.mocked(useOrgBuildings).mockReturnValue({ isPending: true, data: undefined } as never);
    render(<OrgBuildingsList orgId={3} />);
    expect(screen.getByLabelText("불러오는 중")).toBeInTheDocument();
  });
  it("건물 없음", () => {
    vi.mocked(useOrgBuildings).mockReturnValue({ isPending: false, isError: false, data: { org: { id: 3, name: "가나관리", slug: "gana", status: "active" }, buildings: [] } } as never);
    render(<OrgBuildingsList orgId={3} />);
    expect(screen.getByText("등록된 건물이 없습니다")).toBeInTheDocument();
  });
  it("목록 + 행 클릭 시 건물 상세로", () => {
    vi.mocked(useOrgBuildings).mockReturnValue({ isPending: false, isError: false, data: { org: { id: 3, name: "가나관리", slug: "gana", status: "active" }, buildings: [{ id: 7, code: "B0007", name: "가나빌", address: "서울" }] } } as never);
    render(<OrgBuildingsList orgId={3} />);
    expect(screen.getByText("가나빌")).toBeInTheDocument();
    fireEvent.click(screen.getByText("가나빌"));
    expect(push).toHaveBeenCalledWith("/platform-admin/organizations/3/buildings/7");
  });
});
```

> `Spinner`는 `aria-label="불러오는 중"`을 갖는다(기존 `components/common/Spinner`). 만약 라벨이 다르면 테스트를 실제 라벨로 맞춘다.

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(platform-admin)/platform-admin/organizations/[orgId]/components/OrgBuildingsList.test.tsx"` → FAIL.

- [ ] **Step 3: 컴포넌트 구현** — `.../[orgId]/components/OrgBuildingsList.tsx`

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, EmptyState, Spinner } from "@/components/common";
import { PageHeader, QueryError, StatusBadge } from "@/app/(platform-admin)/_components/PageElements";
import { useOrgBuildings } from "@/hooks/reactquery/platform";

export function OrgBuildingsList({ orgId }: { orgId: number }) {
  const router = useRouter();
  const { data, isPending, isError, refetch } = useOrgBuildings(orgId);

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <nav className="mb-3 text-xs text-t3">
        <Link href="/platform-admin/organizations" className="hover:underline">조직 관리</Link>
        <span className="mx-1.5">›</span>
        {data?.org.name ?? "조직"}
      </nav>
      <PageHeader
        eyebrow="ORGANIZATION"
        title={data?.org.name ?? "조직 상세"}
        description="이 조직의 건물 목록입니다. 건물을 선택하면 입주민을 조회합니다."
      />
      {data?.org && <div className="mt-4"><StatusBadge status={data.org.status} /></div>}

      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line p-4">
          <h3 className="text-base font-extrabold text-t1">건물 목록{data ? ` · ${data.buildings.length}개` : ""}</h3>
        </div>
        {isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : isError ? (
          <div className="p-4"><QueryError onRetry={() => void refetch()} /></div>
        ) : (data?.buildings.length ?? 0) === 0 ? (
          <EmptyState message="등록된 건물이 없습니다" />
        ) : (
          <DataTable
            columns={[
              { key: "code", label: "코드" },
              { key: "name", label: "건물명" },
              { key: "address", label: "주소" },
            ]}
            rows={(data?.buildings ?? []).map((b) => ({
              _id: b.id, code: b.code, name: b.name, address: b.address ?? "—",
            }))}
            onRowClick={(row) => router.push(`/platform-admin/organizations/${orgId}/buildings/${row._id}`)}
          />
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: page 작성** — `.../[orgId]/page.tsx`

```tsx
"use client";
import { useParams } from "next/navigation";
import { OrgBuildingsList } from "./components/OrgBuildingsList";

export default function PlatformOrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  return <OrgBuildingsList orgId={Number(orgId)} />;
}
```

- [ ] **Step 5: 조직명 → 상세 링크** — `.../organizations/page.tsx`

상단 import 추가: `import Link from "next/link";`
조직명 셀을 링크로 교체:
```tsx
                    <td className="px-5 py-4">
                      <Link
                        href={`/platform-admin/organizations/${organization.id}`}
                        className="font-bold text-t1 hover:text-blue hover:underline"
                      >
                        {organization.name}
                      </Link>
                      <div className="mt-1 text-xs text-t3">{organization.slug ?? "회사코드 미설정"}</div>
                    </td>
```

- [ ] **Step 6: 통과 확인** — Run: `npx vitest run "app/(platform-admin)/platform-admin/organizations/[orgId]/components/OrgBuildingsList.test.tsx"` → PASS. 또한 `npx vitest run "app/(platform-admin)"`로 기존 organizations 관련 회귀 없음 확인.

- [ ] **Step 7: 커밋**

```bash
git add "app/(platform-admin)/platform-admin/organizations"
git commit -m "feat(platform): 조직 상세(건물 목록) 화면 + 조직명 드릴인 링크"
```

---

## Task 5: UI — 건물 상세(입주민 목록)

**Files:** Create `.../[orgId]/buildings/[buildingId]/page.tsx`, `.../buildings/[buildingId]/components/BuildingTenantsList.tsx`(+`.test.tsx`)

**Interfaces:** Consumes `useBuildingTenants` (Task 3), `DataTable`/`EmptyState`/`Spinner`, `PageHeader`/`QueryError`.

- [ ] **Step 1: 실패 테스트** — `.../buildings/[buildingId]/components/BuildingTenantsList.test.tsx`

```tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/reactquery/platform", () => ({ useBuildingTenants: vi.fn() }));
import { BuildingTenantsList } from "./BuildingTenantsList";
import { useBuildingTenants } from "@/hooks/reactquery/platform";
beforeEach(() => vi.clearAllMocks());

const DATA = {
  org: { id: 3, name: "가나관리" },
  building: { id: 7, name: "가나빌" },
  tenants: [{ unitId: 11, occupancyId: 22, unitNo: "101", tenantName: "홍길동", residentCount: 2, moveInDate: "2026-01-01", isVacant: false }],
};

describe("BuildingTenantsList", () => {
  it("세대 없음", () => {
    vi.mocked(useBuildingTenants).mockReturnValue({ isPending: false, isError: false, data: { ...DATA, tenants: [] } } as never);
    render(<BuildingTenantsList orgId={3} buildingId={7} />);
    expect(screen.getByText("등록된 세대가 없습니다")).toBeInTheDocument();
  });
  it("목록 + 행 클릭 시 세대 상세로", () => {
    vi.mocked(useBuildingTenants).mockReturnValue({ isPending: false, isError: false, data: DATA } as never);
    render(<BuildingTenantsList orgId={3} buildingId={7} />);
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    fireEvent.click(screen.getByText("홍길동"));
    expect(push).toHaveBeenCalledWith("/platform-admin/organizations/3/buildings/7/units/11");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(platform-admin)/platform-admin/organizations/[orgId]/buildings/[buildingId]/components/BuildingTenantsList.test.tsx"` → FAIL.

- [ ] **Step 3: 컴포넌트 구현** — `.../buildings/[buildingId]/components/BuildingTenantsList.tsx`

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, EmptyState, Spinner } from "@/components/common";
import { PageHeader, QueryError } from "@/app/(platform-admin)/_components/PageElements";
import { useBuildingTenants } from "@/hooks/reactquery/platform";

export function BuildingTenantsList({ orgId, buildingId }: { orgId: number; buildingId: number }) {
  const router = useRouter();
  const { data, isPending, isError, refetch } = useBuildingTenants(buildingId);

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <nav className="mb-3 text-xs text-t3">
        <Link href="/platform-admin/organizations" className="hover:underline">조직 관리</Link>
        <span className="mx-1.5">›</span>
        <Link href={`/platform-admin/organizations/${orgId}`} className="hover:underline">{data?.org.name ?? "조직"}</Link>
        <span className="mx-1.5">›</span>
        {data?.building.name ?? "건물"}
      </nav>
      <PageHeader
        eyebrow="BUILDING"
        title={data?.building.name ?? "건물 상세"}
        description="이 건물의 입주민(세대) 목록입니다. 세대를 선택하면 상세를 조회합니다."
      />

      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line p-4">
          <h3 className="text-base font-extrabold text-t1">입주민 목록{data ? ` · ${data.tenants.length}세대` : ""}</h3>
        </div>
        {isPending ? (
          <div className="py-16"><Spinner /></div>
        ) : isError ? (
          <div className="p-4"><QueryError onRetry={() => void refetch()} /></div>
        ) : (data?.tenants.length ?? 0) === 0 ? (
          <EmptyState message="등록된 세대가 없습니다" />
        ) : (
          <DataTable
            columns={[
              { key: "unitNo", label: "호실" },
              { key: "tenantName", label: "입주자" },
              { key: "residents", label: "거주인원" },
              { key: "moveIn", label: "입주일" },
              { key: "vacancy", label: "상태" },
            ]}
            rows={(data?.tenants ?? []).map((t) => ({
              _id: t.unitId,
              unitNo: t.unitNo,
              tenantName: t.tenantName ?? "—",
              residents: t.residentCount ?? "—",
              moveIn: t.moveInDate ?? "—",
              vacancy: t.isVacant ? "공실" : "입주",
            }))}
            onRowClick={(row) => router.push(`/platform-admin/organizations/${orgId}/buildings/${buildingId}/units/${row._id}`)}
          />
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: page 작성** — `.../buildings/[buildingId]/page.tsx`

```tsx
"use client";
import { useParams } from "next/navigation";
import { BuildingTenantsList } from "./components/BuildingTenantsList";

export default function PlatformBuildingDetailPage() {
  const { orgId, buildingId } = useParams<{ orgId: string; buildingId: string }>();
  return <BuildingTenantsList orgId={Number(orgId)} buildingId={Number(buildingId)} />;
}
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run "app/(platform-admin)/platform-admin/organizations/[orgId]/buildings/[buildingId]/components/BuildingTenantsList.test.tsx"` → PASS.

- [ ] **Step 6: 커밋**

```bash
git add "app/(platform-admin)/platform-admin/organizations/[orgId]/buildings"
git commit -m "feat(platform): 건물 상세(입주민 목록) 화면"
```

---

## Task 6: UI — 세대 상세(읽기전용)

**Files:** Create `.../buildings/[buildingId]/units/[unitId]/page.tsx`, `.../units/[unitId]/components/UnitDetailView.tsx`(+`.test.tsx`)

**Interfaces:** Consumes `useUnitOccupancy` (Task 3), `Spinner`, `PageHeader`/`QueryError`.

- [ ] **Step 1: 실패 테스트** — `.../units/[unitId]/components/UnitDetailView.test.tsx`

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/platform", () => ({ useUnitOccupancy: vi.fn() }));
import { UnitDetailView } from "./UnitDetailView";
import { useUnitOccupancy } from "@/hooks/reactquery/platform";
beforeEach(() => vi.clearAllMocks());

describe("UnitDetailView", () => {
  it("입주 정보 + 빵부스러기 렌더", () => {
    vi.mocked(useUnitOccupancy).mockReturnValue({ isPending: false, isError: false, data: {
      unitId: 11, unitNo: "101", dong: "가", areaPyeong: 24, roomCount: 2,
      buildingId: 7, buildingName: "가나빌", orgId: 3, orgName: "가나관리",
      occupancy: { occupancyId: 22, tenantName: "홍길동", payerName: "홍길동", phone: "010", phone2: null, phone3: null, vehicleNo: null, residentCount: 2, roomTypeLabel: "원룸", moveInDate: "2026-01-01", moveOutDate: null, status: "occupied", billingNote: null, facilityNote: null },
    } } as never);
    render(<UnitDetailView orgId={3} buildingId={7} unitId={11} />);
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("가나관리")).toBeInTheDocument();
    expect(screen.getByText("가나빌")).toBeInTheDocument();
  });
  it("공실 안내", () => {
    vi.mocked(useUnitOccupancy).mockReturnValue({ isPending: false, isError: false, data: {
      unitId: 12, unitNo: "102", dong: null, areaPyeong: null, roomCount: null,
      buildingId: 7, buildingName: "가나빌", orgId: 3, orgName: "가나관리", occupancy: null,
    } } as never);
    render(<UnitDetailView orgId={3} buildingId={7} unitId={12} />);
    expect(screen.getByText("현재 입주 정보가 없습니다(공실).")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(platform-admin)/platform-admin/organizations/[orgId]/buildings/[buildingId]/units/[unitId]/components/UnitDetailView.test.tsx"` → FAIL.

- [ ] **Step 3: 컴포넌트 구현** — `.../units/[unitId]/components/UnitDetailView.tsx`

```tsx
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Spinner } from "@/components/common";
import { PageHeader, QueryError } from "@/app/(platform-admin)/_components/PageElements";
import { useUnitOccupancy } from "@/hooks/reactquery/platform";

const STATUS_LABEL: Record<string, string> = { occupied: "입주", vacant: "공실", moving_out: "이사예정" };

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-t4">{label}</dt>
      <dd className="text-sm text-t1">{value === null || value === undefined || value === "" ? "—" : value}</dd>
    </div>
  );
}

export function UnitDetailView({ orgId, buildingId, unitId }: { orgId: number; buildingId: number; unitId: number }) {
  const { data, isPending, isError, refetch } = useUnitOccupancy(unitId);
  const o = data?.occupancy;

  return (
    <div className="mx-auto w-full max-w-5xl p-5 sm:p-6 lg:p-8">
      <nav className="mb-3 text-xs text-t3">
        <Link href="/platform-admin/organizations" className="hover:underline">조직 관리</Link>
        <span className="mx-1.5">›</span>
        <Link href={`/platform-admin/organizations/${orgId}`} className="hover:underline">{data?.orgName ?? "조직"}</Link>
        <span className="mx-1.5">›</span>
        <Link href={`/platform-admin/organizations/${orgId}/buildings/${buildingId}`} className="hover:underline">{data?.buildingName ?? "건물"}</Link>
        <span className="mx-1.5">›</span>
        {data?.unitNo ?? "세대"}
      </nav>
      <PageHeader eyebrow="UNIT" title={data ? `${data.unitNo} 세대` : "세대 상세"} description="세대·입주 정보입니다. (읽기 전용)" />

      {isPending ? (
        <div className="py-16"><Spinner /></div>
      ) : isError ? (
        <div className="mt-6"><QueryError onRetry={() => void refetch()} /></div>
      ) : !data ? (
        <p className="mt-6 text-sm text-t3">세대를 찾을 수 없습니다.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h3 className="mb-3 text-sm font-extrabold text-t2">세대 정보</h3>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="호실" value={data.unitNo} />
              <Field label="동" value={data.dong} />
              <Field label="면적(평)" value={data.areaPyeong} />
              <Field label="방 수" value={data.roomCount} />
            </dl>
          </section>
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h3 className="mb-3 text-sm font-extrabold text-t2">입주 정보</h3>
            {o == null ? (
              <p className="text-sm text-t3">현재 입주 정보가 없습니다(공실).</p>
            ) : (
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="입주자명" value={o.tenantName} />
                <Field label="납부자명" value={o.payerName} />
                <Field label="연락처" value={o.phone} />
                <Field label="상태" value={STATUS_LABEL[o.status] ?? o.status} />
                <Field label="거주인원" value={o.residentCount} />
                <Field label="룸타입" value={o.roomTypeLabel} />
                <Field label="입주일" value={o.moveInDate} />
                <Field label="퇴거일" value={o.moveOutDate} />
                <Field label="차량번호" value={o.vehicleNo} />
                <Field label="부가연락처" value={o.phone2} />
                <Field label="비고(부과)" value={o.billingNote} />
                <Field label="비고(시설)" value={o.facilityNote} />
              </dl>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: page 작성** — `.../units/[unitId]/page.tsx`

```tsx
"use client";
import { useParams } from "next/navigation";
import { UnitDetailView } from "./components/UnitDetailView";

export default function PlatformUnitDetailPage() {
  const { orgId, buildingId, unitId } = useParams<{ orgId: string; buildingId: string; unitId: string }>();
  return <UnitDetailView orgId={Number(orgId)} buildingId={Number(buildingId)} unitId={Number(unitId)} />;
}
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run "app/(platform-admin)/platform-admin/organizations/[orgId]/buildings/[buildingId]/units/[unitId]/components/UnitDetailView.test.tsx"` → PASS.

- [ ] **Step 6: 커밋**

```bash
git add "app/(platform-admin)/platform-admin/organizations/[orgId]/buildings/[buildingId]/units"
git commit -m "feat(platform): 세대 상세(읽기전용) 화면"
```

---

## Task 7: 통합 검증 + WBS 동기화

**Files:** (없음 — 검증·정리)

- [ ] **Step 1: 전체 테스트** — Run: `npm test` → 전체 PASS(신규 drilldown·UI 테스트 포함, 기존 platform-admin 회귀 없음). 실패 시 해당 태스크로 복귀.
- [ ] **Step 2: 린트** — Run: `npm run lint` → 신규 파일 관련 에러 0. (`@/app/(platform-admin)/_components/PageElements` alias import가 lint/tsc 통과하는지 확인. 만약 실패하면 상대경로로 교체: 컴포넌트 깊이에 맞춰 `../../../…/_components/PageElements`.)
- [ ] **Step 3: 빌드** — Run: `npm run build` → 성공. `(platform-admin)/…/organizations/[orgId]/…` 3개 라우트가 정상 컴파일. `next build`가 AGENTS.md 블록을 재생성하면 함께 커밋.
- [ ] **Step 4: DB 라이브 검증(가능 시)** — 0008 적용 + `psql "$DATABASE_URL" -f supabase/verify/platform_drilldown_checks.sql` → 예외 없음. platform_admin 세션으로 타 org 건물/입주민 조회, 일반 staff는 자기 org만 확인. (DB 미접근 시 라이브 대기로 명시.)
- [ ] **Step 5: 잔여 커밋** — `git add -A && git commit -m "chore(platform): 드릴다운 통합 검증 반영" || echo "no changes"`
- [ ] **Step 6: WBS 동기화** — `wbs-commit-sync` 스킬로 통합관리자 버킷의 조직/건물·입주민 관련 화면 dev 상태 갱신(고신뢰 자동, 애매하면 질문). `완료` 자동변경 금지. 매칭 후보 없으면 신규 page 등록 여부 질문.
- [ ] **Step 7: 보안 관찰 보고(수정 아님)** — 리포트에 명시: 크로스-org 게이트 `current_user_is_platform_admin()`는 `org_members.role='platform_admin'` 기반이라 org 마스터가 `admin_set_member_permissions`로 자가부여 가능(자가승격 벡터). **기존 platform-admin 설계 이슈**로 본 드릴다운 범위 밖 — 사용자에게 별도 검토 권고.

---

## Self-Review (작성자 점검)

**Spec 커버리지:** RLS 예외(4정책)→Task1; 데이터 3함수→Task2·3; UI 드릴다운 3화면+진입링크→Task4·5·6; 통합·WBS·보안노트→Task7. "사무소 검색"은 기존 조직 관리 SearchBar가 이미 충족(추가 개발 불필요) — 명시함.

**플레이스홀더:** 모든 코드/테스트/명령·기대결과 실체 포함. DB 라이브 검증만 환경상 이연(명시). Spinner aria-label·PageElements alias는 첫 사용 태스크에서 실측 확인 지시.

**타입 일관성:** `getOrgBuildings/getBuildingTenants/getUnitOccupancy` ↔ 훅 `useOrgBuildings/useBuildingTenants/useUnitOccupancy` ↔ 키 `platformKeys.orgBuildings/buildingTenants/unit` 일치. 타입 `PlatformBuilding/PlatformTenantRow/PlatformUnitDetail` 및 결과 래퍼(`OrgBuildingsResult{org,buildings}`, `BuildingTenantsResult{org,building,tenants}`)가 Task2·3 정의 ↔ Task4·5·6 소비 일치. 라우트 경로 `/platform-admin/organizations/[orgId]/buildings/[buildingId]/units/[unitId]`가 링크·page·테스트에서 동일.

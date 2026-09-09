# A/S·퇴실 신청 현황 공통 우측 패널 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원본 프로토타입의 우측 `.rnb` 패널("A/S 접수·퇴실 신청 현황", 2탭)을 실데이터로 구현하고 `AppShell`에 스태프 전역 통합한다.

**Architecture:** 신규 공통 컴포넌트 `components/shell/as-rail/*`(client) + CSS 모듈(원본 CSS verbatim 이식). A/S 탭은 기존 `useComplaints` 재사용, 퇴실 탭은 신규 `hooks/reactquery/staffMoveOut` direct-select(마이그 없음). `AppShell`에서 전역 렌더, 기존 `QuickAccessRail` 스텁 제거.

**Tech Stack:** Next.js(App Router), React, TanStack Query, Supabase PostgREST(client), CSS Modules, Playwright(pixel-diff).

**Spec:** `docs/superpowers/specs/2026-09-09-as-reception-rail-design.md`

## Global Constraints

- **픽셀 퍼펙트**: 표현은 원본 `docs/prototype/staff/fee-item/fee-item.dc.html`와 완전 정합. CSS는 원본 `<style>`(167–306행) **verbatim 이식**, 값 변경 금지.
- **색상 토큰**: 청록 `--blue:#14A497` + `--blue2` 보조. 상태색 `--red #F04452`/`--amber #FF922B`/`--green #12B886` 및 `-t` 틴트.
- **신규 단위테스트 없음**(메모리 `unit-tests-postponed`): TDD 대신 각 태스크 말미 검증 = `tsc`(소스만) + `lint` + 필요 시 `build`/스팟체크, 기존 `vitest` 회귀 없음. **새 `*.test.ts(x)` 작성하지 않는다.**
- **마이그레이션 없음**(결정 D5): 기존 테이블·RLS·훅만 사용. 불가피 시 커밋 직전 `origin/master` max 번호 재확인.
- **읽기전용 + 단일 쓰기**: A/S 탭은 읽기+네비게이트. 퇴실 탭의 유일한 쓰기 = "처리 완료"(결정 A1).
- **FAB 제외**(결정 A2): 청록 메신저 FAB는 이 태스크에서 렌더하지 않는다.
- **tsc 노이즈**: Next dev 병행 시 `.next` validator 노이즈는 `npx tsc --noEmit 2>&1 | grep -vE '\.next'`로 소스 에러만 확인.

## Verification Environment (Task 1 전에 1회)

이 워크트리(`workspaces/home_erp/as-status-rail`)엔 `node_modules`가 없다. 검증 명령 실행 전, `projects/home_erp`(node_modules 보유, 동일 base)에서 정션 연결한다(메모리 `home-erp-worktree-devserver-verification`):

```bash
# Windows(cmd) 정션 — 워크트리 루트에서
cmd //c "mklink /J node_modules C:\Users\leebj\orca\projects\home_erp\node_modules"
# 확인
node -e "require('typescript');console.log('ts ok')"
```

작업 완료 후 정션 제거: `cmd //c "rmdir node_modules"` (실디렉터리 삭제 아님, 정션만 해제).

검증 명령(이하 태스크에서 "검증"이라 하면 아래 중 해당 항목):
- `npx tsc --noEmit 2>&1 | grep -vE '\.next' | grep -E 'error TS' || echo "tsc clean"`
- `npm run lint`
- `npm run build`
- `npm test`(vitest 전건)

라이브 프리뷰/pixel-diff용 dev 서버는 이 워크트리에서 `npm run dev`로 브랜치를 서빙해야 한다(§Task 8).

## File Structure

**신규**
- `components/shell/as-rail/AsRail.module.css` — 원본 CSS verbatim 이식(§Global).
- `components/shell/as-rail/constants.ts` — AS 상태색맵·라벨, 퇴실 배지맵, 날짜 포맷터(mmdd/hhmm/ymd).
- `components/shell/as-rail/useRailOpen.ts` — 열림 상태 훅(localStorage, 기본 false).
- `components/shell/as-rail/FilterDropdown.tsx` — 원본 `.dd` 정합 로컬 드롭다운(단일/멀티/검색 변형).
- `components/shell/as-rail/AsReceptionCard.tsx` — 민원 카드(`a.rnb-card`).
- `components/shell/as-rail/AsReceptionList.tsx` — A/S 탭(필터바 + 리스트 + empty/loading/error).
- `components/shell/as-rail/MoveOutCard.tsx` — 퇴실 카드(`a.mv-card`) + 처리완료 버튼.
- `components/shell/as-rail/MoveOutConfirmDialog.tsx` — 처리완료 확인 다이얼로그.
- `components/shell/as-rail/MoveOutList.tsx` — 퇴실 탭(필터바 + 리스트 + empty).
- `components/shell/as-rail/AsReceptionRail.tsx` — 최상위(핸들·헤더·탭·토글·새로고침).
- `hooks/reactquery/staffMoveOut/apis.ts` · `keys.ts` · `queries.ts` · `mutations.ts` — 퇴실 스태프 데이터 계층.

**수정/삭제**
- Modify: `components/shell/AppShell.tsx` — `<AsReceptionRail/>` 전역 마운트.
- Delete: `components/shell/QuickAccessRail.tsx`, `app/(staff)/staff/(app)/fee-items/components/FeeItemRightRail.tsx`.
- Modify: `app/(staff)/staff/(app)/moving-settlement/components/SettlementInquiryPage.tsx` — `<QuickAccessRail/>` 렌더·import 제거.
- Modify: fee-items 페이지 — `<FeeItemRightRail/>` 사용 제거(Task 7에서 grep로 확정).
- Modify: `scripts/pixel-diff/capture.mjs`, `scripts/pixel-diff/targets.json` — 열림 상태 캡처.

---

### Task 1: 기반 — CSS 모듈 · constants · useRailOpen

**Files:**
- Create: `components/shell/as-rail/AsRail.module.css`
- Create: `components/shell/as-rail/constants.ts`
- Create: `components/shell/as-rail/useRailOpen.ts`

**Interfaces:**
- Produces:
  - CSS 모듈 클래스: `rnb`, `rnbOff`, `rnbHandle`, `rnbH`, `rnbTabs`, `rnbTn`, `rnbBody`, `rnbCard`, `rnbKv`, `rnbRefresh`, `rnbDetail`, `asfBar`, `asfDd`, `asfBld`, `asfOpts`, `asfSrch`, `asfQ`, `asfO`, `asfCode`, `asfTxt`, `asfSel`, `asfSort`, `asStatus`, `asTag`, `mvList`, `mvCard`, `mvTop`, `mvSt`, `mvNew`, `mvCk`, `mvR`, `mvAct`, `mvDone`, `mvEmpty`, `dd`, `ddCtl`, `ddMenu`, `ddOpt` (CSS Modules는 camelCase 접근 — 원본 kebab 클래스명을 매핑).
  - `constants.ts`: `AS_STATUS_LABEL: Record<ComplaintStatus,string>`, `AS_STATUS_COLOR: Record<ComplaintStatus,string>`, `MOVE_OUT_BADGE: Record<'pending'|'confirmed',{label:string;cls:'mvNew'|'mvCk'}>`, `mmdd(iso)`, `hhmm(iso)`, `ymd(iso)`.
  - `useRailOpen(): { open: boolean; toggle(): void; setOpen(v:boolean):void }`.

- [ ] **Step 1: CSS 모듈 verbatim 이식**

`docs/prototype/staff/fee-item/fee-item.dc.html`의 `<style>`에서 다음 규칙을 **값 그대로** `AsRail.module.css`로 옮긴다(대상 라인 대략 167–306). CSS Modules는 로컬 스코프이므로 전역 셀렉터를 클래스로 변환하되 **속성/수치는 절대 바꾸지 않는다**. `:has()` 기반 필터 토글(원본 230–235행)은 React state로 대체하므로 CSS의 `:has` 규칙은 이식하지 않는다(대신 활성 클래스로 처리). 핵심 규칙(값 예시 — 원본과 일치해야 함):

```css
/* 원본 168~209행 골격 */
.rnb{position:fixed;top:0;right:0;height:100vh;width:404px;z-index:70;background:#fff;border-left:1px solid var(--line);display:flex;flex-direction:column;overflow:hidden;box-shadow:-14px 0 36px -18px rgba(23,31,40,.3);transition:transform .18s ease}
.rnbOff{transform:translateX(100%);box-shadow:none}
.rnbHandle{position:fixed;top:50%;right:404px;transform:translateY(-50%);transition:right .18s ease;z-index:80;width:30px;height:70px;border-radius:12px 0 0 12px;background:#fff;border:1px solid var(--line);border-right:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--t2);box-shadow:-6px 0 16px -8px rgba(23,31,40,.25)}
.rnbHandle:hover{background:var(--bg);color:var(--blue)}
/* 접힘 시 핸들은 right:0 */
.rnbHandleOff{right:0}
.rnbH{height:62px;flex:none;display:flex;align-items:center;gap:8px;padding:0 18px;border-bottom:1px solid var(--line)}
.rnbTabs{flex:none;display:flex;gap:2px;padding:8px 12px 0;border-bottom:1px solid var(--line)}
.rnbBody{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#fff}
.asStatus{display:inline-flex;align-items:center;font-size:11.5px;font-weight:800;padding:3px 8px;border-radius:7px}
/* .asStatus 색상: data-c 대신 인라인 style 또는 색상별 클래스로 — 값은 원본 236~239행 */
.mvCard{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:13px 14px;cursor:pointer;text-decoration:none;color:inherit}
```

원본 전체 규칙(`.rnb-tabs a`, `.rnb-tn`, `.rnb-card`, `.rnb-kv`, `.rnb-refresh`, `.rnb-detail`, `.asf-*`, `.as-tag`, `.mv-*`, `.mvq*`, `.dd*`)을 빠짐없이 이식한다. `var(--line)`/`var(--blue)` 등 토큰은 앱 전역 `globals.css`에 이미 정의(청록 피벗 완료)되어 그대로 사용.

- [ ] **Step 2: constants.ts 작성**

```ts
import type { ComplaintStatus } from "@/hooks/reactquery/complaints";

// 라벨 — 원본 필터 드롭다운/배지 문구와 일치(미결/보류/완결/반복)
export const AS_STATUS_LABEL: Record<ComplaintStatus, string> = {
  pending: "미결",
  on_hold: "보류",
  completed: "완결",
  repeat: "반복",
};

// 프로토타입 .as-status[data-c] 정합 색상(receipts의 COMPLAINT_STATUS_STYLE와 의도적으로 다름 — 별도 표면)
export const AS_STATUS_COLOR: Record<ComplaintStatus, string> = {
  pending: "var(--red)",
  on_hold: "var(--amber)",
  completed: "var(--green)",
  repeat: "var(--amber)",
};

export const MOVE_OUT_BADGE = {
  pending: { label: "신규", cls: "mvNew" as const },
  confirmed: { label: "확인", cls: "mvCk" as const },
};

function d(iso?: string | null): Date | null {
  if (!iso) return null;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
const p2 = (n: number) => String(n).padStart(2, "0");

export function mmdd(iso?: string | null): string {
  const dt = d(iso);
  return dt ? `${p2(dt.getMonth() + 1)}.${p2(dt.getDate())}` : "-";
}
export function hhmm(iso?: string | null): string {
  const dt = d(iso);
  return dt ? `${p2(dt.getHours())}:${p2(dt.getMinutes())}` : "-";
}
export function ymd(iso?: string | null): string {
  const dt = d(iso);
  return dt ? `${dt.getFullYear()}.${p2(dt.getMonth() + 1)}.${p2(dt.getDate())}` : "-";
}
```

- [ ] **Step 3: useRailOpen.ts 작성**

```ts
"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "as-rail:open";

export function useRailOpen() {
  const [open, setOpenState] = useState(false); // 기본 접힘(결정 D4)
  useEffect(() => {
    try {
      setOpenState(window.localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);
  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    try {
      window.localStorage.setItem(KEY, v ? "1" : "0");
    } catch {}
  }, []);
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  return { open, toggle, setOpen };
}
```

- [ ] **Step 4: 검증** — `npx tsc --noEmit`(소스 clean) + `npm run lint`. CSS 모듈은 아직 미소비라 unused 경고 없어야 함(파일만 존재).

- [ ] **Step 5: Commit**

```bash
git add components/shell/as-rail/AsRail.module.css components/shell/as-rail/constants.ts components/shell/as-rail/useRailOpen.ts
git commit -m "feat(as-rail): CSS 모듈 이식·상태/포맷 상수·열림 훅 기반"
```

---

### Task 2: FilterDropdown (원본 `.dd` 정합 로컬 드롭다운)

**Files:**
- Create: `components/shell/as-rail/FilterDropdown.tsx`

**Interfaces:**
- Consumes: `AsRail.module.css`(dd·ddCtl·ddMenu·ddOpt·asf* 클래스).
- Produces:
  - `interface DdOption { value: string; label: string; sub?: string; code?: string }`
  - `FilterDropdown({ label, value, options, onChange, searchable?, ariaLabel })` — 단일 선택(건물·유형·담당자·접수자·정렬).
  - `MultiFilterDropdown({ label, values, options, onChange, ariaLabel })` — 다중 선택(상태). `onChange(next: string[])`.

**설계**: 버튼(`ddCtl`) 클릭 → 메뉴(`ddMenu`) 토글. 바깥 클릭 닫힘(`useEffect` + document mousedown). `searchable`이면 상단 `asfSrch` 입력으로 옵션 필터(건물). 활성 옵션 `asf-o on`/`dd-opt on` 클래스. 값 표시: 단일=선택 label, 멀티=`"<첫 label> 외 N"`(원본 "미결 외 1" 정합). 원본 마크업(384행 `.dd`/`.dd-menu`/`.dd-opt`, `.asf-bld`/`.asf-opts`/`.asf-srch`/`.asf-o`) 구조·SVG chevron 그대로.

- [ ] **Step 1: FilterDropdown/MultiFilterDropdown 구현** (원본 마크업·클래스 정합; 외부클릭 닫힘; searchable 필터; 멀티 라벨 "외 N").
- [ ] **Step 2: 검증** — `tsc` + `lint`.
- [ ] **Step 3: Commit**

```bash
git add components/shell/as-rail/FilterDropdown.tsx
git commit -m "feat(as-rail): 원본 .dd 정합 필터 드롭다운(단일·멀티·검색)"
```

---

### Task 3: A/S 탭 — AsReceptionCard + AsReceptionList

**Files:**
- Create: `components/shell/as-rail/AsReceptionCard.tsx`
- Create: `components/shell/as-rail/AsReceptionList.tsx`

**Interfaces:**
- Consumes: `useComplaints(filters: ComplaintFilters)` from `@/hooks/reactquery/complaints`; `Complaint`, `ComplaintStatus` types; `useBuildings()` `@/hooks/reactquery/buildings`; `useAccounts()` `@/hooks/reactquery/accounts`; `useAsCategories()` `@/hooks/reactquery/asCategories`; constants(Task 1); FilterDropdown(Task 2); `useRouter` `next/navigation`.
- Produces: `AsReceptionList({ refreshSignal? })`(default export 아님, named). `AsReceptionCard({ complaint, nameOf })`.

원본 참조: 카드 마크업 = fee-item.dc.html **384–473행**, 필터바 = **384행 `.asf-bar`**.

- [ ] **Step 1: AsReceptionCard 구현**

`a.rnb-card`(클릭 → `router.push('/staff/receipts')`). 표시(원본 385–392행 정합):
- 헤더 `row-sb`: `#{id} · {buildingName} {unitDong?}{unitNo}` + `.asStatus`(색=`AS_STATUS_COLOR[status]` 인라인 style, 문구=`AS_STATUS_LABEL[status]`).
- 태그줄: `.asTag`={categoryLabel} · `hhmm(receivedAt)` · 우측 담당자명=`nameOf(assignedTo)`.
- 본문: `content ?? title`.
- 구분선 + `.rnbKv` 4줄: 접수일/시행일=`mmdd(receivedAt) / mmdd(completedAt ?? resolutions[0]?.resolvedAt)`; 접수시 전화=`reporterPhone ?? '-'`; 담당자/접수=`nameOf(assignedTo) / nameOf(createdBy)`; 처리결과=`resolutions[0]?.resultContent ?? '-'`.

- [ ] **Step 2: AsReceptionList 구현**

- 로컬 state: `buildingId?`, `statuses: ComplaintStatus[]`, `mgr?`(assignedTo uuid), `rec?`(createdBy uuid), `categoryId?`, `sort:'desc'|'asc'`, `search`.
- 서버필터로 `useComplaints({ buildingId, categoryId, statuses, search })`. 담당자/접수자/정렬은 클라이언트 후처리.
- `nameOf`: `const accounts = useAccounts();` → `new Map(accounts.map(a=>[a.userId,a.fullName]))`; `nameOf(id)= id? map.get(id) ?? '-' : '-'`.
- 필터바(FilterDropdown): 건물(`useBuildings()`→{value:String(id),label:name}, searchable), 상태(Multi: pending/on_hold/completed/repeat, 라벨=AS_STATUS_LABEL), 담당자(field_staff accounts), 접수자(all accounts), 유형(`useAsCategories()`→{value:String(id),label}), 정렬(최신순/오래된순).
- 결과 정렬: `receivedAt` desc/asc; 담당자/접수자 클라 필터.
- 상태 표시: `isLoading`→spinner(기존 `@/components/common` `Spinner`), `error`→`EmptyState`, 빈 배열→`EmptyState message="접수 내역이 없어요"`, else 카드 리스트(`rnbBody`).

- [ ] **Step 3: 검증** — `tsc` + `lint`.
- [ ] **Step 4: Commit**

```bash
git add components/shell/as-rail/AsReceptionCard.tsx components/shell/as-rail/AsReceptionList.tsx
git commit -m "feat(as-rail): A/S 접수 탭(useComplaints 배선·필터·카드)"
```

---

### Task 4: 퇴실 데이터 계층 — hooks/reactquery/staffMoveOut

**Files:**
- Create: `hooks/reactquery/staffMoveOut/apis.ts`
- Create: `hooks/reactquery/staffMoveOut/keys.ts`
- Create: `hooks/reactquery/staffMoveOut/queries.ts`
- Create: `hooks/reactquery/staffMoveOut/mutations.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`.
- Produces:
  - `type MoveOutStatus = "pending"|"confirmed"|"canceled"|"rejected"`
  - `interface StaffMoveOutRequest { id;buildingId;unitId;occupancyId;buildingName;unitNo;unitDong;tenantName;phone;desiredDate;reason;status;createdAt;resolvedAt }`
  - `interface StaffMoveOutFilters { buildingId?; statuses?: MoveOutStatus[]; sort?: "created_desc"|"created_asc"|"desired_asc"|"desired_desc" }`
  - `listStaffMoveOutRequests(filters): Promise<StaffMoveOutRequest[]>`
  - `confirmMoveOut(id: number): Promise<void>`
  - `useStaffMoveOutRequests(filters)`, `useConfirmMoveOut()`

- [ ] **Step 1: apis.ts** (단일 PostGREST embed; occupancy_id 직접 FK 조인 — 마이그 불필요)

```ts
import { createClient } from "@/lib/supabase/client";

export type MoveOutStatus = "pending" | "confirmed" | "canceled" | "rejected";

export interface StaffMoveOutRequest {
  id: number;
  buildingId: number | null;
  unitId: number | null;
  occupancyId: number | null;
  buildingName: string | null;
  unitNo: string | null;
  unitDong: string | null;
  tenantName: string | null;
  phone: string | null;
  desiredDate: string;
  reason: string | null;
  status: MoveOutStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface StaffMoveOutFilters {
  buildingId?: number;
  statuses?: MoveOutStatus[];
  sort?: "created_desc" | "created_asc" | "desired_asc" | "desired_desc";
}

const SELECT = `
  id, occupancy_id, unit_id, building_id, desired_date, reason, status, created_at, resolved_at,
  units!unit_id(unit_no,dong),
  buildings!building_id(name),
  occupancies!occupancy_id(tenant_name,phone)
`;

function one<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v ?? undefined;
}

interface Row {
  id: number;
  occupancy_id: number | null;
  unit_id: number | null;
  building_id: number | null;
  desired_date: string;
  reason: string | null;
  status: MoveOutStatus;
  created_at: string;
  resolved_at: string | null;
  units?: { unit_no?: string | null; dong?: string | null } | { unit_no?: string | null; dong?: string | null }[] | null;
  buildings?: { name?: string | null } | { name?: string | null }[] | null;
  occupancies?: { tenant_name?: string | null; phone?: string | null } | { tenant_name?: string | null; phone?: string | null }[] | null;
}

function toModel(r: Row): StaffMoveOutRequest {
  const u = one<{ unit_no?: string | null; dong?: string | null }>(r.units);
  const b = one<{ name?: string | null }>(r.buildings);
  const o = one<{ tenant_name?: string | null; phone?: string | null }>(r.occupancies);
  return {
    id: r.id,
    buildingId: r.building_id,
    unitId: r.unit_id,
    occupancyId: r.occupancy_id,
    buildingName: b?.name ?? null,
    unitNo: u?.unit_no ?? null,
    unitDong: u?.dong ?? null,
    tenantName: o?.tenant_name ?? null,
    phone: o?.phone ?? null,
    desiredDate: r.desired_date,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

export async function listStaffMoveOutRequests(
  filters: StaffMoveOutFilters = {},
): Promise<StaffMoveOutRequest[]> {
  let q = createClient()
    .from("move_out_requests")
    .select(SELECT)
    // 활성 요청 기본: 미해결(pending 또는 confirmed 중 resolved_at IS NULL)
    .in("status", filters.statuses ?? ["pending", "confirmed"])
    .is("resolved_at", null);
  if (filters.buildingId !== undefined) q = q.eq("building_id", filters.buildingId);
  const [col, dir] =
    filters.sort === "created_asc"
      ? ["created_at", true]
      : filters.sort === "desired_asc"
        ? ["desired_date", true]
        : filters.sort === "desired_desc"
          ? ["desired_date", false]
          : ["created_at", false];
  const { data, error } = await q.order(col as string, { ascending: dir as boolean });
  if (error) throw new Error(error.message);
  return (data as unknown as Row[]).map(toModel);
}

export async function confirmMoveOut(id: number): Promise<void> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("move_out_requests")
    .update({
      status: "confirmed",
      resolved_at: new Date().toISOString(),
      resolved_by: auth.user?.id ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
```

> **RLS 폴백**: 위 단일 embed가 RLS로 실패하면(occupancies/units/buildings 조인 거부), 2-스텝(먼저 move_out_requests, 그다음 `.in("id", occIds)`로 occupancies 조회 후 클라 병합)으로 전환. 마이그(RPC)로는 가지 않는다(D5).

- [ ] **Step 2: keys.ts**

```ts
import type { StaffMoveOutFilters } from "./apis";
export const staffMoveOutKeys = {
  all: ["staff-move-out"] as const,
  list: (f: StaffMoveOutFilters = {}) =>
    ["staff-move-out", "list", f.buildingId ?? null, [...(f.statuses ?? [])].sort(), f.sort ?? "created_desc"] as const,
};
```

- [ ] **Step 3: queries.ts**

```ts
import { useQuery } from "@tanstack/react-query";
import { listStaffMoveOutRequests, type StaffMoveOutFilters } from "./apis";
import { staffMoveOutKeys } from "./keys";

export function useStaffMoveOutRequests(filters: StaffMoveOutFilters = {}) {
  return useQuery({
    queryKey: staffMoveOutKeys.list(filters),
    queryFn: () => listStaffMoveOutRequests(filters),
  });
}
```

- [ ] **Step 4: mutations.ts**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { confirmMoveOut } from "./apis";
import { staffMoveOutKeys } from "./keys";

export function useConfirmMoveOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => confirmMoveOut(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffMoveOutKeys.all }),
  });
}
```

- [ ] **Step 5: 검증** — `tsc` + `lint`.
- [ ] **Step 6: Commit**

```bash
git add hooks/reactquery/staffMoveOut
git commit -m "feat(staff-move-out): 퇴실 신청 스태프 조회·처리완료(direct select, 마이그 없음)"
```

---

### Task 5: 퇴실 탭 — MoveOutCard + ConfirmDialog + MoveOutList

**Files:**
- Create: `components/shell/as-rail/MoveOutCard.tsx`
- Create: `components/shell/as-rail/MoveOutConfirmDialog.tsx`
- Create: `components/shell/as-rail/MoveOutList.tsx`

**Interfaces:**
- Consumes: Task4 훅(`useStaffMoveOutRequests`,`useConfirmMoveOut`,`StaffMoveOutRequest`); constants(`MOVE_OUT_BADGE`,`ymd`); FilterDropdown; `useBuildings()`; `toast`(sonner).
- Produces: `MoveOutList()`, `MoveOutCard({ request, onDone })`, `MoveOutConfirmDialog({ request, onCancel, onConfirm, pending })`.

원본 참조: `#mvList .mv-card` = fee-item.dc.html **474행**; 처리완료 문구 = **509·523행**; empty = **489행**.

- [ ] **Step 1: MoveOutCard 구현** (`a.mv-card`)

원본 474행 정합: `.mvTop`(`<b>{buildingName} {unitNo}호</b>` + 입주자명 `tenantName` + 배지 `MOVE_OUT_BADGE[status]` — pending=신규(mvNew)/confirmed=확인(mvCk)); `.mvR` 3줄: 신청일=`ymd(createdAt)`, 희망 퇴실일=`ymd(desiredDate)`, 연락처=`phone ?? '-'`; `.mvAct`>`button.mvDone`("처리 완료", onClick→`onDone(request)`).

- [ ] **Step 2: MoveOutConfirmDialog 구현**

원본 문구 정합: 제목 "퇴실 신청을 처리 완료할까요?", 본문 "`<b>{tenantName}</b>` 퇴실 신청을 목록에서 정리해요.<br>처리 완료해도 정산은 자동으로 되지 않습니다. **반드시 이사정산을 진행해 주세요.**", 버튼 취소/처리 완료. 기존 공통 모달(`@/components/common` Modal — a11y role/aria 지원)로 셸, 본문만 커스텀. `pending` 시 확인 버튼 비활성.

- [ ] **Step 3: MoveOutList 구현**

- state: `buildingId?`, `sort`, `selected?: StaffMoveOutRequest`(다이얼로그).
- `useStaffMoveOutRequests({ buildingId, sort })`; 필터바=건물(searchable)+정렬(신청일/희망일). (원본 퇴실 탭엔 담당자·유형 없음.)
- `useConfirmMoveOut()`; onDone→다이얼로그 open; 확인→`mutate(id)` onSuccess `toast.success("퇴실 신청을 처리 완료했어요")` + 닫기(리스트 자동 무효화로 카드 제거).
- 상태: loading/error/empty(`"대기 중인 퇴실 신청이 없어요"`, 원본 문구) / 카드 리스트.

- [ ] **Step 4: 검증** — `tsc` + `lint`.
- [ ] **Step 5: Commit**

```bash
git add components/shell/as-rail/MoveOutCard.tsx components/shell/as-rail/MoveOutConfirmDialog.tsx components/shell/as-rail/MoveOutList.tsx
git commit -m "feat(as-rail): 퇴실 신청 탭(카드·처리완료 다이얼로그·리스트)"
```

---

### Task 6: AsReceptionRail 셸 (핸들·헤더·탭·토글·새로고침)

**Files:**
- Create: `components/shell/as-rail/AsReceptionRail.tsx`

**Interfaces:**
- Consumes: `useRailOpen`(Task1); `AsReceptionList`(Task3); `MoveOutList`(Task5); CSS 모듈; `useQueryClient`(새로고침).
- Produces: `export function AsReceptionRail()`.

원본 참조: 핸들+토글 = 359행, `.rnb` 헤더/탭 = 384행.

- [ ] **Step 1: AsReceptionRail 구현**

- `"use client"`. `const { open, toggle } = useRailOpen();` `const [tab, setTab] = useState<'as'|'mv'>('as');`
- 렌더: `<aside className="hidden print:hidden lg:block">` 래퍼(현행 QuickAccessRail 반응형 정합) 안에:
  - 핸들: `<button className={styles.rnbHandle + (open? '' : ' '+styles.rnbHandleOff)} title="A/S 접수 현황" onClick={toggle}>`{원본 359행 clipboard SVG}`</button>`
  - 패널: `<div className={styles.rnb + (open? '' : ' '+styles.rnbOff)}>`
    - `.rnbH`: 아이콘 + `<div className={styles.t}>A/S 접수·퇴실 신청 현황</div>` + `.rnbRefresh`(onClick→`queryClient.invalidateQueries` for complaints + staff-move-out; title="새로고침"; 원본 refresh SVG).
    - `.rnbTabs`: `<a className={tab==='as'?styles.on:''} onClick={()=>setTab('as')}>A/S 접수</a>` / `퇴실 신청`.
    - 본문: `{tab==='as' ? <AsReceptionList/> : <MoveOutList/>}`.
- 접힘 시에도 핸들은 항상 보이고, 패널은 `rnbOff`로 화면 밖(translateX(100%)).

- [ ] **Step 2: 검증** — `tsc` + `lint`.
- [ ] **Step 3: Commit**

```bash
git add components/shell/as-rail/AsReceptionRail.tsx
git commit -m "feat(as-rail): 우측 패널 셸(핸들·2탭·토글·새로고침)"
```

---

### Task 7: 전역 마운트 + 스텁 제거

**Files:**
- Modify: `components/shell/AppShell.tsx`
- Delete: `components/shell/QuickAccessRail.tsx`, `app/(staff)/staff/(app)/fee-items/components/FeeItemRightRail.tsx`
- Modify: `app/(staff)/staff/(app)/moving-settlement/components/SettlementInquiryPage.tsx`
- Modify: fee-items 페이지(아래 grep로 확정)

- [ ] **Step 1: AppShell에 전역 마운트**

`components/shell/AppShell.tsx`에서 `import { AsReceptionRail } from "./as-rail/AsReceptionRail";` 추가. `isBare` 반환 분기는 그대로(로그인/`/` 제외). 정상 셸 반환부의 최상위 `<div>` 안, 모바일 drawer 앞에 `<AsReceptionRail />` 추가:

```tsx
      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 print:block">
        {/* …기존… */}
      </div>

      {/* 우측 A/S·퇴실 패널 (전역, print 제외) */}
      <AsReceptionRail />

      {/* Mobile drawer */}
```

- [ ] **Step 2: 기존 사용처·스텁 제거**

```bash
grep -rn "QuickAccessRail\|FeeItemRightRail" app components
```

발견된 렌더 사이트 전부 제거:
- `SettlementInquiryPage.tsx`: `<QuickAccessRail />` 및 그 import 삭제.
- fee-items 페이지의 `<FeeItemRightRail />` 사용 삭제(및 필요 없어진 import).
- 파일 삭제: `git rm components/shell/QuickAccessRail.tsx app/(staff)/staff/(app)/fee-items/components/FeeItemRightRail.tsx`.

- [ ] **Step 3: 검증** — `npx tsc --noEmit`(소스 clean, 잔여 QuickAccessRail 참조 0) + `npm run lint` + `npm run build`. dev 서버로 여러 스태프 화면에서 핸들→열림, 2탭, 필터, 카드 네비게이트, 퇴실 처리완료 스팟체크.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(as-rail): AppShell 전역 마운트 + QuickAccessRail 스텁·사용처 제거"
```

---

### Task 8: pixel-diff 하네스 — 열림 상태 캡처

**Files:**
- Modify: `scripts/pixel-diff/capture.mjs`
- Modify: `scripts/pixel-diff/targets.json`

- [ ] **Step 1: capture.mjs에 appActions 지원 추가**

app 캡처 블록에서 `page.goto` 후·스크린샷 전에 per-target 액션 실행:

```js
      await page.goto(APP_ORIGIN + t.appPath, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      // 패널 열림 등 인터랙션
      if (Array.isArray(t.appActions)) {
        for (const a of t.appActions) {
          if (a.click) await page.click(a.click);
          if (a.wait) await page.waitForTimeout(a.wait);
          if (a.waitFor) await page.waitForSelector(a.waitFor, { timeout: 15000 });
        }
      }
```

origin(정본) 캡처는 원본이 기본 열림이라 액션 불필요(필요 시 동일 `originActions`도 추가 가능하나 이번엔 생략).

- [ ] **Step 2: targets.json에 rail 타깃 추가**

원본은 `.rnb`가 기본 열림. 앱은 기본 접힘이므로 핸들 클릭으로 열고 `.rnb`가 나타나면 캡처. `appSelector`로 `.rnb`만 캡처(패널 정합).

```json
  {
    "id": "as-rail-panel",
    "originUrl": "https://staging.d2h12382xiksft.amplifyapp.com/staff/fee-item/fee-item.dc.html",
    "originSelector": ".rnb",
    "appPath": "/staff/fee-items",
    "appSelector": ".rnb, [class*='rnb']",
    "appActions": [{ "click": "[title='A/S 접수 현황']" }, { "wait": 400 }],
    "viewport": { "w": 1340, "h": 880 },
    "device": "desktop"
  }
```

> 앱 `appSelector`는 CSS 모듈 해시 클래스라 정확 셀렉터가 다를 수 있음 → 구현된 핸들에 `data-testid="as-rail-handle"`, 패널에 `data-testid="as-rail-panel"`를 부여하고 셀렉터를 `[data-testid='as-rail-panel']`로 지정(권장). Task 6 셸에 해당 `data-testid` 추가.

- [ ] **Step 3: 검증(도구 파싱)** — `node --check scripts/pixel-diff/capture.mjs`. 실제 캡처는 브랜치 dev 서버 필요(아래).

- [ ] **Step 4: Commit**

```bash
git add scripts/pixel-diff/capture.mjs scripts/pixel-diff/targets.json components/shell/as-rail/AsReceptionRail.tsx
git commit -m "test(pixel-diff): A/S 패널 열림 상태 캡처 인터랙션·타깃"
```

---

### Task 9: 최종 검증 · pixel-diff 대조 · 회귀 확인

- [ ] **Step 1: 브랜치 dev 서버 기동** — 워크트리에서 `npm run dev`(정션 node_modules). 포트 충돌 시(projects/home_erp가 3000 점유) `PORT=3001 npm run dev` 후 `APP_ORIGIN=http://localhost:3001`.

- [ ] **Step 2: 세션 저장** — `node scripts/pixel-diff/save-auth.mjs`(admin/erp!12345, ~1시간 만료 주의).

- [ ] **Step 3: pixel-diff 캡처·대조**

```bash
node scripts/pixel-diff/capture.mjs as-rail-panel --side=both
node scripts/pixel-diff/diff.mjs as-rail-panel   # 또는 하네스 diff 사용법대로
```

원본 `.rnb` 열림 vs 앱 패널 열림 대조. 시각 차이는 CSS 모듈 이식 누락 위주로 원본 값과 재대조하여 수정.

- [ ] **Step 4: 전체 그린** — `npx tsc --noEmit`(소스 0 에러) · `npm run lint`(0) · `npm run build`(성공) · `npm test`(vitest 회귀 없음; 기존 complaints/accounts/buildings 테스트 영향 없어야 함).

- [ ] **Step 5: 정션 해제** — `cmd //c "rmdir node_modules"`.

- [ ] **Step 6: Commit(수정분 있으면)**

```bash
git add -A
git commit -m "fix(as-rail): pixel-diff 대조 후 정합 보정"
```

---

## Self-Review (계획 대비 스펙 커버리지)

- **D1 실데이터**: Task3(useComplaints)·Task4(staffMoveOut) ✓
- **D2 두 탭**: Task3(A/S)·Task5(퇴실) ✓
- **D3 전역**: Task7(AppShell) ✓
- **D4 기본 접힘**: Task1(useRailOpen 기본 false)·Task6(rnbOff) ✓
- **D5 마이그 없음**: Task4 direct select(embed) + 2-스텝 폴백 ✓
- **A1 처리완료 기능화**: Task4(confirmMoveOut)·Task5(다이얼로그) ✓
- **A2 FAB 제외**: 어느 태스크도 FAB 렌더 안 함; Task7이 QuickAccessRail(FAB 포함) 제거 ✓
- **픽셀 퍼펙트**: Task1(CSS verbatim)·Task2(.dd)·Task3/5(마크업 정합)·Task8/9(pixel-diff) ✓
- **신규 테스트 없음**: 전 태스크 검증=tsc/lint/build/기존 vitest ✓

**미해결(구현 중 확정)**: 퇴실 embed RLS 도달성(실패 시 2-스텝 폴백, Task4 주석) · repeat 상태색 amber(정본 재확인 시 조정) · CSS 모듈 셀렉터→pixel-diff `data-testid` 사용.

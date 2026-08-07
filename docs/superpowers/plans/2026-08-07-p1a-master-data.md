# P1a 기초정보(건물·항목·거래처) 마스터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 건물·호실·입주자, 부과항목, 거래처 마스터를 Supabase(스키마+RLS) + reactquery 훅 + Next.js 화면으로 풀 구현하고, 프로토타입 `.dc.html` 비주얼을 디자인 토큰/공통 프리미티브로 픽셀 매칭한다.

**Architecture:** P0(인증·org·RLS·`my_org_ids()`) 위에 org 스코프 마스터 도메인 추가. 각 도메인은 **기존 `hooks/reactquery/auth/`(P0) 파일 형태**(apis/keys/queries/mutations/index)를 그대로 따른다 — 새 패턴 없음. 화면은 `components/common/` 프리미티브를 조합. Supabase 직접 호출(route handler 없음).

**Tech Stack:** Next.js 16, `@supabase/ssr`/`supabase-js`, @tanstack/react-query, react-hook-form + zod, sonner, Tailwind v4(@theme), Vitest + @testing-library/react.

**관련 스펙:** `docs/superpowers/specs/2026-08-07-p1a-master-data-design.md`

## Global Constraints

- **route handler(app/api) 금지** — 모든 API는 Supabase 클라이언트 직접 호출.
- **타입은 각 도메인 `apis.ts`에** 정의. snake_case(DB) ↔ camelCase(앱) 매핑은 apis.ts.
- **RLS/격리**: org 직속 테이블은 `org_id in (select my_org_ids())`(P0 함수), units/occupancies는 부모 FK 경유. insert 시 `org_id = useMe().orgId`.
- **기존 패턴 준수**: 도메인 파일 형태·훅 네이밍은 `hooks/reactquery/auth/`(P0)를 참조해 동일하게.
- **디자인 토큰(확정값)**: `--blue:#14A497` `--blue-d:#0E8677` `--blue-t:#E2F5F1` `--bg:#F2F4F6` `--surface:#fff` `--line:#E8EBEE` `--t1:#191F28` `--t2:#4E5968` `--t3:#8B95A1` `--t4:#B0B8C1` `--red:#F04452`; 폰트 **Pretendard**; radius 12–14px.
- **필수 fee_item**(전기·수도·가스, `is_required=true`)은 이름변경/삭제 불가 + 목록 상단 고정(앱레벨 강제).
- **DB 적용은 pending-user**(Supabase 대시보드 SQL). 서브에이전트는 SQL 파일 작성·커밋만, 실행 안 함.
- **커밋** 각 태스크 끝에서. 트레일러: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Windows/git-bash. `npm run dev` 실행 금지(행). 검증은 `npm test`/`npm run build`.

## File Structure

| 파일 | 책임 |
|---|---|
| `supabase/migrations/0001_p1a_master_data.sql` | ENUM·8테이블·트리거·RLS |
| `supabase/verify/p1a_checks.sql`, `p1a_storage.sql` | RLS·Storage 검증/정책 스니펫 |
| `app/globals.css` (수정) | 디자인 토큰(@theme) + Pretendard |
| `components/common/{Button,Input,Select,Checkbox,Modal,Tabs,Panel,DataTable,SidebarList,SearchBar,EmptyState,Spinner}.tsx` | DC 룩 공통 프리미티브 |
| `components/forms/schema/{building,unit,occupancy,feeItem,vendor}.ts` | zod 스키마 |
| `hooks/reactquery/{buildings,units,occupancies,buildingTypes,feeItems,vendorCategories,vendors}/*` | 도메인 데이터 계층 |
| `app/(staff)/staff/building-list/{page.tsx,components/*}` | 건물·호실·입주자 화면 |
| `app/(staff)/staff/fee-item/{page.tsx,components/*}` | 부과항목 화면 |
| `app/(staff)/staff/vendor-management/{page.tsx,components/*}` | 거래처 화면 |

**도메인 파일 형태(모든 도메인 공통, P0 `hooks/reactquery/auth` 참조):** `apis.ts`(타입+CRUD 함수), `keys.ts`(쿼리키 팩토리), `queries.ts`(useXxx 조회), `mutations.ts`(useCreate/useUpdate/useDelete), `index.ts`(re-export).

---

## Task 1: DB 마이그레이션 + RLS + 검증 스니펫

**Files:** Create `supabase/migrations/0001_p1a_master_data.sql`, `supabase/verify/p1a_checks.sql`, `supabase/verify/p1a_storage.sql`

**Interfaces — Produces (later tasks의 apis.ts가 의존):** 테이블 `building_types,buildings,units,occupancies,fee_items,vendor_categories,vendors,attachments`; ENUM `fee_rounding('up','round','down','raw')`,`occupancy_status('occupied','vacant','moving_out')`,`attachment_kind('contract','repair','facility','etc')`.

> DB 실행 금지(pending-user). 파일 작성·커밋만. `$$`/생성순서 눈검수.

- [ ] **Step 1: 마이그레이션 작성** — `supabase/migrations/0001_p1a_master_data.sql` (스펙 §3 그대로)

```sql
create type fee_rounding     as enum ('up','round','down','raw');
create type occupancy_status as enum ('occupied','vacant','moving_out');
create type attachment_kind  as enum ('contract','repair','facility','etc');

create table building_types (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  label text not null, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, label));

create table buildings (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  code text not null, name text not null, address text,
  type_id bigint references building_types(id) on delete set null,
  owner_name text, owner_phone text, entrance_password text,
  manager_name text, meter_staff_name text, cleaning_staff_name text, memo text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, code));

create table units (
  id bigint generated always as identity primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  unit_no text not null, dong text, area_pyeong numeric(8,2), room_count int,
  elec_customer_no text, elec_meter_no text, water_customer_no text, memo text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (building_id, unit_no));
create index on units (building_id);

create table occupancies (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  tenant_name text, payer_name text, phone text, resident_count int, vehicle_no text,
  move_in_date date, move_out_date date, deposit numeric(12,0), monthly_rent numeric(12,0),
  status occupancy_status not null default 'occupied', memo text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on occupancies (unit_id);

create table fee_items (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  type_id bigint not null references building_types(id) on delete cascade,
  name text not null, rounding fee_rounding not null default 'round',
  daily_proration boolean not null default false, carry_over boolean not null default false,
  is_required boolean not null default false, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (type_id, name));
create index on fee_items (org_id, type_id, sort_order);

create table vendor_categories (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  label text not null, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, label));

create table vendors (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  category_id bigint references vendor_categories(id) on delete set null,
  name text not null, phone text, bank_account text, memo text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on vendors (org_id, category_id);

create table attachments (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  entity_type text not null, entity_id bigint not null,
  kind attachment_kind not null default 'etc',
  file_url text not null, file_name text, uploaded_by uuid,
  created_at timestamptz not null default now());
create index on attachments (entity_type, entity_id);

-- updated_at triggers (P0 set_updated_at())
do $$ declare t text; begin
  foreach t in array array['building_types','buildings','units','occupancies','fee_items','vendor_categories','vendors'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- RLS
alter table building_types enable row level security;
alter table buildings enable row level security;
alter table units enable row level security;
alter table occupancies enable row level security;
alter table fee_items enable row level security;
alter table vendor_categories enable row level security;
alter table vendors enable row level security;
alter table attachments enable row level security;

create policy bt_all  on building_types    for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy bld_all on buildings         for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy fi_all  on fee_items         for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy vc_all  on vendor_categories for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy vnd_all on vendors           for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy att_all on attachments       for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy unit_all on units for all
  using (building_id in (select id from buildings where org_id in (select my_org_ids())))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy occ_all on occupancies for all
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
```

- [ ] **Step 2: 검증 스니펫** — `supabase/verify/p1a_checks.sql`

```sql
-- 시드 org 사용자 컨텍스트에서: 8개 테이블 rowsecurity=true
select tablename, rowsecurity from pg_tables where schemaname='public'
  and tablename in ('building_types','buildings','units','occupancies','fee_items','vendor_categories','vendors','attachments');
-- 타 org 데이터 접근 0행, with check 위반 insert 거부(anon/authenticated 세션에서 확인)
```

- [ ] **Step 3: Storage 정책 스니펫** — `supabase/verify/p1a_storage.sql`

```sql
-- 대시보드: private 버킷 'attachments' 생성 후 실행.
-- org 경로(첫 폴더 = org_id) 격리: 활성 org 구성원만 자기 org 경로 read/write.
create policy att_read on storage.objects for select to authenticated using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::bigint in (select my_org_ids()));
create policy att_write on storage.objects for insert to authenticated with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::bigint in (select my_org_ids()));
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat(p1a): 마스터 스키마·RLS 마이그레이션 + 검증/스토리지 스니펫

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 디자인 토큰 (globals.css @theme + Pretendard)

**Files:** Modify `app/globals.css`

**Interfaces — Produces:** Tailwind 유틸에서 쓸 색/폰트 토큰. 색은 CSS 변수 `--color-brand`(#14A497) 등 + Tailwind v4 `@theme` 매핑.

- [ ] **Step 1: globals.css에 토큰 추가** (기존 `@import "tailwindcss";` 아래에 추가)

```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

@theme {
  --color-brand: #14A497;
  --color-brand-dark: #0E8677;
  --color-brand-tint: #E2F5F1;
  --color-bg: #F2F4F6;
  --color-surface: #ffffff;
  --color-line: #E8EBEE;
  --color-t1: #191F28;
  --color-t2: #4E5968;
  --color-t3: #8B95A1;
  --color-t4: #B0B8C1;
  --color-danger: #F04452;
  --radius-field: 13px;
  --font-sans: 'Pretendard', -apple-system, system-ui, sans-serif;
}
body { background: var(--color-bg); color: var(--color-t1); font-family: var(--font-sans); }
```

- [ ] **Step 2: 빌드 확인** — Run `npm run build`; Expected: 성공(토큰은 컴파일만 검증).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(p1a): 디자인 토큰(브랜드 색·Pretendard·radius) globals.css

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 공통 UI 프리미티브 (components/common)

**Files:** Create `components/common/{Button,Input,Select,Checkbox,Modal,Tabs,Panel,DataTable,SidebarList,SearchBar,EmptyState,Spinner}.tsx`, `components/common/index.ts`; Test `components/common/Modal.test.tsx`, `Tabs.test.tsx`

**Interfaces — Produces:** DC 룩 프리미티브. 시그니처:
- `Button({variant?:'primary'|'ghost'|'danger', ...props})`, `Input`, `Select({options:{value,label}[]})`, `Checkbox({label})`
- `Modal({open, onClose, title, children})` — ESC/backdrop 닫기, scroll lock
- `Tabs({tabs:{id,label}[], active, onChange, onAdd?, onRename?, onDelete?})`
- `Panel({title, action?, children})`, `DataTable({columns, rows, onRowClick?})`, `SidebarList({items:{id,label,count?}[], active, onSelect})`, `SearchBar({value,onChange,placeholder})`, `EmptyState({message})`, `Spinner()`

- [ ] **Step 1: 실패 테스트** — `components/common/Modal.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("open이면 title/children 표시, ESC로 onClose", async () => {
    const onClose = vi.fn();
    render(<Modal open title="건물 등록" onClose={onClose}><p>본문</p></Modal>);
    expect(screen.getByText("건물 등록")).toBeInTheDocument();
    expect(screen.getByText("본문")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
  it("open=false면 렌더 안 함", () => {
    render(<Modal open={false} title="x" onClose={() => {}}>c</Modal>);
    expect(screen.queryByText("x")).toBeNull();
  });
});
```
`components/common/Tabs.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  it("탭 클릭 시 onChange(id)", async () => {
    const onChange = vi.fn();
    render(<Tabs tabs={[{id:"a",label:"빌라"},{id:"b",label:"빌딩"}]} active="a" onChange={onChange} />);
    await userEvent.click(screen.getByText("빌딩"));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run `npm test components/common`; Expected: FAIL(모듈 없음).

- [ ] **Step 3: 프리미티브 구현** — 각 파일 작성. 예시(나머지도 동일 톤·토큰 사용):

```tsx
// components/common/Button.tsx
export function Button({ variant = "primary", className = "", ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"ghost"|"danger" }) {
  const base = "h-11 rounded-xl px-4 text-sm font-bold disabled:opacity-70";
  const v = { primary: "bg-brand text-white hover:bg-brand-dark",
    ghost: "bg-white text-t2 border border-line hover:bg-bg",
    danger: "bg-danger text-white" }[variant];
  return <button className={`${base} ${v} ${className}`} {...props} />;
}
```
```tsx
// components/common/Modal.tsx
"use client";
import { useEffect } from "react";
export function Modal({ open, onClose, title, children }:
  { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-extrabold">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
```
```tsx
// components/common/Tabs.tsx
"use client";
export function Tabs({ tabs, active, onChange, onAdd }:
  { tabs: {id:string;label:string}[]; active: string; onChange:(id:string)=>void; onAdd?:()=>void }) {
  return (
    <div className="flex items-center gap-1 border-b border-line">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-bold ${active===t.id?"border-b-2 border-brand text-brand":"text-t3"}`}>
          {t.label}
        </button>
      ))}
      {onAdd && <button onClick={onAdd} className="px-3 py-2 text-sm text-t3">＋ 유형 추가</button>}
    </div>
  );
}
```
> 나머지 프리미티브(Input/Select/Checkbox/Panel/DataTable/SidebarList/SearchBar/EmptyState/Spinner)도 동일 토큰(bg-brand, border-line, rounded-xl, text-t*)으로 작성. `index.ts`에서 전부 re-export.

- [ ] **Step 4: 통과 확인** — Run `npm test components/common`; Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/common
git commit -m "feat(p1a): 공통 UI 프리미티브(DC 룩)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: zod 스키마 (building/unit/occupancy/feeItem/vendor)

**Files:** Create `components/forms/schema/{building,unit,occupancy,feeItem,vendor}.ts` + `*.test.ts`

**Interfaces — Produces:** `buildingSchema`/`BuildingFormValues` 등. 필수: buildings=code·name; units=unit_no; fee_items=name; vendors=name. 나머지 optional.

- [ ] **Step 1: 실패 테스트** — 예 `components/forms/schema/building.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildingSchema } from "./building";
describe("buildingSchema", () => {
  it("code·name 필수", () => {
    expect(buildingSchema.safeParse({ code:"", name:"" }).success).toBe(false);
    expect(buildingSchema.safeParse({ code:"001", name:"그린빌라" }).success).toBe(true);
  });
});
```
(unit/occupancy/feeItem/vendor 동일 형태로 필수필드 검증 테스트 작성.)

- [ ] **Step 2: 실패 확인** — Run `npm test components/forms/schema`; Expected: FAIL.

- [ ] **Step 3: 구현** — 예 `building.ts`:

```ts
import { z } from "zod";
export const buildingSchema = z.object({
  code: z.string().min(1, "코드를 입력해 주세요"),
  name: z.string().min(1, "건물명을 입력해 주세요"),
  address: z.string().optional(), typeId: z.number().nullable().optional(),
  ownerName: z.string().optional(), ownerPhone: z.string().optional(),
  entrancePassword: z.string().optional(), managerName: z.string().optional(),
  meterStaffName: z.string().optional(), cleaningStaffName: z.string().optional(), memo: z.string().optional(),
});
export type BuildingFormValues = z.infer<typeof buildingSchema>;
```
```ts
// unit.ts: unit_no 필수 + dong/areaPyeong/roomCount/elec*/water* optional
// occupancy.ts: 전부 optional(status 기본 'occupied')
// feeItem.ts: name 필수 + rounding enum + daily/carry boolean
// vendor.ts: name 필수 + phone/bankAccount/memo/categoryId optional
```

- [ ] **Step 4: 통과 확인** — Run `npm test components/forms/schema`; Expected: PASS.

- [ ] **Step 5: Commit** — `feat(p1a): 폼 zod 스키마` (+ 트레일러)

---

## Task 5: buildings 데이터 계층

**Files:** Create `hooks/reactquery/buildings/{apis,keys,queries,mutations,index}.ts` + `apis.test.ts`
**Interfaces — Consumes:** `@/lib/supabase/client`(P0). **Produces:** `Building`,`BuildingInput`; `useBuildings(search?)`,`useBuilding(id)`,`useCreateBuilding`,`useUpdateBuilding`,`useDeleteBuilding`. **패턴은 `hooks/reactquery/auth/`(P0)와 동일 형태.**

- [ ] **Step 1: 실패 테스트** — `apis.test.ts` (Supabase mock)

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listBuildings, createBuilding } from "./apis";
beforeEach(() => vi.clearAllMocks());
describe("buildings apis", () => {
  it("listBuildings: snake→camel 매핑", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:1, org_id:9, code:"001", name:"그린빌라", type_id:null, owner_name:"박정호" }], error:null });
    from.mockReturnValue({ select: () => ({ order }) });
    const r = await listBuildings();
    expect(r[0]).toMatchObject({ id:1, code:"001", name:"그린빌라", ownerName:"박정호" });
  });
  it("createBuilding: org_id 포함 insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, org_id:9, code:"002", name:"x" }, error:null });
    const sel = vi.fn(() => ({ single })); const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await createBuilding({ orgId:9, code:"002", name:"x" });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id:9, code:"002", name:"x" }));
  });
});
```

- [ ] **Step 2: 실패 확인** — Run `npm test hooks/reactquery/buildings`; Expected: FAIL.

- [ ] **Step 3: 구현**

```ts
// apis.ts
import { createClient } from "@/lib/supabase/client";
export interface Building { id:number; orgId:number; code:string; name:string; address?:string|null;
  typeId?:number|null; ownerName?:string|null; ownerPhone?:string|null; entrancePassword?:string|null;
  managerName?:string|null; meterStaffName?:string|null; cleaningStaffName?:string|null; memo?:string|null; }
export interface BuildingInput { orgId:number; code:string; name:string; address?:string; typeId?:number|null;
  ownerName?:string; ownerPhone?:string; entrancePassword?:string; managerName?:string; meterStaffName?:string; cleaningStaffName?:string; memo?:string; }
const rowToBuilding = (r: any): Building => ({ id:r.id, orgId:r.org_id, code:r.code, name:r.name, address:r.address,
  typeId:r.type_id, ownerName:r.owner_name, ownerPhone:r.owner_phone, entrancePassword:r.entrance_password,
  managerName:r.manager_name, meterStaffName:r.meter_staff_name, cleaningStaffName:r.cleaning_staff_name, memo:r.memo });
const inputToRow = (i: BuildingInput) => ({ org_id:i.orgId, code:i.code, name:i.name, address:i.address,
  type_id:i.typeId ?? null, owner_name:i.ownerName, owner_phone:i.ownerPhone, entrance_password:i.entrancePassword,
  manager_name:i.managerName, meter_staff_name:i.meterStaffName, cleaning_staff_name:i.cleaningStaffName, memo:i.memo });

export async function listBuildings(search?: string): Promise<Building[]> {
  const sb = createClient();
  let q = sb.from("buildings").select("*");
  if (search) q = q.or(`name.ilike.%${search}%,address.ilike.%${search}%`);
  const { data, error } = await q.order("code");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToBuilding);
}
export async function createBuilding(input: BuildingInput): Promise<Building> {
  const { data, error } = await createClient().from("buildings").insert(inputToRow(input)).select().single();
  if (error) throw new Error(error.message); return rowToBuilding(data);
}
export async function updateBuilding(id: number, input: Partial<BuildingInput>): Promise<Building> {
  const { data, error } = await createClient().from("buildings").update(inputToRow(input as BuildingInput)).eq("id", id).select().single();
  if (error) throw new Error(error.message); return rowToBuilding(data);
}
export async function deleteBuilding(id: number): Promise<void> {
  const { error } = await createClient().from("buildings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
```
```ts
// keys.ts
export const buildingKeys = { all: ["buildings"] as const, list: (s?:string)=>["buildings","list",s??""] as const, one:(id:number)=>["buildings",id] as const };
// queries.ts
import { useQuery } from "@tanstack/react-query"; import { listBuildings } from "./apis"; import { buildingKeys } from "./keys";
export function useBuildings(search?: string){ return useQuery({ queryKey: buildingKeys.list(search), queryFn: ()=>listBuildings(search) }); }
// mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBuilding, updateBuilding, deleteBuilding, type BuildingInput } from "./apis"; import { buildingKeys } from "./keys";
export function useCreateBuilding(){ const qc=useQueryClient(); return useMutation({ mutationFn:(i:BuildingInput)=>createBuilding(i), onSuccess:()=>qc.invalidateQueries({queryKey:buildingKeys.all}) }); }
export function useUpdateBuilding(){ const qc=useQueryClient(); return useMutation({ mutationFn:({id,input}:{id:number;input:Partial<BuildingInput>})=>updateBuilding(id,input), onSuccess:()=>qc.invalidateQueries({queryKey:buildingKeys.all}) }); }
export function useDeleteBuilding(){ const qc=useQueryClient(); return useMutation({ mutationFn:(id:number)=>deleteBuilding(id), onSuccess:()=>qc.invalidateQueries({queryKey:buildingKeys.all}) }); }
// index.ts
export * from "./apis"; export * from "./keys"; export * from "./queries"; export * from "./mutations";
```

- [ ] **Step 4: 통과 확인** — Run `npm test hooks/reactquery/buildings`; Expected: PASS.
- [ ] **Step 5: Commit** — `feat(p1a): buildings 데이터 계층` (+ 트레일러)

---

## Task 6: units + occupancies 데이터 계층

**Files:** Create `hooks/reactquery/units/*` + `hooks/reactquery/occupancies/*` + 각 `apis.test.ts`
**Interfaces — Produces:** `Unit`/`UnitInput`(+ buildingId), `useUnits(buildingId)`,`useCreateUnit`,`useUpdateUnit`,`useDeleteUnit`; `Occupancy`/`OccupancyInput`(+ unitId, status), `useOccupancies(unitId)`,`useCreateOccupancy`,`useUpdateOccupancy`,`useDeleteOccupancy`. **Task 5(buildings) 파일 형태 그대로**, 조회는 `.eq("building_id",buildingId)`/`.eq("unit_id",unitId)`, insert는 부모 FK 포함(org_id 없음 — RLS 부모경유).

- [ ] **Step 1~5:** Task 5와 동일 구조로 TDD. apis.test는 각각 list 매핑 + create가 building_id/unit_id 포함 insert 검증. 필드 매핑: units(unit_no,dong,area_pyeong,room_count,elec_customer_no,elec_meter_no,water_customer_no,memo), occupancies(tenant_name,payer_name,phone,resident_count,vehicle_no,move_in_date,move_out_date,deposit,monthly_rent,status,memo). Commit: `feat(p1a): units·occupancies 데이터 계층`.

---

## Task 7: buildingTypes + feeItems 데이터 계층

**Files:** Create `hooks/reactquery/buildingTypes/*` + `hooks/reactquery/feeItems/*` + test
**Interfaces — Produces:** `BuildingType`,`useBuildingTypes`,`useCreateBuildingType`,`useRenameBuildingType`,`useDeleteBuildingType`,`useReorderBuildingTypes`; `FeeItem`(rounding/dailyProration/carryOver/isRequired/sortOrder/typeId),`useFeeItems(typeId)`,`useCreateFeeItem`,`useUpdateFeeItem`,`useDeleteFeeItem`,`useReorderFeeItems`. **패턴 Task 5 동일.**

- [ ] **Step 1: 실패 테스트** — feeItems apis.test에 **필수항목 보호** 포함:

```tsx
// deleteFeeItem은 is_required=true면 throw("필수 항목은 삭제할 수 없습니다")
it("필수 항목 삭제 거부", async () => {
  await expect(deleteFeeItem({ id:1, isRequired:true })).rejects.toThrow("필수 항목은 삭제할 수 없습니다");
});
```

- [ ] **Step 2~5:** 구현(Task 5 형태) + `deleteFeeItem`/`updateFeeItem`(rename)에서 `isRequired` 가드(앱레벨). reorder는 `sort_order` 일괄 update. Commit: `feat(p1a): buildingTypes·feeItems 데이터 계층(필수항목 보호)`.

---

## Task 8: vendorCategories + vendors + 첨부 데이터 계층

**Files:** Create `hooks/reactquery/vendorCategories/*` + `hooks/reactquery/vendors/*` + test
**Interfaces — Produces:** `VendorCategory`,`useVendorCategories`,`useCreateVendorCategory`,`useRenameVendorCategory`,`useDeleteVendorCategory`; `Vendor`,`useVendors(categoryId?,search?)`,`useCreateVendor`,`useUpdateVendor`,`useDeleteVendor`; 첨부: `uploadVendorAttachment(vendorId, file, orgId)`→Storage 업로드+attachments insert, `useVendorAttachments(vendorId)`. **패턴 Task 5 동일.**

- [ ] **Step 1: 실패 테스트** — vendors apis.test: list 매핑 + create org_id 포함. 첨부 업로드는 Storage mock:

```tsx
// createClient().storage.from('attachments').upload(path, file) 호출 + attachments insert(entity_type='vendor')
it("uploadVendorAttachment: org 경로로 업로드 후 attachments insert", async () => { /* storage.upload + from('attachments').insert 검증 */ });
```
경로 규칙: `${orgId}/vendor/${vendorId}/${crypto.randomUUID()}-${file.name}`.

- [ ] **Step 2~5:** 구현 + Commit `feat(p1a): vendorCategories·vendors·첨부 데이터 계층`.

---

## Task 9: building-list 화면

**Files:** Create `app/(staff)/staff/building-list/page.tsx` + `components/{BuildingTable,BuildingFormModal,BuildingDetailPanel,UnitList,UnitFormModal,OccupancyList,OccupancyFormModal}.tsx` + `page.test.tsx`
**Interfaces — Consumes:** Task 3 프리미티브, Task 5/6 훅, `useMe()`(P0, orgId). **Produces:** `/staff/building-list` 라우트.

- [ ] **Step 1: 실패 테스트** — `page.test.tsx`(훅 mock): 건물 리스트 렌더 + `＋ 건물 등록` 클릭 시 모달, 행 클릭 시 상세 패널에 호실 표시.

```tsx
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: () => ({ data:[{id:1,code:"001",name:"그린빌라",address:"서울"}], isLoading:false }), useCreateBuilding:()=>({mutateAsync:vi.fn()}), useUpdateBuilding:()=>({mutateAsync:vi.fn()}), useDeleteBuilding:()=>({mutateAsync:vi.fn()}) }));
// units/occupancies/useMe도 mock. "그린빌라" 렌더 + 등록 버튼 존재 assert.
```

- [ ] **Step 2~4:** 구현(프리미티브 조합, 좌 리스트 + 우 마스터-디테일, `?bld=` 자동선택). 폼은 RHF+zod(Task4)+훅. 통과 확인.
- [ ] **Step 5: build** — Run `npm run build`; Expected: `/staff/building-list` 라우트 생성.
- [ ] **Step 6: Commit** — `feat(p1a): building-list 화면(건물·호실·입주자)`.

---

## Task 10: fee-item 화면

**Files:** Create `app/(staff)/staff/fee-item/page.tsx` + `components/{BuildingTypeTabs,FeeItemList,FeeItemFormModal}.tsx` + `page.test.tsx`
**Interfaces — Consumes:** 프리미티브(Tabs), Task 7 훅.

- [ ] **Step 1: 실패 테스트** — 유형 탭 렌더 + 탭 전환 시 해당 유형 항목 로드 + `＋ 항목 추가` 모달 + 필수항목(전기·수도·가스) 삭제버튼 비노출.
- [ ] **Step 2~4:** 구현(탭=buildingTypes, 리스트=feeItems, 드래그 정렬=useReorderFeeItems, 필수항목 상단 고정·삭제불가). 통과.
- [ ] **Step 5: build** → `/staff/fee-item`.
- [ ] **Step 6: Commit** — `feat(p1a): fee-item 화면(유형별 항목·필수 고정)`.

---

## Task 11: vendor-management 화면

**Files:** Create `app/(staff)/staff/vendor-management/page.tsx` + `components/{VendorCategorySidebar,VendorList,VendorFormModal}.tsx` + `page.test.tsx`
**Interfaces — Consumes:** 프리미티브(SidebarList,SearchBar,Modal), Task 8 훅.

- [ ] **Step 1: 실패 테스트** — 구분 사이드바 렌더 + 구분 선택 시 필터 + 검색 + `＋ 업체 추가` 모달(업체명 필수) + 사진 업로드 입력 존재.
- [ ] **Step 2~4:** 구현(사이드바=vendorCategories+카운트, 리스트=vendors(categoryId,search), 모달=업체+계약서사진 업로드). 통과.
- [ ] **Step 5: build** → `/staff/vendor-management`.
- [ ] **Step 6: Commit** — `feat(p1a): vendor-management 화면(구분·업체·첨부)`.

---

## Task 12: 전체 검증 + E2E 체크리스트

**Files:** (없음 — 검증/문서)

- [ ] **Step 1: 전체 테스트** — Run `npm test`; Expected: 전 태스크 유닛 PASS(출력 pristine).
- [ ] **Step 2: 빌드** — Run `npm run build`; Expected: `/staff/{building-list,fee-item,vendor-management}` + 기존 라우트 생성 성공.
- [ ] **Step 3: E2E 체크리스트(pending-user, 라이브 Supabase)** — 마이그레이션 적용 + `attachments` 버킷/정책 생성 후: 건물 등록→호실 추가→입주자 추가, 유형/항목 CRUD(필수항목 삭제불가 확인), 거래처 등록+사진 업로드, 타 org 격리(RLS) 확인.
- [ ] **Step 4: Commit(있으면)** — `chore(p1a): 검증 마무리`.

---

## Self-Review (작성자 체크)

**Spec coverage:** §3 스키마→T1; §4 RLS→T1; §5 Storage→T1(스니펫)/T8(업로드); §6 데이터계층 6도메인→T5(buildings)·T6(units·occupancies)·T7(buildingTypes·feeItems)·T8(vendorCategories·vendors·첨부); §7.0 디자인시스템→T2(토큰)·T3(프리미티브); §7.1–7.3 화면→T9·T10·T11; §10 테스트→각 TDD + T12. 필수 fee_item 보호(§2·§6)→T7. 결정 6–10(인라인 owner/텍스트 담당자/부모경유 RLS/권한 P1b)→T1 스키마·RLS에 반영.

**Placeholder scan:** T6~T8·T9~T11은 "Task 5 형태 그대로"로 **기존 코드 패턴(Task 5 완전코드 + P0 auth 도메인)** 참조 — 반복 보일러플레이트 축약이며 신규 타입/시그니처는 Interfaces에 명시(placeholder 아님). 화면 태스크의 Step 2~4는 프리미티브·훅 조합 지시 + 테스트가 계약을 고정.

**Type consistency:** rowTo*/inputToRow 매핑, `useMe().orgId`로 org_id 주입, keys 팩토리 네이밍(`<domain>Keys`), 훅 네이밍(use<Domain>/useCreate<Domain>...) 전 도메인 일관. Storage 경로 `${orgId}/vendor/${vendorId}/...` ↔ RLS `foldername[1]=org_id` 일치.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-07-p1a-master-data.md`.

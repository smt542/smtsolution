# P3a 건물 관리(/staff/buildings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 건물 도메인을 PRD 계층 라우트(`/staff/buildings`, `/new`, `/[id]`)로 재구축한다 — 담당자 계정 FK·시설 jsonb·고객번호/협력업체 자식 테이블·통합 저장 RPC·서버사이드 엑셀.

**Architecture:** 신규 DB(`0004`)는 `buildings` 변경(담당자 FK 3 + `facilities` jsonb, 레거시 담당자명 3컬럼 제거) + `building_customer_numbers` + `building_vendors`. 통합 저장은 원자적 RPC `save_building`, 목록은 definer RPC `list_buildings`(이름·세대수·검침일 집계 + 총건수). 데이터는 하우스 컨벤션 reactquery 도메인, 파일은 기존 `attachments` 버킷(longTermRepair 패턴 미러). 목록은 필터·페이지네이션·엑셀, 상세는 5섹션 단일 폼(저장 1개).

**Tech Stack:** Next.js 16(App Router) · Supabase(PostgreSQL·Auth·Storage, anon+RLS / route는 server client) · React Query v5 · react-hook-form + zod · exceljs · Tailwind v4 · Vitest 4 + Testing Library · sonner.

## Global Constraints

- **기준 spec:** `docs/superpowers/specs/2026-08-12-p3a-buildings-design.md`. 모든 결정(2 담당자 FK / 3 엑셀 유틸 / A 통합저장 RPC / B 시설 jsonb / C·D 자식테이블 / F module RLS / I 코드 유지)을 준수.
- **구현 베이스:** `master`(P0·P1a·P2a·P2b, 마이그레이션 0000~0003 포함)에서 분기한 `p3a` 브랜치. `current_user_has_module()`·`current_user_org()`·`list_accounts()`·`buildings`·`units`·`occupancies`·`attachments`·Storage 버킷 `attachments` 존재 전제.
- **마이그레이션 번호:** 다음은 `supabase/migrations/0004_p3a_buildings.sql`. 검증은 `supabase/verify/p3a_checks.sql`.
- **DB는 pending-user:** 원격 Supabase 미접속으로 **런타임 스모크 불가**. 검증은 `npm test`(vitest) + `npx tsc --noEmit` + `npm run lint` + verify SQL **정적 리뷰**까지. 마이그레이션 라이브 적용·E2E는 사용자 PC 몫(순서 0002→0003→0004).
- **Next.js 주의(AGENTS.md):** 동적 세그먼트 `[id]`·`route.ts` 핸들러·`useRouter`/`redirect` 시그니처는 이 버전 규약이 다를 수 있으므로 구현 전 `node_modules/next/dist/docs/`(이 파일 기준 해석)를 확인한다. 커밋 시 재생성되는 AGENTS.md 에이전트 블록은 작업과 함께 커밋해 트리를 깨끗이 둔다.
- **컨벤션:** snake↔camel 매핑은 `apis.ts`, zod는 `components/forms/schema/`, 공용 프리미티브는 `@/components/common`(`Button`·`Input`·`Select`·`Checkbox`·`Modal`·`DataTable`·`EmptyState`·`Spinner`), RLS 이디엄 `org_id in (select my_org_ids())`, 소프트삭제 `deleted_at`(목록 `is null`). 파일 alias `@/` = 저장소 루트.
- **개별 테스트 실행:** `npx vitest run <path>`. 경로에 괄호가 있으면 따옴표(`"app/(staff)/..."`). 타입 `npx tsc --noEmit`, 린트 `npm run lint`.
- **커밋 트레일러(필수):** 모든 커밋 끝에 두 번째 `-m`으로 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **WBS 동기화:** 화면(page)을 실제로 만든/바꾼 커밋 직후에만 `wbs-commit-sync`로 dev 트랙 반영(주택관리ERP 버킷, `완료` 자동변경 금지). 데이터층·마이그레이션 전용 커밋은 생략. (건물 화면 반영은 Task 10·Task 17.)

## File Structure

**DB**
- Create `supabase/migrations/0004_p3a_buildings.sql` — buildings 변경 + 신규 2테이블 + RLS + `save_building`·`list_buildings` RPC + `soft_delete_building` 확장.
- Create `supabase/verify/p3a_checks.sql` — 컬럼/정책/RPC 정적 검증.

**데이터 계층 (`hooks/reactquery/`)**
- Create `buildingCustomerNumbers/{apis,keys,queries,index}.ts` (+ `apis.test.ts`).
- Create `buildingVendors/{apis,keys,queries,index}.ts` (+ `apis.test.ts`).
- Create `attachments/{apis,keys,queries,mutations,index}.ts` (+ `apis.test.ts`) — 범용 업로드/목록/삭제/서명URL.
- Modify `buildings/{apis,keys,queries,mutations,index}.ts` (+ `apis.test.ts`) — FK·facilities·list RPC·getBuildingFull·saveBuilding.
- Create `buildings/staffOptions.ts` 아님 → `buildings/queries.ts`에 `useStaffOptions` 추가(계정 재사용).

**스키마 (`components/forms/schema/`)**
- Modify `building.ts` (+ `building.test.ts`) — FK·facilities·memo.
- Create `buildingCustomerNumber.ts`, `buildingVendor.ts` (+ 각 `.test.ts`).

**엑셀**
- Create `lib/export/xlsx.ts` (+ `xlsx.test.ts`).
- Create `app/api/buildings/export/route.ts`.

**공용 컴포넌트**
- Modify `components/common/DataTable.tsx` — `onRowDoubleClick` 추가.

**페이지·컴포넌트 (`app/(staff)/staff/buildings/`)**
- Modify `page.tsx` (+ `page.test.tsx`) — 게이트 + `BuildingList`.
- Create `components/BuildingList.tsx` (+ `.test.tsx`).
- Create `new/page.tsx`, `[id]/page.tsx`.
- Create `components/BuildingForm.tsx` (+ `.test.tsx`), `components/sections/{BasicInfoSection,FacilitiesSection,CustomerNumberSection,VendorSection,MemoSection}.tsx` (+ 필요한 `.test.tsx`).
- Delete `components/{BuildingTable,BuildingFormModal,BuildingDetailPanel,UnitList}.tsx` (P1a 잔재; `units`/`occupancies` 훅은 P3b용으로 유지).

---

## 그룹 1 — DB · 데이터 계층

### Task 1: 마이그레이션 0004 + 검증 SQL

**Files:**
- Create: `supabase/migrations/0004_p3a_buildings.sql`
- Create: `supabase/verify/p3a_checks.sql`

**Interfaces:**
- Produces: `buildings.manager_user_id/meter_user_id/cleaning_user_id/facilities`; 테이블 `building_customer_numbers`·`building_vendors`; RPC `save_building(...)→jsonb`·`list_buildings(...)→setof`; RLS 정책; `soft_delete_building` 확장.
- Consumes: P0 `set_updated_at`·`my_org_ids`·`organizations`·`auth.users`; P1a `buildings`·`units`·`occupancies`; P2a `current_user_org`·`current_user_has_module`·`org_members`·`profiles`.

> **TDD 예외(문서화):** 원격 DB 미접속으로 vitest 대상 아님. "테스트"는 `p3a_checks.sql` 어서션 + spec §3~§5 대조 정적 리뷰. 라이브 실행은 사용자.

- [ ] **Step 1: `0004_p3a_buildings.sql` 작성** (spec §3·§4·§5)

```sql
-- P3a: 건물 관리(/staff/buildings)
-- 의존: P0(organizations, set_updated_at, my_org_ids, auth.users),
--       P1a(buildings, units, occupancies), P2a(current_user_org, current_user_has_module, org_members, profiles)

-- ===== buildings 변경: 담당자 FK + 시설 jsonb =====
alter table buildings
  drop column manager_name,
  drop column meter_staff_name,
  drop column cleaning_staff_name,
  add column manager_user_id  uuid references auth.users(id) on delete set null,
  add column meter_user_id    uuid references auth.users(id) on delete set null,
  add column cleaning_user_id uuid references auth.users(id) on delete set null,
  add column facilities        jsonb not null default '{}'::jsonb;
create index on buildings (org_id, manager_user_id);
create index on buildings (org_id, meter_user_id);
create index on buildings (org_id, cleaning_user_id);

-- ===== 건물별 고객번호(유형별 복수) =====
create table building_customer_numbers (
  id bigint generated always as identity primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  kind text not null check (kind in ('water','common_elec','elec','gas')),
  customer_no text not null,
  meter_day int check (meter_day between 1 and 31),
  billing_basis text not null default 'current' check (billing_basis in ('prev','current')),
  print_on_bill boolean not null default true,
  holder_name text,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on building_customer_numbers (building_id);

-- ===== 건물별 협력업체(계약서 파일은 attachments 재사용) =====
create table building_vendors (
  id bigint generated always as identity primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  vendor_type text not null check (vendor_type in ('elevator','fire','electric','septic','etc')),
  name text not null,
  phone text,
  memo text,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on building_vendors (building_id);

-- ===== updated_at 트리거 =====
do $$ declare t text; begin
  foreach t in array array['building_customer_numbers','building_vendors'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- ===== 소프트삭제 확장(신규 자식 포함) =====
create or replace function soft_delete_building(p_id bigint)
returns void language sql set search_path = public as $$
  update occupancies o set deleted_at = now()
    from units u where u.id = o.unit_id and u.building_id = p_id and o.deleted_at is null;
  update units set deleted_at = now() where building_id = p_id and deleted_at is null;
  update building_customer_numbers set deleted_at = now() where building_id = p_id and deleted_at is null;
  update building_vendors          set deleted_at = now() where building_id = p_id and deleted_at is null;
  update buildings set deleted_at = now() where id = p_id and deleted_at is null;
$$;

-- ===== RLS: 신규 자식(select 개방 / write buildings 모듈) =====
alter table building_customer_numbers enable row level security;
alter table building_vendors          enable row level security;

create policy bcn_select on building_customer_numbers for select
  using (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy bcn_write on building_customer_numbers for all
  using      (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('buildings'))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('buildings'));

create policy bv_select on building_vendors for select
  using (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy bv_write on building_vendors for all
  using      (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('buildings'))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('buildings'));

-- ===== buildings 쓰기 조이기(현장직원 DB 차단) =====
drop policy bld_all on buildings;
create policy bld_select on buildings for select using (org_id in (select my_org_ids()));
create policy bld_write  on buildings for all
  using      (org_id in (select my_org_ids()) and current_user_has_module('buildings'))
  with check (org_id in (select my_org_ids()) and current_user_has_module('buildings'));

-- ===== 통합 저장 RPC(원자적) =====
create or replace function save_building(
  p_id bigint, p_code text, p_name text, p_address text,
  p_manager_user_id uuid, p_meter_user_id uuid, p_cleaning_user_id uuid,
  p_facilities jsonb, p_memo text,
  p_customer_numbers jsonb, p_vendors jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_id bigint := p_id;
  v_code text := nullif(trim(coalesce(p_code,'')), '');
  v_mgr uuid; v_meter uuid; v_clean uuid;
  v_item jsonb;
  v_vendor_map jsonb := '[]'::jsonb;
  v_new_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('buildings') then raise exception 'forbidden: buildings required'; end if;

  -- 담당자 uuid는 같은 org 구성원만 허용(아니면 null)
  select user_id into v_mgr   from org_members where org_id = v_org and user_id = p_manager_user_id;
  select user_id into v_meter from org_members where org_id = v_org and user_id = p_meter_user_id;
  select user_id into v_clean from org_members where org_id = v_org and user_id = p_cleaning_user_id;

  if v_id is null then
    if v_code is null then
      select 'B' || lpad((coalesce(max(nullif(regexp_replace(code,'\D','','g'),''))::int,0)+1)::text, 4, '0')
        into v_code from buildings where org_id = v_org;
    end if;
    insert into buildings(org_id, code, name, address, manager_user_id, meter_user_id, cleaning_user_id, facilities, memo)
      values (v_org, v_code, p_name, nullif(p_address,''), v_mgr, v_meter, v_clean,
              coalesce(p_facilities,'{}'::jsonb), nullif(p_memo,''))
      returning id into v_id;
  else
    update buildings set
      code = coalesce(v_code, code), name = p_name, address = nullif(p_address,''),
      manager_user_id = v_mgr, meter_user_id = v_meter, cleaning_user_id = v_clean,
      facilities = coalesce(p_facilities,'{}'::jsonb), memo = nullif(p_memo,'')
      where id = v_id and org_id = v_org;
    if not found then raise exception 'building not found in org'; end if;
  end if;

  -- 고객번호 동기화
  for v_item in select value from jsonb_array_elements(coalesce(p_customer_numbers,'[]'::jsonb)) loop
    if coalesce((v_item->>'_deleted')::boolean, false) and (v_item->>'id') is not null then
      update building_customer_numbers set deleted_at = now()
        where id = (v_item->>'id')::bigint and building_id = v_id;
    elsif (v_item->>'id') is not null then
      update building_customer_numbers set
        kind = v_item->>'kind', customer_no = v_item->>'customer_no',
        meter_day = nullif(v_item->>'meter_day','')::int,
        billing_basis = coalesce(v_item->>'billing_basis','current'),
        print_on_bill = coalesce((v_item->>'print_on_bill')::boolean, true),
        holder_name = v_item->>'holder_name', sort_order = coalesce((v_item->>'sort_order')::int, 0)
        where id = (v_item->>'id')::bigint and building_id = v_id;
    else
      insert into building_customer_numbers(building_id, kind, customer_no, meter_day, billing_basis, print_on_bill, holder_name, sort_order)
        values (v_id, v_item->>'kind', v_item->>'customer_no', nullif(v_item->>'meter_day','')::int,
                coalesce(v_item->>'billing_basis','current'), coalesce((v_item->>'print_on_bill')::boolean, true),
                v_item->>'holder_name', coalesce((v_item->>'sort_order')::int, 0));
    end if;
  end loop;

  -- 협력업체 동기화(+ client_key→id 매핑)
  for v_item in select value from jsonb_array_elements(coalesce(p_vendors,'[]'::jsonb)) loop
    if coalesce((v_item->>'_deleted')::boolean, false) and (v_item->>'id') is not null then
      update building_vendors set deleted_at = now()
        where id = (v_item->>'id')::bigint and building_id = v_id;
    elsif (v_item->>'id') is not null then
      update building_vendors set
        vendor_type = v_item->>'vendor_type', name = v_item->>'name', phone = v_item->>'phone',
        memo = v_item->>'memo', sort_order = coalesce((v_item->>'sort_order')::int, 0)
        where id = (v_item->>'id')::bigint and building_id = v_id;
    else
      insert into building_vendors(building_id, vendor_type, name, phone, memo, sort_order)
        values (v_id, v_item->>'vendor_type', v_item->>'name', v_item->>'phone', v_item->>'memo',
                coalesce((v_item->>'sort_order')::int, 0))
        returning id into v_new_id;
      if (v_item->>'client_key') is not null then
        v_vendor_map := v_vendor_map || jsonb_build_object('client_key', v_item->>'client_key', 'id', v_new_id);
      end if;
    end if;
  end loop;

  return jsonb_build_object('building_id', v_id, 'vendors', v_vendor_map);
end $$;
revoke execute on function save_building(bigint,text,text,text,uuid,uuid,uuid,jsonb,text,jsonb,jsonb) from anon;

-- ===== 목록 RPC(이름·세대수·검침일 집계 + 총건수) =====
create or replace function list_buildings(
  p_search text default null, p_manager uuid default null, p_meter uuid default null,
  p_cleaning uuid default null, p_limit int default 20, p_offset int default 0
) returns table(
  id bigint, code text, name text, address text,
  manager_user_id uuid, meter_user_id uuid, cleaning_user_id uuid,
  manager_name text, meter_name text, cleaning_name text,
  total_units bigint, occupied_units bigint, min_meter_day int, total bigint
) language sql stable security definer set search_path = public as $$
  with base as (
    select b.* from buildings b
    where b.org_id = current_user_org() and b.deleted_at is null
      and (p_search   is null or b.name ilike '%'||p_search||'%' or b.address ilike '%'||p_search||'%')
      and (p_manager  is null or b.manager_user_id  = p_manager)
      and (p_meter    is null or b.meter_user_id    = p_meter)
      and (p_cleaning is null or b.cleaning_user_id = p_cleaning)
  )
  select base.id, base.code, base.name, base.address,
    base.manager_user_id, base.meter_user_id, base.cleaning_user_id,
    mp.full_name, tp.full_name, cp.full_name,
    (select count(*) from units u where u.building_id = base.id and u.deleted_at is null),
    (select count(*) from units u join occupancies o on o.unit_id = u.id
       where u.building_id = base.id and u.deleted_at is null and o.deleted_at is null and o.status = 'occupied'),
    (select min(bcn.meter_day) from building_customer_numbers bcn where bcn.building_id = base.id and bcn.deleted_at is null),
    count(*) over()
  from base
  left join profiles mp on mp.user_id = base.manager_user_id
  left join profiles tp on tp.user_id = base.meter_user_id
  left join profiles cp on cp.user_id = base.cleaning_user_id
  order by base.created_at desc
  limit p_limit offset p_offset
$$;
revoke execute on function list_buildings(text,uuid,uuid,uuid,int,int) from anon;
```

- [ ] **Step 2: `p3a_checks.sql` 작성** (정적 어서션)

```sql
-- P3a 검증 (사용자 PC에서 psql로 실행). 실패 시 raise.
-- 1) buildings 담당자 FK 컬럼 존재 + 레거시명 제거
do $$ begin
  perform 1 from information_schema.columns where table_name='buildings' and column_name='manager_user_id';
  if not found then raise exception 'buildings.manager_user_id missing'; end if;
  perform 1 from information_schema.columns where table_name='buildings' and column_name='manager_name';
  if found then raise exception 'legacy buildings.manager_name must be dropped'; end if;
  perform 1 from information_schema.columns where table_name='buildings' and column_name='facilities';
  if not found then raise exception 'buildings.facilities missing'; end if;
end $$;

-- 2) 신규 자식 테이블 + check 제약
do $$ begin
  perform 1 from information_schema.columns where table_name='building_customer_numbers' and column_name='billing_basis';
  if not found then raise exception 'building_customer_numbers.billing_basis missing'; end if;
  perform 1 from information_schema.columns where table_name='building_vendors' and column_name='vendor_type';
  if not found then raise exception 'building_vendors.vendor_type missing'; end if;
end $$;

-- 3) buildings 쓰기 정책이 module 게이트, select는 개방
do $$ begin
  perform 1 from pg_policies where tablename='buildings' and policyname='bld_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'bld_write must gate by current_user_has_module'; end if;
  perform 1 from pg_policies where tablename='buildings' and policyname='bld_select' and coalesce(qual,'') not like '%current_user_has_module%';
  if not found then raise exception 'bld_select must be open (no module gate)'; end if;
end $$;

-- 4) RPC 존재
do $$ begin
  perform 1 from pg_proc where proname='save_building';
  if not found then raise exception 'save_building missing'; end if;
  perform 1 from pg_proc where proname='list_buildings';
  if not found then raise exception 'list_buildings missing'; end if;
end $$;

-- 5) 수동 확인(주석): save_building 신규 insert 시 code 자동생성(B0001..),
--    현장직원(buildings 미보유)은 save_building 호출 시 'forbidden' 예외,
--    타 org uuid 담당자는 null 저장, 타 org building_customer_numbers select 0행.
```

- [ ] **Step 3: 정적 리뷰 & 커밋**

SQL을 spec §3·§4·§5와 대조(컬럼·정책·RPC 시그니처 일치). 라이브 실행 없음.

```bash
git add supabase/migrations/0004_p3a_buildings.sql supabase/verify/p3a_checks.sql
git commit -m "feat(db): P3a 건물 스키마·담당자 FK·통합저장/목록 RPC·module RLS(0004)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `buildingCustomerNumbers` 도메인

**Files:**
- Create: `hooks/reactquery/buildingCustomerNumbers/{apis.ts,keys.ts,queries.ts,index.ts}`
- Test: `hooks/reactquery/buildingCustomerNumbers/apis.test.ts`

**Interfaces:**
- Produces: `CustomerNumberKind='water'|'common_elec'|'elec'|'gas'`; `BuildingCustomerNumber {id,buildingId,kind,customerNo,meterDay,billingBasis,printOnBill,holderName,sortOrder}`; `listCustomerNumbersByBuilding(buildingId)`; `useCustomerNumbers(buildingId)`; `customerNumberKeys`.
- Consumes: `createClient`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// hooks/reactquery/buildingCustomerNumbers/apis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listCustomerNumbersByBuilding } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("buildingCustomerNumbers apis", () => {
  it("listByBuilding: building_id + deleted_at null + sort_order + snake→camel", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 1, building_id: 3, kind: "water", customer_no: "C-1", meter_day: 5,
        billing_basis: "current", print_on_bill: true, holder_name: "홍길동", sort_order: 0 }],
      error: null,
    });
    const is = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ is }));
    from.mockReturnValue({ select: () => ({ eq }) });

    const r = await listCustomerNumbersByBuilding(3);

    expect(from).toHaveBeenCalledWith("building_customer_numbers");
    expect(eq).toHaveBeenCalledWith("building_id", 3);
    expect(is).toHaveBeenCalledWith("deleted_at", null);
    expect(r[0]).toEqual({ id: 1, buildingId: 3, kind: "water", customerNo: "C-1", meterDay: 5,
      billingBasis: "current", printOnBill: true, holderName: "홍길동", sortOrder: 0 });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run hooks/reactquery/buildingCustomerNumbers/apis.test.ts` · Expected: FAIL(모듈 없음).

- [ ] **Step 3: 구현 — apis.ts**

```ts
// hooks/reactquery/buildingCustomerNumbers/apis.ts
import { createClient } from "@/lib/supabase/client";

export type CustomerNumberKind = "water" | "common_elec" | "elec" | "gas";

export interface BuildingCustomerNumber {
  id: number;
  buildingId: number;
  kind: CustomerNumberKind;
  customerNo: string;
  meterDay: number | null;
  billingBasis: "prev" | "current";
  printOnBill: boolean;
  holderName: string | null;
  sortOrder: number;
}

export const toCustomerNumber = (r: any): BuildingCustomerNumber => ({
  id: r.id, buildingId: r.building_id, kind: r.kind, customerNo: r.customer_no,
  meterDay: r.meter_day, billingBasis: r.billing_basis, printOnBill: r.print_on_bill,
  holderName: r.holder_name, sortOrder: r.sort_order,
});

export async function listCustomerNumbersByBuilding(buildingId: number): Promise<BuildingCustomerNumber[]> {
  const { data, error } = await createClient()
    .from("building_customer_numbers")
    .select("*")
    .eq("building_id", buildingId)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toCustomerNumber);
}
```

- [ ] **Step 4: 구현 — keys/queries/index**

```ts
// hooks/reactquery/buildingCustomerNumbers/keys.ts
export const customerNumberKeys = {
  all: ["buildingCustomerNumbers"] as const,
  byBuilding: (id: number) => ["buildingCustomerNumbers", id] as const,
};
```
```ts
// hooks/reactquery/buildingCustomerNumbers/queries.ts
import { useQuery } from "@tanstack/react-query";
import { listCustomerNumbersByBuilding } from "./apis";
import { customerNumberKeys } from "./keys";
export function useCustomerNumbers(buildingId: number) {
  return useQuery({
    queryKey: customerNumberKeys.byBuilding(buildingId),
    queryFn: () => listCustomerNumbersByBuilding(buildingId),
    enabled: !!buildingId,
  });
}
```
```ts
// hooks/reactquery/buildingCustomerNumbers/index.ts
export * from "./apis"; export * from "./keys"; export * from "./queries";
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run hooks/reactquery/buildingCustomerNumbers/apis.test.ts` · Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add hooks/reactquery/buildingCustomerNumbers
git commit -m "feat(buildings): buildingCustomerNumbers 도메인(건물별 고객번호 조회)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `buildingVendors` 도메인

**Files:**
- Create: `hooks/reactquery/buildingVendors/{apis.ts,keys.ts,queries.ts,index.ts}`
- Test: `hooks/reactquery/buildingVendors/apis.test.ts`

**Interfaces:**
- Produces: `VendorType='elevator'|'fire'|'electric'|'septic'|'etc'`; `BuildingVendor {id,buildingId,vendorType,name,phone,memo,sortOrder}`; `listBuildingVendorsByBuilding(buildingId)`; `useBuildingVendors(buildingId)`; `buildingVendorKeys`.
- Consumes: `createClient`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// hooks/reactquery/buildingVendors/apis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listBuildingVendorsByBuilding } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("buildingVendors apis", () => {
  it("listByBuilding: building_id + deleted_at null + snake→camel", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 7, building_id: 3, vendor_type: "elevator", name: "한국승강기", phone: "02-1", memo: null, sort_order: 0 }],
      error: null,
    });
    const is = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ is }));
    from.mockReturnValue({ select: () => ({ eq }) });

    const r = await listBuildingVendorsByBuilding(3);

    expect(from).toHaveBeenCalledWith("building_vendors");
    expect(eq).toHaveBeenCalledWith("building_id", 3);
    expect(r[0]).toEqual({ id: 7, buildingId: 3, vendorType: "elevator", name: "한국승강기", phone: "02-1", memo: null, sortOrder: 0 });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run hooks/reactquery/buildingVendors/apis.test.ts` · Expected: FAIL.

- [ ] **Step 3: 구현 — apis.ts**

```ts
// hooks/reactquery/buildingVendors/apis.ts
import { createClient } from "@/lib/supabase/client";

export type VendorType = "elevator" | "fire" | "electric" | "septic" | "etc";

export interface BuildingVendor {
  id: number;
  buildingId: number;
  vendorType: VendorType;
  name: string;
  phone: string | null;
  memo: string | null;
  sortOrder: number;
}

export const toBuildingVendor = (r: any): BuildingVendor => ({
  id: r.id, buildingId: r.building_id, vendorType: r.vendor_type,
  name: r.name, phone: r.phone, memo: r.memo, sortOrder: r.sort_order,
});

export async function listBuildingVendorsByBuilding(buildingId: number): Promise<BuildingVendor[]> {
  const { data, error } = await createClient()
    .from("building_vendors")
    .select("*")
    .eq("building_id", buildingId)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toBuildingVendor);
}
```

- [ ] **Step 4: 구현 — keys/queries/index**

```ts
// hooks/reactquery/buildingVendors/keys.ts
export const buildingVendorKeys = {
  all: ["buildingVendors"] as const,
  byBuilding: (id: number) => ["buildingVendors", id] as const,
};
```
```ts
// hooks/reactquery/buildingVendors/queries.ts
import { useQuery } from "@tanstack/react-query";
import { listBuildingVendorsByBuilding } from "./apis";
import { buildingVendorKeys } from "./keys";
export function useBuildingVendors(buildingId: number) {
  return useQuery({
    queryKey: buildingVendorKeys.byBuilding(buildingId),
    queryFn: () => listBuildingVendorsByBuilding(buildingId),
    enabled: !!buildingId,
  });
}
```
```ts
// hooks/reactquery/buildingVendors/index.ts
export * from "./apis"; export * from "./keys"; export * from "./queries";
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run hooks/reactquery/buildingVendors/apis.test.ts` · Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add hooks/reactquery/buildingVendors
git commit -m "feat(buildings): buildingVendors 도메인(건물별 협력업체 조회)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 범용 `attachments` 도메인 (longTermRepair 패턴 미러)

**Files:**
- Create: `hooks/reactquery/attachments/{apis.ts,keys.ts,queries.ts,mutations.ts,index.ts}`
- Test: `hooks/reactquery/attachments/apis.test.ts`

**Interfaces:**
- Produces: `Attachment {id,orgId,entityType,entityId,kind,fileUrl,fileName,createdAt}`; `uploadAttachment({entityType,entityId,orgId,kind,file})`; `listAttachments(entityType,entityId)`; `listAttachmentsByEntities(entityType, ids)`; `deleteAttachment({id,path})`; `attachmentSignedUrl(path,expires?)`; `useAttachments(entityType,entityId)`; `attachmentKeys`.
- Consumes: `createClient` (+ `storage.from("attachments")`).

- [ ] **Step 1: 실패 테스트 작성**

```ts
// hooks/reactquery/attachments/apis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const uploadMock = vi.fn();
const removeMock = vi.fn();
const createSignedUrlMock = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from,
    storage: { from: () => ({ upload: uploadMock, remove: removeMock, createSignedUrl: createSignedUrlMock }) },
  }),
}));
import { uploadAttachment, listAttachments } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("attachments apis", () => {
  it("upload: {org}/{entityType}/{entityId}/ 경로 + 행 insert", async () => {
    uploadMock.mockResolvedValue({ error: null });
    const single = vi.fn().mockResolvedValue({
      data: { id: 10, org_id: 9, entity_type: "building_vendor", entity_id: 7, kind: "contract",
        file_url: "9/building_vendor/7/x.pdf", file_name: "x.pdf", created_at: "t" },
      error: null,
    });
    from.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });

    const file = new File(["c"], "x.pdf", { type: "application/pdf" });
    const r = await uploadAttachment({ entityType: "building_vendor", entityId: 7, orgId: 9, kind: "contract", file });

    expect(uploadMock).toHaveBeenCalledWith(expect.stringMatching(/^9\/building_vendor\/7\//), file);
    expect(r).toMatchObject({ id: 10, entityType: "building_vendor", entityId: 7, kind: "contract" });
  });

  it("listAttachments: entity_type·entity_id 필터", async () => {
    const eq2 = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    from.mockReturnValue({ select: () => ({ eq: eq1 }) });
    await listAttachments("building_vendor", 7);
    expect(eq1).toHaveBeenCalledWith("entity_type", "building_vendor");
    expect(eq2).toHaveBeenCalledWith("entity_id", 7);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run hooks/reactquery/attachments/apis.test.ts` · Expected: FAIL.

- [ ] **Step 3: 구현 — apis.ts** (longTermRepair 로직 일반화)

```ts
// hooks/reactquery/attachments/apis.ts
import { createClient } from "@/lib/supabase/client";

export interface Attachment {
  id: number; orgId: number; entityType: string; entityId: number;
  kind: string; fileUrl: string; fileName: string; createdAt: string;
}

const toAtt = (r: any): Attachment => ({
  id: r.id, orgId: r.org_id, entityType: r.entity_type, entityId: r.entity_id,
  kind: r.kind, fileUrl: r.file_url, fileName: r.file_name, createdAt: r.created_at,
});

export async function uploadAttachment(params: {
  entityType: string; entityId: number; orgId: number; kind: string; file: File;
}): Promise<Attachment> {
  const { entityType, entityId, orgId, kind, file } = params;
  const sb = createClient();
  const path = `${orgId}/${entityType}/${entityId}/${crypto.randomUUID()}-${file.name}`;
  const { error: upErr } = await sb.storage.from("attachments").upload(path, file);
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await sb.from("attachments").insert({
    org_id: orgId, entity_type: entityType, entity_id: entityId, kind, file_url: path, file_name: file.name,
  }).select().single();
  if (error) {
    await sb.storage.from("attachments").remove([path]);
    throw new Error(error.message);
  }
  return toAtt(data);
}

export async function listAttachments(entityType: string, entityId: number): Promise<Attachment[]> {
  const { data, error } = await createClient()
    .from("attachments").select("*").eq("entity_type", entityType).eq("entity_id", entityId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAtt);
}

export async function listAttachmentsByEntities(entityType: string, ids: number[]): Promise<Attachment[]> {
  if (ids.length === 0) return [];
  const { data, error } = await createClient()
    .from("attachments").select("*").eq("entity_type", entityType).in("entity_id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAtt);
}

export async function deleteAttachment(params: { id: number; path: string }): Promise<void> {
  const sb = createClient();
  const { error: sErr } = await sb.storage.from("attachments").remove([params.path]);
  if (sErr) throw new Error(sErr.message);
  const { error } = await sb.from("attachments").delete().eq("id", params.id);
  if (error) throw new Error(error.message);
}

export async function attachmentSignedUrl(path: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await createClient().storage.from("attachments").createSignedUrl(path, expiresInSec);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
```

- [ ] **Step 4: 구현 — keys/queries/mutations/index**

```ts
// hooks/reactquery/attachments/keys.ts
export const attachmentKeys = {
  all: ["attachments"] as const,
  byEntity: (entityType: string, entityId: number) => ["attachments", entityType, entityId] as const,
};
```
```ts
// hooks/reactquery/attachments/queries.ts
import { useQuery } from "@tanstack/react-query";
import { listAttachments } from "./apis";
import { attachmentKeys } from "./keys";
export function useAttachments(entityType: string, entityId: number) {
  return useQuery({
    queryKey: attachmentKeys.byEntity(entityType, entityId),
    queryFn: () => listAttachments(entityType, entityId),
    enabled: !!entityId,
  });
}
```
```ts
// hooks/reactquery/attachments/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadAttachment, deleteAttachment } from "./apis";
import { attachmentKeys } from "./keys";
export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadAttachment,
    onSuccess: (a) => qc.invalidateQueries({ queryKey: attachmentKeys.byEntity(a.entityType, a.entityId) }),
  });
}
export function useDeleteAttachment(entityType: string, entityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAttachment,
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentKeys.byEntity(entityType, entityId) }),
  });
}
```
```ts
// hooks/reactquery/attachments/index.ts
export * from "./apis"; export * from "./keys"; export * from "./queries"; export * from "./mutations";
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run hooks/reactquery/attachments/apis.test.ts` · Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add hooks/reactquery/attachments
git commit -m "feat(buildings): 범용 attachments 도메인(업로드·목록·삭제·서명URL)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `buildings` 도메인 개편 (FK·facilities·list RPC·getBuildingFull·saveBuilding·staffOptions)

**Files:**
- Modify: `hooks/reactquery/buildings/apis.ts`
- Modify: `hooks/reactquery/buildings/keys.ts`
- Modify: `hooks/reactquery/buildings/queries.ts`
- Modify: `hooks/reactquery/buildings/mutations.ts`
- Test: `hooks/reactquery/buildings/apis.test.ts` (교체)

**Interfaces:**
- Produces: `FACILITY_KEYS`, `FacilityKey`, `FacilityFlag`, `FacilitiesMap`, `emptyFacilities()`; `Building`(FK·facilities); `BuildingDirectoryRow`; `BuildingListParams`, `BuildingListResult`; `BuildingFull`; `SaveBuildingPayload`, `SaveBuildingResult`; `listBuildings(params)`, `getBuildingFull(id)`, `saveBuilding(payload)`, `deleteBuilding(id)`; `useBuildingList(params)`, `useBuildingFull(id)`, `useStaffOptions()`, `useSaveBuilding()`, `useDeleteBuilding()`; `buildingKeys`.
- Consumes: `createClient`; `listAccounts` (`@/hooks/reactquery/accounts`); `listCustomerNumbersByBuilding`·`BuildingCustomerNumber` (Task 2); `listBuildingVendorsByBuilding`·`BuildingVendor` (Task 3).

- [ ] **Step 1: 실패 테스트 작성** (기존 apis.test.ts 전체 교체)

```ts
// hooks/reactquery/buildings/apis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));
vi.mock("@/hooks/reactquery/buildingCustomerNumbers", () => ({ listCustomerNumbersByBuilding: vi.fn(async () => []) }));
vi.mock("@/hooks/reactquery/buildingVendors", () => ({ listBuildingVendorsByBuilding: vi.fn(async () => []) }));

import { listBuildings, saveBuilding, emptyFacilities } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("buildings apis", () => {
  it("listBuildings: list_buildings RPC 호출 + rows/total 분리", async () => {
    rpc.mockResolvedValue({
      data: [
        { id: 1, code: "B0001", name: "가나빌", address: "서울", manager_user_id: "u1", meter_user_id: null,
          cleaning_user_id: null, manager_name: "김관리", meter_name: null, cleaning_name: null,
          total_units: 10, occupied_units: 7, min_meter_day: 5, total: 1 },
      ],
      error: null,
    });
    const r = await listBuildings({ managerUserId: "u1", page: 1, pageSize: 20 });
    expect(rpc).toHaveBeenCalledWith("list_buildings", expect.objectContaining({
      p_manager: "u1", p_limit: 20, p_offset: 0,
    }));
    expect(r.total).toBe(1);
    expect(r.rows[0]).toMatchObject({ id: 1, name: "가나빌", managerName: "김관리", totalUnits: 10, occupiedUnits: 7 });
  });

  it("listBuildings: page 2 → offset 계산", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await listBuildings({ page: 3, pageSize: 10 });
    expect(rpc).toHaveBeenCalledWith("list_buildings", expect.objectContaining({ p_limit: 10, p_offset: 20 }));
  });

  it("saveBuilding: RPC payload(snake) + 결과 파싱", async () => {
    rpc.mockResolvedValue({ data: { building_id: 42, vendors: [{ client_key: "ck1", id: 99 }] }, error: null });
    const res = await saveBuilding({
      id: null, code: "", name: "새빌딩", address: "부산",
      managerUserId: "u1", meterUserId: null, cleaningUserId: null,
      facilities: emptyFacilities(), memo: "메모",
      customerNumbers: [{ kind: "water", customerNo: "C1", billingBasis: "current", printOnBill: true }],
      vendors: [{ clientKey: "ck1", vendorType: "elevator", name: "승강기업체" }],
    });
    expect(rpc).toHaveBeenCalledWith("save_building", expect.objectContaining({
      p_id: null, p_name: "새빌딩", p_manager_user_id: "u1",
    }));
    const args = rpc.mock.calls[0][1];
    expect(args.p_customer_numbers[0]).toMatchObject({ kind: "water", customer_no: "C1", print_on_bill: true });
    expect(args.p_vendors[0]).toMatchObject({ client_key: "ck1", vendor_type: "elevator", name: "승강기업체" });
    expect(res).toEqual({ buildingId: 42, vendors: [{ clientKey: "ck1", id: 99 }] });
  });

  it("emptyFacilities: 9키 전부 {on:false, memo:''}", () => {
    const f = emptyFacilities();
    expect(Object.keys(f)).toHaveLength(9);
    expect(f.cctv).toEqual({ on: false, memo: "" });
    expect(f.fire_safety).toEqual({ on: false, memo: "" });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run hooks/reactquery/buildings/apis.test.ts` · Expected: FAIL.

- [ ] **Step 3: 구현 — apis.ts** (전체 교체)

```ts
// hooks/reactquery/buildings/apis.ts
import { createClient } from "@/lib/supabase/client";
import { listCustomerNumbersByBuilding, type BuildingCustomerNumber } from "@/hooks/reactquery/buildingCustomerNumbers";
import { listBuildingVendorsByBuilding, type BuildingVendor } from "@/hooks/reactquery/buildingVendors";

export const FACILITY_KEYS = [
  "cctv", "elevator", "cleaning", "metering", "management",
  "septic", "internet", "electric_safety", "fire_safety",
] as const;
export type FacilityKey = (typeof FACILITY_KEYS)[number];
export interface FacilityFlag { on: boolean; memo: string; }
export type FacilitiesMap = Record<FacilityKey, FacilityFlag>;
export function emptyFacilities(): FacilitiesMap {
  return Object.fromEntries(FACILITY_KEYS.map((k) => [k, { on: false, memo: "" }])) as FacilitiesMap;
}
function toFacilities(raw: any): FacilitiesMap {
  const base = emptyFacilities();
  if (raw && typeof raw === "object") {
    for (const k of FACILITY_KEYS) {
      if (raw[k]) base[k] = { on: !!raw[k].on, memo: typeof raw[k].memo === "string" ? raw[k].memo : "" };
    }
  }
  return base;
}

export interface Building {
  id: number; orgId: number; code: string; name: string; address: string | null; typeId: number | null;
  ownerName: string | null; ownerPhone: string | null; entrancePassword: string | null;
  managerUserId: string | null; meterUserId: string | null; cleaningUserId: string | null;
  facilities: FacilitiesMap; memo: string | null;
}
const rowToBuilding = (r: any): Building => ({
  id: r.id, orgId: r.org_id, code: r.code, name: r.name, address: r.address, typeId: r.type_id,
  ownerName: r.owner_name, ownerPhone: r.owner_phone, entrancePassword: r.entrance_password,
  managerUserId: r.manager_user_id, meterUserId: r.meter_user_id, cleaningUserId: r.cleaning_user_id,
  facilities: toFacilities(r.facilities), memo: r.memo,
});

export interface BuildingDirectoryRow {
  id: number; code: string; name: string; address: string | null;
  managerUserId: string | null; meterUserId: string | null; cleaningUserId: string | null;
  managerName: string | null; meterName: string | null; cleaningName: string | null;
  totalUnits: number; occupiedUnits: number; minMeterDay: number | null;
}
const rowToDirectory = (r: any): BuildingDirectoryRow => ({
  id: r.id, code: r.code, name: r.name, address: r.address,
  managerUserId: r.manager_user_id, meterUserId: r.meter_user_id, cleaningUserId: r.cleaning_user_id,
  managerName: r.manager_name, meterName: r.meter_name, cleaningName: r.cleaning_name,
  totalUnits: Number(r.total_units ?? 0), occupiedUnits: Number(r.occupied_units ?? 0),
  minMeterDay: r.min_meter_day,
});

export interface BuildingListParams {
  search?: string; managerUserId?: string; meterUserId?: string; cleaningUserId?: string;
  page?: number; pageSize?: number;
}
export interface BuildingListResult { rows: BuildingDirectoryRow[]; total: number; }

export async function listBuildings(params: BuildingListParams = {}): Promise<BuildingListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const { data, error } = await createClient().rpc("list_buildings", {
    p_search: params.search ?? null,
    p_manager: params.managerUserId ?? null,
    p_meter: params.meterUserId ?? null,
    p_cleaning: params.cleaningUserId ?? null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map(rowToDirectory);
  const total = data && data.length > 0 ? Number(data[0].total) : 0;
  return { rows, total };
}

export interface BuildingFull extends Building {
  customerNumbers: BuildingCustomerNumber[];
  vendors: BuildingVendor[];
}
export async function getBuildingFull(id: number): Promise<BuildingFull> {
  const { data, error } = await createClient()
    .from("buildings").select("*").eq("id", id).is("deleted_at", null).single();
  if (error) throw new Error(error.message);
  const [customerNumbers, vendors] = await Promise.all([
    listCustomerNumbersByBuilding(id),
    listBuildingVendorsByBuilding(id),
  ]);
  return { ...rowToBuilding(data), customerNumbers, vendors };
}

export interface CustomerNumberPayload {
  id?: number; kind: string; customerNo: string; meterDay?: number | null;
  billingBasis: string; printOnBill: boolean; holderName?: string | null; sortOrder?: number; _deleted?: boolean;
}
export interface VendorPayload {
  id?: number; clientKey?: string; vendorType: string; name: string;
  phone?: string | null; memo?: string | null; sortOrder?: number; _deleted?: boolean;
}
export interface SaveBuildingPayload {
  id?: number | null; code?: string; name: string; address?: string | null;
  managerUserId?: string | null; meterUserId?: string | null; cleaningUserId?: string | null;
  facilities: FacilitiesMap; memo?: string | null;
  customerNumbers: CustomerNumberPayload[]; vendors: VendorPayload[];
}
export interface SaveBuildingResult { buildingId: number; vendors: { clientKey: string; id: number }[]; }

export async function saveBuilding(p: SaveBuildingPayload): Promise<SaveBuildingResult> {
  const { data, error } = await createClient().rpc("save_building", {
    p_id: p.id ?? null,
    p_code: p.code ?? null,
    p_name: p.name,
    p_address: p.address ?? null,
    p_manager_user_id: p.managerUserId ?? null,
    p_meter_user_id: p.meterUserId ?? null,
    p_cleaning_user_id: p.cleaningUserId ?? null,
    p_facilities: p.facilities,
    p_memo: p.memo ?? null,
    p_customer_numbers: p.customerNumbers.map((c) => ({
      id: c.id, kind: c.kind, customer_no: c.customerNo, meter_day: c.meterDay ?? null,
      billing_basis: c.billingBasis, print_on_bill: c.printOnBill, holder_name: c.holderName ?? null,
      sort_order: c.sortOrder ?? 0, _deleted: c._deleted ?? false,
    })),
    p_vendors: p.vendors.map((v) => ({
      id: v.id, client_key: v.clientKey, vendor_type: v.vendorType, name: v.name,
      phone: v.phone ?? null, memo: v.memo ?? null, sort_order: v.sortOrder ?? 0, _deleted: v._deleted ?? false,
    })),
  });
  if (error) throw new Error(error.message);
  return {
    buildingId: (data as any).building_id,
    vendors: ((data as any).vendors ?? []).map((x: any) => ({ clientKey: x.client_key, id: x.id })),
  };
}

export async function deleteBuilding(id: number): Promise<void> {
  const { error } = await createClient().rpc("soft_delete_building", { p_id: id });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: 구현 — keys.ts / queries.ts / mutations.ts** (전체 교체)

```ts
// hooks/reactquery/buildings/keys.ts
export const buildingKeys = {
  all: ["buildings"] as const,
  list: (p?: unknown) => ["buildings", "list", p ?? {}] as const,
  full: (id: number) => ["buildings", "full", id] as const,
  staffOptions: () => ["buildings", "staffOptions"] as const,
};
```
```ts
// hooks/reactquery/buildings/queries.ts
import { useQuery } from "@tanstack/react-query";
import { listBuildings, getBuildingFull, type BuildingListParams } from "./apis";
import { buildingKeys } from "./keys";
import { listAccounts } from "@/hooks/reactquery/accounts";

export function useBuildingList(params: BuildingListParams) {
  return useQuery({ queryKey: buildingKeys.list(params), queryFn: () => listBuildings(params) });
}
export function useBuildingFull(id: number) {
  return useQuery({ queryKey: buildingKeys.full(id), queryFn: () => getBuildingFull(id), enabled: !!id });
}
// 담당자 드롭다운: 활성 직원 계정(현장직원·세입자 제외는 UI에서 처리, 여기선 전체 계정)
export function useStaffOptions() {
  return useQuery({
    queryKey: buildingKeys.staffOptions(),
    queryFn: () => listAccounts(),
  });
}
```
```ts
// hooks/reactquery/buildings/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveBuilding, deleteBuilding, type SaveBuildingPayload } from "./apis";
import { buildingKeys } from "./keys";

export function useSaveBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SaveBuildingPayload) => saveBuilding(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: buildingKeys.all }),
  });
}
export function useDeleteBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteBuilding(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: buildingKeys.all }),
  });
}
```

> `index.ts`는 기존 `export * from "./apis"; ...` 그대로 유지(변경 없음).

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run hooks/reactquery/buildings/apis.test.ts` · Expected: PASS(4 tests).

- [ ] **Step 6: 타입 점검** — Run: `npx tsc --noEmit` · Expected: 기존 `buildings/page.tsx`가 삭제된 `managerName` 등을 참조해 **에러 발생 가능**. 이 태스크에서는 `apis.test.ts` 통과까지만 확인하고, `page.tsx`·구 컴포넌트는 Task 10·17에서 교체하므로 여기서 tsc 에러는 예상됨(다음 커밋에서 해소). 데이터층 파일만 스테이징.

- [ ] **Step 7: 커밋**

```bash
git add hooks/reactquery/buildings
git commit -m "feat(buildings): buildings 도메인 개편(담당자 FK·facilities·list/save RPC·getBuildingFull)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: zod 스키마 (building 개편 + customerNumber + vendor)

**Files:**
- Modify: `components/forms/schema/building.ts`
- Test: `components/forms/schema/building.test.ts` (교체/보강)
- Create: `components/forms/schema/buildingCustomerNumber.ts` (+ `.test.ts`)
- Create: `components/forms/schema/buildingVendor.ts` (+ `.test.ts`)

**Interfaces:**
- Produces: `facilityFlagSchema`, `facilitiesSchema`, `buildingBasicSchema`, `BuildingBasicValues`; `customerNumberSchema`, `CustomerNumberValues`; `buildingVendorSchema`, `BuildingVendorValues`.
- Consumes: `zod`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// components/forms/schema/building.test.ts
import { describe, it, expect } from "vitest";
import { buildingBasicSchema, facilitiesSchema } from "./building";

describe("building schema", () => {
  it("basic: name·address 필수, 담당자 uuid|null 허용", () => {
    expect(buildingBasicSchema.safeParse({ name: "가나빌", address: "서울", memo: "" }).success).toBe(true);
    expect(buildingBasicSchema.safeParse({ name: "", address: "서울" }).success).toBe(false);
    expect(buildingBasicSchema.safeParse({ name: "가나빌", address: "" }).success).toBe(false);
    expect(buildingBasicSchema.safeParse({ name: "가나빌", address: "서울", managerUserId: null }).success).toBe(true);
  });
  it("basic: memo 1000자 초과 거부", () => {
    expect(buildingBasicSchema.safeParse({ name: "n", address: "a", memo: "가".repeat(1001) }).success).toBe(false);
  });
  it("facilities: 9키 각 {on,memo}", () => {
    const ok = Object.fromEntries(
      ["cctv","elevator","cleaning","metering","management","septic","internet","electric_safety","fire_safety"]
        .map((k) => [k, { on: false, memo: "" }]));
    expect(facilitiesSchema.safeParse(ok).success).toBe(true);
  });
});
```
```ts
// components/forms/schema/buildingCustomerNumber.test.ts
import { describe, it, expect } from "vitest";
import { customerNumberSchema } from "./buildingCustomerNumber";
describe("customerNumber schema", () => {
  it("kind enum + customerNo 필수 + meterDay 1..31", () => {
    expect(customerNumberSchema.safeParse({ kind: "water", customerNo: "C1", billingBasis: "current", printOnBill: true }).success).toBe(true);
    expect(customerNumberSchema.safeParse({ kind: "bad", customerNo: "C1", billingBasis: "current", printOnBill: true }).success).toBe(false);
    expect(customerNumberSchema.safeParse({ kind: "water", customerNo: "", billingBasis: "current", printOnBill: true }).success).toBe(false);
    expect(customerNumberSchema.safeParse({ kind: "water", customerNo: "C1", billingBasis: "current", printOnBill: true, meterDay: 32 }).success).toBe(false);
  });
});
```
```ts
// components/forms/schema/buildingVendor.test.ts
import { describe, it, expect } from "vitest";
import { buildingVendorSchema } from "./buildingVendor";
describe("buildingVendor schema", () => {
  it("vendorType enum + name 필수", () => {
    expect(buildingVendorSchema.safeParse({ vendorType: "elevator", name: "업체" }).success).toBe(true);
    expect(buildingVendorSchema.safeParse({ vendorType: "x", name: "업체" }).success).toBe(false);
    expect(buildingVendorSchema.safeParse({ vendorType: "elevator", name: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run components/forms/schema/building.test.ts components/forms/schema/buildingCustomerNumber.test.ts components/forms/schema/buildingVendor.test.ts` · Expected: FAIL.

- [ ] **Step 3: 구현 — building.ts** (전체 교체)

```ts
// components/forms/schema/building.ts
import { z } from "zod";

export const facilityFlagSchema = z.object({ on: z.boolean(), memo: z.string() });
export const facilitiesSchema = z.object({
  cctv: facilityFlagSchema, elevator: facilityFlagSchema, cleaning: facilityFlagSchema,
  metering: facilityFlagSchema, management: facilityFlagSchema, septic: facilityFlagSchema,
  internet: facilityFlagSchema, electric_safety: facilityFlagSchema, fire_safety: facilityFlagSchema,
});

export const buildingBasicSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "건물명을 입력해 주세요"),
  address: z.string().min(1, "주소를 입력해 주세요"),
  managerUserId: z.string().uuid().nullable().optional(),
  meterUserId: z.string().uuid().nullable().optional(),
  cleaningUserId: z.string().uuid().nullable().optional(),
  memo: z.string().max(1000, "참고사항은 1000자 이내로 입력해 주세요").optional(),
});

export type BuildingBasicValues = z.infer<typeof buildingBasicSchema>;
export type FacilitiesValues = z.infer<typeof facilitiesSchema>;
```
```ts
// components/forms/schema/buildingCustomerNumber.ts
import { z } from "zod";
export const customerNumberSchema = z.object({
  kind: z.enum(["water", "common_elec", "elec", "gas"]),
  customerNo: z.string().min(1, "고객번호를 입력해 주세요"),
  meterDay: z.number().int().min(1).max(31).nullable().optional(),
  billingBasis: z.enum(["prev", "current"]),
  printOnBill: z.boolean(),
  holderName: z.string().optional(),
});
export type CustomerNumberValues = z.infer<typeof customerNumberSchema>;
```
```ts
// components/forms/schema/buildingVendor.ts
import { z } from "zod";
export const buildingVendorSchema = z.object({
  vendorType: z.enum(["elevator", "fire", "electric", "septic", "etc"]),
  name: z.string().min(1, "업체명을 입력해 주세요"),
  phone: z.string().optional(),
  memo: z.string().optional(),
});
export type BuildingVendorValues = z.infer<typeof buildingVendorSchema>;
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run components/forms/schema/building.test.ts components/forms/schema/buildingCustomerNumber.test.ts components/forms/schema/buildingVendor.test.ts` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add components/forms/schema/building.ts components/forms/schema/building.test.ts components/forms/schema/buildingCustomerNumber.ts components/forms/schema/buildingCustomerNumber.test.ts components/forms/schema/buildingVendor.ts components/forms/schema/buildingVendor.test.ts
git commit -m "feat(buildings): 건물 zod 스키마(기본정보·시설·고객번호·협력업체)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 그룹 2 — 목록 · 엑셀

### Task 7: 엑셀 공통 유틸 `lib/export/xlsx.ts`

**Files:**
- Create: `lib/export/xlsx.ts`
- Test: `lib/export/xlsx.test.ts`
- Modify: `package.json` (exceljs 추가)

**Interfaces:**
- Produces: `XlsxColumn {header,key,width?}`; `rowsToXlsxBuffer(columns, rows): Promise<Buffer>`.
- Consumes: `exceljs`.

- [ ] **Step 1: exceljs 설치**

Run: `npm install exceljs`
Expected: `package.json` dependencies에 `exceljs` 추가, `package-lock.json` 갱신.

- [ ] **Step 2: 실패 테스트 작성**

```ts
// lib/export/xlsx.test.ts
import { describe, it, expect } from "vitest";
import { rowsToXlsxBuffer } from "./xlsx";

describe("rowsToXlsxBuffer", () => {
  it("xlsx(zip) 시그니처(PK) 버퍼 생성", async () => {
    const buf = await rowsToXlsxBuffer(
      [{ header: "건물명", key: "name" }, { header: "주소", key: "address" }],
      [{ name: "가나빌", address: "서울" }],
    );
    expect(buf.length).toBeGreaterThan(0);
    // xlsx는 zip → 첫 2바이트 'PK' (0x50 0x4b)
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it("빈 rows도 안전", async () => {
    const buf = await rowsToXlsxBuffer([{ header: "A", key: "a" }], []);
    expect(buf.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: 실패 확인** — Run: `npx vitest run lib/export/xlsx.test.ts` · Expected: FAIL.

- [ ] **Step 4: 구현**

```ts
// lib/export/xlsx.ts
import ExcelJS from "exceljs";

export interface XlsxColumn {
  header: string;
  key: string;
  width?: number;
}

export async function rowsToXlsxBuffer(
  columns: XlsxColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  for (const row of rows) ws.addRow(row);
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run lib/export/xlsx.test.ts` · Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add lib/export/xlsx.ts lib/export/xlsx.test.ts package.json package-lock.json
git commit -m "feat(export): 서버사이드 xlsx 공통 유틸(exceljs)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 엑셀 라우트 핸들러 `app/api/buildings/export/route.ts`

**Files:**
- Create: `app/api/buildings/export/route.ts`

**Interfaces:**
- Consumes: `createClient` (`@/lib/supabase/server`), `rowsToXlsxBuffer` (Task 7).
- Produces: GET → `.xlsx` 다운로드 응답.

> **Next.js 확인:** 라우트 핸들러 시그니처(`export async function GET(request: Request)`)·`Response` 바디로 Buffer 전달 방식을 `node_modules/next/dist/docs/`에서 확인. `list_buildings` RPC는 서버 client에서도 RLS/definer 동일 적용.

- [ ] **Step 1: 구현** (라이브 DB 필요 → 정적 리뷰 대상. 런타임 스모크는 사용자 PC)

```ts
// app/api/buildings/export/route.ts
import { createClient } from "@/lib/supabase/server";
import { rowsToXlsxBuffer } from "@/lib/export/xlsx";

const VENDOR_NONE = "";
const KIND_KO: Record<string, string> = { water: "수도", common_elec: "공용전기", elec: "전기", gas: "가스" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const meter = p.get("meter") || null;

  const sb = await createClient();
  const { data, error } = await sb.rpc("list_buildings", {
    p_search: p.get("search") || null,
    p_manager: p.get("manager") || null,
    p_meter: meter,
    p_cleaning: p.get("cleaning") || null,
    p_limit: 100000,
    p_offset: 0,
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let rows = (data ?? []) as any[];
  // 검침담당자 필터가 있으면 검침일(min_meter_day) 오름차순
  if (meter) rows = [...rows].sort((a, b) => (a.min_meter_day ?? 99) - (b.min_meter_day ?? 99));

  const table = rows.map((r) => ({
    name: r.name,
    address: r.address ?? VENDOR_NONE,
    manager: r.manager_name ?? VENDOR_NONE,
    meterStaff: r.meter_name ?? VENDOR_NONE,
    cleaning: r.cleaning_name ?? VENDOR_NONE,
    meterDay: r.min_meter_day ?? VENDOR_NONE,
    totalUnits: Number(r.total_units ?? 0),
    occupiedUnits: Number(r.occupied_units ?? 0),
  }));

  const buffer = await rowsToXlsxBuffer(
    [
      { header: "건물명", key: "name", width: 24 },
      { header: "주소", key: "address", width: 32 },
      { header: "관리담당자", key: "manager", width: 14 },
      { header: "검침담당자", key: "meterStaff", width: 14 },
      { header: "청소담당자", key: "cleaning", width: 14 },
      { header: "검침일", key: "meterDay", width: 8 },
      { header: "총세대수", key: "totalUnits", width: 10 },
      { header: "입주세대수", key: "occupiedUnits", width: 10 },
    ],
    table,
  );

  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="buildings_${ymd}.xlsx"; filename*=UTF-8''${encodeURIComponent(`건물목록_${ymd}.xlsx`)}`,
    },
  });
}
```

- [ ] **Step 2: 타입/린트** — Run: `npx tsc --noEmit` · Expected: 라우트 파일 타입 통과(페이지/구컴포넌트 에러는 Task 10·17 전까지 잔존 가능). Run: `npm run lint` (route 파일 대상 경고 없음).

- [ ] **Step 3: 커밋**

```bash
git add "app/api/buildings/export/route.ts"
git commit -m "feat(buildings): 건물목록 엑셀 다운 라우트(검침일 오름차순·한글 파일명)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `DataTable` 더블클릭 지원

**Files:**
- Modify: `components/common/DataTable.tsx`

**Interfaces:**
- Produces: `DataTable` props에 `onRowDoubleClick?: (row) => void` 추가(기존 `onRowClick` 유지).

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// components/common/DataTable.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DataTable } from "./DataTable";

describe("DataTable", () => {
  it("행 더블클릭 시 onRowDoubleClick(row) 호출", () => {
    const onDbl = vi.fn();
    render(
      <DataTable
        columns={[{ key: "name", label: "이름" }]}
        rows={[{ name: "가나빌" }]}
        onRowDoubleClick={onDbl}
      />,
    );
    fireEvent.doubleClick(screen.getByText("가나빌"));
    expect(onDbl).toHaveBeenCalledWith({ name: "가나빌" });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run components/common/DataTable.test.tsx` · Expected: FAIL(prop 미지원).

- [ ] **Step 3: 구현** (전체 교체)

```tsx
// components/common/DataTable.tsx
import React from "react";

export function DataTable({
  columns,
  rows,
  onRowClick,
  onRowDoubleClick,
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, React.ReactNode>[];
  onRowClick?: (row: Record<string, React.ReactNode>) => void;
  onRowDoubleClick?: (row: Record<string, React.ReactNode>) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-bg">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left font-bold text-t2">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              onDoubleClick={() => onRowDoubleClick?.(row)}
              className={`border-b border-line last:border-0 ${
                onRowClick || onRowDoubleClick ? "cursor-pointer hover:bg-bg" : ""
              }`}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-t1">
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run components/common/DataTable.test.tsx` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add components/common/DataTable.tsx components/common/DataTable.test.tsx
git commit -m "feat(common): DataTable 행 더블클릭(onRowDoubleClick) 지원" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `BuildingList` 컴포넌트 + `page.tsx` 재작성

**Files:**
- Create: `app/(staff)/staff/buildings/components/BuildingList.tsx`
- Test: `app/(staff)/staff/buildings/components/BuildingList.test.tsx`
- Modify: `app/(staff)/staff/buildings/page.tsx` (전체 교체)
- Test: `app/(staff)/staff/buildings/page.test.tsx` (신규)

**Interfaces:**
- Consumes: `useBuildingList`·`useStaffOptions` (Task 5), `DataTable` (Task 9), `Button`·`Select`·`SearchBar`·`EmptyState`·`Spinner`, `useRouter` (`next/navigation`), `useMe`·`hasModule`.
- Produces: `BuildingList` (필터·페이지네이션·엑셀·등록·더블클릭 네비); `BuildingListPage`(게이트).

- [ ] **Step 1: 실패 테스트 작성** (핵심 동작만)

```tsx
// app/(staff)/staff/buildings/components/BuildingList.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildingList: vi.fn(),
  useStaffOptions: vi.fn(() => ({ data: [] })),
}));
import { useBuildingList } from "@/hooks/reactquery/buildings";
import { BuildingList } from "./BuildingList";

beforeEach(() => vi.clearAllMocks());

describe("BuildingList", () => {
  it("행 더블클릭 시 상세로 이동", () => {
    vi.mocked(useBuildingList).mockReturnValue({
      data: { rows: [{ id: 5, code: "B0005", name: "가나빌", address: "서울", managerUserId: null, meterUserId: null,
        cleaningUserId: null, managerName: "김관리", meterName: null, cleaningName: null, totalUnits: 3, occupiedUnits: 2, minMeterDay: 5 }], total: 1 },
      isLoading: false, isError: false,
    } as any);
    render(<BuildingList />);
    fireEvent.doubleClick(screen.getByText("가나빌"));
    expect(push).toHaveBeenCalledWith("/staff/buildings/5");
  });

  it("결과 없음 안내", () => {
    vi.mocked(useBuildingList).mockReturnValue({ data: { rows: [], total: 0 }, isLoading: false, isError: false } as any);
    render(<BuildingList />);
    expect(screen.getByText(/조건에 맞는 건물이 없습니다|등록된 건물이 없습니다/)).toBeInTheDocument();
  });

  it("등록 버튼 → /new 이동", () => {
    vi.mocked(useBuildingList).mockReturnValue({ data: { rows: [], total: 0 }, isLoading: false, isError: false } as any);
    render(<BuildingList />);
    fireEvent.click(screen.getByRole("button", { name: /건물 등록/ }));
    expect(push).toHaveBeenCalledWith("/staff/buildings/new");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/BuildingList.test.tsx"` · Expected: FAIL.

- [ ] **Step 3: 구현 — BuildingList.tsx**

```tsx
// app/(staff)/staff/buildings/components/BuildingList.tsx
"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, SearchBar, EmptyState, Spinner, DataTable } from "@/components/common";
import { useBuildingList, useStaffOptions } from "@/hooks/reactquery/buildings";

const PAGE_SIZES = [10, 20, 50] as const;

export function BuildingList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [manager, setManager] = useState("");
  const [meter, setMeter] = useState("");
  const [cleaning, setCleaning] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const { data: staff } = useStaffOptions();
  const staffOptions = useMemo(
    () => [{ value: "", label: "전체" }, ...(staff ?? []).map((s) => ({ value: s.userId, label: s.fullName }))],
    [staff],
  );

  const params = {
    search: search || undefined,
    managerUserId: manager || undefined,
    meterUserId: meter || undefined,
    cleaningUserId: cleaning || undefined,
    page,
    pageSize,
  };
  const { data, isLoading, isError } = useBuildingList(params);

  const rows = (data?.rows ?? []).map((b) => ({
    _id: b.id,
    name: b.name,
    address: b.address ?? "-",
    manager: b.managerName ?? "-",
    meter: b.meterName ?? "-",
    cleaning: b.cleaningName ?? "-",
    total: b.totalUnits,
    occupied: b.occupiedUnits,
  }));
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilter = !!(search || manager || meter || cleaning);

  const exportHref = () => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (manager) q.set("manager", manager);
    if (meter) q.set("meter", meter);
    if (cleaning) q.set("cleaning", cleaning);
    return `/api/buildings/export?${q.toString()}`;
  };

  const resetFilters = () => { setSearch(""); setManager(""); setMeter(""); setCleaning(""); setPage(1); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-t1">건물 관리</h1>
        <div className="flex gap-2">
          <a href={exportHref()} className="inline-flex h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-t2 hover:bg-bg">
            엑셀 다운
          </a>
          <Button variant="primary" onClick={() => router.push("/staff/buildings/new")}>+ 건물 등록</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-64"><SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="건물명·주소 검색" /></div>
        <div className="w-40"><Select aria-label="관리담당자" options={staffOptions} value={manager} onChange={(e) => { setManager(e.target.value); setPage(1); }} /></div>
        <div className="w-40"><Select aria-label="검침담당자" options={staffOptions} value={meter} onChange={(e) => { setMeter(e.target.value); setPage(1); }} /></div>
        <div className="w-40"><Select aria-label="청소담당자" options={staffOptions} value={cleaning} onChange={(e) => { setCleaning(e.target.value); setPage(1); }} /></div>
        {hasFilter && <Button variant="ghost" onClick={resetFilters}>필터 초기화</Button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : isError ? (
        <EmptyState message="데이터를 불러오지 못했습니다. 다시 시도해 주세요." />
      ) : rows.length === 0 ? (
        <EmptyState message={hasFilter ? "조건에 맞는 건물이 없습니다." : "등록된 건물이 없습니다."} />
      ) : (
        <>
          <DataTable
            columns={[
              { key: "name", label: "건물명" }, { key: "address", label: "주소" },
              { key: "manager", label: "관리담당자" }, { key: "meter", label: "검침담당자" },
              { key: "cleaning", label: "청소담당자" }, { key: "total", label: "총세대수" },
              { key: "occupied", label: "입주세대수" },
            ]}
            rows={rows}
            onRowDoubleClick={(r) => router.push(`/staff/buildings/${r._id}`)}
          />
          <div className="flex items-center justify-between">
            <Select
              aria-label="페이지당 건수"
              className="w-28"
              options={PAGE_SIZES.map((n) => ({ value: String(n), label: `${n}건` }))}
              value={String(pageSize)}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            />
            <div className="flex items-center gap-2">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</Button>
              <span className="text-sm text-t3">{page} / {totalPages}</span>
              <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>다음</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

> **SearchBar 확인:** `components/common/SearchBar.tsx`의 실제 props가 `{value,onChange(string),placeholder}` 형태인지 확인하고 시그니처가 다르면 맞춘다(구현 시 파일 열람).

- [ ] **Step 4: `page.tsx` 재작성**

```tsx
// app/(staff)/staff/buildings/page.tsx
"use client";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { BuildingList } from "./components/BuildingList";

export default function BuildingsPage() {
  const { data: me } = useMe();
  if (me === undefined) return null;
  if (!hasModule(me, "buildings")) {
    return (
      <div className="p-6">
        <p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (건물 관리 권한 필요)</p>
      </div>
    );
  }
  return (
    <div className="p-6">
      <BuildingList />
    </div>
  );
}
```

- [ ] **Step 5: page 게이트 테스트**

```tsx
// app/(staff)/staff/buildings/page.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("./components/BuildingList", () => ({ BuildingList: () => <div>LIST</div> }));
import SetupPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
beforeEach(() => vi.clearAllMocks());

describe("BuildingsPage 게이트", () => {
  it("buildings 권한 없으면 차단", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "field_staff", permissions: [] } } as any);
    render(<SetupPage />);
    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText("LIST")).toBeNull();
  });
  it("buildings 권한 있으면 목록", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "staff", permissions: ["buildings"] } } as any);
    render(<SetupPage />);
    expect(screen.getByText("LIST")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: 통과 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/BuildingList.test.tsx" "app/(staff)/staff/buildings/page.test.tsx"` · Expected: PASS.

- [ ] **Step 7: 커밋 + WBS 동기화**

```bash
git add "app/(staff)/staff/buildings/page.tsx" "app/(staff)/staff/buildings/page.test.tsx" "app/(staff)/staff/buildings/components/BuildingList.tsx" "app/(staff)/staff/buildings/components/BuildingList.test.tsx"
git commit -m "feat(buildings): 건물 목록(담당자 필터·페이지네이션·엑셀·더블클릭 네비)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
화면 변경 커밋 → `wbs-commit-sync`로 `건물·입주자` dev 트랙 반영(진행중; `완료` 자동변경 금지).

> **주의:** 이 시점에서 구 컴포넌트(`BuildingTable` 등)를 아직 삭제하지 않았으면 `page.tsx`가 더 이상 import하지 않으므로 미사용 상태다. `tsc`/lint 통과를 위해 Task 17에서 삭제하거나, 여기서 함께 삭제해도 된다(그 경우 Task 17 Step은 생략).

---

## 그룹 3 — 상세 폼 (5섹션)

> **폼 상태 모델(전 섹션 공유):** `BuildingForm`이 단일 `react-hook-form`(기본정보) + 로컬 배열 상태(고객번호·협력업체·시설·보류파일)를 관리. 각 섹션은 제어 컴포넌트로 값·onChange를 props로 받는다. 저장은 `BuildingForm` 한 곳(Task 16).

### Task 11: `BasicInfoSection`

**Files:**
- Create: `app/(staff)/staff/buildings/components/sections/BasicInfoSection.tsx`
- Test: `.../sections/BasicInfoSection.test.tsx`

**Interfaces:**
- Produces: `BasicInfoValue {code,name,address,managerUserId,meterUserId,cleaningUserId}`; `BasicInfoSection` props `{ value, onChange(patch), staffOptions, errors? }`.
- Consumes: `Input`·`Select`.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// app/(staff)/staff/buildings/components/sections/BasicInfoSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BasicInfoSection } from "./BasicInfoSection";

const base = { code: "", name: "", address: "", managerUserId: null, meterUserId: null, cleaningUserId: null };

describe("BasicInfoSection", () => {
  it("건물명 입력 → onChange({name})", () => {
    const onChange = vi.fn();
    render(<BasicInfoSection value={base} onChange={onChange} staffOptions={[{ value: "", label: "미지정" }]} />);
    fireEvent.change(screen.getByLabelText("건물명"), { target: { value: "가나빌" } });
    expect(onChange).toHaveBeenCalledWith({ name: "가나빌" });
  });
  it("관리담당자 선택 → onChange({managerUserId})", () => {
    const onChange = vi.fn();
    render(<BasicInfoSection value={base} onChange={onChange} staffOptions={[{ value: "", label: "미지정" }, { value: "u1", label: "김관리" }]} />);
    fireEvent.change(screen.getByLabelText("관리담당자"), { target: { value: "u1" } });
    expect(onChange).toHaveBeenCalledWith({ managerUserId: "u1" });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/sections/BasicInfoSection.test.tsx"` · Expected: FAIL.

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/buildings/components/sections/BasicInfoSection.tsx
"use client";
import React from "react";
import { Input, Select } from "@/components/common";

export interface BasicInfoValue {
  code: string;
  name: string;
  address: string;
  managerUserId: string | null;
  meterUserId: string | null;
  cleaningUserId: string | null;
}
type Opt = { value: string; label: string };

export function BasicInfoSection({
  value, onChange, staffOptions, errors,
}: {
  value: BasicInfoValue;
  onChange: (patch: Partial<BasicInfoValue>) => void;
  staffOptions: Opt[];
  errors?: Partial<Record<keyof BasicInfoValue, string>>;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">기본 정보</h2>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">건물코드</span>
          <Input aria-label="건물코드" placeholder="미입력 시 자동 생성"
            value={value.code} onChange={(e) => onChange({ code: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">건물명 *</span>
          <Input aria-label="건물명" value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
          {errors?.name && <span className="text-xs text-danger">{errors.name}</span>}
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-sm text-t2">주소 *</span>
          <Input aria-label="주소" value={value.address} onChange={(e) => onChange({ address: e.target.value })} />
          {errors?.address && <span className="text-xs text-danger">{errors.address}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">관리담당자</span>
          <Select aria-label="관리담당자" options={staffOptions} value={value.managerUserId ?? ""}
            onChange={(e) => onChange({ managerUserId: e.target.value || null })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">검침담당자</span>
          <Select aria-label="검침담당자" options={staffOptions} value={value.meterUserId ?? ""}
            onChange={(e) => onChange({ meterUserId: e.target.value || null })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">청소담당자</span>
          <Select aria-label="청소담당자" options={staffOptions} value={value.cleaningUserId ?? ""}
            onChange={(e) => onChange({ cleaningUserId: e.target.value || null })} />
        </label>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/sections/BasicInfoSection.test.tsx"` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/buildings/components/sections/BasicInfoSection.tsx" "app/(staff)/staff/buildings/components/sections/BasicInfoSection.test.tsx"
git commit -m "feat(buildings): 건물 상세 섹션1 기본정보(담당자 계정 드롭다운)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: `FacilitiesSection`

**Files:**
- Create: `app/(staff)/staff/buildings/components/sections/FacilitiesSection.tsx`
- Test: `.../sections/FacilitiesSection.test.tsx`

**Interfaces:**
- Produces: `FACILITY_LABELS` (9키 한글), `FacilitiesSection` props `{ value: FacilitiesMap, onChange(next) }`.
- Consumes: `Checkbox`·`Input`, `FacilitiesMap`·`FACILITY_KEYS` (Task 5).

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// app/(staff)/staff/buildings/components/sections/FacilitiesSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FacilitiesSection } from "./FacilitiesSection";
import { emptyFacilities } from "@/hooks/reactquery/buildings";

describe("FacilitiesSection", () => {
  it("체크 시 on=true로 onChange, 메모 활성", () => {
    const onChange = vi.fn();
    render(<FacilitiesSection value={emptyFacilities()} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("CCTV"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cctv: { on: true, memo: "" } }));
  });
  it("미체크 항목의 메모 입력란은 disabled", () => {
    render(<FacilitiesSection value={emptyFacilities()} onChange={vi.fn()} />);
    expect(screen.getByLabelText("CCTV 메모")).toBeDisabled();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/sections/FacilitiesSection.test.tsx"` · Expected: FAIL.

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/buildings/components/sections/FacilitiesSection.tsx
"use client";
import React from "react";
import { Checkbox, Input } from "@/components/common";
import { FACILITY_KEYS, type FacilitiesMap, type FacilityKey } from "@/hooks/reactquery/buildings";

export const FACILITY_LABELS: Record<FacilityKey, string> = {
  cctv: "CCTV", elevator: "승강기", cleaning: "청소담당", metering: "검침담당", management: "관리담당",
  septic: "정화조", internet: "인터넷", electric_safety: "전기안전관리", fire_safety: "소방안전관리",
};

export function FacilitiesSection({
  value, onChange,
}: {
  value: FacilitiesMap;
  onChange: (next: FacilitiesMap) => void;
}) {
  const set = (k: FacilityKey, patch: Partial<{ on: boolean; memo: string }>) =>
    onChange({ ...value, [k]: { ...value[k], ...patch } });

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">시설 정보</h2>
      <div className="grid grid-cols-1 gap-3">
        {FACILITY_KEYS.map((k) => (
          <div key={k} className="flex items-center gap-4">
            <div className="w-40">
              <Checkbox label={FACILITY_LABELS[k]} checked={value[k].on} onChange={(e) => set(k, { on: e.target.checked })} />
            </div>
            <Input
              aria-label={`${FACILITY_LABELS[k]} 메모`}
              disabled={!value[k].on}
              value={value[k].memo}
              onChange={(e) => set(k, { memo: e.target.value })}
              placeholder="메모(선택)"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/sections/FacilitiesSection.test.tsx"` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/buildings/components/sections/FacilitiesSection.tsx" "app/(staff)/staff/buildings/components/sections/FacilitiesSection.test.tsx"
git commit -m "feat(buildings): 건물 상세 섹션2 시설정보(9종 체크·메모)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: `CustomerNumberSection`

**Files:**
- Create: `app/(staff)/staff/buildings/components/sections/CustomerNumberSection.tsx`
- Test: `.../sections/CustomerNumberSection.test.tsx`

**Interfaces:**
- Produces: `CustomerRow`(폼 로컬 행: `{ _key, id?, kind, customerNo, meterDay, billingBasis, printOnBill, holderName, _deleted? }`), `KIND_LABELS`, `CustomerNumberSection` props `{ rows, onChange(rows) }`.
- Consumes: `Input`·`Select`·`Checkbox`·`Button`.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// app/(staff)/staff/buildings/components/sections/CustomerNumberSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CustomerNumberSection, type CustomerRow } from "./CustomerNumberSection";

describe("CustomerNumberSection", () => {
  it("+ 추가 시 빈 행 append", () => {
    const onChange = vi.fn();
    render(<CustomerNumberSection rows={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /고객번호 추가/ }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0] as CustomerRow[];
    expect(next).toHaveLength(1);
    expect(next[0].kind).toBe("water");
  });
  it("행 삭제 시 신규행 제거·기존행 _deleted", () => {
    const onChange = vi.fn();
    const rows: CustomerRow[] = [
      { _key: "k1", kind: "water", customerNo: "C1", meterDay: null, billingBasis: "current", printOnBill: true, holderName: "" },
      { _key: "k2", id: 9, kind: "gas", customerNo: "C2", meterDay: null, billingBasis: "current", printOnBill: true, holderName: "" },
    ];
    render(<CustomerNumberSection rows={rows} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]);
    const next = onChange.mock.calls[0][0] as CustomerRow[];
    expect(next.find((r) => r._key === "k1")).toBeUndefined(); // 신규행은 완전 제거
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/sections/CustomerNumberSection.test.tsx"` · Expected: FAIL.

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/buildings/components/sections/CustomerNumberSection.tsx
"use client";
import React from "react";
import { Input, Select, Checkbox, Button } from "@/components/common";

export interface CustomerRow {
  _key: string;
  id?: number;
  kind: "water" | "common_elec" | "elec" | "gas";
  customerNo: string;
  meterDay: number | null;
  billingBasis: "prev" | "current";
  printOnBill: boolean;
  holderName: string;
  _deleted?: boolean;
}
export const KIND_LABELS: Record<CustomerRow["kind"], string> = {
  water: "수도", common_elec: "공용전기", elec: "전기", gas: "가스",
};
const KIND_OPTS = (Object.keys(KIND_LABELS) as CustomerRow["kind"][]).map((k) => ({ value: k, label: KIND_LABELS[k] }));
const BASIS_OPTS = [{ value: "prev", label: "전월" }, { value: "current", label: "당월" }];

let seq = 0;
const newKey = () => `cn-new-${seq++}`;

export function CustomerNumberSection({
  rows, onChange,
}: {
  rows: CustomerRow[];
  onChange: (rows: CustomerRow[]) => void;
}) {
  const visible = rows.filter((r) => !r._deleted);
  const patch = (key: string, p: Partial<CustomerRow>) =>
    onChange(rows.map((r) => (r._key === key ? { ...r, ...p } : r)));
  const add = () =>
    onChange([...rows, { _key: newKey(), kind: "water", customerNo: "", meterDay: null, billingBasis: "current", printOnBill: true, holderName: "" }]);
  const remove = (key: string) => {
    const row = rows.find((r) => r._key === key);
    if (row?.id) onChange(rows.map((r) => (r._key === key ? { ...r, _deleted: true } : r)));
    else onChange(rows.filter((r) => r._key !== key));
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-t1">고객번호</h2>
        <Button variant="ghost" onClick={add}>+ 고객번호 추가</Button>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-t4">등록된 고객번호가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((r) => (
            <div key={r._key} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-2"><Select aria-label="유형" options={KIND_OPTS} value={r.kind} onChange={(e) => patch(r._key, { kind: e.target.value as CustomerRow["kind"] })} /></div>
              <div className="col-span-3"><Input aria-label="고객번호" value={r.customerNo} onChange={(e) => patch(r._key, { customerNo: e.target.value })} placeholder="고객번호" /></div>
              <div className="col-span-2"><Input aria-label="검침일" type="number" min={1} max={31} value={r.meterDay ?? ""} onChange={(e) => patch(r._key, { meterDay: e.target.value ? Number(e.target.value) : null })} placeholder="매월 N일" /></div>
              <div className="col-span-2"><Select aria-label="부과기간" options={BASIS_OPTS} value={r.billingBasis} onChange={(e) => patch(r._key, { billingBasis: e.target.value as CustomerRow["billingBasis"] })} /></div>
              <div className="col-span-1"><Checkbox label="출력" checked={r.printOnBill} onChange={(e) => patch(r._key, { printOnBill: e.target.checked })} /></div>
              <div className="col-span-1"><Input aria-label="명의자" value={r.holderName} onChange={(e) => patch(r._key, { holderName: e.target.value })} placeholder="명의자" /></div>
              <div className="col-span-1"><Button variant="danger" onClick={() => remove(r._key)}>삭제</Button></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/sections/CustomerNumberSection.test.tsx"` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/buildings/components/sections/CustomerNumberSection.tsx" "app/(staff)/staff/buildings/components/sections/CustomerNumberSection.test.tsx"
git commit -m "feat(buildings): 건물 상세 섹션3 고객번호(유형별 복수 행 CRUD)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: `VendorSection` (협력업체 + 파일 업로드)

**Files:**
- Create: `app/(staff)/staff/buildings/components/sections/VendorSection.tsx`
- Test: `.../sections/VendorSection.test.tsx`

**Interfaces:**
- Produces: `VendorRow`(폼 로컬 행: `{ _key, id?, vendorType, name, phone, memo, _deleted?, pendingFiles: File[], existing: {id,path,name}[] }`), `VENDOR_TYPE_LABELS`, `VendorSection` props `{ rows, onChange(rows), onDeleteExisting(attId,path) }`.
- Consumes: `Input`·`Select`·`Button`.

> **파일 처리:** 신규 업체(id 없음)는 `pendingFiles`에 File 보관(저장 후 업로드, Task 16). 기존 업체(id 있음)는 `existing`(저장된 attachments)에 표시 + 즉시 삭제 콜백. 이 태스크는 UI + 상태만; 실제 업로드는 Task 16.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// app/(staff)/staff/buildings/components/sections/VendorSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VendorSection, type VendorRow } from "./VendorSection";

describe("VendorSection", () => {
  it("+ 추가 시 빈 업체 행(pendingFiles=[])", () => {
    const onChange = vi.fn();
    render(<VendorSection rows={[]} onChange={onChange} onDeleteExisting={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /협력업체 추가/ }));
    const next = onChange.mock.calls[0][0] as VendorRow[];
    expect(next[0]).toMatchObject({ vendorType: "elevator", name: "", pendingFiles: [] });
  });
  it("업체명 입력 → onChange", () => {
    const onChange = vi.fn();
    const rows: VendorRow[] = [{ _key: "v1", vendorType: "elevator", name: "", phone: "", memo: "", pendingFiles: [], existing: [] }];
    render(<VendorSection rows={rows} onChange={onChange} onDeleteExisting={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("업체명"), { target: { value: "한국승강기" } });
    const next = onChange.mock.calls[0][0] as VendorRow[];
    expect(next[0].name).toBe("한국승강기");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/sections/VendorSection.test.tsx"` · Expected: FAIL.

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/buildings/components/sections/VendorSection.tsx
"use client";
import React from "react";
import { Input, Select, Button } from "@/components/common";

export interface VendorExisting { id: number; path: string; name: string; }
export interface VendorRow {
  _key: string;
  id?: number;
  vendorType: "elevator" | "fire" | "electric" | "septic" | "etc";
  name: string;
  phone: string;
  memo: string;
  _deleted?: boolean;
  pendingFiles: File[];
  existing: VendorExisting[];
}
export const VENDOR_TYPE_LABELS: Record<VendorRow["vendorType"], string> = {
  elevator: "승강기", fire: "소방안전", electric: "전기안전", septic: "정화조", etc: "기타",
};
const TYPE_OPTS = (Object.keys(VENDOR_TYPE_LABELS) as VendorRow["vendorType"][]).map((k) => ({ value: k, label: VENDOR_TYPE_LABELS[k] }));

let seq = 0;
const newKey = () => `vn-new-${seq++}`;

export function VendorSection({
  rows, onChange, onDeleteExisting,
}: {
  rows: VendorRow[];
  onChange: (rows: VendorRow[]) => void;
  onDeleteExisting: (attId: number, path: string) => void;
}) {
  const visible = rows.filter((r) => !r._deleted);
  const patch = (key: string, p: Partial<VendorRow>) => onChange(rows.map((r) => (r._key === key ? { ...r, ...p } : r)));
  const add = () => onChange([...rows, { _key: newKey(), vendorType: "elevator", name: "", phone: "", memo: "", pendingFiles: [], existing: [] }]);
  const remove = (key: string) => {
    const row = rows.find((r) => r._key === key);
    if (row?.id) onChange(rows.map((r) => (r._key === key ? { ...r, _deleted: true } : r)));
    else onChange(rows.filter((r) => r._key !== key));
  };
  const addFiles = (key: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const row = rows.find((r) => r._key === key);
    if (!row) return;
    patch(key, { pendingFiles: [...row.pendingFiles, ...Array.from(files)] });
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-t1">협력업체</h2>
        <Button variant="ghost" onClick={add}>+ 협력업체 추가</Button>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-t4">등록된 협력업체가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((r) => (
            <div key={r._key} className="rounded-xl border border-line p-4">
              <div className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-2"><Select aria-label="유형" options={TYPE_OPTS} value={r.vendorType} onChange={(e) => patch(r._key, { vendorType: e.target.value as VendorRow["vendorType"] })} /></div>
                <div className="col-span-3"><Input aria-label="업체명" value={r.name} onChange={(e) => patch(r._key, { name: e.target.value })} placeholder="업체명" /></div>
                <div className="col-span-3"><Input aria-label="전화" value={r.phone} onChange={(e) => patch(r._key, { phone: e.target.value })} placeholder="전화(선택)" /></div>
                <div className="col-span-3"><Input aria-label="비고" value={r.memo} onChange={(e) => patch(r._key, { memo: e.target.value })} placeholder="비고(선택)" /></div>
                <div className="col-span-1"><Button variant="danger" onClick={() => remove(r._key)}>삭제</Button></div>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <label className="text-sm text-t2">계약서 파일
                  <input aria-label="계약서 파일" type="file" multiple accept="image/*,application/pdf"
                    className="ml-2 text-sm" onChange={(e) => addFiles(r._key, e.target.files)} />
                </label>
                {r.existing.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {r.existing.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 text-sm text-t2">
                        <span>{f.name}</span>
                        <button type="button" className="text-danger" onClick={() => onDeleteExisting(f.id, f.path)}>삭제</button>
                      </li>
                    ))}
                  </ul>
                )}
                {r.pendingFiles.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {r.pendingFiles.map((f, i) => (
                      <li key={i} className="text-sm text-t4">첨부 예정: {f.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/sections/VendorSection.test.tsx"` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/buildings/components/sections/VendorSection.tsx" "app/(staff)/staff/buildings/components/sections/VendorSection.test.tsx"
git commit -m "feat(buildings): 건물 상세 섹션4 협력업체(행 CRUD·계약서 파일 보류/기존)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: `MemoSection`

**Files:**
- Create: `app/(staff)/staff/buildings/components/sections/MemoSection.tsx`
- Test: `.../sections/MemoSection.test.tsx`

**Interfaces:**
- Produces: `MemoSection` props `{ value, onChange(v) }` (1000자 제한·잔여 표시).
- Consumes: (raw textarea — 공용 프리미티브 없음).

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// app/(staff)/staff/buildings/components/sections/MemoSection.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoSection } from "./MemoSection";

describe("MemoSection", () => {
  it("입력 → onChange + 잔여 글자수", () => {
    const onChange = vi.fn();
    render(<MemoSection value="안녕" onChange={onChange} />);
    expect(screen.getByText("2 / 1000")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("참고사항"), { target: { value: "메모" } });
    expect(onChange).toHaveBeenCalledWith("메모");
  });
  it("1000자 초과 입력은 잘림", () => {
    const onChange = vi.fn();
    render(<MemoSection value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("참고사항"), { target: { value: "가".repeat(1005) } });
    expect((onChange.mock.calls[0][0] as string).length).toBe(1000);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/sections/MemoSection.test.tsx"` · Expected: FAIL.

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/buildings/components/sections/MemoSection.tsx
"use client";
import React from "react";

const MAX = 1000;

export function MemoSection({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-t1">참고사항</h2>
        <span className="text-xs text-t4">{value.length} / {MAX}</span>
      </div>
      <textarea
        aria-label="참고사항"
        className="min-h-32 w-full rounded-xl border border-line bg-surface p-4 text-sm text-t1 focus:border-brand focus:outline-none"
        value={value}
        maxLength={MAX}
        onChange={(e) => onChange(e.target.value.slice(0, MAX))}
      />
    </section>
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/sections/MemoSection.test.tsx"` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/buildings/components/sections/MemoSection.tsx" "app/(staff)/staff/buildings/components/sections/MemoSection.test.tsx"
git commit -m "feat(buildings): 건물 상세 섹션5 참고사항(1000자·잔여표시)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: `BuildingForm` (5섹션 조합·통합 저장·파일 후속 업로드·이탈 확인)

**Files:**
- Create: `app/(staff)/staff/buildings/components/BuildingForm.tsx`
- Test: `.../components/BuildingForm.test.tsx`

**Interfaces:**
- Consumes: 5개 섹션(Task 11~15), `useSaveBuilding`·`useStaffOptions`·`useBuildingFull`·`emptyFacilities`·`FacilitiesMap` (Task 5), `uploadAttachment`·`deleteAttachment`·`listAttachmentsByEntities` (Task 4), `useMe`, `buildingBasicSchema`·`customerNumberSchema`·`buildingVendorSchema` (Task 6), `sonner` `toast`, `useRouter`.
- Produces: `BuildingForm` props `{ buildingId?: number }` — 없으면 등록 모드.

> 저장 흐름: (1) 기본정보 zod 검증 → 고객번호·협력업체 각 행 zod 검증(실패 시 토스트·중단). (2) `saveBuilding` RPC. (3) 반환 `vendors[{clientKey,id}]` 매핑으로 신규 업체 `pendingFiles`를 `uploadAttachment`로 업로드(orgId=me.orgId, entityType='building_vendor', kind='contract'). 기존 업체는 이미 id 보유 → 그 id로 업로드. (4) 성공 토스트 → 등록 모드면 `/staff/buildings/{id}`로 replace, 수정 모드면 데이터 재조회.

- [ ] **Step 1: 실패 테스트 작성** (등록 모드 저장 경로)

```tsx
// app/(staff)/staff/buildings/components/BuildingForm.test.tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

const saveMutate = vi.fn();
vi.mock("@/hooks/reactquery/buildings", async () => {
  const actual = await vi.importActual<any>("@/hooks/reactquery/buildings");
  return {
    ...actual,
    useSaveBuilding: () => ({ mutateAsync: saveMutate }),
    useStaffOptions: () => ({ data: [] }),
    useBuildingFull: () => ({ data: undefined, isLoading: false }),
  };
});
vi.mock("@/hooks/reactquery/attachments", () => ({
  uploadAttachment: vi.fn(async () => ({})),
  deleteAttachment: vi.fn(async () => {}),
  listAttachmentsByEntities: vi.fn(async () => []),
}));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: () => ({ data: { orgId: 9, role: "org_owner", permissions: [] } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BuildingForm } from "./BuildingForm";

beforeEach(() => vi.clearAllMocks());

describe("BuildingForm 등록", () => {
  it("필수 미입력 시 저장 안 함(토스트 에러)", async () => {
    render(<BuildingForm />);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveMutate).not.toHaveBeenCalled());
  });

  it("기본정보 입력 후 저장 → saveBuilding 호출 + 상세로 replace", async () => {
    saveMutate.mockResolvedValue({ buildingId: 42, vendors: [] });
    render(<BuildingForm />);
    fireEvent.change(screen.getByLabelText("건물명"), { target: { value: "가나빌" } });
    fireEvent.change(screen.getByLabelText("주소"), { target: { value: "서울" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    const payload = saveMutate.mock.calls[0][0];
    expect(payload).toMatchObject({ name: "가나빌", address: "서울" });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/buildings/42"));
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/BuildingForm.test.tsx"` · Expected: FAIL.

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/buildings/components/BuildingForm.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useSaveBuilding, useStaffOptions, useBuildingFull, emptyFacilities, type FacilitiesMap, type SaveBuildingPayload,
} from "@/hooks/reactquery/buildings";
import { uploadAttachment, deleteAttachment, listAttachmentsByEntities } from "@/hooks/reactquery/attachments";
import { buildingBasicSchema, customerNumberSchema, buildingVendorSchema } from "@/components/forms/schema/building";
import { BasicInfoSection, type BasicInfoValue } from "./sections/BasicInfoSection";
import { FacilitiesSection } from "./sections/FacilitiesSection";
import { CustomerNumberSection, type CustomerRow } from "./sections/CustomerNumberSection";
import { VendorSection, type VendorRow } from "./sections/VendorSection";
import { MemoSection } from "./sections/MemoSection";

let keySeq = 0;
const rowKey = (p: string) => `${p}-${keySeq++}`;

export function BuildingForm({ buildingId }: { buildingId?: number }) {
  const router = useRouter();
  const { data: me } = useMe();
  const save = useSaveBuilding();
  const { data: staff } = useStaffOptions();
  const { data: full } = useBuildingFull(buildingId ?? 0);

  const [basic, setBasic] = useState<BasicInfoValue>({ code: "", name: "", address: "", managerUserId: null, meterUserId: null, cleaningUserId: null });
  const [facilities, setFacilities] = useState<FacilitiesMap>(emptyFacilities());
  const [customerNumbers, setCustomerNumbers] = useState<CustomerRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [memo, setMemo] = useState("");
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof BasicInfoValue, string>>>({});

  const staffOptions = useMemo(
    () => [{ value: "", label: "미지정" }, ...(staff ?? []).map((s) => ({ value: s.userId, label: s.fullName }))],
    [staff],
  );

  // 수정 모드: 로드된 데이터 → 폼 상태
  useEffect(() => {
    if (!full) return;
    setBasic({
      code: full.code, name: full.name, address: full.address ?? "",
      managerUserId: full.managerUserId, meterUserId: full.meterUserId, cleaningUserId: full.cleaningUserId,
    });
    setFacilities(full.facilities);
    setMemo(full.memo ?? "");
    setCustomerNumbers(full.customerNumbers.map((c) => ({
      _key: rowKey("cn"), id: c.id, kind: c.kind, customerNo: c.customerNo, meterDay: c.meterDay,
      billingBasis: c.billingBasis, printOnBill: c.printOnBill, holderName: c.holderName ?? "",
    })));
    const vendorIds = full.vendors.map((v) => v.id);
    (async () => {
      const atts = await listAttachmentsByEntities("building_vendor", vendorIds);
      setVendors(full.vendors.map((v) => ({
        _key: rowKey("vn"), id: v.id, vendorType: v.vendorType, name: v.name,
        phone: v.phone ?? "", memo: v.memo ?? "", pendingFiles: [],
        existing: atts.filter((a) => a.entityId === v.id).map((a) => ({ id: a.id, path: a.fileUrl, name: a.fileName })),
      })));
    })();
    setDirty(false);
  }, [full]);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };
  const patchBasic = (p: Partial<BasicInfoValue>) => { setBasic((b) => ({ ...b, ...p })); setDirty(true); };

  const validate = (): boolean => {
    const b = buildingBasicSchema.safeParse({ ...basic, memo });
    if (!b.success) {
      const fe: Partial<Record<keyof BasicInfoValue, string>> = {};
      for (const issue of b.error.issues) {
        const k = issue.path[0] as keyof BasicInfoValue;
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      toast.error("필수 항목을 확인해 주세요.");
      return false;
    }
    setErrors({});
    for (const c of customerNumbers.filter((r) => !r._deleted)) {
      if (!customerNumberSchema.safeParse({ ...c, meterDay: c.meterDay ?? undefined }).success) {
        toast.error("고객번호 입력을 확인해 주세요."); return false;
      }
    }
    for (const v of vendors.filter((r) => !r._deleted)) {
      if (!buildingVendorSchema.safeParse(v).success) {
        toast.error("협력업체 입력을 확인해 주세요."); return false;
      }
    }
    return true;
  };

  const onSave = async () => {
    if (!me) return;
    if (!validate()) return;
    const payload: SaveBuildingPayload = {
      id: buildingId ?? null,
      code: basic.code || undefined,
      name: basic.name,
      address: basic.address,
      managerUserId: basic.managerUserId,
      meterUserId: basic.meterUserId,
      cleaningUserId: basic.cleaningUserId,
      facilities,
      memo,
      customerNumbers: customerNumbers.map((c, i) => ({
        id: c.id, kind: c.kind, customerNo: c.customerNo, meterDay: c.meterDay,
        billingBasis: c.billingBasis, printOnBill: c.printOnBill, holderName: c.holderName,
        sortOrder: i, _deleted: c._deleted,
      })),
      vendors: vendors.map((v, i) => ({
        id: v.id, clientKey: v.id ? undefined : v._key, vendorType: v.vendorType, name: v.name,
        phone: v.phone, memo: v.memo, sortOrder: i, _deleted: v._deleted,
      })),
    };
    try {
      const res = await save.mutateAsync(payload);
      // 파일 후속 업로드: 신규 업체는 clientKey→id, 기존 업체는 v.id
      const keyToId = new Map(res.vendors.map((x) => [x.clientKey, x.id]));
      for (const v of vendors) {
        if (v._deleted || v.pendingFiles.length === 0) continue;
        const vid = v.id ?? keyToId.get(v._key);
        if (!vid) continue;
        for (const file of v.pendingFiles) {
          await uploadAttachment({ entityType: "building_vendor", entityId: vid, orgId: me.orgId, kind: "contract", file });
        }
      }
      toast.success("저장되었습니다.");
      setDirty(false);
      if (buildingId) router.refresh?.();
      else router.replace(`/staff/buildings/${res.buildingId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  };

  const onDeleteExisting = async (attId: number, path: string) => {
    try {
      await deleteAttachment({ id: attId, path });
      setVendors((rows) => rows.map((r) => ({ ...r, existing: r.existing.filter((f) => f.id !== attId) })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "파일 삭제에 실패했습니다.");
    }
  };

  const onLeave = () => {
    if (dirty && !window.confirm("저장하지 않고 나가시겠습니까?")) return;
    router.push("/staff/buildings");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-t1">
          {buildingId ? `건물 상세 — ${basic.name}` : "건물 등록"}
        </h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onLeave}>목록으로</Button>
          <Button variant="primary" onClick={onSave} disabled={save.isPending}>저장</Button>
        </div>
      </div>
      <BasicInfoSection value={basic} onChange={patchBasic} staffOptions={staffOptions} errors={errors} />
      <FacilitiesSection value={facilities} onChange={mark(setFacilities)} />
      <CustomerNumberSection rows={customerNumbers} onChange={mark(setCustomerNumbers)} />
      <VendorSection rows={vendors} onChange={mark(setVendors)} onDeleteExisting={onDeleteExisting} />
      <MemoSection value={memo} onChange={mark(setMemo)} />
    </div>
  );
}
```

> **구현 확인:** `useMe()` 반환에 `orgId`가 있는지(`get_my_context`/`MyContext`) 실제 타입을 확인하고, 없으면 org 조회 방식을 맞춘다(예: `me.orgId`가 타입에 없으면 `list_accounts` 대신 `current_user_org` 기반 값 사용). `router.refresh`는 Next 버전 API를 `node_modules/next/dist/docs/`에서 확인.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run "app/(staff)/staff/buildings/components/BuildingForm.test.tsx"` · Expected: PASS(2 tests).

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/buildings/components/BuildingForm.tsx" "app/(staff)/staff/buildings/components/BuildingForm.test.tsx"
git commit -m "feat(buildings): 건물 상세 폼(5섹션 통합저장 RPC·파일 후속 업로드·이탈확인)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: `/new` · `/[id]` 페이지 + 구 컴포넌트 정리

**Files:**
- Create: `app/(staff)/staff/buildings/new/page.tsx`
- Create: `app/(staff)/staff/buildings/[id]/page.tsx`
- Delete: `app/(staff)/staff/buildings/components/{BuildingTable,BuildingFormModal,BuildingDetailPanel,UnitList}.tsx` (+ 있으면 각 `.test.tsx`)

**Interfaces:**
- Consumes: `BuildingForm` (Task 16), `useMe`·`hasModule`.
- Produces: 등록·수정 라우트 페이지.

> **Next 확인:** 동적 세그먼트 페이지의 `params` 전달 방식(동기 props vs Promise)을 `node_modules/next/dist/docs/`에서 확인해 시그니처를 맞춘다. 아래는 client 컴포넌트 + `useParams` 사용안(버전 무관 안전).

- [ ] **Step 1: `new/page.tsx`**

```tsx
// app/(staff)/staff/buildings/new/page.tsx
"use client";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { BuildingForm } from "../components/BuildingForm";

export default function BuildingNewPage() {
  const { data: me } = useMe();
  if (me === undefined) return null;
  if (!hasModule(me, "buildings")) {
    return <div className="p-6"><p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (건물 관리 권한 필요)</p></div>;
  }
  return <div className="p-6"><BuildingForm /></div>;
}
```

- [ ] **Step 2: `[id]/page.tsx`**

```tsx
// app/(staff)/staff/buildings/[id]/page.tsx
"use client";
import { useParams } from "next/navigation";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { BuildingForm } from "../components/BuildingForm";

export default function BuildingDetailPage() {
  const { data: me } = useMe();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  if (me === undefined) return null;
  if (!hasModule(me, "buildings")) {
    return <div className="p-6"><p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (건물 관리 권한 필요)</p></div>;
  }
  return <div className="p-6"><BuildingForm buildingId={id} /></div>;
}
```

- [ ] **Step 3: 구 컴포넌트 삭제**

```bash
git rm "app/(staff)/staff/buildings/components/BuildingTable.tsx" "app/(staff)/staff/buildings/components/BuildingFormModal.tsx" "app/(staff)/staff/buildings/components/BuildingDetailPanel.tsx" "app/(staff)/staff/buildings/components/UnitList.tsx"
```
(각 파일에 co-located `.test.tsx`가 있으면 함께 `git rm`. `units`/`occupancies` **훅**은 P3b용으로 남긴다.)

- [ ] **Step 4: 전체 타입·테스트·린트**

Run: `npx tsc --noEmit` · Expected: PASS(구 컴포넌트 참조 제거로 잔여 에러 해소).
Run: `npm test` · Expected: 전체 그린.
Run: `npm run lint` · Expected: 통과.

- [ ] **Step 5: 커밋 + WBS 동기화**

```bash
git add "app/(staff)/staff/buildings/new/page.tsx" "app/(staff)/staff/buildings/[id]/page.tsx"
git commit -m "feat(buildings): 건물 등록/상세 라우트 + P1a 모달·패널 컴포넌트 정리" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
화면 변경 커밋 → `wbs-commit-sync`로 `건물·입주자` dev 트랙 반영(진행중 유지; `완료` 자동변경 금지).

---

## 완료 기준 (Definition of Done)

- `npm test`(vitest) 전체 그린, `npx tsc --noEmit` 무오류, `npm run lint` 통과.
- `supabase/migrations/0004_p3a_buildings.sql` + `supabase/verify/p3a_checks.sql` spec §3~§5와 일치(정적 리뷰).
- 목록: 담당자 3필터·페이지네이션(10/20/50)·엑셀 다운·더블클릭 네비 동작(로직 단위테스트).
- 상세: 5섹션 통합저장(RPC)·파일 후속 업로드·이탈 확인 동작(단위테스트).
- 현장직원 게이트(UI `hasModule` + DB `bld_write` 모듈) 이중 차단.
- **라이브 적용·E2E는 사용자 PC**(마이그레이션 0002→0003→0004 순서).

## Self-Review (작성자 체크 결과)

- **spec 커버리지:** building-list(3.0~3.2)=Task 10; building-detail 5섹션(3.1~3.5)=Task 11~15+16; DB(§3)=Task 1; 통합저장 RPC(§4)=Task 1+5+16; RLS(§5)=Task 1; 데이터층(§6)=Task 2~5; zod(§7)=Task 6; 엑셀(§9)=Task 7~8. → 누락 없음.
- **type 일관성:** `saveBuilding`/`SaveBuildingPayload`(Task 5) ↔ `BuildingForm` payload(Task 16) 필드명 일치; `FacilitiesMap`/`emptyFacilities`(Task 5) ↔ FacilitiesSection·building.ts(Task 6·12); `CustomerRow`·`VendorRow`(Task 13·14) ↔ BuildingForm 매핑(Task 16) 일치; `uploadAttachment` 시그니처(Task 4) ↔ 호출(Task 16) 일치.
- **placeholder 스캔:** 각 코드 스텝에 실제 코드 포함. 런타임 확인이 필요한 3곳(SearchBar props·`me.orgId` 실제 타입·Next `params`/`router.refresh` API)은 "구현 확인" 주석으로 명시(가정 아님, 검증 지시).

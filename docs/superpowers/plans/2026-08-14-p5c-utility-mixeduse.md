# P5c 공과금 혼합건물 대응 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 실행은 사용자 CLAUDE.md 라우팅에 따라 **codex-worker 스킬로 태스크별 위임**(Claude=오케스트레이터/리뷰어). 각 태스크는 독립 테스트 가능한 산출물로 끝나며 체크박스(`- [ ]`)로 추적한다. (superpowers subagent-driven-development는 사용자 라우팅으로 대체.)

**Goal:** 상가+주거 혼합 건물에서 세대 용도(주거/상가)·층 개념을 도입하고, 용도/층별 단가 해석과 상가 고정사용량 부과를 지원한다.

**Architecture:** `units`에 `floor`·`usage_type`, `unit_meters`에 `fixed_usage`를 추가하고 신규 `utility_scoped_prices`(용도/층별 단가)를 둔다. RPC `save_meter_readings`는 단가 해석을 우선순위 체인(세대커스텀 → 용도+층 → 용도기본 → 고객번호)으로 확장하고, `fixed_usage`가 있으면 검침 대신 고정사용량을 쓴다. 기존 고객번호별 단가(`utility_unit_prices`)와 P5b 경로는 불변으로 공존시킨다.

**Tech Stack:** Next.js(프로젝트 버전은 `node_modules/next/dist/docs/` 확인), Supabase Postgres(15+), TypeScript, vitest, React Query 매퍼/훅.

## Global Constraints

- DB 유형값은 **`water`/`elec`/`gas`**(UI는 `electricity`↔`elec`를 `dbUtility()`로 매핑). 신규 코드도 DB층은 `elec`.
- `usage_type` 도메인 = **`residential`|`commercial`** (CHECK 강제, 기본 `residential`).
- 마이그 번호 = **`0016`·`0017`** (origin/master의 `0015_p6_payments`가 0015 선점 → P5c는 0016·0017로 재번호. 0013도 번호중복 존재).
- 기존 P5b 단가 경로(`utility_unit_prices`, 고객번호 fallback) **회귀 금지** — 신규는 공존.
- 라이브 DB 적용은 **사용자 PC에서 수동**(Management API/PAT). 워커는 마이그 파일·검증 스크립트만 작성, `db push`/네트워크 금지.
- 게이트: 각 태스크 종료 시 관련 `vitest` pass · `npx tsc --noEmit` 0 · `npm run lint` 0.
- 커밋 메시지 말미: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- AGENTS.md 안내: 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드 확인.

---

## File Structure

**신규**
- `supabase/migrations/0016_p5c_utility_mixeduse.sql` — 스키마 3변경 + `utility_scoped_prices` + RLS + `save_meter_readings` 재정의 + floor 백필.
- `verify/p5c_checks.sql` — 정적 검증(테이블·컬럼·정책·유니크 존재).
- `app/(staff)/staff/utilities/components/FixedUsageModal.tsx` — 상가 고정사용량 설정 모달(수도할인 모달 패턴).

**수정**
- 단가 데이터층(매퍼/훅): `utility_scoped_prices` upsert·조회 추가. 위치는 기존 `useUtilityPrices`/`saveUtilityUnitPrices` 정의 파일(Task 2에서 grep으로 확정).
- `app/(staff)/staff/utilities/components/UnitPriceModal.tsx` — 용도/층별 단가 섹션 추가.
- `app/(staff)/staff/utilities/components/UtilityTable.tsx` — 고정사용량 뱃지·입력 비활성·모달 연결.
- `/staff/buildings` 세대 편집 폼 + 저장 매퍼/RPC — `floor`·`usage_type` 필드(Task 4에서 파일 확정).

**태스크 의존:** 1 → 2 → 3 순차(단가·검침표는 스키마/RPC 선행 필요). 4는 Task 1 이후 독립.

---

## Task 1: 마이그 0015 — 스키마 3변경 + `save_meter_readings` 확장 + 백필

**Files:**
- Create: `supabase/migrations/0016_p5c_utility_mixeduse.sql`
- Create: `verify/p5c_checks.sql`
- Read first: `supabase/migrations/0014_p5b_utility_pricing.sql`(특히 `utility_unit_prices` RLS 정책과 `save_meter_readings` 본문 ~L255-378), `supabase/migrations/0007_p5a_utilities.sql`, `supabase/migrations/0006_p3b_tenants.sql`.
- Test: 기존 RPC 테스트 파일을 grep으로 찾아 그 하니스를 미러(`rg -l "save_meter_readings|list_utility_rows" --glob '*.test.*'`). 없으면 가장 가까운 RPC 통합테스트 패턴을 따라 신규.

**Interfaces:**
- Produces: `units.floor int`, `units.usage_type text`, `unit_meters.fixed_usage numeric(12,2)`, 테이블 `utility_scoped_prices(id, building_id, utility, usage_type, floor, unit_price, ...)`. RPC `save_meter_readings(p_building_id, p_utility, p_period, p_rows)` 시그니처 **불변**(내부 로직만 확장).

- [ ] **Step 1: 0014 RPC 본문·RLS 정책 확인**
  `0014_p5b_utility_pricing.sql`를 읽어 `save_meter_readings`의 단가 해석 블록(세대 커스텀 → 건물 유일 단가 → null)과 `utility_unit_prices`의 `enable row level security`·`create policy` 문을 파악한다. 신규 정책은 이 패턴을 building_id 직결로 미러한다.

- [ ] **Step 2: 마이그 스키마 부분 작성**
  `0016_p5c_utility_mixeduse.sql`에 스키마 변경을 작성:
  ```sql
  alter table units
    add column if not exists floor int,
    add column if not exists usage_type text not null default 'residential'
      check (usage_type in ('residential','commercial'));

  alter table unit_meters
    add column if not exists fixed_usage numeric(12,2);

  create table if not exists utility_scoped_prices (
    id          bigint primary key generated always as identity,
    building_id bigint not null references buildings(id) on delete cascade,
    utility     text not null check (utility in ('water','elec','gas')),
    usage_type  text not null check (usage_type in ('residential','commercial')),
    floor       int,
    unit_price  numeric(12,2) not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique nulls not distinct (building_id, utility, usage_type, floor)
  );
  ```

- [ ] **Step 3: RLS 정책 작성(0014 미러)**
  `utility_scoped_prices`에 `enable row level security` + `utility_unit_prices`와 동일한 org/staff 스코프 정책을 building_id 기준으로 작성한다(Step 1에서 읽은 정책문을 building_id 직결로 치환). `updated_at` 자동갱신이 0014에 트리거로 있으면 동일 트리거를 이 테이블에도 부착.

- [ ] **Step 4: floor 백필**
  숫자 3~4자리 호실만 자동 추정, 나머지는 null로 남겨 수기 보정:
  ```sql
  update units
  set floor = (unit_no)::int / 100
  where floor is null and unit_no ~ '^[1-9][0-9]{2,3}$';
  ```

- [ ] **Step 5: `save_meter_readings` 재정의**
  0014의 `create or replace function save_meter_readings(...)`를 가져와 두 곳만 확장한다.
  (a) 사용량 결정 — 각 행 처리에서 `unit_meters.fixed_usage`를 조회해 not null이면 `v_usage := fixed_usage`(검침 스킵), null이면 기존 `당월−전월`.
  (b) 단가 해석 블록을 아래 우선순위 체인으로 교체(첫 매칭 채택):
  ```
  -- 세대의 usage_type, floor 조회 (units)
  1) 세대 커스텀: unit_meters.customer_no ↔ 고객번호 단가  (기존 로직 유지)
  2) utility_scoped_prices where building_id, utility, usage_type=세대용도, floor=세대층
  3) utility_scoped_prices where building_id, utility, usage_type=세대용도, floor is null
  4) 고객번호 단가: 건물 고객번호 유일 시 그 단가  (기존 fallback)
  5) else null
  ```
  요금식은 기존 유지: `v_calc := max(0, round_charge(v_usage * v_price, 'round') - v_disc)`. `unit_price`·`calc_charge` 스냅샷 저장도 기존과 동일(고정사용량 세대 포함).

- [ ] **Step 6: 검증 스크립트 작성** `verify/p5c_checks.sql`
  ```sql
  -- 컬럼 존재
  select 'units.floor' where exists (select 1 from information_schema.columns
    where table_name='units' and column_name='floor');
  select 'units.usage_type' where exists (select 1 from information_schema.columns
    where table_name='units' and column_name='usage_type');
  select 'unit_meters.fixed_usage' where exists (select 1 from information_schema.columns
    where table_name='unit_meters' and column_name='fixed_usage');
  -- 테이블·유니크
  select 'utility_scoped_prices' from utility_scoped_prices where false;
  -- RLS on
  select 'rls' where exists (select 1 from pg_tables
    where tablename='utility_scoped_prices' and rowsecurity);
  ```

- [ ] **Step 7: RPC 우선순위 실패 테스트 작성**
  Step 1에서 찾은 RPC 테스트 하니스로 다음 5+1 케이스의 **실패 테스트**를 먼저 작성:
  세대커스텀 우선 / (용도+층) 매칭 / (용도, floor=null) 기본 / 고객번호 fallback / 매칭없음→null / fixed_usage 있으면 usage=fixed(당월-전월 무시).
  각 케이스 기대 `calc_charge`·`unit_price`를 명시적으로 assert.

- [ ] **Step 8: 테스트 실패 확인**
  Run: `npx vitest run <신규 테스트 경로>`
  Expected: FAIL (신규 컬럼/테이블/로직 미적용).
  ※ 하니스가 라이브 DB 의존이라 로컬 미접속이면, 대신 `verify/p5c_checks.sql`을 스펙과 대조 리뷰하고 그 사실을 커밋 메시지에 명기.

- [ ] **Step 9: 마이그 적용 후 테스트 통과 확인**
  라이브 적용은 **사용자에게 요청**(Management API/PAT). 적용 후 Run: `npx vitest run <신규 테스트 경로>` → Expected: PASS. `supabase_migrations.schema_migrations`에 `0015` version/name 기록.

- [ ] **Step 10: 게이트 + 커밋**
  Run: `npx tsc --noEmit` → 0, `npm run lint` → 0.
  ```bash
  git add supabase/migrations/0016_p5c_utility_mixeduse.sql verify/p5c_checks.sql <테스트>
  git commit -m "feat(utilities): P5c 마이그 0015 용도/층 단가·고정사용량 + save_meter_readings 확장"
  ```

---

## Task 2: 단가 데이터층 + `UnitPriceModal` 용도/층 섹션

**Files:**
- Read first: `app/(staff)/staff/utilities/components/UnitPriceModal.tsx`(전체), 기존 `useUtilityPrices`/`saveUtilityUnitPrices` 정의 파일(`rg -l "useUtilityPrices|saveUtilityUnitPrices"`), 그 API route/매퍼.
- Modify: 위 훅/매퍼 파일, `UnitPriceModal.tsx`.
- Test: 기존 단가 훅/매퍼 테스트 파일 미러.

**Interfaces:**
- Consumes: Task 1의 `utility_scoped_prices`.
- Produces: 훅 `useScopedPrices(buildingId, utilityType)` → `{ usage_type, floor|null, unit_price }[]`; 저장 `saveScopedPrices(buildingId, utilityType, rows)`(배열 원자적 upsert, 기존 `saveUtilityUnitPrices` 패턴). 반환/입력 타입은 기존 단가 훅 네이밍 컨벤션을 따른다.

- [ ] **Step 1: 기존 단가 훅/모달 구조 파악**
  `UnitPriceModal.tsx`와 `useUtilityPrices`·`saveUtilityUnitPrices`(+ API route)를 읽어 조회·upsert·낙관적 갱신 패턴을 확인한다.

- [ ] **Step 2: 데이터층 실패 테스트 작성**
  `saveScopedPrices`→`useScopedPrices` 라운드트립 테스트(용도별 기본단가 + (용도,층) 세분 1건 저장 후 조회 일치)를 기존 매퍼 테스트 패턴으로 작성.

- [ ] **Step 3: 실패 확인** Run: `npx vitest run <테스트>` → Expected: FAIL(훅 미정의).

- [ ] **Step 4: 데이터층 구현**
  `useScopedPrices`·`saveScopedPrices`(+ 필요한 API route)를 `utility_unit_prices` 경로와 대칭으로 추가. DB층 유형은 `elec`, upsert는 `unique(building_id,utility,usage_type,floor)` 충돌 시 `unit_price` 갱신.

- [ ] **Step 5: 통과 확인** Run: `npx vitest run <테스트>` → Expected: PASS.

- [ ] **Step 6: 모달 UI 확장**
  `UnitPriceModal.tsx`에 기존 고객번호 섹션 아래 **용도/층별 단가 섹션** 추가: 용도(주거/상가) 그룹 × 행별 `층`(빈값="전체"=floor null)·`단가` 입력, 행 추가/삭제. 저장 시 `saveScopedPrices` 호출. 기존 고객번호 저장과 병렬(둘 다 각자 저장). 스타일·모달 셸은 기존 컴포넌트 재사용.

- [ ] **Step 7: 게이트 + 커밋**
  Run: `npx vitest run` 관련 · `npx tsc --noEmit` 0 · `npm run lint` 0.
  ```bash
  git add <데이터층 파일> app/(staff)/staff/utilities/components/UnitPriceModal.tsx <테스트>
  git commit -m "feat(utilities): P5c 용도/층별 단가 데이터층·단가모달 섹션"
  ```

---

## Task 3: 검침표 고정사용량 UI (`UtilityTable` + `FixedUsageModal`)

**Files:**
- Read first: `app/(staff)/staff/utilities/components/UtilityTable.tsx`, `app/(staff)/staff/utilities/components/WaterDiscountModal.tsx`(패턴 원본), 세대별 저장에 쓰는 기존 훅.
- Create: `app/(staff)/staff/utilities/components/FixedUsageModal.tsx`
- Modify: `UtilityTable.tsx`, 필요 시 부모 `page.tsx` 모달 상태 연결.
- Test: 기존 `WaterDiscountModal`/`UtilityTable` 테스트 패턴 미러.

**Interfaces:**
- Consumes: Task 1의 `unit_meters.fixed_usage`.
- Produces: `FixedUsageModal` props `{ unitId, utility, currentFixedUsage, onSaved }`; set/clear `fixed_usage` 훅(수도할인 set/clear 패턴). `UtilityTable`은 행에 `fixedUsage:number|null`을 받아 렌더.

- [ ] **Step 1: 패턴 파악** `WaterDiscountModal.tsx`(모달·set/clear·뱃지)와 `UtilityTable.tsx` 행 렌더/입력 로직을 읽는다.

- [ ] **Step 2: 실패 테스트 작성**
  (a) `fixedUsage`가 있는 행은 사용량 셀에 `고정` 뱃지·당월지침 입력 `disabled`, `usage`=fixedUsage 표시. (b) `FixedUsageModal` 저장/해제가 훅을 올바른 인자로 호출. 기존 테스트 패턴으로 작성.

- [ ] **Step 3: 실패 확인** Run: `npx vitest run <테스트>` → Expected: FAIL.

- [ ] **Step 4: 구현**
  `FixedUsageModal` 신규(수도할인 모달 셸 복제 후 필드=고정사용량 숫자 1개, 저장/해제). `UtilityTable`에 뱃지·`disabled`·세대별 "고정" 버튼(모달 오픈) 추가. 검침 저장 페이로드는 고정사용량 세대의 당월지침을 보내지 않도록 가드(서버가 fixed_usage 우선이지만 UI도 정합).

- [ ] **Step 5: 통과 확인** Run: `npx vitest run <테스트>` → Expected: PASS.

- [ ] **Step 6: 게이트 + 커밋**
  `npx tsc --noEmit` 0 · `npm run lint` 0.
  ```bash
  git add app/(staff)/staff/utilities/components/FixedUsageModal.tsx app/(staff)/staff/utilities/components/UtilityTable.tsx <page.tsx if touched> <테스트>
  git commit -m "feat(utilities): P5c 검침표 상가 고정사용량 뱃지·설정 모달"
  ```

---

## Task 4: 세대 용도/층 편집 (`/staff/buildings`)  — Task 1 이후 독립

**Files:**
- Read first: `/staff/buildings` 세대 편집 폼 컴포넌트와 세대 저장 매퍼/RPC(`rg -l "unit_no|area_pyeong|room_count" app/(staff)/staff/buildings`로 확정).
- Modify: 세대 편집 폼, 세대 저장 매퍼/타입, (세대 저장 RPC가 컬럼 화이트리스트면) 해당 RPC.
- Test: 기존 세대 편집 저장 테스트 미러.

**Interfaces:**
- Consumes: Task 1의 `units.floor`·`units.usage_type`.
- Produces: 세대 편집 폼이 `floor:number|null`·`usageType:'residential'|'commercial'`를 로드·저장.

- [ ] **Step 1: 세대 편집 저장 경로 파악** 폼·매퍼·저장 RPC에서 `unit_no`/`area_pyeong` 등이 어떻게 왕복되는지 확인.

- [ ] **Step 2: 실패 테스트 작성** 세대 저장 시 `floor`·`usage_type`가 페이로드/DB에 반영되고 재로드 시 일치하는 테스트를 기존 패턴으로 작성.

- [ ] **Step 3: 실패 확인** Run: `npx vitest run <테스트>` → Expected: FAIL.

- [ ] **Step 4: 구현** 폼에 `용도`(주거/상가 셀렉트)·`층`(숫자, 빈값 허용) 필드 추가, 매퍼/타입/저장 RPC 화이트리스트에 두 컬럼 반영.

- [ ] **Step 5: 통과 확인** Run: `npx vitest run <테스트>` → Expected: PASS.

- [ ] **Step 6: 게이트 + 커밋**
  `npx tsc --noEmit` 0 · `npm run lint` 0.
  ```bash
  git add <buildings 폼·매퍼·테스트>
  git commit -m "feat(buildings): P5c 세대 용도(주거/상가)·층 편집"
  ```

---

## Self-Review

**1. Spec coverage** (스펙 §3~§7 대조)
- §3.1 units floor/usage_type → Task1 Step2. §3.2 fixed_usage → Task1 Step2. §3.3 utility_scoped_prices + NULLS NOT DISTINCT + RLS → Task1 Step2·3. floor 백필 → Task1 Step4.
- §4 단가 우선순위 5단계 → Task1 Step5·7. §5 fixed_usage 사용량·요금 → Task1 Step5, Task3.
- §6.1 세대 용도/층 편집 → Task4. §6.2 단가모달 → Task2. §6.3 검침표 고정사용량 → Task3.
- §7 테스트(우선순위 5케이스·고정분기·백필파서·회귀·verify) → Task1 Step6~9, 각 태스크 테스트 스텝.
- 커버리지 갭 없음.

**2. Placeholder scan:** "TBD/TODO/적절히" 등 없음. 파일 경로가 grep 확정인 곳(데이터층 훅·buildings 폼)은 정확 경로 대신 **탐색 명령**을 명시 — 워커가 레포에서 확정(사용자 라우팅상 Codex가 탐색). 지어낸 코드 없음.

**3. Type consistency:** `usage_type`(residential|commercial)·`fixed_usage`(numeric/number|null)·`floor`(int/number|null)·DB유형 `elec` 전 태스크 일관. RPC 시그니처 불변 명시. `useScopedPrices`/`saveScopedPrices` 네이밍 Task2 내 일관.

---

## Notes
- 스펙: `docs/superpowers/specs/2026-08-14-p5c-utility-mixeduse-design.md`.
- 라이브 마이그 적용·`schema_migrations` 기록은 사용자 PC 수동(워커 금지). 관련 [[supabase-connection]].
- 커밋 후 WBS 동기화(`wbs-commit-sync`, 공과금/세대 화면 dev 트랙).

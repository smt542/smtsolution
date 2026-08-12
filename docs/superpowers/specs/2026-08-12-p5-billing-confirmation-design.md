# 관리비서 — P5 부과 확정 슬라이스(`/management-fee` 건물 중심 재구성) 설계 (spec)

- **작성일:** 2026-08-12
- **스택:** Next.js 16(App Router) + Supabase(PostgreSQL·Auth) + React Query + zod + TailwindCSS
- **기준 정본:** `docs/superpowers/specs/2026-08-10-prd-synthesis.md` §E, `docs/prototype/prd/management-fee-setting.md`
- **로드맵:** `docs/superpowers/plans/2026-08-10-roadmap.md` — 로드맵 **P5(검침·부과·고지서)** 3화면 중 `/management-fee`의 **세대별 금액 입력 + 부과 확정** 절반. `/utilities`(검침 자동계산)·`/bill`(고지서·카톡)은 별도 후속.
- **선행:** P0(`audit_log`·`profiles`·헬퍼), P1a(`buildings.type_id`·`units`·`fee_items.carry_over`), P2a(`current_user_org`·`current_user_has_module`·`my_org_ids`), P2b(`room_types`), P3a/P3b(`occupancies` 확장·`list_tenants` 패턴·module RLS).

---

## 0. 배경 & 위치

로드맵 P5의 핵심 업무 플로우는 **지침 입력 → 요금 계산 → 부과 확정 → 고지서 발행**이다. 이 슬라이스는 그중 **부과 확정**(세대별 관리비 항목 금액 입력 → 월 단위 확정 → 이력)만 구현한다. 검침 자동계산(`meter_readings`)·고지서 발행(`/bill`)·문자(P4)는 제외하며, 이번엔 수도·전기·가스 요금도 **일반 부과 항목으로 수동 입력**한다.

현재 `/management-fee`는 **건물유형(building_type) 탭 중심의 부과항목 CRUD**만 구현돼 있다(`fee_items` 관리). PRD 정본(`management-fee-setting.md` §3.0)은 **건물 선택 중심 + 항목관리는 모달 + 세대별 부과 설정 테이블 + 부과 확정 버튼**이다. 이 슬라이스는 PRD 정본대로 화면을 재구성하고, 기존 항목관리 UI(`FeeItemList`·`FeeItemFormModal`)는 모달로 재사용한다.

핵심 모델: **건물 → (유형으로) 적용 부과항목 → 세대(unit)별·항목별·월별 금액(`fee_item_charges`) → 세대·월 확정(`billing_confirmations`) → 확정 원장(`billing_history`)**.

---

## 1. 목표 & 범위

**In scope**
- **`/management-fee` 재구성(건물 중심)**: 상단 액션(건물 선택 · 월 선택기[당월 기본] · [항목관리] 모달 · [저장] · [부과 확정]) + 세대별 부과 설정 테이블 + 6개월 이력 모달 + 세대별 월 메모(부과 참조사항·호실 공지).
- **DB(`0007`)**: `fee_item_charges`(세대×항목×월 금액, 초안)·`billing_confirmations`(세대×월 헤더, 초안/확정 공용)·`billing_history`(append-only 확정 원장). `billing` module RLS. RPC 4종.
- **계산 규칙**: 이월(carry-over) 전월 자동표시, 중간입주 일할계산, 합계 관리비, 공실 제외, 우수리(`fee_items.rounding`).
- **데이터 계층**: `hooks/reactquery/billing/{apis,mutations}.ts` + 순수 계산 `lib/billing/`.
- **페이지·컴포넌트**: `page.tsx` 재작성 + `BillingTable`·`BillingHistoryModal`·`BillingNoteModal` + 기존 `FeeItemList`/`FeeItemFormModal` 모달 재사용. 권한 게이트 `billing`.
- **테스트**: 순수 계산 단위테스트 + 컴포넌트/훅 테스트 + 검증 SQL(`p5_checks.sql`).

**Out of scope (후속)**
- **검침 자동계산·`meter_readings`·할인(`water_discounts`)** → P5 `/utilities` 슬라이스. 이번엔 유틸 요금도 수동 항목 입력.
- **고지서 발행·출력·QR·카톡·팩스(`/bill`)** → P5 `/bill` 슬라이스 + P4(messaging).
- **신규 입주자 당월 부과 팝업(§3.3)** → 다음 슬라이스. (부과확정 상태 + 입주자 등록 교차 트리거 필요)
- **건물별 셋팅 확인 체크박스(§3.4)** → 다음 슬라이스. (P3a 건물 상세에 플래그 추가 수반)
- **연체·수납 연동** → P6.
- **`utilities/apis.ts` 스키마 부정합**(0006에서 제거된 `elec_customer_no` 등 참조) 수리 → 별건 기술부채. 이 슬라이스에서 건드리지 않음(범위 밖).

---

## 2. 확정된 결정

| # | 결정 | 값 | 근거 |
|---|---|---|---|
| 1 | 진행 단위 | **부과 확정 슬라이스만**(검침·고지서 제외) | 사용자 확정 · P4 미구현 · 자체 완결 |
| 2 | 페이지 구조 | **PRD대로 건물 중심 재구성**(항목관리→모달) | 사용자 확정 · PRD 정본 §3.0 |
| 3 | 기간 모델 | **월 선택기**(`period date`=매월 1일, 기본=당월, 과거·당월 편집, 미래 제한) | 사용자 확정 · 이월·6개월·정정 대응 |
| 4 | 확정 정책 | **재확정 허용**(덮어쓰기 + `billing_history` 이력 + audit) | 사용자 확정 · 정정 현실 대응 |
| 5 | 주변 기능 | **신규입주 팝업·건물 체크박스 제외** | 사용자 확정 · 핵심 우선 |
| A | 확정 상태 저장 | **`billing_confirmations`(현재 확정 정본) + `billing_history`(불변 원장) 2테이블** | 재확정·수납연동·감사 안전 · 로드맵 명칭 일치 |
| B | `fee_item_charges` 키 | **세대(unit) 기준** `unique(unit_id, fee_item_id, period)`, `occupancy_id`는 스냅샷 | 세대 이력 연속성(입주자 교체 무관) |
| C | 입력값 vs 일할 | **입력=만월 원액 유지**, 일할은 **확정 스냅샷·합계에만** 반영(테이블엔 미리보기) | 입력 안정성 · 확정본이 회계 정본 |
| D | 확정 범위 | **건물 전체(선택 월) 일괄** | PRD "현재 세대별 금액 설정을 당월 부과로 확정" |
| E | 공실 세대 | 부과 **제외**(입력 비활성·확정 스킵). 공실 판정=최신 occupancy `status='vacant'` 또는 occupancy 없음 | PRD · P3b `list_tenants` 판정과 동일 |
| F | 적용 부과항목 | **건물.type_id의 `fee_items`**(deleted_at null), 항목관리 모달이 이 유형 편집 | 기존 fee_items 유형 스코프 유지 |
| G | RLS 게이트 | 신규 3테이블 SELECT org 개방, 쓰기 **`current_user_has_module('billing')`**. `fee_item_charges`/`billing_confirmations`는 RPC 경유 쓰기, `billing_history`는 RPC 전용 | P3b 패턴 계승 · 현장직원 차단 |
| H | 우수리 | 일할 소수 발생 시 `fee_items.rounding` 적용: `up`→올림 · `round`→반올림 · `down`→버림 · `raw`→반올림(기본) | 정수 원 저장 · raw 정확의미는 §12 |
| I | 확정 후 수정 감지 | `fee_item_charges.updated_at > confirmed_at`이면 "**재확정 필요**" 표시(자동 재확정 아님) | 확정본 stale 방지 · 명시적 재확정 |

---

## 3. DB 스키마 — `supabase/migrations/0007_p5_billing.sql`

> P0(`audit_log`·`profiles`·`set_updated_at`), P1a(`units`·`fee_items`), P2a(헬퍼), P3b(`occupancies`)에 의존. 단일 파일. `fee_items.carry_over`는 이미 존재(0001) → 스키마 변경 없음.

기간은 `period date`(매월 1일)로 통일 → 전월=`(period - interval '1 month')::date`, 6개월=range 계산.

### 3.1 `fee_item_charges` (편집 대상 초안: 세대×항목×월)

```sql
create table fee_item_charges (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  fee_item_id bigint not null references fee_items(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  occupancy_id bigint references occupancies(id) on delete set null,  -- 부과시점 입주 스냅샷
  charged boolean not null default true,     -- 항목별 부과 Y/N
  amount integer not null default 0,         -- 원 단위, 사용자 입력=만월 기준액
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, fee_item_id, period)
);
create index on fee_item_charges (unit_id, period);
create index on fee_item_charges (fee_item_id);
```

### 3.2 `billing_confirmations` (세대×월 헤더: 초안/확정 공용)

```sql
create table billing_confirmations (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  occupancy_id bigint references occupancies(id) on delete set null,
  total_amount integer not null default 0,   -- 일할 반영 최종 합계 스냅샷
  billing_note text,                          -- 부과 참조사항(해당월)
  unit_notice text,                           -- 호실별 공지사항(해당월)
  confirmed_at timestamptz,                    -- null = 초안(미확정)
  confirmed_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, period)
);
create index on billing_confirmations (unit_id, period);
```
- P6 수납이 참조하는 **현재 확정 금액의 정본**. 재확정 시 `total_amount`·`confirmed_at`·`confirmed_by` update, `billing_note`/`unit_notice`는 유지.

### 3.3 `billing_history` (append-only 확정 원장)

```sql
create table billing_history (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  period date not null,
  occupancy_id bigint references occupancies(id) on delete set null,
  tenant_name text,                            -- 확정시점 입주자 스냅샷(표시용)
  total_amount integer not null,
  items jsonb not null,                        -- [{fee_item_id, name, charged, amount}] (amount=일할 반영 최종)
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);
create index on billing_history (unit_id, period, confirmed_at desc);
```
- 확정/재확정마다 1행 → **6개월 이력·전월대비·재확정 감사**의 소스. `items`는 불변 회계 스냅샷.

### 3.4 트리거

```sql
do $$ declare t text; begin
  foreach t in array array['fee_item_charges','billing_confirmations'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;
-- billing_history는 append-only(수정 없음) → updated_at 트리거 없음
```

---

## 4. RPC (SECURITY DEFINER, `billing` 게이팅, anon revoke)

### 4.1 `list_billing(p_building_id, p_period)` — 세대×항목 flat 조회

세대(공실 포함)×적용 항목의 카티션곱에 당월 초안·전월(이월) prefill·확정 상태를 조인해 반환. 클라이언트가 세대별로 pivot.

```sql
create or replace function list_billing(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, room_type_label text,
  occupancy_id bigint, tenant_name text, move_in_date date, is_vacant boolean,
  fee_item_id bigint, fee_item_name text, carry_over boolean, daily_proration boolean,
  rounding text, is_required boolean, sort_order int,
  charged boolean, amount integer,
  confirmed_at timestamptz, confirmed_by_name text, total_amount integer,
  billing_note text, unit_notice text, is_dirty boolean
) language sql stable security definer set search_path = public as $$
  with b as (
    select id, type_id from buildings where id = p_building_id and org_id = current_user_org()
  ),
  fi as (
    select * from fee_items where type_id = (select type_id from b) and deleted_at is null
  ),
  u as (
    select id, unit_no, dong from units where building_id = p_building_id and deleted_at is null
  ),
  occ as (
    select distinct on (o.unit_id)
      o.unit_id, o.id as occupancy_id, o.tenant_name, o.move_in_date, o.status, o.room_type_id
    from occupancies o join u on u.id = o.unit_id
    where o.deleted_at is null
    order by o.unit_id, o.created_at desc
  )
  select
    u.id, u.unit_no, u.dong, rt.label,
    occ.occupancy_id, occ.tenant_name, occ.move_in_date,
    coalesce(occ.status = 'vacant', true) as is_vacant,
    fi.id, fi.name, fi.carry_over, fi.daily_proration, fi.rounding, fi.is_required, fi.sort_order,
    coalesce(fic.charged, true) as charged,
    coalesce(fic.amount, case when fi.carry_over then prev.amount else 0 end, 0) as amount,
    bc.confirmed_at, pr.full_name as confirmed_by_name, bc.total_amount,
    bc.billing_note, bc.unit_notice,
    coalesce(bc.confirmed_at is not null and exists (
      select 1 from fee_item_charges x
      where x.unit_id = u.id and x.period = p_period and x.updated_at > bc.confirmed_at
    ), false) as is_dirty
  from u
  cross join fi
  left join occ on occ.unit_id = u.id
  left join room_types rt on rt.id = occ.room_type_id
  left join fee_item_charges fic on fic.unit_id = u.id and fic.fee_item_id = fi.id and fic.period = p_period
  left join fee_item_charges prev on prev.unit_id = u.id and prev.fee_item_id = fi.id
       and prev.period = (p_period - interval '1 month')::date
  left join billing_confirmations bc on bc.unit_id = u.id and bc.period = p_period
  left join profiles pr on pr.user_id = bc.confirmed_by
  order by u.unit_no, fi.sort_order
$$;
revoke execute on function list_billing(bigint, date) from anon;
```

### 4.2 `save_billing_charges(p_building_id, p_period, p_charges, p_notes)` — 초안 저장(원자적)

`current_user_org()` + `current_user_has_module('billing')` 검증, 건물 org 확인. `p_charges`(`[{unit_id, fee_item_id, charged, amount}]`) upsert by `(unit_id, fee_item_id, period)`. `p_notes`(`[{unit_id, billing_note, unit_notice}]`)로 `billing_confirmations` 헤더 upsert(초안이면 `confirmed_at` null 유지; 이미 확정이면 헤더 노트만 갱신, 확정 메타 불변 → `is_dirty` 트리거). 대상 unit이 해당 건물·org 소속인지 검증. `revoke ... from anon`.

### 4.3 `confirm_billing(p_building_id, p_period)` — 부과 확정(재확정 가능)

```
-- 의사코드
v_org := current_user_org();  assert v_org, assert current_user_has_module('billing'), assert building in org
for each 비공실 unit in building:
  items := []; total := 0
  for each fee_item(type) with fee_item_charges(unit,item,period).charged = true:
    amt := 일할적용(fic.amount, fee_item, occ.move_in_date, p_period)   -- §6.2
    items += {fee_item_id, name, charged:true, amount:amt}; total += amt
  upsert billing_confirmations(unit, period)
    set total_amount=total, occupancy_id=현재입주, confirmed_at=now(), confirmed_by=auth.uid()
  insert billing_history(unit, period, occupancy_id, tenant_name, total_amount=total, items, confirmed_at=now(), confirmed_by=auth.uid())
insert audit_log(v_org, auth.uid(), 'BILLING_CONFIRM', 'billing_confirmations', p_building_id::text,
  jsonb_build_object('period', p_period, 'unit_count', n, 'total', sum))
return {unit_count, total}
```
- 일할계산·우수리는 §6에서 정의. TS 미리보기(`lib/billing`)와 **동일 공식** 유지.

### 4.4 `list_billing_history(p_unit_id, p_period, p_months default 6)` — 6개월 이력·전월대비

`billing_history`에서 세대의 `p_period` 이하 최근 `p_months` 기간을, 기간별 **최신 확정행**(distinct on period order by confirmed_at desc)만 반환: `period, total_amount, items, confirmed_at`. 전월대비 증감은 클라이언트가 인접 기간 차로 계산. `revoke ... from anon`.

---

## 5. RLS — `billing` module (P3b 패턴 계승)

```sql
alter table fee_item_charges       enable row level security;
alter table billing_confirmations  enable row level security;
alter table billing_history        enable row level security;

-- fee_item_charges: unit→building→org SELECT 개방, 쓰기 billing 모듈
create policy fic_select on fee_item_charges for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy fic_write on fee_item_charges for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('billing'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('billing'));

-- billing_confirmations 동일 패턴(bc_select / bc_write)

-- billing_history: SELECT 개방, 직접 쓰기 금지(INSERT는 definer RPC만) → write policy 없음
create policy bh_select on billing_history for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
```
- 세 RPC 모두 definer이나 내부에서 `current_user_has_module('billing')` 명시 검증. `billing_history`는 write policy 부재 → RLS로 직접 INSERT/UPDATE 차단, RPC(definer)만 기록.

---

## 6. 계산 규칙

### 6.1 이월(carry-over)
- 해당 월 `fee_item_charges` 행이 없고 `fee_items.carry_over = true`면 **전월 금액**을 prefill(수정 가능). `list_billing`의 `prev` 조인 + coalesce로 구현.
- `carry_over = false`(예: 수리비)면 0.

### 6.2 일할계산(중간입주 proration)
- 적용 조건: `fee_items.daily_proration = true` **그리고** `occupancy.move_in_date`가 `[period, 월말]` 범위(중간입주).
- `days_in_month = extract(day from (period + interval '1 month - 1 day'))`
- `occupied_days = 월말 - move_in_date + 1` (입주일 **포함**)
- `prorated = 우수리(base_amount * occupied_days / days_in_month, fee_items.rounding)`
- 우수리 매핑: `up`→ceil · `round`→반올림 · `down`→floor · `raw`→반올림(기본, §12 확인).
- 퇴실 일할은 이 슬라이스 범위 밖(P7 이사정산).

### 6.3 합계 관리비
- 세대별 `charged = true` 항목의 (일할 반영) 금액 합. 테이블 **맨 앞 열**에 강조 표시(관리비 문의 응대용).

### 6.4 공실 세대
- 공실(`is_vacant`) 행: 입력 비활성, 합계 제외, `confirm_billing` 스킵.

> `lib/billing/proration.ts`·`lib/billing/carryover.ts`·`lib/billing/total.ts`를 순수 함수로 두고 단위테스트. `confirm_billing`(SQL)과 **공식 일치**를 테스트로 고정.

---

## 7. 데이터 계층 (`hooks/reactquery/billing/`)

- **`apis.ts`**: `listBilling(buildingId, period)`(RPC → flat rows), `listBillingHistory(unitId, period, months)`(RPC). row↔camelCase 매퍼. 세대별 pivot 헬퍼(`pivotBillingRows`)는 `lib/billing/`.
- **`mutations.ts`**: `saveBillingCharges({buildingId, period, charges, notes})`, `confirmBilling({buildingId, period})` — RPC 래퍼(camel→snake), 성공 시 관련 쿼리 무효화.
- **쿼리 키**: `['billing', buildingId, period]`, `['billing-history', unitId, period]`.
- **재사용**: `useMe`(권한), `useBuildings`(건물 Select), `useFeeItems`/`useBuildingTypes` 및 fee item mutations(항목관리 모달), `useBuilding`(선택 건물 type_id).

---

## 8. 페이지 & 컴포넌트 (`/management-fee` 재작성)

- **`page.tsx`**: 권한 게이트 `hasModule(me,'billing')`(없으면 `EmptyState`, utilities 패턴). 상단 = 건물 Select(기본 미선택) · 월 선택기(`<input type=month>`, 기본 당월, 미래 disabled) · [항목관리] · [저장] · [부과 확정]. 상태별 표시(초기/로딩/빈/에러 — management-fee-setting §4). 확정 성공 토스트, 재확정 필요 배지.
- **항목관리 모달**: 기존 `FeeItemList` + `FeeItemFormModal` 재사용. 선택 건물의 `type_id`로 스코프(유형 탭 제거, 유형 라벨 표시). `BuildingTypeTabs`는 이 화면에선 미사용.
- **`components/BillingTable.tsx`**: 고정열(호실/룸타입/입주일/**합계**) + 항목별 가변열([부과 체크박스]+[금액 input]). 이월 prefill 표시, 중간입주 행 강조 + 일할 뱃지, 공실 행 비활성. 행 클릭 → 이력 모달. 행 메모 버튼 → 노트 모달. 로컬 draft 상태(utilities `UtilityTable` drafts 패턴).
- **`components/BillingHistoryModal.tsx`**: `listBillingHistory` → 최근 6개월 총액·항목·전월대비 증감.
- **`components/BillingNoteModal.tsx`**: 세대별 월 메모(부과 참조사항·호실 공지).
- **`components/MonthPicker.tsx`**(또는 공용 input 재사용): YYYY-MM 선택, `period date` 변환.

> **Next 주의(AGENTS.md)**: `page.tsx`는 `"use client"`. `<input type=month>`·모달·react-query 훅 시그니처는 구현 전 `node_modules/next/dist/docs/` 확인. 기존 `management-fee/page.test.tsx`는 건물유형 탭 전제 → **재작성** 필요.

---

## 9. 테스트 전략 (TDD)

- **단위(Vitest)**: `lib/billing/proration`(중간입주·월말·우수리 4종·비적용), `carryover`(전월 prefill·false=0), `total`(charged 필터·일할 반영·공실 제외), `pivotBillingRows`(flat→세대 그리드). `apis`/`mutations` 매퍼(snake↔camel, charges/notes 배열, RPC payload).
- **컴포넌트(RTL)**: `page`(권한 게이트·건물 미선택 안내·월 변경), `BillingTable`(금액 입력·부과 체크·합계 재계산·공실 비활성·이월 표시·중간입주 강조), `BillingHistoryModal`(6개월·전월대비), `BillingNoteModal`(저장), 항목관리 모달 재사용(유형 스코프).
- **RLS·RPC(SQL, `supabase/verify/p5_checks.sql`)**: `billing` 없는 구성원 3테이블 **SELECT 가능·쓰기 거부**; 보유·마스터 쓰기 가능. `billing_history` 직접 INSERT 거부(RPC만). `save_billing_charges` upsert·타 org 거부. `confirm_billing` history 누적·재확정 시 confirmations update + history append·audit 기록. `list_billing` 이월 prefill·공실 판정·is_dirty.
- **정적**: `tsc --noEmit` + `npm run lint`.
- **라이브 미적용**: 원격 미접속 → vitest+tsc+verify SQL 정적. 적용·E2E는 사용자 PC(순서 …0006→0007).

---

## 10. 마이그레이션 / 환경

- `supabase/migrations/0007_p5_billing.sql`(§3·§4·§5) + `supabase/verify/p5_checks.sql`.
- 신규 env 없음. `fee_items.carry_over` 기존 활용(스키마 변경 없음).
- 적용(사용자): `0007` 실행 → `p5_checks.sql`. **DB pending-user**, 순서 …0005→0006→0007.

---

## 11. plan 단계화 (단일 plan, 3그룹)

1. **그룹1 — DB·데이터층**: `0007`(3테이블·RLS·트리거·RPC 4종) + `p5_checks.sql` → `lib/billing/*` 순수 계산 + `hooks/reactquery/billing/{apis,mutations}` + 매퍼/pivot + zod(charges/notes).
2. **그룹2 — 테이블·저장**: `page.tsx` 재구성(상단 액션·상태) + `BillingTable`(입력·합계·이월·일할·공실) + 항목관리 모달 재배선 + `saveBillingCharges` 배선.
3. **그룹3 — 확정·이력·메모**: [부과 확정] 플로우(확인 팝업·`confirmBilling`·배지·재확정) + `BillingHistoryModal` + `BillingNoteModal`.

---

## 12. 열린 항목 / 향후

- **우수리 `raw` 정확 의미** — 현재 반올림 기본. 레거시가 "10원/100원 단위 우수리" 또는 "절사"를 의도했는지 확인 필요(확인 시 §6.2·SQL 동시 수정).
- **`billing_note`/`unit_notice` 편집 UI 위치** — 행 메모 모달로 시작. 인라인 요구 시 후속.
- **검침 요금 자동연동** → P5 `/utilities` 슬라이스(`meter_readings`)에서 `fee_item_charges`의 유틸 항목을 자동 채움.
- **신규입주 당월 부과 팝업·건물 셋팅 체크박스** → 다음 슬라이스.
- **고지서 발행(`/bill`)·카톡(P4)** → 후속. `billing_confirmations`를 부과금액 소스로 참조.
- **연체·수납** → P6가 `billing_confirmations` 참조.

---

## 부록. PRD(`management-fee-setting.md`) → 배치

| PRD | 배치 |
|---|---|
| 3.0 상단 액션(건물·항목관리·부과확정) | `page.tsx` 상단 + 월 선택기 + [저장]/[부과 확정] |
| 3.1 관리비 항목 관리 모달 | `FeeItemList`+`FeeItemFormModal` 재사용(유형 스코프) |
| 3.2 세대별 부과 설정 테이블 | `BillingTable` + `fee_item_charges` + `list_billing`(이월·일할·합계·공실·메모) |
| 3.3 신규 입주자 당월 부과 팝업 | **제외**(다음 슬라이스) |
| 3.4 건물별 셋팅 확인 체크박스 | **제외**(다음 슬라이스) |
| 4. 화면 상태 | `page.tsx` 초기/로딩/입력대기/확정완료/빈/에러 |
| 5. 데이터 & 연동 | `list_billing`·`save_billing_charges`·`confirm_billing` |

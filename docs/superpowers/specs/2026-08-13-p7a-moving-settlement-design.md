# 관리비서 — P7a 이사정산(`/staff/moving-settlement`) 설계 (spec)

- **작성일:** 2026-08-13
- **스택:** Next.js 16(App Router) + Supabase(PostgreSQL·Auth) + React Query + Tailwind v4 + Vitest + sonner
- **기준 정본:** `docs/prototype/prd/moving-settlement.md`, `docs/superpowers/specs/2026-08-10-prd-synthesis.md` §E
- **로드맵:** `docs/superpowers/plans/2026-08-10-roadmap.md` — **P7 이사정산**. 입력 화면 슬라이스(유형별 이사조회·출력 xlsx는 후속).
- **선행:** P1a(`units`), P2a(`current_user_org`·`current_user_has_module`), P2b(`setup_config` settle_*·`settlement_check_items`), P3b(`occupancy_history`·`occupancies` 확장), **P5a(`meter_readings` — 검침 패널)**.
- **구현:** codex 워커 위임(파일·vitest·tsc), Claude 오케스트레이터(리뷰·git·WBS). 참조 패턴: `2026-08-12-p5a-utilities-meter-design.md`, `0006_p3b_tenants.sql`(save_unit_occupancy·RLS), `0007_p5a_utilities.sql`(RPC·RLS).

---

## 0. 배경 & 위치

로드맵 P7. 퇴실 세대 이사정산을 단일 화면에서 작성·계산·저장하고, 중도퇴실/정산완료+공실 상태전환을 수행. 그린필드 라우트(스캐폴딩 없음). P5a `meter_readings`로 검침 패널 의존성이 충족됐고, P3b `occupancy_history`(읽기전용으로만 존재)에 **이 슬라이스가 INSERT를 추가**한다.

---

## 1. 목표 & 범위

**In scope**
- `/staff/moving-settlement` 입력 화면: 건물→호실 Select · **좌측 검침정보 패널**(수도·전기·가스 전월·당월·사용량, `meter_readings` 읽기전용) · 이사정산 입력폼 · 시설점검 체크리스트 · 하단 버튼 4(**정산금 계산 / 계산+저장 / 중도퇴실 / 정산완료+공실**) · **날짜범위 이력 조회**. 상태: 초기/입력대기/계산완료/저장완료/에러.
- **계산(수동 합산)**: 정산금 = 관리비 일할 + 수도·전기·가스 요금 + 수리비(자동 합산). 관리비는 월액 입력 시 퇴실일 기준 일할 자동보조(수정가능).
- **정산완료+공실(실제 처리)**: `occupancies.status='vacant'`+`move_out_date` · `occupancy_history` INSERT · `settlement_note` 리셋 · 수도지침 이월. **미납 수납은 확인 팝업만(stub)**.
- **중도퇴실**: 수납 적요(`billing_note`) "중도퇴실" 기재 · 종이→카톡(`print_enabled=false` 프록시) · 공실처리 없음.
- **DB(`0008`)**: `moving_settlements`·`settlement_checklist_results` + `moving` module RLS + RPC 5.
- reactquery 도메인·zod·컴포넌트·테스트·검증 SQL(`p7a_checks.sql`)·nav `built:true`.

**Out of scope (후속)**
- **유형별/전체 이사조회 리스트 4화면** → 후속(이번은 입력 화면 + 날짜범위 이력만).
- **출력**(이사정산 내역서·빈양식 xlsx) → `출력`·`빈양식` 버튼은 stub(P3a `exceljs` 후속).
- **실제 미납 수납** → `payments`(P6). 정산완료+공실은 확인 팝업만.
- **관리비 일할 base 자동**(월 부과액) → `billing_confirmations`(bullhead 미머지). 지금은 월액 수동 입력.
- **검침 요금 자동(단가)** → utilities와 동일 gap. 검침 요금은 수동 입력.
- **정산내역서·중도퇴실 문자/카톡 실발송** → `messaging`(P4). `print_enabled` 프록시만.

---

## 2. 확정된 결정

| # | 결정 | 값 | 근거 |
|---|---|---|---|
| 1 | 계산 방식 | **수동 입력 합산** — 관리비일할·검침요금·수리비 직접 입력, 정산금 자동 합산 | 사용자 확정 · 단가/billing 미연동 |
| 2 | 정산완료+공실 | **핵심 처리 실제 + 미납 수납 stub**(확인 팝업만) | 사용자 확정 · payments(P6) 미구축 |
| 3 | 조회 범위 | **입력 화면 + 날짜범위 이력**만. 유형별 이사조회 후속 | 사용자 확정 · 입력이 코어 |
| 4 | 출력 | **stub**(후속) | 사용자 확정 · utilities 검침대장 동일 패턴 |
| A | 저장 단위 | `moving_settlements` **이력 테이블(unit당 다건)**, 화면은 최신 편집가능(draft/saved) 로드 | 날짜범위 이력 조회 지원 |
| B | 관리비 일할 | 월액 입력 → 일할 = `round(월액 × 퇴실일의 일(day) / 그 달 총일수)`, 수정가능 | billing 없이 자동보조 · 반올림=round |
| C | 정산금 | `settlement_amount = mgmt_fee_prorated + water_charge + elec_charge + gas_charge + repair_amount`(null→0) | 수동 합산 |
| D | 정산금 계좌 | `setup_config.settle_*` 자동 표시 → 저장 시 `moving_settlements`에 **스냅샷**(수정가능) | PRD 3.2 · 이력 보존 |
| E | 수리비 귀속 | `repair_attribution` enum-유사 text check(`owner`/`manager`/`office`) | PRD 건물주/관리자/관리실 |
| F | 수도지침 이월 | 명시적 write 없음 — `list_utility_rows`가 전월 current를 previous로 계산하므로 **암묵 이월**. 정산완료 시 별도 조치 불요(주석만) | meter_readings 설계상 자동 |
| G | RLS 게이트 | 신규 2테이블 = **`current_user_has_module('moving')`**, SELECT org 개방 | P5a/P3b 패턴 |
| H | 권한 | PC 슬라이스는 `moving` 모듈 게이트만. 현장직원 계산+저장-only는 **모바일 트랙(후속)** | PRD 2 · 모바일 별도 |

---

## 3. DB 스키마 — `supabase/migrations/0008_p7a_moving_settlement.sql`

> permit 워크트리 **다음 순번 0008**. ⚠️ 병렬 브랜치(cuttlefish 0008·bullhead billing) 번호 충돌 가능 → 라이브 적용 시점에 재번호 확인(코드 파일은 0008 유지). P1a·P2a·P2b·P3b·P5a 의존.

### 3.1 `moving_settlements` (이력 테이블)

```sql
create table moving_settlements (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  occupancy_id bigint references occupancies(id) on delete set null,
  move_out_date date,
  mgmt_fee_monthly   integer,   -- 관리비 월액(수동)
  mgmt_fee_prorated  integer,   -- 일할(자동보조·수정가능)
  water_charge integer, elec_charge integer, gas_charge integer,  -- 검침 요금(수동)
  elec_paid_date date, gas_paid_date date,       -- 전기·가스 입금일
  repair_amount integer,
  repair_attribution text check (repair_attribution in ('owner','manager','office')),
  repair_memo text,
  settle_bank text, settle_acct text, settle_holder text,  -- 셋업 스냅샷(수정가능)
  settlement_amount integer,    -- 합산 결과
  note text,                    -- 하단 비고
  settlement_note text,         -- 이사정산 적요(occupancies 연동)
  status text not null default 'draft' check (status in ('draft','saved','mid_moveout','completed')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on moving_settlements (unit_id, created_at desc);
```

### 3.2 `settlement_checklist_results`

```sql
create table settlement_checklist_results (
  id bigint generated always as identity primary key,
  settlement_id bigint not null references moving_settlements(id) on delete cascade,
  check_item_id bigint not null references settlement_check_items(id) on delete cascade,
  checked boolean not null default false,
  unique (settlement_id, check_item_id)
);
create index on settlement_checklist_results (settlement_id);
```

### 3.3 트리거
`set_updated_at()` before update on `moving_settlements`(0001 do-block 패턴).

---

## 4. RPC (security definer, `revoke ... from anon`)

### 4.1 `get_settlement_context(p_unit_id bigint) → jsonb`
`current_user_org()` 범위 확인. 반환 jsonb: `unit`(id·unit_no·dong·building_id), `occupancy`(id·tenant_name·move_in_date·settlement_note·billing_note·status), `latest_settlement`(unit의 최신 draft/saved 행 전체 또는 null), `settle_account`(setup_config.settle_bank/acct/holder), `checklist`([{id,label,checked}] — settlement_check_items LEFT JOIN 최신 settlement의 results), `meter_summary`([{utility, previous_reading, current_reading, usage}] — 각 유형 최신 period). 검침은 `meter_readings` 최신 period + 전월로 usage.

### 4.2 `save_moving_settlement(p_unit_id, p_occupancy_id, p_settlement_id, p_data jsonb, p_checklist jsonb) → jsonb`
`current_user_has_module('moving')` 검증. 호실이 내 org 소속 확인. `p_settlement_id` null=신규 insert(status='saved'), 아니면 update(대상 unit 확인). `settlement_amount` 서버 계산(결정 C). `settle_*` 스냅샷. 체크리스트 `p_checklist`([{check_item_id, checked}])를 upsert(on conflict settlement_id,check_item_id). 반환 `{settlement_id, settlement_amount}`.

### 4.3 `complete_moving_settlement(p_settlement_id bigint) → jsonb`
`moving` 모듈. 트랜잭션: settlement.status='completed'·processed_at=now(); 대상 occupancy `status='vacant'`·`move_out_date=settlement.move_out_date`·`settlement_note=null`(리셋); `occupancy_history` INSERT(unit_id·tenant_name·move_in_date·move_out_date·room_type_label from occupancy+room_types). **미납 수납 stub**(주석). 반환 `{ok:true}`.

### 4.4 `mid_moveout_settlement(p_settlement_id bigint) → jsonb`
`moving` 모듈. settlement.status='mid_moveout'; 대상 occupancy `billing_note` = '중도퇴실'(기존 있으면 덮어쓰기 or append — 덮어쓰기)·`print_enabled=false`(종이→카톡 프록시). 공실처리 없음. 반환 `{ok:true}`.

### 4.5 `list_settlements(p_building_id bigint, p_from date, p_to date) → setof`
`current_user_org()` 범위. move_out_date 범위 내 settlements를 unit_no·tenant_name과 조인 반환(status·settlement_amount·move_out_date·processed_at 포함), unit_no·created_at 정렬.

---

## 5. RLS — `moving` module (P5a/P3b 패턴)

```sql
alter table moving_settlements enable row level security;
alter table settlement_checklist_results enable row level security;

-- moving_settlements: select org 개방 / write moving 모듈 (unit→building→org)
create policy ms_select on moving_settlements for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy ms_write on moving_settlements for all
  using      (unit_id in (...) and current_user_has_module('moving'))
  with check (unit_id in (...) and current_user_has_module('moving'));
-- settlement_checklist_results: settlement→unit→building→org
create policy scr_select on settlement_checklist_results for select
  using (settlement_id in (select s.id from moving_settlements s join units u on u.id=s.unit_id join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy scr_write on settlement_checklist_results for all
  using      (settlement_id in (...) and current_user_has_module('moving'))
  with check (settlement_id in (...) and current_user_has_module('moving'));
```
정산완료의 `occupancies`·`occupancy_history` 쓰기는 definer RPC(`complete_moving_settlement`) 내부에서 `moving` 검증 후 수행(occupancies는 tenants 모듈 RLS이지만 definer라 우회 — RPC 내부 검증으로 안전).

---

## 6. 데이터 계층 — `hooks/reactquery/movingSettlement/`

- `apis.ts`: `getSettlementContext(unitId)`·`saveMovingSettlement(input)`·`completeMovingSettlement(id)`·`midMoveoutSettlement(id)`·`listSettlements(buildingId,from,to)` (RPC 래퍼, snake↔camel). 타입 `SettlementContext`·`MovingSettlement`·`SaveSettlementInput`·`SettlementListRow`·`MeterSummary`·`ChecklistItem`.
- `keys.ts`·`queries.ts`(`useSettlementContext(unitId)`·`useSettlementList(buildingId,from,to)`)·`mutations.ts`(`useSaveSettlement`·`useCompleteSettlement`·`useMidMoveout` — 성공 시 context/list 무효화)·`index.ts`.
- zod `components/forms/schema/movingSettlement.ts`(퇴실일 필수·정수 금액·귀속 enum).
- 재사용: `useBuildings`, `settlementCheckItems`(있으면), `setupConfig`.

---

## 7. 페이지 & 컴포넌트 — `app/(staff)/staff/moving-settlement/`

- `page.tsx`(`"use client"`, 게이트 `hasModule(me,'moving')`): 건물 Select → 호실 Select(선택 건물의 units). 선택 시 `useSettlementContext`. 좌(검침 패널)/우(폼) 2단 레이아웃. 상태 분기(초기/로딩/입력/에러).
- `components/MeterInfoPanel.tsx`: 좌측 고정, `meter_summary` 3유형 전월·당월·사용량 읽기전용.
- `components/SettlementForm.tsx`: 퇴실일(date, 필수)·관리비 월액→일할(자동)·검침요금 3·전기가스 입금일(date)·수리비(금액+귀속 Select+메모)·정산금 계좌(셋업 자동·수정)·비고·이사정산 적요. 정산금(합산) 표시.
- `components/ChecklistSection.tsx`: `checklist` 체크박스 목록.
- `components/SettlementActions.tsx`: 버튼 4(정산금 계산=로컬 합산 미저장 / 계산+저장=`useSaveSettlement` / 중도퇴실=`useMidMoveout`+확인 / 정산완료+공실=`useCompleteSettlement`+**미납 확인 모달**) + 출력·빈양식 stub(비활성 or toast.info).
- `components/SettlementHistory.tsx`: 날짜범위 Select→`useSettlementList` 목록.
- nav: `navItems.ts` 이사정산 `built:false→true`.

> **Next 주의(AGENTS.md)**: `"use client"` 페이지·Select·Modal 시그니처는 기존 패턴(utilities/setup) 재사용. 신규 동적 라우트 없음.

---

## 8. 테스트 전략 (TDD)

- **단위(Vitest)**: apis 매퍼(snake↔camel·jsonb 파싱), `saveMovingSettlement` payload, 정산금 합산·일할(결정 B/C) 순수함수, `listSettlements` 매핑, zod(퇴실일 필수·정수·귀속 enum).
- **컴포넌트(RTL)**: `page`(건물·호실 선택→context 로드·초기안내), `SettlementForm`(일할 자동·정산금 합산·필수검증), `SettlementActions`(계산+저장 payload·정산완료 확인모달·중도퇴실 호출·정산금 계산 로컬), `MeterInfoPanel`(검침 표시), `ChecklistSection`.
- **RLS·RPC(SQL, `supabase/verify/p7a_checks.sql`)**: `moving` 없는 구성원 moving_settlements SELECT 가능·쓰기 거부; 보유·마스터 가능. `save`/`complete`/`mid` RPC 존재·`complete`가 occupancy_history INSERT·occupancy vacant. 타 org 격리.
- **정적**: `npx tsc --noEmit` + `npm run lint`.
- **적용**: DB 라이브 적용은 Claude(오케스트레이터)가 Management API로. codex는 vitest+tsc까지.

---

## 9. 마이그레이션 / 환경

`supabase/migrations/0008_p7a_moving_settlement.sql` + `supabase/verify/p7a_checks.sql`. 신규 env 없음. 적용 순서 …0007→**0008**. 라이브 적용은 오케스트레이터.

---

## 10. plan 단계화 (codex 위임 단위, 3그룹)

1. **그룹1 — DB·데이터층**: `0008`(2테이블·RLS·RPC5)+`p7a_checks.sql` → `movingSettlement` 도메인(apis·keys·queries·mutations·index)+zod+apis 테스트.
2. **그룹2 — 페이지·검침패널·폼·체크리스트**: `page.tsx`+`MeterInfoPanel`+`SettlementForm`+`ChecklistSection`+테스트.
3. **그룹3 — 액션·이력·nav**: `SettlementActions`(4버튼+미납 확인모달)+`SettlementHistory`+nav built:true+테스트.

---

## 11. 열린 항목 / 후속

- 유형별 이사조회 4화면 · 출력 xlsx(내역서·빈양식) · 실제 미납 수납(P6) · 관리비 billing 자동 일할 · 검침 단가 자동 · 정산내역서/중도퇴실 문자(P4) · 현장직원 모바일(계산+저장-only).
- 수도지침 이월은 meter_readings 설계상 암묵(결정 F) — 명시 이월이 필요해지면 후속.

---

## 부록. PRD → P7a 배치

| PRD | 배치 |
|---|---|
| 3.0 세대 선택·날짜조회 | `page` Select 2 + `SettlementHistory` |
| 3.1 검침정보 패널 | `MeterInfoPanel` + `meter_readings`(get_settlement_context) |
| 3.2 이사정산 입력 | `SettlementForm` + `moving_settlements` |
| 3.3 시설점검 체크리스트 | `ChecklistSection` + `settlement_checklist_results` |
| 3.4 버튼(계산/계산+저장/중도퇴실/정산완료공실) | `SettlementActions` + save/complete/mid RPC |
| 3.4 출력·빈양식 | stub(후속) |

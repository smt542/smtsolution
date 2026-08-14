# P6 수납 처리 — Phase D (지로 수납·원장) 설계

| | |
|---|---|
| **화면** | 수납처리·자동이체 · `/staff/payment` (Phase A~C 확장) |
| **모듈/권한** | `payment` |
| **PRD** | `docs/prototype/prd/payment-processing.md` §3.2 (지로 수납 처리 영역) |
| **단계** | P6 결제/수납 — **Phase D** (마지막) |
| **상태/작성자** | `draft` · 2026-08-14 |

---

## 1. 목적 · 범위

지로(giro) 납부 수납을 빠르게 기록하고, 지로 수납 이력을 **원장(ledger)** 으로 조회한다. 지로는 별도 세대 속성이 아니라 **수납방법**이므로, Phase A `payments`(method='giro')를 재사용하고 신규는 **지로 원장 조회 + 지로 수납 빠른입력**뿐이다.

### 이번 범위 (In)
- 신규 RPC `list_giro_payments`(method='giro' 수납 원장)
- 지로 원장 뷰(`GiroLedgerModal`) + 상단 `지로 원장` 버튼
- 지로 수납 빠른입력: 수납표 `지로` 행 액션 → 금액모달 method='giro' 프리셋

### 이번 범위 밖 (Out)
- 지로 세대 플래그·지로번호(신규 데이터모델 없음 — 지로는 수납방법)
- 지로 고지서 발행(bill_issues issue_type='giro'는 P5 고지서 발행 소관)
- 연체료(원금=미납 원금, Phase A 결정 유지)

---

## 2. 확정 결정 (Decisions)

1. **지로 = 수납방법**(`payments.method='giro'`), 세대 속성 아님 — 신규 플래그/번호 없음(YAGNI).
2. **지로 수납 기록 = `record_payment(method='giro', kind='full')`** 재사용. 취소 = `cancel_payment` 재사용.
3. **지로 원장 = 조회 전용** — `method='giro'` 수납(취소 포함) 목록. 원장에서 취소만 가능(active행).
4. **지로 수납 빠른입력 = 수납표 행 액션 `지로`** → `PaymentAmountModal`(kind='full', 금액=미납, method 프리셋 'giro').
5. 마이그레이션 = **`0020`**(0019 다음). 구현 시 재확인.

---

## 3. 데이터 모델 — `0020_p6_giro_ledger.sql`

### 신규 RPC `list_giro_payments(p_building_id bigint, p_period date) returns table(...)`
- 반환: `id bigint, unit_no text, dong text, tenant_name text, amount int, paid_at date, status text, memo text`
- 소스: `payments`(method='giro', period, 건물 소속) → units(호실)·최신 occupancies(입주자) join.
- 필터: 건물 org 소속(`current_user_org()`), `method='giro'`. **취소 포함**(status 노출).
- 정렬: `paid_at desc, id desc`.
- security definer, `set search_path=public`, `revoke from public,anon` + `grant to authenticated`. (list_payment_rows/list_unit_payments 패턴.)

*(record_payment·cancel_payment은 Phase A 그대로 재사용 — 마이그 변경 없음.)*

---

## 4. 훅

`hooks/reactquery/payments`:
- `apis.ts`: `listGiroPayments(buildingId, period): Promise<GiroPayment[]>` + `GiroPayment { id; unitNo; dong; tenantName; amount; paidAt; status; memo }`.
- `queries.ts`: `useGiroPayments(buildingId, period)` — buildingId·period 있을 때 enabled.
- `keys.ts`: `paymentKeys.giro(buildingId, period)`.
- record/cancel: 기존 `useRecordPayment`·`useCancelPayment` 재사용(무효화가 `paymentKeys.all` 대상이라 giro 쿼리도 갱신).

---

## 5. UI

`app/(staff)/staff/payment/`:
- **`PaymentAmountModal.tsx`**: `defaultMethod?: PaymentMethod` prop 추가(기본 'transfer'). 내부 method state 초기값=defaultMethod.
- **`PaymentTable.tsx`**: 행 액션에 **`지로`** 버튼 추가 → `onAction(row, 'giro')`. 액션 타입 `'full'|'principal'|'partial'|'cancel'|'giro'`. 비활성 규칙은 수납/원금과 동일(paid·unbilled 비활성).
- **`components/GiroLedgerModal.tsx`**(신규): props `{ open; buildingId; period; onClose() }`. `useGiroPayments`로 목록(호실·입주자·금액·처리일·상태 뱃지), active행 `취소` 버튼(`useCancelPayment`). 로딩/빈상태.
- **`page.tsx`**:
  - 상단 액션에 **`지로 원장`** 버튼(selectedBuildingId null이면 비활성) → `GiroLedgerModal` 오픈.
  - `onAction(row,'giro')` → `PaymentAmountModal` 오픈(kind='full', defaultAmount=unpaid, defaultMethod='giro'). 제출은 기존 `submitPayment`(kind=amountModal.kind) 경로 재사용 — kind는 'full'(지로 액션은 kind='full'로 매핑).

---

## 6. 화면 상태

| 상태 | 조건 | 동작 |
|---|---|---|
| 지로 수납 | 행 `지로` 클릭 | 금액모달(method=지로 프리셋) → 확정 시 기록·토스트 |
| 지로 원장 | `지로 원장` 클릭 | method='giro' 수납 목록(처리일·상태) |
| 원장 취소 | 원장 active행 취소 | `cancel_payment` → 목록·수납현황 갱신 |
| 빈 원장 | 지로 수납 0건 | "지로 수납 내역이 없습니다" |
| 에러 | 조회/처리 실패 | "오류가 발생했습니다. 다시 시도해 주세요." |

---

## 7. 테스트

- **apis**: `listGiroPayments` RPC 매핑(mock).
- **PaymentAmountModal**: `defaultMethod='giro'` 시 method Select 초기값 검증.
- **PaymentTable**: `지로` 액션 클릭 → `onAction(row,'giro')` 호출·비활성 규칙.
- **GiroLedgerModal**: 목록 렌더·active행 취소 시 `useCancelPayment.mutateAsync` 호출.
- **page**: `지로 원장` 버튼 오픈·`지로` 액션 → 모달 method 프리셋.
- SQL 리뷰, 라이브 수동.

---

## 8. 리스크 · 유의

- **마이그레이션 번호** `0020`(0019 다음) — 병렬 브랜치 충돌 재확인(P5c 선례). 라이브 순서=…→0019→0020.
- **행 액션 5개**(수납/원금/분할/지로/취소): 버튼 밀집 — 레이아웃 확인(줄바꿈 허용). 과밀 시 후속 개선.
- **kind 매핑**: 지로 액션은 kind='full'(방법만 giro). 부분 지로는 분할 액션+method 선택으로 처리(빠른입력은 전액).
- **원장 무효화**: record/cancel의 `paymentKeys.all` 무효화가 giro 쿼리 포함 확인.

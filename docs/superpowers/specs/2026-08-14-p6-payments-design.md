# P6 수납 처리 — Phase A (수납 원장 + 수동 수납) 설계

| | |
|---|---|
| **화면** | 수납처리·자동이체 · `/staff/payment` |
| **모듈/권한** | `payment` (이미 `lib/auth/permissions.ts`에 등록, 라벨 "수납 처리") |
| **PRD** | `docs/prototype/prd/payment-processing.md` (수납처리·자동이체, 기능정의서 F) |
| **단계** | P6 결제/수납 — **Phase A**(기반) |
| **상태/작성자** | `draft` · 2026-08-14 |

---

## 1. 목적 · 범위

관리업체 직원이 세대별 관리비 **부과액 대비 수납을 수동으로 처리**하고 미납 현황을 조회하는 화면의 **데이터 기반과 코어 UI**를 만든다. 수납/원금/취소/분할 처리와 미납 계산, 자동이체 세대 표시까지 포함한다.

수납/영수증 테이블이 전무하므로(마이그레이션에 `payments`/`receipts` 없음) **신규 수납 원장이 모든 후속(은행 엑셀 자동매칭·효성CMS 다운·지로)의 기반**이다. 이번 Phase A는 그 기반 + 수동 처리에 집중한다.

### 이번 범위 (In)
- 신규 `payments` 원장 테이블 + RLS (마이그레이션 `0015_p6_payments.sql`)
- RPC 3종: `record_payment`, `cancel_payment`, `list_payment_rows`
- React Query 훅 `payments/*`
- `/staff/payment` 화면: 건물·기간·세대검색, 수납 처리 테이블, 수납/원금/분할/취소, 자동이체 뱃지, 미납·상태 표시
- `navItems.ts` 수납처리 `built: true`
- vitest 커버리지

### 이번 범위 밖 (Out — 후속 Phase)
- **B. 은행 입금내역 엑셀 자동매칭 수납** (업로드 파서 + 고객번호→이름→금액 매칭)
- **C. 효성CMS 자동이체 세대 다운** (회원번호 오름차순 XLSX)
- **D. 지로 수납 처리 + 지로 원장**
- 영수증·수납 명세서 출력, 고지서 문자 발송 (별도 모듈/`messaging.md`)
- 다월(누적) 연체 집계 — `/staff/overdue` 화면 소관
- 연체료 계산 로직 (아래 결정 1 참조)

---

## 2. 확정 결정 (Decisions)

1. **연체료 없음(Phase A).** billing 도메인(`0012_p5_billing`)에 연체료 모델이 없고 연체료 정책(요율·유예)도 정의된 바 없다. Phase A에서 **원금(principal) = 미납 원금(=확정부과 잔액) 수납**으로 정의한다. `수납(full)`과 `원금(principal)`은 현재 동작이 동일하나, 후속에서 연체료가 도입되면 `full`=원금+연체료, `principal`=원금만으로 분화될 수 있도록 **`kind` 컬럼으로 의도를 기록**해 둔다.
2. **취소 = 소프트 취소.** `status='canceled'` + `canceled_at/by` 감사 컬럼. 하드 삭제하지 않는다(원장 무결성).
3. **미납 = 선택 기간(period, YYYY-MM) 기준.** `미납 = 확정부과(billing_confirmations.total_amount) − 해당 세대·기간 active 수납 합계`. 다월 누적 연체는 overdue 화면 소관.
4. **enum 선반영.** `method`에 `giro`·`auto_debit`, `source`에 `bank_excel`·`cms`를 미리 포함해 후속 B·C·D가 스키마 변경 없이 재사용.
5. **아키텍처 = RPC 미러.** billing의 `save_billing_charges`/`confirm_billing` 패턴을 따라 security-definer RPC로 무결성·미납 계산을 서버측에 둔다(대안: 브라우저 client 직접 CRUD → 무결성 분산으로 기각).
6. **자동이체 세대 판정.** `unit_accounts.cms_member_no`(kind='mgmt') 존재 여부로 판정 — `bill_issues.auto_debit` 산출 로직과 동일 기준.

---

## 3. 데이터 모델 — `0015_p6_payments.sql`

### 3.1 `payments` (수납 원장)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigint identity PK | |
| `org_id` | bigint not null → organizations(id) on delete cascade | 조직 격리 |
| `unit_id` | bigint not null → units(id) | 대상 세대 |
| `period` | text not null | `YYYY-MM` |
| `occupancy_id` | bigint → occupancies(id) | 수납 시점 납부자 |
| `amount` | numeric(12,0) not null check (amount > 0) | 수납 금액 |
| `method` | text not null default 'transfer' check in (`cash`,`transfer`,`auto_debit`,`giro`,`card`,`other`) | |
| `kind` | text not null check in (`full`,`principal`,`partial`) | 수납/원금/분할 |
| `memo` | text | 비고 |
| `paid_at` | date not null default current_date | 수납일 |
| `status` | text not null default 'active' check in (`active`,`canceled`) | |
| `canceled_at` | timestamptz | 취소 시각 |
| `canceled_by` | uuid | 취소자 |
| `source` | text not null default 'manual' check in (`manual`,`bank_excel`,`cms`) | 유입 경로 |
| `created_at` | timestamptz not null default now() | |
| `created_by` | uuid not null default auth.uid() | |

인덱스: `(unit_id, period)`, `(org_id, period)`.

### 3.2 RLS
`fee_item_charges`(0012)와 동일 패턴:
- `enable row level security`
- SELECT/INSERT/UPDATE 정책: 대상 `unit_id`가 `current_user_org()` 소속 건물의 세대이고 `current_user_has_module('payment')` 참일 때 허용. USING + WITH CHECK 양쪽 적용.
- `anon` revoke.

### 3.3 RPC (security definer, `set search_path = public`)
모두 내부에서 조직/모듈/건물소속을 재검증한다(billing RPC와 동일).

**`record_payment(p_unit_id bigint, p_period text, p_amount numeric, p_method text, p_kind text, p_memo text, p_paid_at date)`**
- 검증: 세대가 현재 조직 소속, `payment` 모듈 권한, `p_amount > 0`, enum 유효.
- 현재 납부자(`occupancies` 최신 active)를 `occupancy_id`로 스냅샷.
- `payments` insert(status='active', source='manual').
- 반환: `jsonb { ok, payment_id, charged, paid, unpaid }` (갱신 후 잔액).
- **분할**은 부분 금액으로 이 RPC를 반복 호출하는 것으로 표현(별도 RPC 없음).

**`cancel_payment(p_payment_id bigint)`**
- 검증: 행이 현재 조직, `payment` 권한. 이미 canceled면 no-op/에러.
- `status='canceled', canceled_at=now(), canceled_by=auth.uid()`.
- 반환: `jsonb { ok, unit_id, period, charged, paid, unpaid }`.

**`list_payment_rows(p_building_id bigint, p_period text) returns table(...)`**
- 건물 세대별 1행:
  - `unit_id, unit_no, tenant_name, occupancy_id`
  - `charged`(= `billing_confirmations.total_amount`, 확정 없으면 **null=미확정**)
  - `paid`(= 해당 세대·기간 active 수납 합, 없으면 0)
  - `unpaid`(= charged − paid; charged null이면 null, UI는 '-' 표시)
  - `due_date`(= 최신 `bill_issues.due_date`, 없으면 null)
  - `is_auto_debit`(= `unit_accounts.cms_member_no` kind='mgmt' 존재)
  - `pay_status`(도출: `paid`=0→미납, `0<paid<charged`→부분, `paid>=charged>0`→완납, `charged`없음→대상없음)
- 조인: units ↔ 최신 occupancies(lateral) ↔ billing_confirmations(unit,period) ↔ bill_issues(unit,period 최신) ↔ unit_accounts. `list_tenants`/billing 조회 RPC 구조 참고.
- 조직·권한 검증 후 반환. `revoke from public/anon`, `grant to authenticated`.

---

## 4. 훅 (React Query)

`hooks/reactquery/payments/{apis,queries,mutations,keys,index}.ts` (기존 도메인 폴더 구조 미러):
- `apis.ts`: `listPaymentRows(buildingId, period)`, `recordPayment(input)`, `cancelPayment(paymentId)` — `createClient().rpc(...)`.
- `queries.ts`: `usePaymentRows(buildingId, period)` — buildingId·period 있을 때 enabled.
- `mutations.ts`: `useRecordPayment()`, `useCancelPayment()` — 성공 시 `usePaymentRows` 무효화.
- `keys.ts`: `paymentKeys.rows(buildingId, period)`.
- `index.ts`: barrel export.
- 타입: `PaymentRow`, `RecordPaymentInput`, `PayStatus`, `PaymentMethod`, `PaymentKind`.

미납·상태 도출 순수 로직은 `lib/payments/` 또는 apis 매핑 함수로 분리해 단위 테스트 가능하게 한다.

---

## 5. UI — `app/(staff)/staff/payment/`

`page.tsx` + `components/`:
- **권한 게이트**: `useMe` → `hasModule(me, 'payment')` 아니면 EmptyState.
- **상단 액션**: 건물 Select(`useBuildings`) + 기간 입력(period, 기본 당월 `YYYY-MM`) + 세대 검색(이름·호실 텍스트, 클라이언트 필터).
  - *(엑셀 업로드·자동이체 다운 버튼은 Phase B/C에서 추가 — 이번엔 생략)*
- **수납 처리 테이블**: 컬럼 = 호실 / 입주자 / 부과금액 / 수납금액 / 미납금액 / 납기일 / 비고 / 상태. 자동이체 세대는 뱃지 표시.
- **행 처리 액션** (행 선택 후):
  - `수납`: 미납 전액 수납(`kind='full'`, amount=unpaid).
  - `원금`: 미납 원금 수납(`kind='principal'`, 현재 amount=unpaid와 동일).
  - `분할`: 금액 입력 모달 → 부분 수납(`kind='partial'`).
  - `취소`: 해당 세대 수납 이력에서 선택 취소(`cancel_payment`). *(세대별 수납 이력 미니 목록/모달 제공)*
- 상태·로딩·빈결과·에러·성공 toast는 `receipts`(민원) 페이지 패턴 재사용(`Spinner`/`EmptyState`/`sonner`).

`components/shell/navItems.ts`: 수납처리 항목 `built: false → true`.

---

## 6. 화면 상태

| 상태 | 조건 | 동작 |
|---|---|---|
| 초기 | 건물·기간 선택 | 세대별 수납 현황 표시 |
| 결과 없음 | 조건 무결과 | "조건에 맞는 데이터가 없습니다" |
| 로딩 | 조회 중 | Spinner |
| 수납 완료 | 처리 성공 | "수납 처리되었습니다" toast + 목록 갱신 |
| 취소 완료 | 취소 성공 | "수납을 취소했습니다" toast + 목록 갱신 |
| 에러 | 실패 | "오류가 발생했습니다. 다시 시도해 주세요." |

---

## 7. 테스트

- **vitest**: payments `apis`(RPC 매핑·record·cancel), 미납/상태 도출 순수 로직, `payment/page.test.tsx`(렌더 + 수납/분할/취소 플로우 훅 mock). 기존 `receipts/page.test.tsx`·utilities 테스트 스타일 미러.
- **정적검사**: `npm run lint`, `tsc`(vitest typecheck).
- **SQL**: 자동 테스트 프레임워크 없음 — RLS·RPC 가드가 `0012_p5_billing` 패턴과 일치하는지 리뷰로 검증. 라이브 적용은 사용자 PC에서 수동(마이그레이션 관례).

---

## 8. 리스크 · 유의

- **마이그레이션 번호**: `0013`이 중복 존재(`p5_bill_publish`·`platform_drilldown`). 신규는 `0015_p6_payments.sql`로 안전하게 부여. 라이브 실적용 순서는 사용자 확인 필요.
- **미납 정의의 다월 확장**: Phase A는 단월. 후속 overdue 연동 시 정의 재검토.
- **자동이체 판정 일원화**: `bill_issues.auto_debit` 산출과 동일 기준 유지(불일치 방지).
- **분할 과다 수납 방지**: `record_payment`에서 `paid > charged` 허용/차단 정책 결정 필요 — 기본은 **경고 없이 허용(over)**하되 상태 `over` 노출(환불/오납 케이스 대비). 구현 시 확정.

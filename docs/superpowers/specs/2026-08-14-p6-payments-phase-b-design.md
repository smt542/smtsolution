# P6 수납 처리 — Phase B (은행 입금엑셀 자동매칭) 설계

| | |
|---|---|
| **화면** | 수납처리·자동이체 · `/staff/payment` (Phase A 확장) |
| **모듈/권한** | `payment` |
| **PRD** | `docs/prototype/prd/payment-processing.md` §3.3 (은행 입금내역 엑셀 자동 매칭) |
| **단계** | P6 결제/수납 — **Phase B** (Phase A `payments` 원장 위에) |
| **상태/작성자** | `draft` · 2026-08-14 |

---

## 1. 목적 · 범위

은행 입금내역 엑셀을 업로드해 세대별 수납을 **반자동으로 일괄 처리**한다. 고객번호로 세대를 식별하고, 입금액을 `payments` 원장(Phase A)에 기록한다. 자동 즉시기록이 아니라 **업로드 → 컬럼 매핑 → 미리보기 → 사용자 일괄 확정**의 안전한 흐름을 따른다.

### 이번 범위 (In)
- `unit_accounts`(kind='mgmt')에 **수납 고객번호(`payer_no`)** 컬럼 추가 + 입주자 상세 입력 연동
- 은행 엑셀 **업로드·컬럼 매핑 UI**
- **매칭 순수 로직**(고객번호 → 이름 → 입금액 기록, 미납대비 차액)
- **일괄 적용 RPC** + 재업로드 중복 감지
- 미매칭 건 수동 지정(Phase A 수동수납 재사용)

### 이번 범위 밖 (Out)
- **C** 효성CMS 자동이체 세대 다운(회원번호 XLSX) · **D** 지로 수납·원장
- 효성CMS **수납결과 파일** 역업로드(자동이체 성공/실패 반영) — 별도
- 영수증·명세서 출력 · 다월 연체
- 연체료(원금=미납 원금, Phase A 결정 유지)

---

## 2. 확정 결정 (Decisions)

1. **고객번호 저장 = `unit_accounts`(kind='mgmt').`payer_no`** (세대=수용가 단위, 안정적). 입주자 상세 계좌 입력에서 함께 입력(`save_unit_occupancy` 재사용).
2. **컬럼 매핑 UI** — 업로드 후 각 열(고객번호/입금자명/금액/입금일)을 사용자가 지정(첫 열 자동추측). 은행·양식 변동에 견고.
3. **입금액 그대로 기록 + 차액 표시** — 고객번호(+이름)로 세대 식별, 입금액을 수납으로 기록(부분납 허용). 미리보기에 미납대비 차액(부분/초과) 표시.
4. **안전 흐름** — 자동 즉시기록이 아니라 미리보기에서 사용자가 확정. 매칭·중복 판정 후 일괄 적용.
5. **파싱은 클라이언트** ExcelJS `wb.xlsx.load`(신규 read 패턴). 적용은 배치 RPC.
6. 기간=화면 선택 부과월 · 수납 method=`transfer` · source=`bank_excel`.

---

## 3. 데이터 모델 — `0018_p6_payments_bank_match.sql`

### 3.1 `unit_accounts` 확장
- `alter table unit_accounts add column payer_no text;` (kind='mgmt' 행에서만 의미; 은행 매칭 고객번호)
- `save_unit_occupancy` RPC의 unit_accounts upsert에 `payer_no` 반영(기존 bank/account/holder/cms_member_no 옆에 추가). 입주자 상세 계좌 입력 폼에 필드 1개.

### 3.2 `list_payment_rows` 확장 (create or replace)
- 반환에 `payer_no`(unit_accounts mgmt), `payer_name`(occupancies) 추가 → 클라이언트 매칭 lookup.
- Phase A `PaymentRow` 타입 · apis 매핑에 필드 additive 추가(`payerNo`, `payerName`).

### 3.3 신규 RPC `record_bank_payments(p_building_id bigint, p_period date, p_entries jsonb) returns jsonb`
- `p_entries = [{ unit_id, amount, paid_at, memo }]`.
- 가드: `current_user_org()`·`current_user_has_module('payment')`·건물 org 소속·period 월초. 각 entry: unit이 건물 소속·amount>0.
- 각 entry를 `payments`에 insert(`method='transfer'`, `kind='full'`, `source='bank_excel'`, occupancy=최신). `record_payment`와 동일 규칙.
- 반환 `jsonb { recorded, skipped, errors[] }`.
- `revoke ... from public,anon; grant ... to authenticated`.

### 3.4 신규 RPC `list_bank_payments(p_building_id bigint, p_period date) returns table(unit_id bigint, amount int, paid_at date)`
- 기존 `source='bank_excel'` active 수납 반환 → 재업로드 중복 감지용. org 검증, security definer.

---

## 4. 업로드·파싱 (클라이언트)

`lib/payments/bankParse.ts`:
- `parseBankWorkbook(buffer): { headers: string[]; rows: string[][] }` — ExcelJS `Workbook().xlsx.load(buffer)`, 첫 시트, 1행=헤더, 이후 데이터.
- `guessColumns(headers): { customerNo?, name?, amount?, paidAt? }` — 헤더명 동의어(고객번호/입금자/금액/입금일 등)로 초기 추측.
- `toDeposits(rows, mapping): Deposit[]` — `Deposit = { customerNo: string; name: string; amount: number; paidAt: string|null; rowIndex: number }`. 금액 문자열(콤마·원) 정규화, 빈행 skip.

## 5. 매칭 (순수 함수)

`lib/payments/match.ts`:
- `matchDeposits(deposits: Deposit[], units: MatchUnit[]): MatchResult`
  - `MatchUnit = { unitId; unitNo; payerNo|null; payerName|null; tenantName|null; unpaid: number|null }`
  - 규칙(세대 식별): ① `payer_no` 정확일치 → ② 미스 시 입금자명 정규화 일치(payer_name/tenant_name; 복수 후보면 미매칭) → 실패 시 unmatched.
  - `matched[] = { deposit, unitId, delta: amount-unpaid (unpaid null이면 null) }`, `unmatched[] = deposit[]`.
  - 정규화: 공백·괄호 제거, `toLocaleLowerCase('ko-KR')`.
- 중복 표시: 클라이언트가 `list_bank_payments` 결과와 대조해 matched 항목에 `isDuplicate` 부여(같은 unit·amount·paid_at 존재 시).

## 6. UI

`app/(staff)/staff/payment/`:
- 상단에 **`엑셀 업로드`** 버튼 → `components/BankImportModal.tsx`.
- 모달 단계: (1) 파일 선택 → (2) 컬럼 매핑(드롭다운, 자동추측 프리필) → (3) 미리보기:
  - **매칭됨** 표: 호실·입주자·입금자명·입금액·미납·차액(부분/초과 뱃지)·중복플래그, 행 체크 토글(중복은 기본 해제).
  - **미매칭** 표: 입금자명·금액·입금일 + 세대 수동 지정(Select) → 지정 시 매칭됨으로 이동.
  - **일괄 확정** 버튼 → `record_bank_payments(building, period, 체크된 entries)`.
- 성공 토스트 + `usePaymentRows` 무효화. 화면의 건물·부과월 컨텍스트 사용.

훅: `hooks/reactquery/payments`에 `useRecordBankPayments()`(mutation), `useBankPayments(buildingId, period)`(중복감지), apis 추가. `list_payment_rows` 매핑에 payerNo/payerName.

## 7. 화면 상태

| 상태 | 조건 | 동작 |
|---|---|---|
| 업로드 전 | 모달 오픈 | 파일 선택 안내 |
| 매핑 | 파일 파싱 후 | 헤더 드롭다운(자동추측), 미리보기 갱신 |
| 미리보기 | 매핑 확정 | 매칭/미매칭/중복 분류 표시 |
| 파싱 오류 | 비엑셀·빈 시트 | "엑셀을 읽지 못했습니다" |
| 적용 완료 | 확정 성공 | "N건 수납 처리(중복 M건 제외)" 토스트 + 목록 갱신 |
| 에러 | 적용 실패 | "오류가 발생했습니다. 다시 시도해 주세요." |

## 8. 테스트

- **순수**: `bankParse`(헤더추측·금액정규화·빈행), `match`(고객번호일치·이름fallback·복수후보 미매칭·차액·중복) 단위테스트.
- **apis**: `recordBankPayments`·`listBankPayments`·`listPaymentRows`(payerNo/payerName 매핑) mock.
- **통합**: `BankImportModal`/페이지 — 업로드 mock→매핑→미리보기→확정 시 `useRecordBankPayments.mutateAsync`가 체크된 entries로 호출.
- lint·tsc. SQL은 리뷰 검증, 라이브 적용 수동.

## 9. 리스크 · 유의

- **마이그레이션 번호** = `0018`(0015 payments·P5c 0016/0017 다음 — ⚠️0016/0017은 P5c 공과금 혼합건물이 라이브 선점, 브랜치 PracLee/cachalot). 라이브 적용 수동·순서 준수.
- **입주자 상세 회귀**: `save_unit_occupancy`·계좌 폼 변경이 P3b 입주자 저장에 영향 없도록 additive만. 회귀 테스트 확인.
- **이름 매칭 오탐**: 동명이인·복수후보는 미매칭 처리(자동 오기록 방지). 고객번호가 1차, 이름은 폴백.
- **중복 방지는 소프트**(미리보기 감지·기본 해제) — 하드 unique 제약 없음(동일 금액·동일일 정상 복수입금 오차단 방지). 사용자 override 가능.
- **금액 파싱**: 콤마·통화기호·괄호(음수) 방어. 파싱 실패 행은 미매칭·경고.

# 연체료(단계별 차등·월분별 누적) 설계

- 작성일: 2026-08-18
- 대상 화면: `/staff/overdue` (미납 관리)
- 브랜치: `feat/overdue-late-fee`
- 상태: 설계 확정(구현 대기)

## 1. 목적

미납 세대의 **연체료(연체이자)** 를 산정·표시한다. 현재 미납 관리 화면은 미납액·연체개월수·최근납부일까지 집계(H3, PR #31)되어 있으나 연체료 계산은 없다. 이 슬라이스는 연체료 계산 로직·요율표 설정·표시를 추가한다.

## 2. 배경 및 제약

### 2.1 명세 공백 → 정책을 직접 확정
연체료 산정 규칙이 PRD(`overdue-management.md`, `bill-publish.md`, `payment-processing.md`)에 없다. `payment-processing.md`의 "원금만 수납(연체료 제외)" 옵션과 `gap-analysis.md`의 "연체 요율표" 언급만 존재. 따라서 아래 정책은 이 문서에서 확정한 값이다.

### 2.2 겹침 회피 (병렬 워크트리)
동시 진행 워크트리와 파일 충돌을 피한다.
- `long-term-repair`(0025, master 머지됨)가 `setup/page.tsx`·`setup/components/*`·`components/forms/schema/setup.ts`를 변경했다.
- `messaging-alimtalk-templates`(soldierfish)는 `/staff/messaging` 및 발송 배선을 다룬다.

→ **요율표를 `setup_config`(setup 탭)에 넣지 않는다.** 요율표 설정 UI는 `/staff/overdue` 화면 내부에 두고, 저장은 신규 테이블에 한다. `bill/·payment/·messaging/·management-fee/·setup/`은 건드리지 않는다.

### 2.3 재활용 가능한 기존 자산
- `list_overdue_aggregates` RPC(0022): 세대별 미납액·연체개월수·최근납부일.
- `billing_period_settings`(0024): `due_date`(납기일, nullable), `period`(월분 첫날), building 단위.
- `billing_confirmations`(확정 부과) − `payments`(수납) = 미납. period 단위 집계 로직이 0022에 이미 존재.

## 3. 확정 정책

| 항목 | 결정 |
|------|------|
| 산정 방식 | 단계별 차등 요율 (연체개월 구간별 월요율) |
| 계산 정밀도 | 정확 — 미납 **월분(period)별 누적** |
| 요율 단위 | **월요율(%)**, 연체 개월차마다 해당 구간 요율 적용 |
| 요율표 범위 | **org(사무소) 단위** (building별은 후속 확장) |
| 요율표 설정 UI | `/staff/overdue` 화면 내 모달 |
| 기준일(연체 종료) | **조회 기준월의 말일** |
| 납기일 fallback | `due_date` 없으면 **해당 월분(period)의 말일** |
| 요율표 기본 seed | `0~1개월 1.0%` / `1~3개월 1.2%` / `3개월~ 1.5%` |
| 계산 시점 | 실시간 계산(캐시 없음) — 수납으로 미납액이 변동하므로 |
| v1 제외(YAGNI) | 소액 면제·상한·복리, 고지서 연체료 라인, 수납 시 연체료 처리 |

## 4. 데이터 모델

### 4.1 신규 테이블 `late_fee_rate_tiers`
org 단위 연체료 요율표. 구간을 행으로 표현한다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | |
| `org_id` | uuid FK | 사무소 |
| `tier_order` | int | 표시·정렬 순서 |
| `from_month` | int | 구간 시작(연체 개월차, **exclusive**) |
| `to_month` | int null | 구간 끝(연체 개월차, **inclusive**). null = 무한대 |
| `monthly_rate` | numeric(6,4) | 월요율(%) 예: 1.2000 |
| `created_at` / `updated_at` | timestamptz | |

- **구간 규칙:** 연체 개월차 `k`에 적용할 요율 = `from_month < k <= to_month`(또는 `to_month IS NULL`)인 tier의 `monthly_rate`.
- **RLS:** org 격리 — 읽기는 같은 org, 쓰기는 billing 권한 보유자(앱 레벨 게이트 + RLS org 일치).
- **seed:** 마이그에서 기존 각 org에 기본 3구간 insert. `(1, 0, 1, 1.0)`, `(2, 1, 3, 1.2)`, `(3, 3, null, 1.5)`.
- **빈 요율표 처리:** tier가 하나도 없으면 연체료 = 0(계산이 안전하게 0을 반환).

### 4.2 신규 RPC `list_overdue_periods`
세대×월분별 미납원금과 납기일을 반환한다. 계산에 필요한 원자료만 제공하고, 연체료 산정은 클라이언트가 한다.

- 시그니처: `list_overdue_periods(p_building_id uuid, p_target_year int, p_target_month int, p_scope text)`
- 반환 행: `occupancy_id uuid`, `unit_id uuid`, `period date`, `unpaid_principal bigint`, `due_date date`
- 로직:
  - `list_overdue_aggregates`(0022)와 동일한 확정부과 − 수납 집계를 **period 단위로 분해**하여 `unpaid_principal > 0`인 (occupancy, period)만 반환.
  - `due_date` = `billing_period_settings.due_date`(building+period 매칭). 없으면 **period 월의 말일**.
  - `p_scope`: `all`(조회월 이하 전체 누적) / `current`(조회월만) — 기존 화면 필터와 동일.
- `SECURITY DEFINER` + org/building RLS 일치 확인은 기존 0022 패턴을 따른다.

## 5. 계산 로직 (`lib/billing/lateFee.ts`)

순수 함수. DB·React 의존 없음 → 단위테스트 용이.

```
type Tier = { fromMonth: number; toMonth: number | null; monthlyRate: number } // rate: percent
type OverduePeriod = { period: string; unpaidPrincipal: number; dueDate: string }

rateForMonth(tiers, k): number
  // from < k <= to (or to null) 인 tier의 monthlyRate, 없으면 0
cumulativeRate(tiers, n): number
  // Σ_{k=1..n} rateForMonth(tiers, k)  (n<=0 → 0)
monthsOverdue(dueDate, asOf): number
  // (asOf.year - due.year)*12 + (asOf.month - due.month), 음수 → 0. (월 단위, 일자 무시)
computeLateFeeForPeriod(period, tiers, asOf): { months, appliedRatePct, lateFee }
  // n = monthsOverdue; lateFee = round(unpaidPrincipal * cumulativeRate(tiers, n) / 100)
computeLateFee(periods[], tiers, asOf): { totalLateFee, byPeriod[] }
  // 세대 합산 + 월분별 내역
```

- `asOf` = 조회 기준월의 말일.
- 반올림: 원 단위(`Math.round`). 기존 계산 정합(H2 반올림)과 충돌하지 않도록 연체료는 **원 단위 반올림**으로 통일하고, 필요 시 10원 단위는 후속 논의.
- 예시: period `2026-03`, 미납원금 100,000, 납기 `2026-03-31`(또는 fallback 월말), 조회월 `2026-06` → `asOf=2026-06-30`, n=3 → `cumulativeRate = 1.0+1.2+1.2 = 3.4%` → `lateFee = round(100000 * 0.034) = 3,400원`.

## 6. UI (`/staff/overdue`)

### 6.1 미납표 (`OverdueTable.tsx`)
- 기존 컬럼(호실·입주자·연락처·연체개월·미납금액·최근납부일) 뒤에 **`연체료`** 컬럼(우정렬) 추가.
- **합계행** 추가: 세대수, 미납금액 합계, 연체료 합계. (기존에 합계행 없음 → 신설)

### 6.2 상세 모달 (`OverdueDetailModal.tsx`)
- 세대 연체료 요약 + **월분별 내역 테이블**: period / 미납원금 / 연체개월 / 적용 누적요율(%) / 연체료.

### 6.3 요율표 설정 모달 (`LateFeeRateModal.tsx`, 신규)
- 툴바에 "연체료 요율 설정" 버튼(billing 권한자만 노출).
- 구간 목록 표시·추가·수정·삭제·순서. 저장 시 `late_fee_rate_tiers` upsert.
- 유효성: 구간 경계 오름차순, 요율 0 이상, 마지막 구간 `to_month` 비움(무한대) 허용.

### 6.4 미납대장 CSV (`utils.ts`)
- `downloadOverdueLedger`에 `연체료` 컬럼 추가.

### 6.5 권한
- 조회: 기존 overdue 접근 권한 유지.
- 요율 편집: `hasModule(me, "billing")`.

## 7. Hooks

- 신규 `hooks/reactquery/lateFeeTiers/`: `apis.ts`(select/upsert/delete) · `queries.ts` · `mutations.ts` · `keys.ts`. org 요율표 CRUD.
- 기존 `hooks/reactquery/overdue/`: `apis.ts`에 `list_overdue_periods` 호출 추가. 세대 목록에 연체료 필드를 병합(요율표 + periods → `computeLateFee`). `keys.ts`·`queries.ts` 확장.

## 8. 마이그레이션

- 파일: `supabase/migrations/0026_overdue_late_fees.sql` (**커밋 직전 `origin/master` 최대 번호 재확인** — 현재 0025까지 존재).
- 내용: `late_fee_rate_tiers` 테이블 + RLS 정책 + 기존 org seed insert, `list_overdue_periods` 함수 + grant.
- 검증 스크립트: `supabase/tests/` 또는 별도 `*_checks.sql`로 테이블·RPC·RLS 확인.
- 라이브 적용은 사용자 PC에서(Claude는 파일만 작성).

## 9. 테스트 전략

- `lib/billing/lateFee.test.ts` (핵심): `rateForMonth` 경계(from exclusive·to inclusive·null), `cumulativeRate`, `monthsOverdue`(음수·동월·fallback), `computeLateFee`(0개월·1개월·구간 경계 넘김·빈 요율표·다중 period 합산).
- `app/(staff)/staff/overdue/utils.test.ts`: CSV에 연체료 컬럼.
- 컴포넌트 렌더 테스트: 표 연체료·합계행, 상세모달 월분 내역, 요율 모달 CRUD·권한 게이트.
- `supabase/tests/*.integration.test.ts`: `list_overdue_periods` 옵트인 통합.
- 전건: `tsc` 0, `lint` 0, `vitest` green.

## 10. 파일 변경 목록 (겹침 검증)

**신규**
- `supabase/migrations/0026_overdue_late_fees.sql`
- `lib/billing/lateFee.ts` (+ `lateFee.test.ts`)
- `hooks/reactquery/lateFeeTiers/{apis,queries,mutations,keys}.ts`
- `app/(staff)/staff/overdue/components/LateFeeRateModal.tsx` (+ test)

**수정 (모두 overdue 도메인 내부)**
- `app/(staff)/staff/overdue/page.tsx`
- `app/(staff)/staff/overdue/components/OverdueTable.tsx`
- `app/(staff)/staff/overdue/components/OverdueDetailModal.tsx`
- `app/(staff)/staff/overdue/utils.ts` (+ test)
- `hooks/reactquery/overdue/{apis,queries,keys}.ts`

**건드리지 않음 (겹침 0):** `setup/*`, `components/forms/schema/setup.ts`, `bill/*`, `payment/*`, `messaging/*`, `management-fee/*`.

## 11. 후속(범위 밖)

- 고지서(`/staff/bill`)에 연체료 라인 출력.
- 수납(`/staff/payment`) 시 연체료 충당·"원금만 수납" 옵션 연동.
- building별 요율표, 소액 면제·상한·복리, 일할 계산 옵션.

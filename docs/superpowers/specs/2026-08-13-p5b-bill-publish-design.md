# 관리비서 — P5b 고지서 발행·출력 슬라이스(`/bill` 지로·A4 출력 코어) 설계 (spec)

- **작성일:** 2026-08-13
- **스택:** Next.js 16(App Router) + Supabase(PostgreSQL·Auth) + React Query + zod + TailwindCSS
- **기준 정본:** `docs/prototype/prd/bill-publish.md`, `docs/superpowers/specs/2026-08-10-prd-synthesis.md` §D(고지서 발행·출력)
- **로드맵:** `docs/superpowers/plans/2026-08-10-roadmap.md` — 로드맵 **P5(검침·부과·고지서)** 3화면 중 `/bill`의 **지로·A4 출력 코어**. 카톡(messaging 연동)·팩스·조정명세서·자동이체 세대 출력은 별도 후속.
- **선행:** P5 부과확정(`billing_confirmations`·`list_billing` RPC·`hooks/reactquery/billing`), P2a(`current_user_has_module`), P2b(`setup_config`), P3a/P3b(`units`·`occupancies`·`list_tenants`), 셸/네비(`components/shell/navItems.ts`·`Sidebar.tsx`).

---

## 0. 배경 & 위치

월 과금 플로우 **지침 입력 → 요금 계산 → 부과 확정 → 고지서 발행**의 마지막 단계다. 부과 확정(`/management-fee` → `billing_confirmations`)까지는 구현·머지됐고, **부과와 수납 사이의 유일한 결손이 고지서 발행**이다. 이 슬라이스는 그중 **지로·A4 출력 코어**만 구현한다: 건물·월 선택 → 부과확정된 세대 목록 → 세대별 지로/A4 고지서를 **브라우저 print로 인쇄**. 카톡 발송(공용 `messaging` 모듈 연동)·팩스·조정명세서·자동이체 세대 목록 출력은 제외한다.

**읽기 전용 슬라이스**다. 새 테이블·RPC·마이그레이션이 없다. 기존 `list_billing`(부과확정 데이터)·`setup_config`(입금계좌·출력옵션)·`occupancies`(세대 정보)를 재사용해 화면에서 렌더·인쇄만 한다.

핵심 흐름: **건물 선택 → `useBilling(buildingId, period)` → `pivotBillingRows()` 세대별 pivot → 확정분(`confirmedAt != null`) 필터 → 발행 대상 선택 → 지로/A4 고지서 렌더 → `window.print()`**.

---

## 1. 목표 & 범위

**In scope**
- **신규 라우트 `/staff/bill`**(`app/(staff)/staff/bill/`): `page.tsx`(`"use client"`) + `BillTargetTable` + `BillPreview` + `@media print` CSS.
- **상단 액션**: 건물 Select · 부과월(`<input type=month>`, 기본 당월) · 발행유형(지로/A4 토글) · **코드/이름 출력** 토글 · [미리보기] · [인쇄].
- **발행 대상**: 부과확정분(`confirmedAt != null`) 세대만 목록 표시, 전체/개별 선택.
- **지로/A4 고지서 렌더**: 헤더(회사명·건물·호실·입주자[코드/이름]·부과월·납기일) + 항목별 부과내역표 + 합계 + 입금계좌 + QR(클라 생성) + 하단 회사명. `window.print()` + `@media print`(액션·네비 숨김, 세대별 page-break).
- **출력 옵션(transient)**: 세대별 단수 표기 on/off, 발행건 납기일 변경, 코드/이름 표기.
- **권한**: `bill_publish` 모듈 게이트(신규 ModuleKey), `navItems` 기존 stub `built:true`.
- **테스트**: `page`·`BillPreview` 컴포넌트 테스트 + print/포맷 순수 유틸.

**Out of scope (후속)**
- **카톡 고지서 발송**(공용 `messaging.md` 모듈 연동·즉시/예약·발송상태) → 발송 슬라이스(P5b-2).
- **팩스 발송** → 후속(외부 팩스 연동 서비스 미정).
- **조정명세서 출력·자동이체 세대 목록 출력**(그룹별 분리) → 후속.
- **지로용지 정밀 좌표 정합** → MVP는 A4 완성 + 지로 레이아웃 골격. 실제 지로용지 좌표 스펙 확보 후 미세조정.
- **단수/납기일 조정의 DB 영속화** → 출력 시점 transient만(감사·이력 필요 시 후속 컬럼).
- **자동이체·팩스번호 표시** → 자동이체 세대 데이터는 수납·자동이체(기능정의서 F) 슬라이스 의존. 데이터 준비 시 표시.
- **발송상태 저장/이력** → 발송 슬라이스와 함께(이번엔 출력=print만, 상태 저장 없음).
- **부과 3탭(공과금/관리비/고지서) 재구성** → `management-fee`·`utilities`까지 건드리는 큰 변경이라 제외. `/staff/bill` 단독 라우트.

---

## 2. 확정된 결정

| # | 결정 | 값 | 근거 |
|---|---|---|---|
| 1 | 진행 단위 | **지로/A4 출력 코어만**(카톡·팩스·조정명세서 제외) | 사용자 확정 · 외부의존 없이 자체 완결 · 부과→수납 결손 해소 |
| 2 | 라우트 | **`/staff/bill` 단독**(부과 3탭 재구성 안 함) | 사용자 확정 · 컨벤션(`/staff/*`) · 슬라이스 최소화 |
| 3 | 출력 방식 | **브라우저 print(HTML + `@media print`)**, QR 클라이언트 생성 | 사용자 확정 · 서버·PDF 라이브러리 불필요 · MVP 최단 |
| 4 | DB | **신규 없음**(읽기 전용, `list_billing`·`setup_config` 재사용) | 렌더·인쇄 전용 · 마이그레이션 리스크 0 |
| 5 | 발행 대상 | **부과확정분(`confirmedAt != null`)만** | 미확정분 발행 방지 · `billing_confirmations` 정본 |
| 6 | 회사명 | **organization 이름 MVP**(전용 '고지서 회사명' 필드는 후속) | `setup_config`에 회사명 필드 없음 · 마이그 회피 |
| 7 | 지로 | **레이아웃 골격만, A4 우선**(정밀 좌표 후속) | 실제 지로용지 좌표 스펙 미확보 |
| 8 | 출력 옵션 | **코드/이름·단수·납기일 = transient(비영속)** | 회차 한정 조정 · DB 영속화 불필요(MVP) |

---

## 3. 데이터 소스 (기존 재사용 · 신규 없음)

| 데이터 | 출처(경로) | 시그니처 / 필드 | 용도 |
|---|---|---|---|
| 건물 목록 | `hooks/reactquery/buildings` | `useBuildings()` | 건물 Select |
| 부과확정 데이터 | `hooks/reactquery/billing/{queries,apis}.ts` | `useBilling(buildingId, period)` → `BillingFlatRow[]` | 세대×항목 flat. `confirmedAt`·`totalAmount`·`amount`·`feeItemName`·`unitNo`·`tenantName`·`moveInDate`·`isVacant` |
| 세대 pivot·합계 | `lib/billing/{pivot,total}.ts` | `pivotBillingRows(rows)`, `unitTotal(lines, moveInDate, period)` | 세대별 그리드 + 합계(일할 반영). 확정분은 `totalAmount` 스냅샷 우선 |
| 기간 유틸 | `lib/billing/period.ts` | `currentPeriod()`, `toMonthInput()`, `fromMonthInput()` | 월 선택기 ↔ `period date` |
| 입금계좌·출력옵션 | `lib/setupConfig/apis.ts` | `getSetupConfig(orgId)` → `mgmtBank1/Acct1/Holder1/mgmtPrint1`(+2차), `printBillingPeriod`·`printDelta` | 고지서 하단 입금 안내·출력 옵션 |
| 회사명 | organization | org 이름 | 고지서 하단 회사명(MVP) |
| (후속) 자동이체·팩스 | `hooks/reactquery/occupancies/apis.ts` | `listTenants(buildingId)` / `Occupancy` | 자동이체 표시·팩스번호(F 데이터 준비 시) |

---

## 4. 라우트 · 권한

- **라우트**: `app/(staff)/staff/bill/page.tsx`(`"use client"`, `management-fee`/`utilities` 패턴 답습).
- **모듈 키**: `lib/auth/permissions.ts`의 `ModuleKey`에 `'bill_publish'` 추가.
- **네비**: `components/shell/navItems.ts`에 **이미 stub 존재**(`{ label:"고지서 발행", href:"/staff/bill", module:"bill_publish", built:false }`) → `built:true`로 전환. `Sidebar.tsx`는 `hasModule(me, item.module)` 게이트 적용(현장직원 차단).
- **권한(PRD §2)**: 관리자·직원 O / 현장직원 X. `page.tsx`에서 `hasModule(me,'bill_publish')` 없으면 `EmptyState`(utilities 패턴).

---

## 5. 페이지 & 컴포넌트 (`app/(staff)/staff/bill/`)

- **`page.tsx`**: 권한 게이트 + 상단 액션(건물 Select[기본 미선택] · 월 선택기[`<input type=month>`, 기본 당월] · 발행유형[지로/A4] · 코드/이름 토글 · [미리보기]/[인쇄]). 출력 옵션·선택 세대·미리보기 대상은 로컬 `useState`. 상태별 표시(§7).
- **`components/BillTargetTable.tsx`**: 부과확정분 세대 목록(호실 · 입주자명 · 합계 · [발송상태=후속] · 선택 체크박스). 전체 선택 + 개별 선택. `pivotBillingRows` 결과에서 `confirmedAt != null`만.
- **`components/BillPreview.tsx`**: 선택 세대들의 고지서 렌더(§6). 세대 1건=1페이지(`page-break-after`). 지로/A4 레이아웃 분기.
- **print CSS**: `app/globals.css`에 `@media print { ... }` 추가 — 네비/상단 액션/테이블 숨김, `.bill-print` 영역만 인쇄, A4 페이지·세대별 개행. 인쇄 트리거는 `window.print()`.

> **Next 주의(AGENTS.md)**: 새 `page.tsx`는 `"use client"`. `<input type=month>`·react-query 훅 시그니처·`@media print` 레이아웃은 구현 전 `node_modules/next/dist/docs/` 확인.

---

## 6. 고지서 렌더 규칙 (`BillPreview`)

- **헤더**: 회사명(org) · 건물명 · 호실(코드/이름 토글: `unitNo` 또는 `tenantName`) · 부과월 · **납기일**(출력 옵션 입력값; 향후 `setup_config` 기본 납기일 필드 추가 시 prefill).
- **본문**: 항목별 부과내역표(`charged=true`인 `feeItemName` · `amount`), **합계**(확정 스냅샷 `totalAmount` 우선, 없으면 `unitTotal`). 공실(`isVacant`) 세대는 발행 대상에서 제외.
- **하단**: 입금계좌(`setup_config`의 `mgmtPrint*=true`인 1·2차 계좌) · 회사명(작게) · **QR코드**(클라이언트 생성, 카카오 고지서 신청용 payload — 정확 규격은 §11).
- **출력 옵션**: 세대별 **단수 표기** on/off(해당 회차 한정) · **납기일** 발행건 단위 변경 · **코드/이름** 표기 전환.
- **지로 vs A4**: A4=전체 레이아웃(일반 프린터). 지로=레이아웃 골격(실제 지로용지 좌표 정합은 후속).

---

## 7. 화면 상태 (PRD §4)

| 상태 | 조건 | 표시 |
|---|---|---|
| 초기 | 건물 미선택 | "건물을 선택해 주세요", 테이블 비표시 |
| 로딩 | 세대·부과 조회 중 | Spinner |
| 미확정 | 선택 월에 부과확정 세대 없음 | "부과 확정된 세대가 없습니다" + `/management-fee`(부과 확정) 유도 |
| 빈 세대 | 건물에 세대 없음 | "등록된 세대가 없습니다" |
| 에러 | 조회 실패 | "불러오지 못했습니다. 다시 시도해 주세요." + 재시도 |

---

## 8. 테스트 전략 (TDD, Vitest + RTL)

- **`page.test.tsx`**: 훅 mock(`useBuildings`·`useBilling`·`getSetupConfig`). 건물 선택 → 확정분 테이블 렌더, 미확정 → 빈 상태, 코드/이름 토글 반영, [인쇄] → `window.print` 호출(mock), 권한 게이트(현장직원 차단). management-fee `page.test.tsx` mock 패턴 답습.
- **`BillPreview.test.tsx`**: 항목별 부과내역·합계(스냅샷 우선)·입금계좌·회사명·납기일·QR 렌더. 단수 표기 on/off, 코드/이름 전환.
- **순수 유틸**: 고지서 표시용 포맷(금액·기간·계좌 문자열) 헬퍼가 생기면 단위테스트.
- **정적**: `tsc --noEmit` + `npm run lint`.

---

## 9. 의존성

- **QR 생성**: 클라이언트 QR 라이브러리(`qrcode` 또는 유사) 1개 추가 — **Claude가 `npm install`**(codex 샌드박스 불가). 번들·타입 확인.
- 그 외 신규 런타임/DB/env 없음.

---

## 10. plan 단계화 (단일 plan, 2그룹)

1. **그룹1 — 골격·데이터·목록**: 라우트 `/staff/bill` + 권한(`bill_publish` ModuleKey · `navItems` built:true · Sidebar 게이트) + `page.tsx` 상단 액션 + `useBilling` 배선 + `BillTargetTable`(확정분 필터·전체/개별 선택) + 상태 처리(§7). 테스트: page 게이트·선택·빈상태.
2. **그룹2 — 렌더·인쇄**: `BillPreview`(지로/A4 레이아웃·항목·합계·입금계좌·회사명·QR) + `@media print` CSS + `window.print()` + 출력 옵션(코드/이름·단수·납기일) + QR 의존성. 테스트: BillPreview 렌더·인쇄 트리거.

---

## 11. 열린 항목 / 향후

- **회사명 전용 필드**: `setup_config`(또는 organizations)에 '고지서 회사명/워터마크' 필드 추가 → 후속(소소한 마이그 또는 설정 탭 확장). MVP는 org 이름.
- **지로용지 좌표 스펙**: 실제 지로 양식 좌표 확보 후 지로 정밀 정합.
- **QR payload 규격**: 카카오 고지서 신청 연동 실제 payload(링크·식별자) 확정.
- **자동이체·팩스번호 표시**: 수납·자동이체(기능정의서 F) 데이터 준비 시 고지서에 반영.
- **카톡 발송·예약·발송상태**: 공용 `messaging` 모듈(고지서 프리셋·NCP 알림톡) 연동 슬라이스.
- **조정명세서·자동이체 세대 목록 출력**(그룹별 분리) → 후속.

---

## 부록. PRD(`bill-publish.md`) → 배치

| PRD | 이 슬라이스 배치 |
|---|---|
| 3.0 상단 액션(건물·발행유형·그룹·코드/이름·조정명세서·자동이체출력) | `page.tsx`(건물·발행유형·코드/이름). **그룹 선택·조정명세서·자동이체 출력=후속** |
| 3.1 세대 목록 테이블(선택·발송상태) | `BillTargetTable`(확정분·전체/개별 선택). **발송상태 컬럼=후속** |
| 3.2 지로·A4 출력(QR·회사명·자동이체 표시) | `BillPreview` + `@media print`. **자동이체 표시=후속(데이터 의존)** |
| 3.3 카톡 고지서 발송 | **후속**(messaging 연동) |
| 3.4 팩스 고지서 발송 | **후속** |
| 3.5 출력 옵션(단수·납기일 자유 변경) | 출력 옵션 state(transient) |
| 4. 화면 상태 | `page.tsx` 초기/로딩/미확정/빈/에러 |
| 5. 데이터 & 연동 | `useBilling`(부과확정 참조)·`getSetupConfig`(계좌·옵션). **카톡·팩스·서버생성 출력=후속** |

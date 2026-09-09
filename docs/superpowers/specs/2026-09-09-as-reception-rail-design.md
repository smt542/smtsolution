# A/S 접수·퇴실 신청 현황 공통 우측 패널 — 설계 (Design Spec)

- **작성일**: 2026-09-09
- **브랜치**: `feat/as-status-rail` (base: `feat/prototype-pixel-alignment`)
- **관련 트랙**: prototype 픽셀 정합 (`project-prototype-pixel-alignment`) 에서 분리된 독립 기능
- **참조**: `docs/superpowers/specs/2026-09-09-prototype-pixel-alignment-design.md`, `docs/audit/prototype-pixel-map-2026-09-09.md`

---

## 1. 목표

원본 프로토타입의 우측 슬라이드 패널(`.rnb`, 핸들 `title="A/S 접수 현황"`)을 **실제 데이터로 구현**하고, **공통 컴포넌트**로 스태프 전역에 통합한다. 표현은 원본과 **픽셀 퍼펙트**로 정합한다.

원본 실제 헤더는 **"A/S 접수·퇴실 신청 현황"** 이며, 탭이 **2개**다: `A/S 접수`(민원/complaints) + `퇴실 신청`(move-out). (태스크 최초 서술은 단일 "A/S 접수 현황"이었으나, 조사로 2탭 구조 확인.)

## 2. 확정된 결정 (사용자 승인)

| # | 결정 | 값 |
|---|------|-----|
| D1 | 데이터 소스 | **실데이터** (더미 아님) |
| D2 | 탭 범위 | **두 탭 모두 실배선** (A/S + 퇴실) |
| D3 | 노출 범위 | **스태프 전역** (`AppShell` 마운트) |
| D4 | 기본 펼침 상태 | **접힘** (핸들만 노출; 토글 시 열림) |
| D5 | 퇴실 탭 데이터 접근 | **마이그 없이 direct select** (`move_out_requests` 스태프 RLS 정책 기존 보유) |
| D6 | 청록 FAB (메신저 발송기) | **이 태스크 완전 제외** — 별도 워크트리/세션이 실기능(.fmp) 구현·전역 마운트. 이 태스크는 FAB 미렌더. |

### 확정된 세부 결정 (2026-09-09 승인)
- **A1 — 퇴실 "처리 완료" 버튼 = 기능화 확정**: 원본 퇴실 카드의 `처리 완료`(mv-done) → 확인 다이얼로그(정산 경고 문구) → `move_out_requests` 상태 전이(§5.2). 패널의 **유일한 쓰기 동작**. 스태프 UPDATE RLS 기존 보유 → 마이그 불필요.
- **A2 — FAB = 이 태스크에서 제외 확정**: 청록 메신저 FAB의 실기능(빠른발송 `.fmp`)은 **별도 워크트리/세션**에서 진행(핸드오프 프롬프트 별도 전달). 이 태스크는 `QuickAccessRail` 제거로 FAB가 사라지며, **새 FAB를 렌더하지 않는다**. 실기능 FAB는 별도 세션이 `AppShell`에 독립 마운트.

## 3. 정본(Canonical) 원본

- **파일**: `docs/prototype/staff/fee-item/fee-item.dc.html` (동일 `.rnb`를 receipt-management 등 ~대부분 스태프 화면이 공유)
- **staging 렌더**: https://staging.d2h12382xiksft.amplifyapp.com/staff/fee-item/fee-item.dc.html
- **CSS 정의**: 원본 `<style>` 블록 (약 `.rnb-cb`~`.asf-dd` 규칙: 파일 **167–306행** 구간). 대상 클래스: `.rnb`, `.rnb-off`, `.rnb-handle`, `.rnb-h`, `.rnb-tabs`, `.rnb-tn`, `.rnb-body`, `.rnb-card`, `.rnb-kv`, `.rnb-refresh`, `.rnb-detail`, `.asf-bar`, `.asf-dd`, `.asf-bld`, `.asf-opts`, `.asf-srch`, `.asf-q`, `.asf-o`, `.asf-code`, `.asf-txt`, `.asf-sel`, `.asf-sort`, `.as-status`, `.as-tag`, `.mv-card`, `.mv-top`, `.mv-st`(.new/.ck), `.mv-r`, `.mv-act`, `.mv-done`, `.mv-empty`, `.mvq*`, `.dd*`(공용 드롭다운).
- **마크업**: 핸들+토글 = **359행**, `.rnb` 패널(헤더·탭·필터바·A/S 리스트) = **384행**, 퇴실 리스트 `#mvList .mv-card` = **474행**.
- **색상 토큰**: 청록 `--blue:#14A497` + 보조 `--blue2`, 상태색 `--red #F04452`/`--amber #FF922B`/`--green #12B886` 및 `-t`(틴트) 변형.

## 4. 컴포넌트 아키텍처

신규 디렉터리 `components/shell/as-rail/`:

| 파일 | 역할 |
|------|------|
| `AsReceptionRail.tsx` | 최상위 (client). 핸들(토글) + `.rnb` 셸: 헤더/새로고침/2탭 스위처/필터바/리스트/empty·loading·error. open 상태(localStorage) 관리. |
| `AsReceptionList.tsx` | A/S 탭 본문: 필터바(건물·상태·담당자·접수자·유형·정렬) + `AsReceptionCard` 리스트. |
| `AsReceptionCard.tsx` | 민원 카드 1건 (`a.rnb-card`). 클릭 → `/staff/receipts` 네비게이트. |
| `MoveOutList.tsx` | 퇴실 탭 본문: 필터바(건물·상태·정렬) + `MoveOutCard` 리스트 + empty("대기 중인 퇴실 신청이 없어요"). |
| `MoveOutCard.tsx` | 퇴실 카드 1건 (`a.mv-card`) + `처리 완료` 액션. |
| `MoveOutConfirmDialog.tsx` | 처리 완료 확인 다이얼로그(정산 경고 문구). |
| `AsRail.module.css` | 원본 CSS **verbatim 이식**(§3 클래스 전체). |
| `useRailOpen.ts` | open/close 상태 훅(localStorage 지속, 기본 false=접힘). |

**설계 원칙**: staff 앱은 Tailwind가 기본이지만, 이 패널은 대량의 bespoke CSS를 "그대로 이식"해야 픽셀 퍼펙트가 보장되므로 **CSS 모듈**을 채택한다(격리 + 정본 대조 용이). 이는 mobile(resident/partner) 트랙에서 CSS 모듈을 쓰는 선례와 일치한다(메모리 `common-ui-extraction-backlog`).

**드롭다운**: 기존 공용 드롭다운/셀렉트 컴포넌트가 있으면 재사용, 없으면 `.dd`-스타일 소형 드롭다운을 모듈 내 구현(원본 `.dd`/`.dd-menu`/`.dd-opt` 마크업 정합).

## 5. 데이터 흐름

### 5.1 A/S 접수 탭 (complaints) — 신규 데이터 코드 0

기존 `hooks/reactquery/complaints`를 **그대로 재사용**한다.
- 조회: `useComplaints(filters: ComplaintFilters)` → `Complaint[]` (client-side, RLS org 스코프, `deleted_at IS NULL`).
- 타입/라벨: `Complaint`, `ComplaintStatus`(`pending|completed|on_hold|repeat`), 기존 `COMPLAINT_STATUS_LABEL`·상태색맵 재사용.

**상태 매핑**:

| DB status | 라벨 | `.as-status` data-c |
|-----------|------|---------------------|
| `pending` | 미결 | `var(--red)` |
| `on_hold` | 보류 | `var(--amber)` |
| `completed` | 완결 | `var(--green)` |
| `repeat` | 반복 | `var(--amber)` (원본 `.as-status`는 red/amber/green만 정의 → 반복은 amber 재사용; 필요 시 보조색 추가) |

**필터 매핑** (원본 `.asf-bar` 드롭다운):

| 원본 드롭다운 | 소스 | 적용 위치 |
|--------------|------|-----------|
| 건물 선택 | `ComplaintFilters.buildingId` (건물 목록 훅 재사용) | 서버 |
| 결과(상태, multi) | `ComplaintFilters.statuses[]` | 서버 |
| 유형(카테고리) | `ComplaintFilters.categoryId` (`as_categories` 목록) | 서버 |
| 검색(암묵) | `ComplaintFilters.search` | 서버 |
| 담당자 | `assignedTo` (계정명 lookup — `AsStatusSection`의 `assignees` 패턴 재사용) | **클라이언트** |
| 접수자 | `createdBy` (계정명 lookup) | **클라이언트** |
| 정렬(최신/오래된) | `receivedAt` asc/desc | **클라이언트**(또는 쿼리 order) |

**카드 필드 매핑** (`a.rnb-card`):

| 원본 표시 | 소스 |
|-----------|------|
| `#no · 건물 유닛` | `id` · `buildingName`/`unitNo`/`unitDong` |
| 상태 배지 | `status` (위 매핑) |
| 카테고리 태그 `.as-tag` | `categoryLabel` |
| 시각 | `receivedAt` (HH:mm) |
| 담당자(우측) | `assignedTo` → 계정명 |
| 본문 | `content ?? title` |
| 접수일 / 시행일 | `receivedAt` / `completedAt` (없으면 최신 `resolutions[0].resolvedAt`, 그래도 없으면 `-`) |
| 접수시 전화 | `reporterPhone ?? '-'` |
| 담당자 / 접수 | `assignedTo`명 / `createdBy`명 |
| 처리결과 | 최신 `resolutions[0].resultContent ?? '-'` |

카드 클릭 → `/staff/receipts` 이동(원본은 receipt-management로 링크; CRUD는 그곳에 존재).

### 5.2 퇴실 신청 탭 (move_out_requests) — 신규 스태프 읽기 훅 (마이그 없음)

`move_out_requests`는 이미 **스태프 SELECT/UPDATE RLS 정책 보유**(`0041_resident_move_out.sql`):
- `move_out_requests_staff_select`: `org_id ∈ my_org_ids() AND current_user_has_module('tenants')`
- `move_out_requests_staff_update`: 동일 조건 → 상태 전이 가능.

**신규 훅 모듈** `hooks/reactquery/staffMoveOut/`(`apis.ts`/`queries.ts`/`mutations.ts`/`keys.ts`):
- `listStaffMoveOutRequests(filters)` — `move_out_requests` direct select + 조인:
  - 건물명 `buildings(name)`, 유닛 `units(unit_no,dong)`,
  - 입주자명·연락처 = `occupancy_id → occupancies → tenant`(또는 유닛 현재 입주자) 조인. **연락처 컬럼이 테이블에 없으므로** tenant 연락처에서 해석; 조인 불가 시 `-`.
  - 기본 필터: 활성 요청 = `status='pending'` 또는 (`status='confirmed'` AND `resolved_at IS NULL`). (canceled/rejected 제외)
- `useConfirmMoveOut(id)` — 처리 완료: `status='confirmed', resolved_at=now(), resolved_by=auth.uid()` UPDATE (staff UPDATE 정책). 성공 시 리스트 무효화 → 카드 정리.

**상태(배지) 매핑** (`.mv-st`):

| DB status | 배지 | class |
|-----------|------|-------|
| `pending` | 신규 | `.mv-st.new` |
| `confirmed` (resolved_at IS NULL) | 확인 | `.mv-st.ck` |

**카드 필드 매핑** (`a.mv-card`):

| 원본 표시 | 소스 |
|-----------|------|
| `건물 유닛호` (`.mv-top b`) | `buildingName` + `unitNo`/`unitDong` |
| 입주자명 | 조인된 tenant 이름 |
| 상태 배지 | 위 매핑 |
| 신청일 | `created_at` |
| 희망 퇴실일 | `desired_date` |
| 연락처 | tenant 연락처 (없으면 `-`) |
| 처리 완료 버튼 | `useConfirmMoveOut` (A1 결정 시) |

**처리 완료 플로우** (A1=기능화 채택 시): 버튼 클릭 → `MoveOutConfirmDialog`("퇴실 신청을 처리 완료할까요?" + "처리 완료해도 정산은 자동으로 되지 않습니다. **반드시 이사정산을 진행해 주세요.**") → 확인 시 `useConfirmMoveOut` → 성공 토스트("퇴실 신청을 처리 완료했어요") → 리스트에서 제거.

**필터 매핑**(퇴실): 건물(`building_id`) · 상태(pending/confirmed) · 정렬(`created_at`/`desired_date`). (원본 퇴실 탭은 담당자·유형 필터 없음 → 필터바가 A/S 탭과 다르게 구성됨.)

## 6. 전역 통합 (AppShell)

- **마운트 지점**: `components/shell/AppShell.tsx` — `app/(staff)/layout.tsx`에서만 렌더되어 스태프 전용으로 스코프됨(platform/partner/resident는 별도 레이아웃).
- `AppShell` 반환부에 `<AsReceptionRail/>` 추가. **게이팅**: `isBare(pathname)` 화면(`/`, `/staff/login`)에서는 미노출(셸 자체가 없음). `hasIntegratedHeader` 화면(utilities 등)에서는 **노출**(원본 utility 화면도 `.rnb` 보유).
- **스텁 제거**: 기존 `components/shell/QuickAccessRail.tsx`와 그 사용처 2곳
  - `app/(staff)/staff/(app)/fee-items/components/FeeItemRightRail.tsx` (래퍼 삭제 또는 no-op)
  - `app/(staff)/staff/(app)/moving-settlement/components/SettlementInquiryPage.tsx`의 `<QuickAccessRail/>` 렌더 제거
  → 전역 마운트와 **중복 렌더 방지**.
- **FAB 제외**: QuickAccessRail 제거로 청록 FAB도 함께 사라진다. 이 태스크는 FAB를 재현하지 않는다. `AppShell`은 `<AsReceptionRail/>`만 추가 렌더. 실기능 FAB(메신저 `.fmp`)는 별도 세션이 별도로 `AppShell`에 마운트 → 두 세션 모두 `AppShell` 편집이므로 병합 시 인접 라인 조정(작은 충돌 예상).

## 7. 토글 / 기본 상태

- 기본 **접힘**(D4): 핸들(`.rnb-handle`)만 표시, `.rnb`는 `.rnb-off`(translateX(100%)). 전역 노출 시 404px가 모든 화면 콘텐츠를 매번 가리지 않도록.
- 토글: React state + `useRailOpen`(localStorage 키 예: `as-rail:open`)로 사용자별 지속.
- 원본은 CSS 체크박스(`#rnbToggle`)로 토글하나 기본 열림; 앱은 state 기반 + 기본 접힘으로 대체(동작 동일, 전역 안전 우선).
- **픽셀 캡처는 "열림 상태"** 로 수행(§9).

## 8. 범위 밖 (Non-Goals)

- **청록 메신저 FAB(`.fmp-fab`/`.fmp`)**: 원본은 빠른 문자/알림톡 발송 패널(별도 대형 기능). **이 태스크에서 완전 제외** — 실구현·전역 마운트는 별도 워크트리/세션(핸드오프 프롬프트 전달). 이 태스크는 FAB를 렌더하지 않는다.
- **패널 내 민원 CRUD**: 없음. A/S 카드는 읽기 + `/staff/receipts` 네비게이트. 생성/수정/해결은 기존 receipts·partner 앱에 존재.
- 퇴실 "처리 완료" 외 쓰기 동작 없음.

## 9. 픽셀-디프 하네스

- 하네스 재사용: `scripts/pixel-diff/` (`capture.mjs`/`diff.mjs`/`save-auth.mjs`/`targets.json`).
- **capture.mjs 확장**: 캡처 전 패널을 **열어야** 하므로, 핸들 클릭(또는 `as-rail:open` localStorage seed) 인터랙션 스텝 추가. 대상 화면(예: fee-items) 캡처 시 rail 열림 → 원본 `.rnb` 열림 상태와 대조.
- 세션: `admin` / `erp!12345`, `save-auth.mjs` (세션 ~1시간 만료 → 캡처 직전 재실행).

## 10. 검증 (신규 단위테스트 없음)

메모리 `unit-tests-postponed` 정책: 신규 vitest 작성 안 함. 검증 = 아래 그린 + 스팟체크.
- `tsc` (소스만; Next dev의 `.next` validator 노이즈는 `grep -vE '\.next'`로 제외)
- `npm run lint`
- `npm run build`
- 기존 `vitest` 전건 그린 (회귀 없음)
- 수동 스팟체크: `admin`/`erp!12345`로 여러 스태프 화면에서 핸들→열림, 2탭 전환, 필터, 카드 네비게이트, 퇴실 처리완료
- pixel-diff: 열림 상태 캡처로 원본 대조

**워크트리 검증 절차**(메모리 `home-erp-worktree-devserver-verification`): 이 워크트리엔 `node_modules` 없음 → 검증 시 `projects/home_erp`(node_modules 보유)에서 정션 연결 후 tsc/build/vitest, 종료 후 `rmdir` 정션 제거. 또는 라이브 프리뷰는 dev 서버 체크아웃에서 브랜치 반영 후 수행.

## 11. 운영/마이그레이션

- **마이그레이션 불필요**(D5): 두 탭 모두 기존 테이블·RLS·훅으로 충족. `complaints`/`complaint_resolutions`(0005), `move_out_requests`(0041) 모두 라이브.
- 불가피하게 마이그가 필요해지면(예: 조인 도달성 문제로 뷰/RPC 필요) **커밋 직전 `origin/master` max 번호 재확인** 후 `0150+` 부여(메모리 `migration-number-collision`).

## 12. 리스크 / 오픈 이슈

1. **퇴실 연락처 조인 도달성**: `move_out_requests`에 phone 없음 → tenant 연락처 조인 경로 확정 필요(occupancy→tenant vs 유닛 현재 입주자). 도달 불가 시 `-` 표시(마이그 회피). → 플랜에서 확정.
2. **시행일 의미**: 원본 "시행일"이 `completed_at`인지 별도 개념인지 스키마상 모호 → `completed_at` 폴백 규칙(§5.1)으로 처리.
3. **반복(repeat) 상태색**: 원본 미정의 → amber 재사용(§5.1). 정본 확인 시 조정.
4. **필터바 탭별 상이**: A/S(6 드롭다운) vs 퇴실(3) → 필터바를 탭별로 조건부 렌더. 픽셀 정합은 각 탭 활성 상태 기준.
5. **전역 노출 부작용**: 인쇄(`print:hidden`) · 모달 z-index · 통합헤더 화면 레이아웃과의 간섭 점검 필요. rail은 `position:fixed` 오버레이(콘텐츠 밀지 않음)라 원본과 동일하게 겹침.
6. **A1(처리 완료 기능화)** 미확정 시: 버튼을 비활성/숨김 처리하는 읽기전용 폴백으로 축소 가능.

## 13. 작업 순서(요약)

1. CSS 모듈 verbatim 이식(§3) + `AsReceptionRail` 셸(핸들·헤더·탭·토글).
2. A/S 탭: `useComplaints` 배선 + 필터 + 카드(§5.1).
3. 퇴실 탭: `staffMoveOut` 읽기 훅 + 카드 + (A1) 처리완료(§5.2).
4. AppShell 전역 마운트 + 스텁/사용처 2곳 제거(§6).
5. capture.mjs 열림 인터랙션 + pixel-diff 대조(§9).
6. 검증 그린(§10) → PR.

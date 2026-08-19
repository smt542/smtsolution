# 계정·직원 관리(`/staff/accounts`) 프로토타입 재설계 — 설계서

| | |
|---|---|
| **화면** | 계정·직원 관리 · `/staff/accounts` |
| **정본(디자인)** | 프로토타입 `staff/staff-management` — 배포: `https://staging.d2h12382xiksft.amplifyapp.com/staff/staff-management/staff-management.dc.html` · repo vendored: `docs/prototype/staff/staff-management.dc.html` |
| **정본(기획)** | `docs/prototype/prd/staff-management.md` |
| **상태/일자** | `approved` · 2026-08-19 · 브랜치 `feat/accounts-redesign` |

---

## 1. 배경·결정

기존 `/staff/accounts`는 기능적으로 동작하나(계정 CRUD·권한·비활성·Supabase Auth 발급/재설정 백엔드 존재), **프로토타입 정본과 화면 구조가 상당히 다르다**. 사용자 결정:

- **전체 재설계**: 계정 화면을 프로토타입 `staff-management`에 맞춘다.
- **B안(디자인 준수 + 보안 유지)**: 프로토타입은 비밀번호를 **평문 4자리 PIN**으로 목록에 노출하지만, **저장·인증은 기존 Supabase Auth(해시) 유지**. 목록의 비번 칸은 `●●●●` 마스킹, 수정 모달의 비번 필드는 **재설정**(값을 저장했다가 보여주지 않음).

### 확정 기본값
1. **테마**: 앱 기존 **파랑 `#3182F6` + 공용 컴포넌트**로 구현. 프로토타입의 teal(`#14A497`)/인라인 스타일은 **구조·UX 기준으로만** 참고하고 이식하지 않는다(앱 전체 파랑은 의도된 결정 — `login-redesign-teal` 메모리).
2. **삭제**: 프로토타입의 "삭제"(행 제거)는 **하드삭제 대신 비활성 처리**로 매핑(감사이력 보존 · PRD "삭제 대신 비활성"과 일치).
3. **탭 매핑**: `support_staff`(청소·관리실)는 **현장 관리자 탭**에 포함.
4. **권한 키**: 칩 라벨·그룹은 프로토타입대로 노출하되 내부 `feature_permissions` 키는 기존 `MODULE_KEYS` 최대 재사용, 없는 것만 추가(앱 전역 권한체크 파급 최소화).

---

## 2. 목표 화면 구조 (프로토타입 기준)

### 2.1 탭 (`.hf-tab2`)
`사무실 관리자` / `현장 관리자` / `입주자` — 3탭. 탭별 `staff_type` 매핑:
- 사무실 관리자(office) = `manager_staff`
- 현장 관리자(field) = `field_staff` ∪ `support_staff`
- 입주자(tenant) = `tenant`

### 2.2 계정 목록 표 — 사무실·현장 탭 (`#acTbl`)
컬럼: **이름 / 아이디 / 비밀번호 / 연락처 / 유형 / 상태**
- 비밀번호: **`●●●●` 마스킹**(B안 — 실제 값 미조회). 프로토타입은 `4821` 평문이나 이식하지 않음.
- 유형: `role` 파생 — `org_owner`/`platform_admin`→**마스터**, 그 외→**일반**.
- 상태: `is_active` → 활성화/비활성화.
- 행 클릭 → 등록·수정 모달(수정 모드).
- 상단 우측 `＋ 계정 등록` 버튼, 좌측 `계정 목록` + 카운트 뱃지(`N개`), 검색(이름·아이디·연락처).

### 2.3 입주자 탭 (`#tnTbl`) — Phase 3
컬럼: 건물명 / 호실 / 입주자명 / 연락처 / 카카오ID / 카카오이름 / 연결상태 / 연결일.
- 필터바: 건물 드롭다운 + 연결상태 세그(전체/연결됨/미연결/매핑실패).
- **"세대 연결" 모달**(`.lk-scrim`): 카카오 계정을 올바른 세대로 연결, **매핑실패** 케이스 처리.
- 백엔드: `res_claims`(신규) + RPC. 세입자앱(resident) 트랙과 연동.

### 2.4 등록·수정 단일 모달 (`reg` state) — Phase 2
- 제목: `사무실 관리자 등록/수정` · `현장 관리자 등록/수정`(탭별). 부제 "필수 항목(*)을 입력해 주세요".
- 필드(2열 그리드): **아이디\*** / **비밀번호\***(숫자 4자리 PIN, `inputmode=numeric maxLength=4`) / **이름\*** / 연락처 / **회원유형**(마스터·일반) / **상태**(활성화·비활성화).
  - 수정 모드: 비번 필드 = **재설정**(빈칸 시 미변경, 입력 시 4자리 검증 후 `PATCH /api/accounts/[userId]`). 목록엔 `●●●●`.
- **"페이지별 권한" 칩**(`.rg-perm`) — 카테고리 그룹(§3).
- 푸터: `삭제`(수정 시 노출 → **비활성 확인 처리**) · `취소` · `등록/저장`.

---

## 3. 페이지별 권한 칩 taxonomy (프로토타입 line 548 원문)

| 그룹 | 칩 라벨 | 매핑(제안, 기존 `MODULE_KEYS` 우선) |
|---|---|---|
| 관리업무 | 건물·입주자 관리 | `buildings` + `tenants` |
| | 관리비 부과 세팅 | `billing` |
| | 항목등록 관리 | (신규 `fee_items` 또는 `settings`에 포함 — Phase 2 확정) |
| | 서류 발행·출력 | `bill_publish` |
| | 미납 관리 | `overdue` |
| | 협력업체 관리 | (신규 `vendors`) |
| | 장기수선비 관리 | (신규 `long_term_repair`) |
| | 문자·알림톡 관리 | `messaging` |
| 공과금 관리 | 공과금 관리 전체 | `utilities` |
| 이사정산 | 이사정산 전체 | `moving` |
| 설정 | 계정·직원 | `accounts` |
| | 셋업 설정 | `settings` |

> **Phase 2 미결(사용자 확정 필요):** 프로토타입 칩은 현재 13개 `MODULE_KEYS`보다 **coarse**하여 `payment`(수납)·`notices`(공지)·`complaints`(민원) 칩이 없다. 이 키들을 (a) 인접 칩에 번들, (b) 별도 칩 추가 중 택1. 신규 키(`vendors`·`long_term_repair`·`fee_items`)는 **권한 기록은 되나 각 화면 게이트 배선은 후속**(파급 최소화). Phase 2 착수 시 매핑표를 사용자와 확정한다.

---

## 4. 데이터 매핑 (기존 스키마 재사용)

| 프로토타입 개념 | 기존 스키마 |
|---|---|
| 탭(office/field/tenant) | `org_members.staff_type` |
| 유형(마스터/일반) | `org_members.role`(`org_owner` vs `staff`) — `isMaster()` |
| 페이지별 권한 칩 | `org_members.feature_permissions`(jsonb) — `MODULE_KEYS` + 신규 키 |
| 비밀번호(4자리) | Supabase Auth 해시. 생성=`POST /api/accounts`(`provision_member`), 재설정=`PATCH /api/accounts/[userId]`. 목록 마스킹(B안) |
| 상태 활성/비활성 | `admin_set_active` |
| 세대 연결(입주자) | `res_claims`(신규 마이그·RPC) — Phase 3 |

권한 집행(RPC `current_user_is_master`/`current_user_has_module`, `provision_member` 비마스터 축소, `admin_set_member_permissions` master-only)은 **이미 완비 → 유지**.

---

## 5. 단계 분해 (천천히·하나씩)

### Phase 1 — 레이아웃/3탭/목록표 재구성 (백엔드 무변경·저위험)
- `page.tsx` 탭을 6→3(사무실/현장/입주자)로. 탭→`staff_type` 매핑(§2.1).
- `AccountTable` 컬럼을 §2.2로: 이름/아이디/**비밀번호(`●●●●`)**/연락처/**유형(마스터·일반)**/상태.
- 카운트 뱃지·검색·`＋ 계정 등록`·행클릭(기존 모달) 유지. 입주자 탭은 당분간 계정표(마스킹)로 노출(세대연결은 Phase 3).
- 공용 컴포넌트·파랑 테마. 라벨은 vendored 프로토타입에서 그대로 인용.
- **수용 기준**: 3탭 렌더·탭별 필터 정확·컬럼 일치·기존 등록/수정/비활성 회귀 없음·`tsc`/`lint`/`vitest` 통과.

### Phase 2 — 등록/수정 모달 + 4자리 PIN + B안 재설정 + 페이지별 권한 칩
- 모달을 §2.4로 재구성. 4자리 PIN 검증(zod `accountCreateSchema`/route 422 = 숫자 4자리).
- 수정 모드 비번 = 재설정(`useResetPassword` 배선). 상태 드롭다운=`setActive`. 삭제=비활성 확인.
- 권한 칩 §3(매핑 확정 후). 필요한 신규 키 추가.
- **수용 기준**: 등록·수정·재설정·권한·비활성 동작·권한 집행 회귀 없음·검증 통과.

### Phase 3 — 입주자 탭 + 세대 연결 (최고 난이도·resident 트랙 의존)
- `res_claims` 신규 마이그(커밋 직전 `origin/master` 마이그 max 재확인 — 번호 충돌 메모리)·RPC.
- 입주자 표(§2.3) + "세대 연결" 모달 + 매핑실패 처리.
- **수용 기준**: 연결/해제/매핑실패 플로우·RLS org 격리·검증 통과.

---

## 6. 비범위·주의
- 프로토타입 teal 인라인 스타일 이식 안 함(파랑 유지).
- 하드삭제 안 함(비활성).
- 세입자 세대매칭 **백엔드**는 resident 앱 트랙과 겹침 — Phase 3에서 조율.
- 마이그(Phase 3)는 커밋 직전 번호 재확인.

## 7. 참조
- 프로토타입: vendored `docs/prototype/staff/staff-management.dc.html` (staging `/staff/staff-management/...`)
- PRD: `docs/prototype/prd/staff-management.md`
- 현재 구현: `app/(staff)/staff/accounts/**`, `hooks/reactquery/accounts/**`, `app/api/accounts/**`, `lib/auth/permissions.ts`, `supabase/migrations/0002_p2a_accounts_permissions.sql`

# prototype 픽셀 정합 — 라우터↔원본 매핑 감사 (2026-09-09)

앱 라우터 전수(63)를 prototype 최신 원본(청록/x-dc)과 매핑한다. 정합상태는 **메모리·PR 이력 기반 잠정**이며, 실제 px 갭은 Phase 2 하네스(`scripts/pixel-diff/`)로 실측한다.

## 요약

| persona | 앱 라우트 | 원본 화면 | 원본 위치 |
|---|---|---|---|
| staff | 24 | 21 | staging + `docs/prototype/staff/` (vendored) |
| HQ(platform-admin) | 11 | 7 | staging + `docs/prototype/admin/` |
| partner | 10 | 10 | staging (로컬 미vendor) |
| resident | 17 | 13 | staging + `docs/prototype/resident/`(로컬 7만) |
| 공개 | 1 | (허브) | `_erp/index` |
| **계** | **63** | **51** | |

**매핑 유형**: 1:1 다수 · **N:1**(공과금 utility 4→`/utilities`, 이사정산 moving 5→`/moving-settlement`) · **1:N**(`building-list`→건물+세대 상세 6라우트, `tenants`→조직 상세 4라우트).

**범례**: 🟢 최근 정본정합 PR 이력有(재검증) · 🟡 구현됨·정합 미확인(실측 필요) · 🔴 앱 전용(원본 없음) · ⛔ 원본만(앱 미구현).

---

## staff (앱 24 ↔ 원본 21)

| 앱 라우트 | 대응 원본 | 상태 | 비고 |
|---|---|---|---|
| `/staff` (대시보드) | (없음) | 🔴 | 원본 staff에 dashboard 없음(진입=receipt-management). PRD엔 dashboard.md 존재 |
| `/staff/receipts` | receipt-management | 🟢 | PR#58-63 세대중심 재설계. 검증서 매핑 확인 |
| `/staff/buildings` (+`[id]`,`/tenants`,`/tenants/[tenantId]`,`/tenants/new`) | building-list | 🟢 | PR#94/95 통합 재구현. 1→6 라우트 |
| `/staff/buildings/new`, `/buildings/new-v2` | building-list | 🟡 | 건물 등록 폼. new-v2 병존 확인 필요 |
| `/staff/management-fee` | management-fee-setting | 🟡 | P5 부과. 정본 정밀정합 미확인 |
| `/staff/fee-items` | fee-item | 🟡 | 항목등록 관리 |
| `/staff/bill` | bill-publish | 🟢 | P5 발행 PR#19-43(지로·팩스 등) |
| `/staff/overdue` | overdue-management | 🟢 | PR#42 연체료 |
| `/staff/utilities` | utility-electric/gas/water/lookup | 🟡 | **4→1**(탭). P5a/c. 탭별 정합 확인 |
| `/staff/moving-settlement` (+`/inquiries/[type]`) | moving-settlement/status/elec/gas/water | 🟡 | **5→2**. 정산+조회 |
| `/staff/notices` | notice-management | 🟡 | 공지 관리 |
| `/staff/messaging` | messaging | 🟢 | PR#37 문자·알림톡 |
| `/staff/setup` | setup | 🟡 | P2b 5탭 |
| `/staff/vendor-management` | vendor-management | 🟡 | 협력업체 |
| `/staff/long-term-repair` | long-term-repair | 🟢 | PR#36 장기수선 |
| `/staff/accounts` | staff-management | 🟢 | PR#49 재설계(직원/계정) |
| `/staff/customer-numbers` | (없음/utility-lookup?) | 🔴 | 고객번호 관리. 원본 대응 불명 → 확인 |
| `/staff/login` | login | 🟢 | PR#22. **이미 원본 px 이식 확인** |

---

## HQ platform-admin (앱 11 ↔ 원본 7)

| 앱 라우트 | 대응 원본 | 상태 | 비고 |
|---|---|---|---|
| `/platform-admin` | overview | 🟢 | 대시보드. PR#116-126 정본정합 |
| `/platform-admin/accounts` | accounts | 🟢 | 계정권한 |
| `/platform-admin/billing` | usage | 🟢 | 청구(사용량 원본) |
| `/platform-admin/organizations` (+`[orgId]`,`/buildings/[buildingId]`,`/units/[unitId]`) | tenants | 🟢 | 테넌트. 1→4 라우트(드릴다운) |
| `/platform-admin/points` (+`/organizations`) | points | 🟢 | 포인트. 1→2 |
| `/platform-admin/settings` | settings | 🟢 | 설정 |
| `/platform-admin/login` | login | 🟢 | PR#77 아이디 단독 |

HQ 6화면(대시보드·테넌트·포인트·청구·계정권한·설정)은 Claude Design 정본 표현정합 완료(PR#116-126). **재검증 우선순위 낮음.**

---

## partner (앱 10 ↔ 원본 10, 1:1)

| 앱 라우트 | 대응 원본 | 상태 |
|---|---|---|
| `/partner/mobile-login` | mobile-login | 🟡 |
| `/partner/mobile-home` | mobile-home | 🟡 |
| `/partner/mobile-inquiry` | mobile-inquiry | 🟡 |
| `/partner/mobile-profile` | mobile-profile | 🟡 |
| `/partner/mobile-as` | mobile-as | 🟡 |
| `/partner/mobile-as-new` | mobile-as-new | 🟡 |
| `/partner/mobile-building` | mobile-building | 🟡 |
| `/partner/mobile-meter` | mobile-meter | 🟡 |
| `/partner/mobile-tenant` | mobile-tenant | 🟡 |
| `/partner/mobile-ms-new` | mobile-ms-new | 🟡 |

Track D 구현·PR#56(미머지, 메모리). **모바일 뷰포트 규약**(`.phone .screen`) 필요. 원본 로컬 미vendor → Phase 2 착수 시 vendoring.

---

## resident (앱 17 ↔ 원본 13)

| 앱 라우트 | 대응 원본 | 상태 | 비고 |
|---|---|---|---|
| `/resident/login` | resident-login | 🟢 | |
| `/resident/auth` | resident-auth | 🟢 | |
| `/resident/verify` | resident-verify | 🟢 | |
| `/resident/nomatch` | resident-nomatch | 🟢 | |
| `/resident/pending` | resident-pending | 🟢 | |
| `/resident/(app)/home` | resident-home | 🟢 | PR#154-156 정본 재정합 |
| `/resident/(app)/notify` | resident-notify | 🟢 | |
| `/resident/(app)/bill` | resident-bill | 🟢 | PR#157 목록 정본 |
| `/resident/(app)/bill/[period]` | resident-bill-detail | 🟢 | PR#162 완전정본(검침·연체료·정산) |
| `/resident/(app)/notice` (+`/[id]`) | resident-notice | 🟢 | |
| `/resident/(app)/me` | resident-me | 🟢 | PR#160 정본정합 |
| `/resident/terms` | resident-terms | 🟡 | 약관 본문 |
| `/resident/privacy` | resident-privacy | 🟡 | 개인정보 본문 |
| `/resident/r/notice/[token]`, `/r/settlement/[token]`, `/rb/[building]/[unit]/[period]` | (resident-bill-detail 무로그인) | 🟡 | 무로그인 공유링크(서명URL). 원본 직접 대응 확인 |

resident 다수 최근 정본정합(PR#154-170). **재검증 우선순위 낮음.** ⚠️ resident 원본 bill/bill-detail/notice/me/terms/privacy는 **staging에만**(로컬 미vendor).

---

## 공개

| 앱 라우트 | 대응 원본 | 상태 | 비고 |
|---|---|---|---|
| `/` (app/page.tsx) | (`_erp/index` 허브 / 소개 랜딩) | 🟡 | 카카오 채널용 소개 랜딩(메모리 client-provisioning). 원본 대응 확인 |

---

## Phase 2 정합 우선순위 (staff 먼저)

정본정합 PR 이력이 **약한(🟡)** staff 화면 = 실측 갭 가능성 높음 → 우선:

1. **관리비 부과 세팅** `management-fee` ← management-fee-setting (핵심·복잡)
2. **공과금** `utilities` ← utility-electric/gas/water/lookup (4→1 탭, --blue2 보조색 사용)
3. **이사정산** `moving-settlement` ← moving 5원본 (5→2)
4. **항목등록** `fee-items` ← fee-item
5. **공지 관리** `notices` ← notice-management
6. **셋업** `setup` ← setup
7. **협력업체** `vendor-management` ← vendor-management
8. **대시보드** `/staff` (원본 부재 → 제품결정 필요)

🟢(receipts·buildings·bill·overdue·messaging·long-term-repair·accounts·login)은 최근 정합 이력 → **재검증(회귀 확인)** 후순위.

**파일럿 후보**: `fee-items`(단순·미정합) 또는 `management-fee`(대표·복잡). 파일럿은 중간 복잡도 권장 → **`fee-items`** 또는 `notices`.

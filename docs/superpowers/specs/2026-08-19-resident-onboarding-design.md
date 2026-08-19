# 세입자앱 온보딩 설계서 (카카오 세대연결)

| | |
|---|---|
| **기능** | 세입자앱 온보딩 — 카카오 로그인 → 세대(occupancy) 매칭/연결 → 홈 |
| **정본(디자인)** | 프로토타입 `resident/*` (staging `https://staging.d2h12382xiksft.amplifyapp.com/resident/...`) |
| **정본(기획)** | `docs/prototype/prd/tenant-app.md` |
| **상태/일자** | `approved(방향)` · 2026-08-19 · 브랜치 `feat/resident-onboarding` |

---

## 1. 배경·결정

세입자앱은 미착수(그린필드). 앱에 resident 라우트·인증이 전혀 없음(staff·platform-admin만). 이번 작업 범위 = **온보딩**(로그인→세대연결→홈 진입)과 그 백엔드 + staff 승인.

- **카카오 = Stub/목업**: 키 미확보(클라이언트 제공 예정) → 카카오 부분만 mock, **백엔드·인증·RLS·데이터는 실제로** 구축. stub 어댑터가 mock 카카오 신원으로 **실제 Supabase auth 유저 발급**. 실 카카오 오면 **어댑터(로그인 라우트)만 교체**.
- **PRD vs 프로토타입**: PRD는 "카카오 로그인→전화 자동매칭"으로 단순하나, **프로토타입이 정본**이며 더 정교(자동매칭 실패/불일치 시 **수기 세대청구 → 관리자 승인**). 프로토타입 플로우를 따른다.

## 2. 온보딩 모델 (프로토타입)

1. `resident-login` — 카카오 시작 + 약관/개인정보 동의
2. `resident-auth` — 자동 조회: **본인인증=카카오만**(별도 PASS 없음), **매칭=전화번호**(카카오 전화 ↔ occupancy.phone)
3. 분기:
   - 매칭 성공 → `resident-verify`("이 세대가 맞나요?") → "네" → `resident-notify`(알림설정) → `resident-home`
   - "제 세대 아니에요" → 건물 검색 + 호수 입력 → **확인 요청**(수기청구) → `resident-pending`(승인 대기)
   - 전화 매칭 실패 → `resident-nomatch`
4. **staff측**: `res_claims`의 pending을 **입주자 탭 + 세대연결 모달로 승인·연결**(= 계정화면 Phase 3)

## 3. 아키텍처 결정 (승인됨)

1. **세입자 인증 surface**: 세입자는 관리 org 직원이 아니므로 **`org_members` 미사용**. 세입자 = `auth.users`(카카오) + `resident_identities`(카카오 신원) + **`res_claims`로 occupancy 연결**. org·데이터 범위는 연결된 occupancy→units→buildings.org에서 파생. 세입자용 RLS는 직원용(org_members)과 **분리**.
2. **연결 단일 소스** = `res_claims` 중 `status='linked'` 행(resident_user_id ↔ occupancy_id). occupancies에 컬럼 추가하지 않음(변경 최소).

---

## 4. O1 — 백엔드 (마이그 `0039_resident_claims`)

> ⚠️ 커밋 직전 `origin/master` 마이그 max 재확인(현재 0038 → 0039). [[migration-number-collision]]

### 4.1 테이블

**`resident_identities`** — 세입자 카카오 신원(로그인 시 stub 라우트가 upsert)
- `user_id uuid PK → auth.users(id) on delete cascade`
- `kakao_id text not null unique` · `kakao_name text` · `phone text` · `created_at timestamptz default now()`

**`res_claims`** — 세대 청구/연결 워크플로우
- `id bigint identity PK`
- `org_id bigint → organizations(id) on delete cascade` (건물 확정 시 파생, nullable)
- `resident_user_id uuid not null → auth.users(id) on delete cascade`
- `kakao_id text` · `kakao_name text` · `claimed_name text` · `claimed_phone text`
- `building_id bigint → buildings(id) on delete set null` · `unit_id bigint → units(id) on delete set null` · `claimed_unit_text text`
- `occupancy_id bigint → occupancies(id) on delete set null` (연결 시 set)
- `status text not null check in ('pending','linked','rejected') default 'pending'`
- `kind text not null check in ('auto','manual','search')`
- `memo text` · `created_at` · `resolved_at timestamptz` · `resolved_by uuid → auth.users(id) on delete set null`
- 인덱스: `resident_user_id`, `org_id`, `status`. **부분 unique**: `(resident_user_id) where status='linked'`(세입자 1인 = 세대 1개), `(resident_user_id) where status='pending'`(중복 청구 방지).

### 4.2 RPC (security definer · `set search_path=public` · revoke anon,public / grant authenticated · 관례 준수)

**세입자용** (org_members 없음 → auth.uid() + resident_identities/res_claims 기반):
- `resident_automatch()` → 내 `resident_identities.phone`로 `occupancies`(non-deleted·status='occupied') 전화 일치 후보 반환(building_id/name·unit_id/unit_no·occupancy_id·org_id). org 무관 조회(세입자는 org 스코프 아님).
- `resident_confirm(p_occupancy_id bigint)` → 해당 occupancy 전화가 내 kakao 전화와 일치 검증 후 `res_claims`(status='linked', kind='auto', occupancy_id, org_id=building.org) upsert.
- `resident_request_claim(p_building_id bigint, p_unit_text text)` → `res_claims`(status='pending', kind='manual', building_id, claimed_unit_text, org_id=building.org) insert.
- `resident_my_link()` → 내 linked 청구의 occupancy 요약(홈/청구 스코프용).

**직원용** (org 스코프 + `current_user_has_module('tenants')` write):
- `list_res_claims(p_status text default null)` → 내 org의 청구 목록(+building/unit/occupancy·resident 정보 조인).
- `approve_res_claim(p_claim_id bigint, p_occupancy_id bigint)` → org 검증·`tenants` 권한 → status='linked'·occupancy_id·resolved_by/at. (매핑실패=올바른 occupancy를 골라 연결)
- `reject_res_claim(p_claim_id bigint)` → status='rejected'.
- audit_log 기록(ACCOUNT_* 관례처럼 CLAIM_LINK/CLAIM_REJECT).

### 4.3 RLS
- `resident_identities`: 본인만(`user_id = auth.uid()`) select. insert/update는 service-role 라우트.
- `res_claims`: 세입자 = 본인 행(`resident_user_id = auth.uid()`) select/insert; 직원 = `org_id in (select my_org_ids())` select, write는 +`current_user_has_module('tenants')`. platform_admin cross-org select(관례).
- 세입자 데이터 read(occupancies·bills 등)는 후속(O2/앱 기능)에서 linked 청구 기준 스코프 헬퍼 추가.

### 4.4 stub 카카오 로그인 라우트
- `POST /api/resident/kakao/stub` (service role): body `{ kakaoId?, name?, phone? }`(미지정 시 mock 생성) → `admin.auth.admin.createUser`(email `kakao_<id>@resident.stub`·랜덤 pw·email_confirm) 또는 기존 조회 → 세션 발급 → `resident_identities` upsert → 성공 반환. **실 카카오 = 이 라우트만 OAuth 콜백으로 교체.**
- 타입·훅: `hooks/reactquery/residentClaims/*`(apis·queries·mutations) — automatch/confirm/request/my_link + 직원 list/approve/reject.

### 4.5 O1 수용 기준
- 마이그 0039 파일 작성(객체·RLS·RPC·인덱스·grant). 라이브 적용은 사용자 후속(관례).
- stub 라우트 + 훅 + 타입. 라우트/훅 단위테스트(mock). tsc·lint·build·vitest 통과. **UI 없음**(O2).

---

## 5. O2 — 세입자 UI (후속)
- `app/(resident)` 신규 라우트 그룹(모바일 웹, max-width 440). 6화면: login·auth(로딩)·verify(확인+수기청구 시트)·nomatch·pending·notify·home 셸.
- 프로토타입 `resident/*` 그대로(구조·문구), 앱 공용 스타일. stub 로그인 버튼 → 라우트 → automatch → 분기.
- 프로토타입 vendoring: `docs/prototype/resident/`.

## 6. O3 — staff 승인 (= 계정 Phase 3)
- 계정화면 입주자 탭을 프로토타입 `staff-management` 입주자 표(건물/호실/카카오ID/이름/연결상태/연결일)로 + "세대 연결" 모달(매핑실패 처리). `list_res_claims`/`approve_res_claim`/`reject_res_claim` 배선.

## 7. 비범위
- 온보딩 이후 앱 기능(홈 콘텐츠·관리비 확인·공지·퇴실신청·고지서신청·1년 무로그인 링크)은 별도.
- 실 카카오 OAuth 배선(키 확보 후 stub 라우트 교체).

## 8. 참조
- 프로토타입: staging `resident/{resident-login,resident-auth,resident-verify,resident-nomatch,resident-pending,resident-notify,resident-home}.dc.html`
- PRD: `docs/prototype/prd/tenant-app.md`
- 기존 스키마: `units`·`occupancies`(unit_id→units→buildings.org)·`profiles`(user_id→auth.users)·`staff_type`enum('tenant') / RLS `my_org_ids()`·`current_user_has_module` / 마이그 max 0038

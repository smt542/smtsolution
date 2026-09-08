# 워크포스 겸직 Capabilities 모델 (Staff Capabilities)

- 날짜: 2026-09-08
- 상태: **확정(브레인스토밍 완료) — writing-plans로 구현 플랜 작성 대기.**
- 선행: 크로스-persona 인가 게이트 트랙 완료([[cross-persona-authz-gate-status]], 스펙 `2026-09-08-cross-persona-authz-gate-design.md`). 게이트는 **가산(HAS persona) semantics**로 이 모델을 코드변경 없이 수용하도록 이미 설계됨.
- 브랜치: `feat/staff-capabilities`.

## 1. 문제

"사무실 직원이 현장도 뛰는" **겸직**을 현재 스키마로 표현할 수 없다. `org_members` PK가 `(org_id, user_id)`(`0000_p0_auth_foundation.sql`)라 **한 사람은 같은 org에서 staff_type을 하나만** 가진다(`manager_staff` XOR `field_staff` XOR `support_staff`). 그래서 한 계정이 사무실 웹앱(`/staff`)과 현장 모바일앱(`/partner`)을 **동시에 쓸 수 없다**.

## 2. 확정된 결정 (2026-09-08 브레인스토밍)

1. **스키마 = Option B (jsonb 배열)**: `org_members.staff_capabilities jsonb`, 값은 **`staff_type` enum 문자열 배열**. 기존 `feature_permissions jsonb` 패턴 재사용, 새 테이블·RLS 정책 없음.
2. **staff_type 컬럼 = 유지(primary) + capabilities가 접근 권위**: `staff_type`은 primary(표시·기본 탭·`get_my_context`)로 잔존, `staff_capabilities`가 "어느 앱에 접근하는가"의 **authoritative** 소스. 두 축을 의미 분리(표시 vs 접근)하여 동기화 부담 없음. 완전 이관(폐기)은 blast radius가 커 기각.
3. **로그인 UX = chooser 없음**: `web /staff/login`·`mobile /partner/login`이 각각 해당 capability 보유자를 통과시킴. 게이트가 가산이라 한쪽으로 로그인해도 반대 앱 접근 가능 → 별도 persona 선택 화면 불필요.
4. **capabilities 어휘 = `staff_type` 값 재사용**(예: `["manager_staff","field_staff"]`). 새 persona 어휘/매핑 레이어를 만들지 않아 술어가 0147과 의미 동일.
5. **불변식**: `staff_type ∈ staff_capabilities`(primary는 항상 보유 자격). 백필로 성립.

## 3. 유일 seam과 그 예외 (recon 확정)

persona 판정 seam은 **술어 함수**(`current_user_is_manager_staff`/`current_user_is_field_partner`, `0147`)다. 페이지·API 게이트가 이 술어를 호출하면 **술어 바디만 capabilities 소스로 바꿔도 상위 코드 무변경**으로 겸직 수용.

- **술어를 거치는 게이트(무변경)**:
  - API: `lib/api/requirePersona.ts` → `requirePersonaApi()` → 술어 RPC (PR #171, 11개 라우트).
  - staff 페이지: `app/(staff)/staff/(app)/layout.tsx` → `requirePersona("manager_staff")` → 술어 RPC.
  - platform/resident 페이지: `requirePersona`/`requireResidentLink` (PR #174).
- **⚠️ 예외 — partner 페이지 게이트**: `app/(partner)/partner/(app)/layout.tsx:20`은 `requirePersona`를 **쓰지 않고** `get_my_context` 결과의 `FIELD_TYPES.includes(ctx.staff_type)`를 **직접** 검사한다(단일 staff_type). partner는 원래 "레퍼런스 패턴"이었으나 공유 헬퍼로 마이그레이션되지 않았다. 이대로면 primary=`manager_staff`+field capability 겸직자가 partner 페이지에서 **잘못 거부**된다.
  - **해결**: partner 레이아웃을 `requirePersona("field_partner", "/partner/mobile-login")`으로 전환 → 술어 seam으로 편입, 게이트 통일 완성. (부수효과: 비-field 인증계정의 mismatch 리다이렉트가 현행 `/staff` → 트랙 표준 `/`(중립)로 통일. 무세션은 `/partner/mobile-login` 유지.)

## 4. 데이터 모델 & 마이그레이션 (신규, 번호 커밋직전 확정 — §9)

```sql
-- org_members에 capabilities 컬럼 추가(값=staff_type 문자열 배열)
alter table org_members
  add column if not exists staff_capabilities jsonb not null default '[]'::jsonb;

-- 배열 타입 가드(enum 값 검증은 RPC 레이어에서 — feature_permissions와 동일 정책)
alter table org_members
  add constraint org_members_staff_capabilities_is_array
  check (jsonb_typeof(staff_capabilities) = 'array');

-- 백필: 기존 단일 staff_type → 1원소 배열(불변식 staff_type ∈ capabilities 성립)
update org_members
  set staff_capabilities = jsonb_build_array(staff_type::text)
  where staff_capabilities = '[]'::jsonb;
```

- 신규 INSERT 경로가 값을 안 넣으면 default `'[]'` → 어느 persona 술어에도 매칭 안 됨(fail-closed, 안전). 실질 INSERT 경로는 `provision_member` 하나(§5).
- `tenant` staff_type 행: 백필 `["tenant"]` — 게이트 술어(manager/field/support만 검사)에 무영향.

## 5. RPC 변경

모두 `create or replace`(또는 drop+create) 재정의. 최신 정의 위치는 recon 확정.

1. **술어(0147 재정의)** — seam 교체:
   - `current_user_is_manager_staff()`: `m.staff_type = 'manager_staff'` → `m.staff_capabilities ? 'manager_staff'`.
   - `current_user_is_field_partner()`: `m.staff_type in ('field_staff','support_staff')` → `m.staff_capabilities ?| array['field_staff','support_staff']`.
   - `profiles.is_active` 검사와 가산 semantics는 그대로.
2. **`provision_member`(최신 `0033_platform_org_cud.sql`, 11 args 재정의)**:
   - 인자 추가 `p_staff_capabilities jsonb default null`.
   - org_members INSERT 시 `staff_capabilities = coalesce(p_staff_capabilities, jsonb_build_array(p_staff_type::text))`.
   - RPC가 **primary ∈ caps 보장 + dedup**(방어적). 미전달 기존 호출자는 `[primary]` → **하위호환**.
3. **기본정보/권한 UPDATE RPC(최신 `0002_p2a_accounts_permissions.sql`)**:
   - `admin_update_member_basic`: `p_staff_capabilities jsonb default null` **추가**, 제공 시 org_members UPDATE(미제공 시 기존 caps 보존), primary 방어적 재주입+dedup. (겸직 토글의 편집 경로.)
   - `admin_set_member_permissions`: **시그니처 유지(신규 param 없음)**. staff_type 변경 대비 기존 caps에 primary만 방어적 재주입 → 불변식 유지. 권한 모달은 caps 미관리라 param 불필요(호출자·테스트 보존).
4. **`get_my_context`(최신 `0002_p2a_accounts_permissions.sql`)**:
   - 반환 컬럼에 `staff_capabilities jsonb` **추가(additive)**. `staff_type`(primary)은 그대로 반환.
5. **`list_accounts`(최신 `0002_p2a_accounts_permissions.sql`)**:
   - 반환 행에 `staff_capabilities` **추가**(계정 목록 배지·편집폼 사전선택용). 필터 `p_type`은 현행 유지(primary 탭 기준).

## 6. 로그인 변경 (JS측, 세션 발급 전 후보 해석)

두 로그인 모두 이미 후보를 뽑아 비밀번호로 판별(candidate loop). 멤버십 판정을 `staff_type` 필터 → 반환된 `staff_capabilities`에 대한 **JS측 검사**로 전환(PostgREST jsonb 연산자 우회, 후보 루프 패턴과 일치).

- **`app/api/staff/login/route.ts`**:
  - 후보 멤버십 쿼리에서 SQL `staff_type` 필터 제거 → `staff_capabilities` 컬럼을 select 후 **JS측** `caps.includes('manager_staff')`로 후보 판정(partner와 동일 패턴).
  - 세션 발급 후 방어적 재검사(현행 `row.staff_type !== "manager_staff"`, line ~109)를 `get_my_context`의 `staff_capabilities`에 `'manager_staff'` 포함 검사로 전환(§5.4 필드 사용). **필수** — field-primary 겸직자의 오거부 방지.
  - 반환 컨텍스트의 `staffType`은 primary 그대로. `staffCapabilities`는 additive로 함께 반환(클라 표시·후속 링크용).
- **`app/api/partner/login/route.ts`**:
  - `FIELD_TYPES` 상수 유지. 후보 멤버십 쿼리를 capability 기준으로: 후보가 `'field_staff'` 또는 `'support_staff'` 보유해야 함(JS `caps.some(c => FIELD_TYPES.includes(c))`).
  - 반환은 현행 `{ userId }` 그대로.

## 7. 프론트/타입 & 프로비저닝 UI

- **타입(additive)**:
  - `hooks/reactquery/auth/apis.ts`: `MyContext`에 `staffCapabilities: StaffType[]` 추가(`staffType` 유지).
  - `hooks/reactquery/accounts/apis.ts`: `Account`·`AccountCreateInput`·`AccountBasicInput`에 `staffCapabilities` 추가.
  - `components/forms/schema/account.ts`: `staffCapabilities: z.array(z.enum(STAFF_TYPES))` 선택 필드.
- **프로비저닝 UI(`/staff/accounts`)** — 최소 변경:
  - `AccountFormModal.tsx`: primary는 현행 탭 기반 유지. **"겸직: 다른 앱도 접근 허용" 토글 1개** 추가.
    - 사무실 계정(primary=manager_staff): 토글 ON → caps에 `field_staff` 추가.
    - 현장 계정(primary=field/support): 토글 ON → caps에 `manager_staff` 추가.
    - 항상 `caps = [primary] (+ 토글 시 반대 persona 값)` 형태로 제출. 편집 시 현재 caps로 토글 초기화.
  - `page.tsx`: 계정 행에 **capability 배지**("현장 접근"/"사무실 접근") — primary 외 자격 보유 시 표시. 목록은 primary 탭 기준 유지(양쪽 탭 노출은 §8 비목표).
  - **생성 경로**: `AccountFormModal`→`createAccount`→POST `app/api/accounts`→`provision_member`. POST 라우트가 body의 `staffCapabilities`를 `p_staff_capabilities`로 전달.
  - **편집(basic) 경로**: `AccountFormModal`→`updateAccountBasic` 훅→클라 RPC `admin_update_member_basic`(`p_staff_capabilities`). (`[userId]` PATCH는 비번 리셋 전용 — caps 무관.)
- **platform-admin 계정 UI**: `provision_member` 시그니처가 하위호환(신규 인자 default null)이라 무변경으로 동작(caps=`[primary]`). 겸직 부여를 platform-admin에도 노출할지는 **후속(선택)** — 이번 범위는 `/staff/accounts`.

## 8. 비목표

- 신규 현장자격 겸직자의 **담당건물 배정**: 접근 부여 ≠ 건물 배정. 기존 partner 배정 흐름 재사용, 이번 범위 밖(다운스트림).
- 겸직자 계정 목록의 **양쪽 탭 동시 노출**(현재는 primary 탭 + 배지). 필요 시 후속(`list_accounts` capability 필터).
- persona 게이트 재작업(완료), role(`org_member_role`) 모델 변경, resident `res_claims`, JWT claims, 워크포스 테이블 분리.
- `feature_permissions`와 capability는 **별개 축 유지**(capability=어느 앱 접근, permission=앱 내부 기능). 통합/변경 없음.

## 9. 마이그레이션 번호 주의

- `0147`(persona 술어) 적용 완료. origin/master max 확인 필요 — remote에 **이중 `0146`**(`0146_automatch_profile_image`+`0146_bill_signed_url`) 이력 존재(병렬 세션). 다음 번호 유력 **`0148`**이나 **커밋 직전 `origin/master` max + 로컬 미커밋 max 재확인** 필수. [[migration-number-collision]]
- 라이브 적용은 classifier 차단 → 사용자 `!`로 직접(`node --env-file=.env.local scripts/db-query.mjs < 마이그.sql`, `[]` 출력=성공). [[supabase-migration-apply-method]]

## 10. 검증

- 정적: `tsc` 0 · `lint` 0 · `next build --webpack` OK · 기존 `vitest` 그린(사전 실패 6건 무관 — kakao scope·GiroLedgerModal).
- 술어 회귀 테스트: 영향 라우트 mock에 `current_user_is_manager_staff` 유지, capabilities 경로 추가 검증.
- 라이브 마이그 검증: 백필 후 `select staff_type, staff_capabilities from org_members` 스팟체크, 술어가 capabilities 읽는지 확인.
- 수동 e2e: 겸직 계정 프로비저닝(사무실+현장) → `/staff/login`·`/partner/login` **양쪽 로그인 성공** → `/staff`·`/partner` **양쪽 페이지 게이트 통과** 확인. 단일자격 계정은 반대 앱 거부(회귀 없음) 확인.

## 11. 변경 파일 맵 (recon 기준)

| 영역 | 파일 | 변경 |
|---|---|---|
| 마이그 | `supabase/migrations/0148_*.sql`(신규) | 컬럼·CHECK·백필·술어2·provision_member·admin_update_member_basic·admin_set_member_permissions·get_my_context·list_accounts 재정의 |
| 게이트 예외 | `app/(partner)/partner/(app)/layout.tsx` | `requirePersona("field_partner","/partner/mobile-login")`로 전환 |
| 로그인 | `app/api/staff/login/route.ts` | 후보 capability 검사 + 재검사 caps 기반 |
| 로그인 | `app/api/partner/login/route.ts` | 후보 capability 검사(JS) |
| 프로비저닝 API | `app/api/accounts/route.ts`(POST) | body `staffCapabilities` → `p_staff_capabilities`(생성) |
| 편집 훅 | `hooks/reactquery/accounts/apis.ts` `updateAccountBasic` | `p_staff_capabilities` 전달(편집 basic) |
| 프로비저닝 UI | `AccountFormModal.tsx`(겸직 토글) · `AccountTable.tsx`(배지) · `components/forms/schema/account.ts`(alsoCrossApp) | 겸직 토글 + 목록 배지 |
| 타입 | `hooks/reactquery/auth/apis.ts`, `hooks/reactquery/accounts/apis.ts`, `components/forms/schema/account.ts` | `staffCapabilities` additive |

## 12. 다음 단계

1. `superpowers:writing-plans`로 구현 플랜 작성: **마이그(컬럼·백필·술어·RPC) → partner 레이아웃 전환 → 로그인 → 프로비저닝 UI/타입 → 검증**.
2. `feat/staff-capabilities`에서 구현. 라이브 마이그는 사용자 `!` 실행.

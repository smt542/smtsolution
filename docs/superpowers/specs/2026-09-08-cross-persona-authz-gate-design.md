# 크로스-persona 서버 인가 게이트 (Cross-Persona Authorization Gate)

- 날짜: 2026-09-08
- 상태: 설계 승인 (구현 전)
- 범위: 페이지(서버 레이아웃) + API 서버 인가 게이트. **데이터 RPC/RLS의 persona-scoping과 워크포스 테이블 분리는 범위 밖.**

## 1. 문제 정의

이 앱은 로그인 엔트리포인트가 4개(staff·platform-admin·partner·resident)지만, **하나의 Supabase `auth.users` 세션 위에서 동작**한다. 어떤 persona로 발급된 세션이든 다른 persona의 경로에 접근할 수 있다. 근본 원인은 "이 세션이 어느 persona인지 확인하고 경로그룹별로 맞는 persona만 통과시키는 서버 게이트"가 통일돼 있지 않은 것이다.

**핵심: 이 문제는 테이블(`org_members`) 분리로 해결되지 않는다.** persona 진실은 이미 `org_members`·`res_claims` 행에 있고, 토큰에는 담기지 않는다. 테이블을 쪼개도 세션 쿠키는 하나이고 경로 게이트도 그대로다. 고칠 곳은 데이터 모델이 아니라 **인가 게이트**다.

## 2. 현재 상태 (정찰 근거)

프록시 매처(`proxy.ts:65-66`)는 `["/staff/:path*", "/platform-admin/:path*", "/partner/:path*", "/resident/:path*"]`이며 `/api/**`·`/r/**`는 제외. 게이트는 **세션 존재만** 확인(`proxy.ts:22-56`, `lib/supabase/middleware.ts:23-24`) — role/staff_type/resident 신원 미확인.

| 경로그룹 | proxy(엣지) | 서버 레이아웃 가드 | API 핸들러 | RLS/RPC(데이터) |
|---|---|---|---|---|
| **partner** | 세션존재만 | ✅ 서버 persona 가드 `staff_type∈(field/support)` (`app/(partner)/partner/(app)/layout.tsx:11-23`) | 로그인 교환만 | org-scoped RPC |
| **platform-admin** | 세션존재만 | ⚠️ **클라이언트** 가드 hydration 후 (`_components/PlatformAdminGuard.tsx`) | ✅ `current_user_is_platform_admin()` (`app/api/platform/organizations/route.ts`) | admin 격리 |
| **staff** | 세션존재만 | ❌ **없음** (`app/(staff)/layout.tsx:1-7`, `AppShell` 무조건 렌더) | ⚠️ **org만 검증**, `manager_staff` 아님 (`lib/api/requireOrgContext.ts:14-27`) | org-scoped (persona 아님) |
| **resident** | 세션존재만 | ⚠️ **클라이언트** 훅 effect (`lib/resident/useResidentGuard.ts`) | ✅ `resident_identities` 검증 (`app/api/resident/withdraw/route.ts`) | 대체로 격리 |

**실증된 최악 시나리오**: `field_staff/support_staff`(partner) 세션이 **같은 org의 staff 페이지 + staff API(`/api/buildings/export` 등) + 데이터까지 200으로 접근**. 서버 레이아웃 무가드 → `requireOrgContext`는 org만 검증 → building RLS/`list_buildings()`가 `current_user_org()` 기준이라 안 걸러짐(`0116_buildings_tenant_manager_columns.sql`, `0004_p3a_buildings.sql:83-88`, `0000_p0_auth_foundation.sql:97-102`).

**레이어별 누수 요약**
- **페이지 응답**: `/staff`·`/platform-admin`·`/resident`는 유효 세션만 있으면 서버가 렌더/응답(내용이 이미 내려감; 클라 가드는 사후에 가림). `/partner` 앱 페이지만 서버 리다이렉트로 예외.
- **API 디스패치**: `/api/**`가 매처 밖 → 라우팅 레벨 개방. 핸들러별 검증이나 staff 계열은 흔히 org/모듈 스코프만 → 같은 org의 partner/platform 멤버 통과.
- **데이터**: RLS/RPC가 최종 방벽이지만 상당수 **org-scoped(persona 아님)** → 같은 org 내 partner→staff 접근을 못 막음.

**persona 진실 소스** (단일 통합 RPC 없음):
- `get_my_context()` — 첫 멤버십 1행의 org_id/role/staff_type/isActive/org status 반환 (`0002_p2a_accounts_permissions.sql:54-67`). **단일행 한계**: 다중 멤버십 유저는 한 행만 보임.
- `current_user_is_platform_admin()` — 멤버십 중 하나라도 platform_admin + 프로필 active면 true (EXISTS-any) (`0133_session_active_enforcement.sql:60-73`).
- `resident_my_link()` — 최신 linked claim 반환 or 무행 (`0039_resident_claims.sql:227-271`).

## 3. 목표 / 비목표

**목표**
- 4개 경로그룹 전부에 **서버 사이드**(렌더/응답 전) persona 게이트를 통일 적용.
- persona 민감 API 핸들러가 org 스코프뿐 아니라 **persona**를 서버에서 단언.
- 다중 멤버십 유저를 올바르게 판정.
- 리다이렉트 루프 없음.

**비목표 (YAGNI)**
- 워크포스 테이블 분리.
- 데이터 RPC/RLS의 persona-scoping 재작성(`list_buildings`·`partner_my_building_ids` 등) — 별도 심층방어 트랙.
- JWT custom claims(토큰에 persona 심기) — 역할변경 staleness가 기존 0133 즉시-비활성 정책과 상충; 후속 성능 최적화로 분리.
- proxy에 persona 인지 추가(필수 아님, 아래 5절 참고) — 선택 폴리시.
- **사무실+현장 겸직(capabilities 모델)** — 한 계정에 복수 자격 부여(선택적·양방향). 스키마(자격 다값화: 별도 자격 테이블 또는 staff_type 다값) + `/accounts` 프로비저닝 UI 변경 = **별도 후속 스펙**(2026-09-08 결정: 정식 capabilities 채택). 본 게이트는 가산 semantics + 술어 seam(4.2)이라 그 모델을 코드 변경 없이 수용.

## 4. 설계

### 4.1 Persona 모델
- persona = `manager_staff` | `platform_admin` | `field_partner` | `resident`.
- 규칙: **route group이 요구 persona를 정하고, 게이트는 "세션 유저가 그 persona를 보유했는가"를 검사.** 다중 멤버십이면 해당 그룹들 모두 통과. persona 배타성은 DB 제약으로 강제하지 않음(현행 유지).
- **가산(HAS persona) semantics 확정 근거**: "사무실 직원이 현장도 뛰는" 겸직 요구(2026-09-08). 배타(세션이 어느 persona로 로그인됐나) 방식이면 겸직이 원천봉쇄되므로, 가산 방식이 정답. ⚠️단 **현재 `org_members` PK가 `(org_id, user_id)`**(`0000:44`)라 org당 staff_type 1개 = **같은 org 겸직은 아직 표현 불가**. 겸직 실현은 capabilities 후속 스펙(3절 비목표)에서 데이터모델을 다값화해야 하며, 본 게이트는 그 모델을 자동 수용한다.

### 4.2 공통 술어 함수 (SQL, 신규 마이그레이션)
기존 `current_user_is_platform_admin()`(EXISTS-any + 프로필 active) 패턴을 그대로 복제:
- `current_user_is_manager_staff()` — `EXISTS(org_members m JOIN profiles p ON …) WHERE m.user_id=auth.uid() AND m.staff_type='manager_staff' AND p.is_active AND <org active>`.
- `current_user_is_field_partner()` — 동일하되 `m.staff_type IN ('field_staff','support_staff')`.
- resident는 기존 `resident_my_link()` 재사용(무행이면 미링크).
- 모두 `SECURITY DEFINER`, `auth.uid()` 기준, `current_user_is_platform_admin()`과 동일 스타일. 마이그 번호는 커밋 직전 `origin/master` 최대치 **및 로컬 미커밋 마이그** 재확인 후 확정. ⚠️0145=resident_profile_image, **0146=resident 서명URL(로컬 WIP)로 이미 선점** → 후보 0147+.
- **근거**: 단일행 `get_my_context()` 대신 EXISTS-any 술어로 다중 멤버십을 정확히 판정하고, 페이지/API/후속 RLS에서 재사용.
- **겸직/capabilities 단일 seam**: 이 술어들이 persona 판정의 유일한 지점 → 후속 capabilities 모델(자격 다값화)이 들어오면 **술어 바디만 갱신**하면 게이트/호출부는 무변경. staff_type 단일컬럼 → 다값 소스로 바꿔도 상위 코드 영향 없음.

### 4.3 페이지 게이트 (서버 레이아웃)
레퍼런스 = `app/(partner)/partner/(app)/layout.tsx` (async 서버컴포넌트 → `auth.getUser()` → 검증 → `redirect`).

- 서버 헬퍼 `requirePersona(persona)` 신설(server-only, 예: `lib/auth/requirePersona.ts`):
  1. 서버 supabase 클라이언트로 `auth.getUser()` — 무세션이면 해당 그룹 **login**으로 redirect.
  2. persona별 술어 rpc 호출: `manager_staff`→`current_user_is_manager_staff`, `platform_admin`→`current_user_is_platform_admin`, `field_partner`→`current_user_is_field_partner`, `resident`→`resident_my_link` 링크 확인.
  3. 불일치면 **중립 대상**으로 redirect(5절, 루프 방지).
- 적용:
  - **staff**: gated 서브트리 레이아웃에 `requirePersona('manager_staff')` **신규**. login/셋업 등 공개 경로는 서브트리 밖 유지.
  - **platform-admin**: 클라 `PlatformAdminGuard` 검사를 **서버 레이아웃으로 승격**(클라 래퍼는 표현만 남기거나 제거). login 경로 제외.
  - **resident**: authed 서브트리(`home`·`bill`·`bill/[period]`·`notice`·`notice/[id]`·`me`)를 서버 레이아웃 게이트로. `/resident/auth`·`/resident/verify`(온보딩)·`/r/**`(공개 공유토큰)는 게이트 밖.
- **주의**: resident 세션이 쿠키 기반인지 확인(현재 클라 훅+브라우저 supabase 사용) — 서버 게이트는 쿠키에서 세션을 읽어야 함. `lib/resident/session.ts`가 password 세션을 만들어 쿠키에 싣는지 구현 단계에서 검증.

### 4.4 API 게이트
- 페이지용(4.3, redirect)과 **별개 변형**임에 주의: API용은 리다이렉트가 아니라 **HTTP 상태**를 반환한다. 이름 충돌을 피해 API용은 `requirePersonaApi(persona)`로 명명(페이지용=`requirePersona`).
- `lib/api/requireOrgContext.ts`가 이미 `get_my_context`를 찍으므로, persona 단언을 얹은 **`requirePersonaApi(persona)`** 로 확장:
  - 무세션 → **401**, persona 불일치 → **403**. org 컨텍스트가 필요한 핸들러엔 기존처럼 컨텍스트 반환(기존 반환/throw 관례 준수).
- 라우트 taxonomy (plan 단계에서 `/api/**` 전수 인벤토리 → persona 태깅):
  - `/api/platform/**` → `platform_admin` (대개 이미 `current_user_is_platform_admin()`; 정규화).
  - `/api/resident/**` → `resident` (기존 신원검증; 정규화). 단 **공개 예외**(share-token, kakao stub 등)는 게이트하지 않음.
  - `/api/partner/**` → `field_partner`.
  - 그 외 staff-facing(`/api/buildings`·`/api/bill`·`/api/payment`·`/api/messaging` 등) → `requireOrgContext` → **`requirePersonaApi('manager_staff')`** (partner→staff 누수 차단).
- **공개/인증불요 엔드포인트 명시 목록**(로그인 교환, 서명URL 공개조회, kakao 스텁 등)은 게이트 제외 — 이 목록을 plan에서 확정해 공개 플로우 회귀 방지.

## 5. 리다이렉트 루프 안전
- 현재 proxy는 인증 세션이 login 페이지에 오면 그룹 홈으로 튕긴다(`proxy.ts:32-47,57-60`, persona 무관). 새 게이트가 wrong-persona를 login으로 되돌리면 proxy가 다시 홈으로 → 게이트 → 루프 위험.
- **요구사항**: wrong-persona redirect 대상은 **게이트 서브트리 밖의 중립 페이지**(매처에 없는 경로). **기본 대상 = 공개 랜딩 `/`**(이미 존재, 매처 밖이라 루프 없음). *선택 개선*: 신규 소형 페이지 `/switch-account`("다른 계정 유형으로 로그인되어 있습니다" + [로그아웃]/[내 홈으로])로 UX 향상 — 필수 아님.
- **부수 효과(수용)**: 같은 브라우저에서 다른 persona로 로그인하려면 먼저 로그아웃 필요(세션 쿠키 1개). 이는 단일 `auth.users` 세션 모델의 자연스러운 결과이자 원 증상과 정합.
- **선택(후속 폴리시, 필수 아님)**: proxy의 off-login redirect를 persona 인지로 완화해 무로그아웃 persona 전환 UX 개선. 보안 수정엔 불필요.

## 6. 검증
- **4×4 매트릭스**: {manager_staff, platform_admin, field_partner, resident} 세션 × {/staff, /platform-admin, /partner, /resident} 경로그룹에 대해
  - 페이지: 올바른 persona=200, 그 외=중립 페이지로 redirect(내용 미노출).
  - API: 올바른 persona=200, 무세션=401, 그 외 persona=403.
  - 데이터: (참고) 최종 데이터 가시성 스팟 체크 — 특히 partner 세션의 staff API가 403인지.
- 공개 플로우 회귀 없음: 로그인 교환·서명URL 공개조회·kakao 스텁·`/r/**` 정상 동작.
- tsc 0 / lint 0 / build OK / 기존 vitest 그린. (신규 단위테스트는 정책상 작성하지 않음 — 4×4는 수동/스팟 검증 매트릭스로.)

## 7. 위험 / 미해결
- **API 전수 분류 정확도**: 핸들러를 잘못 태깅하면 누수 잔존 또는 공개 플로우 파손. → 명시적 공개 예외 목록 + 4×4 매트릭스로 완화.
- **배포 DB 드리프트**: 정찰은 마이그 파일 기준(적용 함수 바디·grant는 미조회). 신규 술어 마이그 적용 후 라이브 검증 필요.
- **resident 서버 게이트**: 현재 클라 훅+브라우저 supabase → 서버 쿠키 세션 읽기 가능 여부 구현 시 확인.
- **persona 배타성 미강제**: 한 `auth.users`가 워크포스·resident에 동시 존재 가능(스키마가 안 막음). 본 설계는 "보유 persona면 통과" 모델이라 기능상 안전하나, 배타성이 필요하면 별도 결정.

## 8. 참고 파일 (구현 착수점)
- 프록시/미들웨어: `proxy.ts`, `lib/supabase/middleware.ts`
- 레퍼런스 서버 게이트: `app/(partner)/partner/(app)/layout.tsx`
- 승격 대상 클라 가드: `app/(platform-admin)/_components/PlatformAdminGuard.tsx`, `lib/resident/useResidentGuard.ts`
- 무가드 staff: `app/(staff)/layout.tsx`, `components/shell/AppShell.tsx`, `components/AccountActiveGuard.tsx`
- API 게이트: `lib/api/requireOrgContext.ts`, 예시 `app/api/buildings/export/route.ts`
- SQL 술어: `supabase/migrations/0002_p2a_accounts_permissions.sql`(get_my_context), `0133_session_active_enforcement.sql`(current_user_is_platform_admin), `0039_resident_claims.sql`(resident_my_link)

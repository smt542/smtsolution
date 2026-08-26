# 스키마·RLS 프로덕션 검증 리포트

- **일자**: 2026-08-26
- **대상**: home_erp (Supabase 프로젝트 `amhtprmapxlizdnsgbeg`)
- **방법**: 라이브 DB 카탈로그 **읽기 전용 introspection**(Management API) + 앱 서버코드 정적 리뷰. 변경/PII 조회 없음.
- **범위**: (1) DB 계층 — RLS·정책·함수·권한, (2) 앱 계층 — `service_role`(RLS 우회) 사용처의 org 스코핑.

---

## 1. 결론

**테넌트 격리가 DB 계층과 앱 계층 양쪽에서 프로덕션 수준으로 견고하다. 실제 Critical/High 취약점 0건.**

- DB: 공개 테이블 63개 전부 RLS 활성, 라이브 정책 108개가 일관된 org 격리 패턴을 따름, 급소 함수 전부 fail-closed + `search_path` 고정, 뷰 0개(우회 표면 없음).
- 앱: `service_role`은 `lib/supabase/admin.ts` 1곳으로 집중, 이를 쓰는 11개 라우트 전부 "서버측 인증→인가→그 후 특권작업" 패턴 준수. org는 항상 서버 도출값 사용, IDOR 방어 구현됨.

발견은 전부 **하드닝/설정 항목**이며, 실무 최우선은 **A1(세입자 스텁 플래그)** 이다.

---

## 2. DB 계층 — 검증 완료 (실측 근거)

| 점검 | 결과 |
|------|------|
| RLS 활성 | **63/63 테이블** (미적용 0) |
| 라이브 정책 | **108개** (`public` 88 + `authenticated` 20, `anon`·혼합역할 0) |
| org 스코핑 | 전부 `org_id IN my_org_ids()` 또는 building/unit/occupancy/complaint/settlement **JOIN 간접 스코핑** |
| 과다허용 정책 | `USING (true)` 등 blanket 정책 **0** |
| 쓰기 정책 무결성 | INSERT/UPDATE/ALL의 **WITH CHECK 누락 0** |
| 급소 함수 | `my_org_ids`·`current_user_has_module`·`current_user_org`·`get_my_context`·`current_user_is_platform_admin` — 전부 SECURITY DEFINER + `search_path=public` 고정 + anon시 빈집합/false |
| DEFINER search_path 누락 | **0건** (search_path 권한상승 표면 없음) |
| 뷰(view/matview) | **0개** (뷰 소유자 권한 RLS 우회 없음) |
| 무로그인 공개경로 | `public_bill/notice/settlement_by_token` — 만료 게이팅(`expires_at>now()`)·단일레코드 스코프·PII 최소·토큰 `gen_random_uuid()`(122bit) |
| 공유토큰 테이블 | RLS + 정책 0 = deny-all (notice/settlement은 anon SELECT조차 없음) |
| 세입자 격리 | 세입자는 `org_members` 미소속 → staff 데이터 전면 차단, 본인 res_claims/move_out/identity만, 세대연결 자가승인 불가 |
| 플랫폼관리자 | `role='platform_admin'`만 교차테넌트 열람, org_owner와 구분 |

**급소 검증 상세**
- `my_org_ids()`: `select org_id from org_members where user_id=auth.uid() and org.status='active'` → **anon은 auth.uid()=NULL → 빈집합 → 모든 org 정책 차단.** anon에 거의 전 테이블 GRANT가 있어도 실제 차단은 이 함수+RLS가 100% 담당.
- `current_user_is_platform_admin()`: `role='platform_admin'` 존재만 true. anon/일반 staff/org_owner엔 false(fail-closed).

---

## 3. 앱 계층 — service_role 감사 (A)

`service_role` 클라이언트 = `lib/supabase/admin.ts`(`createAdminClient`) 단일 정의. 사용 라우트 11개(비-테스트) 전수 확인.

**공통 패턴(전 라우트 준수):**
1. `createClient()`(anon+쿠키 JWT = **RLS 적용**)로 `auth.getUser()` 인증
2. `get_my_context` / `current_user_is_platform_admin`로 인가 (org·role·permission 서버 도출)
3. **그 후에만** `createAdminClient()`로 불가피한 특권 작업(auth 유저 생성/변경, cross-org provision)
4. org는 항상 `ctx.org_id`(서버 도출), 클라이언트 입력 불신뢰

**IDOR/교차테넌트 방어 확인:**
- `accounts/[userId]`: `list_accounts`(org격리 RPC) 소속 검증 후 비번변경
- `bill/fax/send`: 문서 로드를 RLS 클라이언트로 → 타 org billIssueId는 빈결과(유출 불가)
- `platform/*`: 전부 platform_admin 게이트
- cron(`dispatch-scheduled`·`delivery/reconcile`): `CRON_SECRET` **timing-safe** 비교, 미설정시 fail-closed
- `messaging/send`: 멱등키 필수, 포인트는 서버도출 org에만 차감

---

## 4. 통합 발견 사항

| ID | 계층 | 등급 | 내용 | 권고 |
|----|------|------|------|------|
| **A1** | 앱 | **중(설정)** | `resident/kakao/stub`가 실인증 없이 세입자 세션 발급. 기본 prod 404이나 `RESIDENT_STUB_ENABLED=true`면 임의 사칭 | **go-live 필수**: prod 플래그 미설정 확인 + 실카카오 OAuth 교체 |
| **A2** | 앱 | 중(인증) | 4자리 숫자 비번 + `partner/login` 아이디만(회사코드X) = 무차별 대입 여지 | 로그인 rate-limit/잠금, 비번정책 강화 |
| **L1** | DB | 낮음(실데이터 전 中) | `anon`에 거의 전 테이블 DML+TRUNCATE 부여(Supabase 기본). PostgREST 미도달이나 불필요 표면 | anon write/TRUNCATE REVOKE — **적용완료(0103)** |
| **L3** | DB | 낮음 | staff 정책 88개가 `{public}`(신규는 `{authenticated}`) | `{authenticated}` 통일 — **적용완료(0103)** |
| **A3** | 앱 | 낮음 | `admin.ts`에 `server-only` 가드 없음(주석만) | `import "server-only"` 추가 |
| **A4** | 앱 | 낮음(확인) | `messaging` recipients는 client 입력(포인트는 서버org로 안전) | `quote_/reserve_message_points` recipient 해석 org 스코프 스팟체크 |
| **L4** | DB | 낮음(기능) | `late_fee_rate_tiers`만 `current_user_org()`(첫 org 1개), 타 테이블은 `my_org_ids()` | 다중org 대비 `IN(my_org_ids())` 통일 |
| **L5** | DB | 낮음(확인) | `message_point_rates` RLS on·정책0=deny-all → authenticated 직접조회 불가 | 앱이 service_role/definer로 읽는지 확인 |
| **L2** | DB | 정보 | 전 테이블 `rls_forced=false`(owner/definer 우회, 정상 설계) | 현행 유지, 인지만 |

---

## 5. Go-live 체크리스트 (우선순위)

1. **[필수] A1** — 프로덕션 환경변수에 `RESIDENT_STUB_ENABLED` **미설정** 확인. 실카카오 OAuth 도입 전까지 스텁 라우트 노출 금지.
2. **[필수] cron** — `CRON_SECRET` 프로덕션 설정(미설정 시 예약발송/재조회 비활성, fail-closed).
3. **[권장] A2** — 로그인 rate-limit/계정잠금 도입(또는 비번정책 강화) — 특히 `partner/login`.
4. **[완료] L1·L3** — 하드닝 마이그 `0103_rls_hardening.sql` **적용·검증 완료(2026-08-26)**.
5. **[권장] A3** — `admin.ts`에 `server-only` 추가.
6. **[확인] A4·L5** — messaging RPC recipient 스코프, point_rates 읽기 경로 스팟체크.

---

## 6. 이번 범위 밖 = 남은 리스크

- **세입자앱 데이터 RPC**: 로그인 세입자에게 본인 세대만 노출하는 RPC들의 `res_claims` 연동 정확성(개별 미감사).
- **Storage 버킷 정책**(첨부/사진): 이번 미포함(`supabase/verify/p1a_storage.sql` 존재).
- **실데이터 교차 프로브**: 테스트 org 2개로 상호 열람 시도 = 격리 실증(테스트 계정 필요).
- **레거시 17.4GiB 이관**: 별도 트랙(엑셀 기반). 이관 후 금액 대사·행 카운트 검증 권장.

---

## 부록 — 하드닝 초안 & 재현 쿼리

- 하드닝 마이그: **`supabase/migrations/0103_rls_hardening.sql`** (L1 anon write/TRUNCATE REVOKE + L3 {public} 88개→{authenticated} DO 블록) — **2026-08-26 적용·검증 완료(ledger 0103, anon write=none, 정책 authenticated 108)**
- 검증 재현(읽기전용, Management API):
  - 테이블별 RLS/org_id/정책수, 정책 전문(qual/with_check), anon GRANT, DEFINER 함수·search_path, 뷰, 역할분포

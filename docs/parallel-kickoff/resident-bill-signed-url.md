# 세입자앱 관리비 상세 — 무로그인 **서명 URL(건물·호수·월)** 접근 (킥오프·다음 세션)

> 2026-09-08 결정. 무로그인 상세 접근을 **건물·호수·월이 담긴 서명 URL**로 제공(사용자 선택: "서명 URL(파라미터+서명)"). 파라미터는 보이되 **서명 없이는 위조·열거 불가**, 수신자는 비밀번호 없이 링크만 열면 됨. **먼저 §5 열린 결정을 사용자와 확정한 뒤 구현.**

## 0. 배경 / 현재 상태
- 무로그인 상세는 **이미 존재**: `/r/[token]`(`public_bill_by_token`, `bill_share_tokens`의 추측 불가 UUID·1년 만료·세입자 PII 제외·만료 시 금액 마스킹). `BillDetailView(mode="public")`로 렌더.
- 상세 본문(히어로·개별 사용료+검침·공용·기타·정산·연체료)은 **완성**(PR #162·마이그 0144): `public_bill_by_token`이 `late_fee` + 항목별 `utility/usage/prev_usage` 포함, 반환형 `PublicBillDetail`.
- 이번 작업 = **접근 방식 추가**: 토큰 대신 `건물·호수·월 + 서명`으로 **같은 화면**을 연다. 렌더/데이터는 전부 재사용.

## 1. URL 설계
- 예: `/rb/{building_id}/{unit_no}/{period}?s={sig}` (path=건물·호수·월, query=서명). `period=YYYY-MM`.
- ⚠️ **건물 식별은 building_id(전역 PK) 권장** — 건물명은 org(관리업체) 간 유일하지 않음(여러 업체에 "그린빌라 201호" 가능). 서명이 붙으니 id 노출은 무해. (더 예쁜 URL 원하면 building별 `public_slug` 컬럼 신설 = §5 결정.)
- `sig` = `HMAC-SHA256(secret, "{building_id}:{unit_no}:{period}")` → base64url(≥16자/128bit). 파라미터 1글자만 바뀌어도 무효.
- 수신자 무마찰(비밀번호 없음). **링크 생성은 secret 보유자(staff/서버)만** 가능.

## 2. 보안 모델
- **열거 방지**: secret 없이는 유효 URL 생성 불가 → building_id/호수/월을 추측해도 `sig` 없으면 차단.
- **PII**: 기존 public 뷰와 동일 — 세입자 이름·전화 **제외**, 금액·입금계좌·검침은 노출(무로그인 열람 목적).
- **secret 보관**: DB 잠금 테이블(예 `app_secrets(key,value)` RLS deny-all, security-definer 함수만 읽음) 또는 GUC. **anon/authenticated·Node·클라이언트에 절대 노출 금지**.
- **비교**: HMAC 비교. pgcrypto 문자열 `=`는 완전 상수시간은 아님 — 실무 허용범위, 필요 시 완화(길이 고정·해시 재비교).
- **폐기/만료(§5 결정)**: 서명 URL은 상태가 없어 **개별 폐기 불가**. 방법 = (a) 영구 (b) payload에 만료월 포함해 서명·검증(예 발급월+12개월, 만료 시 마스킹) (c) denylist 테이블. 토큰(폐기 가능·1년)과의 트레이드오프를 사용자와 확정.

## 3. DB (마이그 **0146** — 커밋 직전 origin/master max 재확인. 0144=이 화면·**0145=resident_profile_image가 이미 선점**)
> `pgcrypto` 확장 필요(`create extension if not exists pgcrypto`).
- **secret**: 잠금 테이블/GUC + 강한 랜덤 초기값 주입. ⚠️ secret 주입 DML은 auto-mode classifier가 막을 수 있음 → **사용자 `!` 직접 실행** 또는 승인.
- **`public_bill_by_signed(p_building_id bigint, p_unit_no text, p_period date, p_sig text)`** — anon, security definer:
  1. `payload = p_building_id||':'||p_unit_no||':'||to_char(p_period,'YYYY-MM')`; `expected = base64url(encode(hmac(payload, <secret>, 'sha256'),'base64'))`(절단 규칙은 생성부와 **동일**).
  2. `p_sig` ≠ expected → 빈 결과(또는 `is_valid=false`). 일치 시 → **`public_bill_by_token`의 SELECT 그대로 재사용**하되 lookup을 `token` → `building_id + unit_no`(해당 org·`billing_confirmations.confirmed_at` 있는 `p_period`)로 교체. 반환 = `late_fee` + 항목 `utility/usage/prev_usage` + 계좌, **세입자 PII 제외**. 반환 시그니처를 `public_bill_by_token`과 **정렬**(프런트 `PublicBillDetail`·`rowToPublicBillDetail` 재사용).
  3. (만료 채택 시) payload에 만료월 포함 + 검사.
  - grants: `revoke ... from public; grant execute ... to anon, authenticated;`
- **`staff_sign_bill_url(p_building_id bigint, p_unit_no text, p_period date)`** — authenticated: 호출자 org가 그 building 소유인지 확인 후 `sig`(또는 전체 상대경로) 반환. staff가 링크를 만든다. (생성부·검증부가 **동일 secret·동일 payload·동일 절단**이어야 함 → 둘 다 DB에 두는 게 안전.)
- 검증: 유효 sig 샘플 열람 OK · 잘못된 sig=빈결과 · **다른 org의 building_id로 교차 접근 차단** · 미확정/기간밖 월=빈결과. (`resident_bill_detail`은 auth.uid 필요라 서비스롤로 직접 호출 불가 → `public_bill_by_signed`는 anon이라 서비스롤로 샘플 검증 가능.)

## 4. 프런트 (`app/(resident)/**`만)
- 새 라우트 `app/(resident)/rb/[building]/[unit]/[period]/page.tsx`: params + `s` 읽어 `publicBillBySigned(...)` 호출 → **`BillDetailView mode="public"` 재사용**(이미 late_fee·검침 렌더) + `PublicTokenPageShell` 래핑. sig 무효/없음 → 기존 "유효하지 않은 링크" 상태.
- `hooks/reactquery/residentBilling/apis.ts`: `publicBillBySigned(building_id, unit_no, period, sig)` 추가 + 매핑(반환형 `PublicBillDetail` 재사용, `rowToPublicBillDetail` 재사용).
- `proxy.ts`: `/rb/*`를 **공개 경로**로 추가(로그인 미요구). 기존 `/r/[token]`이 어떻게 공개되는지 확인해 동일 패턴(정확·프리픽스 매칭 주의).
- (staff 링크 노출은 §5) — MVP는 RPC + 공개 라우트까지, staff UI "서명 링크 복사"는 후속 가능.
- 테스트: 신규 테스트 **금지**(정책). 기존 소비처만 갱신.

## 5. 열린 결정(구현 전 사용자 확인 — AskUserQuestion)
1. **만료/폐기**: 영구 vs 발급월+N개월(개별 폐기 불가 감수) vs denylist.
2. **건물 식별**: `building_id`(간단·안전) vs `public_slug` 신규 컬럼(예쁜 URL).
3. **staff 링크 생성 UI 위치**: bill 발행(/staff/bill)·영수(/staff/receipts)·건물(/staff/buildings) 중 어디에 "서명 링크 복사" — 또는 이번엔 RPC/라우트만.
4. **기존 토큰(/r/[token]) 병행 유지 vs 대체**.
5. **알림톡 봉투 링크**를 서명 URL로 전환할지(메시징 연동 = 범위 확장).

## 6. 마무리
tsc0·eslint0·vitest(기존)·(가능 시)next build → 커밋(`feat/resident-bill-signed-url`)·PR·머지·`git checkout master && git pull` → WBS(`세입자_관리비 상세고지서` fa79ce05, 버킷 9514ec1f, dev 진행중 유지) → PRD §3.2 무로그인 접근 서술 갱신.

## 데이터/환경 사실
- 작업 위치=**projects/home_erp**(master 체크아웃·node_modules·:3000). 마이그 적용=`node --env-file=.env.local scripts/db-query.mjs < 파일`(ref amhtprmapxlizdnsgbeg 가드). 다음 마이그=**0146**(⚠️0145는 resident_profile_image가 선점 — 커밋 전 origin/master max 재확인).
- 재사용 자산: `BillDetailView(mode="public")` · `PublicBillDetail`/`PublicBillItem` 타입 · `rowToPublicBillDetail` · `public_bill_by_token`의 SELECT(late_fee[0142/0143 동일 산식] + 항목 검침[meter_readings 0007] + 계좌·PII 제외 + 마스킹). `pgcrypto.hmac`.
- ⚠️ **classifier**: config/추론·secret DML은 에이전트 차단 → 사용자 `!` 직접 실행/승인. `next build`는 :3000 dev 충돌 + Turbopack이 워크트리 정션 거부 → tsc/lint/dev 컴파일로 대체(또는 dev 잠깐 중지).
- 관련 메모리: [[resident-app-screens-status]] · 보안 posture [[supabase-connection]](RLS 감사) · [[security-hardening-status]] · [[supabase-migration-apply-method]].

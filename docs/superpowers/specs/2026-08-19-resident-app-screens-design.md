# 세입자앱 기능화면 구현 스펙 (design contract)

> 온보딩(카카오 로그인→세대매칭)은 이미 완료. 이 문서는 그 위에 얹는 **실사용 기능화면 6종 + 무로그인 상세 + 퇴실신청**의 구현 계약이다.
> Claude(오케스트레이터)가 확정한 계약이며, codex 각 트랙이 이 문서를 읽고 구현한다. RPC 시그니처·컬럼·규칙은 **정본**이다.

## 0. 절대 제약 (위반 금지)
- **오직** 다음만 수정: `app/(resident)/**`, `hooks/reactquery/resident*` (신규 폴더 우선), `lib/resident/**`, `supabase/migrations/0040_*.sql`, `supabase/migrations/0041_*.sql`.
- **절대 금지**: `app/(staff)/**`, `app/(platform-admin)/**`, `app/globals.css`, 기존 `hooks/reactquery/residentClaims/**` 파일 변경(신규 폴더 추가만; 필요시 배럴 재수출은 새 폴더에서).
- **teal 스코프 유지**: 색/토큰은 `app/(resident)/_shell.module.css`의 CSS 변수(`--blue:#14A497` 등)와 클래스만 사용. 파랑(#3182F6) 추가 금지. 신규 화면·컴포넌트는 각자 `*.module.css`.
- **커밋하지 말 것** (Claude가 커밋). 무관한 변경 보존.
- Next.js 버전이 특수하니 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인(App Router, RSC/Client 경계).

## 1. 기존 기반 (그대로 재사용)
- 라우트: `app/(resident)/layout.tsx`(teal 셸 `.shell`/`.screen`), `resident/{login,auth,verify,pending,nomatch,notify,home}`. `home`은 placeholder → **본 스펙으로 재작성**.
- Supabase 클라이언트: `lib/supabase/client.ts` → `createClient()` (browser client). RPC 호출은 `createClient().rpc("fn", {args})`.
- 기존 훅: `hooks/reactquery/residentClaims/{apis,queries,mutations,keys,index}.ts`. **패턴을 그대로 모방**(apis=순수 RPC 래퍼, queries/mutations=React Query, keys=키 팩토리, index=배럴).
  - 재사용: `useResidentMyLink()` → `resident_my_link()` RPC = 로그인 세입자의 연결 세대(claim_id, org_id, building_id, building_name, unit_id, unit_no, occupancy_id, tenant_name, occupancy_phone, linked_at). **기능화면의 세대 해석에 이걸 사용**.
- 온보딩 클라 세션 facade `lib/resident/onboardingClient.ts`는 새로고침 시 소실 → **기능화면에서는 사용하지 말 것**. 대신 실제 Supabase 세션(`createClient().auth.getUser()`)과 `resident_my_link()`로 해석(새로고침 유지).
- 마이그 스타일: `supabase/migrations/0039_resident_claims.sql`을 참고(테이블/인덱스/RLS/RPC/GRANT/`SECURITY DEFINER`+`set search_path` 관례를 그대로 따를 것).

## 2. 읽어들일 기존 스키마 (수정 금지, 조회만)
- `occupancies`: id, unit_id, tenant_name, payer_name, phone, move_in_date, move_out_date, status, `transfer_method`('giro'|'transfer'|'auto_transfer'|'deposit'|'none'), `bill_delivery`('post'|'alimtalk'), `alimtalk_opt_in` bool, `sms_opt_in` bool, deleted_at …
- `fee_item_charges`: unit_id, fee_item_id, `period` date(=월초), occupancy_id, `amount` int, charged bool. UNIQUE(unit_id,fee_item_id,period).
- `fee_items`: id, name, sort_order. **카테고리 컬럼 없음 → 상세 항목은 sort_order 평면 목록**.
- `billing_confirmations`: unit_id, `period` date(월초), occupancy_id, `total_amount` int, confirmed_at. UNIQUE(unit_id,period). = "부과 확정된 달".
- `billing_history`: unit_id, period, occupancy_id, tenant_name, total_amount, `items` jsonb(=[{fee_item_id,name,amount,charged}]), confirmed_at. (최신 스냅샷 = ORDER BY confirmed_at DESC LIMIT 1)
- `payments`: unit_id, `period` date(월초), occupancy_id, `amount` int(>0), status('active'|'canceled'), paid_at, method, kind. **납부액 = SUM(amount) FILTER(status='active')**.
- `bill_issues`: unit_id, period, `due_date` date, issue_type, issued_at. (납기일 = 최신 issued_at 행의 due_date)
- `notices`: id, org_id, building_id(NULL=조직전체), title, content, `notice_type`('normal'|'important'|'urgent'), published_at, expires_at, deleted_at. UI 뱃지: normal→일반, important→중요, urgent→긴급.
- `setup_config` (org 단위 입금계좌): org_id, `mgmt_bank1`, `mgmt_acct1`, `mgmt_holder1`, mgmt_print1 … = 관리비 입금계좌(복사 버튼용).
- `organizations`: id, name (= 관리업체/관리사 명).
- `buildings`: id, org_id, name. `units`: id, building_id, unit_no.
- org 스코프 헬퍼(참고): `current_user_org()`, `my_org_ids()`, `current_user_has_module(text)`.

## 3. 신규 DB — 마이그 0040 (bill_share_tokens + RPC)
> `SECURITY DEFINER`, `set search_path = public, pg_temp`(0039 관례 확인 후 일치). resident_* 는 `revoke ... from anon, public; grant execute ... to authenticated`. public_* 만 `grant ... to anon, authenticated`.

### 3.1 내부 헬퍼
`resident_linked_unit()` (SECURITY DEFINER) → 단일행 (org_id bigint, building_id bigint, unit_id bigint, occupancy_id bigint, move_in date, move_out date, tenant_name text). `res_claims rc JOIN occupancies/units/buildings` where `rc.resident_user_id=auth.uid() AND rc.status='linked'` LIMIT 1. 다른 resident_* 가 재사용.

### 3.2 테이블 `bill_share_tokens`
```
id bigint generated always as identity pk
token uuid not null unique default gen_random_uuid()
org_id bigint not null references organizations(id) on delete cascade
unit_id bigint not null references units(id) on delete cascade
period date not null check (period = date_trunc('month', period)::date)
created_by uuid references auth.users(id) on delete set null
expires_at timestamptz not null
created_at timestamptz not null default now()
unique (unit_id, period)
```
RLS enable. **직접 접근 정책 없음**(정의자 RPC로만). platform admin select 정책은 선택(생략 가능).

### 3.3 RPC (정본 시그니처)
- `resident_bill_months()` RETURNS TABLE(period date, total_amount int, paid_amount int, unpaid_amount int, pay_status text, due_date date, confirmed_at timestamptz)
  - 연결 unit의 `billing_confirmations` 각 달. **입주기간 한정**: period >= date_trunc('month',move_in) AND (move_out IS NULL OR period <= date_trunc('month',move_out)). paid=Σactive payments(unit,period). unpaid=GREATEST(total-paid,0). pay_status: paid(unpaid=0 & total>0) / partial(0<paid<total) / unpaid(paid=0 & total>0) / none(total=0). due_date=최신 bill_issues. ORDER BY period DESC.
- `resident_bill_detail(p_period date)` RETURNS TABLE(period date, building_name text, unit_no text, tenant_name text, total_amount int, paid_amount int, unpaid_amount int, due_date date, confirmed_at timestamptz, items jsonb, mgmt_bank text, mgmt_acct text, mgmt_holder text)
  - 연결 unit + 입주기간 검증. items = billing_history 최신 스냅샷의 items; 없으면 fee_item_charges JOIN fee_items(charged=true) 로 [{fee_item_id,name,amount,charged}] 구성(sort_order). 계좌 = setup_config.mgmt_(bank|acct|holder)1.
- `resident_get_or_create_bill_token(p_period date)` RETURNS uuid
  - 연결 unit + 입주기간 + 확정 존재 검증. bill_share_tokens UPSERT(unit_id,period): expires_at = now()+interval '1 year'(재호출 시 갱신). token 반환.
- `public_bill_by_token(p_token uuid)` RETURNS TABLE(period date, building_name text, unit_no text, total_amount int, paid_amount int, unpaid_amount int, due_date date, items jsonb, mgmt_bank text, mgmt_acct text, mgmt_holder text, expires_at timestamptz, is_expired boolean)
  - **auth.uid() 사용 금지**(무로그인). 토큰 미존재→0행(무효 링크). 존재하면 is_expired=(expires_at<=now()); 만료면 금액/항목/계좌 필드 NULL로(누출 방지) building_name/unit_no/period/expires_at/is_expired만. 유효면 전체. **items는 [{name,amount}]만(fee_item_id·세입자 PII 제외)**. GRANT EXECUTE TO anon, authenticated.
- `resident_notices()` RETURNS TABLE(id bigint, title text, notice_type text, building_id bigint, building_name text, published_at timestamptz, created_at timestamptz)
  - org_id=내org AND (building_id IS NULL OR building_id=내building) AND published_at IS NOT NULL AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>now()). ORDER BY published_at DESC.
- `resident_notice_detail(p_id bigint)` RETURNS TABLE(id bigint, title text, content text, notice_type text, building_id bigint, building_name text, published_at timestamptz, created_at timestamptz) — 동일 스코프. 스코프 밖이면 0행.
- `resident_get_profile()` RETURNS TABLE(tenant_name text, phone text, building_name text, unit_no text, move_in_date date, org_id bigint, org_name text, transfer_method text, bill_delivery text, alimtalk_opt_in bool, sms_opt_in bool, linked_at timestamptz)
- `resident_set_notify_prefs(p_alimtalk boolean default null, p_sms boolean default null)` RETURNS void — 연결 occupancy의 alimtalk_opt_in/sms_opt_in을 제공된 값만 갱신.

## 4. 신규 DB — 마이그 0041 (move_out_requests + RPC)
### 4.1 테이블 `move_out_requests`
```
id bigint generated always as identity pk
org_id bigint not null references organizations(id) on delete cascade
resident_user_id uuid not null references auth.users(id) on delete cascade
occupancy_id bigint references occupancies(id) on delete set null
unit_id bigint references units(id) on delete set null
building_id bigint references buildings(id) on delete set null
desired_date date not null
reason text
status text not null default 'pending' check (status in ('pending','confirmed','canceled','rejected'))
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
canceled_at timestamptz
resolved_at timestamptz
resolved_by uuid references auth.users(id) on delete set null
```
- UNIQUE partial: `create unique index move_out_one_pending_per_resident on move_out_requests(resident_user_id) where status='pending'`.
- 인덱스: (org_id,status), (resident_user_id).
- RLS: resident=select/insert/update own(insert는 pending, update는 status='pending'일 때만); staff=select/update if org_id in my_org_ids() AND current_user_has_module('tenants'); platform admin select all. updated_at 트리거(0039/기존 관례 따름).

### 4.2 RPC
- `resident_create_move_out(p_desired_date date, p_reason text default null)` RETURNS bigint — 연결 컨텍스트 해석; 이미 pending 존재하면 EXCEPTION(프론트가 잡아 기존 내역 표시). pending insert 후 id 반환.
- `resident_get_move_out()` RETURNS TABLE(id bigint, desired_date date, reason text, status text, created_at timestamptz, updated_at timestamptz, canceled_at timestamptz, resolved_at timestamptz) — 최신 1건(created_at desc).
- `resident_update_move_out(p_desired_date date)` RETURNS void — 내 pending 요청 desired_date 갱신; 없으면 EXCEPTION.
- `resident_cancel_move_out()` RETURNS void — 내 pending 요청 status='canceled', canceled_at=now(); 없으면 EXCEPTION.
> staff측 퇴실요청 리뷰 화면/알림톡 발송은 이번 범위 밖(후속). 요청 생성/조회/변경/취소만.

## 5. 프론트엔드 (트랙 2·3)
### 공통
- 훅: `hooks/reactquery/residentBilling|residentNotices|residentProfile|residentMoveOut/{apis,queries,mutations,keys,index}.ts` (residentClaims 패턴 모방).
- **가드**: 기능화면 공용 훅 `useResidentGuard()` (lib/resident 또는 훅 폴더) — mount 시 `createClient().auth.getUser()` null이면 `router.replace('/resident/login')`; 아니면 `useResidentMyLink()`로 세대; linked 없으면 `/resident/verify`로. `r/[token]`은 가드 없음(공개).
- **바텀탭** `app/(resident)/_components/BottomNav.tsx` (홈/관리비/내정보 3탭, `usePathname` active, teal). notice·bill/[period]·r/[token]엔 바텀탭 상황 맞게.
- 상태 처리(PRD §4): 로딩 인디케이터, 빈상태("부과 내역이 없어요"/"등록된 내용이 없습니다"), 에러+재시도.
- 금액은 천단위 콤마 + "원".

### 화면별 (프로토타입 = 디자인 정본)
프로토타입 URL(참고, codex는 접속 불가 — 아래 요약대로 구현):
`https://staging.d2h12382xiksft.amplifyapp.com/resident/<name>/<name>.dc.html` (name: resident-home, resident-bill, resident-bill-detail, resident-notice, resident-notice-detail, resident-me)

1. **홈** `resident/home` (재작성)
   - 헤더: "건물명 호실" + "이름 님" + 관리업체명(org_name).
   - 미납/당월 카드: 최근달(bill_months[0]) 미납액 + 납기일 + 당월 부과액. (연체료는 v1 제외)
   - 3개월 추이: 최근 3~6개월 부과액 미니 막대/목록.
   - 최신 공지 배너: resident_notices()[0] → 탭 시 `resident/notice/[id]`.
   - "상세 내역 보기" → `resident/bill` (또는 최근달 `resident/bill/[period]`).
   - **퇴실신청 섹션**(§4): 요청 없음→희망일 캘린더+사유(선택)+"퇴실 신청하기"+확인모달("퇴실 신청이 접수됐어요"); pending→"담당자가 확인 중이에요"+희망일 변경+신청 취소(취소 경고 모달); confirmed/canceled/rejected→해당 상태 안내.
   - 바텀탭.
2. **관리비 내역** `resident/bill`
   - 상단 요약: (선택 연도) 합계, 월 평균, 미납 총합 — bill_months 집계.
   - 월별 목록: 각 행 = period(YYYY.MM), 부과액, 납부상태 뱃지(완납/부분/미납), 미납액 → 탭 `resident/bill/[period]`.
   - 빈상태 "부과 내역이 없어요". 바텀탭.
3. **관리비 상세(로그인)** `resident/bill/[period]`
   - `useResidentBillDetail(period)`. 공용 컴포넌트 `BillDetailView` 렌더: 건물/호실, 기간, 합계/납부/미납, 납기, 항목 목록(items), 입금계좌.
   - 버튼: **계좌 복사**=`"{mgmt_bank} {mgmt_acct}"`, **계좌·금액 복사**=`"{mgmt_bank} {mgmt_acct} {미납액 또는 합계}원"`(콤마) — 복사 후 토스트.
   - "무로그인 링크 복사/공유": `resident_get_or_create_bill_token(period)` 민트 → `${origin}/r/${token}` 복사.
4. **관리비 상세(무로그인)** `r/[token]` (가드 없음, 공개)
   - `usePublicBillByToken(token)`. 0행→"유효하지 않은 링크"; is_expired→"만료된 링크입니다"; 유효→`BillDetailView`(공개 모드, **세입자 이름/전화 미표시**) + 계좌 복사 버튼 + CTA "관리비서 시작하기"→`/resident/login`.
5. **공지 목록** `resident/notice` — 목록(제목/일자/유형뱃지) → `resident/notice/[id]`. 빈상태 "등록된 내용이 없습니다". 로그인 전용.
6. **공지 상세** `resident/notice/[id]` — 제목, 유형뱃지, "YYYY.MM.DD·건물명", 본문(줄바꿈 보존). 뒤로가기.
7. **내 정보** `resident/me`
   - 프로필: 이름, 전화, 로그인=카카오 간편로그인.
   - 세대: 건물/호실, 입주일(move_in_date), 관리업체(org_name). transfer_method='auto_transfer'면 "자동이체 세대" 표시.
   - **알림 토글**(저장): 카카오(alimtalk_opt_in)·문자(sms_opt_in) → `resident_set_notify_prefs` 뮤테이션(낙관적 갱신). 끄면 "관리비 확정 안내를 못 받을 수 있어요" 경고.
   - 퇴실신청 진입: 홈과 동일한 공용 `MoveOutSection`/모달 재사용.
   - 약관/개인정보 링크: `resident/terms`, `resident/privacy` (간단 정적 페이지 신설, 플레이스홀더 문구 OK).
   - 로그아웃: 확인 모달 → `createClient().auth.signOut()` + onboardingClient 초기화(있으면) → `/resident/login`.
   - 회원탈퇴 링크: UI만(실 삭제는 stub, 주석으로 후속 표기).
   - 바텀탭.

### 공용 컴포넌트
- `BillDetailView`(정규화된 상세객체 입력, authed/public 모드), `BottomNav`, `MoveOutSection`(폼/상태/모달), `CopyButton`(클립보드+토스트 유틸).

## 6. 검증
- codex: `npx tsc --noEmit`, `npx vitest run`(신규 훅/페이지 테스트 추가 — 기존 residentClaims 테스트·`page.test.tsx` 패턴 모방), `npm run lint`. `next build`는 오프라인 실패 가능 → 시도하되 불가시 명시.
- Claude가 최종 `next build` 및 라이브 DB 적용 담당.

## 7. 트랙 분할
- **T1**: 마이그 0040 + 0041 (SQL만). 0039 스타일 준수. (Claude 리뷰 후 라이브 적용)
- **T2**: residentBilling 훅 + useResidentGuard + BottomNav + CopyButton + BillDetailView + `resident/bill` + `resident/bill/[period]` + `r/[token]` + 테스트.
- **T3**: residentNotices/Profile/MoveOut 훅 + `resident/notice`·`notice/[id]` + `resident/me`(+terms/privacy) + `resident/home` 재작성(퇴실·공지배너·추이) + MoveOutSection + 테스트. (T2의 BottomNav/guard/BillDetail·residentBilling 재사용)

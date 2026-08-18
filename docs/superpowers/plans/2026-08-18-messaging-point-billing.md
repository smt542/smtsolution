# P4-point 메시지 포인트 과금 기반 Implementation Plan

> **상태:** implemented · 2026-08-18
> **정본:** `docs/superpowers/specs/2026-08-18-messaging-point-billing-design.md`
> **화면 PRD:** `docs/prototype/prd/messaging.md`
> **DB 적용:** `amhtprmapxlizdnsgbeg` · `0033`~`0037` 적용·검증 완료
> **선행 구현:** 메시징 `0010`·`0030`, 플랫폼 포인트 `0011`·`0035`

**Goal:** 실제 provider가 아직 없는 상태에서 메시지 발송의 채널별 포인트 단가·서버 견적·가용 잔액·예약·성공분 정산 기반을 만들고, stub은 비과금으로 유지한다.

**Architecture:** 포인트 원장의 source of truth는 계속 `sum(point_transactions.points)`다. 모든 포인트 쓰기는 조직 행 `FOR UPDATE` 잠금을 잡는 보안 RPC로 일원화한다. 활성 예약은 원장에 기록하지 않고 `message_point_reservations`에서 가용 잔액만 점유한다. 견적은 안내이며 예약 RPC가 잠금 안에서 재검증한다. 현재 `send_messages` stub은 견적 스냅샷만 로그에 남기고 usage를 만들지 않는다.

**Tech Stack:** PostgreSQL/Supabase RPC·RLS, Next.js 16 App Router, TypeScript, React Query, react-hook-form+zod, Vitest/RTL.

---

## Global Constraints

- 구현 전 본 plan과 정본 spec, `docs/prototype/prd/messaging.md`를 함께 읽는다.
- Next.js Route Handler는 provider 후속 범위다. 후속 구현 전 `node_modules/next/dist/docs/`의 Route Handler 문서를 다시 확인한다.
- 마이그레이션 번호는 `origin/master` 및 원격 이력과 대조해 `0036`·`0037`로 확정했다.
- **stub 비과금:** 이번 plan에서 실제 `usage`는 테스트용 `settle_message_points` 호출 외에는 생성되지 않는다.
- **기존 API 하위호환:** `send_messages` 5-arg 시그니처와 `{log_id,count}` 반환을 유지한다. 추가 필드는 허용하되 기존 호출자는 깨지지 않는다.
- **서버 권위:** 클라이언트의 `recipient.channel`, 예상 건수, 예상 포인트를 신뢰하지 않는다. DB가 전화번호 정규화·중복 제거·알림톡 동의를 다시 계산한다.
- **원장 append-only:** `point_transactions` UPDATE/DELETE를 허용하지 않는다. 취소·보정은 새 원장행 또는 예약 해제로 처리한다.
- **잠금 순서:** 모든 포인트 변경/예약/정산은 항상 `organizations` 행 잠금 → 잔액/예약 조회 → 쓰기 순서다.
- **예약 자동 해제 금지:** `expires_at` 경과만으로 가용 잔액에서 제외하거나 자동 해제하지 않는다.
- **단가 v1:** SMS 1P, 알림톡 1P 초기값. 조직별 단가·SMS/LMS/MMS 구분은 범위 밖.
- 신규 `security definer` 함수는 `set search_path = ''`와 `public.<object>` 완전 수식자를 사용한다. `public`/`anon` EXECUTE를 revoke한다.
- 신규 테이블은 RLS를 활성화한다. 일반 클라이언트 직접 쓰기 정책을 만들지 않는다.
- 새 패키지와 새 환경변수는 없다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `supabase/migrations/0036_point_ledger_safety_rates.sql` | 단가 이력, 포인트 쓰기 RPC, append-only 정책, 조직별 잔액 RPC |
| `supabase/migrations/0037_message_point_reservations.sql` | 견적·예약·정산, message_logs/point_transactions 연결, stub 견적 기록 |
| `supabase/verify/p4_point_checks.sql` | 스키마·함수·권한·원장·견적·정산 검증 |
| `hooks/reactquery/messaging/apis.ts` | 포인트 견적 타입·RPC 매퍼, MessageLog 과금 필드 |
| `hooks/reactquery/messaging/{keys,queries}.ts` | 견적 쿼리 키·훅 |
| `app/(staff)/staff/messaging/components/MessagePointQuoteCard.tsx` | 가용잔액·채널별 예상비용·stub 안내 |
| `app/(staff)/staff/messaging/components/MessagingComposer.tsx` | 견적 연결·확인 문구·상태 처리 |
| `hooks/reactquery/platform/pointBilling.ts` | 단가·가용잔액·예약 조회/수정 API |
| `hooks/reactquery/platform/{keys,queries,mutations,index}.ts` | platform point-billing 훅 노출 |
| `components/forms/schema/messagePointRates.ts` | SMS/알림톡 단가 zod 스키마 |
| `app/(platform-admin)/platform-admin/points/components/PointRateModal.tsx` | 전역 단가 수정 |
| `app/(platform-admin)/platform-admin/points/components/PointReservationAlerts.tsx` | 장기·확인필요 예약 및 수동 해제 |
| `app/(platform-admin)/platform-admin/points/page.tsx` | 단가 카드, 원장/예약/가용 잔액 표시 |

관련 `.test.ts(x)`는 각 소스 옆에 둔다.

---

## Task 1: `0036` 원장 안전화 + 전역 단가

**Files**

- Create: `supabase/migrations/0036_point_ledger_safety_rates.sql`
- Modify: `hooks/reactquery/platform/apis.ts`
- Modify: `hooks/reactquery/platform/apis.test.ts`

### 1.1 마이그레이션 선점 확인

- `git fetch origin` 후 로컬·`origin/master`의 `supabase/migrations/*.sql` 최대 번호를 확인한다.
- `0036`이 선점됐으면 두 파일 번호를 함께 다음 빈 번호로 이동하고 spec/plan의 잠정 번호를 갱신한다.

### 1.2 실패 테스트 — 플랫폼 포인트 쓰기 RPC 전환

`hooks/reactquery/platform/apis.test.ts`에서 기존 `.from("point_transactions").insert(...)` 기대를 다음 RPC 계약으로 바꾼다.

```ts
chargePoints(input)
  -> rpc("platform_record_point_charge", {
       p_org_id, p_points, p_amount_krw, p_memo
     })

adjustPoints(input)
  -> rpc("platform_record_point_adjustment", {
       p_org_id, p_kind, p_points, p_amount_krw, p_memo
     })
```

검증 케이스:

- charge가 양수 정수·0 이상 결제액만 RPC에 전달.
- correction은 ± 허용, deduction/refund는 음수만 허용.
- memo trim·필수 규칙 유지.
- RPC `{ok:false,code:'POINTS_RESERVED'}`를 사용자용 오류로 변환.
- Supabase error 전파.

Expected: 기존 구현이 direct insert라 실패.

### 1.3 `message_point_rates`

- 정본 spec §4.1 테이블·활성행 unique partial index 생성.
- 초기 활성행 `sms=1`, `alimtalk=1`을 idempotent하게 삽입.
- RLS 활성화, 직접 정책 없음.
- `platform_list_message_point_rates(p_include_history boolean default false)`:
  - platform_admin만.
  - 현재값 또는 전체 이력을 `effective_from desc`로 반환.
- `platform_set_message_point_rates(p_sms_points int, p_alimtalk_points int)`:
  - platform_admin만, 두 값 모두 양수 정수.
  - 두 채널을 한 트랜잭션에서 원자적으로 버전 교체.
  - 값이 동일한 채널은 새 버전을 만들지 않는다.
  - `audit_log`에 전/후 단가 기록.

### 1.4 포인트 쓰기 RPC + append-only

`platform_record_point_charge`와 `platform_record_point_adjustment` 공통 규칙:

1. platform_admin 검증.
2. 대상 조직 존재 확인 후 `organizations ... FOR UPDATE`.
3. 서버에서 입력·부호·memo 검증.
4. `auth.uid()`를 `created_by`로 INSERT.
5. 결과 `{ok:true, transaction_id}`.

조정 RPC 추가 규칙:

- `kind` 라벨을 서버에서 `[정정]`/`[차감]`/`[환불]`로 prefix.
- 음수 조정 전 활성 예약 합계와 조정 후 원장 잔액을 비교한다.
- 예약을 침범하면 `{ok:false,code:'POINTS_RESERVED',ledger_balance,reserved_points}` 반환, INSERT 없음.

RLS 변경:

- 기존 `pt_platform for all` 제거.
- platform_admin SELECT 정책만 생성.
- 일반 클라이언트 INSERT/UPDATE/DELETE 정책 없음.
- 두 쓰기 RPC만 `authenticated` EXECUTE 허용.

### 1.5 조직별 잔액 RPC

`platform_list_point_balances()` 반환:

```text
org_id, ledger_balance, reserved_points, available_points
```

`0036` 시점에는 예약 테이블이 아직 없으므로 `reserved_points=0`, `available_points=ledger_balance`로 반환한다. `0037`에서 같은 반환형을 유지한 채 body만 교체한다.

### 1.6 클라이언트 구현

- `chargePoints`/`adjustPoints`를 RPC 호출로 교체.
- 현재 TS 입력 검증을 유지하여 빠른 피드백을 제공하되 DB 검증을 권위로 둔다.
- RPC 구조화 오류를 `POINTS_RESERVED` 등 안정적인 코드로 매핑한다.
- React Query mutation 시그니처와 기존 모달 계약은 변경하지 않는다.

### 1.7 검증·커밋

```powershell
npx.cmd vitest run hooks/reactquery/platform/apis.test.ts
npx.cmd tsc --noEmit
```

커밋 제안:

```text
feat(points): 원장 쓰기 RPC·채널 단가 기반 추가
```

---

## Task 2: `0037` 견적·예약·정산 엔진

**Files**

- Create: `supabase/migrations/0037_message_point_reservations.sql`
- Create: `supabase/verify/p4_point_checks.sql`

### 2.1 스키마

- `message_point_reservations`를 정본 spec §4.2대로 생성.
- reservation 상태가 바뀔 때 `updated_at`을 자동 갱신하는 trigger를 추가.
- `point_transactions`에 `message_log_id`, `reservation_id`와 usage partial unique index 추가.
- `message_logs`에 `estimated_points`, `charged_points`, `point_status` 추가.
- `message_logs.result` check를 `stub|queued|sent|partial|failed`로 확장.
- 과거 로그는 `estimated_points=0`, `charged_points=0`, `point_status='none'`.
- 예약 테이블 RLS 활성화. platform_admin SELECT만 허용하고 직접 쓰기 없음.

### 2.2 내부 라우팅·견적 함수

중복 SQL을 피하기 위해 외부 EXECUTE 권한이 없는 내부 함수 하나가 다음을 수행한다.

- 입력: `org_id`, `mode`, `recipients`, `template_id`.
- 전화번호 숫자 정규화, 빈 번호 제외, 정규화 번호 기준 첫 항목만 유지.
- 대상 occupancy가 org 소속인지 확인.
- 서버의 최신 `alimtalk_opt_in`으로 실제 채널 결정.
- alimtalk 전용 미동의자 제외, owner/staff는 SMS.
- 채널별 활성 rate row를 읽어 rate id/points snapshot 생성.
- 반환: resolved recipients, excluded count, channel counts, rate snapshot, estimated points.

`renderedBody`는 stub 기간 동안 기존 계약을 유지하지만 과금 계산에는 사용하지 않는다.

### 2.3 `quote_message_points`

```text
quote_message_points(p_mode text, p_recipients jsonb, p_template_id bigint default null)
```

- 현재 사용자 org와 `messaging` 모듈 권한 확인.
- 내부 견적 함수 호출.
- `ledger_balance`, 활성 예약, `available`, `sufficient` 계산.
- `billing_mode='stub'` 반환.
- 입력 검증 실패와 단가 없음은 `{ok:false,code,...}`.

### 2.4 `send_messages` stub 확장

- 기존 5-arg 함수와 `{log_id,count}`를 유지.
- 내부 견적 함수를 재사용하여 채널을 서버 재판정.
- message_logs에 `estimated_points`, `point_status='quoted'`, `result='stub'` 기록.
- **예약·usage INSERT 없음**.
- 반환에 `estimated_points`, `billing_mode='stub'`를 추가하되 기존 필드는 유지.

### 2.5 서버 전용 예약 RPC

```text
reserve_message_points(
  p_org_id bigint,
  p_requested_by uuid,
  p_idempotency_key uuid,
  p_payload_hash text,
  p_mode text,
  p_body text,
  p_context text,
  p_recipients jsonb,
  p_template_id bigint,
  p_confirmed_rate_ids jsonb,
  p_confirmed_points int
)
```

- EXECUTE는 server/service role에만 허용.
- `p_requested_by`가 대상 active org의 활성 구성원이고 owner/platform_admin 또는 `messaging` 권한인지 명시적으로 검증.
- 조직 행 잠금 후 내부 견적과 가용 잔액 재계산.
- 같은 멱등키:
  - hash 동일 → 기존 예약·로그 결과 반환.
  - hash 다름 → `IDEMPOTENCY_CONFLICT`.
- 확인 rate/points 불일치 → `QUOTE_CHANGED`와 새 견적 반환.
- 잔액 부족 → `INSUFFICIENT_POINTS`, 쓰기 없음.
- 성공 → `message_logs(result='queued',point_status='reserved')`와 reservation을 같은 트랜잭션에서 생성.
- 기본 `expires_at=now()+15 minutes`; 자동 해제에는 사용하지 않음.

### 2.6 서버 전용 정산 RPC

```text
settle_message_points(
  p_reservation_id bigint,
  p_provider_request_id text,
  p_results jsonb
)
```

- 예약 org 행 잠금.
- 예약 recipient snapshot과 결과 recipient key를 대조하고 알 수 없는 결과 거부.
- 성공 수신자 snapshot 단가만 합산.
- 성공 > 0: message_log당 usage 한 행 INSERT, 예약 `settled`.
- 일부 성공: log `partial`; 전원 성공: `sent`; 전원 실패: 예약 `released`, log `failed`, usage 없음.
- 중복 호출은 기존 정산 결과 반환.
- provider 상태 불명확 입력은 `reconcile_required`, 예약 점유 유지.

### 2.7 운영 RPC

- `platform_list_point_balances()`를 활성 예약 포함 구현으로 교체.
- `platform_list_point_reservations(p_status text default null)`:
  - platform_admin만, org 이름·예약/확정 포인트·상태·나이·만료·로그 id·요청자.
- `platform_release_stale_reservation(p_id bigint,p_reason text)`:
  - platform_admin, reason 필수.
  - `reconcile_required` 또는 만료된 `reserved`만.
  - 조직 잠금, usage 없는지 재검증, `released` 전환, 감사로그.

### 2.8 SQL 검증

`supabase/verify/p4_point_checks.sql`에서 최소 다음을 검사한다.

- 신규 테이블·컬럼·check·unique index 존재.
- rate 활성행 채널당 1개.
- point_transactions 직접 쓰기 policy 없음.
- 함수 `search_path`·proconfig와 EXECUTE 권한.
- quote의 auto/SMS/alimtalk 라우팅과 단가 합계.
- 예약 경계값, 멱등, 부분/전원 실패 정산, message_log당 usage 1행.
- 음수 수동조정이 활성 예약을 침범하면 거부.
- 타 org·권한 없는 사용자 접근 거부.

별도 test DB에서 두 세션으로 같은 org 예약을 동시에 호출해 합계가 잔액을 넘지 않는지 확인한다. 단일 트랜잭션 verify SQL만으로 동시성을 통과했다고 간주하지 않는다.

커밋 제안:

```text
feat(messaging): 포인트 견적·예약·성공분 정산 엔진 추가
```

---

## Task 3: 메시징 데이터 계층 + 견적 UI

**Files**

- Modify: `hooks/reactquery/messaging/apis.ts`
- Modify: `hooks/reactquery/messaging/apis.test.ts`
- Modify: `hooks/reactquery/messaging/keys.ts`
- Modify: `hooks/reactquery/messaging/queries.ts`
- Create: `app/(staff)/staff/messaging/components/MessagePointQuoteCard.tsx`
- Create: `app/(staff)/staff/messaging/components/MessagePointQuoteCard.test.tsx`
- Modify: `app/(staff)/staff/messaging/components/MessagingComposer.tsx`
- Modify: `app/(staff)/staff/messaging/components/MessagingComposer.test.tsx`
- Modify: `app/(staff)/staff/messaging/components/MessageLogList.tsx`
- Modify: relevant page/history tests

### 3.1 실패 테스트 — API 매퍼

정확한 공개 타입:

```ts
export interface QuoteMessagePointsInput {
  mode: SendMode;
  recipients: MessageRecipient[];
  templateId: number | null;
}

export interface MessagePointQuote {
  recipientCount: number;
  excludedCount: number;
  channelCounts: { sms: number; alimtalk: number };
  rateSnapshot: {
    sms: { rateId: number; points: number };
    alimtalk: { rateId: number; points: number };
  };
  ledgerBalance: number;
  reservedPoints: number;
  availablePoints: number;
  estimatedPoints: number;
  sufficient: boolean;
  billingMode: "stub" | "live";
}
```

테스트:

- `quoteMessagePoints` RPC 인자 snake_case와 응답 camelCase.
- `{ok:false,code:'RATE_NOT_CONFIGURED'}` 구조화 오류.
- `sendMessages`가 확장 응답의 `estimated_points/billing_mode`를 매핑하면서 `logId/count` 유지.
- `listMessageLogs`가 `estimatedPoints`, `chargedPoints`, `pointStatus` 매핑.

### 3.2 query key·hook

- `messagingKeys.pointQuote(input)` 추가. React Query의 stable object hashing을 사용한다.
- `useMessagePointQuote(input | null)` 추가, 유효 수신처가 있을 때만 enabled.
- 견적은 body 내용과 무관하므로 본문 타이핑에는 재요청하지 않는다.

### 3.3 `MessagePointQuoteCard`

표시:

- SMS `n건 × xP`, 알림톡 `n건 × yP`.
- 예상 차감, 원장 잔액, 예약, 가용 잔액, 예상 발송 후 잔액.
- excludedCount가 있으면 제외 안내.
- stub이면 “테스트 발송 — 실제 전송 및 포인트 차감 없음”.
- live+부족이면 danger 상태와 필요/가용 포인트.
- 로딩·오류·단가 미설정 상태.

### 3.4 Composer 연결

- client preview는 기존 시각 표시용으로 유지.
- 견적 입력은 `validRecipientList` 원본을 전달하고 채널·건수는 서버 응답을 권위로 사용.
- 확인문:
  - stub: `N명 · 예상 X P (테스트 모드에서는 차감 없음)`.
  - live: `N명 · X P가 차감됩니다`.
- live에서 quote 없음/오류/잔액 부족이면 발송 차단.
- stub에서는 잔액 부족이어도 비과금이므로 발송 가능하되 배너를 반복 노출.
- 기존 preset·템플릿·수신처·발송 결과 동작 회귀 금지.

### 3.5 이력 표시

- stub: `예상 X P · 차감 없음`.
- settled usage: `차감 X P`.
- reserved/reconcile_required: 상태 배지.
- 기존 채널·context 필터 유지.

### 3.6 검증·커밋

```powershell
npx.cmd vitest run hooks/reactquery/messaging "app/(staff)/staff/messaging"
npx.cmd tsc --noEmit
npx.cmd eslint "hooks/reactquery/messaging" "app/(staff)/staff/messaging"
```

커밋 제안:

```text
feat(messaging): 발송 포인트 견적·stub 비과금 UI 추가
```

---

## Task 4: 플랫폼 단가·가용잔액·예약 운영 UI

**Files**

- Create: `hooks/reactquery/platform/pointBilling.ts`
- Create: `hooks/reactquery/platform/pointBilling.test.ts`
- Modify: `hooks/reactquery/platform/apis.ts`
- Modify: `hooks/reactquery/platform/apis.test.ts`
- Modify: `hooks/reactquery/platform/keys.ts`
- Modify: `hooks/reactquery/platform/queries.ts`
- Modify: `hooks/reactquery/platform/mutations.ts`
- Modify: `hooks/reactquery/platform/index.ts`
- Create: `components/forms/schema/messagePointRates.ts`
- Create: `app/(platform-admin)/platform-admin/points/components/PointRateModal.tsx`
- Create: `app/(platform-admin)/platform-admin/points/components/PointRateModal.test.tsx`
- Create: `app/(platform-admin)/platform-admin/points/components/PointReservationAlerts.tsx`
- Create: `app/(platform-admin)/platform-admin/points/components/PointReservationAlerts.test.tsx`
- Modify: `app/(platform-admin)/platform-admin/points/page.tsx`

### 4.1 플랫폼 API 타입·테스트

```ts
export interface MessagePointRate {
  id: number;
  channel: "sms" | "alimtalk";
  pointsPerRecipient: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface PlatformPointReservation {
  id: number;
  orgId: number;
  organizationName: string;
  messageLogId: number;
  status: "reserved" | "settled" | "released" | "reconcile_required";
  reservedPoints: number;
  chargedPoints: number;
  expiresAt: string;
  createdAt: string;
}
```

- 단가 list/set, 예약 list/release 매퍼 테스트.
- 구조화 오류 코드 매핑.
- `PlatformOrganization`에 `reservedPoints`, `availablePoints` 추가.
- `listPlatformOrganizations`의 point_transactions 직접 합산을 `platform_list_point_balances` 결과 결합으로 교체.

### 4.2 query/mutation

- keys: `pointRates`, `pointReservations`.
- queries: `useMessagePointRates`, `usePlatformPointReservations`.
- mutations: `useSetMessagePointRates`, `useReleasePointReservation`.
- 단가 변경 성공 시 rate+messaging quote 캐시 무효화.
- 충전·조정 성공 시 organizations/transactions/reservations 관련 캐시 무효화.

### 4.3 단가 폼·모달

- zod: SMS/알림톡 각 양의 정수.
- 현재 두 단가를 한 폼에서 수정하고 한 RPC로 원자 저장.
- “실제 provider 활성화 전 운영 단가를 확인” 안내.
- 변경 전→후와 즉시 적용 경고를 확인문에 표시.
- 성공 후 toast·닫기·새 단가 refetch.

### 4.4 포인트 페이지

- 상단 단가 카드: SMS, 알림톡, 적용시각, 수정 버튼.
- 조직 표: `원장 잔액`, `예약`, `가용 잔액` 세 열.
- 원장 내역은 기존 충전/사용/조정 뱃지 유지.
- active reservation 또는 reconcile_required가 있을 때만 `PointReservationAlerts` 표시.

### 4.5 예약 해제 안전장치

- 해제 버튼은 `reconcile_required` 또는 만료된 `reserved`에만 표시.
- 필수 사유 입력 + “provider 상태 확인 완료” 확인 체크.
- RPC가 최종 권위로 상태·usage 부재를 재검증.
- 성공 후 balances/reservations/organizations 캐시 무효화.

### 4.6 검증·커밋

```powershell
npx.cmd vitest run hooks/reactquery/platform "app/(platform-admin)/platform-admin/points"
npx.cmd tsc --noEmit
npx.cmd eslint "hooks/reactquery/platform" "app/(platform-admin)/platform-admin/points"
```

커밋 제안:

```text
feat(platform-admin): 발송 단가·예약·가용 포인트 운영 UI
```

---

## Task 5: 통합 검증·롤아웃 문서·WBS

### 5.1 설계 수용 기준 대조

- 조직별 포인트 풀 유지.
- 전역 채널별 단가와 버전 이력.
- stub 비과금·과거 stub 소급 없음.
- 서버 견적과 UI 표시.
- live 예약 RPC의 배치 하드스톱.
- 성공분만 usage, 실패분 해제.
- 멱등·동시성·append-only.
- 활성 예약을 침범하는 음수 조정 거부.

### 5.2 전체 검증

```powershell
git diff --check
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

SQL은 대상 Supabase에서 `0033→0034→0035→0036→0037→p4_point_checks.sql` 순으로 적용했다. 적용 전 전체 SQL을 `BEGIN/ROLLBACK`으로 드라이런했고, 적용 후 읽기 전용 스키마 검증을 통과했다. 실제 provider 연결 전에는 별도 test DB에서 두 세션 동시 예약도 추가 검증한다.

### 5.3 롤아웃 체크

- provider mode는 계속 stub.
- 초기 SMS/알림톡 단가를 platform_admin이 확인.
- 기존 충전·조정 UI가 RPC 전환 후 정상 동작.
- message send 결과가 stub이며 실제 잔액이 줄지 않음을 확인.
- 예약/정산 RPC는 권한 없는 클라이언트에서 호출 불가 확인.

### 5.4 커밋·WBS·푸시

- 최종 문서/검증 보정 커밋을 만든다.
- 각 화면 커밋 직후 `wbs-commit-sync`로 주택관리ERP 버킷의 개발 트랙만 갱신한다.
  - 직원 화면: `사무실 관리자_문자·알림톡 관리`
  - 통합관리자 화면: `통합관리자_포인트 관리`
- dev 완료 자동 전환 금지, 사람 remarks 보존.
- 사용자 요청 범위에 따라 추적 브랜치로 push한다. PR은 별도 요청 시 생성한다.

---

## Provider 후속 진입 조건

이 plan은 provider를 구현하지 않는다. 다음 조건이 모두 준비되면 별도 설계/plan으로 `/api/messaging/send`를 연결한다.

1. SMS·알림톡 provider와 계정/키 확정.
2. provider의 요청 멱등·수신자별 결과·콜백/조회 API 확인.
3. 알림톡 승인 템플릿 ID 매핑 확정.
4. sandbox에서 성공·부분실패·timeout 결과 계약 검증.
5. 실제 운영 단가 승인.

provider Route Handler는 사용자 세션·`messaging` 권한 확인 → 서버 전용 예약 RPC → provider 호출 → 정산 RPC 순으로 동작한다. timeout/결과 불명확은 재발송하지 않고 `reconcile_required`로 보낸다.

---

## Self-Review

### Spec coverage

- 견적·단가·가용 잔액 → Task 1·2·3.
- 원장 쓰기 잠금·append-only → Task 1.
- 예약·하드스톱·멱등 → Task 2.
- 성공분 정산·부분 실패 해제 → Task 2.
- stub 비과금 → Task 2·3.
- 플랫폼 단가·예약 운영 → Task 4.
- 보안·동시성·회귀 검증 → Task 2·5.

### PRD compatibility

- 기존 독립/컨텍스트 진입, 수신처 선택, 템플릿, 확인 팝업, 이력은 유지한다.
- 포인트 견적은 발송 확인 전에 추가되는 보조 블록이며 기존 발송 흐름을 대체하지 않는다.
- 실제 NCP 호출·예약발송·실패 재발송은 PRD 요구지만 provider/P4c 후속으로 유지한다.

### Known rollout risk

`0036`이 direct point INSERT 정책을 제거한 뒤 구버전 프론트의 충전·조정은 실패한다. 운영 적용 시 마이그레이션 직후 RPC 전환 프론트를 연속 배포하거나 짧은 관리 중단 창을 둔다. 데이터 손실은 없으며 새 프론트는 이전 스키마에서 동작하지 않으므로 DB→프론트 순으로 배포한다.

# 메시지 포인트 과금 설계 — 견적·예약·성공분 정산

> 상태/작성일: `approved` · 2026-08-18
> 선행: P4a 메시징 코어(`0010`), 알림톡·템플릿 확장(`0030`), 플랫폼 포인트 원장(`0011`), 포인트 조정(`0035`)
> 명명: 기존 문서에서 P4c=예약발송, P4d=실 provider로 이미 사용하므로 본 설계는 충돌을 피하여 **P4-point**로 부른다.

## 0. 배경

현재 `/staff/messaging`은 SMS·알림톡 자동 라우팅과 템플릿·발송 이력을 지원하지만 실제 provider를 호출하지 않고 `message_logs.result='stub'`만 기록한다. 플랫폼 포인트는 조직별 `point_transactions` 원장으로 충전·사용·조정을 표현하지만 메시지 발송과 아직 연결되지 않았다.

stub에 포인트를 즉시 차감하면 실제 발송 없이 잔액만 감소한다. 따라서 과금은 다음 두 단계로 분리한다.

1. **P4-point 기반**: 단가·견적·예약·동시성·멱등·원장 연결을 구현한다. stub은 견적만 표시하고 차감하지 않는다.
2. **실 provider 정산**: 서버 Route Handler가 포인트를 예약하고 provider 결과의 성공 수신자만 `usage`로 확정한다. 실패분은 예약 해제한다.

## 1. 목표와 범위

### 포함

- 조직별 포인트 잔액을 메시지 발송 크레딧으로 사용.
- SMS·알림톡별 **플랫폼 전역 포인트 단가**와 변경 이력.
- 발송 전 서버 권위 견적: 실제 라우팅 수신자 수·채널별 건수·예상 포인트·가용 잔액.
- 배치 전체 포인트 하드스톱: 가용 잔액이 견적보다 작으면 한 건도 발송하지 않는다.
- 포인트 예약과 성공분 정산, 부분 실패분 해제.
- 조직별 동시 발송을 직렬화하여 음수 잔액·초과 사용 방지.
- 요청 멱등키와 원장 고유 연결로 중복 발송·중복 차감 방지.
- 플랫폼 관리자 단가 관리 및 예약/가용 잔액 조회.
- 기존 충전·조정 쓰기를 잠금 RPC로 이동하고 원장을 append-only로 강화.

### 제외

- 조직별 협상 단가·할인·무료 제공량.
- SMS/LMS/MMS 바이트 구분. v1 문자 과금 단위는 본문 길이와 무관한 `sms` 수신자 1건이다.
- 예약발송 큐·스케줄러 자체(P4c 기존 후속).
- provider 선정·인증키·템플릿 승인·콜백 규격(P4 provider 설계에서 확정).
- 과거 stub 로그 소급 차감.
- 포인트의 원화 환율 자동 계산. 충전 포인트와 결제액은 현행처럼 독립 기록한다.

## 2. 확정된 제품 결정

| # | 결정 | 값 |
|---|---|---|
| D1 | 포인트 풀 | **조직별** `sum(point_transactions.points)` |
| D2 | 단가 범위 | **플랫폼 전역·채널별·버전 이력형**. 조직별 override는 후속 |
| D3 | 초기 단가 | SMS 1P/수신자, 알림톡 1P/수신자. 실 provider 활성화 전 운영자가 변경 가능 |
| D4 | 하드스톱 | 발송 배치 전체. 잔액 부족 시 부분 발송하지 않음 |
| D5 | 차감 기준 | provider가 성공으로 확정한 **수신자별 실제 채널** 기준 |
| D6 | 부분 실패 | 성공분만 `usage`, 실패·제외분 예약 해제 |
| D7 | stub | 비과금. 견적과 “테스트 발송·차감 없음”을 표시 |
| D8 | 중복 방지 | `(org_id, idempotency_key)` 예약 UNIQUE + 메시지 로그별 usage UNIQUE |
| D9 | 동시성 | 조직 행 `FOR UPDATE` 잠금 후 잔액·활성 예약 재계산 |
| D10 | 원장 | 직접 UPDATE/DELETE 금지, 모든 쓰기는 보안 RPC, 취소는 반대 원장행/예약 해제 |
| D11 | 요금 변경 | 견적의 rate id와 예약 시점 rate id가 다르면 `QUOTE_CHANGED`; 재확인 후 발송 |
| D12 | 자동 라우팅 | auto 모드는 알림톡 동의자=알림톡, 나머지=SMS. 서버가 재판정하며 그 결과로 견적·정산 |
| D13 | 수동 감액 | 활성 예약을 침범해 가용 잔액을 음수로 만드는 차감·환불·음수 정정은 거부 |

## 3. 과금 생명주기

```text
수신처 선택
  → 서버 견적(라우팅·중복제거·단가·가용잔액)
  → 사용자 확인
  → 조직 잠금 + 서버 재견적
  → 포인트 예약(배치 전체)
  → provider 발송
  → 성공분 usage 확정 + 실패분 예약 해제
```

### 3.1 견적

`quote_message_points`가 클라이언트가 보낸 채널을 신뢰하지 않고 다음을 다시 계산한다.

1. 전화번호 정규화·빈 번호 제외·전화번호 기준 중복 제거.
2. `occupancyId`와 동의값으로 실제 채널 재판정.
3. 알림톡 전용 모드의 미동의자는 제외.
4. 현재 활성 단가를 채널별로 스냅샷.
5. `ledger_balance = sum(point_transactions.points)`.
6. `reserved = sum(message_point_reservations.reserved_points - charged_points)` 중 `status='reserved'`.
7. `available = ledger_balance - reserved`.
8. `estimated = sms_count×sms_rate + alimtalk_count×alimtalk_rate`.

반환 계약:

```ts
interface MessagePointQuote {
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

견적은 안내값이며 잔액을 잡아두지 않는다. 실제 보장은 예약 트랜잭션에서 다시 계산한다.

### 3.2 예약

실 provider Route Handler만 `reserve_message_points`를 호출한다.

- 같은 조직의 포인트 쓰기는 먼저 `organizations` 대상 행을 `SELECT ... FOR UPDATE`로 잠근다.
- 견적을 서버에서 다시 계산한다.
- rate id·수신처 수·예상 포인트가 사용자 확인 견적과 다르면 `QUOTE_CHANGED`를 반환하고 예약하지 않는다.
- `available < estimated`면 `INSUFFICIENT_POINTS`를 반환하고 배치 전체를 중단한다.
- 성공하면 같은 트랜잭션에서 `message_logs(result='queued')`와 그 로그에 1:1로 연결된 `message_point_reservations(status='reserved')`를 생성한다.
- 같은 `(org_id,idempotency_key)` 재호출은 기존 예약과 동일 요청이면 기존 결과를 반환하고, payload hash가 다르면 `IDEMPOTENCY_CONFLICT`를 반환한다.

예약은 원장 잔액을 바꾸지 않지만 가용 잔액에서 차감된다. `expires_at`은 운영 경고·복구 기준이며 시간이 지났다는 이유만으로 자동 해제하지 않는다. provider 결과가 불명확한 상태에서 자동 해제하면 이중 사용이 가능하기 때문이다.

### 3.3 정산

`settle_message_points`는 provider 수신자별 결과를 받아 같은 조직 잠금 안에서 처리한다.

- 예약이 이미 `settled`/`released`면 기존 결과를 반환한다(멱등).
- 예약 스냅샷에 포함된 수신자와 provider 결과만 매칭한다.
- 성공 수신자의 스냅샷 채널 단가 합계를 `charged_points`로 계산한다.
- 성공이 1건 이상이면 `point_transactions(type='usage', points=-charged_points)` 한 행을 기록한다.
- 예약은 `settled`, 메시지 로그는 `sent` 또는 `partial`로 갱신한다.
- 전원 실패면 usage를 쓰지 않고 예약을 `released`, 로그를 `failed`로 갱신한다.
- 실패·제외분은 별도 양수 원장행을 만들지 않는다. 예약에서 확정되지 않았으므로 해제만 한다.

provider 호출이 시작됐으나 결과가 불명확하면 예약을 유지하고 `reconcile_required`로 표시한다. 운영자 또는 재처리 worker가 provider 조회 후 정산·해제한다.

## 4. 데이터 모델

마이그레이션 번호는 `origin/master` 및 원격 이력과 대조해 `0036`(원장·단가 안전화)과 `0037`(견적·예약·정산)로 확정했다. 2026-08-18 대상 Supabase에 `0033`~`0037`을 순차 적용하고 검증했다.

### 4.1 `message_point_rates`

```sql
create table message_point_rates (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('sms','alimtalk')),
  points_per_recipient int not null check (points_per_recipient > 0),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);
create unique index message_point_rates_one_active
  on message_point_rates(channel) where effective_to is null;
```

- 초기 활성행: `sms=1`, `alimtalk=1`.
- 수정이 아니라 기존 활성행 종료 + 신규행 INSERT로 이력을 보존한다.
- 쓰기는 `platform_set_message_point_rates(p_sms_points, p_alimtalk_points)` RPC만 허용한다. 두 채널의 단가는 한 트랜잭션에서 원자적으로 버전을 교체한다.

### 4.2 `message_point_reservations`

```sql
create table message_point_reservations (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete restrict,
  message_log_id bigint not null unique references message_logs(id) on delete restrict,
  idempotency_key uuid not null,
  payload_hash text not null,
  status text not null check (
    status in ('reserved','settled','released','reconcile_required')
  ),
  reserved_points int not null check (reserved_points >= 0),
  charged_points int not null default 0 check (charged_points >= 0),
  rate_snapshot jsonb not null,
  recipient_costs jsonb not null,
  provider_request_id text,
  requested_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, idempotency_key),
  check (charged_points <= reserved_points)
);
```

`recipient_costs`는 정규화 전화번호 hash/수신처 참조/실제 채널/rate id/건당 포인트를 담는다. 평문 전화번호·본문은 기존 `message_logs.recipients`에만 두며 불필요한 개인정보 중복 저장을 피한다.

### 4.3 `point_transactions` 연결·불변성

```sql
alter table point_transactions
  add column message_log_id bigint references message_logs(id) on delete restrict,
  add column reservation_id bigint references message_point_reservations(id) on delete restrict;

create unique index point_usage_one_per_message_log
  on point_transactions(message_log_id)
  where type = 'usage' and message_log_id is not null;
```

- 발송 사용 원장행은 `created_by=requested_by`, `memo='메시지 발송 · SMS n · 알림톡 m'`.
- 기존 `pt_platform for all` 정책은 제거하고 platform_admin SELECT 정책만 둔다.
- 충전·수동조정도 `platform_record_point_charge`·`platform_record_point_adjustment` RPC로 옮겨 동일한 조직 행 잠금을 사용한다.
- 음수 조정 후 `ledger_balance < active_reserved_points`가 되면 `POINTS_RESERVED`로 거부한다. 예약을 침범하는 강제 감액은 허용하지 않는다.
- 기존 데이터는 변경하지 않는다.

### 4.4 `message_logs` 과금 상태

```sql
alter table message_logs
  add column estimated_points int not null default 0,
  add column charged_points int not null default 0,
  add column point_status text not null default 'none'
    check (point_status in ('none','quoted','reserved','settled','released','reconcile_required'));
```

기존 `result` 제약은 `stub|queued|sent|partial|failed`를 허용하도록 확장한다. 과거 로그는 `stub/none/0P`를 유지하며 소급 과금하지 않는다.

## 5. RPC와 서버 경계

### authenticated 호출

- `quote_message_points(mode, recipients, template_id?)` — 자기 조직·`messaging` 권한, 서버 라우팅 견적.
- `list_current_message_point_rates()` — 활성 단가 읽기.
- 기존 `send_messages` stub — 비과금 유지, 로그에 `point_status='quoted'`, 예상 포인트만 기록 가능.

### platform_admin 호출

- `platform_list_message_point_rates()` — 현재·이력.
- `platform_set_message_point_rates(p_sms_points, p_alimtalk_points)` — 두 채널의 활성 단가 버전을 한 트랜잭션에서 교체.
- `platform_record_point_charge(...)`, `platform_record_point_adjustment(...)` — 기존 직접 INSERT 대체.
- `platform_release_stale_reservation(id, reason)` — provider 상태를 확인한 뒤에만 수동 해제, 감사로그 기록.

### 서버 전용 호출

- `reserve_message_points(...)` — Route Handler에서만 호출.
- `settle_message_points(...)` — provider 응답/콜백 처리기에서만 호출.
- EXECUTE는 `public`·`anon`·`authenticated`에서 revoke하고 서버 자격만 사용한다.

신규 `security definer` 함수는 `search_path=''`와 완전한 스키마 수식자를 사용한다. 직접 노출 테이블은 RLS를 켜고 쓰기 정책을 두지 않는다.

## 6. 화면

### 6.1 직원 `/staff/messaging`

- 수신처·모드 변경 시 디바운스된 서버 견적 카드:
  - 현재 가용 잔액
  - SMS/알림톡 예상 건수와 단가
  - 예상 차감·발송 후 가용 잔액
- 견적 로딩·단가 미설정·잔액 부족 상태를 명확히 표시.
- stub 단계에는 **“테스트 발송 — 실제 전송 및 포인트 차감 없음”** 배너를 표시하고 발송 확인문에도 반복한다.
- live 단계에는 잔액 부족 시 발송 버튼 비활성 + “관리자에게 포인트 충전을 요청하세요”.
- 사용자 확인 후 견적이 바뀌면 새 견적을 보여주고 재확인을 요구한다.

### 6.2 통합관리자 `/platform-admin/points`

- 상단에 “발송 포인트 단가” 카드(SMS/알림톡 현재 단가·적용시각)와 수정 모달.
- 조직별 표에 `원장 잔액 / 예약 / 가용 잔액`을 구분 표시.
- usage 행에 메시지 로그 출처·채널별 성공 건수 표시.
- 장기 예약·`reconcile_required` 경고 목록과 상태 확인 후 수동 해제 액션.

## 7. 에러 계약

| 코드 | 의미 | UI |
|---|---|---|
| `RATE_NOT_CONFIGURED` | 활성 채널 단가 없음 | 운영자 단가 설정 필요 |
| `INSUFFICIENT_POINTS` | 예약 시 가용 잔액 부족 | 배치 전체 차단, 필요/가용 표시 |
| `POINTS_RESERVED` | 수동 감액이 활성 예약을 침범 | 예약 정산·해제 후 재시도 |
| `QUOTE_CHANGED` | 단가·라우팅·수신자 변경 | 새 견적 재확인 |
| `IDEMPOTENCY_CONFLICT` | 같은 키에 다른 payload | 새 키 생성 금지, 요청 상태 조회 |
| `RESERVATION_FINALIZED` | 이미 정산/해제 | 기존 결과 반환(정상 멱등) |
| `RECONCILE_REQUIRED` | provider 결과 불명확 | 자동 재차감 금지, 상태 조회 대기 |

DB 에러 문자열 파싱 대신 RPC가 `{ok:false, code, ...details}` 구조를 반환한다. 권한 오류만 예외로 처리한다.

## 8. 테스트 전략

### SQL/RPC

- 견적: 자동 라우팅, 중복 전화번호, 빈 번호, 알림톡 미동의 제외, 채널별 단가 합계.
- 잔액: `ledger - active reservation`, 과거 stub 미포함.
- 하드스톱: 필요 포인트와 가용 포인트 경계값.
- 동시성: 같은 조직의 두 예약을 병렬 실행해 합계가 잔액을 넘지 않음.
- 멱등: 같은 키+같은 payload는 같은 예약, 다른 payload는 충돌.
- 정산: 전원 성공·부분 성공·전원 실패·중복 콜백.
- 단가 변경: 기존 예약은 스냅샷 단가 유지, 새 견적은 새 단가.
- 보안: 일반 staff의 단가 변경·직접 원장 INSERT/UPDATE/DELETE·서버 전용 RPC 호출 거부.
- 회귀: 플랫폼 충전·조정과 staff 메시지 권한·org 격리.

### TypeScript/RTL

- 견적 매퍼와 오류 코드 매핑.
- Composer 견적 카드·stub 배너·live 잔액 부족 차단·QUOTE_CHANGED 재확인.
- 플랫폼 단가 변경 모달·예약/가용 표시.
- 메시지 이력의 차감 상태·성공 건수.
- 전체 `vitest`, `tsc --noEmit`, `eslint`, `next build`.

## 9. 롤아웃

1. P4-point 마이그레이션 2개를 순서대로 적용·초기 단가 삽입.
2. 기존 포인트 직접 쓰기를 RPC로 전환하고 append-only 확인.
3. 견적·플랫폼 단가 UI 배포. provider는 계속 stub, 차감 0.
4. 동시 예약/정산 통합 테스트와 운영 모니터링 준비.
5. 별도 provider 설계에서 API·콜백·재조정 worker 확정.
6. provider sandbox 검증 후 `billingMode='live'` 전환. 전환 전에 실제 단가를 운영자가 확인한다.

롤백 시 live 발송을 먼저 끄고 신규 예약을 막는다. 이미 정산된 usage는 삭제하지 않으며 필요한 보정은 감사 가능한 반대 원장행으로만 처리한다.

## 10. 구현 단계 제안

1. **원장 안전화** — 직접 쓰기 제거, 충전·조정 RPC, 조직 잠금, 회귀 테스트.
2. **단가·견적** — rate 테이블/RPC, quote API, staff 견적 카드, platform 단가 UI.
3. **예약·정산 엔진** — reservation 테이블/RPC, 멱등·동시성·부분정산 SQL 테스트. stub에는 연결하지 않음.
4. **provider 후속** — Route Handler·provider adapter·콜백/재조정 worker, live 하드스톱 활성화.

## 11. 근거

- PostgreSQL의 transaction-level/row-level 잠금은 트랜잭션 종료 시 해제되며, 동일 조직의 잔액 판정과 예약을 직렬화하는 데 사용한다.
- Supabase RPC의 `security definer`는 필요한 곳에만 사용하고 `search_path` 고정·EXECUTE 제한·RLS를 함께 적용한다.

참고: [PostgreSQL advisory/transaction locks](https://www.postgresql.org/docs/18/functions-admin.html), [PostgreSQL explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html), [Supabase database functions security](https://supabase.com/docs/guides/database/functions), [Supabase API/RLS security](https://supabase.com/docs/guides/api/securing-your-api).

## 12. 결정 로그

- [2026-08-18] 과금 기반과 실제 provider 정산을 2단계로 분리.
- [2026-08-18] stub은 비과금, 과거 stub 소급 과금 없음.
- [2026-08-18] 대상 Supabase `0033`~`0037` 적용 및 `p4_point_checks.sql` 검증 완료.
- [2026-08-18] 조직별 포인트 풀·플랫폼 전역 채널 단가.
- [2026-08-18] 배치 전체 하드스톱·성공 수신자별 정산·부분 실패 해제.
- [2026-08-18] 조직 잠금·예약 멱등키·원장 고유키로 초과/중복 차감 방지.
- [2026-08-18] SMS/LMS 구분과 조직별 단가는 후속.

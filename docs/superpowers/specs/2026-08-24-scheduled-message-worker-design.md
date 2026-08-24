# 예약 발송 worker — `message_schedules` 소비 설계

- **상태**: approved (2026-08-24)
- **대상**: `message_schedules`의 만기 예약행을 실발송 파이프라인으로 소비하는 worker + 자동 트리거(EventBridge) + 운영 수동 버튼
- **구현 방식**: (이번 주 오케스트레이션 정책) 구현은 Orca로 **Claude 워커**에 배정(`orca orchestration worker-start --agent claude`), 현재 워크트리 유지. Claude=설계/리뷰. TDD.
- **선행(기구현)**: 즉시발송 실경로(Track E 슬라이스1, PR #66)·포인트 견적/예약/정산(0037)·예약 쓰기(`schedule_messages` 0032). **부재 = 소비자(worker)**.

---

## 1. 배경 (검증된 현황)

- **예약 쓰기 = 완성**: `/staff/messaging` 컴포저의 예약 발송(`sendTiming='scheduled'`)과 `/staff/bill` 카톡 예약이 `schedule_messages`(0032, authenticated)를 호출해 `message_schedules(status='scheduled')` 행 생성. bill은 추가로 `record_bill_delivery(...'scheduled', message_schedule_id)`로 `bill_issues`를 링크.
- **소비자 부재**: `message_schedules`를 읽어 발송·정산하는 경로가 없음 → 예약해도 아무도 안 보냄(dead-end). Amplify 호스팅에 내장 cron 없음.
- **재사용 자산**:
  - `app/api/messaging/send/route.ts` — 즉시발송이 `quote → reserve_message_points(service_role, 하드스톱·15분 예약) → dispatchOne×N → settle_message_points(service_role)` 를 수행. 산출물 형태(resolved_recipients·recipient_costs·recipient_key zip)를 그대로 재사용.
  - `lib/messaging/dispatch.ts` `dispatchOne(channel, recipient, body, ...)` — 채널별 어댑터, 미설정 채널 `{status:'failed', reason:'unconfigured'}`. `anyChannelConfigured(mode)`.
  - `settle_message_points(reservation_id, provider_request_id, results)`(0037) — 성공분만 `point_transactions` 차감, `message_logs` result 확정(sent/partial/failed/released).
  - `createAdminClient()`(`lib/supabase/admin.ts`) = service_role.
- **`message_schedules` 스키마(0032)**: `id, org_id, channel(sms|alimtalk|auto), body, context, recipient_count, recipients jsonb, template_id, scheduled_at, status(scheduled|cancelled|sent|failed), created_by, cancelled_at, timestamps`. RLS는 **select 전용**(org+messaging 모듈) → 쓰기는 SECURITY DEFINER/service_role만.

---

## 2. 범위

### 포함 (이 슬라이스)
1. **소비 worker**: 만기 예약행(`status='scheduled' AND scheduled_at<=now()`)을 claim → 즉시발송과 동일 엔진(reserve→dispatch→settle)으로 발송 → sent/failed 마감.
2. **서비스롤 드레인 라우트** `app/api/messaging/dispatch-scheduled`: cron(전 org)·수동(본인 org) 이중 인증.
3. **자동 트리거**: AWS EventBridge(schedule `rate(1 minute)`)가 라우트 호출 — 코드+Ops 문서(배선은 사용자).
4. **운영 수동 버튼**: `/staff/messaging` "예약분 지금 처리"(QA/운영).
5. **bill_issues 연동**: 예약행 발송 결과를 링크된 `bill_issues.send_status`에 동기화(scheduled→sent/failed).

### 제외 (후속)
- 반복(cron식) 예약·예약 편집 UI·재발송 UI·팩스 예약.
- 실제 EventBridge/IAM/시크릿 배선 실행(문서화만; 사용자가 AWS에서 수행).

---

## 3. 확정 설계 결정

| # | 결정 | 사유 |
|---|---|---|
| D1 | 소비 경로 = **서비스롤 드레인 라우트** `app/api/messaging/dispatch-scheduled`, 즉시발송과 동일 엔진 재사용 | reserve/settle이 service_role 전용 · 로직 중복 방지 |
| D2 | **이중 인증 단일 라우트**: `Authorization: Bearer $CRON_SECRET` 유효 → 전 org 드레인 / 아니면 세션+messaging 권한 → **본인 org만**(org는 세션에서 도출, 바디 신뢰 안 함) | cron=전역, 수동=org 스코프, 신뢰경계 명확 |
| D3 | **claim = `FOR UPDATE SKIP LOCKED`** + status `'sending'`·`claimed_at` 신설 | 틱 중복/동시 실행 이중발송 방지 |
| D4 | 예약행 reserve는 **schedule_id 기반 결정적 idempotency_key** → 재claim 시 기존 예약 **replay**(재삽입 금지) | 크래시 후 포인트 이중예약·로그 중복 방지 |
| D5 | **미설정(채널 키 없음) → schedule='failed'(미설정)**. 발송 시도 없음 → 포인트·로그 미생성, 링크 bill_issues도 'failed' | 사용자 확정. 정직(미발송을 sent로 위장 안 함)·무한재시도 없음 |
| D6 | **자동 재시도 없음**: reserve 실패(INSUFFICIENT_POINTS·수신자없음 등)·전건 dispatch 실패 → schedule='failed'. 재발송은 운영자가 재예약 | 매 틱 실패 반복 소음 방지 · 포인트 충전은 통합관리자 포인트 관리 담당 |
| D7 | **stuck 복구**: `status='sending' AND claimed_at < now()-15min` 를 다음 claim이 회수 | 예약 15분 만료와 정합 · 크래시 내성 |
| D8 | 발송 로직은 **전부 TS 라우트**, 트리거만 외부에서 HTTP로 깨움(pg_cron 반려) | NCP HTTP를 SQL에서 호출 시 어댑터 분리·테스트 불가 |

---

## 4. 아키텍처

### 4.1 데이터 흐름
```
EventBridge(rate 1분) ──Authorization: Bearer $CRON_SECRET──┐
                                                            ├─▶ POST /api/messaging/dispatch-scheduled
staff "예약분 지금 처리" 버튼 ──세션(messaging)──────────────┘        │
                                                                     ▼
   claim_due_message_schedules(p_org_id?, p_limit=50, '15min')  →  N행 status='sending', claimed_at=now()
     per 행 (lib/messaging/drainSchedules.ts):
       ├ !anyChannelConfigured(channel)  → complete_message_schedule(id, null, 'failed')          [D5]
       └ 설정됨:
            reserve_scheduled_message(id)
              ├ ok:false(INSUFFICIENT_POINTS·NO_ELIGIBLE_RECIPIENTS·…) → complete(id, null,'failed') [D6]
              └ ok: {reservation_id, message_log_id, resolved_recipients, recipient_costs, alimtalk_*}
                   → dispatchOne × 수신자  (resolved[i] ↔ costs[i].recipient_key zip)
                   → settle_message_points(reservation_id, providerRequestId, results)   (기존 0037)
                   → complete_message_schedule(id, message_log_id, settle.result∈{sent,partial}?'sent':'failed')
   → 집계 { claimed, sent, failed, unconfigured, charged_points } JSON 반환
```

### 4.2 DB 마이그레이션 `supabase/migrations/0094_scheduled_message_worker.sql`
> 번호는 **커밋 직전 origin/master max 재확인**(현재 max 0093).

- `message_schedules`:
  - status check에 `'sending'` 추가 → `('scheduled','sending','cancelled','sent','failed')`.
  - `add column claimed_at timestamptz`, `add column message_log_id bigint references message_logs(id) on delete set null`.
- **`claim_due_message_schedules(p_org_id bigint default null, p_limit int default 50, p_stale_after interval default '15 minutes')`** (SECURITY DEFINER, service_role):
  - `where (p_org_id is null or org_id=p_org_id) and ((status='scheduled' and scheduled_at<=now()) or (status='sending' and claimed_at < now()-p_stale_after))`
  - `order by scheduled_at for update skip locked limit p_limit`
  - `update ... set status='sending', claimed_at=now()` → 잠근 행 `(id, org_id, channel, body, context, recipients, template_id)` 반환.
- **`reserve_scheduled_message(p_schedule_id bigint)`** (SECURITY DEFINER, service_role):
  - 대상 행이 `status='sending'` 이어야 함(claim 선행).
  - `resolve_message_point_quote(org_id, channel, recipients, template_id)` 내부 견적(현 시점 단가).
  - 견적 실패 → `{ok:false, code}` 반환(발송 안 함).
  - **결정적 idempotency**: `idempotency_key = md5('sched:'||p_schedule_id)::uuid` (예시). 동일 키 예약이 이미 있으면 **replay**(기존 reservation_id·message_log_id 반환).
  - 잔액 하드스톱(가용<필요 → `INSUFFICIENT_POINTS`), 통과 시 `message_logs(result='queued', point_status='reserved')` + `message_point_reservations(status='reserved', expires_at=now()+15min)` 삽입.
  - 반환: `{ok:true, reservation_id, message_log_id, resolved_recipients, recipient_costs, alimtalk_template_code, buttons}`.
  - (reserve_message_points의 확정값 비교/QUOTE_CHANGED 가드는 예약 경로엔 불필요 — 클라이언트 확정이 없고 발송 시점 단가로 청구.)
- **`complete_message_schedule(p_schedule_id bigint, p_message_log_id bigint, p_final text)`** (SECURITY DEFINER, service_role):
  - `p_final in ('sent','failed')` 검증.
  - `update message_schedules set status=p_final, message_log_id=coalesce(p_message_log_id, message_log_id) where id=p_schedule_id`.
  - **bill 연동**: `update bill_issues set send_status=(p_final), message_log_id=coalesce(p_message_log_id, message_log_id) where message_schedule_id=p_schedule_id` (서비스롤이라 bill_publish 모듈검사 우회).
- `settle_message_points`(0037)는 **변경 없이 재사용**.
- grant: 세 RPC 모두 `revoke ... from public, anon, authenticated` + `grant execute ... to service_role`.

### 4.3 발송 라우트 `app/api/messaging/dispatch-scheduled/route.ts` (POST)
1. **인증(D2)**: `Authorization` 헤더의 Bearer가 `process.env.CRON_SECRET`과 상수시간 일치 → `scopeOrgId=null`(전 org). 아니면 `createClient()` 세션 `auth.getUser()` + `get_my_context`로 messaging 권한 확인 → `scopeOrgId=org_id`(본인 org). 둘 다 실패 → 401.
2. `createAdminClient()`로 `drainSchedules({ admin, orgId: scopeOrgId, limit: 50 })` 호출.
3. 집계 JSON 반환.

### 4.4 드레인 코어 `lib/messaging/drainSchedules.ts` (+test)
- 순수 함수 형태(주입: admin 클라이언트·`dispatchOne`·env 판단). `claim → 행별 처리 → 집계`. 라우트는 얇은 래퍼 → 단위테스트 용이.
- 행별: `anyChannelConfigured` → 미설정이면 `complete(...,'failed')`(D5). 설정이면 reserve→dispatch→settle→complete. 예외는 해당 행만 실패 처리하고 다음 행 계속.

### 4.5 UI `/staff/messaging`
- "예약분 지금 처리" 버튼: 세션으로 `POST /api/messaging/dispatch-scheduled`(시크릿 없이) → 결과 토스트(`처리 N · 발송 N · 실패 N · 미설정 N`). 예약 목록/취소는 기존 유지.

### 4.6 Ops 문서 `docs/ops/eventbridge-scheduled-messaging.md`
- **EventBridge Rule(schedule `rate(1 minute)`) → API destination**(Connection에 API-key 인증 `Authorization: Bearer <CRON_SECRET>`)로 Amplify 라우트 URL POST 호출. **Lambda 불필요.**
- `CRON_SECRET`을 Amplify 환경변수 + 로컬 `.env.local`에 주입(강한 난수).
- 클라이언트 SSO 계정(auraworks)에서 실행할 `aws events`/`aws scheduler` CLI 절차 + 콘솔 단계, 최소 IAM 권한, 검증 방법(수동 트리거·CloudWatch 로그).

---

## 5. 에러 처리 & 멱등
- **claim** `SKIP LOCKED`로 동시 틱 이중처리 차단. stuck(`sending` 15분↑)은 다음 claim이 회수(D7).
- **reserve** 결정적 idempotency로 재claim 시 동일 예약 replay(D4) → 포인트 이중예약·로그 중복 없음.
- **부분 실패**: settle가 성공분만 차감, 전건 실패는 released(포인트 환원). schedule은 성공 1건 이상 → 'sent', 아니면 'failed'.
- **라우트 실패/타임아웃**: 다음 틱이 backlog 이어서 소비(멱등하므로 안전). `p_limit`(기본 50)로 틱당 처리량 제한 — 서버리스 함수 타임아웃 대비(대량 백로그는 여러 틱에 분산).
- **미설정(D5)**: reserve/dispatch 미진입, schedule·bill_issues 'failed'.

## 6. 테스트 (TDD, vitest — supabase 클라·`dispatchOne`·env·fetch 목킹, 기존 스타일)
- `lib/messaging/drainSchedules.ts`: (a) claim 0건→무동작 (b) 미설정→reserve 미호출·complete('failed') [D5] (c) 정상→reserve→dispatch→settle→complete 순서·인자 (d) INSUFFICIENT_POINTS→dispatch 미호출·complete('failed') [D6] (e) 부분 실패 매핑·result='partial'→'sent' (f) 한 행 예외가 다음 행을 막지 않음.
- `app/api/messaging/dispatch-scheduled/route.ts`: (a) 시크릿無·세션無→401 (b) 유효 시크릿→orgId=null 전달 (c) 세션(messaging)→본인 org 전달 (d) 세션 있으나 messaging 권한無→403 (e) 집계 반환.
- 마이그 RPC 계약(claim 선택조건·complete의 bill 동기화·reserve replay)은 로직 테스트로 커버(실 PG 없이 목킹 유지).

## 7. 파일 변경 요약
| 파일 | 변경 |
|---|---|
| `supabase/migrations/0094_scheduled_message_worker.sql` | 신규: message_schedules 컬럼·status + 3 RPC(claim/reserve_scheduled/complete) |
| `lib/messaging/drainSchedules.ts` (+test) | 신규 드레인 코어 |
| `app/api/messaging/dispatch-scheduled/route.ts` (+test) | 신규 이중인증 드레인 라우트 |
| `app/(staff)/staff/messaging/**` | "예약분 지금 처리" 버튼 + 결과 토스트 |
| `docs/ops/eventbridge-scheduled-messaging.md` | 신규 EventBridge/CRON_SECRET 배선 문서 |

## 8. 범위 밖 (YAGNI)
반복 예약·예약 편집/재발송 UI·팩스 예약·수신거부 세그먼트·실 AWS 배선 실행.

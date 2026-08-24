# Popbill 완전 전환 — 구현 완료 보고

> 작성: Claude 코드 워커 · 기준 커밋 base `219b4ae` → HEAD `fc337b4`
> 커밋 12개(feat 9 · chore 1 · fix 1 · 각 Task 1커밋 + 빌드호환 폰트 fix). 79 files changed, +7107 / -1130.

## 결과 요약

NCP/스텁 발송을 제거하고 Popbill 접수·결과 재조회 기준의 SMS/LMS·알림톡·팩스 실발송 파이프라인으로
완전 전환했다. 접수(receipt)는 성공이 아니며(`queued/provider_pending`), 최종 결과(state=3/result=100·팩스 성공
페이지)만 멱등 정산·월 청구에 반영한다. 자격증명이 없어 실제 외부 발송은 하지 않았고, SDK 경계까지 모킹 단위테스트로
검증했으며 DB/크리덴셜 스모크는 미수행(아래 명시)이다.

## 검증 명령과 결과 (모두 통과)

| 명령 | 결과 |
| --- | --- |
| `npx vitest run` (npm test) | **899 passed, 9 skipped, 0 failed** (241 test files) — 후속 리뷰 수정 9건 추가 |
| `npm run lint` | **clean** (0 error, 0 warning) |
| `npx tsc --noEmit` | **0 errors** |
| `npm run build` (next build, Turbopack) | **✓ Compiled successfully**, exit 0. 신규 라우트 4개 모두 등록(ƒ dynamic): `/api/messaging/send`, `/api/messaging/dispatch-scheduled`, `/api/delivery/reconcile`, `/api/bill/fax/send` |
| `git diff --check` | clean |
| NCP 런타임 검색 `rg "NCP_|ncloud|sens|sendNcp|sendAlimtalk|billingMode.*stub|provider.*stub"` (설계문서/zip 제외) | **0 matches** |
| `git status --short` (커밋 직전마다 확인) | 사용자 소유 untracked만(debug.log, *.zip, docs/parallel-kickoff/*) — **한 번도 stage/수정하지 않음** |

> 위 표는 **후속 리뷰 수정 반영 후** 재실행 기준값이다(아래 "후속 리뷰 수정" 참조). DB reset/verify와 Popbill 자격 증명 smoke는 여전히 환경 부재로 미수행이며, verify SQL은 정적 검토만 했다.

## 후속 리뷰 수정 (2건, TDD red→green)

리뷰에서 지적된 2개 블로커를 test-first로 수정했다. 실패 테스트 추가 → 실패 확인 → 최소 구현 → 통과 순서로 진행했고,
전체 검증(위 표)을 재실행했다.

### BLOCKER 1 — 수신자별 렌더 본문 보존 (모든 수신자 동일 본문 버그)
- **문제**: `submitReservationBatches`가 예약 resolved 수신자에서 `renderedBody`를 버리고 배치 공통 `body` 하나를 모든
  수신자에게 접수했다(SMS/LMS `messages[i].Contents`, 알림톡 `msgs[i].msg`가 전부 동일).
- **수정**: `ResolvedRecipient.renderedBody`를 planning(`PlanRecipient`→`SubmissionBatch.recipients`) →
  `MessageBatchInput.recipients` → SDK payload(SMS/LMS `Contents`, 알림톡 `msg`)까지 보존한다. 없으면 공통 `body`로 대체(하위 호환).
- **제품 판정 일치(리뷰 후속)**: `resolve_message_point_quote`(0096)가 공통 `p_body` 하나로 모든 SMS 수신자를 분류하던 것을
  **수신자별 최종 본문**(renderedBody 우선, 없으면 `p_body`)으로 분류하도록 수정했다. `recipient_costs.product`(과금·배치·SDK
  메서드 선택 기준)가 실제 접수되는 수신자별 본문과 일치한다. 어느 수신자든 최종 본문이 2000바이트를 초과하면 접수 전 배치 전체를 거절한다.
- **알림톡 변수 검증**: 접수 전 미치환 `#{변수}` 검사를 공통 본문 1회가 아니라 **수신자별 최종 본문 기준**으로 수행한다
  (특정 수신자만 미치환이어도 배치 전체를 거절).
- **테스트**: `submission.test.ts`(배치가 수신자별 renderedBody 보존), `messages.test.ts`(서로 다른 본문 2명 → SMS/LMS
  `Contents`·알림톡 `msg` 정확 인자 검증 + 하위 호환 대체 + 수신자별 미치환 변수 거절), `dispatch.test.ts`
  (`submitReservationBatches`가 즉시/예약 **공용 경로**로 수신자별 renderedBody를 배치에 전달 + **sms/lms 혼합 수신자가 제품별
  배치로 분리되어 각자 본문이 붙는 회귀**). 견적의 수신자별 분류는 `p4_point_checks.sql` 정적 검증(`renderedBody` 기준)으로 고정
  (DB 미실행).

### BLOCKER 2 — 즉시 카톡 고지서 접수를 sent로 기록하던 버그
- **문제**: `app/(staff)/staff/bill/page.tsx`가 즉시 카톡 접수(queued)를 `sent`로 기록해 접수만으로 발송 성공으로 표기됐다.
  또한 구 `record_bill_delivery` RPC(0032)는 `queued/partial`을 거절했고(테이블 체크는 0095에서 이미 확장됨),
  `settle_message_points_from_jobs`는 예약(`message_schedule_id`) 고지서만 최종화하고 즉시(`message_log_id`) 고지서는 방치했다.
- **수정**:
  - 화면: 즉시 접수를 `queued`로 기록하고 `message_log_id`를 연결(예약은 기존대로 `scheduled`+`message_schedule_id`).
  - `BillDeliveryStatus` 타입에 `queued|partial` 추가.
  - `record_bill_delivery`를 기존 마이그(0095)에서 재정의해 `queued/partial`을 허용하고, `queued`는 `message_log_id` 연결을 요구.
  - `settle_message_points_from_jobs`(0096)가 즉시(`message_log_id`)·예약(`message_schedule_id`) 고지서를 **모두** provider
    terminal 결과 이후에만 `sent/partial/failed`로 최종화(부분 성공 시 `partial` 보존).
- **월 청구 무영향 확인**: `platform_org_usage`(0097)는 이미 terminal success 수신자(`rec.status='success'`)와 terminal 팩스
  job(`sent/partial`)만 집계하므로 queued/pending 접수는 청구에서 제외된다. verify SQL로 이 불변식을 고정했다.
- **테스트**: `page.test.tsx`(즉시 카톡 접수가 `sent`가 아니라 `queued`로 기록되고 `message_log_id` 연결 — 회귀),
  `apis.test.ts`(`queued` 상태·`message_log_id` 전달), verify SQL(`p4_point_checks.sql`: `record_bill_delivery` queued/partial
  허용·즉시 message_log_id 요구·settle의 message_log_id 최종화 / `platform_admin_checks.sql`: 월 사용량이 terminal success·팩스
  terminal만 집계) — **DB 미실행, 정적 검토만**.

### 이번 후속 수정으로 건드린 파일
- 구현: `lib/messaging/submission.ts`, `lib/popbill/types.ts`, `lib/popbill/messages.ts`, `lib/messaging/dispatch.ts`,
  `app/(staff)/staff/bill/page.tsx`, `hooks/reactquery/bill/apis.ts`,
  `supabase/migrations/0095_popbill_dispatch_foundation.sql`(record_bill_delivery 재정의),
  `supabase/migrations/0096_popbill_point_settlement.sql`(resolve_message_point_quote 수신자별 제품 판정 + settle 고지서 최종화 확장)
- 테스트/검증: `lib/messaging/submission.test.ts`, `lib/popbill/messages.test.ts`, `lib/messaging/dispatch.test.ts`,
  `app/(staff)/staff/bill/page.test.tsx`, `hooks/reactquery/bill/apis.test.ts`,
  `supabase/verify/p4_point_checks.sql`, `supabase/verify/platform_admin_checks.sql`

## 변경 파일 (책임별)

- **공급자 기반**: `types/popbill.d.ts`, `lib/popbill/{config,sdk,types,messages,fax,results}.ts`(+tests), `lib/messaging/product.ts`
- **발송 오케스트레이션**: `lib/messaging/{dispatch,submission,drainSchedules,reconcile,render,preset}.ts`(+tests)
- **라우트(runtime=nodejs)**: `app/api/messaging/send`, `app/api/messaging/dispatch-scheduled`, `app/api/delivery/reconcile`, `app/api/bill/fax/send` (+route.test)
- **팩스 문서/PDF**: `lib/bill/{document,faxData}.ts`, `lib/bill/faxPdf.tsx`, `lib/bill/fonts/notoSansKr.ts`(임베드 폰트)
- **DB 마이그레이션**: `supabase/migrations/0095_popbill_dispatch_foundation.sql`, `0096_popbill_point_settlement.sql`, `0097_popbill_platform_billing.sql`
- **검증 SQL**: `supabase/verify/{p4_point_checks,platform_admin_checks}.sql`
- **훅/화면**: `hooks/reactquery/messaging/apis.ts`, `hooks/reactquery/platform/{settings,billing,pointBilling}.ts`, `hooks/reactquery/bill/{apis,mutations}.ts`, staff messaging(Composer/QuoteCard)·bill(DocumentOutputModal/page)·platform-admin(points/settings/billing) 화면(+tests)
- **삭제(NCP)**: `lib/messaging/{ncp,alimtalk}.ts`(+tests)
- **문서**: `docs/ops/popbill-delivery.md`(신규 런북), `docs/ops/eventbridge-scheduled-messaging.md`(reconcile 주기·경보), `.env.example`

## 수용 기준 대비

- NCP 런타임 코드/import/env 잔존 없음(검색 0). ✓
- 즉시·예약 발송이 Popbill job/수신자 매핑을 만들고 receipt 후 `queued` 반환, 접수만으로 sent/차감 안 함. ✓
- SMS·LMS·알림톡 각각 독립 견적·예약·정산·표시·청구, Popbill 바이트 규칙(90/2000) 테스트. ✓
- 폴링 멱등, state 3/result 100=성공, terminal 실패=반환, provider_pending/reconcile_required 수동 만료 해제 차단, 스케줄/로그는 DB job 결과로 최종화. ✓
- 알림톡 대체문자(altSendType) 비활성. ✓
- 팩스: 세대별 A4 한글 PDF(메모리 버퍼), append-only job, 페이지 필드 reconcile, 재시도 in-flight 가드, 성공 페이지만 청구. ✓
- 월 청구: LMS·팩스 성공 페이지 반영, provider job 미연결 레거시만 fallback(중복 방지), 확정 스냅샷. ✓
- 미설정=`PROVIDER_NOT_CONFIGURED`(가짜 성공 stub 제거). ✓
- 운영 문서(가입·발신번호·카카오 채널/템플릿·cron·모니터링·키 교체) 작성. ✓

## 미수행(환경 부재) — 정적 증거로 대체

- **DB reset + verify 실행**: 로컬 Supabase/psql/config.toml/DATABASE_URL 없음(확인함). 마이그 0095–0097과 verify
  추가분은 저장소 기존 패턴(security definer·`search_path=''`·완전수식·RLS·service_role 전용 grant·상태 가드)을
  따라 정적 작성. **DB 실행 미수행**. DB 가능 환경에서 `supabase db reset` 후
  `p4_point_checks.sql`·`platform_admin_checks.sql` 실행 필요.
- **Popbill 테스트 자격증명 스모크**(SMS/LMS/알림톡/1p 팩스 접수→결과→정산): 자격증명 미제공으로 미수행.
  어댑터·정규화·정산은 모킹 SDK 단위테스트로 검증. 실행 체크리스트는 `docs/ops/popbill-delivery.md §3`.

## 가정·리스크·후속 결정 필요

1. ~~**단일 최종 본문 모델**~~ → **해결(후속 리뷰 수정 BLOCKER 1)**. 수신자별 최종 렌더 본문(`ResolvedRecipient.renderedBody`)을
   planning → `MessageBatchInput` → SDK payload까지 보존한다. 견적(`resolve_message_point_quote`)도 **수신자별 최종 본문**으로
   sms/lms 제품을 판정하며(renderedBody 우선, 없으면 공통 `p_body` fallback), `recipient_costs.product`가 실제 접수되는 수신자별
   본문과 일치한다. 공통 본문 단일 분류는 더 이상 남아있지 않다.
2. ~~**카톡 고지서 즉시 발송이 sent로 기록**~~ → **해결(후속 리뷰 수정 BLOCKER 2)**. 즉시 카톡 고지서 접수는 `queued`로 기록하고
   `message_log_id`를 연결한다. 최종 확정(sent/partial/failed)은 `settle_message_points_from_jobs`가 provider terminal 결과 이후에만 수행한다.
3. **LMS 기본 단가**: 0097이 `rate_krw_lms`를 SMS 단가로 seed. 운영에서 관리자가 설정 화면에서 조정 필요(미설정 LMS
   견적은 `RATE_NOT_CONFIGURED`).
4. **폰트 임베드**: Turbopack가 `.woff` 모듈을 번들하지 못해 `require.resolve` 대신 재배포 가능(OFL) Noto Sans KR를
   base64 data URL로 서버 전용 임베드(클라이언트 미노출). 계획의 require.resolve 지시에서 벗어난 유일한 의도적 변경.
5. **잔존 stub**: 미사용 DB RPC `send_messages`(과거 stub 로거)는 호출 경로가 없어 휴면 상태로 남김(런타임 미노출). 필요 시 후속 드롭.
6. **Codex 최종 리뷰**: 지침대로 Codex 감수 대기. 리뷰 지적은 동일 작업으로 반영 후 `npm test/lint/build` 재실행 예정.

## 최종 리뷰 수정 (2차, base `3e8f5d9`, TDD red→green 7건)

Popbill 리뷰 2차에서 지적된 블로커/개선 7건을 test-first로 반영했다. 각 항목은 실패 테스트 추가 → 실패 확인 →
최소 구현 → 통과 순서로 진행했고 전체 검증을 재실행했다. (잘못 생성됐던 임시 리뷰 파일
`docs/superpowers/reports/2026-08-24-popbill-migration-code-review.md`는 없어 별도 삭제 불필요.)

### 재실행 검증 결과 (모두 통과, 2차 반영 후 기준값)

| 명령 | 결과 |
| --- | --- |
| `npx vitest run` (npm test) | **925 passed, 9 skipped, 0 failed** (244 test files) — 2차 수정 테스트 추가분 반영 |
| `npm run lint` | **clean** (exit 0) |
| `npx tsc --noEmit` | **0 errors** (exit 0) |
| `npm run build` (next build) | **성공(exit 0)**, 신규 라우트 회귀 없음 |
| `git diff --check` | clean(줄바꿈 CRLF 경고만) |
| NCP 런타임 검색(`NCP_|ncloud|sendNcp|sendAlimtalk|billingMode.*stub|provider.*stub|\bsens\b`, 설계/리포트 문서·zip 제외) | **0 matches** |
| `git status --short` | 사용자 소유 untracked(debug.log, *.zip, docs/parallel-kickoff/*)만 — 스테이지/수정 안 함 |

### 1) 즉시 메시지 API 멱등성(Critical)
- 라우트 `POST /api/messaging/send`가 `Idempotency-Key`(UUID) 헤더를 요구·검증한다(누락=`IDEMPOTENCY_KEY_REQUIRED`,
  비UUID=`IDEMPOTENCY_KEY_INVALID`, **접수/예약/provider 액션 전 400**). 키를 `DispatchMessagesInput.idempotencyKey`로
  스레딩하고 `reserve_message_points`의 `p_idempotency_key`로 사용한다. **per-call `randomUUID` 제거.**
- 예약 replay(`reserve.replayed`) 시 **절대 Popbill 접수/mark/release를 다시 하지 않는다**. 저장된 예약 상태로만 안전
  응답한다: `provider_pending/reconcile_required/settled/reserved` → 안전한 `queued`(재접수 없음), `released` → 동일한 안전
  실패(`SEND_REJECTED`). 동시 호출은 `reserve_message_points`의 org 행 `for update` 잠금으로 직렬화되어 한 번만 접수된다.
- 클라이언트(`MessagingComposer`)는 초안 서명 기반 ref로 **한 논리적 시도당 안정 키**를 만든다(중복 클릭·동일 페이로드
  재시도=같은 키, 초안 실질 변경=회전, 성공 후=회전). `sendMessages`가 `Idempotency-Key` 헤더로 전달한다.
- 테스트: `dispatch.test.ts`(동일 키 재시도 → 접수·mark·job생성 각 1회, released replay=SEND_REJECTED·재접수 없음, 키
  스레딩), `route.test.ts`(헤더 누락/비UUID 400·dispatch 미호출, 유효 키 전달), `apis.test.ts`(헤더 전송),
  `idempotencyKey.test.ts`(동일 서명 재사용·서명 변경 회전·UUID 생성), `MessagingComposer.test.tsx`(중복 클릭 동일 키·성공 후 회전).
- 예약 발송 멱등은 이번 범위 밖(스케줄 RPC 미변경, `reserve_scheduled_message`의 md5 기반 결정 키 유지).

### 2) provider 접수 결과 판정 의미
- **Popbill SDK 오류 콜백·로컬 검증 = 확정 실패(failed/환불)**, unknown 아님. 오직 전송/무응답 **타임아웃만
  unknown(reconcile_required)**. `PopbillTimeoutError` 타입 신설 + 메시지/팩스 어댑터에 **bounded timeout + settled 가드**
  (늦은 콜백 이중 정산 방지)를 추가했다(`submitWithTimeout`).
- 모든 즉시 배치가 확정 거절되어 mark가 `released`면 dispatch/API는 **명확한 non-202 실패(`SEND_REJECTED` 502)**를
  반환하고 **receipt 없이 queued로 보고하지 않는다**. receipt 없는 불명확(`reconcile_required`)은 `SEND_UNCONFIRMED`(502).
  고지서 흐름은 실패 시 `onFailed`로만 처리되어 `record_bill_delivery(queued)`를 기록하지 않는다(회귀 테스트 추가).
- 테스트: `messages.test.ts`/`fax.test.ts`(무응답→PopbillTimeoutError·이중정산 없음), `dispatch.test.ts`(SubmitError→released→
  SEND_REJECTED, Timeout→reconcile_required→SEND_UNCONFIRMED), `MessagingComposer.test.tsx`(확정 거절→onFailed·onSent 미호출).

### 3) 팩스 라우트 submitting 잔류 방지
- `create_fax_dispatch_job` 이후 `renderFaxPdf`/사전 단계 실패 시 해당 job을 **즉시 `failed`로 마킹**해 재시도를 허용한다
  (submitting 잔류·ALREADY_IN_FLIGHT 영구 차단 제거). Supabase admin RPC(create/mark) **오류를 무시하지 않는다**.
  provider 접수는 성공했으나 mark 반영 실패 시 **queued로 거짓 보고하지 않고** `mark_failed`(확인 필요)로 남긴다(중복 전송은
  ALREADY_IN_FLIGHT로 차단). 타임아웃=`reconcile_required`(queued 아님). 중복 가드/최적화는 유지.
- 테스트: `route.test.ts`(PDF 렌더 실패→mark failed·provider 미호출, create RPC 오류→failed·렌더/접수 없음,
  접수 성공+mark 실패→queued 아님·`mark_failed`, 타임아웃→`reconcile_required`).

### 4) 팩스 청구 월 귀속 정확성
- `0097 platform_org_usage`의 신규 팩스 집계를 **각 job 자신의 접수 시각**(`coalesce(job.submitted_at, completed_at,
  created_at)`)으로 귀속한다. `bill_issues.issued_at` 기준 제거 — 재발행이 issued_at을 갱신해도 과거 성공 job이 늦은 달로
  이동하거나 확정 이전 청구서를 이중 계상하지 않는다(재시도는 자체 submitted_at의 새 job이라 각자 달에 남는다).
- 검증: `platform_admin_checks.sql`에 `platform_org_usage`가 `coalesce(job.submitted_at…)`로 귀속하는지 정적 assert 추가.

### 5) 클라이언트 견적 정확성
- `MessagingComposer`의 `quote_message_points` 입력을 **수신자별 최종 `renderedBody`를 담은 `submissionRecipients`**로 바꿔,
  화면에 표시되는 SMS/LMS 건수·포인트가 예약/정산과 일치한다(공통 본문 단일 분류 제거). `submissionRecipients` 계산을
  `quoteInput` 앞으로 이동.
- 테스트: `MessagingComposer.test.tsx`(개인화 2명의 서로 다른 renderedBody가 견적 입력에 각각 담기는지 캡처).

### 6) SQL 위생
- 이번 Popbill 마이그레이션에서 재정의/변경된 SECURITY DEFINER 함수 `record_bill_delivery`(0095)·
  `reserve_scheduled_message`(0096)를 **`set search_path = ''` + `public`/`auth` 완전 수식**으로 정리했다(권한·동작 보존).
- 검증: `p4_point_checks.sql`에 두 함수의 `proconfig`가 정확히 `search_path=`(빈 문자열)인지 정적 assert 추가.

### 7) 리뷰 트리아지 / 문서
- **조직 LMS 포인트 단가는 seed하지 않는다.** `message_point_rates`의 `lms` 미설정 시 `RATE_NOT_CONFIGURED`는 승인되지
  않은 가격으로 청구하지 않기 위한 **의도된 안전 게이트**다(가정·리스크 #3 정정: 이는 조직 포인트 단가가 아니라 플랫폼
  KRW 청구 단가 `platform_settings.rate_krw_lms`에 대한 설명이었음; 조직 포인트 단가는 애초에 seed하지 않음). 운영 런북
  `docs/ops/popbill-delivery.md §7`에 게이트·관리자 조치·멱등/타임아웃 주의를 명시했다.
- **환경 한계(유지)**: 로컬 DB/psql 미가용으로 마이그레이션·verify SQL은 **정적 작성·정적 assert만** 수행했다
  (`supabase db reset` + `p4_point_checks.sql`/`platform_admin_checks.sql` 실행은 DB 환경에서 필요). Popbill 테스트 자격증명
  smoke(SMS/LMS/알림톡/1p 팩스 접수→결과→정산)도 자격증명 미제공으로 **미수행**. DB 실행/실발송 성공을 주장하지 않는다.

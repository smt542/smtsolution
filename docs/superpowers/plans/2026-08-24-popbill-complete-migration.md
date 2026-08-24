# Popbill 완전 전환 Implementation Plan

> **For agentic workers:** 저장소의 전역 정책이 실행 방식을 우선 지정한다. 이 계획은 Orca가 추적하는 단일 Claude 작업으로 수행하며, `superpowers:subagent-driven-development`, `superpowers:executing-plans`, 별도 git worktree는 사용하지 않는다. 각 단계의 체크박스와 TDD 순서는 그대로 따른다.
>
> **설계 원본:** `docs/superpowers/specs/2026-08-24-popbill-complete-migration-design.md`

**Goal:** NCP 문자·알림톡 구현과 팩스 전송 stub을 제거하고, Popbill 접수·결과 조회를 기준으로 SMS/LMS·알림톡·팩스를 실제 발송하며 성공 건/성공 페이지에 대해서만 확정 과금한다.

**Architecture:** Route Handler는 짧은 접수까지만 수행하고 Popbill 접수번호와 수신자 매핑을 DB에 저장한다. 접수 이후 포인트는 `provider_pending`으로 유지하며, 별도 재조회 작업이 Popbill의 최종 결과를 수집한 뒤 DB RPC가 성공 수신자만 정산하고 실패 금액을 해제한다. 팩스는 서버에서 A4 PDF를 생성하여 세대별 한 건으로 접수하고, 성공 페이지 수를 월 과금 원장으로 사용한다. 새 provider 작업이 없는 전환 월의 기존 NCP/팩스 기록은 월 청구 조회에서만 호환 집계한다.

**Tech Stack:** Next.js 16.3 App Router/Node.js Route Handlers, TypeScript, Popbill Node SDK 1.64.2, React PDF, QRCode, Supabase/PostgreSQL RPC·RLS, Vitest/Testing Library.

---

## 고정 계약과 안전 규칙

- 서버 비밀값은 `POPBILL_*` 이름만 사용하며 `NEXT_PUBLIC_` 접두사는 금지한다.
- 필수 설정이 없으면 실제 전송 API는 `PROVIDER_NOT_CONFIGURED`를 반환한다. 개발 환경이라고 성공 stub으로 기록하지 않는다.
- Popbill 접수번호는 성공 결과가 아니다. 접수 시 `queued/provider_pending`, `state=3` 최종 결과를 확인한 뒤 `success/failed`로 확정한다.
- 문자 제품은 Popbill 바이트 규칙(ASCII 1바이트, 그 외 문자 2바이트)으로 `sms`(90 이하)와 `lms`(91~2000)를 나눈다. 2000바이트 초과는 접수 전에 거절한다.
- 알림톡 대체문자(`altSendType`)는 비활성화한다. 실패 시 ERP가 임의로 SMS를 재발송하지 않는다.
- 한 요청의 제품별 배치는 최대 1,000명이다. `requestNum`은 36자 이하, 수신자 `interOPRefKey`는 결정적이고 20자 이하다.
- 수동 만료 해제는 아직 provider에 전달하지 않은 `reserved`만 허용한다. `provider_pending`과 `reconcile_required`는 provider 결과 확인 없이 해제하지 않는다.
- 팩스 PDF는 메모리에서만 만들고 영구 파일로 저장하지 않는다. DB에는 접수번호, 상태, 성공/실패/과금/환불 페이지 수만 남긴다.
- 신규 SQL 함수는 `security definer set search_path = ''`, 완전 수식 이름, 최소 EXECUTE 권한, RLS를 사용한다.
- 새 월 청구는 성공 수신자와 성공 팩스 페이지를 집계한다. provider 작업이 없는 레거시 행에 한해 기존 `message_logs`/`bill_issues` 기록을 fallback으로 합산한다.
- 관련 Next.js 코드 변경 전 확인한 문서: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md`.

## 공통 완료 조건

- 각 작업은 실패 테스트 추가 → 해당 테스트 실패 확인 → 최소 구현 → 해당 테스트 통과 → 관련 회귀 테스트 순으로 진행한다.
- 사용자가 만든 untracked 파일(`debug.log`, zip 파일, `docs/parallel-kickoff/*`)은 수정·삭제·stage하지 않는다.
- DB 연결 정보가 없는 환경에서는 SQL verify 파일의 정적 검토와 애플리케이션 테스트를 수행하고, 실제 DB 검증 미수행 사실을 최종 보고에 명시한다.
- 실제 Popbill 자격 증명이 없는 환경에서는 SDK 경계까지 mock으로 검증하고, 테스트 계정 smoke test는 실행 명령과 체크리스트를 남긴다.

---

## Task 1: Popbill 의존성, 설정, 제품 분류 기반

**Files**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Create: `types/popbill.d.ts`
- Create: `lib/popbill/config.ts`
- Create: `lib/popbill/config.test.ts`
- Create: `lib/popbill/sdk.ts`
- Create: `lib/messaging/product.ts`
- Create: `lib/messaging/product.test.ts`
- Modify: `lib/messaging/preset.ts`
- Modify: `lib/messaging/preset.test.ts`

- [ ] 1. `npm install popbill@1.64.2 @react-pdf/renderer@4.8.1 qrcode@1.5.4 @fontsource/noto-sans-kr@5.3.0 && npm install -D @types/qrcode@1.5.6`로 버전을 고정한다.
- [ ] 2. `config.test.ts`에 필수 키 누락, boolean 파싱, 테스트/운영 모드, 발신번호별 설정을 검증하는 실패 테스트를 작성하고 `npm test -- lib/popbill/config.test.ts`로 실패를 확인한다.
- [ ] 3. `product.test.ts`에 ASCII, 한글, 90/91/2000/2001바이트 경계와 제목이 있는 LMS를 검증하는 실패 테스트를 작성한다.
- [ ] 4. `readPopbillConfig()`는 아래 필드를 trim/검증하고 비밀값을 로그나 오류 payload에 포함하지 않게 구현한다.

```ts
type PopbillConfig = {
  linkId: string;
  secretKey: string;
  corpNum: string;
  userId?: string;
  isTest: boolean;
  ipRestrictOn: boolean;
  useStaticIp: boolean;
  useLocalTime: boolean;
  smsSender: string;
  kakaoSender: string;
  faxSender: string;
};
```

- [ ] 5. `types/popbill.d.ts`에는 실제 사용하는 `config`, `MessageService`, `KakaoService`, `FaxService`, 접수/결과 callback만 최소 선언하고 `sdk.ts`에서 서비스 singleton을 만든다.
- [ ] 6. `popbillByteLength()`와 `classifyMessageProduct(body, subject?)`를 구현하여 `sms | lms` 또는 `MESSAGE_TOO_LONG`을 반환한다.
- [ ] 7. `MessageChannel`은 UI 라우팅용 `sms | alimtalk`, 별도 `MessageProduct`는 `sms | lms | alimtalk`으로 두어 자동 모드와 실제 과금 제품을 혼동하지 않는다.
- [ ] 8. `.env.example`에 `POPBILL_LINK_ID`, `POPBILL_SECRET_KEY`, `POPBILL_CORP_NUM`, `POPBILL_USER_ID`, `POPBILL_IS_TEST`, `POPBILL_IP_RESTRICT_ON`, `POPBILL_USE_STATIC_IP`, `POPBILL_USE_LOCAL_TIME`, `POPBILL_SMS_SENDER`, `POPBILL_KAKAO_SENDER`, `POPBILL_FAX_SENDER`를 설명과 함께 추가한다.
- [ ] 9. `npm test -- lib/popbill/config.test.ts lib/messaging/product.test.ts lib/messaging/preset.test.ts && npm run lint -- lib/popbill lib/messaging/product.ts lib/messaging/preset.ts types/popbill.d.ts`를 통과시킨다.
- [ ] 10. `git add package.json package-lock.json .env.example types/popbill.d.ts lib/popbill lib/messaging/product.ts lib/messaging/product.test.ts lib/messaging/preset.ts lib/messaging/preset.test.ts && git commit -m "feat: add Popbill provider foundation"`.

## Task 2: Provider 접수·수신자 상태 DB 기반

**Files**

- Create: `supabase/migrations/0095_popbill_dispatch_foundation.sql`
- Modify: `supabase/verify/p4_point_checks.sql`

- [ ] 1. verify 파일에 다음 실패 검증을 먼저 추가한다: `provider_dispatch_jobs`, `provider_dispatch_recipients` 존재, receipt/request 유일성, 20자 ref 제한, 허용 상태, RLS, 일반 사용자 직접 쓰기 차단.
- [ ] 2. `provider_dispatch_jobs`를 생성한다. 필수 열은 `org_id`, `provider='popbill'`, `kind(message|fax)`, `product(sms|lms|alimtalk|fax)`, `reservation_id`, `message_log_id`, `schedule_id`, `bill_issue_id`, `request_num`, `receipt_num`, `status(submitting|pending|sent|partial|failed|reconcile_required)`, `next_poll_at`, `lease_until`, `poll_attempts`, `last_error_code/message`, 팩스 페이지 수, 생성/접수/완료 시각이다.
- [ ] 3. `provider_dispatch_recipients`를 생성한다. `job_id`, 원본 64자 `recipient_key`, 20자 이하 `provider_ref_key`, `product`, `status(pending|success|failed)`, `result_code/message`, `completed_at`을 저장하고 `(job_id, recipient_key)`, `(job_id, provider_ref_key)`를 unique로 둔다.
- [ ] 4. 아래 상태 전이를 보장하는 제약/함수를 추가한다.

```text
submitting -> pending -> sent | partial | failed
                    \-> reconcile_required
```

- [ ] 5. `claim_provider_dispatch_jobs(p_limit)`는 `next_poll_at <= now()`, 만료된 lease를 `FOR UPDATE SKIP LOCKED`로 잡아 5분 lease와 증가한 `poll_attempts`를 반환하게 한다.
- [ ] 6. service-role 전용 insert/update RPC 또는 권한을 제공하고 authenticated/anon의 테이블 직접 쓰기를 차단한다. 조직 사용자는 기존 메시지/고지서 화면 RPC를 통해 읽기만 한다.
- [ ] 7. 로컬 DB가 있으면 `supabase db reset` 후 `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/verify/p4_point_checks.sql`을 통과시킨다. DB가 없으면 SQL 파싱·정적 확인 결과를 기록한다.
- [ ] 8. `git add supabase/migrations/0095_popbill_dispatch_foundation.sql supabase/verify/p4_point_checks.sql && git commit -m "feat: persist Popbill dispatch jobs"`.

## Task 3: LMS 견적과 provider-pending 정산

**Files**

- Create: `supabase/migrations/0096_popbill_point_settlement.sql`
- Modify: `supabase/verify/p4_point_checks.sql`
- Modify: `hooks/reactquery/messaging/apis.ts`
- Modify: `hooks/reactquery/messaging/apis.test.ts`
- Modify: `hooks/reactquery/platform/pointBilling.ts`
- Modify: `hooks/reactquery/platform/pointBilling.test.ts`
- Modify: `app/(staff)/staff/messaging/components/MessagePointQuoteCard.tsx`
- Modify: `app/(staff)/staff/messaging/components/MessagePointQuoteCard.test.tsx`
- Modify: `app/(platform-admin)/platform-admin/points/components/MessagePointRateModal.tsx`

- [ ] 1. API/UI 테스트를 먼저 `smsCount`, `lmsCount`, `alimtalkCount`와 제품별 단가/포인트를 기대하도록 바꾸고 실패를 확인한다.
- [ ] 2. SQL verify에 활성 제품 3종, LMS 미설정 시 `RATE_NOT_CONFIGURED`, provider 접수 후 만료 해제 금지, 중복 최종 정산 idempotency, 성공 수신자만 차감하는 검증을 추가한다.
- [ ] 3. `message_point_rates.channel` 제약을 `sms|lms|alimtalk`으로 확장한다. 기존 조직에 임의 LMS 단가를 seed하지 않고 관리자 설정 전 LMS 견적은 명시적으로 실패시킨다.
- [ ] 4. `resolve_message_point_quote`와 `reserve_message_points`에 최종 렌더링 본문을 전달한다. DB의 Popbill 바이트 함수는 ASCII 코드 포인트만 1, 나머지는 2로 합산하고 SMS/LMS 제품과 단가를 서버에서 다시 결정한다.
- [ ] 5. 예약 상태에 `provider_pending`을 추가한다. `mark_message_reservation_provider_pending`은 receipt가 저장된 작업과 예약을 같은 트랜잭션에서 연결한다.
- [ ] 6. `settle_message_points_from_jobs(p_reservation_id)`는 terminal 수신자 행을 원천으로 성공 포인트만 ledger에 기록하고, 실패분을 해제하며, 전체/부분/실패 message log 결과를 계산한다. 두 번 호출해도 ledger가 한 번만 변해야 한다.
- [ ] 7. 기존 수동 해제 RPC와 관리자 목록을 수정해 `provider_pending` 및 미확인 `reconcile_required`는 해제 후보에서 제외한다.
- [ ] 8. 프런트 견적 타입·카드·단가 모달에 LMS를 추가하고, 2,000바이트 초과 및 LMS 단가 미설정 오류 문구를 사용자에게 보여준다.
- [ ] 9. `npm test -- hooks/reactquery/messaging/apis.test.ts hooks/reactquery/platform/pointBilling.test.ts app/\(staff\)/staff/messaging/components/MessagePointQuoteCard.test.tsx`를 통과시킨다.
- [ ] 10. DB 가능 시 reset/verify를 반복하고 `git add ... && git commit -m "feat: settle Popbill message results"`로 이 작업의 파일만 커밋한다.

## Task 4: Popbill 문자·알림톡 adapter와 배치 조립

**Files**

- Create: `lib/popbill/types.ts`
- Create: `lib/popbill/messages.ts`
- Create: `lib/popbill/messages.test.ts`
- Create: `lib/messaging/submission.ts`
- Create: `lib/messaging/submission.test.ts`
- Modify: `lib/messaging/render.ts`
- Modify: `lib/messaging/render.test.ts`

- [ ] 1. callback 성공/오류, SMS/LMS/알림톡 메서드 선택, 1,000명 chunk, 빈 `altSendType`, receipt 추출을 mock SDK로 검증하는 실패 테스트를 쓴다.
- [ ] 2. `makeProviderRef(index, recipientKey)`는 영문/숫자로만 된 20자 이하 결정적 키를 만들고 충돌 검사를 수행한다.
- [ ] 3. `makeRequestNum(scope, id, chunkIndex)`는 동일 입력에 동일한 36자 이하 값을 만들며 재시도 중복 접수를 막는 기준 키로 사용한다.
- [ ] 4. `sendSMS_multi`, `sendLMS_multi`, `sendATS_multi` callback을 Promise로 감싼다. 응답은 공통 형태로 정규화한다.

```ts
type ProviderSubmission = {
  requestNum: string;
  receiptNum: string;
  product: "sms" | "lms" | "alimtalk";
  recipients: Array<{ recipientKey: string; providerRefKey: string }>;
};
```

- [ ] 5. 알림톡은 승인된 template code와 channel sender를 사용하고 대체문자 인자를 빈 값으로 전달한다. 렌더된 템플릿 변수 누락은 provider 호출 전에 거절한다.
- [ ] 6. 제품별로 group한 뒤 1,000개씩 chunk하고 각 chunk를 독립 job으로 저장할 수 있는 submission plan을 만든다.
- [ ] 7. `npm test -- lib/popbill/messages.test.ts lib/messaging/submission.test.ts lib/messaging/render.test.ts`와 관련 lint를 통과시킨다.
- [ ] 8. `git add lib/popbill/types.ts lib/popbill/messages.ts lib/popbill/messages.test.ts lib/messaging/submission.ts lib/messaging/submission.test.ts lib/messaging/render.ts lib/messaging/render.test.ts && git commit -m "feat: submit Popbill message batches"`.

## Task 5: 즉시 발송을 접수 기반으로 전환

**Files**

- Modify: `lib/messaging/dispatch.ts`
- Modify: `lib/messaging/dispatch.test.ts`
- Modify: `app/api/messaging/send/route.ts`
- Modify: `app/api/messaging/send/route.test.ts`
- Modify: `hooks/reactquery/messaging/apis.ts`
- Modify: `hooks/reactquery/messaging/apis.test.ts`
- Modify: `app/(staff)/staff/messaging/components/MessagingComposer.tsx`
- Modify: `app/(staff)/staff/messaging/components/MessagingComposer.test.tsx`

- [ ] 1. route 테스트를 접수 성공=`202 queued`, 일부 batch 접수 실패=`reconcile_required` 또는 안전한 실패, 설정 누락=`503 PROVIDER_NOT_CONFIGURED`, 중복 requestNum 재시도로 작성하고 기존 구현이 실패하는지 확인한다.
- [ ] 2. `dispatch.ts`를 provider-neutral orchestration으로 바꾼다: 인증/권한 → 서버 견적 → 예약 → job/recipient `submitting` 저장 → Popbill 호출 → receipt 저장 및 `provider_pending` 전환.
- [ ] 3. Popbill 호출 전에 실패하면 예약을 안전하게 해제한다. 호출 결과가 불명확한 timeout/네트워크 오류는 재발송하지 않고 job과 예약을 `reconcile_required`로 남긴다.
- [ ] 4. 여러 batch 중 일부만 receipt를 얻은 경우 receipt가 있는 batch는 polling 대상에 유지하고, 미접수 batch만 해제 가능한 금액으로 분리 정산할 수 있게 DB 함수를 사용한다.
- [ ] 5. Route Handler에 `export const runtime = "nodejs"`를 명시하고 provider 비밀값/원본 전화번호를 응답하거나 로그에 노출하지 않는다.
- [ ] 6. 클라이언트 응답을 `{status:"queued", logId, queuedCount, reservedPoints}`로 바꾸고 토스트를 “발송 접수 완료, 결과 확인 중”으로 표시한다. 접수를 `sent`로 표시하지 않는다.
- [ ] 7. `npm test -- lib/messaging/dispatch.test.ts app/api/messaging/send/route.test.ts hooks/reactquery/messaging/apis.test.ts app/\(staff\)/staff/messaging/components/MessagingComposer.test.tsx`를 통과시킨다.
- [ ] 8. 이 작업 파일만 `git commit -m "feat: queue immediate messages through Popbill"`로 커밋한다.

## Task 6: 예약 발송 worker를 동일 접수 파이프라인으로 전환

**Files**

- Modify: `lib/messaging/drainSchedules.ts`
- Modify: `lib/messaging/drainSchedules.test.ts`
- Modify: `app/api/messaging/dispatch-scheduled/route.ts`
- Modify: `app/api/messaging/dispatch-scheduled/route.test.ts`
- Modify: `supabase/migrations/0096_popbill_point_settlement.sql`

- [ ] 1. 예약 메시지가 Popbill receipt를 받은 뒤에도 `sending` 상태로 남고, `message_log_id`가 즉시 연결되며, 최종 결과 전에는 `sent`가 되지 않는 실패 테스트를 작성한다.
- [ ] 2. `drainSchedules`가 Task 5의 동일 submission service를 호출하게 만들고 per-recipient NCP 호출 및 즉시 `settle_message_points`를 제거한다.
- [ ] 3. claim 후 reserve 시 생성된 `message_log_id`를 schedule에 즉시 저장하여 reconciliation이 원래 schedule을 최종화할 수 있게 한다.
- [ ] 4. 모든 job terminal 후 schedule을 `sent|failed`로, 성공/실패 혼합은 스키마가 허용하는 명시적 `partial` 상태로 최종화하도록 제약과 RPC를 갱신한다.
- [ ] 5. `CRON_SECRET` timing-safe 비교와 기존 조직 권한 경로를 유지하고, provider 오류에서 민감정보 없는 코드만 반환한다.
- [ ] 6. `npm test -- lib/messaging/drainSchedules.test.ts app/api/messaging/dispatch-scheduled/route.test.ts`를 통과시킨다.
- [ ] 7. 관련 SQL verify 후 `git commit -m "feat: queue scheduled messages through Popbill"`.

## Task 7: 결과 조회와 idempotent 최종 정산

**Files**

- Create: `lib/popbill/results.ts`
- Create: `lib/popbill/results.test.ts`
- Create: `lib/messaging/reconcile.ts`
- Create: `lib/messaging/reconcile.test.ts`
- Create: `app/api/delivery/reconcile/route.ts`
- Create: `app/api/delivery/reconcile/route.test.ts`
- Modify: `supabase/migrations/0096_popbill_point_settlement.sql`

- [ ] 1. Popbill `state=3/result=100` 성공, terminal 실패, pending, 알 수 없는 result code, 중복 polling, 부분 결과, 24시간 초과를 먼저 테스트한다.
- [ ] 2. 문자/알림톡 결과 조회 callback을 Promise로 감싸고 provider ref를 `provider_dispatch_recipients`에 매핑한다. 응답에 없는 수신자는 pending으로 유지한다.
- [ ] 3. 다음 backoff를 한 함수로 구현하고 fake timer로 검증한다: 최초 10분 1분, 2시간까지 5분, 24시간까지 30분, 이후 `reconcile_required`.
- [ ] 4. `reconcilePendingDeliveries(limit)`는 DB claim → 제품별 Popbill 조회 → terminal 결과 upsert → job aggregate → 모든 관련 job terminal이면 `settle_message_points_from_jobs` 호출 순으로 동작한다.
- [ ] 5. 같은 receipt/result를 반복 처리해도 recipient, ledger, message log, schedule이 한 번만 최종화되게 DB unique와 RPC를 함께 검증한다.
- [ ] 6. `/api/delivery/reconcile`는 `CRON_SECRET`만 허용하고 `processed/pending/finalized/reconcileRequired` 집계만 반환한다. `export const runtime = "nodejs"`를 명시한다.
- [ ] 7. `npm test -- lib/popbill/results.test.ts lib/messaging/reconcile.test.ts app/api/delivery/reconcile/route.test.ts`를 통과시킨다.
- [ ] 8. SQL verify 후 `git commit -m "feat: reconcile Popbill delivery results"`.

## Task 8: 서버 PDF와 Popbill 팩스 접수

**Files**

- Create: `lib/bill/faxData.ts`
- Create: `lib/bill/faxData.test.ts`
- Create: `lib/bill/faxPdf.tsx`
- Create: `lib/bill/faxPdf.test.tsx`
- Create: `lib/popbill/fax.ts`
- Create: `lib/popbill/fax.test.ts`
- Create: `app/api/bill/fax/send/route.ts`
- Create: `app/api/bill/fax/send/route.test.ts`
- Modify: `lib/bill/document.ts`
- Modify: `lib/bill/document.test.ts`
- Modify: `supabase/migrations/0095_popbill_dispatch_foundation.sql`

- [ ] 1. 기존 `GiroPrintView`와 동일 핵심 값(조직/건물/동호/청구기간/금액/납부계좌/안내문/QR payload)이 server data contract에 포함되는 실패 테스트를 작성한다.
- [ ] 2. 조직 접근 권한과 bill issue 소유권을 서버에서 검증하고, 클라이언트가 보낸 금액/계좌/수신자 이름을 신뢰하지 않는 `loadFaxDocumentData(billIssueId)`를 구현한다.
- [ ] 3. `@react-pdf/renderer`로 단일 A4 페이지 PDF를 만들고 Noto Sans KR WOFF font를 `require.resolve("@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff")`로 등록한다. `qrcode.toDataURL()`로 QR 이미지를 삽입한다.
- [ ] 4. PDF 테스트는 `%PDF` 헤더, 0보다 큰 buffer, 필수 데이터 누락 오류를 검증한다. 렌더링 결과 snapshot 전체를 고정하지 않는다.
- [ ] 5. `sendFaxBinary`를 Promise로 감싸고 한 세대/한 PDF/한 job, 결정적 requestNum, 발신번호 설정을 검증한다. 생성된 buffer를 디스크에 쓰지 않는다.
- [ ] 6. fax route는 선택된 bill issue마다 독립 job을 생성하고 접수 결과를 `{queued, failed}`로 반환한다. timeout은 재전송 대신 `reconcile_required`로 남긴다.
- [ ] 7. 팩스 상태에 `queued|partial`을 추가하고 과거 `sent|failed|scheduled` 행의 호환성을 유지한다. 재시도는 기존 `bill_issue`를 덮어쓰지 않고 새 append-only job을 만든다.
- [ ] 8. `npm test -- lib/bill/faxData.test.ts lib/bill/faxPdf.test.tsx lib/popbill/fax.test.ts app/api/bill/fax/send/route.test.ts lib/bill/document.test.ts`를 통과시킨다.
- [ ] 9. `git commit -m "feat: submit bill PDFs by Popbill fax"`.

## Task 9: 팩스 결과 조회와 화면 상태

**Files**

- Modify: `lib/popbill/results.ts`
- Modify: `lib/popbill/results.test.ts`
- Modify: `lib/messaging/reconcile.ts`
- Modify: `lib/messaging/reconcile.test.ts`
- Modify: `hooks/reactquery/bill/apis.ts`
- Modify: `hooks/reactquery/bill/apis.test.ts`
- Modify: `app/(staff)/staff/bill/components/DocumentOutputModal.tsx`
- Modify: `app/(staff)/staff/bill/components/DocumentOutputModal.test.tsx`

- [ ] 1. fax `state=3/result=100`, 부분 성공, `sendPageCnt/successPageCnt/failPageCnt/chargePageCnt/refundPageCnt`, 코드 506/517을 포함한 실패 테스트를 추가한다.
- [ ] 2. reconciliation이 fax 결과를 job에 기록하고 `success_page_count > 0`이면 성공 페이지 기준 상태를 계산하게 한다. provider 비용 분석용 charge/refund 페이지도 별도로 보존한다.
- [ ] 3. `sendBillFaxes()`를 새 Route Handler 호출로 교체하고 기존 `recordBillDelivery(..., "sent")` 가짜 성공 기록을 제거한다.
- [ ] 4. 모달은 접수 완료를 전송 완료로 표현하지 않고 세대별 `접수 중/결과 확인 중/성공/일부 성공/실패/확인 필요` 상태와 실패 후 명시적 재시도 버튼을 보여준다.
- [ ] 5. 재시도는 terminal 실패 job에만 허용하고 pending/reconcile_required job의 중복 전송을 막는다.
- [ ] 6. `npm test -- lib/popbill/results.test.ts lib/messaging/reconcile.test.ts hooks/reactquery/bill/apis.test.ts app/\(staff\)/staff/bill/components/DocumentOutputModal.test.tsx`를 통과시킨다.
- [ ] 7. `git commit -m "feat: reconcile and display Popbill fax results"`.

## Task 10: 월 청구를 성공 건·성공 페이지 기준으로 변경

**Files**

- Create: `supabase/migrations/0097_popbill_platform_billing.sql`
- Modify: `supabase/verify/platform_admin_checks.sql`
- Modify: `hooks/reactquery/platform/settings.ts`
- Modify: `hooks/reactquery/platform/settings.test.tsx`
- Modify: `hooks/reactquery/platform/billing.ts`
- Modify: `hooks/reactquery/platform/billing.test.tsx`
- Modify: `app/(platform-admin)/platform-admin/settings/page.tsx`
- Modify: `app/(platform-admin)/platform-admin/billing/page.tsx`
- Modify: `app/(platform-admin)/platform-admin/billing/page.test.tsx`

- [ ] 1. 실패 테스트에서 `rate_krw_lms`, `sms_count`, `lms_count`, `alimtalk_count`, `fax_page_count`와 각 금액을 독립 검증한다.
- [ ] 2. `platform_hq_settings`/invoice snapshot에 LMS 단가·건수를 추가하고 기존 `fax_count`를 호환 열로 유지하면서 새 계산에는 `fax_page_count`를 사용한다.
- [ ] 3. 월별 신규 메시지 집계는 해당 월에 terminal success인 `provider_dispatch_recipients`만 제품별로 센다. 팩스는 job의 `success_page_count` 합계를 센다.
- [ ] 4. 전환 월 호환 집계는 provider job이 연결되지 않은 레거시 `message_logs` 성공 건과 fax `bill_issues` sent 행만 fallback으로 더해 중복을 방지한다.
- [ ] 5. invoice 확정 후 단가/usage snapshot 불변성과 기존 invoice read 호환성을 SQL verify로 검증한다.
- [ ] 6. 설정/청구 UI에 LMS와 “팩스 성공 페이지” 라벨을 추가하고 총액 계산을 새 필드로 바꾼다.
- [ ] 7. `npm test -- hooks/reactquery/platform/settings.test.tsx hooks/reactquery/platform/billing.test.tsx app/\(platform-admin\)/platform-admin/billing/page.test.tsx`를 통과시킨다.
- [ ] 8. DB reset/verify 후 `git commit -m "feat: bill confirmed Popbill usage"`.

## Task 11: NCP 제거와 운영 문서 전환

**Files**

- Delete: `lib/messaging/ncp.ts`
- Delete: `lib/messaging/ncp.test.ts`
- Delete: `lib/messaging/alimtalk.ts`
- Delete: `lib/messaging/alimtalk.test.ts`
- Modify: `.env.example`
- Modify: `docs/ops/eventbridge-scheduled-messaging.md`
- Create: `docs/ops/popbill-delivery.md`
- Modify: any source returned by the NCP search below

- [ ] 1. `rg -n "NCP_|ncloud|sens|sendNcp|sendAlimtalk|billingMode.*stub|provider.*stub" --glob '!docs/superpowers/**' --glob '!*.zip' .`로 런타임 참조 목록을 기록한다.
- [ ] 2. NCP adapter와 테스트를 삭제하고 모든 import/type/env/UI 문구를 Popbill 접수·확정 의미로 교체한다.
- [ ] 3. `.env.example`에서 NCP 변수와 암묵적 stub 안내를 제거한다. Kakao Business Channel/승인 템플릿은 Popbill 알림톡에도 필요하고 Kakao Developers OAuth 계정은 별도임을 적는다.
- [ ] 4. 운영 문서에 Popbill 가입/연동회원, 발신번호 등록, 카카오 채널/템플릿 승인, 팩스 발신번호, 테스트→운영 전환, IP 제한, 잔액 모니터링, 키 교체 절차를 작성한다. 아이디/비밀번호 공유 대신 연동용 권한/키 전달을 권장한다.
- [ ] 5. EventBridge 문서에 기존 예약 발송 endpoint와 신규 `/api/delivery/reconcile` 호출 주기, 동일 `CRON_SECRET`, 경보 기준(`reconcile_required`, 24시간 pending, provider 잔액)을 추가한다.
- [ ] 6. 두 번째 `rg` 결과가 과거 설계 문서를 제외하고 0건인지 확인하고 `npm run lint && npm test`를 통과시킨다.
- [ ] 7. `git commit -m "chore: remove NCP delivery integration"`.

## Task 12: 전체 검증과 자격 증명 smoke 체크리스트

**Files**

- Modify: `docs/ops/popbill-delivery.md` only if verification reveals missing steps

- [ ] 1. `git status --short`로 이번 작업 파일과 사용자 소유 untracked 파일을 구분한다. 사용자 파일은 stage하지 않는다.
- [ ] 2. `npm test`를 실행하고 실패가 있으면 원인을 좁힌 테스트 명령을 먼저 재현한 뒤 수정한다.
- [ ] 3. `npm run lint`와 `npm run build`를 실행한다. Next 16 경고 중 이번 diff가 만든 것은 제거한다.
- [ ] 4. `git diff --check`와 `rg -n "NCP_|ncloud|sens|TODO|TBD|implement later" --glob '!docs/superpowers/**' --glob '!*.zip' .`를 실행한다.
- [ ] 5. DB 환경이 있으면 `supabase db reset` 후 `p4_point_checks.sql`, `platform_admin_checks.sql`을 실행하고, 즉시/예약/중복 reconcile/부분 성공/팩스 페이지/레거시 fallback을 확인한다.
- [ ] 6. Popbill 테스트 키가 있으면 운영 발신번호가 아닌 허용된 테스트 수신처로 SMS 1건, LMS 1건, 알림톡 1건, 1페이지 팩스 1건을 접수하고 receipt → pending → terminal → 정확한 정산을 확인한다. 자격 증명이 없으면 이 단계를 미수행으로 명시한다.
- [ ] 7. `git log --oneline 219b4ae..HEAD`와 `git diff 219b4ae..HEAD --stat`으로 의도한 커밋/파일만 포함되었는지 검토한다.
- [ ] 8. 코드 리뷰에서 발견한 문제는 같은 Orca Claude 작업으로 돌려보내고, 수정 뒤 `npm test && npm run lint && npm run build`를 다시 실행한다.
- [ ] 9. 최종 문서 보완이 있으면 해당 파일만 `git commit -m "docs: finalize Popbill delivery runbook"`로 커밋한다.

---

## 최종 인수 기준

- 즉시/예약 메시지는 Popbill에만 접수되며 NCP 런타임 코드와 환경변수가 없다.
- SMS/LMS/알림톡 각각의 수신자·단가·포인트가 견적, 예약, 최종 정산, 월 청구에서 일치한다.
- receipt만 받은 작업은 성공으로 표시하거나 확정 과금하지 않는다.
- 중복 route 호출과 중복 polling이 중복 발송·중복 ledger·중복 월 청구를 만들지 않는다.
- 24시간 미확인 작업은 `reconcile_required`로 남고 관리자 만료 해제로 돈을 잘못 풀지 않는다.
- 팩스는 서버 생성 PDF를 세대별로 보내고 실제 성공 페이지 수만 고객 월 청구에 반영한다.
- 알림톡 대체문자는 꺼져 있으며 카카오 채널/템플릿 승인 실패가 명확한 provider 오류로 남는다.
- 설정 누락은 성공 stub이 아닌 `PROVIDER_NOT_CONFIGURED`로 노출된다.
- 전체 테스트, lint, production build 및 가능한 DB verify가 통과하고 미수행 smoke 검증은 운영 문서에 명시된다.

# 관리업체(org)별 발신번호 — 설계 스펙

- 작성일: 2026-09-03
- 상태: 검토 대기 (구현 전 승인 게이트)
- 트랙: 별도 작업 트랙 (문자·알림톡 관리 / 셋업 설정 연계)

## 1. 목적 (Why)

현재 SMS/팩스 발신번호는 운영사(파트너) **단일 발신번호**(env `POPBILL_SMS_SENDER`/`POPBILL_FAX_SENDER`)로 고정이다. 관리업체(org)마다 자기 대표번호로 발송하고 싶다는 요구가 있어, **org별 발신번호를 두되, 없으면 운영사 대표번호로 자동 폴백(NVL/COALESCE)** 하는 구조로 만든다.

```
발송 sender = COALESCE(org별 발신번호, 운영사 대표번호 env 기본값)
```

## 2. 범위

**포함**: SMS(LMS 포함) + 팩스 발신번호의 org별 지정·검증·발송 배선.
**제외**:
- **알림톡**(카카오 채널) — org별은 채널 심사/등록이 별개 대공사라 이번 범위 아님. `config.kakaoSender`(env)는 그대로 운영사 채널 공용 유지.
- **건물 단위** 발신번호 — org(관리업체) 단위까지만. (추후 확장 여지)
- 팝빌 **운영 전환**(IS_TEST=false)·실번호 등록 자체 — 운영 절차(클라이언트/운영사)이며 코드 범위 아님.

## 3. 핵심 원칙 (발신번호 사전등록제)

발신번호는 **DB에 저장한다고 발송되지 않는다.** 한국 사전등록제상, 실제로 그 번호로 나가려면 **운영사의 단일 팝빌 계정에 그 번호가 등록·인증**돼 있어야 한다. 따라서:

- 모든 org 발신번호는 **운영사 팝빌 계정 하나**에 등록된다(운영사가 각 업체 통신가입증명으로 등록). 앱은 "어느 org가 어느 (등록된) 번호를 쓰는지"만 저장·선택한다.
- 저장 시 **`checkSenderNumber`로 팝빌 등록 여부를 검증**해, 미등록 번호가 저장되어 런타임 발송 실패로 이어지는 것을 예방한다.

## 4. 데이터 모델 — 마이그레이션 `0125`

`setup_config`(org_id PK, 1 org = 1행)에 컬럼 추가(가산적, 기존 RLS `settings` 권한이 자동 커버 → 신규 정책 불필요):

```sql
-- supabase/migrations/0125_org_sender_numbers.sql
alter table public.setup_config
  add column if not exists sms_sender text,               -- 숫자만 저장(발송용)
  add column if not exists fax_sender text,               -- 숫자만 저장(발송용)
  add column if not exists sms_sender_verified_at timestamptz,
  add column if not exists fax_sender_verified_at timestamptz;

comment on column public.setup_config.sms_sender is 'org별 SMS 발신번호(숫자만). NULL이면 운영사 env 기본값 사용';
comment on column public.setup_config.fax_sender is 'org별 팩스 발신번호(숫자만). NULL이면 운영사 env 기본값 사용';
```

- 기존 `company_phone`/`company_fax`(0123, **표시용 포맷 문자열**)와 **분리**한다. 발신번호는 숫자만.
- `*_verified_at`은 마지막 `checkSenderNumber` 성공 시각(감사·UI 배지용).
- 라이브 적용: Supabase **Management API `/database/query`**(ref `amhtprmapxlizdnsgbeg`)로 out-of-band 적용(Claude). `supabase db push` 아님.

## 5. 발송 sender 배선 (COALESCE)

sender는 **요청당 1회**(요청 org 기준) 계산해 effective `PopbillConfig`로 주입한다. 규칙:

```
effectiveSmsSender = (org.sms_sender?.trim()) || env.POPBILL_SMS_SENDER
effectiveFaxSender = (org.fax_sender?.trim()) || env.POPBILL_FAX_SENDER
```

둘 다 비면 기존대로 `requirePopbillSender`가 `PROVIDER_NOT_CONFIGURED`로 실패(동작 불변).

### 5.1 SMS (`lib/messaging/dispatch.ts` → `lib/popbill/messages.ts`)
- 현재: `dispatchMessages`에 `orgId`가 오지만(`dispatch.ts:132`) `reserve_message_points`에만 쓰이고, submit 단계(`submitReservationBatches`→`submitMessageBatch`→`submitSms`)로는 **전달되지 않음**. `submitMessageBatch`의 `config`는 `readPopbillConfig()`(env) 기본값.
- 변경: `dispatchMessages` 안에서 org의 `setup_config.sms_sender`를 조회(이미 있는 `admin`/`sb` 클라이언트) → `effectiveConfig = { ...readPopbillConfig(), smsSender: orgSms || envSms }` 구성 → 이 config를 `submitReservationBatches`/`SubmitReservationDeps`를 통해 `submitMessageBatch(batch, content, effectiveConfig)`로 전달. (`submitMessageBatch`는 이미 3번째 인자로 `config`를 받음 — 시그니처 확장 최소.)
- LMS도 동일 config를 타므로 자동 적용.

### 5.2 FAX (`app/api/bill/fax/send/route.ts` → `lib/popbill/fax.ts`)
- 현재: 라우트에 `ctx.org_id` 있으나(`route.ts:60`) `submitFax`엔 config 미전달(`fax.ts:35` 기본 env).
- 변경(최소): 라우트에서 org `fax_sender` 1회 조회 → `effectiveConfig = { ...readPopbillConfig(), faxSender: orgFax || envFax }` → `submitFax(input, effectiveConfig)`로 전달. `fax.ts` 시그니처 변경 없음.

## 6. 발신번호 검증 (`checkSenderNumber`)

### 6.1 타입 선언 추가 — `types/popbill.d.ts`
현재 shim은 호출하는 메서드만 선언 → **`checkSenderNumber` 미선언**. MessageService·FaxService 양쪽에 추가:

```ts
checkSenderNumber(
  CorpNum: string,
  SenderNumber: string,
  UserID: string,
  success: (result: { code: number; message?: string }) => void,
  error: (err: PopbillError) => void,
): void;
```
- 성공 결과의 숫자 `code === 1`이면 등록된 번호로 간주(설치된 SDK로 arity·필드 최종 확인 — `UserID` 선택 가능성).

### 6.2 검증 헬퍼 — `lib/popbill/senders.ts`(신규)
`submitWithTimeout`(`lib/popbill/types.ts`) 래퍼 재사용:

```ts
export async function checkSenderRegistered(
  product: "sms" | "fax",
  number: string,
  config = readPopbillConfig(),
): Promise<boolean>  // code===1 → true
```
- product에 따라 `getMessageService`/`getFaxService`(`lib/popbill/sdk.ts`)에서 서비스 선택.
- 미설정(`PROVIDER_NOT_CONFIGURED`)·타임아웃은 검증 실패로 안전 처리.

## 7. 저장 경로 — 신규 서버 라우트

현재 setup 저장은 **브라우저 직접 upsert**(`hooks/reactquery/setupConfig/apis.ts:95` `.from("setup_config").upsert`)라 서버 전용 팝빌 시크릿을 못 쓴다. → **신규 서버 라우트** 추가:

- `app/api/setup/sender/route.ts` (POST) — **검증 후 저장**:
  1. `createClient()` + `get_my_context`로 인증, `settings` 모듈 권한 확인(패턴: `messaging/send/route.ts:49-64`).
  2. body `{ product: "sms"|"fax", number }` 숫자화.
  3. `checkSenderRegistered(product, number)` — 미등록이면 **400 `SENDER_NOT_REGISTERED`**(저장 차단).
  4. 등록 확인 시 `setup_config.{sms_sender|fax_sender}` + `*_verified_at=now()` upsert(RLS 사용자 클라이언트 또는 `createAdminClient()`).
  - 번호 **삭제(폴백으로 되돌리기)**: `number=""` 허용 → 해당 컬럼 NULL + verified_at NULL(검증 스킵).
- (선택) `GET/POST /api/setup/sender/verify` — 저장 없이 검증만(입력 중 즉시 피드백). 최소 구현은 위 저장 라우트 하나로도 충분.

## 8. 셋업 UI — `회사 정보`(CompanyInfoTab)

`app/(staff)/staff/setup/components/CompanyInfoTab.tsx`, 기존 `company_phone`/`company_fax` 표시필드 옆에 **SMS 발신번호 / 팩스 발신번호** 전용 행 추가(각각 입력 + "검증·저장" 버튼 + 검증 배지):

- 입력은 숫자만(하이픈 자동 제거). 저장은 **신규 서버 라우트** 호출(직접 upsert 아님).
- 상태 표시: `*_verified_at` 있으면 "✓ 팝빌 등록 확인(날짜)", 없으면 "미설정 → 운영사 대표번호 사용".
- `FIELDS` 맵 방식은 버튼/상태가 필요해 부적합 → bespoke 행으로 렌더.
- 안내 문구: "발신번호는 운영사 팝빌 계정에 사전 등록된 번호만 사용 가능. 미설정 시 운영사 대표번호로 발송."

## 9. 엣지·에러

- **폴백**: org 값 비면 env 기본값. 둘 다 비면 기존 `PROVIDER_NOT_CONFIGURED`.
- **저장 후 등록 말소**: 검증은 시점 스냅샷. 이후 팝빌에서 말소되면 런타임 `SEND_REJECTED`(기존 경로). `verified_at`은 참고값.
- **테스트 vs 운영**: 검증·발송 모두 `POPBILL_IS_TEST` 따름. 테스트 계정엔 테스트 등록 번호, 운영 계정엔 운영 등록 번호가 각각 있어야 함(이관 안 됨).
- **권한**: 라우트에서 `settings` 모듈 권한 필수(RLS와 이중).

## 10. 검증(테스트)

- 정책상 신규 단위테스트 미작성. **`tsc`·`lint`·`next build`·기존 `vitest` 그린** + 스팟체크로 확인.
- 스팟: (a) org 발신번호 설정→해당 org 발송 시 그 번호로 접수, (b) 미설정 org→env 기본값, (c) 미등록 번호 저장 차단.

## 11. 구현 순서(요약, writing-plans로 상세화)

1. `0125` 마이그레이션 작성 + 라이브 적용(Claude, Mgmt API).
2. `types/popbill.d.ts` checkSenderNumber 선언 + `lib/popbill/senders.ts` 헬퍼.
3. 신규 서버 라우트 `app/api/setup/sender/route.ts`(검증 후 저장) + setupConfig 훅 연동.
4. `CompanyInfoTab` UI(입력·검증·배지).
5. dispatch 배선: SMS effective config 스레딩(`dispatch.ts`) + FAX 라우트 주입(`bill/fax/send/route.ts`).
6. 검증(tsc/lint/build/vitest) + 스팟체크.

구현은 codex 위임(마이그 라이브 적용·git은 Claude). 코딩 착수 전 이 스펙 승인 필요.

## 12. 미정 (Open Questions)

- [ ] `checkSenderNumber` 실제 arity/반환필드 — 설치된 `popbill` 패키지로 최종 확인(선언 조정 가능).
- [ ] "검증만" 라우트를 별도로 둘지, 저장 라우트 하나로 통합할지(UX 취향).
- [ ] 검증 실패 시 **저장 차단** vs **경고 후 저장 허용**(현재 스펙=차단). 운영에서 미등록 저장을 임시 허용할 필요가 있으면 완화.

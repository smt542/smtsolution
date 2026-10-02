# 팝빌 실발송 운영 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팝빌 운영 키를 넣었을 때 허용된 번호에만 실제 문자·팩스가 나가고, 결과가 확정되며, 반복 예약·잔액 부족·발신번호 표시가 운영에서 올바로 동작하게 한다.

**Architecture:** 허용 번호 판정은 `lib/popbill/allowlist.ts`의 순수 함수 하나로 두고 두 곳에서 쓴다. 발송 단계에서는 막힌 수신자를 별도 작업으로 나눠 팝빌을 부르지 않고, 팝빌 어댑터에서는 SDK 직전에 한 번 더 확인한다. 접수 작업에 환경(test/live)을 기록해 결과 재조회가 같은 환경 작업만 보게 하고, 매월 반복 예약은 `message_schedules` 상태 트리거로 어느 확정 경로든 다음 회차를 만든다. 기본 발신번호는 새 GET 라우트와 React Query 훅으로 화면에 보여 준다.

**Tech Stack:** Next.js 16(App Router), TypeScript, Supabase(Postgres·PostgREST RPC), popbill Node SDK, @tanstack/react-query, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-02-popbill-live-switch-design.md`

## Global Constraints

- 테스트 코드를 새로 만들지 않는다(2026-09-16 회사 정책: 프론트 테스트는 E2E만). 태스크 검증 = 스크래치패드 검증 스크립트(커밋하지 않음) + `tsc --noEmit` + eslint.
- 운영 모드 판정은 `PopbillConfig.isTest === false` 하나뿐이다. 테스트 모드 동작은 바꾸지 않는다.
- 차단 코드 문자열: `RECIPIENT_NOT_ALLOWED`. 잔액 부족 앱 코드: `PROVIDER_INSUFFICIENT_BALANCE`.
- 팝빌 잔액 부족 원본 코드: `-99005001`, `-99005003`, `-99005004`, `-99005005`. 재시도하지 않는 그 밖의 원본 코드: `-99005002`, `-99005013`(후불 한도 초과), `-10010039`(허용되지 않은 IP).
- 환경변수 이름: `POPBILL_LIVE_ALLOWLIST`, `POPBILL_LIVE_RESTRICTED_ORG_IDS`.
- 화면 문구는 아래 그대로 쓴다.
  - 전원 차단 — 메신저: "발송 제한 번호라 보내지 않았어요." / 공지: "발송 제한 번호라 보내지 않았습니다."
  - 잔액 부족 — 메신저: "팝빌 충전 잔액이 부족해 발송하지 못했어요. 운영사에 충전을 요청해 주세요." / 공지: "팝빌 충전 잔액이 부족해 발송하지 못했습니다. 운영사에 충전을 요청해 주세요."
  - 일부 차단 접수 토스트 끝에 붙는 말: " · 발송 제한 번호 N명 제외"
- RPC에 인자를 더할 때는 기본값을 두고 옛 시그니처를 drop한다(오버로드 금지). 마이그레이션은 **코드 배포 전에** 운영 DB에 적용한다(새 코드가 새 인자를 보내므로).
- 마이그레이션 번호는 커밋 직전에 `git ls-tree origin/master supabase/migrations/`로 최대 번호를 다시 확인한다(작성 시점 최신 0223 → 0224·0225 예정).
- 커밋은 내 파일만 `git add <경로>`로 올리고, 커밋 직전 `git diff --cached --name-only`를 확인한다. add와 commit을 한 줄로 묶지 않는다.
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## Review Focus

1. 허용 목록에 하이픈·공백이 섞인 번호(`010-1234-5678 `)와 DB 번호(`01012345678`)가 같은 번호로 판정돼야 한다 → Task 1 검증 스크립트.
2. 한 발송에 허용·차단 수신자가 섞이면 허용분만 접수되고, 차단분은 포인트 없이 실패해야 한다 → Task 3 리뷰 + 운영 전환 3d·3d2.
3. 예약 발송이 다시 claim(replay)돼도 차단 작업이 팝빌로 나가지 않아야 한다 → Task 3에서 차단 작업도 기존 `claim_provider_dispatch_submission` 경로를 그대로 탄다.
4. 마이그레이션 적용 후 코드 배포 전까지 옛 코드(옛 인자)가 깨지지 않아야 한다 → Task 5 검증 SQL(새 시그니처·기본값·옛 시그니처 없음) + Task 8 순서.
5. 반복 예약 확정 경로 두 개(`complete_message_schedule`·정산)가 겹쳐도 다음 회차는 1건이어야 한다 → Task 6 롤백 프로브.

## 작업 위치와 순서

- 작업 위치: Orca가 만든 워크트리(브랜치 `PracLee/<이름>`, 아래 `<WT>`). 검증할 때만 master의 node_modules를 정션으로 연결하고 끝나면 반드시 지운다.
  - 연결: `cmd //c "mklink /J <WT>\node_modules C:\Users\leebj\orca\projects\home_erp\node_modules"`
  - 해제: `cmd //c "rmdir <WT>\node_modules"`
- tsc: `node ./node_modules/typescript/bin/tsc --noEmit -p .` / eslint: `node ./node_modules/eslint/bin/eslint.js <파일들>` (워크트리에서 `npm run`·`npx`는 쓰지 않는다).
- 순서: Task 1 → 2 → 3 → 4(같은 파일을 이어서 고침) → 5 → 6 → 7 → 8(운영 DB 적용) → 9(병합). Task 5·6의 마이그레이션은 Task 8에서 운영 DB에 적용한 **뒤에** master에 병합한다.
- Codex 위임 묶음(메모리 여유가 적어 한 번에 하나): A = Task 1~4, B = Task 5~6, C = Task 7. Codex는 구현만 하고 tsc·eslint는 Claude가 돌린다.

---

### Task 1: 허용 번호 판정 모듈과 설정

**Files:**
- Create: `lib/popbill/allowlist.ts`
- Modify: `lib/popbill/config.ts` (`PopbillConfig` 타입, `readPopbillConfig`)
- Modify: `.env.example` (`POPBILL_IS_TEST=true` 줄 아래)

**Interfaces:**
- Produces:
  - `RECIPIENT_NOT_ALLOWED: "RECIPIENT_NOT_ALLOWED"`
  - `type LiveAllowlistConfig = Pick<PopbillConfig, "isTest" | "liveAllowlist" | "liveRestrictedOrgIds">`
  - `parseLiveAllowlist(raw: string | undefined): string[]`
  - `parseOrgIdList(raw: string | undefined): number[]`
  - `isLiveRecipientAllowed(orgId: number, number: string, config: LiveAllowlistConfig): boolean`
  - `assertLiveRecipientsAllowed(orgId: number, numbers: string[], config: LiveAllowlistConfig): void` — 막힌 번호가 있으면 `PopbillSubmitError(RECIPIENT_NOT_ALLOWED, …)`를 던진다
  - `PopbillConfig.liveAllowlist: string[]`, `PopbillConfig.liveRestrictedOrgIds: number[]`

- [ ] **Step 1: `lib/popbill/allowlist.ts` 생성**

```ts
import type { PopbillConfig } from "./config";
import { PopbillSubmitError } from "./types";

/**
 * 운영 모드 실발송 허용 번호 — **서버 전용**.
 *
 * POPBILL_IS_TEST=false일 때만 적용한다. POPBILL_LIVE_ALLOWLIST에 적힌 번호에만 실제로 보내고,
 * 목록이 비어 있으면 전부 막는다. `*`는 전체 허용이지만 POPBILL_LIVE_RESTRICTED_ORG_IDS의 조직은
 * `*`를 무시하고 목록에 적힌 번호로만 보낸다(데모 조직 보호).
 */

export const RECIPIENT_NOT_ALLOWED = "RECIPIENT_NOT_ALLOWED" as const;

export type LiveAllowlistConfig = Pick<PopbillConfig, "isTest" | "liveAllowlist" | "liveRestrictedOrgIds">;

/** 쉼표 구분 목록 → `*` 또는 숫자만 남긴 번호. 빈 항목·숫자 없는 항목·중복은 버린다. */
export function parseLiveAllowlist(raw: string | undefined): string[] {
  const result: string[] = [];
  for (const entry of (raw ?? "").split(",")) {
    const trimmed = entry.trim();
    const value = trimmed === "*" ? "*" : trimmed.replace(/\D/g, "");
    if (value && !result.includes(value)) result.push(value);
  }
  return result;
}

/** 쉼표 구분 조직 id 목록 → 양의 정수만(중복 제거). */
export function parseOrgIdList(raw: string | undefined): number[] {
  const result: number[] = [];
  for (const entry of (raw ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!/^\d+$/.test(trimmed)) continue;
    const id = Number(trimmed);
    if (id > 0 && !result.includes(id)) result.push(id);
  }
  return result;
}

export function isLiveRecipientAllowed(
  orgId: number,
  number: string,
  config: LiveAllowlistConfig,
): boolean {
  if (config.isTest) return true;
  const digits = number.replace(/\D/g, "");
  if (!digits) return false;
  const restricted = config.liveRestrictedOrgIds.includes(orgId);
  if (!restricted && config.liveAllowlist.includes("*")) return true;
  return config.liveAllowlist.includes(digits);
}

/** 팝빌 호출 직전 마지막 확인. 목록 밖 번호가 하나라도 있으면 SDK를 부르지 않고 던진다. */
export function assertLiveRecipientsAllowed(
  orgId: number,
  numbers: string[],
  config: LiveAllowlistConfig,
): void {
  if (numbers.some((number) => !isLiveRecipientAllowed(orgId, number, config))) {
    throw new PopbillSubmitError(RECIPIENT_NOT_ALLOWED, "운영 발송 허용 목록에 없는 번호입니다.");
  }
}
```

- [ ] **Step 2: `lib/popbill/config.ts` 수정**

파일 맨 위(문서 주석 앞)에 import를 추가한다.

```ts
import { parseLiveAllowlist, parseOrgIdList } from "./allowlist";
```

`PopbillConfig`의 `faxSender: string;` 줄 아래에 추가한다.

```ts
  /** 운영 모드 실발송 허용 번호(숫자) 또는 "*". 비어 있으면 운영 모드에서 전부 차단. */
  liveAllowlist: string[];
  /** "*"를 무시하고 목록 번호로만 보내는 조직 id(데모 조직). */
  liveRestrictedOrgIds: number[];
```

`readPopbillConfig` 반환 객체의 `faxSender: …,` 줄 아래에 추가한다.

```ts
    liveAllowlist: parseLiveAllowlist(env.POPBILL_LIVE_ALLOWLIST),
    liveRestrictedOrgIds: parseOrgIdList(env.POPBILL_LIVE_RESTRICTED_ORG_IDS),
```

(`allowlist.ts`는 `config.ts`를 타입으로만 가져오므로 런타임 순환이 없다.)

- [ ] **Step 3: `.env.example` 수정** — `POPBILL_IS_TEST=true` 줄 바로 아래에 추가한다.

```
# 운영 모드(POPBILL_IS_TEST=false)에서 실제로 보낼 수 있는 수신번호 — 쉼표 구분, 하이픈 무시.
# '*' = 전체 허용. 비우면 운영 모드에서 전부 차단(막힌 수신자는 RECIPIENT_NOT_ALLOWED로 실패·미차감).
POPBILL_LIVE_ALLOWLIST=
# '*'를 무시하고 위 목록 번호로만 보내는 조직 id — 쉼표 구분(데모 조직):
POPBILL_LIVE_RESTRICTED_ORG_IDS=
```

- [ ] **Step 4: 검증 스크립트 작성** — 스크래치패드(`$SP`)에 `allowlist-check.cjs`를 만든다(커밋하지 않음).

```js
const assert = require("node:assert/strict");
const path = require("node:path");
const out = process.argv[2];
const a = require(path.join(out, "allowlist.js"));
const { readPopbillConfig } = require(path.join(out, "config.js"));

assert.deepEqual(a.parseLiveAllowlist(" 010-1234-5678, *, , abc ,01012345678"), ["01012345678", "*"]);
assert.deepEqual(a.parseLiveAllowlist(undefined), []);
assert.deepEqual(a.parseOrgIdList("1, 7,x,0,-3, 7"), [1, 7]);

const live = (list, restricted = []) => ({ isTest: false, liveAllowlist: list, liveRestrictedOrgIds: restricted });
const testMode = { isTest: true, liveAllowlist: [], liveRestrictedOrgIds: [] };
assert.equal(a.isLiveRecipientAllowed(2, "01099998888", testMode), true);
assert.equal(a.isLiveRecipientAllowed(2, "010-1234-5678", live(["01012345678"])), true);
assert.equal(a.isLiveRecipientAllowed(2, "01099998888", live(["01012345678"])), false);
assert.equal(a.isLiveRecipientAllowed(2, "01099998888", live([])), false);
assert.equal(a.isLiveRecipientAllowed(2, "01099998888", live(["*"])), true);
assert.equal(a.isLiveRecipientAllowed(1, "01099998888", live(["*"], [1])), false);
assert.equal(a.isLiveRecipientAllowed(1, "01012345678", live(["*", "01012345678"], [1])), true);
assert.equal(a.isLiveRecipientAllowed(2, "", live(["*"])), false);

assert.throws(
  () => a.assertLiveRecipientsAllowed(2, ["01012345678", "01099998888"], live(["01012345678"])),
  (e) => e.code === "RECIPIENT_NOT_ALLOWED",
);
assert.doesNotThrow(() => a.assertLiveRecipientsAllowed(2, ["01012345678"], live(["01012345678"])));
assert.doesNotThrow(() => a.assertLiveRecipientsAllowed(2, ["01099998888"], testMode));

const base = { POPBILL_LINK_ID: "L", POPBILL_SECRET_KEY: "S", POPBILL_CORP_NUM: "1" };
const cfg = readPopbillConfig({ ...base, POPBILL_LIVE_ALLOWLIST: "010-1234-5678,*", POPBILL_LIVE_RESTRICTED_ORG_IDS: "1" });
assert.deepEqual(cfg.liveAllowlist, ["01012345678", "*"]);
assert.deepEqual(cfg.liveRestrictedOrgIds, [1]);
assert.equal(cfg.isTest, true);
const empty = readPopbillConfig(base);
assert.deepEqual(empty.liveAllowlist, []);
assert.deepEqual(empty.liveRestrictedOrgIds, []);
console.log("allowlist checks OK");
```

- [ ] **Step 5: 검증 실행** (워크트리, 정션 연결 상태)

```bash
node ./node_modules/typescript/bin/tsc lib/popbill/allowlist.ts lib/popbill/config.ts lib/popbill/types.ts --outDir "$SP/allowlist-out" --module commonjs --target es2022 --skipLibCheck --esModuleInterop
node "$SP/allowlist-check.cjs" "$SP/allowlist-out"
```

Expected: `allowlist checks OK` (컴파일 중 `popbill` 타입 경고는 무시 — JS는 생성된다).

- [ ] **Step 6: 전체 타입 확인**

Run: `node ./node_modules/typescript/bin/tsc --noEmit -p .`
Expected: 오류 0. `PopbillConfig`를 직접 만드는 객체 리터럴이 있으면 두 필드가 빠졌다고 나온다 — 그 자리에 `liveAllowlist: []`, `liveRestrictedOrgIds: []`를 넣는다.

- [ ] **Step 7: 커밋** (묶음 A 끝에서 Task 1~4를 한 번에 커밋해도 된다 — 같은 파일을 이어서 고치므로)

```bash
git add lib/popbill/allowlist.ts lib/popbill/config.ts .env.example
git diff --cached --name-only
git commit -m "feat(messaging): 운영 모드 실발송 허용 번호 판정(POPBILL_LIVE_ALLOWLIST·데모 조직 제한)"
```

---

### Task 2: 팝빌 어댑터 마지막 확인

**Files:**
- Modify: `lib/popbill/types.ts` (`MessageBatchInput`)
- Modify: `lib/popbill/messages.ts` (`submitMessageBatch`)
- Modify: `lib/popbill/fax.ts` (`FaxSubmitInput`, `submitFax`)
- Modify: `lib/messaging/dispatch.ts` (`SubmitReservationParams`, `submitReservationBatches`의 `submitBatchWithRetry` 호출, `dispatchMessages`의 호출 인자)
- Modify: `lib/messaging/drainSchedules.ts` (`submitReservationBatches` 호출 인자)
- Modify: `app/api/bill/fax/send/route.ts` (`submitFax` 호출 인자)

**Interfaces:**
- Consumes: Task 1 `assertLiveRecipientsAllowed`
- Produces: `MessageBatchInput.orgId: number`(필수), `FaxSubmitInput.orgId: number`(필수), `SubmitReservationParams.orgId: number`(필수)

- [ ] **Step 1: `lib/popbill/types.ts`** — `MessageBatchInput`의 `product: ProviderProduct;` 위에 추가한다.

```ts
  /** 발송 조직. 운영 모드 허용 번호 판정(데모 조직 제한)에 쓴다. */
  orgId: number;
```

- [ ] **Step 2: `lib/popbill/messages.ts`** — import에 `import { assertLiveRecipientsAllowed } from "./allowlist";`를 더하고, `submitMessageBatch` 본문 첫 줄에 넣는다.

```ts
  // 운영 모드 마지막 확인: 허용 목록 밖 번호가 있으면 SDK를 부르지 않는다(발송 단계 필터의 안전망).
  assertLiveRecipientsAllowed(batch.orgId, batch.recipients.map((r) => r.phone), config);
```

- [ ] **Step 3: `lib/popbill/fax.ts`** — import에 `import { assertLiveRecipientsAllowed } from "./allowlist";`를 더하고, `FaxSubmitInput`의 `requestNum: string;` 위에 `orgId: number;`를 추가한다. `submitFax` 본문 첫 줄(`requirePopbillSender` 위)에 넣는다.

```ts
  // 운영 모드 마지막 확인: 허용 목록 밖 팩스번호면 SDK를 부르지 않는다.
  assertLiveRecipientsAllowed(input.orgId, [input.receiver], config);
```

- [ ] **Step 4: `lib/messaging/dispatch.ts`**
  - `SubmitReservationParams`에 `orgId: number;`를 `reservationId` 위에 추가한다.
  - `submitReservationBatches` 안의 `submitBatchWithRetry` 두 번째 인자를 `{ orgId: params.orgId, product: batch.product, requestNum: batch.requestNum, recipients: batch.recipients }`로 바꾼다.
  - `dispatchMessages`가 `submitReservationBatches`를 부르는 params 객체에 `orgId: input.orgId,`를 추가한다.

- [ ] **Step 5: `lib/messaging/drainSchedules.ts`** — `submitReservationBatches(admin, { reservationId: …, scheduleId: row.id, … })` params 객체에 `orgId: row.org_id,`를 추가한다.

- [ ] **Step 6: `app/api/bill/fax/send/route.ts`** — `submitFax({ requestNum: created.request_num, … })` 입력 객체 첫 줄에 `orgId: ctx.org_id,`를 추가한다.

- [ ] **Step 7: 검증**

Run: `node ./node_modules/typescript/bin/tsc --noEmit -p .`
Expected: 오류 0. `orgId`가 빠진 호출이 남아 있으면 tsc가 그 자리를 알려 준다.

Run: `grep -rn "submitFax(\|submitBatchWithRetry(\|submitMessageBatch(" --include=*.ts app lib`
Expected: 모든 호출이 orgId를 담은 입력을 넘긴다.

- [ ] **Step 8: 커밋** (또는 묶음 A로)

```bash
git add lib/popbill/types.ts lib/popbill/messages.ts lib/popbill/fax.ts lib/messaging/dispatch.ts lib/messaging/drainSchedules.ts app/api/bill/fax/send/route.ts
git diff --cached --name-only
git commit -m "feat(messaging): 팝빌 어댑터가 SDK 직전에 운영 허용 번호를 한 번 더 확인"
```

---

### Task 3: 발송 단계에서 수신자별 차단과 화면 안내

**Files:**
- Modify: `lib/messaging/dispatch.ts` (`NON_RETRYABLE_SUBMIT_CODES`, `submitReservationBatches`, `DispatchMessagesResult`, `dispatchMessages`, 새 `rejectReasonFromCodes`)
- Modify: `app/api/messaging/send/route.ts` (성공 JSON)
- Modify: `hooks/reactquery/messaging/apis.ts` (`SendMessagesResult`, `sendMessages`)
- Modify: `components/messenger/MessengerFab.tsx` (성공 토스트·오류 문구)
- Modify: `app/(staff)/staff/(app)/notices/useNoticeAlimtalkSend.ts` (오류 문구)
- Modify: `app/api/bill/fax/send/route.ts` (차단 팩스 마감)

**Interfaces:**
- Consumes: Task 1 `isLiveRecipientAllowed`, `RECIPIENT_NOT_ALLOWED`; Task 2 `SubmitReservationParams.orgId`
- Produces:
  - `submitReservationBatches(...)` 반환에 `blockedCount: number`, `failureCodes: string[]` 추가
  - `DispatchMessagesResult.blockedCount?: number`
  - `export function rejectReasonFromCodes(codes: string[]): string | null`
  - `/api/messaging/send` 202 응답 JSON에 `blockedCount: number`
  - `SendMessagesResult.blockedCount?: number`

- [ ] **Step 1: import·재시도 제외** — `dispatch.ts` import에 `import { isLiveRecipientAllowed, RECIPIENT_NOT_ALLOWED } from "@/lib/popbill/allowlist";`를 더하고, `NON_RETRYABLE_SUBMIT_CODES` 목록에 `RECIPIENT_NOT_ALLOWED,`를 추가한다.

- [ ] **Step 2: 수신자 분할** — `submitReservationBatches`에서 아래 한 줄을

```ts
  const plan = buildSubmissionPlan({ scope: "m", id: params.reservationId, recipients: planRecipients });
```

다음으로 바꾼다.

```ts
  // 운영 모드 허용 번호 목록(spec 4.1): 목록 밖 수신자는 별도 작업(scope "mx")으로 만들고 팝빌로 넘기지 않는다.
  // 같은 입력의 재시도는 같은 분할·같은 requestNum을 만든다(결정적).
  const providerConfig = deps.config ?? readPopbillConfig();
  const isAllowed = (recipient: PlanRecipient) =>
    isLiveRecipientAllowed(params.orgId, recipient.phone, providerConfig);
  const allowedPlan = buildSubmissionPlan({
    scope: "m",
    id: params.reservationId,
    recipients: planRecipients.filter(isAllowed),
  });
  const blockedPlan = buildSubmissionPlan({
    scope: "mx",
    id: params.reservationId,
    recipients: planRecipients.filter((recipient) => !isAllowed(recipient)),
  });
  const blockedRequestNums = new Set(blockedPlan.map((batch) => batch.requestNum));
  const plan = [...allowedPlan, ...blockedPlan];
```

- [ ] **Step 3: 차단 작업 기록** — `let queuedCount = 0;` 아래에 추가한다.

```ts
  let blockedCount = 0;
  const failureCodes: string[] = [];
```

`if (claim?.ok !== true || claim.action !== "submit") continue;` 바로 아래에 추가한다.

```ts
    if (blockedRequestNums.has(batch.requestNum)) {
      // 허용 목록 밖: 팝빌을 부르지 않고 확정 실패로 기록한다. 수신자 실패·미차감은 기존 정산 경로가 처리한다.
      outcomes.push({
        request_num: batch.requestNum,
        outcome: "failed",
        error_code: RECIPIENT_NOT_ALLOWED,
        error_message: "운영 발송 허용 목록에 없는 번호입니다.",
        submit_owner: submitOwner,
      });
      blockedCount += batch.recipients.length;
      failureCodes.push(RECIPIENT_NOT_ALLOWED);
      continue;
    }
```

`catch (e)` 블록의 `const classified = classifySubmitError(e);` 아래에 추가한다.

```ts
      if (classified.outcome === "failed") failureCodes.push(classified.code);
```

함수 반환 타입을 `Promise<{ queuedCount: number; markStatus: string; channelCounts: DispatchChannelCounts; blockedCount: number; failureCodes: string[] }>`로 바꾸고, 마지막 return을 다음으로 바꾼다.

```ts
  return { queuedCount, markStatus: mark?.status ?? "unknown", channelCounts, blockedCount, failureCodes };
```

- [ ] **Step 4: 전원 거절 사유** — `classifySubmitError` 아래에 추가한다(Task 4에서 잔액 부족을 더한다).

```ts
/** 전부 거절된 발송의 대표 사유. 화면 안내가 있는 코드만 돌려주고, 그 밖은 null(SEND_REJECTED). */
export function rejectReasonFromCodes(codes: string[]): string | null {
  if (codes.length > 0 && codes.every((code) => code === RECIPIENT_NOT_ALLOWED)) {
    return RECIPIENT_NOT_ALLOWED;
  }
  return null;
}
```

- [ ] **Step 5: `dispatchMessages` 결과**
  - `DispatchMessagesResult`에 `blockedCount?: number;`를 `queuedCount?: number;` 아래에 추가한다.
  - `const { queuedCount, markStatus, channelCounts } = await submitReservationBatches(`를 `const { queuedCount, markStatus, channelCounts, blockedCount, failureCodes } = await submitReservationBatches(`로 바꾼다.
  - `markStatus === "provider_pending"` 성공 반환 객체에 `blockedCount,`를 추가한다.
  - `markStatus === "released"` 반환의 `code: "SEND_REJECTED",`를 `code: rejectReasonFromCodes(failureCodes) ?? "SEND_REJECTED",`로 바꾼다.

- [ ] **Step 6: 라우트 응답** — `app/api/messaging/send/route.ts` 마지막 202 JSON의 `reservedPoints: result.reservedPoints ?? 0,` 아래에 `blockedCount: result.blockedCount ?? 0,`를 추가한다.

- [ ] **Step 7: 클라이언트 API** — `hooks/reactquery/messaging/apis.ts`
  - `SendMessagesResult`의 `reservedPoints?: number;` 아래에 추가한다.
    ```ts
      /** 운영 허용 목록 밖이라 팝빌로 보내지 않은 수신자 수(즉시발송). */
      blockedCount?: number;
    ```
  - `sendMessages`의 응답 data 타입에 `blockedCount?: number;`를 더하고, 마지막 return 객체에 `blockedCount: data?.blockedCount ?? 0,`를 더한다.

- [ ] **Step 8: 메신저 문구** — `components/messenger/MessengerFab.tsx`의 성공 토스트를 다음으로 바꾼다.

```ts
      const blocked = result.status === "scheduled" ? 0 : (result.blockedCount ?? 0);
      toast.success(
        result.status === "scheduled"
          ? `예약 발송이 등록되었습니다 · ${result.count}건`
          : `발송을 접수했습니다 · ${result.queuedCount ?? result.count}건 · 결과 확인 중${
              blocked > 0 ? ` · 발송 제한 번호 ${blocked}명 제외` : ""
            }`,
      );
```

오류 문구 삼항식의 `: "메시지를 발송하지 못했습니다.";` 앞에 분기를 넣는다.

```ts
              : code === "RECIPIENT_NOT_ALLOWED"
                ? "발송 제한 번호라 보내지 않았어요."
```

- [ ] **Step 9: 공지 문구** — `useNoticeAlimtalkSend.ts`의 `toast.error(` 삼항식에서 `: "발송하지 못했습니다.",` 앞에 넣는다.

```ts
            : code === "RECIPIENT_NOT_ALLOWED"
              ? "발송 제한 번호라 보내지 않았습니다."
```

- [ ] **Step 10: 팩스 차단** — `app/api/bill/fax/send/route.ts` import에 `import { isLiveRecipientAllowed, RECIPIENT_NOT_ALLOWED } from "@/lib/popbill/allowlist";`를 더하고, `const jobId = created.job_id;` 바로 아래(PDF 렌더 전)에 넣는다.

```ts
    // 운영 모드 허용 번호 목록(spec 4.1): 목록 밖이면 팝빌을 부르지 않고 작업을 확정 실패로 마감한다.
    if (!isLiveRecipientAllowed(ctx.org_id, doc.faxNumber, effectiveConfig)) {
      const markErr = await markFaxResult(admin, {
        p_job_id: jobId,
        p_outcome: "failed",
        p_error_code: RECIPIENT_NOT_ALLOWED,
      });
      if (markErr) {
        reconcileRequired += 1;
        results.push({ billIssueId, status: "mark_failed" });
      } else {
        failed += 1;
        results.push({ billIssueId, status: "recipient_not_allowed" });
      }
      continue;
    }
```

- [ ] **Step 11: 검증**

Run: `node ./node_modules/typescript/bin/tsc --noEmit -p .`
Expected: 오류 0.

Run: `node ./node_modules/eslint/bin/eslint.js lib/messaging/dispatch.ts app/api/messaging/send/route.ts hooks/reactquery/messaging/apis.ts components/messenger/MessengerFab.tsx "app/(staff)/staff/(app)/notices/useNoticeAlimtalkSend.ts" app/api/bill/fax/send/route.ts`
Expected: 오류 0.

리뷰 확인: 테스트 모드(`isTest=true`)에서는 `blockedPlan`이 항상 비어 `plan`과 requestNum이 이전과 똑같다.

- [ ] **Step 12: 커밋** (또는 묶음 A로)

```bash
git add lib/messaging/dispatch.ts app/api/messaging/send/route.ts hooks/reactquery/messaging/apis.ts components/messenger/MessengerFab.tsx "app/(staff)/staff/(app)/notices/useNoticeAlimtalkSend.ts" app/api/bill/fax/send/route.ts
git diff --cached --name-only
git commit -m "feat(messaging): 운영 허용 목록 밖 수신자는 팝빌로 보내지 않고 실패 처리 — 발송 제한 번호 안내"
```

---

### Task 4: 팝빌 잔액 부족 처리

**Files:**
- Modify: `lib/messaging/dispatch.ts` (잔액 코드 집합, `NON_RETRYABLE_SUBMIT_CODES`, `classifySubmitError`, `rejectReasonFromCodes`)
- Modify: `components/messenger/MessengerFab.tsx` (오류 문구)
- Modify: `app/(staff)/staff/(app)/notices/useNoticeAlimtalkSend.ts` (오류 문구)

**Interfaces:**
- Consumes: Task 3 `rejectReasonFromCodes`, `failureCodes`
- Produces: `export const PROVIDER_INSUFFICIENT_BALANCE = "PROVIDER_INSUFFICIENT_BALANCE"`

- [ ] **Step 1: 코드 집합** — `dispatch.ts`에서 `NON_RETRYABLE_SUBMIT_CODES` **위에** 추가한다(선언 순서 중요).

```ts
/** 팝빌 잔액 부족(공통 오류코드, 2026-10-02 오류코드표). 충전 전에는 같은 요청이 계속 실패한다. */
const POPBILL_INSUFFICIENT_BALANCE_CODES = new Set<string>([
  "-99005001", // 파트너 잔여포인트가 부족합니다.
  "-99005003", // 차감할 충전포인트가 부족합니다.
  "-99005004", // 차감할 보너스포인트가 부족합니다.
  "-99005005", // 잔여포인트가 부족합니다.
]);
export const PROVIDER_INSUFFICIENT_BALANCE = "PROVIDER_INSUFFICIENT_BALANCE";
```

`NON_RETRYABLE_SUBMIT_CODES` 목록 끝에 추가한다.

```ts
  ...POPBILL_INSUFFICIENT_BALANCE_CODES,
  "-99005002", // 후불 월한도를 초과하였습니다.
  "-99005013", // 후불 일한도를 초과하였습니다.
  "-10010039", // 팝빌에 허용되지 않은 IP에서는 메시지를 전송할 수 없습니다.
```

- [ ] **Step 2: 분류** — `classifySubmitError`의 `if (e instanceof PopbillSubmitError) {` 블록을 다음으로 바꾼다.

```ts
  if (e instanceof PopbillSubmitError) {
    if (POPBILL_INSUFFICIENT_BALANCE_CODES.has(e.code)) {
      // 원본 코드는 메시지에 남겨 운영 확인에 쓴다.
      return { outcome: "failed", code: PROVIDER_INSUFFICIENT_BALANCE, message: `팝빌 잔액 부족(${e.code})` };
    }
    return { outcome: "failed", code: e.code, message: e.message };
  }
```

- [ ] **Step 3: 전원 거절 사유에 잔액 부족 우선** — `rejectReasonFromCodes` 첫 줄에 넣는다.

```ts
  if (codes.includes(PROVIDER_INSUFFICIENT_BALANCE)) return PROVIDER_INSUFFICIENT_BALANCE;
```

- [ ] **Step 4: 메신저 문구** — `MessengerFab.tsx` 오류 삼항식의 `RECIPIENT_NOT_ALLOWED` 분기 다음에 넣는다.

```ts
                : code === "PROVIDER_INSUFFICIENT_BALANCE"
                  ? "팝빌 충전 잔액이 부족해 발송하지 못했어요. 운영사에 충전을 요청해 주세요."
```

- [ ] **Step 5: 공지 문구** — `useNoticeAlimtalkSend.ts`의 `RECIPIENT_NOT_ALLOWED` 분기 다음에 넣는다.

```ts
              : code === "PROVIDER_INSUFFICIENT_BALANCE"
                ? "팝빌 충전 잔액이 부족해 발송하지 못했습니다. 운영사에 충전을 요청해 주세요."
```

- [ ] **Step 6: 검증**

Run: `node ./node_modules/typescript/bin/tsc --noEmit -p .`
Expected: 오류 0.

Run: `node ./node_modules/eslint/bin/eslint.js lib/messaging/dispatch.ts components/messenger/MessengerFab.tsx "app/(staff)/staff/(app)/notices/useNoticeAlimtalkSend.ts"`
Expected: 오류 0.

리뷰 확인: `isRetryableSubmitError`가 원본 코드(`-99005005` 등)를 재시도하지 않는다(`NON_RETRYABLE_SUBMIT_CODES`에 원본 코드가 들어 있다).

- [ ] **Step 7: 커밋** (묶음 A 커밋에 포함 가능)

```bash
git add lib/messaging/dispatch.ts components/messenger/MessengerFab.tsx "app/(staff)/staff/(app)/notices/useNoticeAlimtalkSend.ts"
git diff --cached --name-only
git commit -m "feat(messaging): 팝빌 잔액 부족을 재시도 없이 실패 처리하고 충전 요청 안내"
```

---

### Task 5: 발송 환경 표시(provider_env)

**Files:**
- Create: `supabase/migrations/0224_popbill_provider_env.sql`
- Create: `supabase/verify/0224_popbill_provider_env_checks.sql`
- Modify: `lib/messaging/dispatch.ts` (`create_provider_dispatch_jobs`의 `p_jobs`)
- Modify: `app/api/bill/fax/send/route.ts` (`create_fax_dispatch_job` 인자)
- Modify: `lib/messaging/reconcile.ts` (`claim_provider_dispatch_jobs` 인자)
- Modify: `docs/ops/popbill-delivery.md` (운영 전환 절)

**Interfaces:**
- Consumes: Task 3 `providerConfig`
- Produces: DB `provider_dispatch_jobs.provider_env`(`'test' | 'live'`), `create_fax_dispatch_job(p_bill_issue_id bigint, p_provider_env text default 'test')`, `claim_provider_dispatch_jobs(p_limit integer default 50, p_provider_env text default null)`

- [ ] **Step 1: 마이그레이션 작성** — `supabase/migrations/0224_popbill_provider_env.sql`

```sql
-- 팝빌 접수 작업에 접수 환경(test/live)을 기록한다.
-- 로컬(테스트 키)과 배포본(운영 키)이 같은 DB를 쓰므로, 결과 재조회는 자기 환경의 작업만 가져온다.
-- 기존 작업은 전부 test다(운영 환경은 2026-10-02까지 열린 적 없음 — 운영 조회 -99010016).

alter table public.provider_dispatch_jobs
  add column if not exists provider_env text not null default 'test';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'provider_dispatch_jobs_provider_env_check'
  ) then
    alter table public.provider_dispatch_jobs
      add constraint provider_dispatch_jobs_provider_env_check check (provider_env in ('test', 'live'));
  end if;
end $$;

comment on column public.provider_dispatch_jobs.provider_env is
  '접수 환경(test=팝빌 테스트베드, live=운영). 결과 재조회는 같은 환경 작업만 조회한다.';

-- 메시지 작업 생성: p_jobs[].provider_env(없으면 test)를 기록한다. 시그니처는 그대로다.
-- p_jobs: [{ product, request_num, schedule_id, provider_env, recipients: [{ recipient_key, provider_ref_key }] }]
create or replace function public.create_provider_dispatch_jobs(
  p_reservation_id bigint,
  p_jobs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.message_point_reservations%rowtype;
  v_job jsonb;
  v_job_id bigint;
  v_status text;
  v_receipt text;
  v_result jsonb := '[]'::jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  select * into v_reservation from public.message_point_reservations where id = p_reservation_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'RESERVATION_NOT_FOUND'); end if;
  if p_jobs is null or jsonb_typeof(p_jobs) <> 'array' then
    raise exception 'invalid jobs payload' using errcode = '22023';
  end if;

  for v_job in select value from jsonb_array_elements(p_jobs) loop
    -- 재시도/replay 안전: 같은 request_num이면 재삽입하지 않고 기존 작업을 재사용한다.
    insert into public.provider_dispatch_jobs(
      org_id, provider, kind, product, reservation_id, message_log_id,
      schedule_id, request_num, status, provider_env
    ) values (
      v_reservation.org_id, 'popbill', 'message', v_job->>'product',
      p_reservation_id, v_reservation.message_log_id,
      nullif(v_job->>'schedule_id', '')::bigint, v_job->>'request_num', 'submitting',
      coalesce(nullif(v_job->>'provider_env', ''), 'test')
    )
    on conflict (request_num) do nothing
    returning id into v_job_id;

    if v_job_id is null then
      select id into v_job_id from public.provider_dispatch_jobs
      where request_num = v_job->>'request_num';
    end if;

    insert into public.provider_dispatch_recipients(job_id, recipient_key, provider_ref_key, product)
    select v_job_id, rec.value->>'recipient_key', rec.value->>'provider_ref_key', v_job->>'product'
    from jsonb_array_elements(v_job->'recipients') as rec(value)
    on conflict (job_id, recipient_key) do nothing;

    select status, receipt_num into v_status, v_receipt
    from public.provider_dispatch_jobs where id = v_job_id;

    v_result := v_result || jsonb_build_object(
      'request_num', v_job->>'request_num', 'job_id', v_job_id,
      'status', v_status, 'receipt_num', v_receipt
    );
  end loop;

  return jsonb_build_object('ok', true, 'jobs', v_result);
end
$$;
revoke all on function public.create_provider_dispatch_jobs(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_provider_dispatch_jobs(bigint, jsonb) to service_role;

-- 팩스 작업 생성: p_provider_env 인자 추가(기본 test → 옛 클라이언트 호환). 옛 시그니처는 지운다(오버로드 금지).
drop function if exists public.create_fax_dispatch_job(bigint);
create or replace function public.create_fax_dispatch_job(
  p_bill_issue_id bigint,
  p_provider_env text default 'test'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org bigint;
  v_attempt integer;
  v_request text;
  v_job_id bigint;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  select b.org_id into v_org
  from public.bill_issues bi
  join public.units u on u.id = bi.unit_id
  join public.buildings b on b.id = u.building_id
  where bi.id = p_bill_issue_id and bi.issue_type = 'fax';
  if v_org is null then
    return jsonb_build_object('ok', false, 'code', 'BILL_ISSUE_NOT_FOUND');
  end if;

  -- 재시도는 terminal 실패 작업에만 허용한다. 진행 중(submitting/pending/reconcile_required)이면 중복 전송을 막는다.
  if exists (
    select 1 from public.provider_dispatch_jobs
    where bill_issue_id = p_bill_issue_id and status in ('submitting', 'pending', 'reconcile_required')
  ) then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_IN_FLIGHT');
  end if;

  select count(*) into v_attempt from public.provider_dispatch_jobs where bill_issue_id = p_bill_issue_id;
  v_request := 'f' || p_bill_issue_id || 'a' || v_attempt;

  insert into public.provider_dispatch_jobs(
    org_id, provider, kind, product, bill_issue_id, request_num, status, provider_env
  ) values (
    v_org, 'popbill', 'fax', 'fax', p_bill_issue_id, v_request, 'submitting',
    coalesce(nullif(p_provider_env, ''), 'test')
  ) returning id into v_job_id;

  insert into public.provider_dispatch_recipients(job_id, recipient_key, provider_ref_key, product)
    values (v_job_id, v_request, v_request, 'fax');

  return jsonb_build_object('ok', true, 'job_id', v_job_id, 'request_num', v_request, 'provider_ref_key', v_request);
end
$$;
revoke all on function public.create_fax_dispatch_job(bigint, text) from public, anon, authenticated;
grant execute on function public.create_fax_dispatch_job(bigint, text) to service_role;

-- 결과 재조회 claim: p_provider_env가 있으면 그 환경 작업만, null이면 기존 동작(전체).
drop function if exists public.claim_provider_dispatch_jobs(integer);
create or replace function public.claim_provider_dispatch_jobs(
  p_limit integer default 50,
  p_provider_env text default null
)
returns setof public.provider_dispatch_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  return query
  with due as (
    select job.id
    from public.provider_dispatch_jobs job
    where (
        (
          job.status in ('pending', 'reconcile_required')
          and job.next_poll_at is not null
          and job.next_poll_at <= now()
        )
        or (
          job.kind = 'message'
          and job.status = 'submitting'
          and job.submit_owner is not null
          and job.lease_until is not null
          and job.lease_until <= now()
        )
      )
      and (job.lease_until is null or job.lease_until <= now())
      and (p_provider_env is null or job.provider_env = p_provider_env)
    order by coalesce(job.next_poll_at, job.lease_until, job.updated_at)
    for update skip locked
    limit greatest(1, coalesce(p_limit, 50))
  ), claimed as (
    update public.provider_dispatch_jobs job
    set status = case
          when job.status = 'submitting' then 'reconcile_required'
          else job.status
        end,
        next_poll_at = case
          when job.status = 'submitting' then now()
          else job.next_poll_at
        end,
        lease_until = now() + interval '5 minutes',
        poll_attempts = job.poll_attempts + 1,
        last_error_code = case
          when job.status = 'submitting' then 'SUBMISSION_LEASE_EXPIRED'
          else job.last_error_code
        end,
        last_error_message = case
          when job.status = 'submitting' then 'Submission lease expired before a receipt was persisted'
          else job.last_error_message
        end
    from due
    where job.id = due.id
    returning job.*
  ), reservation_updates as (
    update public.message_point_reservations reservation
      set status = 'reconcile_required'
    where reservation.status = 'reserved'
      and exists (
        select 1 from claimed
        where claimed.reservation_id = reservation.id
          and claimed.status = 'reconcile_required'
      )
    returning reservation.id
  ), log_updates as (
    update public.message_logs log
      set point_status = 'reconcile_required'
    where log.point_status = 'reserved'
      and exists (
        select 1 from claimed
        where claimed.message_log_id = log.id
          and claimed.status = 'reconcile_required'
      )
    returning log.id
  )
  select claimed.* from claimed;
end
$$;
revoke all on function public.claim_provider_dispatch_jobs(integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_provider_dispatch_jobs(integer, text) to service_role;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: 검증 SQL 작성** — `supabase/verify/0224_popbill_provider_env_checks.sql`

```sql
-- 0224 적용 확인. 실패하면 raise로 멈춘다(통과 = 오류 없음).
-- 실행: node --env-file=C:/Users/leebj/orca/projects/home_erp/.env.local C:/Users/leebj/orca/projects/home_erp/scripts/db-query.mjs <이 파일>
do $$
declare
  v_count int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'provider_dispatch_jobs'
      and column_name = 'provider_env' and is_nullable = 'NO' and column_default like '''test''%'
  ) then
    raise exception '0224: provider_env column missing or wrong';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'provider_dispatch_jobs_provider_env_check') then
    raise exception '0224: provider_env check constraint missing';
  end if;
  -- 적용 직후 전용: 운영 전환 전이므로 live 작업이 없어야 한다.
  select count(*) into v_count from public.provider_dispatch_jobs where provider_env <> 'test';
  if v_count <> 0 then raise exception '0224: % rows are not test right after apply', v_count; end if;

  if to_regprocedure('public.create_fax_dispatch_job(bigint,text)') is null then
    raise exception '0224: create_fax_dispatch_job(bigint,text) missing';
  end if;
  if to_regprocedure('public.create_fax_dispatch_job(bigint)') is not null then
    raise exception '0224: old create_fax_dispatch_job(bigint) still exists';
  end if;
  if to_regprocedure('public.claim_provider_dispatch_jobs(integer,text)') is null then
    raise exception '0224: claim_provider_dispatch_jobs(integer,text) missing';
  end if;
  if to_regprocedure('public.claim_provider_dispatch_jobs(integer)') is not null then
    raise exception '0224: old claim_provider_dispatch_jobs(integer) still exists';
  end if;

  if not has_function_privilege('service_role', 'public.claim_provider_dispatch_jobs(integer,text)', 'execute') then
    raise exception '0224: service_role cannot execute claim_provider_dispatch_jobs';
  end if;
  if has_function_privilege('authenticated', 'public.claim_provider_dispatch_jobs(integer,text)', 'execute') then
    raise exception '0224: authenticated can execute claim_provider_dispatch_jobs';
  end if;
  if has_function_privilege('anon', 'public.create_fax_dispatch_job(bigint,text)', 'execute') then
    raise exception '0224: anon can execute create_fax_dispatch_job';
  end if;
  if position('provider_env' in pg_get_functiondef('public.create_provider_dispatch_jobs(bigint,jsonb)'::regprocedure)) = 0 then
    raise exception '0224: create_provider_dispatch_jobs does not write provider_env';
  end if;
end $$;
```

- [ ] **Step 3: 메시지 작업에 환경 기록** — `dispatch.ts`의 `create_provider_dispatch_jobs` 호출 `p_jobs` 객체에서 `schedule_id: params.scheduleId ?? null,` 아래에 추가한다.

```ts
      provider_env: providerConfig.isTest ? "test" : "live",
```

- [ ] **Step 4: 팩스 작업에 환경 기록** — `app/api/bill/fax/send/route.ts`

```ts
    const createRes = await admin.rpc("create_fax_dispatch_job", {
      p_bill_issue_id: billIssueId,
      p_provider_env: effectiveConfig.isTest ? "test" : "live",
    });
```

- [ ] **Step 5: 재조회는 같은 환경만** — `lib/messaging/reconcile.ts`
  - 첫 줄 import를 `import { isPopbillConfigured, readPopbillConfig, type PopbillConfig } from "@/lib/popbill/config";`로 바꾼다.
  - `claim_provider_dispatch_jobs` 호출을 다음으로 바꾼다.

```ts
  // 같은 환경(test/live)에서 접수한 작업만 재조회한다(spec 4.2②). 팝빌 설정이 없으면 기존처럼 전체.
  const envConfig = config ?? (isPopbillConfigured() ? readPopbillConfig() : null);
  const providerEnv = envConfig ? (envConfig.isTest ? "test" : "live") : null;

  const jobs = (await rpcData(deps.admin, "claim_provider_dispatch_jobs", {
    p_limit: limit,
    p_provider_env: providerEnv,
  })) as ReconcileJob[] | null;
```

- [ ] **Step 6: 운영 문서** — `docs/ops/popbill-delivery.md` 끝에 추가한다.

```markdown
## 운영 전환 (2026-10-02 설계)

설계: `docs/superpowers/specs/2026-10-02-popbill-live-switch-design.md`

| 환경변수 | 뜻 |
|---|---|
| `POPBILL_IS_TEST` | `false`면 운영 환경(실발송). 기본 `true` |
| `POPBILL_LIVE_ALLOWLIST` | 운영 모드에서 보낼 수 있는 번호(쉼표 구분, 하이픈 무시). `*` = 전체. 비우면 전부 차단 |
| `POPBILL_LIVE_RESTRICTED_ORG_IDS` | `*`를 무시하고 목록 번호로만 보내는 조직 id(데모 조직) |

- 막힌 수신자는 팝빌로 넘기지 않고 `RECIPIENT_NOT_ALLOWED`로 실패한다(포인트 미차감). 팩스도 같다.
- 접수 작업 `provider_dispatch_jobs.provider_env`(test/live). 결과 재조회는 자기 환경 작업만 조회한다 — 로컬 테스트 키로 보낸 건을 운영 크론이 조회하지 않는다.
- 팝빌 잔액 부족(`-99005001`·`-99005003`·`-99005004`·`-99005005`)은 `PROVIDER_INSUFFICIENT_BALANCE`로 기록하고 재시도하지 않는다.
- 되돌리기: 허용 목록을 담당자 번호만 남기고 재배포한다. `POPBILL_IS_TEST=true`는 이미 나간 live 작업의 재조회를 멈추므로 마지막 수단이다.
```

- [ ] **Step 7: 검증**

Run: `node ./node_modules/typescript/bin/tsc --noEmit -p .`
Expected: 오류 0.

Run: `node ./node_modules/eslint/bin/eslint.js lib/messaging/dispatch.ts lib/messaging/reconcile.ts app/api/bill/fax/send/route.ts`
Expected: 오류 0.

SQL은 Task 8에서 운영 DB에 적용하며 검증한다.

- [ ] **Step 8: 커밋** (마이그레이션 번호 재확인 후)

```bash
git fetch -q origin
MSYS_NO_PATHCONV=1 git ls-tree --name-only origin/master supabase/migrations/ | tail -3
git add supabase/migrations/0224_popbill_provider_env.sql supabase/verify/0224_popbill_provider_env_checks.sql lib/messaging/dispatch.ts lib/messaging/reconcile.ts app/api/bill/fax/send/route.ts docs/ops/popbill-delivery.md
git diff --cached --name-only
git commit -m "feat(messaging): 팝빌 접수 작업에 test/live 환경 기록 — 결과 재조회는 같은 환경만 (0224)"
```

---

### Task 6: 매월 반복 예약 — 어느 확정 경로든 다음 회차

**Files:**
- Create: `supabase/migrations/0225_message_recurrence_on_settle.sql`
- Create: `supabase/verify/0225_message_recurrence_trigger_checks.sql`

**Interfaces:**
- Consumes: 기존 `enqueue_next_message_occurrence(bigint)`(0150, 같은 회차가 있으면 기존 id 반환)
- Produces: 트리거 `trg_message_schedules_enqueue_next`(status가 sent/partial로 바뀐 매월 반복 행)

- [ ] **Step 1: 마이그레이션 작성** — `supabase/migrations/0225_message_recurrence_on_settle.sql`

```sql
-- 매월 반복 예약: 어느 경로로 확정되든(complete_message_schedule, 정산 settle_message_points_from_jobs)
-- 상태가 sent/partial로 바뀌면 다음 회차를 만든다. enqueue_next_message_occurrence는 같은 회차가 있으면
-- 기존 id를 돌려주므로 두 경로가 겹쳐도 1건이다. 전원 실패(failed)면 다음 회차를 만들지 않는다(2026-09-09 결정).

create or replace function public.message_schedules_enqueue_next_occurrence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_next_message_occurrence(new.id);
  return null;
end
$$;
revoke all on function public.message_schedules_enqueue_next_occurrence() from public, anon, authenticated;

drop trigger if exists trg_message_schedules_enqueue_next on public.message_schedules;
create trigger trg_message_schedules_enqueue_next
  after update of status on public.message_schedules
  for each row
  when (
    new.status in ('sent', 'partial')
    and old.status is distinct from new.status
    and new.recurrence_mode = 'monthly'
  )
  execute function public.message_schedules_enqueue_next_occurrence();
```

- [ ] **Step 2: 롤백 프로브 작성** — `supabase/verify/0225_message_recurrence_trigger_checks.sql`

```sql
-- 0225 확인: 트리거 존재 + 동작. 마지막 raise는 의도된 롤백이다(아무것도 남지 않는다).
-- 통과 = 오류 메시지가 'OK 0225'로 시작. 'FAIL 0225'면 실패.
do $$
declare
  v_org bigint;
  v_sent_id bigint;
  v_failed_id bigint;
  v_next int;
  v_next_again int;
  v_failed_next int;
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_message_schedules_enqueue_next' and not tgisinternal
  ) then
    raise exception 'FAIL 0225: trigger missing';
  end if;
  select min(id) into v_org from public.organizations;

  -- sending → sent: 다음 회차 1건
  insert into public.message_schedules(
    org_id, channel, body, context, recipient_count, recipients,
    scheduled_at, status, recurrence_mode, recurrence_anchor_day
  ) values (
    v_org, 'sms', '0225 probe sent', 'manual', 0, '[]'::jsonb,
    now() + interval '1 day', 'sending', 'monthly',
    extract(day from ((now() + interval '1 day') at time zone 'Asia/Seoul'))::int
  ) returning id into v_sent_id;
  update public.message_schedules set status = 'sent' where id = v_sent_id;
  select count(*) into v_next from public.message_schedules where recurrence_parent_id = v_sent_id;

  -- complete_message_schedule 경로가 한 번 더 불러도 1건
  perform public.enqueue_next_message_occurrence(v_sent_id);
  select count(*) into v_next_again from public.message_schedules where recurrence_parent_id = v_sent_id;

  -- sending → failed: 다음 회차 없음
  insert into public.message_schedules(
    org_id, channel, body, context, recipient_count, recipients,
    scheduled_at, status, recurrence_mode, recurrence_anchor_day
  ) values (
    v_org, 'sms', '0225 probe failed', 'manual', 0, '[]'::jsonb,
    now() + interval '1 day', 'sending', 'monthly',
    extract(day from ((now() + interval '1 day') at time zone 'Asia/Seoul'))::int
  ) returning id into v_failed_id;
  update public.message_schedules set status = 'failed' where id = v_failed_id;
  select count(*) into v_failed_next from public.message_schedules where recurrence_parent_id = v_failed_id;

  if v_next = 1 and v_next_again = 1 and v_failed_next = 0 then
    raise exception 'OK 0225 (sent→%, again→%, failed→%) — rolled back', v_next, v_next_again, v_failed_next;
  end if;
  raise exception 'FAIL 0225 (sent→%, again→%, failed→%) — rolled back', v_next, v_next_again, v_failed_next;
end $$;
```

- [ ] **Step 3: 커밋** (번호 재확인 후)

```bash
git add supabase/migrations/0225_message_recurrence_on_settle.sql supabase/verify/0225_message_recurrence_trigger_checks.sql
git diff --cached --name-only
git commit -m "fix(messaging): 매월 반복 예약이 운영 결과 확정(정산) 뒤에도 다음 회차 생성 — 상태 트리거 (0225)"
```

---

### Task 7: 발신번호 표시 — 조직 번호 → 기본 번호

**Files:**
- Create: `app/api/messaging/sender-defaults/route.ts`
- Create: `hooks/reactquery/senderDefaults/apis.ts`, `keys.ts`, `queries.ts`, `index.ts`
- Create: `lib/messaging/senderDisplay.ts`
- Modify: `app/(staff)/staff/(app)/messaging/components/HistoryTab.tsx` (`:32` 근처 훅, `:132`)
- Modify: `app/(staff)/staff/(app)/messaging/components/ScheduledTab.tsx` (`:77` 근처 훅, `:175`)
- Modify: `app/(staff)/staff/(app)/messaging/components/MessageDetailModal.tsx` (`:45` 근처 훅, `:50`)
- Modify: `components/messenger/SenderSelect.tsx` (닫힌 표시값 `:159-161`, 기본번호 메뉴 행 `:252`)
- Modify: `components/messenger/SendSummaryDialog.tsx` (`:121`)
- Modify: `app/(staff)/staff/(app)/bill/components/DocumentOutputModal.tsx` (`:104` 근처 훅, `:432`)

**Interfaces:**
- Produces:
  - `GET /api/messaging/sender-defaults` → `{ smsSender: string | null; faxSender: string | null }`(숫자)
  - `interface SenderDefaults { smsSender: string | null; faxSender: string | null }`
  - `getSenderDefaults(): Promise<SenderDefaults>`, `senderDefaultsKeys.all`, `useSenderDefaults()`
  - `resolveDisplaySender(orgConfig, defaults, product: "sms" | "fax"): string | null | undefined`

- [ ] **Step 1: 라우트** — `app/api/messaging/sender-defaults/route.ts`

```ts
import { createClient } from "@/lib/supabase/server";

/**
 * 운영사 기본 발신번호(서버 env) 조회 — 화면 표시용.
 * 조직 번호(setup_config)가 없을 때 실제 발송에 쓰이는 번호를 화면에도 같은 값으로 보여 준다.
 * 비밀값은 아니지만 관리업체 직원만 조회한다.
 */

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function digitsOrNull(value: string | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: "로그인이 필요합니다." }, 401);

  const { data: contextData, error: contextError } = await supabase.rpc("get_my_context");
  if (contextError) return json({ error: "요청을 처리할 수 없습니다." }, 500);
  const row = (Array.isArray(contextData) ? contextData[0] : contextData) as { org_id?: number } | null;
  if (!row?.org_id) return json({ error: "권한이 없습니다." }, 403);

  const { data: isManagerStaff, error: personaError } = await supabase.rpc("current_user_is_manager_staff");
  if (personaError || isManagerStaff !== true) return json({ error: "권한이 없습니다." }, 403);

  return json({
    smsSender: digitsOrNull(process.env.POPBILL_SMS_SENDER),
    faxSender: digitsOrNull(process.env.POPBILL_FAX_SENDER),
  });
}
```

- [ ] **Step 2: React Query 훅** (`hooks/reactquery/vendors/` 구성과 같은 형태)

`hooks/reactquery/senderDefaults/keys.ts`
```ts
export const senderDefaultsKeys = {
  all: ["senderDefaults"] as const,
};
```

`hooks/reactquery/senderDefaults/apis.ts`
```ts
export interface SenderDefaults {
  smsSender: string | null;
  faxSender: string | null;
}

export async function getSenderDefaults(): Promise<SenderDefaults> {
  const res = await fetch("/api/messaging/sender-defaults");
  const data = (await res.json().catch(() => null)) as (Partial<SenderDefaults> & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error ?? "기본 발신번호를 불러오지 못했습니다.");
  return { smsSender: data?.smsSender ?? null, faxSender: data?.faxSender ?? null };
}
```

`hooks/reactquery/senderDefaults/queries.ts`
```ts
import { useQuery } from "@tanstack/react-query";
import { getSenderDefaults } from "./apis";
import { senderDefaultsKeys } from "./keys";

/** 운영사 기본 발신번호. 서버 env라 세션 중 바뀌지 않으므로 다시 조회하지 않는다. */
export function useSenderDefaults() {
  return useQuery({
    queryKey: senderDefaultsKeys.all,
    queryFn: getSenderDefaults,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
```

`hooks/reactquery/senderDefaults/index.ts`
```ts
export * from "./apis"; export * from "./keys"; export * from "./queries";
```

- [ ] **Step 3: 표시 헬퍼** — `lib/messaging/senderDisplay.ts`

```ts
/**
 * 화면 표시용 발신번호(숫자). 실제 발송과 같은 순서로 고른다: 조직 번호(setup_config) → 운영사 기본 번호(env).
 * undefined = 아직 모름(조회 중), null = 둘 다 없음.
 */
export type SenderProduct = "sms" | "fax";

type SenderNumbers = { smsSender: string | null; faxSender: string | null };

export function resolveDisplaySender(
  orgConfig: SenderNumbers | null | undefined,
  defaults: SenderNumbers | null | undefined,
  product: SenderProduct,
): string | null | undefined {
  if (orgConfig === undefined) return undefined;
  const own = (product === "fax" ? orgConfig?.faxSender : orgConfig?.smsSender)?.trim();
  if (own) return own;
  if (defaults === undefined) return undefined;
  const fallback = (product === "fax" ? defaults?.faxSender : defaults?.smsSender)?.trim();
  return fallback || null;
}
```

- [ ] **Step 4: 발송 내역·예약·상세** — 세 파일 모두 같은 방식이다.
  - import 추가: `import { useSenderDefaults } from "@/hooks/reactquery/senderDefaults";`, `import { resolveDisplaySender } from "@/lib/messaging/senderDisplay";`
  - `const { data: config } = useSetupConfig(me?.orgId);` 바로 아래에 추가한다.
    ```ts
      const senderDefaults = useSenderDefaults();
      const smsSender = resolveDisplaySender(config, senderDefaults.isError ? null : senderDefaults.data, "sms");
    ```
  - `HistoryTab.tsx:132` `senderLabel(log.channel, config?.smsSender)` → `senderLabel(log.channel, smsSender)`
  - `ScheduledTab.tsx:175` `senderLabel(msg.channel, config?.smsSender)` → `senderLabel(msg.channel, smsSender)`
  - `MessageDetailModal.tsx:50` `senderLabel(channel, config?.smsSender)` → `senderLabel(channel, smsSender)`

- [ ] **Step 5: 메신저 발신번호 선택** — `components/messenger/SenderSelect.tsx`
  - import 추가: `import { useSenderDefaults } from "@/hooks/reactquery/senderDefaults";`
  - `const { data: config } = useSetupConfig(me?.orgId);` 아래에 추가한다.
    ```ts
      const senderDefaults = useSenderDefaults();
      const defaultSms = senderDefaults.data?.smsSender ?? null;
      // '운영사 기본번호' 글자 자리에 실제 기본번호를 보여 준다(spec 4.3). 모르면 기존 글자.
      const defaultDisplay = defaultSms ? formatPhone(defaultSms) : "운영사 기본번호";
    ```
  - 닫힌 표시값 `{normalizedValue ? formatPhone(normalizedValue) : "운영사 기본번호"}` → `{normalizedValue ? formatPhone(normalizedValue) : defaultDisplay}`
  - 기본번호 메뉴 행 `<div className={styles.num}>운영사 기본번호</div>` → `<div className={styles.num}>{defaultDisplay}</div>`
  - `selectedLabel`, '기본'/'등록' 태그 판정, 옵션 label 문자열은 바꾸지 않는다.

- [ ] **Step 6: 발송 확인창** — `components/messenger/SendSummaryDialog.tsx`
  - import 추가: `import { useSenderDefaults } from "@/hooks/reactquery/senderDefaults";`, `import { formatPhone } from "@/lib/format";`
  - 컴포넌트 본문 첫 부분에 `const senderDefaults = useSenderDefaults();`와 `const defaultSms = senderDefaults.data?.smsSender ?? null;`를 추가한다.
  - `{channel === "alim" ? "관리비서 채널" : sender?.trim() || "운영사 기본번호"}`를 다음으로 바꾼다.
    ```tsx
    {channel === "alim"
      ? "관리비서 채널"
      : sender?.trim()
        ? formatPhone(sender.trim())
        : defaultSms
          ? formatPhone(defaultSms)
          : "운영사 기본번호"}
    ```

- [ ] **Step 7: 팩스 확인 모달** — `DocumentOutputModal.tsx`
  - import 추가: `useSetupConfig`(`@/hooks/reactquery/setupConfig`), `useSenderDefaults`(`@/hooks/reactquery/senderDefaults`), `resolveDisplaySender`(`@/lib/messaging/senderDisplay`), `formatPhone`(`@/lib/format`) — 이미 있는 import는 중복하지 않는다.
  - `:104` 근처 다른 훅들 옆(조건문 밖, 최상위)에 추가한다.
    ```ts
      const { data: setupConfig } = useSetupConfig(orgId);
      const senderDefaults = useSenderDefaults();
      const faxSender = resolveDisplaySender(setupConfig, senderDefaults.isError ? null : senderDefaults.data, "fax");
      const faxSenderLabel = faxSender === undefined ? "" : faxSender ? formatPhone(faxSender) : "발신번호 미등록";
    ```
  - `:432` `senderLabel="등록 발신번호 · 본사"` → `senderLabel={faxSenderLabel}`

- [ ] **Step 8: 검증**

Run: `node ./node_modules/typescript/bin/tsc --noEmit -p .`
Expected: 오류 0.

Run: `node ./node_modules/eslint/bin/eslint.js app/api/messaging/sender-defaults/route.ts hooks/reactquery/senderDefaults lib/messaging/senderDisplay.ts "app/(staff)/staff/(app)/messaging/components/HistoryTab.tsx" "app/(staff)/staff/(app)/messaging/components/ScheduledTab.tsx" "app/(staff)/staff/(app)/messaging/components/MessageDetailModal.tsx" components/messenger/SenderSelect.tsx components/messenger/SendSummaryDialog.tsx "app/(staff)/staff/(app)/bill/components/DocumentOutputModal.tsx"`
Expected: 오류 0.

- [ ] **Step 9: 커밋**

```bash
git add app/api/messaging/sender-defaults/route.ts hooks/reactquery/senderDefaults lib/messaging/senderDisplay.ts "app/(staff)/staff/(app)/messaging/components/HistoryTab.tsx" "app/(staff)/staff/(app)/messaging/components/ScheduledTab.tsx" "app/(staff)/staff/(app)/messaging/components/MessageDetailModal.tsx" components/messenger/SenderSelect.tsx components/messenger/SendSummaryDialog.tsx "app/(staff)/staff/(app)/bill/components/DocumentOutputModal.tsx"
git diff --cached --name-only
git commit -m "feat(messaging): 발신번호 표시를 실제 발송과 같은 순서로 — 조직 번호 → 운영사 기본 번호"
```

---

### Task 8: 운영 DB 적용과 검증 (Claude)

**Files:** 없음(DB 작업). 앞 태스크의 `0224`·`0225` 마이그레이션과 검증 SQL을 쓴다.

- [ ] **Step 1: 번호 재확인**

```bash
git -C C:/Users/leebj/orca/projects/home_erp fetch -q origin
MSYS_NO_PATHCONV=1 git -C C:/Users/leebj/orca/projects/home_erp ls-tree --name-only origin/master supabase/migrations/ | tail -3
git -C C:/Users/leebj/orca/projects/home_erp status --short supabase/migrations/
```

Expected: origin 최대 번호가 0223이고 master 체크아웃에 0224·0225 미커밋 파일이 없다. 다르면 번호를 올리고 파일명·검증 SQL·커밋을 고친다.

- [ ] **Step 2: 0224 적용·검증** (auto 모드가 막으면 사용자에게 `!` 실행을 부탁한다 — 경로는 슬래시)

```bash
node --env-file=C:/Users/leebj/orca/projects/home_erp/.env.local C:/Users/leebj/orca/projects/home_erp/scripts/db-query.mjs <WT>/supabase/migrations/0224_popbill_provider_env.sql
node --env-file=C:/Users/leebj/orca/projects/home_erp/.env.local C:/Users/leebj/orca/projects/home_erp/scripts/db-query.mjs <WT>/supabase/verify/0224_popbill_provider_env_checks.sql
```

Expected: 둘 다 `[]`(오류 없음).

- [ ] **Step 3: 0225 적용·검증**

```bash
node --env-file=C:/Users/leebj/orca/projects/home_erp/.env.local C:/Users/leebj/orca/projects/home_erp/scripts/db-query.mjs <WT>/supabase/migrations/0225_message_recurrence_on_settle.sql
node --env-file=C:/Users/leebj/orca/projects/home_erp/.env.local C:/Users/leebj/orca/projects/home_erp/scripts/db-query.mjs <WT>/supabase/verify/0225_message_recurrence_trigger_checks.sql
```

Expected: 첫 줄 `[]`, 둘째 줄은 HTTP 400과 함께 `OK 0225 (sent→1, again→1, failed→0) — rolled back`. `FAIL 0225`면 멈추고 원인을 본다.

- [ ] **Step 4: 옛 코드 호환** — 배포본은 병합 전까지 옛 인자(`{p_limit}`, `{p_bill_issue_id}`)로 부른다. PostgREST는 기본값 있는 인자를 생략한 호출도 같은 함수로 연결하므로, Step 2 검증 SQL로 새 시그니처만 남은 것을 확인한 것으로 갈음한다. `claim_provider_dispatch_jobs`는 부르면 실제로 작업을 잡으므로 시험 호출하지 않는다.

---

### Task 9: master 병합과 확인

- [ ] **Step 1: 최종 검증** (워크트리): tsc 0, 바뀐 파일 eslint 0. 사용 가능 메모리가 2GB 이상이면 `node ./node_modules/next/dist/bin/next build --webpack`도 돌리고, 아니면 생략했다고 보고한다. 끝나면 정션을 지운다: `cmd //c "rmdir <WT>\node_modules"`.
- [ ] **Step 2: 병합·push** — Task 8이 끝난 뒤에만 한다.

```bash
git -C C:/Users/leebj/orca/projects/home_erp merge --no-ff PracLee/<이름> -m "Merge PracLee/<이름>: 팝빌 실발송 운영 전환 준비(허용 번호·발송 환경·반복 예약·잔액 부족·발신번호 표시)"
git -C C:/Users/leebj/orca/projects/home_erp push origin master
```

- [ ] **Step 3: :3000 확인(테스트 모드)**
  - `http://localhost:3000/staff/messaging` 발송 내역·예약 탭의 발신번호가 042-632-8770으로 보인다.
  - 서류 발행 팩스 확인 모달의 발신번호가 042-623-6642(조직 팩스 번호가 없으면 기본 번호)로 보인다.
  - 메신저 발신번호 메뉴의 기본번호 행에 042-632-8770이 보인다.
  - 메신저로 시험 세대 1곳에 문자 1건 → "발송을 접수했습니다 · 1건 · 결과 확인 중". DB 집계 `select provider_env, count(*) from public.provider_dispatch_jobs where created_at > now() - interval '15 minutes' group by 1;` → `test`만 있다.
- [ ] **Step 4: WBS·기록** — `wbs-commit-sync` 스킬로 병합 커밋을 '사무실 관리자_문자·알림톡 관리'에 반영한다(dev=진행중 유지). 메모리 `track-e-messaging-realsend-status`에 이번 결과(허용 번호·provider_env·0224/0225·잔여=팝빌 운영전환)를 덧붙인다.

---

## 운영 키가 온 뒤 (코드 작업 아님)

설계 5절 3~6을 그대로 따른다.

1. 조회 점검(스크래치패드 `popbill-probe.cjs prod`) — 운영 가입·발신번호 state·잔액.
2. Amplify 환경변수 `POPBILL_IS_TEST=false`, `POPBILL_LIVE_ALLOWLIST=<담당자 휴대폰>`, `POPBILL_LIVE_RESTRICTED_ORG_IDS=<데모 조직 id>`(조직 목록으로 확인)를 넣고 재배포한다.
3. AWS 로그인(사용자: `! aws sso login --profile home-erp --use-device-code`) 뒤 `aws events list-rules --profile home-erp --region ap-northeast-2`로 결과 재조회 규칙이 있는지 본다. 없으면 `docs/ops/eventbridge-scheduled-messaging.md` 7절 방식(기존 Connection 재사용·전용 IAM 역할)으로 만들고, 만든 리소스를 그 7절에 기록해 커밋한다.
4. 시험 발송 3d·3d2·3e·3f → 4.4 데모 예약 정리 → `POPBILL_LIVE_ALLOWLIST=*`로 열기.

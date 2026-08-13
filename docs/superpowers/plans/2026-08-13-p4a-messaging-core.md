# P4a 문자·알림톡 공용 모듈 코어 Implementation Plan

> **실행 모델(codex 오케스트레이션):** 각 태스크는 **codex 헤드리스 워커**가 파일 작성 + `npx vitest`/`tsc` 실행으로 수행한다(계약·수용조건·테스트 기대치 기반, codex가 구현 코드 작성). **git add/commit·npm install·최종 리뷰는 Claude(오케스트레이터)** 가 담당(codex 샌드박스는 git·네트워크 차단). codex는 커밋하지 않는다. 각 태스크 끝 "Claude: 리뷰→커밋".

**Goal:** `/messaging` SMS 즉시발송 공용 엔진(stub)·수신처(세대·건물주·직원)·발송이력 + 컨텍스트 프리셋 인터페이스 + overdue 독촉 실배선.

**Architecture:** 발송=`send_messages` RPC stub(message_logs 기록, 실 NCP는 P4d 드롭인). 프리셋=해결된 `MessageRecipient[]` 계약. 공용 `MessagingComposer`를 `/messaging`(빈 프리셋)과 `MessagingModal`(컨텍스트 프리셋)이 공유. 기존 reactquery 도메인 패턴 계승.

**Tech Stack:** Next.js 16(App Router,"use client") · Supabase(Postgres·Auth) · React Query · zod · Tailwind · Vitest+RTL.

**기준 spec:** `docs/superpowers/specs/2026-08-13-p4a-messaging-core-design.md`. **브랜치:** `PracLee/anchovy`(origin/master=p3b).

## Global Constraints
- 권한 모듈 키 `messaging`. 화면 게이트 `hasModule(me,"messaging")`, 쓰기 RLS/RPC `current_user_has_module('messaging')`.
- 채널 P4a=`'sms'`만. 발송=**stub**(`message_logs.result='stub'`, 실발송 없음).
- 프리셋 수신처=**해결된 리스트**(`MessageRecipient[]`). 6개 호출부 공통 계약.
- 데이터 계층 패턴: 도메인 폴더 `apis.ts`(+snake↔camel 매퍼)·`keys.ts`·`queries.ts`·`mutations.ts`·`index.ts`. RPC 호출 `createClient().rpc("fn",{p_arg})`→`{data,error}`, 에러 throw.
- RLS: 신규 테이블 SELECT org 개방(`org_id in (select my_org_ids())`), 쓰기는 definer RPC만(직접 write policy 없음).
- 금액/카운트 integer. Tailwind는 globals.css 실존 토큰만(없으면 기존 컴포넌트가 쓰는 토큰으로 대체).
- 커밋(Claude): 한국어 conventional + 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- DB 라이브 미적용(원격 미접속). SQL 검증=정적(`p4_checks.sql`)+Claude 리뷰. 마이그 번호 0007(적용 시 0009+ 재번호).
- **codex 실행 규칙**: 파일 작성 후 `npx vitest run <파일>` + `npx tsc --noEmit`로 자가검증, 결과를 `--output-last-message`로 보고. git 금지.

---

## File Structure
- `supabase/migrations/0007_p4_messaging.sql` (create) · `supabase/verify/p4_checks.sql` (create)
- `lib/messaging/preset.ts` (+`.test.ts`) — 공유 타입 + 순수 헬퍼(dedup·count·payload)
- `hooks/reactquery/messaging/{apis.ts,keys.ts,queries.ts,mutations.ts,index.ts,apis.test.ts}` (create)
- `app/(staff)/staff/messaging/page.tsx` (+`page.test.tsx`) (create)
- `app/(staff)/staff/messaging/components/{MessagingComposer,MessagingModal,MessageLogList}.tsx` (+ Composer `.test.tsx`) (create)
- `components/shell/navItems.ts` (modify) + `navItems.test.ts` (modify)
- `app/(staff)/staff/overdue/page.tsx` (modify) — 독촉 재배선; `components/MessagingPreviewModal.tsx` 제거, `hooks/reactquery/overdue` `usePrepareOverdueMessage` 정리
- 재사용(불변): `@/components/common`(Modal/Button/Select/EmptyState/Spinner), `hooks/reactquery/{auth,buildings,occupancies(list_tenants),accounts}`, `quick_messages`(0003).

---

## Group 1 — DB · 계약 · 데이터층

### Task 1: 마이그레이션 0007 (message_logs + RLS + RPC) + verify
**Files:** Create `supabase/migrations/0007_p4_messaging.sql`, `supabase/verify/p4_checks.sql`
**Interfaces (produces):**
- table `message_logs(id, org_id, channel, body, context, recipient_count, recipients jsonb, result, sent_by, sent_at, created_at)` — spec §3 DDL 그대로.
- `send_messages(p_channel text, p_body text, p_context text, p_recipients jsonb) → jsonb {log_id, count}` (definer, `messaging` 게이팅, anon revoke).
- `list_message_logs(p_limit int default 50) → setof message_logs` (definer, org, sent_at desc, anon revoke).

**작성 지침(codex):** spec §3의 DDL을 정확히 작성. `send_messages`: `current_user_org()` null 체크 → `current_user_has_module('messaging')` 아니면 `raise exception 'forbidden: messaging required'` → `p_recipients`의 각 원소에 `result:'stub'` 부여(jsonb 가공) → `message_logs` 1행 insert(`channel=p_channel, body=p_body, context=coalesce(p_context,'manual'), recipient_count=jsonb_array_length(coalesce(p_recipients,'[]')), recipients=<result 부여된 배열>, result='stub', sent_by=auth.uid()`) → `return jsonb_build_object('log_id', <id>, 'count', recipient_count)`. RLS: `ml_select`(org 개방)만, write policy 없음. 0006 `list_tenants`/save RPC의 definer·revoke 패턴 참고.
`p4_checks.sql`: message_logs 존재, `ml_select` 존재, message_logs에 SELECT 외 policy 없음(`cmd<>'SELECT'` 시 raise), `send_messages`·`list_message_logs` 존재.

**수용조건:** DDL이 spec과 일치, send_messages가 모듈 게이팅+stub 기록, billing_history류처럼 직접 write 불가. (DB 미연결→정적; codex는 SQL 문법만 육안 확인, vitest/tsc 불필요.)
**Claude: 리뷰(미검증 SQL 정밀 검토)→커밋** `feat(db): P4a message_logs+send_messages RPC(stub)·messaging RLS(0007)+p4_checks`

### Task 2: `lib/messaging/preset.ts` (계약 + 순수 헬퍼)
**Files:** Create `lib/messaging/preset.ts`, `lib/messaging/preset.test.ts`
**Interfaces (produces):**
```ts
export type MessageChannel = "sms";
export interface MessageRecipient { name: string|null; phone: string|null; unitNo?: string|null;
  kind: "tenant"|"owner"|"staff"|"vendor"|"etc"; ref?: {occupancyId?:number; buildingId?:number; userId?:string} }
export interface MessagingPreset { context: string; channel?: MessageChannel; body?: string; recipients?: MessageRecipient[] }
export function dedupeRecipients(rs: MessageRecipient[]): MessageRecipient[]   // phone 기준 유일(phone null은 각각 유지)
export function validRecipients(rs: MessageRecipient[]): MessageRecipient[]     // phone 있는 것만
export function buildSendPayload(p: {channel:MessageChannel; body:string; context:string; recipients:MessageRecipient[]}): {channel:MessageChannel; body:string; context:string; recipients:MessageRecipient[]} // dedupe+valid 적용
```
**Tests (기대치):** dedupe(중복 phone 1개로, null phone 보존), validRecipients(phone null 제외), buildSendPayload(dedupe+valid 결합·context 기본 'manual' 아님-그대로).
**수용조건:** 순수함수(React/Supabase 무의존), `npx vitest run lib/messaging/preset.test.ts` 그린, `tsc` 클린.
**Claude: 리뷰→커밋** `feat(messaging): 프리셋 계약 타입 + 수신처 순수 헬퍼(dedupe·valid·payload)`

### Task 3: `hooks/reactquery/messaging` 도메인
**Files:** Create `apis.ts`,`keys.ts`,`queries.ts`,`mutations.ts`,`index.ts`,`apis.test.ts` under `hooks/reactquery/messaging/`
**Interfaces (produces):**
- `interface MessageLog { id; orgId; channel; body; context; recipientCount; recipients: MessageRecipient[]; result; sentBy; sentAt }` (snake↔camel).
- `sendMessages(p:{channel:MessageChannel; body:string; context:string; recipients:MessageRecipient[]}) → Promise<{logId:number; count:number}>` → RPC `send_messages`(camel→snake: `p_channel,p_body,p_context,p_recipients`).
- `listMessageLogs(limit?:number) → Promise<MessageLog[]>` → RPC `list_message_logs`({p_limit}).
- `messagingKeys = { all:["messaging"], logs:(limit)=>["messaging","logs",limit] }`.
- `useMessageLogs(limit?)`(useQuery), `useSendMessages()`(useMutation, onSuccess invalidate `messagingKeys.all`).
**Consumes:** `MessageChannel`,`MessageRecipient` (lib/messaging/preset).
**Tests (apis.test):** `sendMessages` RPC명·인자(snake) 매핑, `listMessageLogs` snake→camel(recipients jsonb→MessageRecipient[]), 에러 throw. (feeItems/occupancies apis.test 패턴: mock `@/lib/supabase/client`.)
**수용조건:** `npx vitest run hooks/reactquery/messaging/apis.test.ts` 그린, `tsc` 클린.
**Claude: 리뷰→커밋** `feat(messaging): reactquery 도메인(send/list logs) + apis 테스트`

---

## Group 2 — 공용 컴포넌트 · 화면

### Task 4: `MessagingComposer` (공용)
**Files:** Create `app/(staff)/staff/messaging/components/MessagingComposer.tsx`, `MessagingComposer.test.tsx`
**Interfaces (props):** `{ preset?: MessagingPreset; onSent?: (r:{logId:number;count:number})=>void }`
**동작(수용조건):**
- 채널 표시(SMS 고정 라벨).
- **수신처 선택**: 건물 Select(`useBuildings`) → 선택 시 세대 목록(`list_tenants`→occupancies phone) 체크박스 + 건물주 토글(building.ownerName/ownerPhone) + 직원 목록(`listAccounts`, phone) 체크. 선택분을 `MessageRecipient[]`로 합성(kind: tenant/owner/staff, ref 채움). 실시간 "N명"(=`validRecipients` 카운트) 표시.
- preset.recipients 있으면 초기 수신처로 채우고, preset.body 있으면 본문 초기값.
- **본문**: textarea + `quick_messages` 드롭다운(선택 시 본문에 삽입). (quick_messages 읽기: 기존 훅 있으면 재사용, 없으면 `hooks/reactquery/quickMessages` 읽기 fn 추가 — codex가 확인.)
- **발송**: [발송] → `window.confirm("N명에게 발송하시겠습니까?")` → `useSendMessages().mutateAsync(buildSendPayload({channel:'sms',body,context:preset?.context??'manual',recipients}))` → 성공 토스트 `"발송(임시) 완료 · N명"` + `onSent` 호출. 수신처 0·본문 공백 시 발송 비활성/toast.info.
**Tests:** 렌더(수신처 소스), 세대 선택 시 카운트 증가, 본문 입력, preset 주입 시 초기 수신처·본문 반영, 발송 시 confirm→mutateAsync 호출(payload에 valid 수신처·context), 빈 상태 가드. (mock: hooks + sonner + window.confirm.)
**수용조건:** `npx vitest run "app/(staff)/staff/messaging/components/MessagingComposer.test.tsx"` 그린, `tsc` 클린, RTL 경고 없음.
**Claude: 리뷰→커밋** `feat(messaging): MessagingComposer(수신처 세대·건물주·직원·본문·quick·발송)`

### Task 5: `MessagingModal` + `MessageLogList` + `/messaging` page
**Files:** Create `MessagingModal.tsx`, `MessageLogList.tsx` under `.../messaging/components/`; `app/(staff)/staff/messaging/page.tsx`, `page.test.tsx`
**Interfaces:**
- `MessagingModal` props `{ open:boolean; preset?:MessagingPreset; onClose:()=>void; onSent?:(r)=>void }` → `Modal`(open 전달) + `MessagingComposer preset onSent`.
- `MessageLogList` props `{ logs: MessageLog[]; isLoading?:boolean }` → 발송자·일시·수신처수·채널·본문요약·결과 표.
- `page.tsx`: `"use client"`, 게이트 `hasModule(me,"messaging")`(없으면 EmptyState), 상단 `MessagingComposer`(프리셋 없음) + 하단 `MessageLogList`(`useMessageLogs()`). 발송 후 이력 자동 갱신(invalidate).
**Tests(page):** 권한 없으면 차단, Composer·이력 렌더, `useMessageLogs` 소비. `MessagingModal` open=false 미렌더(Modal null).
**수용조건:** `npx vitest run "app/(staff)/staff/messaging"` 그린, `tsc` 클린.
**Claude: 리뷰→커밋** `feat(messaging): /messaging 화면(Composer+이력) + MessagingModal 공용 래퍼`

### Task 6: GNB 네비 항목
**Files:** Modify `components/shell/navItems.ts`, `components/shell/navItems.test.ts`
**동작:** 기존 nav 항목 스키마 확인 후 `문자·알림톡 발송`(href `/staff/messaging`, module `messaging`) 항목 추가(적절한 위치·아이콘은 기존 패턴 따름). navItems.test에 해당 항목 존재 단언 추가.
**수용조건:** `npx vitest run components/shell/navItems.test.ts` 그린, `tsc` 클린.
**Claude: 리뷰→커밋** `feat(messaging): GNB에 문자·알림톡 발송 항목 추가`

---

## Group 3 — 호출부 배선

### Task 7: `/overdue` 독촉 재배선 + 전체 회귀
**Files:** Modify `app/(staff)/staff/overdue/page.tsx`; remove `app/(staff)/staff/overdue/components/MessagingPreviewModal.tsx`; clean `usePrepareOverdueMessage`/`OverdueMessageDraft` in `hooks/reactquery/overdue` (미사용 시 제거, 타입 참조 정리)
**동작(수용조건):**
- `openMessagingPreview`가 만드는 수신처(`{occupancyId,unitNo,tenantName,phone}`)를 `MessageRecipient[]`(`{name:tenantName, phone, unitNo, kind:'tenant', ref:{occupancyId}}`)로 매핑.
- `MessagingPreviewModal` 렌더 → `MessagingModal open={!!msgOpen} preset={{context:'독촉', channel:'sms', body:<독촉 기본문구 상수>, recipients}} onClose onSent={()=>toast.success(...)}`로 교체. 상태(messageDraft→open+recipients)로 정리.
- overdue 기존 동작(건물 선택·채권 필터·선택·미납대장 출력) 불변, overdue 테스트 통과.
**Tests:** overdue page 테스트에서 독촉 클릭 시 MessagingModal이 preset(context '독촉'·recipients)으로 열리는지. 기존 overdue 테스트 회귀.
**최종 회귀(codex):** `npx vitest run`(전체) + `npx tsc --noEmit` + `npm run lint`(신규 에러 0 확인, 기존 buildings/ 에러는 무관 보고).
**Claude: 리뷰→커밋** `feat(messaging): overdue 독촉을 공용 발송 모듈로 배선(MessagingModal 프리셋)` **→ WBS 동기화**(화면: 미납관리 + 문자·알림톡 관리).

---

## 최종 검증 (Claude)
- `npx vitest run` 전체 그린, `tsc` 클린, `lint` 신규 0.
- `p4_checks.sql` 존재(라이브 검증은 사용자 PC, 0009+ 재번호 후 적용).
- codex 미검증 SQL(Task 1) 정밀 리뷰 완료.
- 최종 전체 브랜치 리뷰(codex `exec review` 또는 Claude) → finishing-a-development-branch(PR).

## Self-Review (작성자)
- **Spec 커버리지:** §3 스키마·RPC→T1; §4 계약→T2; §5 데이터층→T3; §6 UI→T4·T5; GNB→T6; §7 overdue 배선→T7; §8 테스트→각 T. Out-of-scope(알림톡·예약·NCP·타 호출부) 계획에서도 제외(일치).
- **플레이스홀더:** 계약(SQL·타입·시그니처)은 명시. 구현 본문은 codex 위임(수용조건+테스트로 제약) — 의도된 실행 모델. "기존 훅 있으면 재사용"은 codex 확인 지시(허용).
- **타입 일관성:** `MessageRecipient`/`MessagingPreset`/`MessageChannel`(T2) ↔ apis `MessageLog`·`sendMessages`(T3) ↔ Composer/Modal props(T4·T5) ↔ overdue 매핑(T7) 일치. RPC 인자 `p_channel/p_body/p_context/p_recipients/p_limit`(T1↔T3) 일치. 모듈키 `messaging` 일관.

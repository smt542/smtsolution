# 알림톡 Phase 3 — context별 변수 렌더 배선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans. 스텝은 `- [ ]` 체크박스.

**Goal:** 각 발송 context(고지서·독촉·정산·민원AS·공지)가 알림톡 템플릿의 **본문 변수를 수신자별로 채워**(`renderedBody`) 올바른 템플릿·모드로 발송하도록 배선한다. 버튼/토큰은 Phase 2.

**Architecture:** 모든 발송은 `MessagingComposer`로 수렴하나 현재 렌더러는 변수 3개(이름·호수·건물명)만 치환한다(`MessagingComposer.tsx:171-175`). **핵심 = per-recipient 변수맵을 preset로 받아 병합 렌더**하는 메커니즘(T1) + context별 변수 공급(T3~T7) + org.phone/포맷 공용화(T2). 미치환 `#{}`가 남으면 `submitAlimtalk`이 거절(`lib/popbill/messages.ts:141-145`)하므로 렌더 완결이 목표.

**Tech Stack:** `lib/messaging/render.ts`(`renderTemplate`, `#{키}`), `MessagingPreset`/`MessagingComposer`, context 페이지들, Supabase RPC(정산 컨텍스트 확장).

## Global Constraints
- 알림톡 대상 수신자의 `renderedBody`에는 **미치환 `#{}`가 0**이어야 접수된다.
- 템플릿 선택은 **0098 seed의 정확한 title**로 한다(substring 매칭 금지). Titles: `관리비 고지서`·`관리비 미납 안내`·`이사정산 내역서`·`민원·AS 처리 안내`·`공지 안내(신규|중요|긴급)`.
- alimtalk/sms 라우팅은 서버 동의(`occupancies.alimtalk_opt_in`) 재판정을 유지한다(`resolve_message_point_quote`). context는 `mode:'auto'` 권장(미동의자 자동 SMS 대체).
- 실 발송은 Phase 4(`alimtalk_template_code` 입력)까지 게이팅. 본 Phase는 코드 없이 **렌더·모드·templateId·테스트**까지 완성.
- 변수 사전·문안 정본: `docs/superpowers/specs/2026-08-25-alimtalk-templates-design.md`.

---

## File Structure
- Modify: `lib/messaging/preset.ts` — `MessageRecipient.variables`, `MessagingPreset.commonVariables`.
- Modify: `app/(staff)/staff/messaging/components/MessagingComposer.tsx:171-175` — 병합 렌더.
- Create: `lib/messaging/vars.ts` — 포맷 헬퍼(금액/월/날짜/세대/계좌).
- Create: `hooks/reactquery/org/useOrgContact.ts` — `organizations.phone` 로드.
- Modify(컨텍스트별): `staff/bill/page.tsx`, `staff/overdue/page.tsx`, `staff/moving-settlement/**`, `staff/receipts/**`, `staff/notices/**`.
- Modify(정산 데이터): `hooks/reactquery/movingSettlement/apis.ts` + `get_settlement_context` RPC(신규 마이그).

---

## Task 1: per-recipient 변수 메커니즘 (토대)

**Files:** Modify `lib/messaging/preset.ts`; Modify `app/(staff)/staff/messaging/components/MessagingComposer.tsx`; Test `lib/messaging/preset.test.ts` 또는 컴포저 테스트.

**Interfaces:**
- Produces: `MessageRecipient.variables?: Record<string, string>` (수신자별 치환값).
- Produces: `MessagingPreset.commonVariables?: Record<string, string>` (발송 전체 공통값, 예 `관리사무소연락처`).
- Produces: 컴포저 렌더 규약 — 우선순위 `recipient.variables` > `commonVariables` > 기본(이름/호수/건물명).

- [ ] **Step 1: 실패 테스트** — 수신자별 `variables`가 본문에 치환되는지.

```ts
// 두 수신자가 서로 다른 #{청구금액}로 렌더되는지
const recips = [
  { name:"홍길동", phone:"01011112222", unitNo:"101", kind:"tenant", variables:{ 청구금액:"120,000", 세대:"101동 1001호" } },
  { name:"김철수", phone:"01033334444", unitNo:"102", kind:"tenant", variables:{ 청구금액:"98,000", 세대:"101동 1002호" } },
];
// 컴포저 렌더 로직(추출 함수) 호출 → renderedBody[0] 포함 "120,000", [1] 포함 "98,000", 미치환 #{} 없음
```

- [ ] **Step 2: 실패 확인** — 현재 3변수만 치환하므로 `#{청구금액}` 잔존으로 실패.

- [ ] **Step 3: 구현** — `preset.ts`에 필드 추가 + 컴포저 렌더 병합. 렌더 로직을 순수 함수로 추출(테스트 용이).

```ts
// preset.ts
export interface MessageRecipient { /* ...기존... */ variables?: Record<string, string>; }
export interface MessagingPreset { /* ...기존... */ commonVariables?: Record<string, string>; }

// MessagingComposer.tsx (171-175 대체)
const vars = {
  이름: recipient.name ?? "", 호수: recipient.unitNo ?? "",
  건물명: selectedBuilding?.name ?? "",
  ...(preset?.commonVariables ?? {}),
  ...(recipient.variables ?? {}),
};
const renderedBody = renderTemplate(effectiveBody, vars);
```

- [ ] **Step 4: 통과 확인** — `npx vitest run <파일>`
- [ ] **Step 5: 커밋** — `feat: per-recipient template variables in messaging composer`

## Task 2: org 연락처 + 포맷 공용화

**Files:** Create `lib/messaging/vars.ts`; Create `hooks/reactquery/org/useOrgContact.ts`; Test `lib/messaging/vars.test.ts`.

**Interfaces:**
- Produces: `formatKrw(n:number):string`("120,000"), `formatPeriodMonth(d:string):string`("2026년 8월"), `formatDate(d:string):string`("2026-08-31"), `formatUnit(dong,unitNo):string`("101동 1001호"), `formatAccount(bank,acct):string`.
- Produces: `useOrgContact():{ phone:string|null }` — `organizations.phone`(RLS 내 org). context는 `commonVariables['관리사무소연락처']=phone`로 주입.

- [ ] Step 1~5: 각 포맷 함수 단위 테스트(경계: null·0·미확정) → 구현 → `useOrgContact` 훅 → 통과 → 커밋 `feat: shared messaging variable formatters + org contact`.

## Task 3: 고지서 context

**Files:** Modify `app/(staff)/staff/bill/page.tsx`(84-111 recipients 조립, 207-217 preset), `components/BillTargetTable.tsx`. Test: 페이지 단위/통합.
**현황(codex):** 이미 `mode:"alimtalk"`+templateId 접수 직전. 본문 변수만 미충족.

- [ ] Step 1: 실패 테스트 — 발송 payload의 각 recipient.variables가 6종(건물명·세대·청구월·청구금액·납기일·납부계좌) 채워지고 renderedBody에 `#{}` 없음. templateId=정확 `관리비 고지서`.
- [ ] Step 2~4: 구현 — recipients 조립 시 `BillTarget`에서 매핑:
  - `세대`=`formatUnit(target.dong,target.unitNo)` · `청구월`=`formatPeriodMonth(period)` · `청구금액`=`formatKrw(target.totalAmount)` · `납기일`=`formatDate(dueDate ?? target.dueDate)` · `납부계좌`=`formatAccount(config.mgmtBank1,config.mgmtAcct1)`(setupConfig 로드) · 공통 `건물명`=`building.name`·`관리사무소연락처`=useOrgContact. preset.templateTitle을 정확 title로.
- [ ] Step 5: 커밋 `feat: fill bill alimtalk template variables`.

## Task 4: 미납(독촉) context

**Files:** Modify `app/(staff)/staff/overdue/page.tsx`(190-213 preset, 343-350 modal, 352-355 낡은 토스트 정리).
**현황(codex):** 실 SMS로 나감. alimtalk화 필요. recipients에 `buildingId` 누락(건물명 공란 위험).

- [ ] Step 1: 실패 테스트 — preset `mode:'auto'`(또는 alimtalk)+templateId `관리비 미납 안내`, 각 recipient.variables(미납금액·미납월·납기일)+공통(건물명·관리사무소연락처), `buildingId` 포함, renderedBody `#{}` 없음.
- [ ] Step 2~4: 구현 — `OverdueHousehold`↔`overduePeriods` 상관(occupancyId 기준). **정책 확정 필요(비고)**: 미납월 다건 시 표기(최근월? 목록?)·연체료 포함여부(`미납금액`에 `lateFeeAmount` 합산 여부)·다건 납기일 선택. 낡은 토스트 문구 교체.
- [ ] Step 5: 커밋 `feat: overdue reminder alimtalk wiring`.

> **결정 필요(구현 전):** 미납 다월 표기·연체료 합산·납기일 선택 정책. 미결 시 "최근 미납월 1건 + 연체료 별도 문구" 기본안 적용.

## Task 5: 정산 context (신규 발송 + 데이터 확장)

**Files:** Modify `hooks/reactquery/movingSettlement/apis.ts:49-72`(context 확장); 신규 마이그(=`get_settlement_context` 확장: building name·phone·consent); Modify `moving-settlement/page.tsx:69-121`(building 전달), `components/SettlementActions.tsx:75-101`(전송 스텝 신설).
**현황(codex):** 발송 없음. occupancy 전화·건물명·정산구분 부재.

- [ ] Step 1: 실패 테스트 — 저장/완료 후 발송 액션이 preset(templateTitle `이사정산 내역서`, recipient.variables 퇴실일·정산구분·정산금액·세대, 공통 건물명·관리사무소연락처)을 구성.
- [ ] Step 2~4: 구현 — (a) `get_settlement_context`에 building name·occupancy phone·alimtalk consent 추가(마이그). (b) `정산구분`=금액 부호 파생(`환급`|`추가납부`) 또는 draft 필드 신설. (c) `SettlementActions` 스텁(91-101)을 실제 `MessagingModal` 오픈으로 교체. 대상=퇴실자(+건물주 옵션).
- [ ] Step 5: 커밋 `feat: moving-settlement statement alimtalk wiring`.

## Task 6: 민원·AS context (입주자 대상 신설)

**Files:** Modify `app/(staff)/staff/receipts/page.tsx:304-309`(occFull의 occupancyId·consent를 AsStatusSection에 전달), `components/AsStatusSection.tsx`(기사 SMS는 유지, 입주자 알림 신설).
**현황(codex):** 기사향 SMS만 있음. 입주자향 템플릿 미배선. occupancyId 미전달.

- [ ] Step 1: 실패 테스트 — 상태 변경 후(또는 전용 액션) 입주자 대상 preset(templateTitle `민원·AS 처리 안내`, variables 접수내용·처리상태·담당자, ref.occupancyId 포함, mode:'auto').
- [ ] Step 2~4: 구현 — `receipts/page.tsx`에서 occupancyId/consent 전달. `접수내용`=`complaint.content ?? title`·`처리상태`=`COMPLAINT_STATUS_LABEL[status]`(`constants.ts:13-18`)·`담당자`=assignee fullName. 기사 SMS 경로는 그대로 둔다(별개).
- [ ] Step 5: 커밋 `feat: resident-facing complaint/AS alimtalk wiring`.

## Task 7: 공지 context (신설)

**Files:** Modify `app/(staff)/staff/notices/components/NoticeDetail.tsx:50-53`(비활성 버튼 활성화), 수신자 해석(건물=`useTenantList(buildingId)`; 전체=신규 쿼리/RPC), noticeType→title 매핑(`utils.ts:3-7`).
**현황(codex):** 발송 없음(비활성 스텁). 수신자 미해석.

- [ ] Step 1: 실패 테스트 — 발송 시 noticeType→정확 title(`normal→공지 안내(신규)`·`important→공지 안내(중요)`·`urgent→공지 안내(긴급)`), variables 공지제목(=notice.title), 공통 건물명·관리사무소연락처, 대상 세대 해석.
- [ ] Step 2~4: 구현 — 버튼 활성화 + `MessagingModal` 오픈, `useTenantList(buildingId)`로 건물 세대 수신자, 전체공지는 all-buildings 수신자 쿼리 신설. 예약 공지는 `schedule_messages` 연동.
- [ ] Step 5: 커밋 `feat: notice announcement alimtalk wiring`.

## Task 8: 통합 테스트 + 회귀

- [ ] 각 context 테스트: 정확 `templateId`·`mode`·수신자별 `renderedBody`(미치환 `#{}` 0)·동의 라우팅(미동의→sms 대체 or 제외)·즉시/예약 동등성.
- [ ] 회귀: 기존 SMS·수동 발송·`send_messages` stub 경로 무영향.
- [ ] 커밋 `test: alimtalk context wiring coverage`.

---

## Self-Review
- **Spec coverage:** 스펙 5 대상(7템플릿)의 변수 사전 → context별 variables 매핑 1:1. 버튼/토큰은 Phase 2로 분리(명시).
- **의존성:** T1(변수 메커니즘)이 T3~T7의 전제. **Phase 2의 per-recipient 버튼도 T1 위에 얹힌다**(recipient.variables에 `상세토큰` 추가 → 버튼 URL 렌더). Phase 2 착수 전 최소 T1 완료 필요.
- **미결(구현 중 결정):** 독촉 다월/연체료 정책(T4), 정산구분 파생 방식(T5), 전체공지 수신자 쿼리 형태(T7). 각 태스크에 기본안 명시.
- **게이팅:** 실 발송은 Phase 4 승인코드까지 대기. 본 Phase는 렌더/모드/템플릿까지 완성·테스트 가능(provider 접수만 게이팅).

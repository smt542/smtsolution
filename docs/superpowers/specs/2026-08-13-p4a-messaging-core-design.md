# 관리비서 — P4a 문자·알림톡 공용 모듈 코어(`/messaging`) 설계 (spec)

- **작성일:** 2026-08-13
- **스택:** Next.js 16(App Router) + Supabase(PostgreSQL·Auth) + React Query + zod + TailwindCSS
- **기준 정본:** `docs/superpowers/specs/2026-08-10-prd-synthesis.md` §D, `docs/prototype/prd/messaging.md`
- **로드맵:** `docs/superpowers/plans/2026-08-10-roadmap.md` **P4**(문자·알림톡 공용 모듈)의 **코어 슬라이스(P4a)**.
- **선행:** P0(profiles·audit·헬퍼), P1a(buildings.owner_*), P2a(accounts·`messaging` module key·`current_user_has_module`), P2b(`quick_messages`), P3b(occupancies phone/phone2/phone3·`list_tenants`).
- **브랜치:** `PracLee/anchovy`(origin/master=p3b 기준). **실행: Claude 오케스트레이터 + codex 헤드리스 워커**(codex=파일작성+vitest/tsc, git 커밋·리뷰=Claude).

---

## 0. 배경 & 위치
로드맵 P4 = 고지서·독촉·정산·민원·공지 발송을 **단일 엔진**으로 통합하고 P5~P7이 컨텍스트 프리셋으로 호출. 핵심 산출물 = **컨텍스트 프리셋 인터페이스 확정**. P4a는 그 기반(SMS 즉시발송·stub·`/messaging`·프리셋 계약·호출부 1곳)만 세운다. 알림톡·예약·실 NCP는 후속 하위 슬라이스.

## 1. 목표 & 범위
**In scope**
- SMS **즉시 발송** 공용 엔진. 발송은 **stub**(실 NCP 미호출, `message_logs`에 `result='stub'` 기록).
- **`/messaging` 독립 화면**: 수신처 선택(건물→세대·건물주·직원) + 본문(자유입력 + `quick_messages` 삽입) + 발송(확인팝업·결과) + **발송 이력**.
- **컨텍스트 프리셋 인터페이스**: `lib/messaging/preset.ts` 공유 타입 + `MessagingComposer`(공용) + `MessagingModal`(프리셋 래핑).
- **호출부 실배선 1곳**: `/overdue` 독촉 → `MessagingModal`(proof).
- DB `message_logs`(마이그) + `send_messages`/`list_message_logs` RPC + `messaging` RLS. `quick_messages`(0003) 재사용.
- GNB 항목(`components/shell/navItems.ts`).

**Out of scope(후속)**
- 알림톡 채널·`message_templates`·NCP 템플릿 ID·공지 딥링크 → **P4b**.
- 예약 발송·`scheduled_messages`·스케줄러 → **P4c**.
- 실 NCP 연동(SENS 키·HMAC·`/api/messaging/send`) → **P4d**.
- 미납·자동이체·그룹 수신처 필터, 나머지 5개 호출부(bill·receipts×2·moving·notices), 치환변수, 실패 재발송 UI.

## 2. 확정된 결정
| # | 결정 | 값 |
|---|---|---|
| 1 | 슬라이스 | **P4a 코어**(SMS 즉시·stub) — 사용자 확정 |
| 2 | 수신처 소스 | **건물→세대·건물주·직원**(미납/자동이체/그룹 후속) — 사용자 확정 |
| 3 | 프리셋 수신처 | **해결된 수신처 리스트** `MessageRecipient[]`(호출 화면이 who 확정) — 사용자 확정 |
| 4 | 자주보내는문자 | **포함**(기존 `quick_messages` 재사용) — 사용자 확정 |
| A | 발송 방식 | **RPC stub**(`result='stub'`), 실 NCP는 P4d 드롭인 교체 |
| B | 이력 저장 | `message_logs` **배치 1행 + `recipients` jsonb**(per-수신처 결과 포함) |
| C | 권한 | 화면·RPC 모두 `messaging`. 현장직원 독립진입 차단은 P4a에선 화면 게이트로 단순화 |
| D | 마이그 번호 | 원격 0009까지 적용된 상태를 기준으로 `0010` 사용(P5와 동일 정책) |

## 3. DB 스키마 — `supabase/migrations/0010_p4_messaging.sql`
```sql
create table message_logs (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('sms')),        -- P4b: 'alimtalk' 추가
  body text not null,
  context text not null default 'manual',                   -- 프리셋 컨텍스트('독촉' 등)
  recipient_count int not null default 0,
  recipients jsonb not null default '[]'::jsonb,            -- [{name,phone,unitNo,kind,result}]
  result text not null check (result in ('stub','sent','failed')) default 'stub',
  sent_by uuid references profiles(user_id) on delete set null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on message_logs (org_id, sent_at desc);
```
RLS: `ml_select`은 호출자 org와 `messaging` 모듈을 함께 검사하고, 직접 쓰기 policy는 두지 않는다(INSERT는 definer RPC만). `quick_messages`는 기존.

RPC(definer, `messaging` 게이팅, anon revoke):
- `send_messages(p_channel text, p_body text, p_context text, p_recipients jsonb) → jsonb {log_id, count}` — org·모듈 검증 후 `message_logs` 1행 insert(각 recipient에 `result:'stub'` 부여), 반환. (실발송 없음.)
- `list_message_logs(p_limit int default 50) → setof message_logs`(org, sent_at desc). PostgREST 직접 select로 대체 가능하면 RPC 생략 가능(구현 재량).

검증: `supabase/verify/p4_checks.sql`(message_logs 존재·ml_select·write policy 부재·send_messages 존재·messaging 게이팅).

## 4. 프리셋 인터페이스 (핵심 계약) — `lib/messaging/preset.ts`
```ts
export type MessageChannel = "sms";                 // P4b: | "alimtalk"
export interface MessageRecipient {
  name: string | null; phone: string | null; unitNo?: string | null;
  kind: "tenant" | "owner" | "staff" | "vendor" | "etc";
  ref?: { occupancyId?: number; buildingId?: number; userId?: string };
}
export interface MessagingPreset {
  context: string;                    // '독촉' | '고지서' | ... | 'manual'
  channel?: MessageChannel;           // default 'sms'
  body?: string;                      // 편집 가능한 프리셋 본문
  recipients?: MessageRecipient[];    // 컨텍스트 진입 시 해결된 수신처
}
```
순수 헬퍼(단위테스트): 수신처 dedup(phone 기준)·유효 수신처 카운트(phone 있는 것)·발송 payload 빌더.

## 5. 데이터 계층 — `hooks/reactquery/messaging/{apis,keys,queries,mutations,index}`
- `sendMessages({channel, body, context, recipients})` → RPC `send_messages`(camel→snake), 성공 시 이력 쿼리 무효화.
- `listMessageLogs(limit?)` → 이력.
- 수신처 해석은 **기존 훅 재사용**: `useBuildings`(건물·owner), `list_tenants`(세대 phone), `listAccounts`(직원), quick_messages 읽기(기존 훅 있으면 재사용, 없으면 `hooks/reactquery/quickMessages` 읽기 fn 추가).

## 6. 페이지 & 컴포넌트
- **`app/(staff)/staff/messaging/page.tsx`**: `"use client"`, 게이트 `hasModule(me,'messaging')`. 상단 `MessagingComposer`(빈 프리셋=독립 진입) + 하단 `MessageLogList`(이력). 상태(초기/발송완료/에러).
- **`components/MessagingComposer.tsx`**(공용): ① 채널(SMS 고정) ② 수신처 선택(건물 Select→세대 목록 체크 + 건물주 토글 + 직원 목록 체크, 실시간 "N명" 카운트, 주/부번호는 후속) ③ 본문(textarea + quick_messages 드롭다운 삽입) ④ [발송] → 확인팝업("N명에게 발송?") → `sendMessages` → 결과 토스트("발송(stub) 완료 N명"). preset prop으로 초기값 주입.
- **`components/MessagingModal.tsx`**: `Modal`(open 전달) + `MessagingComposer preset`.
- **`components/MessageLogList.tsx`**: 발송자·일시·수신처수·채널·본문요약·결과.
> 컴포넌트 위치: `/messaging` 전용은 `app/(staff)/staff/messaging/components/`, 공용 Composer/Modal도 우선 여기 두고 타 화면은 import(공용화). Tailwind 토큰은 기존 실존 토큰만 사용(없으면 대체).

## 7. 호출부 배선 (proof) — `/overdue`
`overdue/page.tsx`의 `openMessagingPreview`가 만든 수신처(`{occupancyId,unitNo,tenantName,phone}`)를 `MessageRecipient[]`(`kind:'tenant'`, `ref.occupancyId`)로 매핑 → `MessagingModal preset={{context:'독촉', channel:'sms', body:독촉 기본문구, recipients}}`로 진입. 기존 `MessagingPreviewModal`·`usePrepareOverdueMessage`(스텁)는 제거/대체.

## 8. 테스트 전략
- **단위(Vitest)**: `lib/messaging/preset`(dedup·카운트·payload 빌더), `hooks/reactquery/messaging/apis` 매퍼(send/list snake↔camel).
- **컴포넌트(RTL)**: `MessagingComposer`(수신처 선택·카운트·본문·quick 삽입·발송 payload·확인), `/messaging` page(게이트·이력), `MessagingModal`(preset 주입·open=false 미렌더), overdue 재배선(프리셋 전달).
- **RLS·RPC(SQL, `p4_checks.sql`)**: `messaging` 미보유 구성원 message_logs SELECT 가능·쓰기(RPC) 거부; `send_messages` org 검증·이력 기록·타 org 거부.
- **정적**: `npx vitest run`, `tsc --noEmit`, `npm run lint`. (codex 워커가 vitest/tsc 실행, Claude가 커밋 전 확인.)

## 9. 마이그레이션 / 환경
- `0010_p4_messaging.sql` + `supabase/verify/p4_checks.sql`. 신규 env 없음(실 NCP 키는 P4d). 원격 0009 다음 번호로 적용.

## 10. plan 단계화 (단일 plan, codex 실행)
1. **그룹1 — DB·계약·데이터층**: `0007`(message_logs·RLS·send_messages·list) + `p4_checks.sql` + `lib/messaging/preset.ts`(+테스트) + `hooks/reactquery/messaging/*`(+apis 테스트).
2. **그룹2 — 공용 컴포넌트·화면**: `MessagingComposer`+`MessagingModal`+`MessageLogList` + `/messaging/page.tsx` + GNB navItems(+테스트).
3. **그룹3 — 호출부 배선**: `/overdue` 독촉 재배선(MessagingModal) + 전체 회귀.

## 11. 열린 항목 / 향후
- 알림톡·템플릿·공지 딥링크(P4b) / 예약·스케줄러(P4c) / 실 NCP·HMAC·재발송(P4d).
- 수신처 확장: 미납(P6 수납 후)·자동이체(unit_accounts)·그룹·주/부번호.
- 나머지 5개 호출부(bill·receipts·moving·notices)는 각 화면 슬라이스에서 프리셋 호출.

## 부록. PRD(messaging.md) → P4a 배치
| PRD | 배치 |
|---|---|
| 3 진입(독립/컨텍스트) | `/messaging` page + `MessagingModal(preset)` |
| 4.0 채널 | Composer 채널(SMS 고정, 알림톡 후속) |
| 4.1 수신처(세대·인물) | Composer 수신처(건물→세대·건물주·직원; 미납/자동이체/그룹 후속) |
| 4.2 내용(자유본문·자주보내는문자) | Composer 본문 + quick_messages(템플릿·딥링크·치환 후속) |
| 4.3 시점 | 즉시만(예약 P4c) |
| 4.4 발송·결과·이력 | 확인팝업·stub 발송·결과 토스트·`message_logs`(재발송 후속) |

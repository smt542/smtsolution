# Track E 즉시발송 실경로(SMS+알림톡) 구현 계획

> REQUIRED SUB-SKILL: executing-plans (인라인, Claude 직접 TDD). 상세 계약은 `docs/superpowers/specs/2026-08-21-track-e-realsend-design.md`.

**Goal:** 즉시발송을 stub→실경로(reserve→dispatch→settle)로. 미설정이면 stub 유지, 키만 꽂으면 실발송 ON. 알림톡 어댑터·템플릿 필드 포함.

## Global Constraints
- 마이그 번호 커밋 직전 origin max 재확인(현재 0092 → **0093**).
- reserve/settle/quote(0037)·send_messages/schedule_messages 시그니처 **무수정**(재사용만).
- recipient_key = `sha256hex(phone.replace(/\D/g,''))` (quote의 encode(digest(normalized,'sha256'),'hex')와 일치).
- 어댑터는 config-gate(env 없으면 실호출 금지·예외/skip). 파랑 앱 표준.
- 서버 전용 파일은 service_role 키를 클라 번들에 노출 금지(admin.ts만).

---

### Task 1: 마이그 0093 — 템플릿 필드
**Files:** Create `supabase/migrations/0093_message_template_fields.sql`
- [ ] alter message_templates + category/channel_type('sms' default)/alimtalk_template_code/buttons(jsonb '[]'). 템플릿 저장 RPC(있으면 `save_message_template`/upsert)에 4필드 반영(없으면 apis가 직접 upsert인지 확인 후 결정).
- [ ] 커밋 `feat(messaging): 0093 템플릿 유형·알림톡 버튼 필드`
- (SQL 단위테스트 없음 → 훅 테스트로 간접검증, 라이브 적용 후속)

### Task 2: 알림톡 어댑터 `lib/messaging/alimtalk.ts` (TDD)
**Interfaces:** `isAlimtalkConfigured():boolean`, `sendAlimtalkViaNcp({to,templateCode,content,buttons?}):Promise<{requestId?,statusCode,ok}>`
- [ ] RED `alimtalk.test.ts`: env 미설정→isAlimtalkConfigured false·send 예외; 설정 시 fetch 페이로드(plusFriendId/templateCode/messages) + 성공/실패 statusCode 매핑. (ncp.ts 패턴 모사, fetch/env stub)
- [ ] GREEN 구현(NCP SENS 알림톡 endpoint, HMAC 서명은 ncp.ts makeNcpSignature 재사용 가능하면 재사용).
- [ ] 커밋

### Task 3: 디스패치 `lib/messaging/dispatch.ts` (TDD)
**Interfaces:** `anyChannelConfigured(mode:SendMode):boolean`; `dispatchOne({channel,phone,body,templateCode?,buttons?}):Promise<{status:'success'|'failed',reason?,providerId?}>`
- [ ] RED `dispatch.test.ts`: sms→sendSmsViaNcp, alimtalk→sendAlimtalkViaNcp, 미설정 채널→{status:'failed',reason:'unconfigured'}, 어댑터 예외→failed. anyChannelConfigured(env 조합).
- [ ] GREEN 구현(어댑터 목킹).
- [ ] 커밋

### Task 4: 발송 라우트 `app/api/messaging/send/route.ts` (TDD)
**입력** `{mode,body,context,recipients,templateId}`. **의존** server(getUser·get_my_context)·admin(reserve/settle)·dispatch·quote(session).
- [ ] RED `route.test.ts`: (a)미인증 401 (b)미설정→send_messages(stub) 호출·reserve 미호출·billingMode 'stub' (c)설정+충분→quote→reserve→dispatchOne×N→settle 순서·성공결과 (d)INSUFFICIENT_POINTS→402류 코드반환·dispatch 미호출 (e)부분실패 결과매핑. (@/lib/supabase/server·admin, @/lib/messaging/dispatch 목킹)
- [ ] GREEN 구현: getUser→get_my_context(orgId·messaging 권한, 아니면 403)→분기(anyChannelConfigured)→[stub | quote→reserve→dispatch(recipient_key=sha256)→settle]→JSON.
- [ ] 커밋

### Task 5: messaging apis `sendMessages` → 라우트 fetch (TDD)
**Files:** `hooks/reactquery/messaging/apis.ts` (+test)
- [ ] RED apis.test.ts: scheduledAt 없으면 `fetch('/api/messaging/send',{method:'POST',body})` 호출·응답 매핑(billingMode·recipients status); 있으면 기존 schedule_messages. (fetch 목킹)
- [ ] GREEN: send_messages RPC 직접호출 제거, route fetch로 교체. SendMessagesResult에 per-recipient status/reason 확장.
- [ ] 커밋

### Task 6: 컴포저 결과 표기 (TDD/경량)
**Files:** `app/(staff)/staff/messaging/components/MessagingComposer.tsx` (+test 보강)
- [ ] 발송 결과 토스트/요약을 성공·실패·**미발송(미설정)** 카운트로. INSUFFICIENT_POINTS면 "포인트가 부족합니다" 차단.
- [ ] 커밋

### Task 7: 템플릿 필드 훅·모달 (TDD)
**Files:** `hooks/reactquery/messageTemplates*` (+test), 템플릿 모달 컴포넌트
- [ ] RED: 새 4필드 저장·로드 매핑, 모달 입력 렌더.
- [ ] GREEN 구현.
- [ ] 커밋

### Task 8: 검증 + PR + WBS
- [ ] tsc·vitest·lint·build, 마이그 0093 번호 재확인, PR(master), wbs-commit-sync(messaging·포인트·bill).

## Self-Review
- §2 포함범위(SMS 실경로·알림톡 어댑터·템플릿 필드) → T1~T7 커버. 예약worker·팩스 제외(§9) 준수.
- recipient_key 산식 T4에 명시. reserve/settle 무수정. 미설정→stub(D2) T4에 분기.

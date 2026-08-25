# 알림톡 Phase 2 — 공개 토큰 + per-recipient 버튼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans. 스텝은 `- [ ]` 체크박스.

**Goal:** 알림톡 `[상세보기]` 버튼이 **수신자별 무로그인 상세 링크**로 열리도록, (1) 공지·정산 공개 토큰 인프라 + staff 대량 발급 경로를 만들고 (2) 발송 파이프라인이 **수신자별 버튼 URL**을 전송하도록 확장한다.

**Architecture:** 고지서는 `bill_share_tokens`(마이그 0040)·`public_bill_by_token`·`/r/[token]`가 있으나 **입주자 본인(auth.uid)만 발급** 가능하다(codex 확인). 공지·정산은 토큰 인프라가 전무. 또 현재 파이프라인은 버튼을 **batch 공통**(`content.buttons`)으로만 보낸다 — Popbill SDK는 `msgs[].btns`로 **수신자별 버튼을 지원**(`node_modules/popbill/lib/KakaoService.js:357-368`)하나 앱이 미사용. 따라서 토큰(RPC/테이블/라우트) + 파이프라인 8파일 확장이 필요하다.

**Tech Stack:** Supabase(마이그·RLS·SECURITY DEFINER RPC), Next.js(resident route group 공개 라우트), Popbill `sendATS_multi`(`msgs[].btns`), `lib/messaging/render.ts`.

## Global Constraints
- **의존:** Phase 3 Task 1(per-recipient `MessageRecipient.variables`)이 선행되어야 한다 — 버튼 URL의 `#{상세토큰}`도 이 변수맵으로 렌더한다.
- 공개 read RPC는 **anon 권한 + 화이트리스트 필드 + 만료 마스킹**(`public_bill_by_token` 패턴 준수, `0040:267-360`). 직접 테이블 접근 금지(RLS).
- staff 발급 RPC는 org 소유 + 발행/확정 상태 + 권한(`messaging`/`bill_publish`) 검증.
- 버튼 URL base는 **서버 통제 설정값** `NEXT_PUBLIC_RESIDENT_WEB_ORIGIN` 하나로만(임의 클라이언트 입력 금지 — 카카오 승인 도메인 일치).
- 토큰/버튼 URL 변경은 **멱등 키를 회전**시켜야 한다(`sendSignature`에 버튼 반영).
- 마이그 번호는 커밋 직전 origin/master max 재확인(현재 최신 0098 → 0099).

---

## File Structure
- Create: `supabase/migrations/0099_share_tokens_staff_mint.sql` — staff 대량 bill-token 발급 RPC + `notice_share_tokens`/`settlement_share_tokens` 테이블·mint·public-read RPC.
- Create: `app/(resident)/r/notice/[token]/page.tsx`, `app/(resident)/r/settlement/[token]/page.tsx` — 공개 상세(bill `/r/[token]` 패턴 재사용).
- Create/Modify: `hooks/reactquery/residentBilling/*`(staff bill-token 발급), 신규 `hooks/reactquery/residentNotice/*`·`residentSettlement/*`(public-by-token).
- Modify(버튼 파이프라인 8): `lib/messaging/preset.ts`, `lib/messaging/sendSignature.ts`, `lib/messaging/submission.ts`, `lib/messaging/dispatch.ts`, `lib/popbill/types.ts`, `lib/popbill/messages.ts`, `lib/messaging/drainSchedules.ts`, `app/api/messaging/send/route.ts`.
- Modify: `.env.example` — `NEXT_PUBLIC_RESIDENT_WEB_ORIGIN`.
- Create: `supabase/migrations/0100_finalize_alimtalk_buttons.sql`(T6) — seed 템플릿 `buttons`에 WL 버튼 URL 주입.

---

## Task 1: 세입자 공개 origin 설정값

**Files:** Modify `.env.example`; Create `lib/messaging/residentOrigin.ts`; Test `lib/messaging/residentOrigin.test.ts`.
**Interfaces:** Produces `residentOrigin():string` — `process.env.NEXT_PUBLIC_RESIDENT_WEB_ORIGIN`(미설정 시 명시 에러). 버튼 URL 조립의 유일 base.

- [ ] Step 1~5: 미설정 시 throw / 설정 시 정규화(trailing slash 제거) 테스트 → 구현 → `.env.example`에 주석과 함께 추가 → 통과 → 커밋 `chore: resident web origin config for alimtalk buttons`.

## Task 2: staff 대량 bill-token 발급 RPC

**Files:** Create part of `0099_*.sql`; Modify `hooks/reactquery/residentBilling/apis.ts`+`mutations.ts`. Test: RPC 검증 쿼리 + 훅.
**근거(codex):** `resident_get_or_create_bill_token`은 `auth.uid()`/`resident_linked_unit()` 종속이라 staff가 임의 세대 링크를 못 만든다(`0040:217-265`).

**Interfaces:** Produces `staff_mint_bill_tokens(p_unit_ids bigint[], p_period date) returns table(unit_id bigint, token uuid)` — SECURITY DEFINER, org 소유+`billing_confirmations` 확정+`bill_publish` 검증, `bill_share_tokens`에 `(unit_id,period)` upsert(기존 토큰 재사용·만료 연장).

- [ ] Step 1: 실패 테스트 — 확정 세대 2건 mint 시 토큰 2개 반환, 미확정/타org는 제외/거절.
- [ ] Step 2: 실패 확인(함수 없음).
- [ ] Step 3: 구현 — `0040` 발급 로직 재사용하되 caller=staff(권한·org), 대상=`p_unit_ids`. `on conflict (unit_id,period) do update set expires_at=...`.

```sql
create or replace function public.staff_mint_bill_tokens(p_unit_ids bigint[], p_period date)
returns table(unit_id bigint, token uuid) language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org' using errcode='42501'; end if;
  if not current_user_has_module('bill_publish') then raise exception 'forbidden' using errcode='42501'; end if;
  return query
  with tgt as (
    select u.id as unit_id from unnest(p_unit_ids) as uid
    join units u on u.id = uid and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.org_id = v_org
    join billing_confirmations bc on bc.unit_id = u.id and bc.period = p_period and bc.confirmed_at is not null
  ),
  ins as (
    insert into bill_share_tokens (org_id, unit_id, period, created_by, expires_at)
    select v_org, tgt.unit_id, p_period, auth.uid(), now() + interval '1 year' from tgt
    on conflict (unit_id, period) do update set expires_at = excluded.expires_at
    returning bill_share_tokens.unit_id, bill_share_tokens.token
  )
  select ins.unit_id, ins.token from ins;
end $$;
revoke all on function public.staff_mint_bill_tokens(bigint[], date) from public, anon;
grant execute on function public.staff_mint_bill_tokens(bigint[], date) to authenticated;
```

- [ ] Step 4: 통과 확인(라이브 적용 후 PostgREST rpc 호출).
- [ ] Step 5: 커밋 `feat: staff bulk bill share-token mint`.

## Task 3: 공지 공개 토큰 (테이블+발급+공개읽기+라우트)

**Files:** `0099_*.sql`(추가); Create `app/(resident)/r/notice/[token]/page.tsx`; Create `hooks/reactquery/residentNotice/*`. Test: RPC(valid/expired/nonexistent/cross-org) + 라우트.

**Interfaces:**
- `notice_share_tokens(token uuid unique default gen_random_uuid(), org_id, notice_id, created_by, expires_at, created_at, unique(notice_id))` + RLS enable + revoke direct.
- `mint_notice_share_token(p_notice_id bigint) returns uuid` — staff(org·`messaging`), 발행된 공지만, upsert.
- `public_notice_by_token(p_token uuid) returns jsonb` — anon, 화이트리스트(제목·본문·유형·건물명·발행일), 만료 시 마스킹+`is_expired`.

- [ ] Step 1~5: RPC 테스트(4 케이스) → 테이블/RPC 구현(0040 패턴) → 훅+공개 페이지(`/r/[token]` bill 페이지 미러) → 통과 → 커밋 `feat: public notice share token + route`.

## Task 4: 정산 공개 토큰 (테이블+발급+공개읽기+라우트)

**Files:** `0099_*.sql`(추가); Create `app/(resident)/r/settlement/[token]/page.tsx`; Create `hooks/reactquery/residentSettlement/*`. Test: 동일 4 케이스.

**Interfaces:**
- `settlement_share_tokens(... settlement_id, unique(settlement_id))`.
- `mint_settlement_share_token(p_settlement_id bigint) returns uuid` — staff(org·권한), 완료된 정산만.
- `public_settlement_by_token(p_token uuid) returns jsonb` — anon, 화이트리스트(퇴실일·정산구분·정산금액·세대·건물명), 만료 마스킹.

- [ ] Step 1~5: T3과 동일 절차 → 커밋 `feat: public settlement share token + route`.

## Task 5: per-recipient 버튼 파이프라인 (8파일)

**Files:** Modify `lib/messaging/preset.ts`, `sendSignature.ts`, `submission.ts`, `dispatch.ts`, `lib/popbill/types.ts`, `lib/popbill/messages.ts`, `drainSchedules.ts`, `app/api/messaging/send/route.ts`. Test: `lib/popbill/messages.test.ts`, `lib/messaging/dispatch.test.ts`.
**근거(codex):** `msgs[].btns` 지원(`KakaoService.js:357-368`), 현재 미사용(`messages.ts:133-158`은 공통 buttons만).

**Interfaces:**
- `ResolvedRecipient.renderedButtons?: PopbillKakaoButton[]`(수신자별, `#{상세토큰}` 치환 완료).
- `MessageBatchInput.recipients[].buttons?: PopbillKakaoButton[]`(popbill/types.ts).
- `submitAlimtalk`: `msgs[i].btns = r.buttons`; 공통 인자는 정적 버튼일 때만.

- [ ] Step 1: 실패 테스트 — 2 수신자 batch에서 `sendATS_multi` 호출 인자의 `msgs[0].btns[0].u1 ≠ msgs[1].btns[0].u1`, 미치환 URL 없음.
- [ ] Step 2: 실패 확인(현재 공통 버튼만 전달).
- [ ] Step 3: 구현 —
  - `preset.ts`: `ResolvedRecipient.renderedButtons`.
  - `dispatch.ts:341-397`(`submitReservationBatches`): 템플릿 `alimtalk.buttons` 각 URL을 수신자 `variables`로 `renderTemplate` → `renderedButtons` 부착. (Phase 3 T1의 `recipient.variables['상세토큰']` 사용.)
  - `popbill/types.ts`: `MessageBatchInput` 수신자에 `buttons` 추가.
  - `popbill/messages.ts:133-158`: `msgs` 원소에 `btns: r.buttons`; 공통 인자는 `null` 또는 정적일 때만. `hasUnresolvedVariables`를 `u1/u2`에도 적용.
  - `sendSignature.ts`: canonical payload에 수신자 버튼(또는 토큰) 포함 → URL 바뀌면 멱등키 회전.
  - `submission.ts`: `PlanRecipient`에 buttons 보존.
  - `drainSchedules.ts`: 예약 경로도 동일 per-recipient 버튼 통과.
  - `app/api/messaging/send/route.ts`: (변경 최소 — 버튼은 템플릿+수신자 변수에서 파생되므로 대개 무변경, 인터페이스 정합만 확인.)
- [ ] Step 4: 통과 확인 — `npx vitest run lib/popbill/messages.test.ts lib/messaging/dispatch.test.ts`.
- [ ] Step 5: 커밋 `feat: per-recipient alimtalk button URLs`.

## Task 6: seed 템플릿 버튼 확정

**Files:** Create `supabase/migrations/0100_finalize_alimtalk_buttons.sql`. Test: 검증 쿼리.
**내용:** 0098 seed 템플릿의 `buttons`를 WL 버튼으로 update — 고지서/독촉=`{name:'고지서 상세보기',type:'WL',url:'<origin>/r/#{상세토큰}'}`, 공지=`{name:'공지 확인하기',...url:'<origin>/r/notice/#{상세토큰}'}`, 정산=`{name:'정산내역 보기',...url:'<origin>/r/settlement/#{상세토큰}'}`, 민원=버튼 없음. (`<origin>`은 런타임 `residentOrigin()`로 치환하도록 url을 `#{상세링크}` 단일 변수로 두는 방안도 가능 — 카카오 승인 도메인 고정 요건과 함께 결정.)

- [ ] Step 1~5: category/title 기준 org 전체 update → 검증 → 커밋 `feat: finalize alimtalk template buttons`.

> **주의:** 버튼은 **카카오 승인 템플릿에 등록된 버튼과 일치**해야 한다. 따라서 T6은 **Phase 4(승인)와 짝**으로 확정한다(승인 시 버튼 포함 등록 → 코드+버튼 동시 반영).

---

## Self-Review
- **Spec coverage:** 스펙 버튼(§0·각 템플릿) → T1~T6로 커버(고지서/독촉/공지/정산 버튼, 민원 무버튼). 공개 라우트 gap(§5.2) 해소(T3·T4).
- **의존성:** T5는 Phase 3 T1(per-recipient variables) 선행. T6은 Phase 4(승인)와 동반. T2~T4는 독립 실행 가능.
- **Placeholder scan:** 핵심 RPC(T2) SQL·파이프라인 파일목록(T5)·라우트 구체화. T3/T4는 T2/0040 패턴을 명시 참조(반복 회피, 동일 절차 명기 — placeholder 아님).
- **보안:** 공개 RPC anon+화이트리스트+만료마스킹, staff mint 권한·org·상태 검증, origin 서버통제 — 전 태스크 Global Constraints 준수.
- **게이팅:** 실 발송·버튼 노출은 Phase 4 승인코드까지 대기. T1~T5는 지금 빌드·테스트 가능(provider 접수만 게이팅).

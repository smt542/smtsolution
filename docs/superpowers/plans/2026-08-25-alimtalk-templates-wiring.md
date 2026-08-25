# 알림톡 템플릿 배선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사전 작성·승인된 7종 알림톡 템플릿을 실제 발송 파이프라인에 배선한다(템플릿 로우 프로비저닝 → context별 변수 렌더 → 공개 상세 버튼 → 승인코드 입력).

**Architecture:** 발송 파이프라인(`app/api/messaging/send` → `lib/messaging/dispatch.ts` → `lib/popbill/messages.ts`)은 **이미 완비**되어 있다. `loadAlimtalkTemplate(templateId)`가 `message_templates.alimtalk_template_code`+`buttons`(→`toPopbillButtons`)를 읽어 `sendATS_multi`로 접수하고, 수신자별 `renderedBody`(치환 완료 본문)로 발송한다. 따라서 남은 일은 **데이터·컨텐츠·context 호출부**뿐이다.

**Tech Stack:** Next.js(route groups), Supabase Postgres(마이그레이션·RLS·RPC), Popbill SDK(`sendATS_multi`), `lib/messaging/render.ts`(`#{키}` 치환).

## Global Constraints
- 알림톡 본문은 **카카오 승인 템플릿과 정확히 일치**해야 한다(변수 위치 포함). 본문 확정 정본 = `docs/superpowers/specs/2026-08-25-alimtalk-templates-design.md`.
- `message_templates`는 **org별**(unique `(org_id, title)`), 저장은 직접 insert/update(RLS: `my_org_ids()` + `current_user_has_module('messaging')`). RPC 아님.
- 변수 형식 `#{키}`. 렌더 후 미치환 `#{}`가 남으면 `submitAlimtalk`이 접수 거절(`UNRESOLVED_VARIABLES`).
- 마이그 번호는 **커밋 직전 origin/master max 재확인**(migration-number-collision 규칙). 본 계획 작성 시점 최신=0097 → 다음 0098.
- 실제 발송은 **카카오 채널 승인 + `alimtalk_template_code` + Popbill 키**에 게이팅된다. Phase 1은 이 게이팅과 무관하게 지금 빌드·테스트 가능. Phase 2~4는 승인/키 진행에 맞춰 실행.

---

## 범위 판단(Scope Check) — 4개 하위 계획으로 분해

이 배선은 성격이 다른 4개 하위 시스템을 포함한다. writing-plans의 scope-check에 따라 **Phase 1만 본 계획에서 구체화**하고, Phase 2~4는 각자 별도 계획으로 작성한다(각 context 현행 코드 정독이 선행 필요하며, 그 탐색은 codex 워커 위임 대상 — 현재 codex 사용량 한도(~8/31)로 일시 불가).

- **Phase 1 (본 계획·지금 실행 가능):** 7종 템플릿 로우를 org별로 프로비저닝(내용·유형·카테고리; 버튼=[]·코드=null).
- **Phase 2 (별도 계획):** 공지·정산 공개 상세 라우트 + **per-recipient 버튼 URL 토큰** 메커니즘.
- **Phase 3 (별도 계획):** context별 변수 렌더 배선(고지서·독촉·정산·민원·공지 5곳).
- **Phase 4 (별도 계획·승인 후):** 카카오 승인 `alimtalk_template_code` 입력 + 버튼 확정(관리 UI 또는 설정).

---

## Phase 1 — 기본 알림톡 템플릿 org별 프로비저닝

**File Structure**
- Create: `supabase/migrations/0098_alimtalk_default_templates.sql` — 프로비저닝 함수 + 기존 org 백필 + 신규 org 트리거.
- Test: `supabase/verify/alimtalk_templates_checks.sql` — org별 7행 검증 쿼리.

### Task 1: 기본 템플릿 프로비저닝 마이그레이션

**Interfaces**
- Produces: `public.provision_default_alimtalk_templates(p_org_id bigint) returns integer` — org에 없는 기본 알림톡 템플릿을 삽입하고 삽입된 행 수를 반환(멱등: `on conflict (org_id, title) do nothing`).
- Produces: `organizations` AFTER INSERT 트리거 → 신규 org 자동 프로비저닝.

- [ ] **Step 1: 마이그레이션 작성** — `supabase/migrations/0098_alimtalk_default_templates.sql`

```sql
-- 0098: 기본 알림톡 템플릿 org별 프로비저닝 (정본: docs/.../2026-08-25-alimtalk-templates-design.md)
-- 의존: 0030(message_templates), 0093(category/channel_type/alimtalk_template_code/buttons)
-- 버튼·승인코드는 Phase 2/4에서 확정(여기서는 buttons='[]', alimtalk_template_code=null).
create or replace function public.provision_default_alimtalk_templates(p_org_id bigint)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count int := 0;
begin
  insert into message_templates (org_id, title, body, category, channel_type, buttons, sort_order)
  values
    (p_org_id, '관리비 고지서',
     E'[#{건물명}] #{청구월} 관리비 고지서\n\n#{세대} 세대의 #{청구월} 관리비가 발행되었습니다.\n\n▶ 청구금액: #{청구금액}원\n▶ 납부기한: #{납기일}\n▶ 납부계좌: #{납부계좌}\n\n자세한 내역은 아래 [고지서 상세보기]에서 확인하실 수 있습니다.\n문의: #{관리사무소연락처}',
     'bill', 'alimtalk', '[]'::jsonb, 100),
    (p_org_id, '관리비 미납 안내',
     E'[#{건물명}] 관리비 미납 안내\n\n#{세대} 세대의 관리비가 미납되어 안내드립니다.\n\n▶ 미납금액: #{미납금액}원\n▶ 대상월: #{미납월}\n▶ 납부기한: #{납기일}\n\n기한 내 납부 부탁드립니다. 이미 납부하셨다면 본 안내는 무시해 주세요.\n문의: #{관리사무소연락처}',
     'overdue', 'alimtalk', '[]'::jsonb, 110),
    (p_org_id, '이사정산 내역서',
     E'[#{건물명}] 이사정산 내역 안내\n\n#{세대} 세대의 퇴실 정산 내역이 확정되었습니다.\n\n▶ 퇴실일: #{퇴실일}\n▶ 정산구분: #{정산구분}\n▶ 정산금액: #{정산금액}원\n\n상세 내역은 아래 [정산내역 보기]에서 확인하실 수 있습니다.\n문의: #{관리사무소연락처}',
     'settlement', 'alimtalk', '[]'::jsonb, 120),
    (p_org_id, '민원·AS 처리 안내',
     E'[#{건물명}] 민원·AS 처리 안내\n\n#{세대} 세대에서 접수하신 건의 처리 상태를 안내드립니다.\n\n▶ 접수내용: #{접수내용}\n▶ 처리상태: #{처리상태}\n▶ 담당자: #{담당자}\n\n문의: #{관리사무소연락처}',
     'complaint', 'alimtalk', '[]'::jsonb, 130),
    (p_org_id, '공지 안내(신규)',
     E'[#{건물명}] 새 공지사항 안내\n\n#{건물명}에 새로운 공지사항이 등록되었습니다.\n\n▶ 제목: #{공지제목}\n\n자세한 내용은 아래 [공지 확인하기]에서 확인해 주세요.\n문의: #{관리사무소연락처}',
     'notice', 'alimtalk', '[]'::jsonb, 140),
    (p_org_id, '공지 안내(중요)',
     E'[#{건물명}] 중요 공지사항 안내\n\n#{건물명}에 중요 공지사항이 등록되었습니다. 확인 부탁드립니다.\n\n▶ 제목: #{공지제목}\n\n자세한 내용은 아래 [공지 확인하기]에서 확인해 주세요.\n문의: #{관리사무소연락처}',
     'notice', 'alimtalk', '[]'::jsonb, 150),
    (p_org_id, '공지 안내(긴급)',
     E'[#{건물명}] 긴급 공지사항 안내\n\n#{건물명}에 긴급 공지사항이 등록되었습니다. 즉시 확인해 주세요.\n\n▶ 제목: #{공지제목}\n\n자세한 내용은 아래 [공지 확인하기]에서 확인해 주세요.\n문의: #{관리사무소연락처}',
     'notice', 'alimtalk', '[]'::jsonb, 160)
  on conflict (org_id, title) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.provision_default_alimtalk_templates(bigint) from public, anon, authenticated;

-- 기존 org 백필
do $$ declare r record; begin
  for r in select id from organizations where deleted_at is null loop
    perform public.provision_default_alimtalk_templates(r.id);
  end loop;
end $$;

-- 신규 org 자동 프로비저닝
create or replace function public.trg_provision_alimtalk_templates()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.provision_default_alimtalk_templates(new.id);
  return new;
end $$;
drop trigger if exists trg_org_provision_alimtalk on organizations;
create trigger trg_org_provision_alimtalk
  after insert on organizations for each row
  execute function public.trg_provision_alimtalk_templates();
```

- [ ] **Step 2: 로컬 검증 쿼리 작성** — `supabase/verify/alimtalk_templates_checks.sql`

```sql
-- 각 org에 알림톡 기본 템플릿 7종이 존재하는지
select o.id as org_id,
       count(*) filter (where t.channel_type = 'alimtalk') as alimtalk_templates
from organizations o
left join message_templates t on t.org_id = o.id and t.deleted_at is null
where o.deleted_at is null
group by o.id
having count(*) filter (where t.channel_type = 'alimtalk') <> 7;
-- 기대: 0행(모든 org가 정확히 7종 보유)
```

- [ ] **Step 3: 라이브 적용** — Management API query 엔드포인트(`.env.local`의 `SUPABASE_ACCESS_TOKEN`, ref `amhtprmapxlizdnsgbeg`)로 0098 적용. (psql·MCP 불가 환경 — Popbill 마이그와 동일 경로.)

Run: 0098 파일 내용을 `POST /v1/projects/<ref>/database/query`로 전송(멀티스테이트먼트=단일 트랜잭션). 이어서 `supabase_migrations.schema_migrations`에 `('0098','alimtalk_default_templates')` 백필.

- [ ] **Step 4: 검증** — 검증 쿼리 실행

Run: `alimtalk_templates_checks.sql`를 query 엔드포인트로 실행.
Expected: 0행 반환(전 org 7종 보유). 신규 org 1건 생성 후 재조회 시에도 7종.

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0098_alimtalk_default_templates.sql supabase/verify/alimtalk_templates_checks.sql
git commit -m "feat: provision default alimtalk templates per org"
```

---

## Phase 2 (별도 계획) — 공개 상세 라우트 + per-recipient 버튼 URL

**왜 분해:** `/r/[token]`는 **고지서 전용**(`app/(resident)/r/[token]/page.tsx` = `usePublicBillByToken`). 공지·정산은 공개 라우트가 없다. 또한 현재 파이프라인은 버튼을 **배치 단위**(`loadAlimtalkTemplate` 1회)로만 전달해 **수신자별 토큰 URL 치환이 불가**하다 — Popbill 가변 버튼(카카오 변수 버튼) 지원 방식 확인이 선행되어야 함.

**작성 전 정독(리서치, codex 위임):**
- `/r/[token]` 공개 토큰 **발급·저장 위치**(테이블·컬럼; `usePublicBillByToken`/`hooks/reactquery/residentBilling*` → RPC).
- Popbill `sendATS_multi` 버튼의 변수 URL 처리(수신자별 `#{토큰}` 치환 가능 여부) — 불가하면 버튼을 수신자별로 넘기도록 `dispatch.ts`/`messages.ts` 확장 필요.
- 세입자 웹 **도메인**(버튼 base origin) 확정 → `NEXT_PUBLIC_RESIDENT_WEB_ORIGIN` env 신설 권장.

**산출:** 공지·정산 공개 라우트(`/r`-패턴 재사용), 토큰 발급, 템플릿 `buttons`에 `[{name,type:'WL',url:'<origin>/r/#{상세토큰}'}]` 확정.

## Phase 3 (별도 계획) — context별 변수 렌더 배선

**왜 분해:** 각 발송 진입점(고지서 `/bill`·독촉 `/overdue`·정산·민원 `/receipts`·공지)이 알림톡 모드로 **templateId + 수신자별 `renderedBody`(변수 치환)**를 넘기도록 개별 배선해야 하며, 각 현행 발송 호출부 정독이 선행된다.

**계약(모든 context 공통):** 각 context는 `dispatchMessages`(또는 `/api/messaging/send`)를 다음으로 호출한다 — `mode: 'auto'|'alimtalk'`, `templateId: <해당 org의 기본 템플릿 id>`, `recipients[].renderedBody = renderTemplate(template.body, 수신자별 변수)`. 변수 사전은 스펙 §2 참조. 렌더 후 미치환 `#{}`가 없어야 접수됨.

**작성 전 정독(codex 위임):** (a) `/bill` 카톡 고지서 발송 호출부, (b) `/overdue` 독촉, (c) 정산, (d) `/receipts` 민원, (e) 공지 발송 — 각 파일·함수·현재 payload.

## Phase 4 (별도 계획·카카오 승인 후) — 승인코드 입력 + 버튼 확정

**산출:** 승인된 `alimtalk_template_code`를 각 org의 해당 템플릿 행에 입력하는 경로(관리 UI 또는 플랫폼 설정→일괄 update). 코드가 org별 동일(단일 채널)이면 `category`/`title` 기준 일괄 update 마이그로 처리 가능. 버튼도 이때 최종 확정(Phase 2 결과 반영).

---

## Self-Review (Phase 1)
- **Spec coverage:** 스펙 7종 문안 → Task 1 seed 7행(제목·본문·카테고리) 1:1 매핑. 버튼·코드는 의도적으로 Phase 2/4로 분리(스펙 §5 미결과 일치).
- **Placeholder scan:** Phase 1 태스크는 실제 SQL·검증쿼리·커맨드 포함(placeholder 없음). Phase 2~4는 "별도 계획"으로 명시적 분해(미완 태스크 아님).
- **Type/이름 일관성:** 함수명 `provision_default_alimtalk_templates`·트리거 `trg_org_provision_alimtalk` 전 구간 일치. 컬럼명 0030/0093과 일치(title·body·category·channel_type·buttons·sort_order).
- **게이팅 명시:** Phase 1은 승인/키와 무관하게 실행 가능. 실발송은 Phase 4(승인코드)까지 완료돼야 동작.

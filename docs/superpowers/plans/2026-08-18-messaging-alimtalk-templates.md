# 문자·알림톡 확장 (1) — 알림톡 채널·템플릿·탭 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **프로젝트 규칙(CLAUDE.md)**: 구현은 Codex 워커에 위임 가능하나, 커밋 전 Claude가 리뷰. 커밋·npm·git은 Claude(오케스트레이터)가 수행.

**Goal:** `/staff/messaging`를 발송/템플릿/내역 3탭으로 재구성하고, 알림톡 채널(자동 라우팅·SMS 폴백)과 변수치환 템플릿 CRUD를 추가한다(발송은 stub 유지).

**Architecture:** 변수치환은 순수 TS(`lib/messaging/render.ts`)에서 수행해 미리보기·발송 본문을 만든다. 발송 시 `send_messages` RPC가 수신처의 `occupancies.alimtalk_opt_in`을 서버에서 재판정해 채널을 확정한다(스푸핑 방지). 템플릿은 `message_templates` 신설 테이블에 RLS 기반 CRUD. 기존 `MessagingComposer`/`MessagingModal`의 외부 계약은 하위호환으로 보존해 `overdue`·`bill` 임베드를 건드리지 않는다.

**Tech Stack:** Next.js(app router) · React · @tanstack/react-query · Supabase(RLS+SECURITY DEFINER RPC) · vitest + @testing-library/react · Tailwind(공용컴포넌트 `@/components/common`).

## Global Constraints

- **마이그 번호 = `0030`** (여유 버퍼; WT1=0024·WT2=0025 예정과 충돌 회피). 파일: `supabase/migrations/0030_p4b_messaging_templates.sql`, idempotent(`if not exists`/`drop ... if exists`).
- **격리 규칙**: `components/shell/navItems.ts`·`AppShell`·`list_tenants`·`bill/**`·`overdue/**`는 **수정 금지**(WT1/WT2·타 도메인). 변경은 messaging 도메인(+`lib/messaging`·`hooks/reactquery/messaging`·`hooks/reactquery/messageTemplates`)에 한정.
- **하위호환**: `MessagingComposer` 기본 `initialMode="sms"`, `MessagingModal`은 기존 props 유지. preset 신규 필드는 optional(additive).
- **발송은 stub**: `message_logs.result='stub'`. 실제 provider 연동 없음.
- **변수 문법**: `#{키}`. 지원 키 = `이름`·`호실`·`건물명`. 미정의 키는 리터럴 유지.
- **모듈 권한**: 모든 RPC/RLS는 `current_user_has_module('messaging')` + org 격리(`current_user_org()`/`my_org_ids()`).
- 언어: UI 카피·주석 한국어. 커밋 메시지 `feat(messaging): ...` / `test(messaging): ...`.
- 검증 게이트: 각 태스크 종료 시 관련 vitest 통과. 최종 태스크에서 `npx tsc --noEmit` / `npx vitest run` / `npx eslint .` / `npm run build` 통과.

---

## File Structure

**신규**
- `lib/messaging/render.ts` — 변수 추출·치환(순수 TS). `+ render.test.ts`
- `hooks/reactquery/messageTemplates/{apis.ts,keys.ts,queries.ts,mutations.ts,index.ts}` — 템플릿 CRUD. `+ apis.test.ts`
- `app/(staff)/staff/messaging/components/TemplateFormModal.tsx` — 템플릿 생성/수정 모달. `+ .test.tsx`
- `app/(staff)/staff/messaging/components/TemplatesTab.tsx` — 템플릿 목록·삭제. `+ .test.tsx`
- `app/(staff)/staff/messaging/components/HistoryTab.tsx` — 내역(필터+MessageLogList). `+ .test.tsx`
- `supabase/migrations/0030_p4b_messaging_templates.sql`

**수정 (messaging 도메인 한정)**
- `lib/messaging/preset.ts` — `MessageChannel += 'alimtalk'`, `SendMode`, resolved 필드. `+ preset.test.ts` 갱신
- `hooks/reactquery/messaging/apis.ts` — `sendMessages` 시그니처(mode·templateId·resolved recipients), `listTenantAlimtalkConsent` 추가. `+ apis.test.ts` 갱신
- `hooks/reactquery/messaging/{keys.ts,queries.ts}` — consent 쿼리 키·훅
- `app/(staff)/staff/messaging/components/MessagingComposer.tsx` — 채널 모드·템플릿 선택·예상채널 뱃지·미리보기. `+ .test.tsx` 갱신
- `app/(staff)/staff/messaging/components/MessagingModal.tsx` — `initialMode="sms"` 고정(하위호환)
- `app/(staff)/staff/messaging/components/MessageLogList.tsx` — 수신처별 채널 표시(내역 상세용, 하위호환)
- `app/(staff)/staff/messaging/page.tsx` — 3탭 셸(`?tab=`). `+ page.test.tsx` 갱신

**수정 금지 확인**: `bill/page.tsx`(MessagingModal 임베드)·`overdue/page.tsx`(동일)는 하위호환 유지로 **무수정**. 각 태스크 후 해당 테스트만 회귀 확인.

---

## Task 1: 변수 치환 라이브러리 `lib/messaging/render.ts`

**Files:**
- Create: `lib/messaging/render.ts`
- Test: `lib/messaging/render.test.ts`

**Interfaces:**
- Produces: `extractVariables(body: string): string[]` · `renderTemplate(body: string, vars: Record<string,string>): string`

- [ ] **Step 1: Write the failing test** — `lib/messaging/render.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { extractVariables, renderTemplate } from "./render";

describe("messaging render", () => {
  it("extractVariables: 중복 제거·공백 트림", () => {
    expect(extractVariables("#{이름}님 #{호실} #{이름}")).toEqual(["이름", "호실"]);
    expect(extractVariables("변수 없음")).toEqual([]);
  });
  it("renderTemplate: 알려진 변수 치환", () => {
    expect(renderTemplate("#{이름}님 #{호실}호", { 이름: "홍길동", 호실: "101" }))
      .toBe("홍길동님 101호");
  });
  it("renderTemplate: 미정의 변수는 리터럴 유지", () => {
    expect(renderTemplate("#{이름}/#{금액}", { 이름: "홍길동" })).toBe("홍길동/#{금액}");
  });
  it("renderTemplate: 빈 vars·빈 본문", () => {
    expect(renderTemplate("고정문구", {})).toBe("고정문구");
    expect(renderTemplate("", { 이름: "x" })).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/messaging/render.test.ts`
Expected: FAIL (`Cannot find module './render'`).

- [ ] **Step 3: Write minimal implementation** — `lib/messaging/render.ts`

```ts
const VARIABLE_RE = /#\{([^}]+)\}/g;

/** 본문에서 #{키} 변수명을 중복 제거하여 수집한다. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(VARIABLE_RE)) {
    found.add(match[1].trim());
  }
  return [...found];
}

/** 알려진 변수를 치환한다. 미정의 변수는 원문(#{키})을 유지한다. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(VARIABLE_RE, (whole, keyRaw) => {
    const key = String(keyRaw).trim();
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/messaging/render.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/messaging/render.ts lib/messaging/render.test.ts
git commit -m "feat(messaging): 템플릿 변수치환 라이브러리(render)"
```

---

## Task 2: 채널 타입 확장 `lib/messaging/preset.ts`

**Files:**
- Modify: `lib/messaging/preset.ts`
- Test: `lib/messaging/preset.test.ts` (기존 갱신)

**Interfaces:**
- Consumes: 기존 `MessageRecipient`, `dedupeRecipients`, `validRecipients`, `buildSendPayload`.
- Produces: `type MessageChannel = "sms" | "alimtalk"` · `type SendMode = "auto" | "sms" | "alimtalk"` · `interface ResolvedRecipient extends MessageRecipient { channel: MessageChannel; renderedBody: string }` · `MessagingPreset.mode?: SendMode`.

- [ ] **Step 1: Write the failing test** — `lib/messaging/preset.test.ts` 하단에 추가

```ts
import { describe, it, expect } from "vitest";
import { buildSendPayload, type SendMode } from "./preset";

describe("preset SendMode/채널 확장", () => {
  it("SendMode 타입이 auto/sms/alimtalk 허용", () => {
    const modes: SendMode[] = ["auto", "sms", "alimtalk"];
    expect(modes).toHaveLength(3);
  });
  it("buildSendPayload: 유효 수신처만·중복 제거는 유지", () => {
    const out = buildSendPayload({
      channel: "sms",
      body: "본문",
      context: "manual",
      recipients: [
        { name: "A", phone: "010-1", kind: "tenant" },
        { name: "A2", phone: "0101", kind: "tenant" },
        { name: "B", phone: null, kind: "owner" },
      ],
    });
    expect(out.recipients).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/messaging/preset.test.ts`
Expected: FAIL (`SendMode` export 없음 → 타입/컴파일 에러).

- [ ] **Step 3: Write minimal implementation** — `lib/messaging/preset.ts` 상단 타입 교체·추가

```ts
export type MessageChannel = "sms" | "alimtalk";
export type SendMode = "auto" | "sms" | "alimtalk";
```

`MessagingPreset`에 optional 필드 추가:

```ts
export interface MessagingPreset {
  context: string;
  channel?: MessageChannel;
  mode?: SendMode;
  templateId?: number | null;
  body?: string;
  recipients?: MessageRecipient[];
}
```

파일 하단에 resolved 타입 추가:

```ts
export interface ResolvedRecipient extends MessageRecipient {
  channel: MessageChannel;
  renderedBody: string;
}
```

`SendPayload.channel` 은 그대로(`MessageChannel`) 두되, `buildSendPayload`는 기존 로직 유지(변경 없음 — 유효성·중복만 담당).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/messaging/preset.test.ts`
Expected: PASS(기존 + 신규).

- [ ] **Step 5: Commit**

```bash
git add lib/messaging/preset.ts lib/messaging/preset.test.ts
git commit -m "feat(messaging): 채널 타입 alimtalk·SendMode·ResolvedRecipient 추가"
```

---

## Task 3: 마이그레이션 `0030_p4b_messaging_templates.sql`

**Files:**
- Create: `supabase/migrations/0030_p4b_messaging_templates.sql`

**Interfaces:**
- Produces (DB 계약): 테이블 `message_templates(id,org_id,title,body,sort_order,deleted_at,created_at,updated_at)` · `message_logs.template_id` · `message_logs` channel check=`('sms','alimtalk','auto')` · RPC `list_tenant_alimtalk_consent(bigint) → (occupancy_id,alimtalk_opt_in,sms_opt_in)` · RPC `send_messages(text,text,text,jsonb,bigint default null) → jsonb{log_id,count}`.

> **검증 방식**: 본 마이그는 라이브 DB 적용(사용자 PC)에서만 실행되며 이 세션엔 live DB가 없다. 따라서 이 태스크의 "테스트"는 **idempotency·정합 셀프체크(Step 2)** 이며, RPC 계약은 Task 5(mocked)·수동 라이브 검증으로 확인한다. 기존 `0010_p4_messaging.sql` 패턴을 그대로 따른다.

- [ ] **Step 1: 마이그 작성** — `supabase/migrations/0030_p4b_messaging_templates.sql`

```sql
-- P4b: 알림톡 채널 · 메시지 템플릿

-- ===== 템플릿 테이블 (quick_messages 패턴) =====
create table if not exists message_templates (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  title text not null,
  body text not null,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, title)
);
create index if not exists message_templates_org_idx on message_templates (org_id, sort_order);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_message_templates_updated') then
    create trigger trg_message_templates_updated before update on message_templates
      for each row execute function set_updated_at();
  end if;
end $$;

alter table message_templates enable row level security;

drop policy if exists mt_select on message_templates;
create policy mt_select on message_templates for select
  using (org_id in (select my_org_ids()) and current_user_has_module('messaging'));
drop policy if exists mt_insert on message_templates;
create policy mt_insert on message_templates for insert
  with check (org_id in (select my_org_ids()) and current_user_has_module('messaging'));
drop policy if exists mt_update on message_templates;
create policy mt_update on message_templates for update
  using (org_id in (select my_org_ids()) and current_user_has_module('messaging'))
  with check (org_id in (select my_org_ids()) and current_user_has_module('messaging'));

-- ===== message_logs 확장 =====
alter table message_logs add column if not exists template_id bigint references message_templates(id);
alter table message_logs drop constraint if exists message_logs_channel_check;
alter table message_logs add constraint message_logs_channel_check
  check (channel in ('sms','alimtalk','auto'));

-- ===== 동의 조회 RPC =====
create or replace function list_tenant_alimtalk_consent(p_building_id bigint)
returns table(occupancy_id bigint, alimtalk_opt_in boolean, sms_opt_in boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;
  return query
    select o.id, coalesce(o.alimtalk_opt_in,false), coalesce(o.sms_opt_in,false)
    from occupancies o
    join units u on u.id = o.unit_id
    join buildings b on b.id = u.building_id and b.org_id = current_user_org()
    where u.building_id = p_building_id and o.deleted_at is null;
end $$;
revoke execute on function list_tenant_alimtalk_consent(bigint) from public, anon;
grant execute on function list_tenant_alimtalk_consent(bigint) to authenticated;

-- ===== 발송 RPC 확장(stub·자동 라우팅) =====
create or replace function send_messages(
  p_channel text,       -- 요청 모드: 'sms'|'alimtalk'|'auto'
  p_body text,
  p_context text,
  p_recipients jsonb,   -- [{name,phone,unitNo,kind,ref:{occupancyId,...},channel,renderedBody}]
  p_template_id bigint default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_recipients jsonb;
  v_recipient_count int;
  v_log_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;
  if p_channel not in ('sms','alimtalk','auto') then
    raise exception 'invalid channel: sms|alimtalk|auto required';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'invalid body: nonempty text required';
  end if;
  if p_channel in ('alimtalk','auto') and p_template_id is null then
    raise exception 'invalid template: template required for alimtalk/auto';
  end if;
  if p_template_id is not null and not exists (
    select 1 from message_templates t where t.id = p_template_id and t.org_id = v_org and t.deleted_at is null
  ) then
    raise exception 'invalid template: not found in org';
  end if;
  if p_recipients is null or jsonb_typeof(p_recipients) <> 'array' or jsonb_array_length(p_recipients) = 0 then
    raise exception 'invalid recipients: nonempty JSON array required';
  end if;

  -- 수신처별 채널 서버 재판정(동의 권위). alimtalk 모드의 미동의자는 제외.
  select coalesce(jsonb_agg(x.row order by x.ordinality), '[]'::jsonb), count(*)::int
  into v_recipients, v_recipient_count
  from (
    select r.ordinality,
      (r.recipient
        || jsonb_build_object('channel', c.resolved_channel)
        || jsonb_build_object('result', 'stub')) as row,
      c.resolved_channel
    from jsonb_array_elements(p_recipients) with ordinality as r(recipient, ordinality)
    cross join lateral (
      select case
        when p_channel = 'sms' then 'sms'
        else case when coalesce((
          select o.alimtalk_opt_in from occupancies o
          where o.id = nullif(r.recipient->'ref'->>'occupancyId','')::bigint
            and o.deleted_at is null
        ), false)
          then 'alimtalk'
          else case when p_channel = 'alimtalk' then null else 'sms' end
        end
      end as resolved_channel
    ) c
    where c.resolved_channel is not null   -- alimtalk 모드 미동의자 제외
  ) x;

  if v_recipient_count = 0 then
    raise exception 'no eligible recipients (alimtalk consent required)';
  end if;

  insert into message_logs(
    org_id, channel, body, context, recipient_count, recipients, result, sent_by, template_id
  ) values (
    v_org, p_channel, p_body, coalesce(p_context, 'manual'),
    v_recipient_count, v_recipients, 'stub', auth.uid(), p_template_id
  ) returning id into v_log_id;

  return jsonb_build_object('log_id', v_log_id, 'count', v_recipient_count);
end $$;
revoke execute on function send_messages(text,text,text,jsonb,bigint) from public, anon;
grant execute on function send_messages(text,text,text,jsonb,bigint) to authenticated;
```

- [ ] **Step 2: 셀프체크(정합·idempotency)**

확인 항목(모두 예 여야 함):
- `create table if not exists` / `create index if not exists` / `drop policy if exists` → 재실행 안전.
- `message_logs_channel_check` 이름으로 drop→add (0010 인라인 체크의 자동 생성명과 일치; 불일치 대비 `drop constraint if exists`로 방어).
- `send_messages` 4-arg 호출 하위호환: `p_template_id default null` 이므로 기존 4-arg 시그니처와 공존(별도 오버로드 생성). ⚠️ 기존 4-arg `send_messages(text,text,text,jsonb)`가 남아있으면 alimtalk 검증을 우회하므로, 파일 끝에 방어적 드롭 추가:
```sql
drop function if exists send_messages(text,text,text,jsonb);
```
- occupancyId 파싱: `nullif(...,'')::bigint` 로 null·빈문자 안전.

Step 1 파일 끝에 위 `drop function if exists send_messages(text,text,text,jsonb);` 를 포함시킨다.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0030_p4b_messaging_templates.sql
git commit -m "feat(messaging): 0030 알림톡 템플릿·채널 마이그(자동 라우팅 RPC)"
```

---

## Task 4: 템플릿 CRUD 훅 `hooks/reactquery/messageTemplates/*`

**Files:**
- Create: `hooks/reactquery/messageTemplates/{apis.ts,keys.ts,queries.ts,mutations.ts,index.ts}`
- Test: `hooks/reactquery/messageTemplates/apis.test.ts`

**Interfaces:**
- Produces: `MessageTemplate{id,orgId,title,body,sortOrder}` · `MessageTemplateInput{orgId,title,body,sortOrder?}` · `listMessageTemplates()` · `createMessageTemplate(i)` · `updateMessageTemplate(id,i)` · `deleteMessageTemplate(id)` · 훅 `useMessageTemplates/useCreateMessageTemplate/useUpdateMessageTemplate/useDeleteMessageTemplate` · `messageTemplateKeys`.
- Consumes: `@/lib/supabase/client` `createClient`.

- [ ] **Step 1: Write the failing test** — `hooks/reactquery/messageTemplates/apis.test.ts` (quickMessages/apis.test.ts 패턴)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listMessageTemplates, createMessageTemplate, updateMessageTemplate, deleteMessageTemplate } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("messageTemplates apis", () => {
  it("list: deleted_at is null + snake→camel", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:1, org_id:9, title:"미납", body:"#{이름}님", sort_order:0 }], error:null });
    from.mockReturnValue({ select: () => ({ is: () => ({ order }) }) });
    const r = await listMessageTemplates();
    expect(r[0]).toEqual({ id:1, orgId:9, title:"미납", body:"#{이름}님", sortOrder:0 });
  });
  it("create: org_id·title·body insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, org_id:9, title:"공지", body:"b", sort_order:0 }, error:null });
    const ins = vi.fn(() => ({ select: () => ({ single }) }));
    from.mockReturnValue({ insert: ins });
    await createMessageTemplate({ orgId:9, title:"공지", body:"b" });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id:9, title:"공지", body:"b" }));
  });
  it("update: 제공 필드만", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:1, org_id:9, title:"수정", body:"b", sort_order:0 }, error:null });
    const eq = vi.fn(() => ({ select: () => ({ single }) }));
    const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await updateMessageTemplate(1, { title:"수정" });
    expect(upd).toHaveBeenCalledWith({ title:"수정" });
  });
  it("delete: soft(deleted_at)", async () => {
    const eq = vi.fn().mockResolvedValue({ error:null });
    const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await deleteMessageTemplate(3);
    expect(upd).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith("id", 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run hooks/reactquery/messageTemplates/apis.test.ts`
Expected: FAIL (`Cannot find module './apis'`).

- [ ] **Step 3: Write minimal implementation**

`hooks/reactquery/messageTemplates/apis.ts` (quickMessages/apis.ts 미러):

```ts
import { createClient } from "@/lib/supabase/client";

export interface MessageTemplate { id: number; orgId: number; title: string; body: string; sortOrder: number; }
export interface MessageTemplateInput { orgId: number; title: string; body: string; sortOrder?: number; }

type Row = { id: number; org_id: number; title: string; body: string; sort_order: number };
const toRow = (r: Row): MessageTemplate => ({ id: r.id, orgId: r.org_id, title: r.title, body: r.body, sortOrder: r.sort_order });

function inputToRow(i: Partial<MessageTemplateInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("org_id", i.orgId); set("title", i.title); set("body", i.body); set("sort_order", i.sortOrder);
  return r;
}

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  const { data, error } = await createClient().from("message_templates").select("*").is("deleted_at", null).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRow);
}
export async function createMessageTemplate(input: MessageTemplateInput): Promise<MessageTemplate> {
  const { data, error } = await createClient().from("message_templates").insert(inputToRow(input)).select().single();
  if (error) throw new Error(error.message);
  return toRow(data);
}
export async function updateMessageTemplate(id: number, input: Partial<MessageTemplateInput>): Promise<MessageTemplate> {
  const { data, error } = await createClient().from("message_templates").update(inputToRow(input)).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return toRow(data);
}
export async function deleteMessageTemplate(id: number): Promise<void> {
  const { error } = await createClient().from("message_templates").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
```

`keys.ts`:
```ts
export const messageTemplateKeys = { all: ["messageTemplates"] as const, list: () => ["messageTemplates", "list"] as const };
```
`queries.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { listMessageTemplates } from "./apis";
import { messageTemplateKeys } from "./keys";
export function useMessageTemplates() {
  return useQuery({ queryKey: messageTemplateKeys.list(), queryFn: listMessageTemplates });
}
```
`mutations.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMessageTemplate, updateMessageTemplate, deleteMessageTemplate, type MessageTemplateInput } from "./apis";
import { messageTemplateKeys } from "./keys";
export function useCreateMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: MessageTemplateInput) => createMessageTemplate(i), onSuccess: () => qc.invalidateQueries({ queryKey: messageTemplateKeys.all }) });
}
export function useUpdateMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: number; input: Partial<MessageTemplateInput> }) => updateMessageTemplate(id, input), onSuccess: () => qc.invalidateQueries({ queryKey: messageTemplateKeys.all }) });
}
export function useDeleteMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deleteMessageTemplate(id), onSuccess: () => qc.invalidateQueries({ queryKey: messageTemplateKeys.all }) });
}
```
`index.ts`:
```ts
export * from "./apis"; export * from "./keys"; export * from "./queries"; export * from "./mutations";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run hooks/reactquery/messageTemplates/apis.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/reactquery/messageTemplates
git commit -m "feat(messaging): 알림톡 템플릿 CRUD 훅(messageTemplates)"
```

---

## Task 5: 발송·동의 데이터층 확장 `hooks/reactquery/messaging`

**Files:**
- Modify: `hooks/reactquery/messaging/apis.ts`, `keys.ts`, `queries.ts`
- Test: `hooks/reactquery/messaging/apis.test.ts` (기존 갱신)

**Interfaces:**
- Consumes: Task 2 타입(`SendMode`, `ResolvedRecipient`, `MessageChannel`), Task 3 RPC(`send_messages` 5-arg, `list_tenant_alimtalk_consent`).
- Produces: `SendMessagesInput{ mode: SendMode; body: string; context: string; templateId: number|null; recipients: ResolvedRecipient[] }` · `sendMessages(input)` (rpc 5-arg) · `TenantConsent{occupancyId,alimtalkOptIn,smsOptIn}` · `listTenantAlimtalkConsent(buildingId)` · 훅 `useTenantAlimtalkConsent(buildingId)`. `MessageLog`에 `templateId: number|null` 추가.

- [ ] **Step 1: Write the failing test** — `hooks/reactquery/messaging/apis.test.ts` 갱신/추가

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
import { sendMessages, listTenantAlimtalkConsent } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("messaging apis (P4b)", () => {
  it("sendMessages: rpc send_messages 5-arg(mode·template·recipients)", async () => {
    rpc.mockResolvedValue({ data: { log_id: 7, count: 2 }, error: null });
    const out = await sendMessages({
      mode: "auto", body: "#{이름}님", context: "manual", templateId: 5,
      recipients: [
        { name: "A", phone: "0101", kind: "tenant", channel: "alimtalk", renderedBody: "A님", ref: { occupancyId: 11 } },
        { name: "B", phone: "0102", kind: "owner", channel: "sms", renderedBody: "B님" },
      ],
    });
    expect(out).toEqual({ logId: 7, count: 2 });
    expect(rpc).toHaveBeenCalledWith("send_messages", expect.objectContaining({
      p_channel: "auto", p_body: "#{이름}님", p_context: "manual", p_template_id: 5,
      p_recipients: expect.any(Array),
    }));
  });
  it("listTenantAlimtalkConsent: rpc·snake→camel", async () => {
    rpc.mockResolvedValue({ data: [{ occupancy_id: 11, alimtalk_opt_in: true, sms_opt_in: false }], error: null });
    const r = await listTenantAlimtalkConsent(3);
    expect(rpc).toHaveBeenCalledWith("list_tenant_alimtalk_consent", { p_building_id: 3 });
    expect(r[0]).toEqual({ occupancyId: 11, alimtalkOptIn: true, smsOptIn: false });
  });
  it("sendMessages: rpc 에러 전파", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    await expect(sendMessages({ mode: "sms", body: "x", context: "manual", templateId: null, recipients: [{ name:"A", phone:"1", kind:"tenant", channel:"sms", renderedBody:"x" }] }))
      .rejects.toThrow("forbidden");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run hooks/reactquery/messaging/apis.test.ts`
Expected: FAIL (`listTenantAlimtalkConsent` 없음 / `SendMessagesInput` 형 불일치).

- [ ] **Step 3: Write minimal implementation** — `hooks/reactquery/messaging/apis.ts`

`import` 에 타입 추가, `MessageChannel` 대신 `SendMode`·`ResolvedRecipient` 사용:

```ts
import { createClient } from "@/lib/supabase/client";
import type { MessageChannel, MessageRecipient, ResolvedRecipient, SendMode } from "@/lib/messaging/preset";
```

`MessageLog` 인터페이스에 `templateId: number | null;` 추가, `MessageLogRow`에 `template_id: number | null;` 추가, `rowToMessageLog`에 `templateId: row.template_id` 추가.

`SendMessagesInput` 교체:
```ts
export interface SendMessagesInput {
  mode: SendMode;
  body: string;
  context: string;
  templateId: number | null;
  recipients: ResolvedRecipient[];
}
```

`sendMessages` 교체(5-arg):
```ts
export async function sendMessages(
  input: SendMessagesInput,
): Promise<{ logId: number; count: number }> {
  const { data, error } = await createClient().rpc("send_messages", {
    p_channel: input.mode,
    p_body: input.body,
    p_context: input.context,
    p_recipients: input.recipients,
    p_template_id: input.templateId,
  });
  if (error) throw new Error(error.message);
  const result = data as { log_id: number; count: number };
  return { logId: result.log_id, count: result.count };
}
```

동의 조회 추가:
```ts
export interface TenantConsent { occupancyId: number; alimtalkOptIn: boolean; smsOptIn: boolean; }
type TenantConsentRow = { occupancy_id: number; alimtalk_opt_in: boolean; sms_opt_in: boolean };

export async function listTenantAlimtalkConsent(buildingId: number): Promise<TenantConsent[]> {
  const { data, error } = await createClient().rpc("list_tenant_alimtalk_consent", { p_building_id: buildingId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as TenantConsentRow[]).map((r) => ({
    occupancyId: r.occupancy_id, alimtalkOptIn: r.alimtalk_opt_in, smsOptIn: r.sms_opt_in,
  }));
}
```

`keys.ts` 에 consent 키 추가:
```ts
export const messagingKeys = {
  all: ["messaging"] as const,
  logs: (limit?: number) => ["messaging", "logs", limit] as const,
  consent: (buildingId: number) => ["messaging", "consent", buildingId] as const,
};
```

`queries.ts` 에 consent 훅 추가:
```ts
import { listMessageLogs, listTenantAlimtalkConsent } from "./apis";
// ...
export function useTenantAlimtalkConsent(buildingId: number) {
  return useQuery({
    queryKey: messagingKeys.consent(buildingId),
    queryFn: () => listTenantAlimtalkConsent(buildingId),
    enabled: buildingId > 0,
  });
}
```

> ⚠️ `MessageChannel` import는 `MessageLog.channel` 표기에 계속 필요할 수 있음 — 미사용 시 eslint 대비 제거.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run hooks/reactquery/messaging/apis.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/reactquery/messaging
git commit -m "feat(messaging): 발송 RPC 5-arg·동의 조회 훅 확장"
```

---

## Task 6: 템플릿 탭 UI (`TemplatesTab` + `TemplateFormModal`)

**Files:**
- Create: `app/(staff)/staff/messaging/components/TemplateFormModal.tsx`, `TemplatesTab.tsx`
- Test: `TemplatesTab.test.tsx` (RTL 하네스는 `MessagingComposer.test.tsx` 패턴 재사용 — QueryClientProvider wrapper·훅 mock)

**Interfaces:**
- Consumes: Task 4 훅(`useMessageTemplates`·`useCreate/Update/DeleteMessageTemplate`), Task 1 `extractVariables`, `useMe`(orgId), 공용 `Panel/Button/Modal/DataTable/EmptyState`.
- Produces: `<TemplatesTab />`(무 props) · `<TemplateFormModal open template? onClose onSaved />`.

- [ ] **Step 1: Write the failing test** — `TemplatesTab.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TemplatesTab } from "./TemplatesTab";

vi.mock("@/hooks/reactquery/messageTemplates", () => ({
  useMessageTemplates: () => ({ data: [{ id:1, orgId:9, title:"미납 안내", body:"#{이름}님 미납", sortOrder:0 }], isLoading:false }),
  useCreateMessageTemplate: () => ({ mutateAsync: vi.fn(), isPending:false }),
  useUpdateMessageTemplate: () => ({ mutateAsync: vi.fn(), isPending:false }),
  useDeleteMessageTemplate: () => ({ mutateAsync: vi.fn(), isPending:false }),
}));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: () => ({ data: { orgId: 9 } }) }));

function wrap(ui: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;
}

describe("TemplatesTab", () => {
  it("템플릿 목록·사용 변수 표시", () => {
    render(wrap(<TemplatesTab />));
    expect(screen.getByText("미납 안내")).toBeInTheDocument();
    expect(screen.getByText(/이름/)).toBeInTheDocument(); // 사용 변수 칩
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(staff)/staff/messaging/components/TemplatesTab.test.tsx"`
Expected: FAIL (모듈 없음).

- [ ] **Step 3: Write minimal implementation**

`TemplateFormModal.tsx` — 제목·본문 입력, 변수 도움말(`#{이름}·#{호실}·#{건물명}`), 저장 시 create/update. `Modal`(open/onClose/title) + `Button` 사용. orgId는 `useMe`. `extractVariables(body)`로 사용 변수 프리뷰. 저장 성공 시 `toast.success` + `onSaved()`.

핵심 로직(발췌):
```tsx
const vars = extractVariables(body);
const save = async () => {
  if (!title.trim() || !body.trim()) { toast.info("제목과 본문을 입력해 주세요."); return; }
  try {
    if (template) await update.mutateAsync({ id: template.id, input: { title, body } });
    else await create.mutateAsync({ orgId: me.orgId, title, body });
    toast.success("저장했습니다."); onSaved();
  } catch (e) { toast.error(e instanceof Error ? e.message : "저장 실패"); }
};
```

`TemplatesTab.tsx` — `Panel`(action=Button "새 템플릿") + `DataTable`(컬럼: 제목·본문요약·사용변수·관리[수정/삭제]). 삭제는 `window.confirm` 후 `useDeleteMessageTemplate`. 각 행 "사용 변수"는 `extractVariables(t.body)` 를 칩으로 표시. `TemplateFormModal` open 상태 관리. 로딩=`Spinner`, 빈=`EmptyState`.

> UI 스캐폴딩·클래스는 `MessageLogList.tsx`(DataTable)·`MessagingComposer.tsx`(Panel/Button/입력)의 기존 스타일을 그대로 따른다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(staff)/staff/messaging/components/TemplatesTab.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(staff)/staff/messaging/components/TemplateFormModal.tsx" "app/(staff)/staff/messaging/components/TemplatesTab.tsx" "app/(staff)/staff/messaging/components/TemplatesTab.test.tsx"
git commit -m "feat(messaging): 알림톡 템플릿 관리 탭(목록·생성·수정·삭제)"
```

---

## Task 7: 발송 탭 확장 `MessagingComposer` (채널 모드·템플릿·미리보기)

**Files:**
- Modify: `app/(staff)/staff/messaging/components/MessagingComposer.tsx`, `MessagingModal.tsx`
- Test: `MessagingComposer.test.tsx` (기존 갱신)

**Interfaces:**
- Consumes: Task 1(`renderTemplate`), Task 2 타입, Task 4(`useMessageTemplates`), Task 5(`useTenantAlimtalkConsent`, `useSendMessages` with new input).
- Produces: `MessagingComposer` new prop `initialMode?: SendMode`(default `"auto"`). `MessagingModal`은 `initialMode="sms"` 전달.

- [ ] **Step 1: Write the failing test** — `MessagingComposer.test.tsx` 에 케이스 추가

```tsx
// 자동/알림톡 모드에서 템플릿 미선택 시 발송 차단, 채널 뱃지·미리보기 노출
it("자동 모드: 템플릿 미선택이면 발송 비활성", async () => {
  // useMessageTemplates → [], useTenantAlimtalkConsent → [], 빌딩/세대 mock
  render(wrap(<MessagingComposer initialMode="auto" />));
  const sendBtn = screen.getByRole("button", { name: /발송/ });
  expect(sendBtn).toHaveAttribute("aria-disabled", "true");
});
```
(기존 SMS 발송 테스트는 `initialMode` 기본 동작이 바뀌지 않도록 `MessagingModal` 경유 또는 `initialMode="sms"` 명시로 유지.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(staff)/staff/messaging/components/MessagingComposer.test.tsx"`
Expected: FAIL (`initialMode` prop·모드 UI 없음).

- [ ] **Step 3: Write minimal implementation** — `MessagingComposer.tsx`

- props: `initialMode?: SendMode` 추가(default `preset?.mode ?? "auto"`). 채널 표시(고정 SMS) → **모드 셀렉트**(자동/SMS/알림톡)로 교체.
- 상태: `mode`, `templateId`. `useMessageTemplates()` 로 템플릿 목록. `useTenantAlimtalkConsent(selectedBuildingId)` 로 동의맵(occupancyId→alimtalkOptIn).
- 본문 소스: mode!=='sms'이고 templateId 선택 시 template.body를 `body`에 채움(편집 가능). 렌더 소스는 항상 작성란 `body`.
- 수신처별 vars: `{ 이름: name??"", 호실: unitNo??"", 건물명: selectedBuilding?.name??"" }` → `renderTemplate(body, vars)` = `renderedBody`.
- 예상 채널(클라이언트): mode==='sms'→'sms'; occupancyId의 alimtalkOptIn true→'alimtalk' else (mode==='alimtalk'? 제외 : 'sms'). 수신처 옆 뱃지 + alimtalk 모드 제외자 경고.
- 발송 payload: `ResolvedRecipient[]`(각 renderedBody·channel 포함) 구성 → `useSendMessages().mutateAsync({ mode, body, context, templateId: mode==='sms'? null : templateId, recipients })`.
- 가드: mode!=='sms' && !templateId → `canSend=false`; alimtalk 모드 && 적격 0 → 차단 안내.
- 발송 버튼 `aria-disabled={!canSend || isPending}` (기존 패턴 유지).

`MessagingModal.tsx` 수정:
```tsx
<MessagingComposer preset={preset} onSent={onSent} initialMode="sms" />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(staff)/staff/messaging/components/MessagingComposer.test.tsx"`
Expected: PASS(신규+기존).

- [ ] **Step 5: Run 회귀 — overdue/bill 임베드 무영향 확인**

Run: `npx vitest run "app/(staff)/staff/overdue/page.test.tsx" "app/(staff)/staff/bill/page.test.tsx"`
Expected: PASS(무수정). 실패 시 하위호환 위반 → 원인 수정(bill 파일은 수정 금지, Composer/Modal 기본값으로 해결).

- [ ] **Step 6: Commit**

```bash
git add "app/(staff)/staff/messaging/components/MessagingComposer.tsx" "app/(staff)/staff/messaging/components/MessagingComposer.test.tsx" "app/(staff)/staff/messaging/components/MessagingModal.tsx"
git commit -m "feat(messaging): 발송 탭 채널 자동 라우팅·템플릿·미리보기"
```

---

## Task 8: 내역 탭 `HistoryTab` (필터 + 채널 표시)

**Files:**
- Create: `app/(staff)/staff/messaging/components/HistoryTab.tsx`
- Modify: `app/(staff)/staff/messaging/components/MessageLogList.tsx` (채널 표기 하위호환·context 컬럼)
- Test: `HistoryTab.test.tsx`

**Interfaces:**
- Consumes: `useMessageLogs()`, `MessageLog`(now with channel 'sms'|'alimtalk'|'auto', templateId).
- Produces: `<HistoryTab />`. `MessageLogList`에 optional prop `filter?: { channel?: string; context?: string }` (기본=전체, 하위호환).

- [ ] **Step 1: Write the failing test** — `HistoryTab.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HistoryTab } from "./HistoryTab";

vi.mock("@/hooks/reactquery/messaging", () => ({
  useMessageLogs: () => ({ data: [
    { id:1, orgId:9, channel:"auto", body:"a", context:"manual", recipientCount:2, recipients:[], result:"stub", sentBy:null, sentAt:"2026-08-18T00:00:00Z", templateId:5 },
    { id:2, orgId:9, channel:"sms", body:"b", context:"독촉", recipientCount:1, recipients:[], result:"stub", sentBy:null, sentAt:"2026-08-17T00:00:00Z", templateId:null },
  ], isLoading:false, error:null, refetch: vi.fn() }),
}));
const wrap = (ui: React.ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

describe("HistoryTab", () => {
  it("채널 필터로 행 축소", () => {
    render(wrap(<HistoryTab />));
    expect(screen.getByText(/b/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("채널"), { target: { value: "auto" } });
    expect(screen.queryByText(/독촉/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(staff)/staff/messaging/components/HistoryTab.test.tsx"`
Expected: FAIL(모듈 없음).

- [ ] **Step 3: Write minimal implementation**

`HistoryTab.tsx` — 상단 필터 바(`Select` 채널=전체/sms/alimtalk/auto, `Select` context 또는 텍스트, 기간은 v1 생략 가능하나 스텁으로 기간 Select 포함) + `useMessageLogs()` 결과를 클라이언트 필터 후 `MessageLogList`에 전달. 로딩/에러/빈 처리는 MessageLogList가 담당.

`MessageLogList.tsx` — `channel` 컬럼 표기를 `log.channel.toUpperCase()` 유지(‘AUTO’/‘ALIMTALK’ 자동 대응). optional `filter` prop은 HistoryTab에서 이미 필터하므로 **불필요하면 생략**(YAGNI) — HistoryTab이 filtered logs를 넘기는 방식으로 단순화. (즉 MessageLogList 수정은 최소: 필요 없으면 무변경.)

> 결정: 필터는 HistoryTab에서 수행하고 filtered `logs`를 MessageLogList에 전달 → **MessageLogList 무수정**. Step 위 "Modify"는 무변경으로 확정.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(staff)/staff/messaging/components/HistoryTab.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(staff)/staff/messaging/components/HistoryTab.tsx" "app/(staff)/staff/messaging/components/HistoryTab.test.tsx"
git commit -m "feat(messaging): 발송 내역 탭(채널·context 필터)"
```

---

## Task 9: 페이지 3탭 셸 `messaging/page.tsx`

**Files:**
- Modify: `app/(staff)/staff/messaging/page.tsx`
- Test: `app/(staff)/staff/messaging/page.test.tsx` (기존 갱신)

**Interfaces:**
- Consumes: `MessagingComposer`(발송, `initialMode="auto"`), `TemplatesTab`, `HistoryTab`, `useMe`/`hasModule`.
- Produces: 탭 상태 `?tab=send|templates|history`(기본 send).

- [ ] **Step 1: Write the failing test** — `page.test.tsx`

```tsx
it("3탭 렌더·전환", () => {
  // useMe → messaging 모듈 보유 mock, 하위 훅 mock
  render(wrap(<MessagingPage />));
  expect(screen.getByRole("tab", { name: "발송" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "템플릿" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "내역" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "템플릿" }));
  expect(screen.getByText(/새 템플릿/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(staff)/staff/messaging/page.test.tsx"`
Expected: FAIL(탭 없음).

- [ ] **Step 3: Write minimal implementation** — `page.tsx`

- `MessagingWorkspace`를 탭 셸로 교체: `const [tab, setTab] = useState<"send"|"templates"|"history">(...)` (초기값은 `useSearchParams().get("tab")` 허용, 없으면 'send').
- 탭 버튼 `role="tab"`(발송/템플릿/내역), 본문은 조건부 렌더: 발송=`<MessagingComposer initialMode="auto" />`, 템플릿=`<TemplatesTab />`, 내역=`<HistoryTab />`.
- 권한 게이트(`hasModule(me,"messaging")`) 기존 유지. 헤더 문구 유지.
- 탭 변경 시 `router.replace(`?tab=${next}`)` (선택; 최소구현은 상태만으로 충분).

> 접근성: 탭은 `role="tab"` + 활성 표시. 기존 `EmptyState/Spinner` 로딩 처리 유지.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(staff)/staff/messaging/page.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(staff)/staff/messaging/page.tsx" "app/(staff)/staff/messaging/page.test.tsx"
git commit -m "feat(messaging): 발송/템플릿/내역 3탭 셸"
```

---

## Task 10: 전체 검증 게이트 + 정리

**Files:** (검증 전용, 코드 변경 없음 원칙; 실패 시 해당 태스크 파일만 수정)

- [ ] **Step 1: 타입체크**

Run: `npx tsc --noEmit`
Expected: 0 errors. (특히 `MessageChannel`/`SendMode` 확장으로 인한 잔여 오류 확인 — messaging 도메인 내에서만 해결, bill/overdue 무수정.)

- [ ] **Step 2: 전체 테스트**

Run: `npx vitest run`
Expected: 전 스위트 PASS(신규 render/messageTemplates/messaging/TemplatesTab/HistoryTab/Composer/page + 기존 overdue·bill 회귀).

- [ ] **Step 3: Lint**

Run: `npx eslint .`
Expected: 0 error(경고는 기존 baseline 유지). 미사용 import(예: `MessageChannel`) 정리.

- [ ] **Step 4: 빌드**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 5: 최종 확인·커밋(있으면)**

```bash
git status --short           # bill/**, overdue/** 무변경 확인
git add -A && git commit -m "chore(messaging): P4b 검증 게이트 통과(tsc/vitest/eslint/build)" || echo "no changes"
```

- [ ] **Step 6: WBS 동기화**

`wbs-commit-sync` 스킬로 `/staff/messaging`(문자·알림톡 발송) 화면 dev 상태·비고 갱신(주택관리ERP 버킷, dev 트랙만, 완료는 자동변경 금지).

---

## Self-Review (계획↔스펙 대조)

- **스펙 커버리지**: 3탭(T9)·알림톡 자동라우팅(T3 RPC·T7)·SMS 폴백 본문 공용(T7 renderedBody 단일 소스·T3 채널만 분기)·템플릿 CRUD+변수(T4·T6·T1)·내역 필터(T8)·stub 유지(T3)·마이그0030 격리(T3·Global)·수용기준 1~7 매핑 완료.
- **플레이스홀더 스캔**: 코드 스텝은 실제 코드 제공. UI 컴포넌트(T6/T7/T8/T9)는 로직·인터페이스·핵심 발췌 + 기존 컴포넌트 스타일 참조(신규 발명 아님) — 실행자가 기존 패턴을 따르도록 명시.
- **타입 일관성**: `SendMessagesInput{mode,templateId,recipients:ResolvedRecipient[]}`(T2·T5·T7 일치), `send_messages` p_channel=mode(T3·T5), `list_tenant_alimtalk_consent`↔`listTenantAlimtalkConsent`↔`useTenantAlimtalkConsent`(T3·T5·T7) 일관.
- **격리**: bill/overdue 무수정(T7 Step5 회귀 게이트), navItems/AppShell/list_tenants 무변경, 마이그 0030.

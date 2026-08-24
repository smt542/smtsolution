# 예약 발송 worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **본 저장소는 codex 워커로 구현**한다. 스펙 정본: `docs/superpowers/specs/2026-08-24-scheduled-message-worker-design.md`. PRD: `docs/prototype/prd/messaging.md`.

**Goal:** `message_schedules`의 만기 예약행을 즉시발송 엔진(reserve→dispatch→settle)으로 소비해 발송·정산·마감하고, bill_issues 상태를 동기화하는 worker + 서비스롤 드레인 라우트 + EventBridge 자동 트리거 + 운영 수동 버튼을 만든다.

**Architecture:** 서비스롤 드레인 라우트가 `claim_due_message_schedules`로 만기행을 원자적으로 잠그고(`FOR UPDATE SKIP LOCKED`), 행별로 `reserve_scheduled_message`(견적·하드스톱·결정적 idempotency)→`dispatchOne`×수신자(기존 NCP 어댑터)→`settle_message_points`(기존)→`complete_message_schedule`(schedule+bill_issues 마감)을 수행한다. 트리거는 EventBridge가 HTTP로 라우트를 깨우고, 발송 로직은 전부 TS에 둔다.

**Tech Stack:** Next.js(App Router, route handler) · Supabase(Postgres RPC, RLS, service_role) · TypeScript · vitest · NCP SENS(SMS/알림톡, 키게이팅).

## Global Constraints

- 마이그레이션 번호는 **커밋 직전 `git ls-remote`/origin max 재확인**(현재 max `0093` → 신규 `0094`).
- 신규 RPC 3종은 **service_role 전용**: `revoke all ... from public, anon, authenticated` + `grant execute ... to service_role`. 함수 첫 줄에서 `auth.role() = 'service_role'` 가드(기존 `reserve_message_points` 0037:562 패턴).
- **키게이팅 유지**: NCP 미설정 시 실발송 없음. `anyChannelConfigured(channel)=false`면 발송 미진입.
- **즉시발송 경로 무수정·무회귀**: `app/api/messaging/send/route.ts`, `send_messages`, `reserve_message_points`, `settle_message_points`(정의 자체)는 건드리지 않는다(재사용만).
- **UI**: 한국어 문구, staff 화면 = 파랑 디자인 토큰(`bg-surface`·`border-line`·`text-t1`·`bg-brand` 등 기존 클래스 사용, teal 금지).
- `CRON_SECRET`은 **서버 전용** env(`NEXT_PUBLIC_` 접두사 금지). `.env.local` + Amplify 환경변수.
- 검증 기준: `tsc` 0 · `vitest` 전건 green · `lint` 0 · `next build` OK.

---

### Task 1: 마이그레이션 0094 — 스키마 + RPC 3종

**Files:**
- Create: `supabase/migrations/0094_scheduled_message_worker.sql` (번호 커밋 직전 재확인)

**Interfaces (Produces — 후속 태스크가 의존):**
- `claim_due_message_schedules(p_org_id bigint, p_limit int, p_stale_after interval)` → `table(id bigint, org_id bigint, channel text, body text, context text, recipients jsonb, template_id bigint)`
- `reserve_scheduled_message(p_schedule_id bigint)` → `jsonb`:
  - 실패: `{ok:false, code}` (SCHEDULE_NOT_CLAIMED · INVALID_* · NO_ELIGIBLE_RECIPIENTS · INSUFFICIENT_POINTS …)
  - 신규/미정산 replay: `{ok:true, reservation_status:'reserved', reservation_id, message_log_id, resolved_recipients:[{phone,channel,...}], recipient_costs:[{recipient_key,channel,...}], alimtalk_template_code, buttons}`
  - 정산완료 replay: `{ok:true, reservation_status:'settled'|'released', message_log_id, log_result:'sent'|'partial'|'failed'}`
- `complete_message_schedule(p_schedule_id bigint, p_message_log_id bigint, p_final text)` → `jsonb {ok:true}` (`p_final in ('sent','failed')`; schedule + 링크된 bill_issues 동기화)
- `settle_message_points(...)`(0037) 재사용 — 변경 없음.

**Consumes:** 기존 `resolve_message_point_quote`(0037), `message_point_reservations`, `message_logs`, `point_transactions`, `message_templates`, `message_schedules`(0032), `bill_issues`(0032).

- [ ] **Step 1: 마이그 파일 작성** — `supabase/migrations/0094_scheduled_message_worker.sql`:

```sql
-- Track E 후속: message_schedules 소비 worker (claim/reserve/complete)
-- 의존: 0032(message_schedules, bill_issues.message_schedule_id), 0037(포인트 견적/예약/정산)

-- 1) 스키마: sending 상태 + claim/로그 링크 컬럼
alter table message_schedules drop constraint if exists message_schedules_status_check;
alter table message_schedules add constraint message_schedules_status_check
  check (status in ('scheduled','sending','cancelled','sent','failed'));
alter table message_schedules
  add column if not exists claimed_at timestamptz,
  add column if not exists message_log_id bigint references message_logs(id) on delete set null;
create index if not exists message_schedules_due_idx
  on message_schedules (scheduled_at)
  where status in ('scheduled','sending');

-- 2) 만기행 원자적 claim (service_role)
create or replace function claim_due_message_schedules(
  p_org_id bigint default null,
  p_limit int default 50,
  p_stale_after interval default '15 minutes'
) returns table(
  id bigint, org_id bigint, channel text, body text, context text,
  recipients jsonb, template_id bigint
) language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  return query
  with due as (
    select ms.id
    from message_schedules ms
    where (p_org_id is null or ms.org_id = p_org_id)
      and (
        (ms.status = 'scheduled' and ms.scheduled_at <= now())
        or (ms.status = 'sending' and ms.claimed_at < now() - p_stale_after)
      )
    order by ms.scheduled_at
    for update skip locked
    limit greatest(1, p_limit)
  )
  update message_schedules ms
    set status = 'sending', claimed_at = now()
    from due
    where ms.id = due.id
    returning ms.id, ms.org_id, ms.channel, ms.body, ms.context, ms.recipients, ms.template_id;
end $$;
revoke all on function claim_due_message_schedules(bigint, int, interval) from public, anon, authenticated;
grant execute on function claim_due_message_schedules(bigint, int, interval) to service_role;

-- 3) 예약행 견적·예약 (service_role) — 결정적 idempotency, 정산완료 replay 안전
create or replace function reserve_scheduled_message(p_schedule_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row message_schedules%rowtype;
  v_quote jsonb;
  v_idem uuid;
  v_hash text;
  v_existing message_point_reservations%rowtype;
  v_log_result text;
  v_ledger bigint; v_reserved bigint; v_available bigint;
  v_log_id bigint; v_reservation_id bigint; v_log_recipients jsonb;
  v_tpl_code text := null; v_buttons jsonb := '[]'::jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  select * into v_row from message_schedules where id = p_schedule_id;
  if not found or v_row.status <> 'sending' then
    return jsonb_build_object('ok', false, 'code', 'SCHEDULE_NOT_CLAIMED');
  end if;

  v_idem := md5('scheduled-message:' || p_schedule_id::text)::uuid;

  v_quote := resolve_message_point_quote(v_row.org_id, v_row.channel, v_row.recipients, v_row.template_id);
  if not coalesce((v_quote->>'ok')::boolean, false) then
    return v_quote;  -- {ok:false, code}
  end if;

  -- 알림톡 템플릿 코드·버튼 (알림톡 수신자 존재 시)
  if v_row.template_id is not null and exists (
    select 1 from jsonb_array_elements(v_quote->'resolved_recipients') r(v)
    where r.v->>'channel' = 'alimtalk'
  ) then
    select mt.alimtalk_template_code, coalesce(mt.buttons, '[]'::jsonb)
      into v_tpl_code, v_buttons
    from message_templates mt where mt.id = v_row.template_id;
  end if;

  -- 기존 예약(결정적 키) → replay
  select * into v_existing from message_point_reservations
    where org_id = v_row.org_id and idempotency_key = v_idem;
  if found then
    if v_existing.status in ('settled', 'released') then
      select result into v_log_result from message_logs where id = v_existing.message_log_id;
      return jsonb_build_object(
        'ok', true, 'replayed', true, 'reservation_status', v_existing.status,
        'message_log_id', v_existing.message_log_id, 'log_result', coalesce(v_log_result, 'failed')
      );
    end if;
    return jsonb_build_object(
      'ok', true, 'replayed', true, 'reservation_status', 'reserved',
      'reservation_id', v_existing.id, 'message_log_id', v_existing.message_log_id,
      'resolved_recipients', v_quote->'resolved_recipients',
      'recipient_costs', v_quote->'recipient_costs',
      'alimtalk_template_code', v_tpl_code, 'buttons', v_buttons
    );
  end if;

  -- 잔액 하드스톱
  select coalesce(sum(points), 0)::bigint into v_ledger
    from point_transactions where org_id = v_row.org_id;
  select coalesce(sum(reserved_points), 0)::bigint into v_reserved
    from message_point_reservations
    where org_id = v_row.org_id and status in ('reserved', 'reconcile_required');
  v_available := v_ledger - v_reserved;
  if v_available < (v_quote->>'estimated_points')::bigint then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_POINTS',
      'required_points', (v_quote->>'estimated_points')::bigint, 'available_points', v_available);
  end if;

  v_hash := left(md5(v_row.channel || '|' || v_row.body || '|' || v_row.recipients::text), 128);

  select coalesce(jsonb_agg(r.v || jsonb_build_object('result', 'queued') order by r.ord), '[]'::jsonb)
    into v_log_recipients
  from jsonb_array_elements(v_quote->'resolved_recipients') with ordinality as r(v, ord);

  insert into message_logs(
    org_id, channel, body, context, recipient_count, recipients, result,
    sent_by, template_id, estimated_points, charged_points, point_status
  ) values (
    v_row.org_id, v_row.channel, v_row.body, coalesce(v_row.context, 'manual'),
    (v_quote->'counts'->>'total')::integer, v_log_recipients, 'queued',
    v_row.created_by, v_row.template_id, (v_quote->>'estimated_points')::integer, 0, 'reserved'
  ) returning id into v_log_id;

  insert into message_point_reservations(
    org_id, message_log_id, idempotency_key, payload_hash, status,
    reserved_points, charged_points, rate_snapshot, recipient_costs, requested_by, expires_at
  ) values (
    v_row.org_id, v_log_id, v_idem, v_hash, 'reserved',
    (v_quote->>'estimated_points')::integer, 0, v_quote->'rate_snapshot',
    v_quote->'recipient_costs', v_row.created_by, now() + interval '15 minutes'
  ) returning id into v_reservation_id;

  return jsonb_build_object(
    'ok', true, 'replayed', false, 'reservation_status', 'reserved',
    'reservation_id', v_reservation_id, 'message_log_id', v_log_id,
    'resolved_recipients', v_quote->'resolved_recipients',
    'recipient_costs', v_quote->'recipient_costs',
    'alimtalk_template_code', v_tpl_code, 'buttons', v_buttons
  );
end $$;
revoke all on function reserve_scheduled_message(bigint) from public, anon, authenticated;
grant execute on function reserve_scheduled_message(bigint) to service_role;

-- 4) 마감 (service_role) — schedule + 링크 bill_issues 동기화
create or replace function complete_message_schedule(
  p_schedule_id bigint, p_message_log_id bigint, p_final text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  if p_final not in ('sent', 'failed') then
    raise exception 'invalid final status: sent|failed' using errcode = '22023';
  end if;
  update message_schedules
    set status = p_final, message_log_id = coalesce(p_message_log_id, message_log_id)
    where id = p_schedule_id;
  update bill_issues
    set send_status = p_final, message_log_id = coalesce(p_message_log_id, message_log_id)
    where message_schedule_id = p_schedule_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function complete_message_schedule(bigint, bigint, text) from public, anon, authenticated;
grant execute on function complete_message_schedule(bigint, bigint, text) to service_role;
```

- [ ] **Step 2: 로컬 검증(파싱)** — `npm run build` 는 SQL을 실행하진 않으므로, SQL 문법은 라이브 적용 시 확인한다(적용은 Claude가 Management API로 수행). 이 스텝에선 파일 저장만 확인.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0094_scheduled_message_worker.sql
git commit -m "feat(messaging): 예약 소비 worker 마이그(0094) — claim/reserve_scheduled/complete RPC"
```

---

### Task 2: 드레인 코어 `lib/messaging/drainSchedules.ts` (TDD)

**Files:**
- Create: `lib/messaging/drainSchedules.ts`
- Test: `lib/messaging/drainSchedules.test.ts`

**Interfaces:**
- Consumes: Task 1 RPC(`claim_due_message_schedules`·`reserve_scheduled_message`·`complete_message_schedule`)·기존 `settle_message_points`; `anyChannelConfigured`·`dispatchOne`(`lib/messaging/dispatch.ts`).
- Produces:
  ```ts
  export interface DrainDeps { admin: SupabaseClientLike; orgId: number | null; limit?: number; }
  export interface DrainResult { claimed: number; sent: number; failed: number; unconfigured: number; chargedPoints: number; }
  export function drainSchedules(deps: DrainDeps): Promise<DrainResult>;
  ```
  - `SupabaseClientLike` = `{ rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> }` (테스트 목킹 용이하도록 최소 타입).

- [ ] **Step 1: 실패 테스트 작성** — `lib/messaging/drainSchedules.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const dispatchOne = vi.fn();
const anyChannelConfigured = vi.fn();
vi.mock("@/lib/messaging/dispatch", () => ({
  dispatchOne: (...a: unknown[]) => dispatchOne(...a),
  anyChannelConfigured: (...a: unknown[]) => anyChannelConfigured(...a),
}));

import { drainSchedules } from "@/lib/messaging/drainSchedules";

/** function 이름별로 응답을 라우팅하는 admin.rpc 목 */
function makeAdmin(handlers: Record<string, (args: any) => any>) {
  const calls: { fn: string; args: any }[] = [];
  const admin = {
    rpc: vi.fn(async (fn: string, args: any) => {
      calls.push({ fn, args });
      const h = handlers[fn];
      const data = h ? h(args) : null;
      return { data, error: null };
    }),
  };
  return { admin, calls };
}

beforeEach(() => {
  dispatchOne.mockReset();
  anyChannelConfigured.mockReset();
});

describe("drainSchedules", () => {
  it("claim 0건이면 아무것도 안 하고 0 집계", async () => {
    const { admin, calls } = makeAdmin({ claim_due_message_schedules: () => [] });
    const r = await drainSchedules({ admin: admin as any, orgId: null });
    expect(r).toEqual({ claimed: 0, sent: 0, failed: 0, unconfigured: 0, chargedPoints: 0 });
    expect(calls.some((c) => c.fn === "reserve_scheduled_message")).toBe(false);
  });

  it("미설정 채널이면 reserve 미호출·complete('failed')·unconfigured 집계 [D5]", async () => {
    anyChannelConfigured.mockReturnValue(false);
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [{ id: 1, org_id: 7, channel: "sms", body: "안녕", context: "manual", recipients: [{ phone: "01011112222" }], template_id: null }],
      complete_message_schedule: () => ({ ok: true }),
    });
    const r = await drainSchedules({ admin: admin as any, orgId: 7 });
    expect(r.unconfigured).toBe(1);
    expect(calls.some((c) => c.fn === "reserve_scheduled_message")).toBe(false);
    expect(calls.find((c) => c.fn === "complete_message_schedule")!.args).toMatchObject({ p_schedule_id: 1, p_message_log_id: null, p_final: "failed" });
  });

  it("정상: reserve→dispatch×N→settle→complete('sent'), chargedPoints 누적", async () => {
    anyChannelConfigured.mockReturnValue(true);
    dispatchOne.mockResolvedValue({ status: "success", providerId: "p1" });
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [{ id: 2, org_id: 7, channel: "sms", body: "본문", context: "manual", recipients: [{ phone: "010" }], template_id: null }],
      reserve_scheduled_message: () => ({ ok: true, reservation_status: "reserved", reservation_id: 55, message_log_id: 99,
        resolved_recipients: [{ phone: "01011112222", channel: "sms" }], recipient_costs: [{ recipient_key: "k1", channel: "sms" }], alimtalk_template_code: null, buttons: [] }),
      settle_message_points: () => ({ result: "sent", charged_points: 3 }),
      complete_message_schedule: () => ({ ok: true }),
    });
    const r = await drainSchedules({ admin: admin as any, orgId: 7 });
    expect(dispatchOne).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ claimed: 1, sent: 1, chargedPoints: 3 });
    expect(calls.find((c) => c.fn === "settle_message_points")!.args).toMatchObject({ p_reservation_id: 55, p_results: [{ recipient_key: "k1", status: "success" }] });
    expect(calls.find((c) => c.fn === "complete_message_schedule")!.args).toMatchObject({ p_schedule_id: 2, p_message_log_id: 99, p_final: "sent" });
  });

  it("INSUFFICIENT_POINTS면 dispatch 미호출·complete('failed') [D6]", async () => {
    anyChannelConfigured.mockReturnValue(true);
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [{ id: 3, org_id: 7, channel: "sms", body: "b", context: "manual", recipients: [{ phone: "010" }], template_id: null }],
      reserve_scheduled_message: () => ({ ok: false, code: "INSUFFICIENT_POINTS" }),
      complete_message_schedule: () => ({ ok: true }),
    });
    const r = await drainSchedules({ admin: admin as any, orgId: 7 });
    expect(dispatchOne).not.toHaveBeenCalled();
    expect(r.failed).toBe(1);
    expect(calls.find((c) => c.fn === "complete_message_schedule")!.args).toMatchObject({ p_final: "failed" });
  });

  it("settle result='partial'이면 final='sent'", async () => {
    anyChannelConfigured.mockReturnValue(true);
    dispatchOne.mockResolvedValueOnce({ status: "success" }).mockResolvedValueOnce({ status: "failed", reason: "x" });
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [{ id: 4, org_id: 7, channel: "sms", body: "b", context: "manual", recipients: [{}, {}], template_id: null }],
      reserve_scheduled_message: () => ({ ok: true, reservation_status: "reserved", reservation_id: 1, message_log_id: 2,
        resolved_recipients: [{ phone: "a", channel: "sms" }, { phone: "b", channel: "sms" }], recipient_costs: [{ recipient_key: "k1" }, { recipient_key: "k2" }] }),
      settle_message_points: () => ({ result: "partial", charged_points: 1 }),
      complete_message_schedule: () => ({ ok: true }),
    });
    const r = await drainSchedules({ admin: admin as any, orgId: 7 });
    expect(calls.find((c) => c.fn === "complete_message_schedule")!.args).toMatchObject({ p_final: "sent" });
    expect(r.sent).toBe(1);
  });

  it("정산완료 replay(reservation_status='settled')면 dispatch 미호출·log_result로 complete", async () => {
    anyChannelConfigured.mockReturnValue(true);
    const { admin, calls } = makeAdmin({
      claim_due_message_schedules: () => [{ id: 5, org_id: 7, channel: "sms", body: "b", context: "manual", recipients: [{}], template_id: null }],
      reserve_scheduled_message: () => ({ ok: true, replayed: true, reservation_status: "settled", message_log_id: 42, log_result: "sent" }),
      complete_message_schedule: () => ({ ok: true }),
    });
    const r = await drainSchedules({ admin: admin as any, orgId: 7 });
    expect(dispatchOne).not.toHaveBeenCalled();
    expect(calls.find((c) => c.fn === "complete_message_schedule")!.args).toMatchObject({ p_schedule_id: 5, p_message_log_id: 42, p_final: "sent" });
    expect(r.sent).toBe(1);
  });

  it("한 행이 예외를 던져도 다음 행을 계속 처리", async () => {
    anyChannelConfigured.mockReturnValue(true);
    dispatchOne.mockResolvedValue({ status: "success" });
    let reserveCall = 0;
    const { admin } = makeAdmin({
      claim_due_message_schedules: () => [
        { id: 6, org_id: 7, channel: "sms", body: "b", context: "manual", recipients: [{}], template_id: null },
        { id: 7, org_id: 7, channel: "sms", body: "b", context: "manual", recipients: [{}], template_id: null },
      ],
      reserve_scheduled_message: () => {
        reserveCall += 1;
        if (reserveCall === 1) throw new Error("boom");
        return { ok: true, reservation_status: "reserved", reservation_id: 1, message_log_id: 2, resolved_recipients: [{ phone: "a", channel: "sms" }], recipient_costs: [{ recipient_key: "k1" }] };
      },
      settle_message_points: () => ({ result: "sent", charged_points: 1 }),
      complete_message_schedule: () => ({ ok: true }),
    });
    const r = await drainSchedules({ admin: admin as any, orgId: 7 });
    expect(r.claimed).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.sent).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실행(실패 확인)** — Run: `npx vitest run lib/messaging/drainSchedules.test.ts` · Expected: FAIL(`drainSchedules` 미정의).

- [ ] **Step 3: 구현** — `lib/messaging/drainSchedules.ts`:

```ts
import { anyChannelConfigured, dispatchOne } from "@/lib/messaging/dispatch";
import type { AlimtalkButton } from "@/lib/messaging/alimtalk";
import type { MessageChannel } from "@/lib/messaging/preset";

interface RpcResult { data: unknown; error: { message: string } | null }
export interface SupabaseClientLike {
  rpc(fn: string, args?: Record<string, unknown>): Promise<RpcResult>;
}
export interface DrainDeps { admin: SupabaseClientLike; orgId: number | null; limit?: number }
export interface DrainResult { claimed: number; sent: number; failed: number; unconfigured: number; chargedPoints: number }

interface ClaimRow { id: number; org_id: number; channel: MessageChannel | "auto"; body: string; context: string; recipients: unknown; template_id: number | null }
interface ReserveResult {
  ok: boolean; code?: string; reservation_status?: "reserved" | "settled" | "released";
  reservation_id?: number; message_log_id?: number; log_result?: string;
  resolved_recipients?: { phone: string; channel: MessageChannel }[];
  recipient_costs?: { recipient_key: string; channel?: MessageChannel }[];
  alimtalk_template_code?: string | null; buttons?: AlimtalkButton[];
}

async function rpc(admin: SupabaseClientLike, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

async function complete(admin: SupabaseClientLike, id: number, logId: number | null, final: "sent" | "failed"): Promise<void> {
  await rpc(admin, "complete_message_schedule", { p_schedule_id: id, p_message_log_id: logId, p_final: final });
}

async function processRow(admin: SupabaseClientLike, row: ClaimRow, out: DrainResult): Promise<void> {
  if (!anyChannelConfigured(row.channel)) {
    await complete(admin, row.id, null, "failed");
    out.unconfigured += 1;
    return;
  }
  const reserve = (await rpc(admin, "reserve_scheduled_message", { p_schedule_id: row.id })) as ReserveResult;
  if (!reserve?.ok) {
    await complete(admin, row.id, null, "failed");
    out.failed += 1;
    return;
  }
  // 이미 정산 완료된 예약(크래시 후 재claim) → 재발송 금지, 로그 결과로 마감
  if (reserve.reservation_status && reserve.reservation_status !== "reserved") {
    const final = reserve.log_result === "sent" || reserve.log_result === "partial" ? "sent" : "failed";
    await complete(admin, row.id, reserve.message_log_id ?? null, final);
    if (final === "sent") out.sent += 1; else out.failed += 1;
    return;
  }

  const resolved = reserve.resolved_recipients ?? [];
  const costs = reserve.recipient_costs ?? [];
  const results: { recipient_key: string; status: "success" | "failed" }[] = [];
  let providerRequestId: string | null = null;
  for (let i = 0; i < resolved.length; i++) {
    const key = costs[i]?.recipient_key;
    if (!key) continue;
    const channel = resolved[i].channel;
    const d = await dispatchOne({
      channel,
      phone: resolved[i].phone,
      body: row.body,
      templateCode: channel === "alimtalk" ? reserve.alimtalk_template_code ?? null : null,
      buttons: channel === "alimtalk" ? reserve.buttons : undefined,
    });
    if (d.providerId && !providerRequestId) providerRequestId = d.providerId;
    results.push({ recipient_key: key, status: d.status });
  }

  const settle = (await rpc(admin, "settle_message_points", {
    p_reservation_id: reserve.reservation_id,
    p_provider_request_id: providerRequestId,
    p_results: results,
  })) as { result?: string; status?: string; charged_points?: number };

  const outcome = settle?.result ?? settle?.status;
  const final = outcome === "sent" || outcome === "partial" ? "sent" : "failed";
  await complete(admin, row.id, reserve.message_log_id ?? null, final);
  if (final === "sent") out.sent += 1; else out.failed += 1;
  out.chargedPoints += settle?.charged_points ?? 0;
}

export async function drainSchedules({ admin, orgId, limit = 50 }: DrainDeps): Promise<DrainResult> {
  const out: DrainResult = { claimed: 0, sent: 0, failed: 0, unconfigured: 0, chargedPoints: 0 };
  const claimed = (await rpc(admin, "claim_due_message_schedules", { p_org_id: orgId, p_limit: limit })) as ClaimRow[] | null;
  const rows = claimed ?? [];
  out.claimed = rows.length;
  for (const row of rows) {
    try {
      await processRow(admin, row, out);
    } catch {
      try { await complete(admin, row.id, null, "failed"); } catch { /* noop */ }
      out.failed += 1;
    }
  }
  return out;
}
```

> 주의: `dispatchOne`의 실제 인자/반환 형태는 `lib/messaging/dispatch.ts`를 확인해 정확히 맞춘다(위 `app/api/messaging/send/route.ts:139-147`의 호출 형태 기준). `AlimtalkButton` 타입 경로도 확인.

- [ ] **Step 4: 테스트 실행(통과 확인)** — Run: `npx vitest run lib/messaging/drainSchedules.test.ts` · Expected: PASS(7건).

- [ ] **Step 5: 커밋**

```bash
git add lib/messaging/drainSchedules.ts lib/messaging/drainSchedules.test.ts
git commit -m "feat(messaging): 예약 소비 드레인 코어 drainSchedules (claim→reserve→dispatch→settle→complete)"
```

---

### Task 3: 드레인 라우트 `app/api/messaging/dispatch-scheduled/route.ts` (TDD)

**Files:**
- Create: `app/api/messaging/dispatch-scheduled/route.ts`
- Test: `app/api/messaging/dispatch-scheduled/route.test.ts`

**Interfaces:**
- Consumes: `drainSchedules`(Task 2), `createClient`(`@/lib/supabase/server`), `createAdminClient`(`@/lib/supabase/admin`).
- Produces: `POST(request: Request): Promise<Response>`.
- 인증(D2): `Authorization: Bearer <CRON_SECRET>` 상수시간 일치 → 전 org(`orgId=null`). 아니면 세션 user + `get_my_context`의 messaging 권한 → 본인 org. 세션無 → 401, 세션有·권한無 → 403.

- [ ] **Step 1: 실패 테스트 작성** — `app/api/messaging/dispatch-scheduled/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getUser = vi.fn();
const serverRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc: serverRpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ __admin: true }) }));
const drainSchedules = vi.fn();
vi.mock("@/lib/messaging/drainSchedules", () => ({ drainSchedules: (...a: unknown[]) => drainSchedules(...a) }));

import { POST } from "@/app/api/messaging/dispatch-scheduled/route";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://x/api/messaging/dispatch-scheduled", { method: "POST", headers });
}

beforeEach(() => {
  process.env.CRON_SECRET = "s3cr3t";
  drainSchedules.mockResolvedValue({ claimed: 2, sent: 1, failed: 1, unconfigured: 0, chargedPoints: 3 });
});
afterEach(() => { vi.clearAllMocks(); delete process.env.CRON_SECRET; });

describe("POST /api/messaging/dispatch-scheduled", () => {
  it("시크릿·세션 모두 없으면 401", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(drainSchedules).not.toHaveBeenCalled();
  });

  it("유효 시크릿이면 전 org(orgId=null) 드레인", async () => {
    const res = await POST(req({ authorization: "Bearer s3cr3t" }));
    expect(res.status).toBe(200);
    expect(drainSchedules).toHaveBeenCalledWith(expect.objectContaining({ orgId: null }));
    expect(getUser).not.toHaveBeenCalled();
  });

  it("세션(messaging 권한)이면 본인 org 드레인", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serverRpc.mockResolvedValue({ data: [{ org_id: 7, role: "staff", permissions: ["messaging"] }], error: null });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(drainSchedules).toHaveBeenCalledWith(expect.objectContaining({ orgId: 7 }));
  });

  it("세션 있으나 messaging 권한 없으면 403", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serverRpc.mockResolvedValue({ data: [{ org_id: 7, role: "staff", permissions: [] }], error: null });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(drainSchedules).not.toHaveBeenCalled();
  });

  it("집계 JSON 반환", async () => {
    const res = await POST(req({ authorization: "Bearer s3cr3t" }));
    expect(await res.json()).toMatchObject({ claimed: 2, sent: 1, failed: 1 });
  });
});
```

- [ ] **Step 2: 테스트 실행(실패 확인)** — Run: `npx vitest run app/api/messaging/dispatch-scheduled/route.test.ts` · Expected: FAIL(모듈 없음).

- [ ] **Step 3: 구현** — `app/api/messaging/dispatch-scheduled/route.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { drainSchedules } from "@/lib/messaging/drainSchedules";

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET ?? "";
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";

  let orgId: number | null = null;

  if (secret && bearer && safeEqual(bearer, secret)) {
    orgId = null; // 전 org (cron)
  } else {
    const sb = await createClient();
    const { data: userData } = await sb.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);
    const { data: ctxData, error: ctxErr } = await sb.rpc("get_my_context");
    if (ctxErr) return json({ error: ctxErr.message }, 500);
    const ctx = (Array.isArray(ctxData) ? ctxData[0] : ctxData) as
      | { org_id?: number; role?: string; permissions?: unknown }
      | null;
    const role = ctx?.role;
    const permissions = Array.isArray(ctx?.permissions) ? (ctx.permissions as string[]) : [];
    const hasMessaging = role === "org_owner" || role === "platform_admin" || permissions.includes("messaging");
    if (!ctx?.org_id || !hasMessaging) return json({ error: "forbidden" }, 403);
    orgId = ctx.org_id;
  }

  const admin = createAdminClient();
  const result = await drainSchedules({ admin, orgId, limit: 50 });
  return json(result);
}
```

- [ ] **Step 4: 테스트 실행(통과 확인)** — Run: `npx vitest run app/api/messaging/dispatch-scheduled/route.test.ts` · Expected: PASS(5건).

- [ ] **Step 5: 커밋**

```bash
git add app/api/messaging/dispatch-scheduled/route.ts app/api/messaging/dispatch-scheduled/route.test.ts
git commit -m "feat(messaging): 예약 소비 드레인 라우트 dispatch-scheduled (cron/세션 이중 인증)"
```

---

### Task 4: 운영 수동 버튼 `/staff/messaging` "예약분 지금 처리"

**Files:**
- Modify: `app/(staff)/staff/messaging/` 내 예약 목록/발송 영역 컴포넌트(정확 위치는 기존 레이아웃 확인 — 예약 탭 또는 컴포저 인근). 필요 시 작은 컴포넌트 `components/DrainScheduledButton.tsx` 신설.
- Test: 위 컴포넌트 옆에 `.test.tsx`(선택: 클릭 시 fetch 호출·성공 토스트 단언).

**Interfaces:**
- Consumes: `POST /api/messaging/dispatch-scheduled`(Task 3, 세션 인증) → `{claimed, sent, failed, unconfigured, chargedPoints}`.

- [ ] **Step 1: 기존 레이아웃 확인** — `/staff/messaging`의 예약 목록/탭 구조를 읽어 버튼 배치 지점을 정한다(예약 목록 헤더 우측 권장).

- [ ] **Step 2: 버튼 구현** — 클릭 시:

```tsx
async function handleDrain() {
  try {
    const res = await fetch("/api/messaging/dispatch-scheduled", { method: "POST" });
    const r = await res.json();
    if (!res.ok) { toast.error(r.error === "forbidden" ? "권한이 없습니다." : "처리에 실패했습니다."); return; }
    toast.success(`처리 ${r.claimed} · 발송 ${r.sent} · 실패 ${r.failed} · 미설정 ${r.unconfigured}`);
    // 예약 목록 쿼리 무효화(존재 시): queryClient.invalidateQueries(...)
  } catch {
    toast.error("네트워크 오류로 처리하지 못했습니다.");
  }
}
```

- 버튼은 기존 파랑 토큰(`bg-brand text-white` 등) 사용. 문구 "예약분 지금 처리".

- [ ] **Step 3: 검증 & 커밋** — Run: `npx vitest run app/(staff)/staff/messaging` (관련 테스트 무회귀) · 그 후:

```bash
git add "app/(staff)/staff/messaging"
git commit -m "feat(messaging): 예약분 수동 처리 버튼(드레인 라우트 호출)"
```

---

### Task 5: Ops 문서 `docs/ops/eventbridge-scheduled-messaging.md`

**Files:**
- Create: `docs/ops/eventbridge-scheduled-messaging.md`

- [ ] **Step 1: 문서 작성** — 다음을 포함:
  - **개요**: EventBridge가 `rate(1 minute)`로 `POST https://<amplify-domain>/api/messaging/dispatch-scheduled` 를 `Authorization: Bearer <CRON_SECRET>` 헤더로 호출.
  - **env**: `CRON_SECRET`(강한 난수, 예 `openssl rand -hex 32`)을 ① 로컬 `.env.local` ② Amplify 콘솔 환경변수에 등록. `NEXT_PUBLIC_` 금지.
  - **배선 A — EventBridge Rule + API destination(무 Lambda, 권장)**: Connection(API key auth, 헤더 `Authorization`=`Bearer <secret>`) → API destination(엔드포인트 URL, POST, rate limit) → Rule(schedule `rate(1 minute)`, target=API destination). CLI 예시(`aws events create-connection` / `create-api-destination` / `put-rule --schedule-expression` / `put-targets`)와 콘솔 단계.
  - **배선 B — EventBridge Scheduler → Lambda(대안)**: Scheduler(rate 1분) → 최소 Lambda가 secret 헤더로 라우트 fetch. 코드 스텁 포함.
  - **최소 IAM**: Rule→API destination invoke 권한(EventBridge가 관리하는 role), Connection secret은 Secrets Manager 저장.
  - **검증**: (1) 수동 `curl -XPOST -H "authorization: Bearer <secret>" <url>` → 집계 JSON 확인 (2) `/staff/messaging` 수동 버튼 (3) CloudWatch에서 Rule 호출 로그.
  - **주의**: 실 배선은 클라이언트 SSO 계정(auraworks)에서 수행. NCP 키 미설정 시 예약은 `failed`(미설정)로 마감됨(D5).

- [ ] **Step 2: 커밋**

```bash
git add docs/ops/eventbridge-scheduled-messaging.md
git commit -m "docs(ops): 예약 발송 EventBridge/CRON_SECRET 배선 가이드"
```

---

### Task 6: 전체 검증

- [ ] **Step 1: 타입·테스트·린트·빌드**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```
Expected: tsc 0 · vitest 전건 green · lint 0 · build OK.

- [ ] **Step 2: (Claude) 라이브 마이그 적용** — `0094`를 Management API로 적용(코덱스 샌드박스는 네트워크 불가 → **Claude가 수행**). 적용 후 스모크: `claim_due_message_schedules(null,1,'15 minutes')`가 `service_role`로만 실행되는지, 권한 회귀 없는지 확인.

- [ ] **Step 3: PR** — (Claude) `feat/scheduled-message-worker` → master PR 생성, 디프 리뷰 후 머지. 커밋 직후 `wbs-commit-sync`로 messaging/서류발행 화면 dev 갱신.

## 구현 노트 (codex 위임 시)
- 각 태스크는 독립 커밋. 코드 스텝의 코드는 **정본 기준**이되, `dispatch.ts`/`preset.ts`/`admin.ts`의 실제 시그니처를 확인해 정확히 맞춘다(불일치 시 스펙·기존 route.ts 우선).
- 마이그 번호는 커밋 직전 `git ls-remote origin master`로 최신 반영 후 max+1 재확인(병렬 세션 선점 대비).
- 즉시발송(`/api/messaging/send`)·`send_messages`·`settle_message_points` 정의는 건드리지 않는다.

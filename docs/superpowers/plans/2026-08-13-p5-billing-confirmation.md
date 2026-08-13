# P5 부과 확정 슬라이스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/management-fee`를 건물 중심으로 재구성하여 세대별 관리비 항목 금액 입력 → 월 단위 부과 확정(재확정 가능) → 6개월 이력을 완성한다.

**Architecture:** 신규 테이블 3종(`fee_item_charges`·`billing_confirmations`·`billing_history`, 마이그 0012)과 definer RPC 4종으로 원자적 저장·확정을 처리. 계산(이월·일할·합계)은 `lib/billing` 순수 함수 + SQL `round_charge`로 이중화(공식 일치). UI는 기존 reactquery 도메인 패턴(`hooks/reactquery/billing`)과 utilities/buildings 컴포넌트 패턴을 계승.

**Tech Stack:** Next.js 16(App Router, `"use client"`) · Supabase(PostgreSQL·Auth) · React Query(@tanstack) · TailwindCSS · Vitest + Testing Library · zod.

**기준 spec:** `docs/superpowers/specs/2026-08-12-p5-billing-confirmation-design.md`

## Global Constraints

- **금액**: 모든 금액 컬럼/값은 `integer`(원 단위).
- **기간**: `period`는 `date`로 매월 1일(`'YYYY-MM-01'`). 전월 = `(period - interval '1 month')::date`.
- **권한 모듈 키**: `billing`(부과 확정). 화면 게이트 `hasModule(me, "billing")`, 쓰기 RLS `current_user_has_module('billing')`.
- **RLS 패턴**: 신규 테이블 SELECT는 org 개방(`unit→building→org in my_org_ids()`), 쓰기는 `billing` 모듈 게이팅. `billing_history`는 write policy 없음(definer RPC만 기록).
- **우수리(rounding)** 도메인: `up`(올림)·`round`(반올림)·`down`(버림)·`raw`(반올림). SQL `round_charge`와 TS `effectiveAmount`의 매핑이 **반드시 일치**.
- **데이터 계층 패턴**: 도메인 폴더 = `apis.ts`(fn+type+snake↔camel 매퍼)·`keys.ts`·`queries.ts`·`mutations.ts`·`index.ts`(배럴 `export *`). RPC 호출은 `createClient().rpc("fn", { p_arg })` → `{ data, error }`, 에러 시 throw.
- **Next 주의(AGENTS.md)**: 클라이언트 페이지·컴포넌트는 `"use client"`. `<input type="month">`·모달·`usePathname` 등 Next/React API는 구현 전 `node_modules/next/dist/docs/` 확인.
- **DB 적용**: 운영 이력 정합성 복구 후 `0012`로 적용. 적용 전 dry-run은 0012 한 건만 확인하고, 적용 후 `p5_checks.sql`을 실행한다.
- **커밋**: 한국어 conventional(`feat`/`fix`/`docs`/`test`/`refactor`). **모든 커밋 메시지 끝에** 다음 트레일러(빈 줄 뒤)를 붙인다:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **WBS 동기화**: 화면 코드를 건드린 커밋 직후 `wbs-commit-sync`(dev 트랙만, 완료 자동변경 금지). SQL/lib/hooks 전용 커밋은 대상 아님.

---

## File Structure

**생성**
- `supabase/migrations/0012_p5_billing.sql` — 3테이블·인덱스·트리거·RLS·RPC 4종·`round_charge`.
- `supabase/verify/p5_checks.sql` — 스키마·정책·RPC 존재 검증(사용자 PC psql).
- `lib/billing/period.ts` (+ `.test.ts`) — 월(period) 변환·현재월·미래판정.
- `lib/billing/proration.ts` (+ `.test.ts`) — 일할계산·우수리(`effectiveAmount`).
- `lib/billing/total.ts` (+ `.test.ts`) — 세대 합계(`unitTotal`).
- `lib/billing/pivot.ts` (+ `.test.ts`) — flat rows→그리드(`pivotBillingRows`) + 공유 타입.
- `hooks/reactquery/billing/{apis.ts,keys.ts,queries.ts,mutations.ts,index.ts,apis.test.ts}` — 데이터 계층.
- `app/(staff)/staff/management-fee/components/BillingTable.tsx` (+ `.test.tsx`) — 세대별 부과 그리드.
- `app/(staff)/staff/management-fee/components/ItemManageModal.tsx` — 항목관리 모달(기존 `FeeItemList`/`FeeItemFormModal` 래핑).
- `app/(staff)/staff/management-fee/components/BillingHistoryModal.tsx` (+ `.test.tsx`) — 6개월 이력.
- `app/(staff)/staff/management-fee/components/BillingNoteModal.tsx` (+ `.test.tsx`) — 세대 월 메모.

**수정(재작성)**
- `app/(staff)/staff/management-fee/page.tsx` — 건물 중심 재구성.
- `app/(staff)/staff/management-fee/page.test.tsx` — 신규 구조로 재작성.

**재사용(변경 없음)**
- `components/common`(Button/Select/Tabs/EmptyState/Spinner/Modal 등), `hooks/reactquery/{auth,buildings,buildingTypes,feeItems}`, `app/(staff)/staff/management-fee/components/{FeeItemList,FeeItemFormModal}.tsx`, `lib/auth/permissions.ts`.

> **`FeeItemList`/`FeeItemFormModal` props**: 현재 `page.tsx`의 사용부(리스트: `items,isLoading,onEdit,onDelete,onMoveUp,onMoveDown`; 폼: `open,onClose,editing,onSubmit,isPending`)를 그대로 계승한다. `BuildingTypeTabs`는 이 화면에서 미사용.

---

## Group 1 — DB · 데이터층

### Task 1: 마이그레이션 0012 — 테이블·인덱스·트리거·RLS

**Files:**
- Create: `supabase/migrations/0012_p5_billing.sql`

**Interfaces:**
- Produces: 테이블 `fee_item_charges(unit_id,fee_item_id,period,occupancy_id,charged,amount)` · `billing_confirmations(unit_id,period,occupancy_id,total_amount,billing_note,unit_notice,confirmed_at,confirmed_by)` · `billing_history(unit_id,period,occupancy_id,tenant_name,total_amount,items,confirmed_at,confirmed_by)`. Task 2·3 RPC가 이 테이블에 기록.

- [ ] **Step 1: 마이그레이션 파일 작성(테이블·트리거·RLS)**

```sql
-- 0012_p5_billing.sql
-- P5: 부과 확정 슬라이스 (fee_item_charges / billing_confirmations / billing_history)
-- 의존: P0(profiles·audit_log·set_updated_at), P1a(units·fee_items.carry_over),
--       P2a(current_user_org·current_user_has_module·my_org_ids), P3b(occupancies)
-- 모듈 게이트: billing

-- ===== 테이블 =====
create table fee_item_charges (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  fee_item_id bigint not null references fee_items(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  occupancy_id bigint references occupancies(id) on delete set null,
  charged boolean not null default true,
  amount integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, fee_item_id, period)
);
create index on fee_item_charges (unit_id, period);
create index on fee_item_charges (fee_item_id);

create table billing_confirmations (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  occupancy_id bigint references occupancies(id) on delete set null,
  total_amount integer not null default 0,
  billing_note text,
  unit_notice text,
  confirmed_at timestamptz,
  confirmed_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, period)
);
create index on billing_confirmations (unit_id, period);

create table billing_history (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  period date not null,
  occupancy_id bigint references occupancies(id) on delete set null,
  tenant_name text,
  total_amount integer not null,
  items jsonb not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);
create index on billing_history (unit_id, period, confirmed_at desc);

-- ===== updated_at 트리거 (history는 append-only → 제외) =====
do $$ declare t text; begin
  foreach t in array array['fee_item_charges','billing_confirmations'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- ===== RLS: SELECT org 개방 / 쓰기 billing 모듈 =====
alter table fee_item_charges      enable row level security;
alter table billing_confirmations enable row level security;
alter table billing_history       enable row level security;

create policy fic_select on fee_item_charges for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy fic_write on fee_item_charges for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('billing'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('billing'));

create policy bc_select on billing_confirmations for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy bc_write on billing_confirmations for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('billing'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('billing'));

-- billing_history: SELECT만 개방, 직접 쓰기 policy 없음(INSERT는 definer RPC만)
create policy bh_select on billing_history for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
```

- [ ] **Step 2: SQL 정합성 육안 확인**

확인: (1) 세 테이블 `enable row level security` + 정책 존재, (2) `billing_history`에 write policy **없음**, (3) `period` CHECK가 매월 1일 강제, (4) `confirmed_by`가 `profiles(user_id)` 참조, (5) 트리거 배열에 `billing_history` 제외.
> 라이브 적용은 사용자 PC(0007). 이 세션에선 실행 불가 — 파일 정합성만 확인.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0012_p5_billing.sql
git commit -m "feat(db): P5 부과 테이블 3종+RLS (0007) — fee_item_charges·billing_confirmations·billing_history"
```

---

### Task 2: 마이그레이션 0012 — 읽기 RPC (`round_charge`·`list_billing`·`list_billing_history`)

**Files:**
- Modify: `supabase/migrations/0012_p5_billing.sql` (append)

**Interfaces:**
- Produces:
  - `round_charge(numeric, text) → int` — 우수리 헬퍼(`up`→ceil, `down`→floor, 그 외→round).
  - `list_billing(bigint, date)` → 세대×항목 flat rows(아래 컬럼 순서·타입은 Task 8 `BillingFlatRow` 매퍼가 소비).
  - `list_billing_history(bigint, date, int) → (period date, total_amount int, items jsonb, confirmed_at timestamptz)`.

- [ ] **Step 1: 읽기 RPC 추가**

```sql
-- ===== 우수리 헬퍼 (TS effectiveAmount와 매핑 일치) =====
create or replace function round_charge(p_value numeric, p_rounding text)
returns int language sql immutable as $$
  select case p_rounding
    when 'up'   then ceil(p_value)
    when 'down' then floor(p_value)
    else round(p_value)            -- 'round','raw',기타 → 반올림
  end::int;
$$;

-- ===== 세대×항목 조회 (당월 초안 + 전월 이월 prefill + 확정상태 + is_dirty) =====
create or replace function list_billing(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, room_type_label text,
  occupancy_id bigint, tenant_name text, move_in_date date, is_vacant boolean,
  fee_item_id bigint, fee_item_name text, carry_over boolean, daily_proration boolean,
  rounding text, is_required boolean, sort_order int,
  charged boolean, amount integer,
  confirmed_at timestamptz, confirmed_by_name text, total_amount integer,
  billing_note text, unit_notice text, is_dirty boolean
) language sql stable security definer set search_path = public as $$
  with b as (
    select id, type_id from buildings where id = p_building_id and org_id = current_user_org()
  ),
  fi as (
    select * from fee_items where type_id = (select type_id from b) and deleted_at is null
  ),
  u as (
    select id, unit_no, dong from units where building_id = p_building_id and deleted_at is null
  ),
  occ as (
    select distinct on (o.unit_id)
      o.unit_id, o.id as occupancy_id, o.tenant_name, o.move_in_date, o.status, o.room_type_id
    from occupancies o join u on u.id = o.unit_id
    where o.deleted_at is null
    order by o.unit_id, o.created_at desc
  )
  select
    u.id, u.unit_no, u.dong, rt.label,
    occ.occupancy_id, occ.tenant_name, occ.move_in_date,
    coalesce(occ.status = 'vacant', true) as is_vacant,
    fi.id, fi.name, fi.carry_over, fi.daily_proration, fi.rounding, fi.is_required, fi.sort_order,
    coalesce(fic.charged, true) as charged,
    coalesce(fic.amount, case when fi.carry_over then prev.amount else 0 end, 0) as amount,
    bc.confirmed_at, pr.full_name as confirmed_by_name, bc.total_amount,
    bc.billing_note, bc.unit_notice,
    coalesce(bc.confirmed_at is not null and exists (
      select 1 from fee_item_charges x
      where x.unit_id = u.id and x.period = p_period and x.updated_at > bc.confirmed_at
    ), false) as is_dirty
  from u
  cross join fi
  left join occ on occ.unit_id = u.id
  left join room_types rt on rt.id = occ.room_type_id
  left join fee_item_charges fic on fic.unit_id = u.id and fic.fee_item_id = fi.id and fic.period = p_period
  left join fee_item_charges prev on prev.unit_id = u.id and prev.fee_item_id = fi.id
       and prev.period = (p_period - interval '1 month')::date
  left join billing_confirmations bc on bc.unit_id = u.id and bc.period = p_period
  left join profiles pr on pr.user_id = bc.confirmed_by
  order by u.unit_no, fi.sort_order
$$;
revoke execute on function list_billing(bigint, date) from anon;

-- ===== 6개월 이력 (기간별 최신 확정행) =====
create or replace function list_billing_history(p_unit_id bigint, p_period date, p_months int default 6)
returns table(period date, total_amount int, items jsonb, confirmed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (bh.period) bh.period, bh.total_amount, bh.items, bh.confirmed_at
  from billing_history bh
  join units u on u.id = bh.unit_id
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  where bh.unit_id = p_unit_id
    and bh.period <= p_period
    and bh.period > (p_period - (p_months || ' months')::interval)::date
  order by bh.period desc, bh.confirmed_at desc
$$;
revoke execute on function list_billing_history(bigint, date, int) from anon;
```

- [ ] **Step 2: 정합성 확인**

확인: (1) `list_billing`이 타 org building_id면 `b` 비어 `fi` 비어 → 0행(격리), (2) 이월 prefill = `coalesce(fic.amount, carry_over? prev.amount : 0, 0)`, (3) `list_billing_history`가 org join으로 스코프(definer RLS 우회 대비), (4) `round_charge` 매핑.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0012_p5_billing.sql
git commit -m "feat(db): P5 읽기 RPC — round_charge·list_billing(이월 prefill·is_dirty)·list_billing_history"
```

---

### Task 3: 마이그레이션 0012 — 쓰기 RPC (`save_billing_charges`·`confirm_billing`) + verify SQL

**Files:**
- Modify: `supabase/migrations/0012_p5_billing.sql` (append)
- Create: `supabase/verify/p5_checks.sql`

**Interfaces:**
- Produces:
  - `save_billing_charges(bigint, date, jsonb, jsonb) → void` — 초안 upsert(charges·notes).
  - `confirm_billing(bigint, date) → jsonb {unit_count, total}` — 건물 전체 확정+history append+audit.

- [ ] **Step 1: 쓰기 RPC 추가**

```sql
-- ===== 초안 저장 (charges·notes upsert) =====
create or replace function save_billing_charges(
  p_building_id bigint, p_period date, p_charges jsonb, p_notes jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_item jsonb;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('billing') then raise exception 'forbidden: billing required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;
  if p_period <> date_trunc('month', p_period)::date then raise exception 'period must be first of month'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_charges, '[]'::jsonb)) loop
    if not exists (select 1 from units u where u.id = (v_item->>'unit_id')::bigint and u.building_id = p_building_id) then
      raise exception 'unit % not in building', v_item->>'unit_id'; end if;
    insert into fee_item_charges(unit_id, fee_item_id, period, occupancy_id, charged, amount)
      values ((v_item->>'unit_id')::bigint, (v_item->>'fee_item_id')::bigint, p_period,
              nullif(v_item->>'occupancy_id','')::bigint,
              coalesce((v_item->>'charged')::boolean, true),
              coalesce((v_item->>'amount')::int, 0))
      on conflict (unit_id, fee_item_id, period) do update
        set charged = excluded.charged, amount = excluded.amount, occupancy_id = excluded.occupancy_id;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_notes, '[]'::jsonb)) loop
    if not exists (select 1 from units u where u.id = (v_item->>'unit_id')::bigint and u.building_id = p_building_id) then
      raise exception 'unit % not in building', v_item->>'unit_id'; end if;
    insert into billing_confirmations(unit_id, period, billing_note, unit_notice)
      values ((v_item->>'unit_id')::bigint, p_period, v_item->>'billing_note', v_item->>'unit_notice')
      on conflict (unit_id, period) do update
        set billing_note = excluded.billing_note, unit_notice = excluded.unit_notice;
  end loop;
end $$;
revoke execute on function save_billing_charges(bigint, date, jsonb, jsonb) from anon;

-- ===== 부과 확정 (건물 전체, 재확정 가능) =====
create or replace function confirm_billing(p_building_id bigint, p_period date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint; v_unit record; v_item record;
  v_items jsonb; v_total bigint; v_amt int;
  v_days int; v_occupied int; v_count int := 0; v_grand bigint := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('billing') then raise exception 'forbidden: billing required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;

  v_days := extract(day from (p_period + interval '1 month - 1 day'))::int;

  for v_unit in
    select u.id as unit_id, occ.id as occ_id, occ.tenant_name, occ.move_in_date, occ.status
    from units u
    left join lateral (
      select * from occupancies o where o.unit_id = u.id and o.deleted_at is null
      order by o.created_at desc limit 1
    ) occ on true
    where u.building_id = p_building_id and u.deleted_at is null
  loop
    if coalesce(v_unit.status = 'vacant', true) then continue; end if;  -- 공실 제외

    if v_unit.move_in_date is not null
       and v_unit.move_in_date between p_period and (p_period + interval '1 month - 1 day')::date then
      v_occupied := ((p_period + interval '1 month')::date - v_unit.move_in_date);  -- 입주일 포함
    else
      v_occupied := v_days;
    end if;

    v_items := '[]'::jsonb; v_total := 0;
    for v_item in
      select fic.fee_item_id, fi.name, fic.amount, fi.daily_proration, fi.rounding
      from fee_item_charges fic
      join fee_items fi on fi.id = fic.fee_item_id
      where fic.unit_id = v_unit.unit_id and fic.period = p_period and fic.charged = true
    loop
      if v_item.daily_proration and v_occupied < v_days then
        v_amt := round_charge(v_item.amount::numeric * v_occupied / v_days, v_item.rounding);
      else
        v_amt := v_item.amount;
      end if;
      v_items := v_items || jsonb_build_object('fee_item_id', v_item.fee_item_id, 'name', v_item.name, 'charged', true, 'amount', v_amt);
      v_total := v_total + v_amt;
    end loop;

    insert into billing_confirmations(unit_id, period, occupancy_id, total_amount, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_total, now(), auth.uid())
      on conflict (unit_id, period) do update
        set occupancy_id = excluded.occupancy_id, total_amount = excluded.total_amount,
            confirmed_at = excluded.confirmed_at, confirmed_by = excluded.confirmed_by;

    insert into billing_history(unit_id, period, occupancy_id, tenant_name, total_amount, items, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_unit.tenant_name, v_total, v_items, now(), auth.uid());

    v_count := v_count + 1; v_grand := v_grand + v_total;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILLING_CONFIRM', 'billing_confirmations', p_building_id::text,
      jsonb_build_object('period', p_period, 'unit_count', v_count, 'total', v_grand));

  return jsonb_build_object('unit_count', v_count, 'total', v_grand);
end $$;
revoke execute on function confirm_billing(bigint, date) from anon;
```

- [ ] **Step 2: verify SQL 작성**

```sql
-- supabase/verify/p5_checks.sql — P5 검증 (사용자 PC psql). 실패 시 raise.
do $$ begin
  if (select count(*) from information_schema.tables
      where table_name in ('fee_item_charges','billing_confirmations','billing_history')) <> 3
    then raise exception 'P5 tables missing'; end if;
end $$;
do $$ begin
  perform 1 from pg_policies where tablename='fee_item_charges' and policyname='fic_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'fic_write must gate by billing module'; end if;
  perform 1 from pg_policies where tablename='billing_confirmations' and policyname='bc_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'bc_write must gate by billing module'; end if;
  perform 1 from pg_policies where tablename='billing_history' and cmd <> 'SELECT';
  if found then raise exception 'billing_history must have SELECT-only policies (RPC-only writes)'; end if;
  if (select count(*) from pg_proc where proname in
      ('round_charge','list_billing','list_billing_history','save_billing_charges','confirm_billing')) <> 5
    then raise exception 'P5 RPC missing'; end if;
end $$;
-- 수동 점검(사용자 PC):
--  1) billing 미보유 구성원: fee_item_charges INSERT 거부 / SELECT 가능.
--  2) save_billing_charges → confirm_billing 후 billing_history 1행·billing_confirmations.confirmed_at 세팅.
--  3) 재확정 시 confirmations UPDATE + history 추가 append(2행).
--  4) 중간입주(daily_proration) 세대 일할 반영 total 확인.
--  5) 타 org building_id → 'building not in org'.
--  6) 공실 세대 confirm 제외.
```

- [ ] **Step 3: 정적 확인 + 커밋**

Run: `npx tsc --noEmit`
Expected: PASS (SQL 변경은 tsc 무관, 리포지토리 컴파일 정상 확인용)

```bash
git add supabase/migrations/0012_p5_billing.sql supabase/verify/p5_checks.sql
git commit -m "feat(db): P5 쓰기 RPC(save_billing_charges·confirm_billing)+감사 + p5_checks 검증"
```

---

### Task 4: `lib/billing/period.ts` — 월(period) 유틸

**Files:**
- Create: `lib/billing/period.ts`
- Test: `lib/billing/period.test.ts`

**Interfaces:**
- Produces: `currentPeriod(now?)→'YYYY-MM-01'` · `toMonthInput(period)→'YYYY-MM'` · `fromMonthInput(ym)→'YYYY-MM-01'` · `prevPeriod(period)→'YYYY-MM-01'` · `isFuturePeriod(period, now?)→boolean`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// lib/billing/period.test.ts
import { describe, it, expect } from "vitest";
import { currentPeriod, toMonthInput, fromMonthInput, prevPeriod, isFuturePeriod } from "./period";

describe("billing/period", () => {
  it("currentPeriod: 해당월 1일", () => {
    expect(currentPeriod(new Date(2026, 7, 13))).toBe("2026-08-01"); // month는 0-based(7=8월)
  });
  it("toMonthInput / fromMonthInput 왕복", () => {
    expect(toMonthInput("2026-08-01")).toBe("2026-08");
    expect(fromMonthInput("2026-08")).toBe("2026-08-01");
  });
  it("prevPeriod: 1월 전월은 전년 12월", () => {
    expect(prevPeriod("2026-01-01")).toBe("2025-12-01");
    expect(prevPeriod("2026-08-01")).toBe("2026-07-01");
  });
  it("isFuturePeriod: 다음달은 미래", () => {
    const now = new Date(2026, 7, 13);
    expect(isFuturePeriod("2026-09-01", now)).toBe(true);
    expect(isFuturePeriod("2026-08-01", now)).toBe(false);
    expect(isFuturePeriod("2026-07-01", now)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/billing/period.test.ts`
Expected: FAIL ("Cannot find module './period'")

- [ ] **Step 3: 구현**

```ts
// lib/billing/period.ts
export type Period = string; // 'YYYY-MM-01'

const pad = (n: number) => String(n).padStart(2, "0");

export function currentPeriod(now: Date = new Date()): Period {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
}
export function toMonthInput(period: Period): string {
  return period.slice(0, 7);
}
export function fromMonthInput(ym: string): Period {
  return `${ym}-01`;
}
export function prevPeriod(period: Period): Period {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 2, 1); // m-2: 0-based 전월
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}
export function isFuturePeriod(period: Period, now: Date = new Date()): boolean {
  return period > currentPeriod(now);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/billing/period.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/billing/period.ts lib/billing/period.test.ts
git commit -m "feat(billing): period 유틸(현재월·YYYY-MM 변환·전월·미래판정)"
```

---

### Task 5: `lib/billing/proration.ts` — 일할계산·우수리

**Files:**
- Create: `lib/billing/proration.ts`
- Test: `lib/billing/proration.test.ts`

**Interfaces:**
- Consumes: `Period`(from period.ts, 단 문자열이므로 직접 의존 없음).
- Produces:
  - `type Rounding = "up"|"round"|"down"|"raw"`
  - `roundCharge(value:number, r:Rounding)→number` (SQL `round_charge`와 일치)
  - `daysInMonth(period:string)→number`
  - `occupiedDays(moveInDate:string|null, period:string)→number` (중간입주 아니면 그 달 전체 일수)
  - `effectiveAmount(base:number, meta:{dailyProration:boolean;rounding:Rounding}, moveInDate:string|null, period:string)→number`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// lib/billing/proration.test.ts
import { describe, it, expect } from "vitest";
import { roundCharge, daysInMonth, occupiedDays, effectiveAmount } from "./proration";

describe("billing/proration", () => {
  it("roundCharge: up/round/down/raw", () => {
    expect(roundCharge(100.4, "up")).toBe(101);
    expect(roundCharge(100.4, "round")).toBe(100);
    expect(roundCharge(100.6, "round")).toBe(101);
    expect(roundCharge(100.9, "down")).toBe(100);
    expect(roundCharge(100.6, "raw")).toBe(101); // raw = 반올림
  });
  it("daysInMonth", () => {
    expect(daysInMonth("2026-02-01")).toBe(28);
    expect(daysInMonth("2026-08-01")).toBe(31);
  });
  it("occupiedDays: 중간입주는 입주일 포함, 아니면 월 전체", () => {
    expect(occupiedDays("2026-08-16", "2026-08-01")).toBe(16); // 16~31 = 16일
    expect(occupiedDays("2026-07-20", "2026-08-01")).toBe(31); // 전월 입주 → 전체
    expect(occupiedDays(null, "2026-08-01")).toBe(31);
  });
  it("effectiveAmount: 비일할 항목은 원액", () => {
    expect(effectiveAmount(30000, { dailyProration: false, rounding: "round" }, "2026-08-16", "2026-08-01")).toBe(30000);
  });
  it("effectiveAmount: 일할+중간입주 → 프로레이션", () => {
    // 31000 * 16/31 = 16000
    expect(effectiveAmount(31000, { dailyProration: true, rounding: "round" }, "2026-08-16", "2026-08-01")).toBe(16000);
  });
  it("effectiveAmount: 일할이지만 그 달 전체 거주 → 원액", () => {
    expect(effectiveAmount(31000, { dailyProration: true, rounding: "round" }, "2026-07-01", "2026-08-01")).toBe(31000);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/billing/proration.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```ts
// lib/billing/proration.ts
export type Rounding = "up" | "round" | "down" | "raw";

export function roundCharge(value: number, r: Rounding): number {
  if (r === "up") return Math.ceil(value);
  if (r === "down") return Math.floor(value);
  return Math.round(value); // round, raw
}

export function daysInMonth(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m, 0).getDate(); // m(1-based)월의 0일 = 그 달 말일
}

export function occupiedDays(moveInDate: string | null, period: string): number {
  const total = daysInMonth(period);
  if (!moveInDate) return total;
  const monthStart = period.slice(0, 7); // 'YYYY-MM'
  if (moveInDate.slice(0, 7) !== monthStart) return total; // 중간입주 아님
  const day = Number(moveInDate.slice(8, 10));
  return total - day + 1; // 입주일 포함
}

export function effectiveAmount(
  base: number,
  meta: { dailyProration: boolean; rounding: Rounding },
  moveInDate: string | null,
  period: string,
): number {
  if (!meta.dailyProration) return base;
  const total = daysInMonth(period);
  const occ = occupiedDays(moveInDate, period);
  if (occ >= total) return base;
  return roundCharge((base * occ) / total, meta.rounding);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/billing/proration.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/billing/proration.ts lib/billing/proration.test.ts
git commit -m "feat(billing): 일할계산·우수리(effectiveAmount) — SQL round_charge와 매핑 일치"
```

---

### Task 6: `lib/billing/total.ts` — 세대 합계

**Files:**
- Create: `lib/billing/total.ts`
- Test: `lib/billing/total.test.ts`

**Interfaces:**
- Consumes: `effectiveAmount`, `Rounding`(proration.ts).
- Produces: `interface ChargeLine { charged:boolean; amount:number; dailyProration:boolean; rounding:Rounding }` · `unitTotal(lines:ChargeLine[], moveInDate:string|null, period:string)→number`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// lib/billing/total.test.ts
import { describe, it, expect } from "vitest";
import { unitTotal, type ChargeLine } from "./total";

const line = (o: Partial<ChargeLine>): ChargeLine =>
  ({ charged: true, amount: 0, dailyProration: false, rounding: "round", ...o });

describe("billing/total", () => {
  it("charged=false 항목 제외", () => {
    const lines = [line({ amount: 10000 }), line({ amount: 5000, charged: false })];
    expect(unitTotal(lines, null, "2026-08-01")).toBe(10000);
  });
  it("일할 항목은 프로레이션 후 합산", () => {
    const lines = [
      line({ amount: 31000, dailyProration: true }), // 16/31 → 16000
      line({ amount: 10000 }),                         // 고정
    ];
    expect(unitTotal(lines, "2026-08-16", "2026-08-01")).toBe(26000);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/billing/total.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```ts
// lib/billing/total.ts
import { effectiveAmount, type Rounding } from "./proration";

export interface ChargeLine {
  charged: boolean;
  amount: number;
  dailyProration: boolean;
  rounding: Rounding;
}

export function unitTotal(lines: ChargeLine[], moveInDate: string | null, period: string): number {
  return lines.reduce((sum, l) => {
    if (!l.charged) return sum;
    return sum + effectiveAmount(l.amount, { dailyProration: l.dailyProration, rounding: l.rounding }, moveInDate, period);
  }, 0);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/billing/total.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/billing/total.ts lib/billing/total.test.ts
git commit -m "feat(billing): 세대 합계 unitTotal(charged 필터+일할 반영)"
```

---

### Task 7: `lib/billing/pivot.ts` — flat rows → 그리드 + 공유 타입

**Files:**
- Create: `lib/billing/pivot.ts`
- Test: `lib/billing/pivot.test.ts`

**Interfaces:**
- Produces:
  - `interface BillingFlatRow` — `list_billing` 매퍼(Task 8)가 반환하는 camelCase 행.
  - `interface BillingColumn { feeItemId:number; name:string; carryOver:boolean; dailyProration:boolean; rounding:Rounding; isRequired:boolean; sortOrder:number }`
  - `interface BillingUnitRow { unitId; unitNo; dong; roomTypeLabel; occupancyId; tenantName; moveInDate; isVacant; confirmedAt; confirmedByName; totalAmount; billingNote; unitNotice; isDirty; charges: Record<number,{charged:boolean;amount:number}> }`
  - `pivotBillingRows(rows:BillingFlatRow[])→{ units:BillingUnitRow[]; columns:BillingColumn[] }`
- Consumes: `Rounding`(proration.ts). Task 8 `apis.ts`가 `BillingFlatRow` 타입을 import.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// lib/billing/pivot.test.ts
import { describe, it, expect } from "vitest";
import { pivotBillingRows, type BillingFlatRow } from "./pivot";

const base: Omit<BillingFlatRow, "feeItemId" | "feeItemName" | "sortOrder" | "charged" | "amount"> = {
  unitId: 1, unitNo: "101", dong: null, roomTypeLabel: "원룸",
  occupancyId: 5, tenantName: "홍길동", moveInDate: "2026-08-01", isVacant: false,
  carryOver: false, dailyProration: false, rounding: "round", isRequired: true,
  confirmedAt: null, confirmedByName: null, totalAmount: null, billingNote: null, unitNotice: null, isDirty: false,
};

describe("billing/pivot", () => {
  it("항목을 컬럼으로, 세대를 행으로 피벗", () => {
    const rows: BillingFlatRow[] = [
      { ...base, feeItemId: 10, feeItemName: "관리비", sortOrder: 0, charged: true, amount: 30000 },
      { ...base, feeItemId: 11, feeItemName: "수도", sortOrder: 1, charged: true, amount: 5000 },
    ];
    const { units, columns } = pivotBillingRows(rows);
    expect(columns.map((c) => c.name)).toEqual(["관리비", "수도"]);
    expect(units).toHaveLength(1);
    expect(units[0].charges[10]).toEqual({ charged: true, amount: 30000 });
    expect(units[0].charges[11]).toEqual({ charged: true, amount: 5000 });
  });
  it("컬럼은 sortOrder로 유일·정렬, 세대는 unitNo 순", () => {
    const rows: BillingFlatRow[] = [
      { ...base, unitId: 2, unitNo: "102", feeItemId: 11, feeItemName: "수도", sortOrder: 1, charged: true, amount: 1 },
      { ...base, unitId: 1, unitNo: "101", feeItemId: 10, feeItemName: "관리비", sortOrder: 0, charged: true, amount: 2 },
      { ...base, unitId: 1, unitNo: "101", feeItemId: 11, feeItemName: "수도", sortOrder: 1, charged: true, amount: 3 },
      { ...base, unitId: 2, unitNo: "102", feeItemId: 10, feeItemName: "관리비", sortOrder: 0, charged: true, amount: 4 },
    ];
    const { units, columns } = pivotBillingRows(rows);
    expect(columns.map((c) => c.feeItemId)).toEqual([10, 11]);
    expect(units.map((u) => u.unitNo)).toEqual(["101", "102"]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/billing/pivot.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```ts
// lib/billing/pivot.ts
import type { Rounding } from "./proration";

export interface BillingFlatRow {
  unitId: number; unitNo: string; dong: string | null; roomTypeLabel: string | null;
  occupancyId: number | null; tenantName: string | null; moveInDate: string | null; isVacant: boolean;
  feeItemId: number; feeItemName: string; carryOver: boolean; dailyProration: boolean;
  rounding: Rounding; isRequired: boolean; sortOrder: number;
  charged: boolean; amount: number;
  confirmedAt: string | null; confirmedByName: string | null; totalAmount: number | null;
  billingNote: string | null; unitNotice: string | null; isDirty: boolean;
}

export interface BillingColumn {
  feeItemId: number; name: string; carryOver: boolean; dailyProration: boolean;
  rounding: Rounding; isRequired: boolean; sortOrder: number;
}

export interface BillingUnitRow {
  unitId: number; unitNo: string; dong: string | null; roomTypeLabel: string | null;
  occupancyId: number | null; tenantName: string | null; moveInDate: string | null; isVacant: boolean;
  confirmedAt: string | null; confirmedByName: string | null; totalAmount: number | null;
  billingNote: string | null; unitNotice: string | null; isDirty: boolean;
  charges: Record<number, { charged: boolean; amount: number }>;
}

export function pivotBillingRows(rows: BillingFlatRow[]): { units: BillingUnitRow[]; columns: BillingColumn[] } {
  const colMap = new Map<number, BillingColumn>();
  const unitMap = new Map<number, BillingUnitRow>();

  for (const r of rows) {
    if (!colMap.has(r.feeItemId)) {
      colMap.set(r.feeItemId, {
        feeItemId: r.feeItemId, name: r.feeItemName, carryOver: r.carryOver,
        dailyProration: r.dailyProration, rounding: r.rounding, isRequired: r.isRequired, sortOrder: r.sortOrder,
      });
    }
    if (!unitMap.has(r.unitId)) {
      unitMap.set(r.unitId, {
        unitId: r.unitId, unitNo: r.unitNo, dong: r.dong, roomTypeLabel: r.roomTypeLabel,
        occupancyId: r.occupancyId, tenantName: r.tenantName, moveInDate: r.moveInDate, isVacant: r.isVacant,
        confirmedAt: r.confirmedAt, confirmedByName: r.confirmedByName, totalAmount: r.totalAmount,
        billingNote: r.billingNote, unitNotice: r.unitNotice, isDirty: r.isDirty, charges: {},
      });
    }
    unitMap.get(r.unitId)!.charges[r.feeItemId] = { charged: r.charged, amount: r.amount };
  }

  const columns = [...colMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  const units = [...unitMap.values()].sort((a, b) => a.unitNo.localeCompare(b.unitNo, "ko", { numeric: true }));
  return { units, columns };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/billing/pivot.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/billing/pivot.ts lib/billing/pivot.test.ts
git commit -m "feat(billing): flat→그리드 pivotBillingRows + 공유 타입(BillingFlatRow/Column/UnitRow)"
```

---

### Task 8: `hooks/reactquery/billing` 도메인

**Files:**
- Create: `hooks/reactquery/billing/apis.ts`, `keys.ts`, `queries.ts`, `mutations.ts`, `index.ts`
- Test: `hooks/reactquery/billing/apis.test.ts`

**Interfaces:**
- Consumes: `BillingFlatRow`(lib/billing/pivot).
- Produces:
  - `listBilling(buildingId, period)→Promise<BillingFlatRow[]>`
  - `listBillingHistory(unitId, period, months=6)→Promise<BillingHistoryEntry[]>` (`BillingHistoryEntry{period;totalAmount;items:{feeItemId;name;charged;amount}[];confirmedAt}`)
  - `saveBillingCharges(p:SaveBillingChargesPayload)→Promise<void>` (`{buildingId;period;charges:{unitId;feeItemId;charged;amount;occupancyId?}[];notes:{unitId;billingNote;unitNotice}[]}`)
  - `confirmBilling(buildingId, period)→Promise<{unitCount;total}>`
  - `billingKeys{ all; list(buildingId,period); history(unitId,period) }`
  - hooks: `useBilling(buildingId, period)` · `useBillingHistory(unitId, period, months?)` · `useSaveBillingCharges()` · `useConfirmBilling()`

- [ ] **Step 1: 실패 테스트 작성 (apis 매핑)**

```ts
// hooks/reactquery/billing/apis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
import { listBilling, listBillingHistory, saveBillingCharges, confirmBilling } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("billing apis", () => {
  it("listBilling: list_billing 호출, snake→camel 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      unit_id: 1, unit_no: "101", dong: null, room_type_label: "원룸",
      occupancy_id: 5, tenant_name: "홍", move_in_date: "2026-08-01", is_vacant: false,
      fee_item_id: 10, fee_item_name: "관리비", carry_over: false, daily_proration: false,
      rounding: "round", is_required: true, sort_order: 0, charged: true, amount: 30000,
      confirmed_at: null, confirmed_by_name: null, total_amount: null,
      billing_note: null, unit_notice: null, is_dirty: false,
    }], error: null });
    const r = await listBilling(7, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_billing", { p_building_id: 7, p_period: "2026-08-01" });
    expect(r[0]).toMatchObject({ unitId: 1, feeItemId: 10, feeItemName: "관리비", amount: 30000, isVacant: false });
  });
  it("saveBillingCharges: charges/notes를 snake로 전송", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await saveBillingCharges({
      buildingId: 7, period: "2026-08-01",
      charges: [{ unitId: 1, feeItemId: 10, charged: true, amount: 30000, occupancyId: 5 }],
      notes: [{ unitId: 1, billingNote: "메모", unitNotice: null }],
    });
    expect(rpc).toHaveBeenCalledWith("save_billing_charges", expect.objectContaining({
      p_building_id: 7, p_period: "2026-08-01",
      p_charges: [{ unit_id: 1, fee_item_id: 10, charged: true, amount: 30000, occupancy_id: 5 }],
      p_notes: [{ unit_id: 1, billing_note: "메모", unit_notice: null }],
    }));
  });
  it("confirmBilling: 결과 매핑", async () => {
    rpc.mockResolvedValue({ data: { unit_count: 3, total: 90000 }, error: null });
    const r = await confirmBilling(7, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("confirm_billing", { p_building_id: 7, p_period: "2026-08-01" });
    expect(r).toEqual({ unitCount: 3, total: 90000 });
  });
  it("listBillingHistory: months 기본 6, items 매핑", async () => {
    rpc.mockResolvedValue({ data: [{ period: "2026-08-01", total_amount: 90000,
      items: [{ fee_item_id: 10, name: "관리비", charged: true, amount: 30000 }], confirmed_at: "2026-08-13T00:00:00Z" }], error: null });
    const r = await listBillingHistory(1, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_billing_history", { p_unit_id: 1, p_period: "2026-08-01", p_months: 6 });
    expect(r[0]).toMatchObject({ period: "2026-08-01", totalAmount: 90000, items: [{ feeItemId: 10, name: "관리비", charged: true, amount: 30000 }] });
  });
  it("에러 시 throw", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listBilling(7, "2026-08-01")).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run hooks/reactquery/billing/apis.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: apis.ts 구현**

```ts
// hooks/reactquery/billing/apis.ts
import { createClient } from "@/lib/supabase/client";
import type { BillingFlatRow } from "@/lib/billing/pivot";

type BillingFlatDbRow = {
  unit_id: number; unit_no: string; dong: string | null; room_type_label: string | null;
  occupancy_id: number | null; tenant_name: string | null; move_in_date: string | null; is_vacant: boolean;
  fee_item_id: number; fee_item_name: string; carry_over: boolean; daily_proration: boolean;
  rounding: string; is_required: boolean; sort_order: number;
  charged: boolean; amount: number;
  confirmed_at: string | null; confirmed_by_name: string | null; total_amount: number | null;
  billing_note: string | null; unit_notice: string | null; is_dirty: boolean;
};

const rowToFlat = (r: BillingFlatDbRow): BillingFlatRow => ({
  unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong, roomTypeLabel: r.room_type_label,
  occupancyId: r.occupancy_id, tenantName: r.tenant_name, moveInDate: r.move_in_date, isVacant: r.is_vacant,
  feeItemId: r.fee_item_id, feeItemName: r.fee_item_name, carryOver: r.carry_over, dailyProration: r.daily_proration,
  rounding: r.rounding as BillingFlatRow["rounding"], isRequired: r.is_required, sortOrder: r.sort_order,
  charged: r.charged, amount: r.amount,
  confirmedAt: r.confirmed_at, confirmedByName: r.confirmed_by_name, totalAmount: r.total_amount,
  billingNote: r.billing_note, unitNotice: r.unit_notice, isDirty: r.is_dirty,
});

export interface BillingHistoryItem { feeItemId: number; name: string; charged: boolean; amount: number; }
export interface BillingHistoryEntry { period: string; totalAmount: number; items: BillingHistoryItem[]; confirmedAt: string; }

type HistoryDbItem = { fee_item_id: number; name: string; charged: boolean; amount: number };
type HistoryDbRow = { period: string; total_amount: number; items: HistoryDbItem[] | null; confirmed_at: string };

const rowToHistory = (r: HistoryDbRow): BillingHistoryEntry => ({
  period: r.period, totalAmount: r.total_amount, confirmedAt: r.confirmed_at,
  items: (r.items ?? []).map((i) => ({ feeItemId: i.fee_item_id, name: i.name, charged: i.charged, amount: i.amount })),
});

export async function listBilling(buildingId: number, period: string): Promise<BillingFlatRow[]> {
  const { data, error } = await createClient().rpc("list_billing", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as BillingFlatDbRow[]).map(rowToFlat);
}

export async function listBillingHistory(unitId: number, period: string, months = 6): Promise<BillingHistoryEntry[]> {
  const { data, error } = await createClient().rpc("list_billing_history", { p_unit_id: unitId, p_period: period, p_months: months });
  if (error) throw new Error(error.message);
  return ((data ?? []) as HistoryDbRow[]).map(rowToHistory);
}

export interface SaveBillingChargesPayload {
  buildingId: number; period: string;
  charges: { unitId: number; feeItemId: number; charged: boolean; amount: number; occupancyId?: number | null }[];
  notes: { unitId: number; billingNote: string | null; unitNotice: string | null }[];
}

export async function saveBillingCharges(p: SaveBillingChargesPayload): Promise<void> {
  const { error } = await createClient().rpc("save_billing_charges", {
    p_building_id: p.buildingId,
    p_period: p.period,
    p_charges: p.charges.map((c) => ({
      unit_id: c.unitId, fee_item_id: c.feeItemId, charged: c.charged, amount: c.amount, occupancy_id: c.occupancyId ?? null,
    })),
    p_notes: p.notes.map((n) => ({ unit_id: n.unitId, billing_note: n.billingNote, unit_notice: n.unitNotice })),
  });
  if (error) throw new Error(error.message);
}

export interface ConfirmBillingResult { unitCount: number; total: number; }

export async function confirmBilling(buildingId: number, period: string): Promise<ConfirmBillingResult> {
  const { data, error } = await createClient().rpc("confirm_billing", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  const r = data as { unit_count: number; total: number };
  return { unitCount: r.unit_count, total: r.total };
}
```

- [ ] **Step 4: keys/queries/mutations/index 작성**

```ts
// hooks/reactquery/billing/keys.ts
export const billingKeys = {
  all: ["billing"] as const,
  list: (buildingId: number, period: string) => ["billing", "list", buildingId, period] as const,
  history: (unitId: number, period: string) => ["billing", "history", unitId, period] as const,
};
```

```ts
// hooks/reactquery/billing/queries.ts
import { useQuery } from "@tanstack/react-query";
import { listBilling, listBillingHistory } from "./apis";
import { billingKeys } from "./keys";

export function useBilling(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: billingKeys.list(buildingId ?? 0, period),
    queryFn: () => listBilling(buildingId as number, period),
    enabled: !!buildingId,
  });
}
export function useBillingHistory(unitId: number | null, period: string, months = 6) {
  return useQuery({
    queryKey: billingKeys.history(unitId ?? 0, period),
    queryFn: () => listBillingHistory(unitId as number, period, months),
    enabled: !!unitId,
  });
}
```

```ts
// hooks/reactquery/billing/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveBillingCharges, confirmBilling, type SaveBillingChargesPayload } from "./apis";
import { billingKeys } from "./keys";

export function useSaveBillingCharges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SaveBillingChargesPayload) => saveBillingCharges(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
export function useConfirmBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ buildingId, period }: { buildingId: number; period: string }) => confirmBilling(buildingId, period),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
```

```ts
// hooks/reactquery/billing/index.ts
export * from "./apis";
export * from "./keys";
export * from "./queries";
export * from "./mutations";
```

- [ ] **Step 5: 통과 + 타입 확인**

Run: `npx vitest run hooks/reactquery/billing/apis.test.ts`
Expected: PASS (5 tests)

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add hooks/reactquery/billing
git commit -m "feat(billing): reactquery 도메인(list/history/save/confirm) + apis 테스트"
```

---

## Group 2 — 테이블 · 저장

### Task 9: `BillingTable` 컴포넌트

**Files:**
- Create: `app/(staff)/staff/management-fee/components/BillingTable.tsx`
- Test: `app/(staff)/staff/management-fee/components/BillingTable.test.tsx`

**Interfaces:**
- Consumes: `BillingUnitRow`, `BillingColumn`(lib/billing/pivot), `unitTotal`(lib/billing/total).
- Produces (props):
```ts
interface BillingTableProps {
  units: BillingUnitRow[];
  columns: BillingColumn[];
  period: string;
  onChargeChange: (unitId: number, feeItemId: number, patch: { charged?: boolean; amount?: number }) => void;
  onRowClick: (unitId: number) => void;   // 6개월 이력
  onNoteClick: (unitId: number) => void;  // 세대 메모
}
```
- 동작: 고정열(호실/룸타입/입주일/**합계**) + 항목별 [부과 체크박스]+[금액 input]. 합계=`unitTotal`(charged·일할 반영). 공실 행 입력 disabled·합계 0·"공실" 표기. 중간입주(move_in_date가 period 월) 행 강조 + 항목이 일할이면 뱃지. 확정 배지(`confirmedAt`) + `isDirty`면 "재확정 필요".

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// app/(staff)/staff/management-fee/components/BillingTable.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BillingTable } from "./BillingTable";
import type { BillingUnitRow, BillingColumn } from "@/lib/billing/pivot";

const columns: BillingColumn[] = [
  { feeItemId: 10, name: "관리비", carryOver: true, dailyProration: false, rounding: "round", isRequired: true, sortOrder: 0 },
  { feeItemId: 11, name: "수도", carryOver: false, dailyProration: true, rounding: "round", isRequired: false, sortOrder: 1 },
];
const unit = (o: Partial<BillingUnitRow> = {}): BillingUnitRow => ({
  unitId: 1, unitNo: "101", dong: null, roomTypeLabel: "원룸", occupancyId: 5, tenantName: "홍길동",
  moveInDate: "2026-08-01", isVacant: false, confirmedAt: null, confirmedByName: null, totalAmount: null,
  billingNote: null, unitNotice: null, isDirty: false,
  charges: { 10: { charged: true, amount: 30000 }, 11: { charged: true, amount: 5000 } }, ...o,
});

describe("BillingTable", () => {
  it("항목 컬럼과 세대 행을 렌더", () => {
    render(<BillingTable units={[unit()]} columns={columns} period="2026-08-01"
      onChargeChange={vi.fn()} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    expect(screen.getByText("관리비")).toBeInTheDocument();
    expect(screen.getByText("수도")).toBeInTheDocument();
    expect(screen.getByText("101")).toBeInTheDocument();
  });
  it("합계=charged 금액 합(비일할, 당월 전체 거주)", () => {
    render(<BillingTable units={[unit({ moveInDate: "2026-07-01" })]} columns={columns} period="2026-08-01"
      onChargeChange={vi.fn()} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    expect(screen.getByText("35,000")).toBeInTheDocument(); // 30000+5000
  });
  it("금액 입력 시 onChargeChange 호출", () => {
    const onChargeChange = vi.fn();
    render(<BillingTable units={[unit()]} columns={columns} period="2026-08-01"
      onChargeChange={onChargeChange} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    const input = screen.getByLabelText("101 관리비 금액");
    fireEvent.change(input, { target: { value: "40000" } });
    expect(onChargeChange).toHaveBeenCalledWith(1, 10, { amount: 40000 });
  });
  it("부과 체크 해제 시 onChargeChange(charged:false)", () => {
    const onChargeChange = vi.fn();
    render(<BillingTable units={[unit()]} columns={columns} period="2026-08-01"
      onChargeChange={onChargeChange} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("101 관리비 부과"));
    expect(onChargeChange).toHaveBeenCalledWith(1, 10, { charged: false });
  });
  it("공실 세대는 입력 비활성·합계 0", () => {
    render(<BillingTable units={[unit({ isVacant: true, tenantName: null })]} columns={columns} period="2026-08-01"
      onChargeChange={vi.fn()} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    expect(screen.getByLabelText("101 관리비 금액")).toBeDisabled();
    expect(screen.getByText("공실")).toBeInTheDocument();
  });
  it("확정 세대는 확정 배지, is_dirty면 재확정 필요", () => {
    render(<BillingTable units={[unit({ confirmedAt: "2026-08-13T00:00:00Z", isDirty: true })]} columns={columns} period="2026-08-01"
      onChargeChange={vi.fn()} onRowClick={vi.fn()} onNoteClick={vi.fn()} />);
    expect(screen.getByText("재확정 필요")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run app/(staff)/staff/management-fee/components/BillingTable.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/management-fee/components/BillingTable.tsx
"use client";
import React from "react";
import type { BillingUnitRow, BillingColumn } from "@/lib/billing/pivot";
import { unitTotal, type ChargeLine } from "@/lib/billing/total";

interface BillingTableProps {
  units: BillingUnitRow[];
  columns: BillingColumn[];
  period: string;
  onChargeChange: (unitId: number, feeItemId: number, patch: { charged?: boolean; amount?: number }) => void;
  onRowClick: (unitId: number) => void;
  onNoteClick: (unitId: number) => void;
}

const won = (n: number) => n.toLocaleString("ko-KR");

function isMidMoveIn(moveInDate: string | null, period: string): boolean {
  return !!moveInDate && moveInDate.slice(0, 7) === period.slice(0, 7);
}

function rowTotal(u: BillingUnitRow, columns: BillingColumn[], period: string): number {
  if (u.isVacant) return 0;
  const lines: ChargeLine[] = columns.map((c) => {
    const cell = u.charges[c.feeItemId] ?? { charged: true, amount: 0 };
    return { charged: cell.charged, amount: cell.amount, dailyProration: c.dailyProration, rounding: c.rounding };
  });
  return unitTotal(lines, u.moveInDate, period);
}

export function BillingTable({ units, columns, period, onChargeChange, onRowClick, onNoteClick }: BillingTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line2 bg-surface2 text-left text-xs font-bold text-t2">
            <th className="px-3 py-2">호실</th>
            <th className="px-3 py-2">룸타입</th>
            <th className="px-3 py-2">입주일</th>
            <th className="px-3 py-2 text-right">합계</th>
            {columns.map((c) => (
              <th key={c.feeItemId} className="px-3 py-2">
                {c.name}
                {c.dailyProration && <span className="ml-1 rounded bg-blue-t px-1 text-[10px] text-blue-d">일할</span>}
              </th>
            ))}
            <th className="px-3 py-2">메모</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const mid = isMidMoveIn(u.moveInDate, period);
            return (
              <tr key={u.unitId}
                className={`border-b border-line2 ${mid ? "bg-blue-t/40" : ""} ${u.isVacant ? "text-t3" : ""}`}>
                <td className="cursor-pointer px-3 py-2 font-semibold text-blue-d" onClick={() => onRowClick(u.unitId)}>
                  {u.unitNo}
                </td>
                <td className="px-3 py-2">{u.roomTypeLabel ?? "-"}</td>
                <td className="px-3 py-2">
                  {u.isVacant ? <span className="font-semibold">공실</span> : (u.moveInDate ?? "-")}
                  {u.confirmedAt && !u.isDirty && <span className="ml-1 rounded bg-green-t px-1 text-[10px] text-green-d">확정</span>}
                  {u.confirmedAt && u.isDirty && <span className="ml-1 rounded bg-amber-t px-1 text-[10px] text-amber-700">재확정 필요</span>}
                </td>
                <td className="px-3 py-2 text-right font-extrabold text-t1">{won(rowTotal(u, columns, period))}</td>
                {columns.map((c) => {
                  const cell = u.charges[c.feeItemId] ?? { charged: true, amount: 0 };
                  return (
                    <td key={c.feeItemId} className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input type="checkbox" aria-label={`${u.unitNo} ${c.name} 부과`} checked={cell.charged} disabled={u.isVacant}
                          onChange={(e) => onChargeChange(u.unitId, c.feeItemId, { charged: e.target.checked })} />
                        <input type="number" aria-label={`${u.unitNo} ${c.name} 금액`} value={String(cell.amount)}
                          disabled={u.isVacant || !cell.charged}
                          onChange={(e) => onChargeChange(u.unitId, c.feeItemId, { amount: Number(e.target.value) || 0 })}
                          className="h-8 w-24 rounded border border-line px-2 text-right disabled:bg-surface2" />
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <button type="button" aria-label={`${u.unitNo} 메모`} onClick={() => onNoteClick(u.unitId)}
                    className="rounded border border-line px-2 py-1 text-xs text-t2 hover:bg-surface2" disabled={u.isVacant}>
                    메모{(u.billingNote || u.unitNotice) ? " ●" : ""}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

> Tailwind 토큰(`bg-surface2`, `text-t2`, `bg-green-t`, `text-green-d`, `bg-amber-t` 등)은 `app/globals.css`에 정의된 값을 사용. 없는 토큰은 utilities/UtilityTable·buildings 컴포넌트에서 실제 존재하는 유사 토큰으로 대체(구현 시 grep 확인).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run app/(staff)/staff/management-fee/components/BillingTable.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add "app/(staff)/staff/management-fee/components/BillingTable.tsx" "app/(staff)/staff/management-fee/components/BillingTable.test.tsx"
git commit -m "feat(billing): BillingTable(부과 그리드·합계·공실·일할 강조·확정 배지)"
```

---

### Task 10: `page.tsx` 재구성 + `ItemManageModal` + 초안 저장

**Files:**
- Create: `app/(staff)/staff/management-fee/components/ItemManageModal.tsx`
- Modify(재작성): `app/(staff)/staff/management-fee/page.tsx`
- Modify(재작성): `app/(staff)/staff/management-fee/page.test.tsx`

**Interfaces:**
- Consumes: `useMe`, `useBuildings`(Building[] with typeId), `useBuildingTypes`, `useBilling`, `useSaveBillingCharges`, `useConfirmBilling`(Task 11에서 확정 배선), `pivotBillingRows`, `BillingTable`, `hasModule`, fee item hooks(항목관리).
- Produces: 재구성된 `/management-fee` 화면.
- 상단: 건물 Select · `<input type="month">`(기본 당월, max=당월) · [항목관리] · [저장]. 권한 게이트 `hasModule(me,"billing")`.
- draft 상태: `charges: Record<`${unitId}:${feeItemId}`,{charged,amount}>` 오버레이 + `notes: Record<unitId,{billingNote,unitNotice}>`. 그리드엔 서버값에 draft 오버레이 적용해 전달. [저장] 시 draft가 있는 항목만 payload로 전송 후 draft 초기화.

- [ ] **Step 1: 실패 테스트 작성 (page)**

```tsx
// app/(staff)/staff/management-fee/page.test.tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/buildingTypes", () => ({
  useBuildingTypes: vi.fn(() => ({ data: [{ id: 1, orgId: 10, label: "원룸텔", sortOrder: 0 }] })),
  useCreateBuildingType: vi.fn(), useRenameBuildingType: vi.fn(), useDeleteBuildingType: vi.fn(),
}));
vi.mock("@/hooks/reactquery/feeItems", () => ({
  useFeeItems: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateFeeItem: vi.fn(() => mut), useUpdateFeeItem: vi.fn(() => mut),
  useDeleteFeeItem: vi.fn(() => mut), useReorderFeeItems: vi.fn(() => mut),
}));
vi.mock("@/hooks/reactquery/billing", () => ({
  useBilling: vi.fn(), useSaveBillingCharges: vi.fn(() => mut), useConfirmBilling: vi.fn(() => mut),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const mut = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
import FeeItemPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBilling, useSaveBillingCharges } from "@/hooks/reactquery/billing";

beforeEach(() => {
  vi.clearAllMocks();
  mut.mutateAsync.mockResolvedValue({});
  vi.mocked(useMe).mockReturnValue({ data: { orgId: 10, role: "org_owner", permissions: [] } } as never);
  vi.mocked(useBuildings).mockReturnValue({ data: [{ id: 7, name: "가나빌", typeId: 1 }], isLoading: false } as never);
  vi.mocked(useBilling).mockReturnValue({ data: [], isLoading: false, error: null } as never);
  vi.mocked(useSaveBillingCharges).mockReturnValue(mut as never);
});

describe("management-fee page (billing)", () => {
  it("billing 권한 없으면 접근 차단", () => {
    vi.mocked(useMe).mockReturnValue({ data: { orgId: 10, role: "staff", permissions: [] } } as never);
    render(<FeeItemPage />);
    expect(screen.getByText(/권한이 없습니다/)).toBeInTheDocument();
  });
  it("건물 미선택 시 안내", () => {
    render(<FeeItemPage />);
    expect(screen.getByText(/건물을 선택/)).toBeInTheDocument();
  });
  it("건물 선택 드롭다운과 항목관리·저장 버튼", () => {
    render(<FeeItemPage />);
    expect(screen.getByLabelText("건물 선택")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "항목관리" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  });
  it("건물 선택 시 세대 그리드 로드(useBilling)", async () => {
    vi.mocked(useBilling).mockReturnValue({ data: [{
      unit_id: 1, unit_no: "101", dong: null, room_type_label: "원룸", occupancy_id: 5, tenant_name: "홍",
      move_in_date: "2026-07-01", is_vacant: false, fee_item_id: 10, fee_item_name: "관리비",
      carry_over: false, daily_proration: false, rounding: "round", is_required: true, sort_order: 0,
      charged: true, amount: 30000, confirmed_at: null, confirmed_by_name: null, total_amount: null,
      billing_note: null, unit_notice: null, is_dirty: false,
    }].map(camel), isLoading: false, error: null } as never);
    render(<FeeItemPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
    await waitFor(() => expect(screen.getByText("101")).toBeInTheDocument());
  });
});

// useBilling은 이미 camelCase(BillingFlatRow)를 반환하므로 테스트 헬퍼로 매핑
function camel(r: Record<string, unknown>) {
  return {
    unitId: r.unit_id, unitNo: r.unit_no, dong: r.dong, roomTypeLabel: r.room_type_label,
    occupancyId: r.occupancy_id, tenantName: r.tenant_name, moveInDate: r.move_in_date, isVacant: r.is_vacant,
    feeItemId: r.fee_item_id, feeItemName: r.fee_item_name, carryOver: r.carry_over, dailyProration: r.daily_proration,
    rounding: r.rounding, isRequired: r.is_required, sortOrder: r.sort_order, charged: r.charged, amount: r.amount,
    confirmedAt: r.confirmed_at, confirmedByName: r.confirmed_by_name, totalAmount: r.total_amount,
    billingNote: r.billing_note, unitNotice: r.unit_notice, isDirty: r.is_dirty,
  };
}
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run app/(staff)/staff/management-fee/page.test.tsx`
Expected: FAIL (현재 page.tsx가 building_type 탭 구조이므로 새 라벨/역할 부재)

- [ ] **Step 3: `ItemManageModal` 구현 (기존 항목 CRUD 로직 이식)**

> 현재 `page.tsx`의 항목 관련 핸들러(openCreate/openEdit/handleSubmit/handleDelete/handleMoveUp/handleMoveDown)를 이 모달로 이식한다. `typeId`(선택 건물 유형)로 스코프.

```tsx
// app/(staff)/staff/management-fee/components/ItemManageModal.tsx
"use client";
import React, { useState } from "react";
import { toast } from "sonner";
import { Modal, Button } from "@/components/common"; // Modal 존재 확인; 없으면 기존 모달 프리미티브 사용
import { FeeItemList } from "./FeeItemList";
import { FeeItemFormModal } from "./FeeItemFormModal";
import { useFeeItems, useCreateFeeItem, useUpdateFeeItem, useDeleteFeeItem, useReorderFeeItems, type FeeItem } from "@/hooks/reactquery/feeItems";
import { feeItemSchema } from "@/components/forms/schema/feeItem";
import { z } from "zod";
type FeeItemFormValues = z.output<typeof feeItemSchema>;

interface Props { open: boolean; onClose: () => void; orgId: number; typeId: number; typeLabel: string; }

export function ItemManageModal({ open, onClose, orgId, typeId, typeLabel }: Props) {
  const { data: feeItems = [], isLoading } = useFeeItems(typeId);
  const createItem = useCreateFeeItem();
  const updateItem = useUpdateFeeItem();
  const deleteItem = useDeleteFeeItem();
  const reorderItems = useReorderFeeItems();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FeeItem | null>(null);

  const err = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e));

  const handleSubmit = async (values: FeeItemFormValues) => {
    try {
      if (editing) {
        await updateItem.mutateAsync({ id: editing.id, input: { ...values, orgId, typeId, isRequired: editing.isRequired } });
      } else {
        await createItem.mutateAsync({ ...values, orgId, typeId, isRequired: false,
          rounding: values.rounding ?? "round", dailyProration: values.dailyProration ?? false, carryOver: values.carryOver ?? false });
      }
    } catch (e) { err(e); throw e; }
  };
  const handleDelete = async (item: FeeItem) => {
    if (item.isRequired) { toast.error("필수 항목은 삭제할 수 없습니다"); return; }
    try { await deleteItem.mutateAsync({ id: item.id, isRequired: item.isRequired }); } catch (e) { err(e); }
  };
  const move = async (item: FeeItem, dir: -1 | 1) => {
    const group = feeItems.filter((i) => i.isRequired === item.isRequired);
    const idx = group.findIndex((i) => i.id === item.id);
    const swap = idx + dir;
    if (swap < 0 || swap >= group.length) return;
    const ng = [...group]; [ng[idx], ng[swap]] = [ng[swap], ng[idx]];
    const required = item.isRequired ? ng : feeItems.filter((i) => i.isRequired);
    const optional = item.isRequired ? feeItems.filter((i) => !i.isRequired) : ng;
    try { await reorderItems.mutateAsync([...required, ...optional].map((i) => i.id)); } catch (e) { err(e); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`관리비 항목 관리 · ${typeLabel}`}>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}>＋ 항목 추가</Button>
      </div>
      <FeeItemList items={feeItems} isLoading={isLoading}
        onEdit={(i) => { setEditing(i); setFormOpen(true); }} onDelete={handleDelete}
        onMoveUp={(i) => move(i, -1)} onMoveDown={(i) => move(i, 1)} />
      <FeeItemFormModal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }}
        editing={editing} onSubmit={handleSubmit} isPending={createItem.isPending || updateItem.isPending} />
    </Modal>
  );
}
```

> **주의**: `Modal` 프리미티브의 실제 export/props(title/onClose/children 여부)를 `components/common`에서 확인해 맞춘다. 없으면 setup/accounts 모달 패턴을 따른다. `FeeItemFormModal`이 이미 자체 모달이면 중첩 대신 별도 오픈으로 처리.

- [ ] **Step 4: `page.tsx` 재작성**

```tsx
// app/(staff)/staff/management-fee/page.tsx
"use client";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Select, EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import { useBilling, useSaveBillingCharges } from "@/hooks/reactquery/billing";
import { hasModule } from "@/lib/auth/permissions";
import { pivotBillingRows, type BillingUnitRow } from "@/lib/billing/pivot";
import { currentPeriod, toMonthInput, fromMonthInput } from "@/lib/billing/period";
import { BillingTable } from "./components/BillingTable";
import { ItemManageModal } from "./components/ItemManageModal";

type ChargeDraft = { charged: boolean; amount: number };

export default function FeeItemPage() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const { data: buildingTypes = [] } = useBuildingTypes();

  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState<string>(() => currentPeriod());
  const [chargeDrafts, setChargeDrafts] = useState<Record<string, ChargeDraft>>({});
  const [itemModalOpen, setItemModalOpen] = useState(false);

  const billingQuery = useBilling(buildingId, period);
  const saveCharges = useSaveBillingCharges();

  if (me === undefined) return null;
  if (!hasModule(me, "billing")) {
    return <div className="p-6"><EmptyState message="이 화면에 접근할 권한이 없습니다. (부과 확정 권한 필요)" /></div>;
  }

  const buildings = buildingsQuery.data ?? [];
  const selectedBuilding = buildings.find((b) => b.id === buildingId) ?? null;
  const buildingType = buildingTypes.find((t) => t.id === selectedBuilding?.typeId) ?? null;

  const { units: serverUnits, columns } = pivotBillingRows(billingQuery.data ?? []);
  // draft 오버레이
  const units: BillingUnitRow[] = serverUnits.map((u) => ({
    ...u,
    charges: Object.fromEntries(columns.map((c) => {
      const key = `${u.unitId}:${c.feeItemId}`;
      return [c.feeItemId, chargeDrafts[key] ?? u.charges[c.feeItemId] ?? { charged: true, amount: 0 }];
    })),
  }));

  const onChargeChange = (unitId: number, feeItemId: number, patch: Partial<ChargeDraft>) => {
    const key = `${unitId}:${feeItemId}`;
    const current = chargeDrafts[key]
      ?? serverUnits.find((u) => u.unitId === unitId)?.charges[feeItemId]
      ?? { charged: true, amount: 0 };
    setChargeDrafts((d) => ({ ...d, [key]: { ...current, ...patch } }));
  };

  const handleSave = async () => {
    if (!buildingId) return;
    const charges = Object.entries(chargeDrafts).map(([key, v]) => {
      const [unitId, feeItemId] = key.split(":").map(Number);
      const occ = serverUnits.find((u) => u.unitId === unitId)?.occupancyId ?? null;
      return { unitId, feeItemId, charged: v.charged, amount: v.amount, occupancyId: occ };
    });
    if (charges.length === 0) { toast.info("변경된 금액이 없습니다."); return; }
    try {
      await saveCharges.mutateAsync({ buildingId, period, charges, notes: [] });
      setChargeDrafts({});
      toast.success("임시 저장되었습니다.");
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const selectBuilding = (v: string) => { setBuildingId(v ? Number(v) : null); setChargeDrafts({}); };
  const changeMonth = (v: string) => { setPeriod(fromMonthInput(v)); setChargeDrafts({}); };

  return (
    <div className="flex min-h-screen flex-col gap-5 p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold text-t3">관리업무 · 부과 확정</p>
        <h1 className="mt-1 text-2xl font-extrabold text-t1">관리비 부과 셋팅</h1>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-full sm:w-64">
            <span className="mb-1.5 block text-xs font-bold text-t2">건물 선택</span>
            <Select aria-label="건물 선택" value={buildingId?.toString() ?? ""}
              onChange={(e) => selectBuilding(e.target.value)} disabled={buildingsQuery.isLoading}
              options={[{ value: "", label: buildingsQuery.isLoading ? "불러오는 중" : "건물을 선택해 주세요" },
                ...buildings.map((b) => ({ value: String(b.id), label: b.name }))]} />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">부과 월</span>
            <input type="month" aria-label="부과 월" value={toMonthInput(period)} max={toMonthInput(currentPeriod())}
              onChange={(e) => e.target.value && changeMonth(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-t1 focus:border-blue focus:outline-none" />
          </label>
          <div className="flex w-full flex-wrap justify-end gap-2 xl:w-auto xl:flex-1">
            <Button variant="ghost" onClick={() => setItemModalOpen(true)} disabled={!selectedBuilding?.typeId}>항목관리</Button>
            <Button variant="ghost" onClick={handleSave} disabled={!buildingId || saveCharges.isPending}>저장</Button>
            {/* [부과 확정] 버튼은 Task 11에서 추가 */}
          </div>
        </div>
      </section>

      {!buildingId && <section className="rounded-2xl border border-line bg-surface shadow-card"><EmptyState message="건물을 선택해 주세요" /></section>}
      {buildingId && billingQuery.isLoading && (
        <section className="rounded-2xl border border-line bg-surface py-16 shadow-card"><Spinner /><p className="text-center text-sm text-t3">불러오는 중입니다.</p></section>
      )}
      {buildingId && billingQuery.error && (
        <section className="rounded-2xl border border-red/20 bg-red-t p-8 text-center">
          <p className="text-sm font-semibold text-red">오류가 발생했습니다. 다시 시도해 주세요.</p>
          <Button className="mt-3" variant="ghost" onClick={() => billingQuery.refetch()}>다시 시도</Button>
        </section>
      )}
      {buildingId && !billingQuery.isLoading && !billingQuery.error && units.length === 0 && (
        <section className="rounded-2xl border border-line bg-surface shadow-card"><EmptyState message="등록된 세대가 없습니다" /></section>
      )}
      {buildingId && !billingQuery.isLoading && !billingQuery.error && units.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <BillingTable units={units} columns={columns} period={period}
            onChargeChange={onChargeChange}
            onRowClick={() => { /* Task 12: 이력 모달 */ }}
            onNoteClick={() => { /* Task 13: 메모 모달 */ }} />
        </section>
      )}

      {selectedBuilding?.typeId && buildingType && me?.orgId && (
        <ItemManageModal open={itemModalOpen} onClose={() => setItemModalOpen(false)}
          orgId={me.orgId} typeId={selectedBuilding.typeId} typeLabel={buildingType.label} />
      )}
    </div>
  );
}
```

> `useMemo`는 필요 시 파생 계산에 적용(현재는 직접 계산). `me.orgId`·`me.role`·`me.permissions`는 `MyContext` 형태(auth apis) 확인.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run app/(staff)/staff/management-fee/page.test.tsx`
Expected: PASS (4 tests)

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add "app/(staff)/staff/management-fee"
git commit -m "feat(billing): /management-fee 건물 중심 재구성 + 항목관리 모달 + 초안 저장"
```

- [ ] **Step 7: WBS 동기화 (화면 커밋)**

`wbs-commit-sync` 스킬 실행 — 이 커밋이 `/management-fee` 화면을 건드림. dev 트랙만, 완료 자동변경 금지.

---

## Group 3 — 확정 · 이력 · 메모

### Task 11: 부과 확정 플로우 (page 배선)

**Files:**
- Modify: `app/(staff)/staff/management-fee/page.tsx`
- Modify: `app/(staff)/staff/management-fee/page.test.tsx` (테스트 추가)

**Interfaces:**
- Consumes: `useConfirmBilling`(Task 8).
- Produces: [부과 확정] 버튼 + 확인 → `confirmBilling` → 성공 토스트 + 쿼리 무효화(자동). 미저장 draft 존재 시 먼저 저장 안내.

- [ ] **Step 1: 실패 테스트 추가**

```tsx
// page.test.tsx 에 추가
it("부과 확정 클릭 시 확인 후 confirmBilling 호출", async () => {
  const confirmMut = { mutateAsync: vi.fn().mockResolvedValue({ unitCount: 2, total: 60000 }), isPending: false };
  const { useConfirmBilling } = await import("@/hooks/reactquery/billing");
  vi.mocked(useConfirmBilling).mockReturnValue(confirmMut as never);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(useBilling).mockReturnValue({ data: [/* 최소 1세대 1항목 */].map?.(() => ({})) ?? [], isLoading: false, error: null } as never);
  render(<FeeItemPage />);
  fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "부과 확정" }));
  await waitFor(() => expect(confirmMut.mutateAsync).toHaveBeenCalledWith({ buildingId: 7, period: expect.any(String) }));
});
```
> `useConfirmBilling` mock은 파일 상단 `vi.mock("@/hooks/reactquery/billing", …)`에 이미 포함(Task 10). 여기선 반환값만 재지정.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run app/(staff)/staff/management-fee/page.test.tsx -t "부과 확정"`
Expected: FAIL (버튼 없음)

- [ ] **Step 3: page.tsx에 확정 배선 추가**

`page.tsx` 상단 import·훅에 추가:
```tsx
import { useBilling, useSaveBillingCharges, useConfirmBilling } from "@/hooks/reactquery/billing";
// ...
const confirmBilling = useConfirmBilling();
```
액션 영역에 [저장] 다음 버튼 추가:
```tsx
<Button variant="primary" onClick={handleConfirm}
  disabled={!buildingId || confirmBilling.isPending || units.length === 0}>부과 확정</Button>
```
핸들러 추가:
```tsx
const handleConfirm = async () => {
  if (!buildingId) return;
  if (Object.keys(chargeDrafts).length > 0) { toast.info("먼저 [저장]으로 임시 저장해 주세요."); return; }
  if (!window.confirm("당월 관리비를 부과 확정하시겠습니까?")) return;
  try {
    const r = await confirmBilling.mutateAsync({ buildingId, period });
    toast.success(`부과가 확정되었습니다. (${r.unitCount}세대 · ${r.total.toLocaleString("ko-KR")}원)`);
  } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
};
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run app/(staff)/staff/management-fee/page.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋 + WBS 동기화**

```bash
git add "app/(staff)/staff/management-fee/page.tsx" "app/(staff)/staff/management-fee/page.test.tsx"
git commit -m "feat(billing): 부과 확정 플로우(확인 팝업·confirmBilling·결과 토스트)"
```
그 후 `wbs-commit-sync` 실행(dev 트랙).

---

### Task 12: `BillingHistoryModal` — 6개월 이력

**Files:**
- Create: `app/(staff)/staff/management-fee/components/BillingHistoryModal.tsx`
- Test: `app/(staff)/staff/management-fee/components/BillingHistoryModal.test.tsx`
- Modify: `page.tsx` (행 클릭 → 모달 오픈)

**Interfaces:**
- Consumes: `useBillingHistory`(Task 8).
- Produces (props): `{ open:boolean; unitId:number|null; unitNo:string; period:string; onClose:()=>void }`. 최근 6개월 기간·총액·전월대비 증감 표시.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// BillingHistoryModal.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/billing", () => ({ useBillingHistory: vi.fn() }));
import { BillingHistoryModal } from "./BillingHistoryModal";
import { useBillingHistory } from "@/hooks/reactquery/billing";
beforeEach(() => vi.clearAllMocks());

describe("BillingHistoryModal", () => {
  it("기간별 총액과 전월대비 증감 표시", () => {
    vi.mocked(useBillingHistory).mockReturnValue({ data: [
      { period: "2026-08-01", totalAmount: 90000, items: [], confirmedAt: "x" },
      { period: "2026-07-01", totalAmount: 80000, items: [], confirmedAt: "y" },
    ], isLoading: false } as never);
    render(<BillingHistoryModal open unitId={1} unitNo="101" period="2026-08-01" onClose={vi.fn()} />);
    expect(screen.getByText("90,000")).toBeInTheDocument();
    expect(screen.getByText(/\+10,000/)).toBeInTheDocument(); // 전월대비 증가
  });
  it("open=false면 렌더 안 함", () => {
    vi.mocked(useBillingHistory).mockReturnValue({ data: [], isLoading: false } as never);
    const { container } = render(<BillingHistoryModal open={false} unitId={1} unitNo="101" period="2026-08-01" onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run app/(staff)/staff/management-fee/components/BillingHistoryModal.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/management-fee/components/BillingHistoryModal.tsx
"use client";
import React from "react";
import { Modal, Spinner } from "@/components/common";
import { useBillingHistory } from "@/hooks/reactquery/billing";

interface Props { open: boolean; unitId: number | null; unitNo: string; period: string; onClose: () => void; }
const won = (n: number) => n.toLocaleString("ko-KR");

export function BillingHistoryModal({ open, unitId, unitNo, period, onClose }: Props) {
  const { data = [], isLoading } = useBillingHistory(open ? unitId : null, period);
  return (
    <Modal open={open} onClose={onClose} title={`${unitNo} · 6개월 부과 이력`}>
      {isLoading ? <Spinner /> : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line2 text-left text-xs text-t2"><th className="py-2">부과월</th><th className="py-2 text-right">총액</th><th className="py-2 text-right">전월대비</th></tr></thead>
          <tbody>
            {data.map((h, i) => {
              const prev = data[i + 1]; // data는 최신순
              const delta = prev ? h.totalAmount - prev.totalAmount : null;
              return (
                <tr key={h.period} className="border-b border-line2">
                  <td className="py-2">{h.period.slice(0, 7)}</td>
                  <td className="py-2 text-right font-bold">{won(h.totalAmount)}</td>
                  <td className={`py-2 text-right ${delta && delta > 0 ? "text-red" : delta && delta < 0 ? "text-blue-d" : "text-t3"}`}>
                    {delta === null ? "-" : `${delta > 0 ? "+" : ""}${won(delta)}`}
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-t3">확정 이력이 없습니다.</td></tr>}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
```

- [ ] **Step 4: page.tsx 배선**

`page.tsx`에 상태·모달 추가:
```tsx
import { BillingHistoryModal } from "./components/BillingHistoryModal";
// ...
const [historyUnit, setHistoryUnit] = useState<{ id: number; no: string } | null>(null);
// BillingTable prop: onRowClick={(unitId) => { const u = units.find(x=>x.unitId===unitId); if (u) setHistoryUnit({ id: unitId, no: u.unitNo }); }}
// JSX 하단:
<BillingHistoryModal open={!!historyUnit} unitId={historyUnit?.id ?? null} unitNo={historyUnit?.no ?? ""} period={period} onClose={() => setHistoryUnit(null)} />
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run app/(staff)/staff/management-fee/components/BillingHistoryModal.test.tsx`
Expected: PASS (2 tests)

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: 커밋 + WBS 동기화**

```bash
git add "app/(staff)/staff/management-fee"
git commit -m "feat(billing): 6개월 이력 모달(전월대비 증감) + 행 클릭 배선"
```
그 후 `wbs-commit-sync` 실행(dev 트랙).

---

### Task 13: `BillingNoteModal` — 세대 월 메모

**Files:**
- Create: `app/(staff)/staff/management-fee/components/BillingNoteModal.tsx`
- Test: `app/(staff)/staff/management-fee/components/BillingNoteModal.test.tsx`
- Modify: `page.tsx` (메모 버튼 → 모달, 저장 시 notes payload)

**Interfaces:**
- Produces (props): `{ open; unitNo; billingNote; unitNotice; onClose; onSave:(v:{billingNote:string;unitNotice:string})=>void }`. 부과 참조사항·호실 공지 편집.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// BillingNoteModal.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BillingNoteModal } from "./BillingNoteModal";

describe("BillingNoteModal", () => {
  it("기존 값 표시 후 저장 시 onSave 호출", () => {
    const onSave = vi.fn();
    render(<BillingNoteModal open unitNo="101" billingNote="기존참조" unitNotice="" onClose={vi.fn()} onSave={onSave} />);
    const ref = screen.getByLabelText("부과 참조사항");
    fireEvent.change(ref, { target: { value: "수정참조" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith({ billingNote: "수정참조", unitNotice: "" });
  });
  it("open=false면 렌더 안 함", () => {
    const { container } = render(<BillingNoteModal open={false} unitNo="101" billingNote="" unitNotice="" onClose={vi.fn()} onSave={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run app/(staff)/staff/management-fee/components/BillingNoteModal.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```tsx
// app/(staff)/staff/management-fee/components/BillingNoteModal.tsx
"use client";
import React, { useState } from "react";
import { Modal, Button } from "@/components/common";

interface Props {
  open: boolean; unitNo: string; billingNote: string; unitNotice: string;
  onClose: () => void; onSave: (v: { billingNote: string; unitNotice: string }) => void;
}

export function BillingNoteModal({ open, unitNo, billingNote, unitNotice, onClose, onSave }: Props) {
  const [b, setB] = useState(billingNote);
  const [n, setN] = useState(unitNotice);
  React.useEffect(() => { if (open) { setB(billingNote); setN(unitNotice); } }, [open, billingNote, unitNotice]);
  return (
    <Modal open={open} onClose={onClose} title={`${unitNo} · 부과 메모`}>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-t2">부과 참조사항</span>
        <textarea aria-label="부과 참조사항" value={b} onChange={(e) => setB(e.target.value)}
          className="h-20 w-full rounded border border-line p-2 text-sm" />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-bold text-t2">호실별 공지사항</span>
        <textarea aria-label="호실별 공지사항" value={n} onChange={(e) => setN(e.target.value)}
          className="h-20 w-full rounded border border-line p-2 text-sm" />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <Button variant="primary" onClick={() => onSave({ billingNote: b, unitNotice: n })}>저장</Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: page.tsx 배선 (noteDrafts + 저장 payload 포함)**

`page.tsx`에 추가:
```tsx
import { BillingNoteModal } from "./components/BillingNoteModal";
// 상태
const [noteDrafts, setNoteDrafts] = useState<Record<number, { billingNote: string; unitNotice: string }>>({});
const [noteUnit, setNoteUnit] = useState<number | null>(null);
// units 오버레이에 note draft도 반영(billingNote/unitNotice)
// BillingTable prop: onNoteClick={(unitId) => setNoteUnit(unitId)}
// handleSave의 notes를 noteDrafts로 채움:
//   notes: Object.entries(noteDrafts).map(([unitId, v]) => ({ unitId: Number(unitId), billingNote: v.billingNote || null, unitNotice: v.unitNotice || null }))
// 저장 성공 시 setNoteDrafts({}) 도 함께
// JSX 하단:
{noteUnit != null && (() => {
  const u = units.find((x) => x.unitId === noteUnit);
  return (
    <BillingNoteModal open unitNo={u?.unitNo ?? ""} billingNote={u?.billingNote ?? ""} unitNotice={u?.unitNotice ?? ""}
      onClose={() => setNoteUnit(null)}
      onSave={(v) => { setNoteDrafts((d) => ({ ...d, [noteUnit]: v })); setNoteUnit(null); }} />
  );
})()}
```
> `handleSave` 가드도 갱신: charges·notes 모두 비면 "변경된 내용이 없습니다". BillingTable에 넘기는 `units`의 `billingNote`/`unitNotice`도 noteDrafts 오버레이 적용(메모 ● 표시 즉시 반영).

- [ ] **Step 5: 통과 + 전체 회귀 + 정적 확인**

Run: `npx vitest run app/(staff)/staff/management-fee`
Expected: PASS

Run: `npx vitest run` (전체 회귀)
Expected: PASS (기존 스위트 + 신규)

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 6: 커밋 + WBS 동기화**

```bash
git add "app/(staff)/staff/management-fee"
git commit -m "feat(billing): 세대 월 메모 모달(부과 참조·호실 공지) + 저장 payload 연동"
```
그 후 `wbs-commit-sync` 실행(dev 트랙).

---

## 최종 검증 (전체 완료 후)

- [ ] `npx vitest run` — 전체 그린
- [ ] `npx tsc --noEmit` — 타입 에러 0
- [ ] `npm run lint` — 린트 통과
- [ ] `supabase/verify/p5_checks.sql` 존재 확인(라이브 검증은 사용자 PC: 0007 적용 후 실행)
- [ ] AGENTS.md 에이전트 블록이 재생성됐으면 커밋에 포함(트리 클린)

---

## Self-Review (작성자 체크 결과)

**1. Spec coverage:**
- §3 스키마 3테이블 → Task 1. §4 RPC 4종+round_charge → Task 2·3. §5 RLS → Task 1(+검증 Task 3). §6 계산(이월·일할·합계·우수리·공실) → SQL Task 2·3 + lib Task 4~7. §7 데이터계층 → Task 8. §8 UI(페이지·BillingTable·항목모달·이력·메모) → Task 9~13. §9 테스트 → 각 Task TDD + Task 13 전체 회귀. §10 마이그/verify → Task 1~3.
- **주변기능(§3.3·§3.4)·검침·고지서**는 spec Out of scope → 계획에서도 제외(일치).

**2. Placeholder scan:** 코드 스텝은 실제 코드 포함. `page.tsx`의 `onRowClick`/`onNoteClick`은 Task 10에서 의도적 no-op(주석 명시) → Task 12·13에서 배선. TODO성 공백 없음.

**3. Type consistency:** `BillingFlatRow`(pivot.ts, Task 7) ↔ apis 매퍼(Task 8) ↔ `useBilling`(Task 8) ↔ `pivotBillingRows`(Task 10) 필드명 일치. `effectiveAmount`/`roundCharge`(proration) ↔ `unitTotal`(total) ↔ `BillingTable` rowTotal 일치. RPC 인자명(`p_building_id`·`p_period`·`p_charges`·`p_notes`·`p_unit_id`·`p_months`)이 SQL(Task 2·3) ↔ apis(Task 8) 일치. `round_charge`(SQL) ↔ `roundCharge`(TS) 매핑 일치(up/down/else). 모듈키 `billing` 일관.

**검증 완료:** `Modal`은 `components/common` export 확인 — props `{ open, onClose, title, children }`, `open=false`면 자체 null 반환(래퍼는 `open` 전달, early-return 불필요·컨테이너 빈 상태 보장). 컨테이너는 `max-w-md`(좁음) — ItemManageModal은 필요 시 폭 조정. `MyContext` 필드 `orgId:number`·`role`·`permissions:string[]` 확인.

**잔여 플래그(구현 시 확인):** Tailwind 토큰(`bg-surface2`·`text-t2`·`bg-green-t`/`text-green-d`·`bg-amber-t`·`text-amber-700`·`bg-blue-t`/`text-blue-d`·`bg-red-t`/`text-red` 등) 실재 여부는 `app/globals.css` grep으로 확인, 없으면 utilities `UtilityTable`·buildings 컴포넌트에서 쓰는 실존 토큰으로 대체.

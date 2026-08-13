# P7a 이사정산(/staff/moving-settlement) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** /staff/moving-settlement에서 건물·호실을 선택해 검침 정보를 확인하고, 관리비 일할·검침요금·수리비를 합산한 이사정산을 저장하며, 중도퇴실 또는 정산완료+공실 전환을 안전하게 수행하고 날짜범위 이력을 조회한다.

**Architecture:** 신규 DB 마이그레이션 0008은 moving_settlements 이력과 settlement_checklist_results를 만들고 moving 모듈 RLS를 적용한다. 다섯 security-definer RPC가 org 검증, 정산 컨텍스트 조회, 원자적 저장, 중도퇴실, 정산완료+공실, 날짜범위 조회를 담당한다. 클라이언트는 movingSettlement React Query 도메인에서 snake↔camel 경계를 한 번만 처리한다. 화면은 선택/컨텍스트 상태를 page가 소유하고, 검침·폼·체크리스트·액션·이력을 제어 컴포넌트로 분리한다.

**Tech Stack:** Next.js 16 App Router · Supabase(PostgreSQL·Auth·RLS·RPC) · React Query v5 · Zod · Tailwind v4 · Vitest + Testing Library · sonner.

## Global Constraints

- **기준 spec:** docs/superpowers/specs/2026-08-13-p7a-moving-settlement-design.md의 확정 결정 A~H와 §3~§10을 그대로 따른다.
- **그룹 경계:** 그룹 1은 DB·데이터층·Zod·API 테스트, 그룹 2는 page·검침 패널·폼·체크리스트, 그룹 3은 액션·이력·nav다. 그룹 1 작업에서 UI와 navItems를 변경하지 않는다.
- **범위 밖:** 유형별 이사조회 4화면, xlsx 실제 출력, payments 실제 미납 수납, billing 기반 관리비 월액 자동조회, 검침 단가 자동계산, 문자/카톡 실발송, 현장직원 모바일 전용 흐름.
- **DB 사실:** buildings.manager_name을 사용하지 않는다. occupancies의 settlement_note·billing_note·print_enabled·status·move_out_date·room_type_id와 setup_config의 settle_bank·settle_acct·settle_holder, room_types.label만 사용한다.
- **DB 권한:** 두 신규 테이블의 SELECT는 같은 org에 개방하고, write는 current_user_has_module('moving')으로 제한한다. security-definer RPC는 함수 내부에서 caller org와 moving 모듈을 다시 검증한다. 모든 RPC는 anon execute를 revoke한다.
- **계산:** settlement_amount는 관리비 일할 + 수도 + 전기 + 가스 + 수리비이며 null은 0이다. 관리비 일할은 round(월액 × 퇴실일 day / 해당 월 총일수)이고 UI에서 수정할 수 있다.
- **수도 이월:** 별도 write를 만들지 않는다. meter_readings의 다음 월 조회가 전월 current_reading을 previous_reading으로 사용한다.
- **컨벤션:** Supabase는 createClient().rpc 패턴, snake↔camel은 apis.ts, query key는 도메인 all/context/list, mutation 성공은 도메인 all 무효화, alias @/는 저장소 루트다.
- **Next.js 16:** node_modules/next/dist/docs의 App Router TypeScript·Vitest 가이드를 기준으로 한다. 비동기 Server Component 단위 테스트를 만들지 않고 이 화면은 기존 staff 패턴처럼 use client로 구현한다.
- **오프라인:** 네트워크를 사용하거나 npm install을 실행하지 않는다. 라이브 migration 적용은 이 계획 범위 밖이다.
- **검증 명령:** npx vitest run <path>, npx tsc --noEmit. PowerShell 실행 정책이 npx.ps1을 막는 환경에서는 동일 실행 파일인 npx.cmd를 사용한다.
- **Git 금지:** 이 워크트리에서 git 명령을 실행하지 않는다. 커밋과 WBS 동기화는 오케스트레이터가 담당한다.

## File Structure

**그룹 1 — DB:** supabase/migrations/0008_p7a_moving_settlement.sql, supabase/verify/p7a_checks.sql.

**그룹 1 — 데이터층:** hooks/reactquery/movingSettlement/apis.ts, keys.ts, queries.ts, mutations.ts, index.ts, apis.test.ts; components/forms/schema/movingSettlement.ts.

**그룹 2 — 입력 화면:** app/(staff)/staff/moving-settlement/page.tsx; components/MeterInfoPanel.tsx, SettlementForm.tsx, ChecklistSection.tsx; page.test.tsx와 각 컴포넌트 테스트.

**그룹 3 — 처리·이력:** app/(staff)/staff/moving-settlement/components/SettlementActions.tsx, SettlementHistory.tsx와 테스트; page.tsx 배선; components/shell/navItems.ts의 built 변경.

---

## 그룹 1 — DB · 데이터 계층

### Task 1: 마이그레이션 0008 + 검증 SQL

**Files:**
- Create: supabase/migrations/0008_p7a_moving_settlement.sql
- Create: supabase/verify/p7a_checks.sql

**Interfaces:**
- Produces: moving_settlements, settlement_checklist_results.
- Produces: get_settlement_context(bigint), save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb), complete_moving_settlement(bigint), mid_moveout_settlement(bigint), list_settlements(bigint,date,date).
- Consumes: current_user_org, current_user_has_module, my_org_ids, set_updated_at, units, buildings, occupancies, occupancy_history, room_types, setup_config, settlement_check_items, meter_readings.

> **TDD 예외:** 원격 DB가 없으므로 이 태스크의 executable check는 p7a_checks.sql이다. 작성 중에는 spec §3~§5와 정적 대조하고, 적용 후 사용자 PC psql에서 verify 파일을 실행한다.

- [ ] **Step 1: 아래 exact migration을 작성한다.**

~~~sql
-- P7a: 이사정산(/staff/moving-settlement)
-- 의존: P1a(units, buildings), P2a(current_user_org, current_user_has_module, my_org_ids, set_updated_at),
--       P2b(setup_config, settlement_check_items, room_types),
--       P3b(occupancies 확장, occupancy_history), P5a(meter_readings)

-- ===== moving_settlements: 세대별 이사정산 이력 =====
create table moving_settlements (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  occupancy_id bigint references occupancies(id) on delete set null,
  move_out_date date,
  mgmt_fee_monthly integer,
  mgmt_fee_prorated integer,
  water_charge integer,
  elec_charge integer,
  gas_charge integer,
  elec_paid_date date,
  gas_paid_date date,
  repair_amount integer,
  repair_attribution text check (repair_attribution in ('owner','manager','office')),
  repair_memo text,
  settle_bank text,
  settle_acct text,
  settle_holder text,
  settlement_amount integer,
  note text,
  settlement_note text,
  status text not null default 'draft' check (status in ('draft','saved','mid_moveout','completed')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on moving_settlements (unit_id, created_at desc);

-- ===== settlement_checklist_results: 정산별 시설점검 결과 =====
create table settlement_checklist_results (
  id bigint generated always as identity primary key,
  settlement_id bigint not null references moving_settlements(id) on delete cascade,
  check_item_id bigint not null references settlement_check_items(id) on delete cascade,
  checked boolean not null default false,
  unique (settlement_id, check_item_id)
);
create index on settlement_checklist_results (settlement_id);

-- ===== updated_at 트리거 =====
do $$ declare t text; begin
  foreach t in array array['moving_settlements'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- ===== RLS: select org 개방 / write moving 모듈 =====
alter table moving_settlements enable row level security;
alter table settlement_checklist_results enable row level security;

create policy ms_select on moving_settlements for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy ms_write on moving_settlements for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('moving'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('moving'));
create policy scr_select on settlement_checklist_results for select
  using (settlement_id in (select s.id from moving_settlements s join units u on u.id=s.unit_id join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy scr_write on settlement_checklist_results for all
  using      (settlement_id in (select s.id from moving_settlements s join units u on u.id=s.unit_id join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('moving'))
  with check (settlement_id in (select s.id from moving_settlements s join units u on u.id=s.unit_id join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('moving'));

-- ===== 정산 입력 컨텍스트 조회 RPC =====
create or replace function get_settlement_context(p_unit_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org bigint;
  v_unit jsonb;
  v_occupancy jsonb;
  v_settlement_id bigint;
  v_settlement jsonb;
  v_account jsonb;
  v_checklist jsonb;
  v_meter_summary jsonb;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;

  select jsonb_build_object(
      'id', u.id, 'unit_no', u.unit_no, 'dong', u.dong, 'building_id', u.building_id
    ) into v_unit
    from units u
    join buildings b on b.id = u.building_id and b.org_id = v_org
    where u.id = p_unit_id and u.deleted_at is null;
  if v_unit is null then raise exception 'unit not in org'; end if;

  select jsonb_build_object(
      'id', o.id, 'tenant_name', o.tenant_name, 'move_in_date', o.move_in_date,
      'settlement_note', o.settlement_note, 'billing_note', o.billing_note, 'status', o.status
    ) into v_occupancy
    from occupancies o
    where o.unit_id = p_unit_id and o.deleted_at is null
    order by o.created_at desc limit 1;

  select s.id, to_jsonb(s) into v_settlement_id, v_settlement
    from moving_settlements s
    where s.unit_id = p_unit_id and s.status in ('draft','saved')
    order by s.created_at desc limit 1;

  select jsonb_build_object(
      'settle_bank', sc.settle_bank, 'settle_acct', sc.settle_acct,
      'settle_holder', sc.settle_holder
    ) into v_account
    from setup_config sc where sc.org_id = v_org;
  v_account := coalesce(v_account, jsonb_build_object(
    'settle_bank', null, 'settle_acct', null, 'settle_holder', null
  ));

  select coalesce(jsonb_agg(
      jsonb_build_object('id', sci.id, 'label', sci.label, 'checked', coalesce(scr.checked, false))
      order by sci.sort_order, sci.id
    ), '[]'::jsonb) into v_checklist
    from settlement_check_items sci
    left join settlement_checklist_results scr
      on scr.check_item_id = sci.id and scr.settlement_id = v_settlement_id
    where sci.org_id = v_org and sci.deleted_at is null;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'utility', utility_row.utility,
        'previous_reading', coalesce(cur.previous_reading, prev.current_reading),
        'current_reading', cur.current_reading,
        'usage', coalesce(
          cur.usage,
          case when cur.current_reading is not null and coalesce(cur.previous_reading, prev.current_reading) is not null
            then cur.current_reading - coalesce(cur.previous_reading, prev.current_reading)
          end
        )
      ) order by utility_row.sort_order
    ), '[]'::jsonb) into v_meter_summary
    from (values ('water', 1), ('elec', 2), ('gas', 3)) as utility_row(utility, sort_order)
    left join lateral (
      select mr.* from meter_readings mr
      where mr.unit_id = p_unit_id and mr.utility = utility_row.utility
      order by mr.period desc limit 1
    ) cur on true
    left join meter_readings prev
      on prev.unit_id = p_unit_id and prev.utility = utility_row.utility
      and prev.period = (cur.period - interval '1 month')::date;

  return jsonb_build_object(
    'unit', v_unit,
    'occupancy', v_occupancy,
    'latest_settlement', v_settlement,
    'settle_account', v_account,
    'checklist', v_checklist,
    'meter_summary', v_meter_summary
  );
end $$;
revoke execute on function get_settlement_context(bigint) from anon;

-- ===== 정산 저장 RPC(원자적) =====
create or replace function save_moving_settlement(
  p_unit_id bigint, p_occupancy_id bigint, p_settlement_id bigint,
  p_data jsonb, p_checklist jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_settlement_id bigint := p_settlement_id;
  v_amount integer;
  v_item jsonb;
  v_check_item_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;
  if not exists (
    select 1 from units u join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null and b.org_id = v_org
  ) then raise exception 'unit not in org'; end if;
  if p_occupancy_id is not null and not exists (
    select 1 from occupancies o
    where o.id = p_occupancy_id and o.unit_id = p_unit_id and o.deleted_at is null
  ) then raise exception 'occupancy not in unit'; end if;

  v_amount :=
    coalesce(nullif(p_data->>'mgmt_fee_prorated','')::integer, 0) +
    coalesce(nullif(p_data->>'water_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'elec_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'gas_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'repair_amount','')::integer, 0);

  if v_settlement_id is null then
    insert into moving_settlements(
      unit_id, occupancy_id, move_out_date, mgmt_fee_monthly, mgmt_fee_prorated,
      water_charge, elec_charge, gas_charge, elec_paid_date, gas_paid_date,
      repair_amount, repair_attribution, repair_memo,
      settle_bank, settle_acct, settle_holder, settlement_amount,
      note, settlement_note, status
    ) values (
      p_unit_id, p_occupancy_id, nullif(p_data->>'move_out_date','')::date,
      nullif(p_data->>'mgmt_fee_monthly','')::integer,
      nullif(p_data->>'mgmt_fee_prorated','')::integer,
      nullif(p_data->>'water_charge','')::integer,
      nullif(p_data->>'elec_charge','')::integer,
      nullif(p_data->>'gas_charge','')::integer,
      nullif(p_data->>'elec_paid_date','')::date,
      nullif(p_data->>'gas_paid_date','')::date,
      nullif(p_data->>'repair_amount','')::integer,
      nullif(p_data->>'repair_attribution',''),
      nullif(p_data->>'repair_memo',''),
      nullif(p_data->>'settle_bank',''),
      nullif(p_data->>'settle_acct',''),
      nullif(p_data->>'settle_holder',''),
      v_amount,
      nullif(p_data->>'note',''),
      nullif(p_data->>'settlement_note',''),
      'saved'
    ) returning id into v_settlement_id;
  else
    update moving_settlements set
      occupancy_id = p_occupancy_id,
      move_out_date = nullif(p_data->>'move_out_date','')::date,
      mgmt_fee_monthly = nullif(p_data->>'mgmt_fee_monthly','')::integer,
      mgmt_fee_prorated = nullif(p_data->>'mgmt_fee_prorated','')::integer,
      water_charge = nullif(p_data->>'water_charge','')::integer,
      elec_charge = nullif(p_data->>'elec_charge','')::integer,
      gas_charge = nullif(p_data->>'gas_charge','')::integer,
      elec_paid_date = nullif(p_data->>'elec_paid_date','')::date,
      gas_paid_date = nullif(p_data->>'gas_paid_date','')::date,
      repair_amount = nullif(p_data->>'repair_amount','')::integer,
      repair_attribution = nullif(p_data->>'repair_attribution',''),
      repair_memo = nullif(p_data->>'repair_memo',''),
      settle_bank = nullif(p_data->>'settle_bank',''),
      settle_acct = nullif(p_data->>'settle_acct',''),
      settle_holder = nullif(p_data->>'settle_holder',''),
      settlement_amount = v_amount,
      note = nullif(p_data->>'note',''),
      settlement_note = nullif(p_data->>'settlement_note',''),
      status = 'saved',
      processed_at = null
      where id = v_settlement_id and unit_id = p_unit_id and status in ('draft','saved');
    if not found then raise exception 'editable settlement not in unit'; end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) loop
    v_check_item_id := (v_item->>'check_item_id')::bigint;
    if not exists (
      select 1 from settlement_check_items sci
      where sci.id = v_check_item_id and sci.org_id = v_org and sci.deleted_at is null
    ) then raise exception 'check item % not in org', v_check_item_id; end if;

    insert into settlement_checklist_results(settlement_id, check_item_id, checked)
      values (v_settlement_id, v_check_item_id, coalesce((v_item->>'checked')::boolean, false))
      on conflict (settlement_id, check_item_id) do update set checked = excluded.checked;
  end loop;

  return jsonb_build_object('settlement_id', v_settlement_id, 'settlement_amount', v_amount);
end $$;
revoke execute on function save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb) from anon;

-- ===== 정산완료 + 공실 처리 RPC =====
create or replace function complete_moving_settlement(p_settlement_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_unit_id bigint;
  v_occupancy_id bigint;
  v_move_out_date date;
  v_status text;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;

  select s.unit_id, s.occupancy_id, s.move_out_date, s.status
    into v_unit_id, v_occupancy_id, v_move_out_date, v_status
    from moving_settlements s
    join units u on u.id = s.unit_id
    join buildings b on b.id = u.building_id and b.org_id = v_org
    where s.id = p_settlement_id
    for update of s;
  if not found then raise exception 'settlement not in org'; end if;
  if v_status = 'completed' then return jsonb_build_object('ok', true); end if;
  if v_occupancy_id is null then raise exception 'settlement has no occupancy'; end if;
  if v_move_out_date is null then raise exception 'move out date required'; end if;

  update moving_settlements
    set status = 'completed', processed_at = now()
    where id = p_settlement_id;

  update occupancies
    set status = 'vacant', move_out_date = v_move_out_date, settlement_note = null
    where id = v_occupancy_id and unit_id = v_unit_id and deleted_at is null;
  if not found then raise exception 'occupancy not in unit'; end if;

  insert into occupancy_history(unit_id, tenant_name, move_in_date, move_out_date, room_type_label)
    select o.unit_id, o.tenant_name, o.move_in_date, v_move_out_date, rt.label
    from occupancies o
    left join room_types rt on rt.id = o.room_type_id
    where o.id = v_occupancy_id and o.unit_id = v_unit_id;

  -- TODO(payments/P6): 미납 수납은 UI 확인 팝업만 제공하며 실제 수납 처리는 후속한다.
  -- 수도지침은 다음 월 list_utility_rows가 전월 current를 previous로 읽으므로 별도 이월 write가 없다.
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function complete_moving_settlement(bigint) from anon;

-- ===== 중도퇴실 처리 RPC =====
create or replace function mid_moveout_settlement(p_settlement_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_unit_id bigint;
  v_occupancy_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;

  select s.unit_id, s.occupancy_id into v_unit_id, v_occupancy_id
    from moving_settlements s
    join units u on u.id = s.unit_id
    join buildings b on b.id = u.building_id and b.org_id = v_org
    where s.id = p_settlement_id
    for update of s;
  if not found then raise exception 'settlement not in org'; end if;
  if v_occupancy_id is null then raise exception 'settlement has no occupancy'; end if;

  update moving_settlements set status = 'mid_moveout'
    where id = p_settlement_id;
  update occupancies set billing_note = '중도퇴실', print_enabled = false
    where id = v_occupancy_id and unit_id = v_unit_id and deleted_at is null;
  if not found then raise exception 'occupancy not in unit'; end if;

  return jsonb_build_object('ok', true);
end $$;
revoke execute on function mid_moveout_settlement(bigint) from anon;

-- ===== 날짜범위 정산 이력 RPC =====
create or replace function list_settlements(
  p_building_id bigint, p_from date, p_to date
) returns table(
  settlement_id bigint, unit_id bigint, occupancy_id bigint,
  unit_no text, tenant_name text, status text, settlement_amount integer,
  move_out_date date, processed_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select s.id, s.unit_id, s.occupancy_id,
    u.unit_no, o.tenant_name, s.status, s.settlement_amount,
    s.move_out_date, s.processed_at, s.created_at
  from moving_settlements s
  join units u on u.id = s.unit_id and u.building_id = p_building_id
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join occupancies o on o.id = s.occupancy_id
  where s.move_out_date between p_from and p_to
  order by u.unit_no, s.created_at desc
$$;
revoke execute on function list_settlements(bigint,date,date) from anon;
~~~

- [ ] **Step 2: 아래 exact verify SQL을 작성한다.**

~~~sql
-- P7a 검증 (사용자 PC psql). 실패 시 raise.
do $$ begin
  if (select count(*) from information_schema.tables
      where table_schema='public' and table_name in ('moving_settlements','settlement_checklist_results')) <> 2
    then raise exception 'P7a tables missing'; end if;
  perform 1 from information_schema.columns
    where table_schema='public' and table_name='moving_settlements' and column_name='move_out_date';
  if not found then raise exception 'moving_settlements.move_out_date missing'; end if;
  perform 1 from information_schema.columns
    where table_schema='public' and table_name='moving_settlements' and column_name='repair_attribution';
  if not found then raise exception 'moving_settlements.repair_attribution missing'; end if;
end $$;
do $$ begin
  perform 1 from pg_policies
    where schemaname='public' and tablename='moving_settlements'
      and policyname='ms_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'ms_write must gate by moving module'; end if;
  perform 1 from pg_policies
    where schemaname='public' and tablename='settlement_checklist_results'
      and policyname='scr_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'scr_write must gate by moving module'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (
        'get_settlement_context','save_moving_settlement','complete_moving_settlement',
        'mid_moveout_settlement','list_settlements'
      ) and p.prosecdef) <> 5
    then raise exception 'P7a security-definer RPC missing'; end if;
end $$;
-- 수동: moving 미보유 구성원 moving_settlements SELECT 가능·INSERT 거부; moving 보유·마스터 save/complete/mid 성공;
--       get_settlement_context 최신 draft/saved·계좌 스냅샷·체크리스트·검침 3종 확인;
--       complete가 occupancy_history INSERT·occupancy vacant·settlement_note 리셋, mid가 billing_note/print_enabled 변경;
--       list_settlements 날짜범위 정렬 및 타 org unit/building/settlement 격리 확인.
~~~

- [ ] **Step 3: 정적 계약 검증을 실행한다.**

~~~powershell
rg -n "create table moving_settlements|create table settlement_checklist_results|security definer|revoke execute|current_user_has_module\('moving'\)" supabase/migrations/0008_p7a_moving_settlement.sql
rg -n "P7a tables missing|ms_write|scr_write|security-definer RPC missing" supabase/verify/p7a_checks.sql
~~~

Expected: 테이블 2개, RPC 5개, revoke 5개, moving write gate 2개가 확인된다.

### Task 2: movingSettlement API·query·mutation·schema를 TDD로 작성

**Files:**
- Create: hooks/reactquery/movingSettlement/apis.test.ts
- Create: hooks/reactquery/movingSettlement/apis.ts
- Create: hooks/reactquery/movingSettlement/keys.ts
- Create: hooks/reactquery/movingSettlement/queries.ts
- Create: hooks/reactquery/movingSettlement/mutations.ts
- Create: hooks/reactquery/movingSettlement/index.ts
- Create: components/forms/schema/movingSettlement.ts

**Interfaces:**
- SettlementContext는 unit, nullable occupancy/latestSettlement, settleAccount, checklist, meterSummary를 camelCase로 제공한다.
- SaveSettlementInput은 camelCase data/checklist를 받아 RPC p_data/p_checklist의 snake_case로 직렬화한다.
- calculateSettlementAmount는 서버 공식과 동일한 다섯 필드 합산 순수함수다.
- useSettlementContext와 useSettlementList는 null id/빈 날짜일 때 비활성화한다.
- 세 mutation은 성공 시 movingSettlementKeys.all을 무효화한다.

- [ ] **Step 1: 아래 실패 테스트를 먼저 작성한다.**

~~~ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));

import { movingSettlementSchema } from "@/components/forms/schema/movingSettlement";
import {
  calculateSettlementAmount,
  completeMovingSettlement,
  getSettlementContext,
  listSettlements,
  midMoveoutSettlement,
  saveMovingSettlement,
} from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("moving settlement apis", () => {
  it("getSettlementContext: 중첩 RPC 응답을 snake→camel로 매핑한다", async () => {
    rpc.mockResolvedValue({
      data: {
        unit: { id: 101, unit_no: "101호", dong: "A동", building_id: 3 },
        occupancy: {
          id: 9,
          tenant_name: "홍길동",
          move_in_date: "2025-08-01",
          settlement_note: "열쇠 반납",
          billing_note: null,
          status: "moving_out",
        },
        latest_settlement: {
          id: 31,
          unit_id: 101,
          occupancy_id: 9,
          move_out_date: "2026-08-13",
          mgmt_fee_monthly: 300000,
          mgmt_fee_prorated: 125806,
          water_charge: 12000,
          elec_charge: 23000,
          gas_charge: 8000,
          elec_paid_date: "2026-08-12",
          gas_paid_date: null,
          repair_amount: 50000,
          repair_attribution: "owner",
          repair_memo: "도어락",
          settle_bank: "한국은행",
          settle_acct: "123-456",
          settle_holder: "관리사무소",
          settlement_amount: 218806,
          note: "확인",
          settlement_note: "퇴실 정산",
          status: "saved",
          processed_at: null,
          created_at: "2026-08-13T01:00:00Z",
          updated_at: "2026-08-13T02:00:00Z",
        },
        settle_account: {
          settle_bank: "한국은행",
          settle_acct: "123-456",
          settle_holder: "관리사무소",
        },
        checklist: [{ id: 7, label: "열쇠 반납", checked: true }],
        meter_summary: [{ utility: "elec", previous_reading: 100, current_reading: 145, usage: 45 }],
      },
      error: null,
    });

    const context = await getSettlementContext(101);

    expect(rpc).toHaveBeenCalledWith("get_settlement_context", { p_unit_id: 101 });
    expect(context.unit).toEqual({ id: 101, unitNo: "101호", dong: "A동", buildingId: 3 });
    expect(context.occupancy).toMatchObject({
      id: 9,
      tenantName: "홍길동",
      moveInDate: "2025-08-01",
      settlementNote: "열쇠 반납",
      billingNote: null,
      status: "moving_out",
    });
    expect(context.latestSettlement).toMatchObject({
      id: 31,
      unitId: 101,
      occupancyId: 9,
      moveOutDate: "2026-08-13",
      mgmtFeeProrated: 125806,
      elecPaidDate: "2026-08-12",
      repairAttribution: "owner",
      settlementAmount: 218806,
      processedAt: null,
    });
    expect(context.settleAccount).toEqual({
      settleBank: "한국은행",
      settleAcct: "123-456",
      settleHolder: "관리사무소",
    });
    expect(context.checklist).toEqual([{ id: 7, label: "열쇠 반납", checked: true }]);
    expect(context.meterSummary).toEqual([
      { utility: "elec", previousReading: 100, currentReading: 145, usage: 45 },
    ]);
  });

  it("getSettlementContext: nullable 중첩 값을 유지한다", async () => {
    rpc.mockResolvedValue({
      data: {
        unit: { id: 102, unit_no: "102호", dong: null, building_id: 3 },
        occupancy: null,
        latest_settlement: null,
        settle_account: { settle_bank: null, settle_acct: null, settle_holder: null },
        checklist: [],
        meter_summary: [],
      },
      error: null,
    });

    const context = await getSettlementContext(102);

    expect(context.occupancy).toBeNull();
    expect(context.latestSettlement).toBeNull();
    expect(context.unit.dong).toBeNull();
  });

  it("saveMovingSettlement: camel 입력을 RPC의 snake payload로 변환한다", async () => {
    rpc.mockResolvedValue({
      data: { settlement_id: 31, settlement_amount: 218806 },
      error: null,
    });

    const result = await saveMovingSettlement({
      unitId: 101,
      occupancyId: 9,
      settlementId: 31,
      data: {
        moveOutDate: "2026-08-13",
        mgmtFeeMonthly: 300000,
        mgmtFeeProrated: 125806,
        waterCharge: 12000,
        elecCharge: 23000,
        gasCharge: 8000,
        elecPaidDate: "2026-08-12",
        gasPaidDate: null,
        repairAmount: 50000,
        repairAttribution: "owner",
        repairMemo: "도어락",
        settleBank: "한국은행",
        settleAcct: "123-456",
        settleHolder: "관리사무소",
        note: "확인",
        settlementNote: "퇴실 정산",
      },
      checklist: [{ checkItemId: 7, checked: true }],
    });

    expect(rpc).toHaveBeenCalledWith("save_moving_settlement", {
      p_unit_id: 101,
      p_occupancy_id: 9,
      p_settlement_id: 31,
      p_data: {
        move_out_date: "2026-08-13",
        mgmt_fee_monthly: 300000,
        mgmt_fee_prorated: 125806,
        water_charge: 12000,
        elec_charge: 23000,
        gas_charge: 8000,
        elec_paid_date: "2026-08-12",
        gas_paid_date: null,
        repair_amount: 50000,
        repair_attribution: "owner",
        repair_memo: "도어락",
        settle_bank: "한국은행",
        settle_acct: "123-456",
        settle_holder: "관리사무소",
        note: "확인",
        settlement_note: "퇴실 정산",
      },
      p_checklist: [{ check_item_id: 7, checked: true }],
    });
    expect(result).toEqual({ settlementId: 31, settlementAmount: 218806 });
  });

  it("completeMovingSettlement: 완료 RPC를 호출한다", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });

    await expect(completeMovingSettlement(31)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("complete_moving_settlement", { p_settlement_id: 31 });
  });

  it("midMoveoutSettlement: 중도퇴실 RPC를 호출한다", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });

    await expect(midMoveoutSettlement(31)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("mid_moveout_settlement", { p_settlement_id: 31 });
  });

  it("listSettlements: 날짜범위 RPC 결과를 snake→camel로 매핑한다", async () => {
    rpc.mockResolvedValue({
      data: [{
        settlement_id: 31,
        unit_id: 101,
        occupancy_id: 9,
        unit_no: "101호",
        tenant_name: "홍길동",
        status: "completed",
        settlement_amount: 218806,
        move_out_date: "2026-08-13",
        processed_at: "2026-08-13T03:00:00Z",
        created_at: "2026-08-13T01:00:00Z",
      }],
      error: null,
    });

    const rows = await listSettlements(3, "2026-08-01", "2026-08-31");

    expect(rpc).toHaveBeenCalledWith("list_settlements", {
      p_building_id: 3,
      p_from: "2026-08-01",
      p_to: "2026-08-31",
    });
    expect(rows).toEqual([{
      settlementId: 31,
      unitId: 101,
      occupancyId: 9,
      unitNo: "101호",
      tenantName: "홍길동",
      status: "completed",
      settlementAmount: 218806,
      moveOutDate: "2026-08-13",
      processedAt: "2026-08-13T03:00:00Z",
      createdAt: "2026-08-13T01:00:00Z",
    }]);
  });

  it("calculateSettlementAmount: null을 0으로 보고 다섯 금액을 합산한다", () => {
    expect(calculateSettlementAmount({
      mgmtFeeProrated: 125806,
      waterCharge: 12000,
      elecCharge: null,
      gasCharge: 8000,
      repairAmount: 50000,
    })).toBe(195806);
  });

  it("movingSettlementSchema: 퇴실일·정수·0 이상·수리비 귀속을 검증한다", () => {
    const valid = {
      moveOutDate: "2026-08-13",
      mgmtFeeMonthly: 300000,
      mgmtFeeProrated: 125806,
      waterCharge: 0,
      elecCharge: null,
      gasCharge: 8000,
      elecPaidDate: "",
      gasPaidDate: "",
      repairAmount: 50000,
      repairAttribution: "manager" as const,
      repairMemo: "",
      settleBank: "",
      settleAcct: "",
      settleHolder: "",
      note: "",
      settlementNote: "",
    };

    expect(movingSettlementSchema.safeParse(valid).success).toBe(true);
    expect(movingSettlementSchema.safeParse({ ...valid, moveOutDate: "" }).success).toBe(false);
    expect(movingSettlementSchema.safeParse({ ...valid, waterCharge: -1 }).success).toBe(false);
    expect(movingSettlementSchema.safeParse({ ...valid, repairAmount: 1.5 }).success).toBe(false);
    expect(movingSettlementSchema.safeParse({ ...valid, repairAttribution: "tenant" }).success).toBe(false);
  });

  it("RPC 오류를 전달한다", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "조회 실패" } });
    await expect(listSettlements(3, "2026-08-01", "2026-08-31")).rejects.toThrow("조회 실패");
  });
});
~~~

- [ ] **Step 2: 실패를 확인한다.**

~~~powershell
npx vitest run hooks/reactquery/movingSettlement/apis.test.ts
~~~

Expected: FAIL — apis.ts와 movingSettlement schema가 아직 없다는 import error.

- [ ] **Step 3: 아래 exact API wrapper와 mapper를 작성한다.**

~~~ts
import { createClient } from "@/lib/supabase/client";

export type RepairAttribution = "owner" | "manager" | "office";
export type SettlementStatus = "draft" | "saved" | "mid_moveout" | "completed";
export type OccupancyStatus = "occupied" | "vacant" | "moving_out";
export type SettlementUtility = "water" | "elec" | "gas";

export interface MovingSettlement {
  id: number;
  unitId: number;
  occupancyId: number | null;
  moveOutDate: string | null;
  mgmtFeeMonthly: number | null;
  mgmtFeeProrated: number | null;
  waterCharge: number | null;
  elecCharge: number | null;
  gasCharge: number | null;
  elecPaidDate: string | null;
  gasPaidDate: string | null;
  repairAmount: number | null;
  repairAttribution: RepairAttribution | null;
  repairMemo: string | null;
  settleBank: string | null;
  settleAcct: string | null;
  settleHolder: string | null;
  settlementAmount: number | null;
  note: string | null;
  settlementNote: string | null;
  status: SettlementStatus;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeterSummary {
  utility: SettlementUtility;
  previousReading: number | null;
  currentReading: number | null;
  usage: number | null;
}

export interface ChecklistItem {
  id: number;
  label: string;
  checked: boolean;
}

export interface SettlementContext {
  unit: {
    id: number;
    unitNo: string;
    dong: string | null;
    buildingId: number;
  };
  occupancy: {
    id: number;
    tenantName: string | null;
    moveInDate: string | null;
    settlementNote: string | null;
    billingNote: string | null;
    status: OccupancyStatus;
  } | null;
  latestSettlement: MovingSettlement | null;
  settleAccount: {
    settleBank: string | null;
    settleAcct: string | null;
    settleHolder: string | null;
  };
  checklist: ChecklistItem[];
  meterSummary: MeterSummary[];
}

export interface SaveSettlementData {
  moveOutDate: string;
  mgmtFeeMonthly: number | null;
  mgmtFeeProrated: number | null;
  waterCharge: number | null;
  elecCharge: number | null;
  gasCharge: number | null;
  elecPaidDate: string | null;
  gasPaidDate: string | null;
  repairAmount: number | null;
  repairAttribution: RepairAttribution | null;
  repairMemo: string | null;
  settleBank: string | null;
  settleAcct: string | null;
  settleHolder: string | null;
  note: string | null;
  settlementNote: string | null;
}

export interface SaveSettlementInput {
  unitId: number;
  occupancyId: number | null;
  settlementId: number | null;
  data: SaveSettlementData;
  checklist: { checkItemId: number; checked: boolean }[];
}

export interface SettlementListRow {
  settlementId: number;
  unitId: number;
  occupancyId: number | null;
  unitNo: string;
  tenantName: string | null;
  status: SettlementStatus;
  settlementAmount: number | null;
  moveOutDate: string | null;
  processedAt: string | null;
  createdAt: string;
}

interface MovingSettlementRpc {
  id: number;
  unit_id: number;
  occupancy_id: number | null;
  move_out_date: string | null;
  mgmt_fee_monthly: number | null;
  mgmt_fee_prorated: number | null;
  water_charge: number | null;
  elec_charge: number | null;
  gas_charge: number | null;
  elec_paid_date: string | null;
  gas_paid_date: string | null;
  repair_amount: number | null;
  repair_attribution: RepairAttribution | null;
  repair_memo: string | null;
  settle_bank: string | null;
  settle_acct: string | null;
  settle_holder: string | null;
  settlement_amount: number | null;
  note: string | null;
  settlement_note: string | null;
  status: SettlementStatus;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SettlementContextRpc {
  unit: { id: number; unit_no: string; dong: string | null; building_id: number };
  occupancy: {
    id: number;
    tenant_name: string | null;
    move_in_date: string | null;
    settlement_note: string | null;
    billing_note: string | null;
    status: OccupancyStatus;
  } | null;
  latest_settlement: MovingSettlementRpc | null;
  settle_account: {
    settle_bank: string | null;
    settle_acct: string | null;
    settle_holder: string | null;
  };
  checklist: { id: number; label: string; checked: boolean }[];
  meter_summary: {
    utility: SettlementUtility;
    previous_reading: number | null;
    current_reading: number | null;
    usage: number | null;
  }[];
}

interface SettlementListRpc {
  settlement_id: number;
  unit_id: number;
  occupancy_id: number | null;
  unit_no: string;
  tenant_name: string | null;
  status: SettlementStatus;
  settlement_amount: number | null;
  move_out_date: string | null;
  processed_at: string | null;
  created_at: string;
}

function rpcToMovingSettlement(r: MovingSettlementRpc): MovingSettlement {
  return {
    id: r.id,
    unitId: r.unit_id,
    occupancyId: r.occupancy_id,
    moveOutDate: r.move_out_date,
    mgmtFeeMonthly: r.mgmt_fee_monthly,
    mgmtFeeProrated: r.mgmt_fee_prorated,
    waterCharge: r.water_charge,
    elecCharge: r.elec_charge,
    gasCharge: r.gas_charge,
    elecPaidDate: r.elec_paid_date,
    gasPaidDate: r.gas_paid_date,
    repairAmount: r.repair_amount,
    repairAttribution: r.repair_attribution,
    repairMemo: r.repair_memo,
    settleBank: r.settle_bank,
    settleAcct: r.settle_acct,
    settleHolder: r.settle_holder,
    settlementAmount: r.settlement_amount,
    note: r.note,
    settlementNote: r.settlement_note,
    status: r.status,
    processedAt: r.processed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rpcToSettlementContext(r: SettlementContextRpc): SettlementContext {
  return {
    unit: {
      id: r.unit.id,
      unitNo: r.unit.unit_no,
      dong: r.unit.dong,
      buildingId: r.unit.building_id,
    },
    occupancy: r.occupancy
      ? {
          id: r.occupancy.id,
          tenantName: r.occupancy.tenant_name,
          moveInDate: r.occupancy.move_in_date,
          settlementNote: r.occupancy.settlement_note,
          billingNote: r.occupancy.billing_note,
          status: r.occupancy.status,
        }
      : null,
    latestSettlement: r.latest_settlement
      ? rpcToMovingSettlement(r.latest_settlement)
      : null,
    settleAccount: {
      settleBank: r.settle_account.settle_bank,
      settleAcct: r.settle_account.settle_acct,
      settleHolder: r.settle_account.settle_holder,
    },
    checklist: r.checklist.map((item) => ({
      id: item.id,
      label: item.label,
      checked: item.checked,
    })),
    meterSummary: r.meter_summary.map((meter) => ({
      utility: meter.utility,
      previousReading: meter.previous_reading,
      currentReading: meter.current_reading,
      usage: meter.usage,
    })),
  };
}

function settlementDataToRpc(data: SaveSettlementData) {
  return {
    move_out_date: data.moveOutDate,
    mgmt_fee_monthly: data.mgmtFeeMonthly,
    mgmt_fee_prorated: data.mgmtFeeProrated,
    water_charge: data.waterCharge,
    elec_charge: data.elecCharge,
    gas_charge: data.gasCharge,
    elec_paid_date: data.elecPaidDate,
    gas_paid_date: data.gasPaidDate,
    repair_amount: data.repairAmount,
    repair_attribution: data.repairAttribution,
    repair_memo: data.repairMemo,
    settle_bank: data.settleBank,
    settle_acct: data.settleAcct,
    settle_holder: data.settleHolder,
    note: data.note,
    settlement_note: data.settlementNote,
  };
}

function rpcToSettlementListRow(r: SettlementListRpc): SettlementListRow {
  return {
    settlementId: r.settlement_id,
    unitId: r.unit_id,
    occupancyId: r.occupancy_id,
    unitNo: r.unit_no,
    tenantName: r.tenant_name,
    status: r.status,
    settlementAmount: r.settlement_amount,
    moveOutDate: r.move_out_date,
    processedAt: r.processed_at,
    createdAt: r.created_at,
  };
}

export function calculateSettlementAmount(values: Pick<
  SaveSettlementData,
  "mgmtFeeProrated" | "waterCharge" | "elecCharge" | "gasCharge" | "repairAmount"
>): number {
  return (
    (values.mgmtFeeProrated ?? 0) +
    (values.waterCharge ?? 0) +
    (values.elecCharge ?? 0) +
    (values.gasCharge ?? 0) +
    (values.repairAmount ?? 0)
  );
}

export async function getSettlementContext(unitId: number): Promise<SettlementContext> {
  const { data, error } = await createClient().rpc("get_settlement_context", {
    p_unit_id: unitId,
  });
  if (error) throw new Error(error.message);
  return rpcToSettlementContext(data as SettlementContextRpc);
}

export async function saveMovingSettlement(
  input: SaveSettlementInput,
): Promise<{ settlementId: number; settlementAmount: number }> {
  const { data, error } = await createClient().rpc("save_moving_settlement", {
    p_unit_id: input.unitId,
    p_occupancy_id: input.occupancyId,
    p_settlement_id: input.settlementId,
    p_data: settlementDataToRpc(input.data),
    p_checklist: input.checklist.map((item) => ({
      check_item_id: item.checkItemId,
      checked: item.checked,
    })),
  });
  if (error) throw new Error(error.message);
  const result = data as { settlement_id: number; settlement_amount: number };
  return {
    settlementId: result.settlement_id,
    settlementAmount: result.settlement_amount,
  };
}

export async function completeMovingSettlement(
  settlementId: number,
): Promise<{ ok: boolean }> {
  const { data, error } = await createClient().rpc("complete_moving_settlement", {
    p_settlement_id: settlementId,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean };
}

export async function midMoveoutSettlement(
  settlementId: number,
): Promise<{ ok: boolean }> {
  const { data, error } = await createClient().rpc("mid_moveout_settlement", {
    p_settlement_id: settlementId,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean };
}

export async function listSettlements(
  buildingId: number,
  from: string,
  to: string,
): Promise<SettlementListRow[]> {
  const { data, error } = await createClient().rpc("list_settlements", {
    p_building_id: buildingId,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as SettlementListRpc[]).map(rpcToSettlementListRow);
}
~~~

- [ ] **Step 4: 아래 exact key/query/mutation/barrel 파일을 작성한다.**

~~~ts
export const movingSettlementKeys = {
  all: ["movingSettlement"] as const,
  context: (unitId: number | null) =>
    ["movingSettlement", "context", unitId] as const,
  list: (buildingId: number | null, from: string, to: string) =>
    ["movingSettlement", "list", buildingId, from, to] as const,
};
~~~

~~~ts
import { useQuery } from "@tanstack/react-query";
import { getSettlementContext, listSettlements } from "./apis";
import { movingSettlementKeys } from "./keys";

export function useSettlementContext(unitId: number | null) {
  return useQuery({
    queryKey: movingSettlementKeys.context(unitId),
    queryFn: () => getSettlementContext(unitId as number),
    enabled: unitId !== null,
  });
}

export function useSettlementList(
  buildingId: number | null,
  from: string,
  to: string,
) {
  return useQuery({
    queryKey: movingSettlementKeys.list(buildingId, from, to),
    queryFn: () => listSettlements(buildingId as number, from, to),
    enabled: buildingId !== null && from !== "" && to !== "",
  });
}
~~~

~~~ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  completeMovingSettlement,
  midMoveoutSettlement,
  saveMovingSettlement,
  type SaveSettlementInput,
} from "./apis";
import { movingSettlementKeys } from "./keys";

export function useSaveSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveSettlementInput) => saveMovingSettlement(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: movingSettlementKeys.all }),
  });
}

export function useCompleteSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) => completeMovingSettlement(settlementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: movingSettlementKeys.all }),
  });
}

export function useMidMoveout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) => midMoveoutSettlement(settlementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: movingSettlementKeys.all }),
  });
}
~~~

~~~ts
export * from "./apis";
export * from "./keys";
export * from "./queries";
export * from "./mutations";
~~~

- [ ] **Step 5: 아래 exact Zod schema를 작성한다.**

~~~ts
import { z } from "zod";

const amountSchema = z.number().int().min(0).nullable();

export const movingSettlementSchema = z.object({
  moveOutDate: z.string().min(1, "퇴실일을 선택해 주세요"),
  mgmtFeeMonthly: amountSchema,
  mgmtFeeProrated: amountSchema,
  waterCharge: amountSchema,
  elecCharge: amountSchema,
  gasCharge: amountSchema,
  elecPaidDate: z.string().optional(),
  gasPaidDate: z.string().optional(),
  repairAmount: amountSchema,
  repairAttribution: z.enum(["owner", "manager", "office"]).nullable(),
  repairMemo: z.string().optional(),
  settleBank: z.string().optional(),
  settleAcct: z.string().optional(),
  settleHolder: z.string().optional(),
  note: z.string().optional(),
  settlementNote: z.string().optional(),
});

export type MovingSettlementValues = z.infer<typeof movingSettlementSchema>;
~~~

- [ ] **Step 6: focused test와 타입 검사를 통과시킨다.**

~~~powershell
npx vitest run hooks/reactquery/movingSettlement/apis.test.ts
npx tsc --noEmit
~~~

Expected: apis.test.ts Tests 9 passed, TypeScript exit 0.

---

## 그룹 2 — 페이지 · 검침 패널 · 폼 · 체크리스트

### Task 3: 검침 패널과 체크리스트를 TDD로 추가

**Files:**
- Create: app/(staff)/staff/moving-settlement/components/MeterInfoPanel.tsx
- Create: app/(staff)/staff/moving-settlement/components/MeterInfoPanel.test.tsx
- Create: app/(staff)/staff/moving-settlement/components/ChecklistSection.tsx
- Create: app/(staff)/staff/moving-settlement/components/ChecklistSection.test.tsx

- [ ] **Step 1: 실패 테스트를 작성한다.**

~~~tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MeterInfoPanel } from "./MeterInfoPanel";
import { ChecklistSection } from "./ChecklistSection";

describe("moving settlement read panels", () => {
  it("수도·전기·가스 전월·당월·사용량을 표시한다", () => {
    render(<MeterInfoPanel meters={[
      { utility: "water", previousReading: 10, currentReading: 14, usage: 4 },
      { utility: "elec", previousReading: 100, currentReading: 125, usage: 25 },
      { utility: "gas", previousReading: null, currentReading: null, usage: null },
    ]} />);
    expect(screen.getByText("수도")).toBeInTheDocument();
    expect(screen.getByText("125")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("체크 변경을 item id와 함께 전달한다", () => {
    const onChange = vi.fn();
    render(<ChecklistSection
      items={[{ id: 7, label: "열쇠 반납", checked: false }]}
      checked={{ 7: false }}
      onChange={onChange}
    />);
    fireEvent.click(screen.getByRole("checkbox", { name: "열쇠 반납" }));
    expect(onChange).toHaveBeenCalledWith(7, true);
  });
});
~~~

- [ ] **Step 2: 실패를 확인한다.**

~~~powershell
npx vitest run "app/(staff)/staff/moving-settlement/components/MeterInfoPanel.test.tsx" "app/(staff)/staff/moving-settlement/components/ChecklistSection.test.tsx"
~~~

Expected: FAIL — 두 컴포넌트가 아직 없다.

- [ ] **Step 3: MeterInfoPanel.tsx를 작성한다.**

~~~tsx
import type { MeterSummary } from "@/hooks/reactquery/movingSettlement";

const LABELS: Record<MeterSummary["utility"], string> = {
  water: "수도",
  elec: "전기",
  gas: "가스",
};

function reading(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("ko-KR");
}

export function MeterInfoPanel({ meters }: { meters: MeterSummary[] }) {
  const byUtility = new Map(meters.map((meter) => [meter.utility, meter]));
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-base font-extrabold text-t1">검침정보</h2>
      <div className="mt-4 space-y-3">
        {(["water", "elec", "gas"] as const).map((utility) => {
          const meter = byUtility.get(utility);
          return (
            <div key={utility} className="rounded-xl border border-line2 p-3">
              <p className="text-sm font-bold text-t1">{LABELS[utility]}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-t3">전월</dt><dd>{reading(meter?.previousReading ?? null)}</dd></div>
                <div><dt className="text-t3">당월</dt><dd>{reading(meter?.currentReading ?? null)}</dd></div>
                <div><dt className="text-t3">사용량</dt><dd>{reading(meter?.usage ?? null)}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}
~~~

- [ ] **Step 4: ChecklistSection.tsx를 작성한다.**

~~~tsx
import { Checkbox } from "@/components/common";
import type { ChecklistItem } from "@/hooks/reactquery/movingSettlement";

export function ChecklistSection({
  items,
  checked,
  onChange,
}: {
  items: ChecklistItem[];
  checked: Record<number, boolean>;
  onChange: (id: number, checked: boolean) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-base font-extrabold text-t1">시설점검 체크리스트</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-t3">등록된 점검 항목이 없습니다.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <Checkbox
              key={item.id}
              label={item.label}
              checked={checked[item.id] ?? false}
              onChange={(event) => onChange(item.id, event.target.checked)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
~~~

- [ ] **Step 5: 통과를 확인한다.**

~~~powershell
npx vitest run "app/(staff)/staff/moving-settlement/components/MeterInfoPanel.test.tsx" "app/(staff)/staff/moving-settlement/components/ChecklistSection.test.tsx"
~~~

Expected: PASS.

### Task 4: 제어형 정산 폼과 page 상태 흐름을 TDD로 추가

**Files:**
- Create: app/(staff)/staff/moving-settlement/components/SettlementForm.tsx
- Create: app/(staff)/staff/moving-settlement/components/SettlementForm.test.tsx
- Create: app/(staff)/staff/moving-settlement/page.tsx
- Create: app/(staff)/staff/moving-settlement/page.test.tsx

**Interfaces:**
- SettlementForm은 MovingSettlementValues를 제어형으로 받고 값 변경만 전달한다.
- 월액/퇴실일 변경 시 calculateProratedMgmtFee로 일할액을 자동 보조하고 사용자가 일할액을 다시 수정할 수 있다.
- page는 건물→호실 선택, context loading/error/empty, latest settlement 또는 setup account 기본값, checklist 상태를 소유한다.
- 이 태스크에서는 액션·이력·nav를 추가하지 않는다.

- [ ] **Step 1: 폼 실패 테스트를 작성한다.**

~~~tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { calculateProratedMgmtFee, SettlementForm, type SettlementDraft } from "./SettlementForm";

const draft: SettlementDraft = {
  moveOutDate: "2026-08-13",
  mgmtFeeMonthly: 300000,
  mgmtFeeProrated: 125806,
  waterCharge: 12000,
  elecCharge: 23000,
  gasCharge: 8000,
  elecPaidDate: "",
  gasPaidDate: "",
  repairAmount: 50000,
  repairAttribution: "owner",
  repairMemo: "",
  settleBank: "",
  settleAcct: "",
  settleHolder: "",
  note: "",
  settlementNote: "",
};

describe("SettlementForm", () => {
  it("해당 월 총일수로 관리비를 반올림 일할한다", () => {
    expect(calculateProratedMgmtFee(300000, "2026-08-13")).toBe(125806);
    expect(calculateProratedMgmtFee(280000, "2026-02-14")).toBe(140000);
  });

  it("월액 변경 시 일할액을 자동 보조한다", () => {
    const onChange = vi.fn();
    render(<SettlementForm value={draft} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("관리비 월액"), { target: { value: "310000" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mgmtFeeMonthly: 310000,
      mgmtFeeProrated: 130000,
    }));
  });

  it("정산금 합계를 표시한다", () => {
    render(<SettlementForm value={draft} onChange={vi.fn()} />);
    expect(screen.getByText("218,806원")).toBeInTheDocument();
  });
});
~~~

- [ ] **Step 2: 실패를 확인한다.**

~~~powershell
npx vitest run "app/(staff)/staff/moving-settlement/components/SettlementForm.test.tsx"
~~~

Expected: FAIL — SettlementForm이 아직 없다.

- [ ] **Step 3: SettlementForm.tsx를 작성한다.**

~~~tsx
import { Input, Select } from "@/components/common";
import { movingSettlementSchema, type MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import { calculateSettlementAmount } from "@/hooks/reactquery/movingSettlement";

export type SettlementDraft = MovingSettlementValues;

export function calculateProratedMgmtFee(monthly: number | null, moveOutDate: string): number {
  if (monthly === null || moveOutDate === "") return 0;
  const parts = moveOutDate.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.round(monthly * day / daysInMonth);
}

function numberValue(raw: string): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SettlementForm({
  value,
  onChange,
}: {
  value: SettlementDraft;
  onChange: (next: SettlementDraft) => void;
}) {
  const set = <K extends keyof SettlementDraft>(key: K, next: SettlementDraft[K]) =>
    onChange({ ...value, [key]: next });
  const amount = calculateSettlementAmount(value);
  const valid = movingSettlementSchema.safeParse(value).success;

  const setMoveOutDate = (moveOutDate: string) => onChange({
    ...value,
    moveOutDate,
    mgmtFeeProrated: calculateProratedMgmtFee(value.mgmtFeeMonthly, moveOutDate),
  });
  const setMonthly = (mgmtFeeMonthly: number | null) => onChange({
    ...value,
    mgmtFeeMonthly,
    mgmtFeeProrated: calculateProratedMgmtFee(mgmtFeeMonthly, value.moveOutDate),
  });

  const amountInput = (
    label: string,
    key: "mgmtFeeMonthly" | "mgmtFeeProrated" | "waterCharge" | "elecCharge" | "gasCharge" | "repairAmount",
    onAmount?: (next: number | null) => void,
  ) => (
    <label>
      <span className="mb-1.5 block text-xs font-bold text-t2">{label}</span>
      <Input
        aria-label={label}
        type="number"
        min={0}
        step={1}
        value={value[key] ?? ""}
        onChange={(event) => (onAmount ?? ((next) => set(key, next)))(numberValue(event.target.value))}
      />
    </label>
  );

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-t1">이사정산 입력</h2>
        <span className={valid ? "text-xs font-bold text-green" : "text-xs font-bold text-red"}>
          {valid ? "입력 가능" : "필수값 확인"}
        </span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">퇴실일</span>
          <Input aria-label="퇴실일" type="date" value={value.moveOutDate}
            onChange={(event) => setMoveOutDate(event.target.value)} />
        </label>
        {amountInput("관리비 월액", "mgmtFeeMonthly", setMonthly)}
        {amountInput("관리비 일할", "mgmtFeeProrated")}
        {amountInput("수도 요금", "waterCharge")}
        {amountInput("전기 요금", "elecCharge")}
        {amountInput("가스 요금", "gasCharge")}
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">전기 입금일</span>
          <Input aria-label="전기 입금일" type="date" value={value.elecPaidDate ?? ""}
            onChange={(event) => set("elecPaidDate", event.target.value)} />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">가스 입금일</span>
          <Input aria-label="가스 입금일" type="date" value={value.gasPaidDate ?? ""}
            onChange={(event) => set("gasPaidDate", event.target.value)} />
        </label>
        {amountInput("수리비", "repairAmount")}
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">수리비 귀속</span>
          <Select
            aria-label="수리비 귀속"
            value={value.repairAttribution ?? ""}
            onChange={(event) => set("repairAttribution", event.target.value === "" ? null : event.target.value as "owner" | "manager" | "office")}
            options={[
              { value: "", label: "선택 안 함" },
              { value: "owner", label: "건물주" },
              { value: "manager", label: "관리자" },
              { value: "office", label: "관리실" },
            ]}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-bold text-t2">수리 메모</span>
          <Input aria-label="수리 메모" value={value.repairMemo ?? ""}
            onChange={(event) => set("repairMemo", event.target.value)} />
        </label>
        <label><span className="mb-1.5 block text-xs font-bold text-t2">정산 은행</span>
          <Input aria-label="정산 은행" value={value.settleBank ?? ""} onChange={(event) => set("settleBank", event.target.value)} />
        </label>
        <label><span className="mb-1.5 block text-xs font-bold text-t2">정산 계좌</span>
          <Input aria-label="정산 계좌" value={value.settleAcct ?? ""} onChange={(event) => set("settleAcct", event.target.value)} />
        </label>
        <label><span className="mb-1.5 block text-xs font-bold text-t2">예금주</span>
          <Input aria-label="예금주" value={value.settleHolder ?? ""} onChange={(event) => set("settleHolder", event.target.value)} />
        </label>
        <label><span className="mb-1.5 block text-xs font-bold text-t2">비고</span>
          <Input aria-label="비고" value={value.note ?? ""} onChange={(event) => set("note", event.target.value)} />
        </label>
        <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold text-t2">이사정산 적요</span>
          <Input aria-label="이사정산 적요" value={value.settlementNote ?? ""} onChange={(event) => set("settlementNote", event.target.value)} />
        </label>
      </div>
      <div className="mt-5 rounded-xl bg-blue-t p-4 text-right">
        <span className="text-sm font-bold text-t2">정산금 </span>
        <strong className="text-xl text-blue-d">{amount.toLocaleString("ko-KR")}원</strong>
      </div>
    </section>
  );
}
~~~

- [ ] **Step 4: page 실패 테스트를 작성한다.**

~~~tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/units", () => ({ useUnits: vi.fn() }));
vi.mock("@/hooks/reactquery/movingSettlement", () => ({ useSettlementContext: vi.fn() }));

import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useUnits } from "@/hooks/reactquery/units";
import { useSettlementContext } from "@/hooks/reactquery/movingSettlement";
import MovingSettlementPage from "./page";

beforeEach(() => {
  vi.mocked(useMe).mockReturnValue({ data: { role: "staff", permissions: ["moving"] } } as never);
  vi.mocked(useBuildings).mockReturnValue({ data: [{ id: 3, name: "해오름" }], isLoading: false } as never);
  vi.mocked(useUnits).mockReturnValue({ data: [{ id: 101, unitNo: "101호", dong: "A동" }], isLoading: false } as never);
  vi.mocked(useSettlementContext).mockReturnValue({
    data: {
      unit: { id: 101, unitNo: "101호", dong: "A동", buildingId: 3 },
      occupancy: { id: 9, tenantName: "홍길동", moveInDate: "2025-08-01", settlementNote: null, billingNote: null, status: "occupied" },
      latestSettlement: null,
      settleAccount: { settleBank: "한국은행", settleAcct: "123", settleHolder: "관리실" },
      checklist: [{ id: 7, label: "열쇠 반납", checked: false }],
      meterSummary: [{ utility: "water", previousReading: 10, currentReading: 14, usage: 4 }],
    },
    isLoading: false,
    error: null,
  } as never);
});

describe("MovingSettlementPage", () => {
  it("건물·호실 선택 뒤 context를 표시한다", () => {
    render(<MovingSettlementPage />);
    fireEvent.change(screen.getByLabelText("건물 선택"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("호실 선택"), { target: { value: "101" } });
    expect(useSettlementContext).toHaveBeenLastCalledWith(101);
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByLabelText("정산 은행")).toHaveValue("한국은행");
    expect(screen.getByRole("checkbox", { name: "열쇠 반납" })).toBeInTheDocument();
  });
});
~~~

- [ ] **Step 5: page.tsx를 구현한다. page는 다음 exact 상태/초기화 계약을 사용한다.**

~~~tsx
"use client";

import { useEffect, useState } from "react";
import { EmptyState, Select, Spinner } from "@/components/common";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useSettlementContext, type SettlementContext } from "@/hooks/reactquery/movingSettlement";
import { useUnits } from "@/hooks/reactquery/units";
import { hasModule } from "@/lib/auth/permissions";
import { ChecklistSection } from "./components/ChecklistSection";
import { MeterInfoPanel } from "./components/MeterInfoPanel";
import { SettlementForm } from "./components/SettlementForm";

function draftFromContext(context: SettlementContext): MovingSettlementValues {
  const saved = context.latestSettlement;
  return {
    moveOutDate: saved?.moveOutDate ?? "",
    mgmtFeeMonthly: saved?.mgmtFeeMonthly ?? null,
    mgmtFeeProrated: saved?.mgmtFeeProrated ?? null,
    waterCharge: saved?.waterCharge ?? null,
    elecCharge: saved?.elecCharge ?? null,
    gasCharge: saved?.gasCharge ?? null,
    elecPaidDate: saved?.elecPaidDate ?? "",
    gasPaidDate: saved?.gasPaidDate ?? "",
    repairAmount: saved?.repairAmount ?? null,
    repairAttribution: saved?.repairAttribution ?? null,
    repairMemo: saved?.repairMemo ?? "",
    settleBank: saved?.settleBank ?? context.settleAccount.settleBank ?? "",
    settleAcct: saved?.settleAcct ?? context.settleAccount.settleAcct ?? "",
    settleHolder: saved?.settleHolder ?? context.settleAccount.settleHolder ?? "",
    note: saved?.note ?? "",
    settlementNote: saved?.settlementNote ?? context.occupancy?.settlementNote ?? "",
  };
}

export default function MovingSettlementPage() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const unitsQuery = useUnits(buildingId ?? 0);
  const contextQuery = useSettlementContext(unitId);
  const [draft, setDraft] = useState<MovingSettlementValues | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!contextQuery.data) return;
    setDraft(draftFromContext(contextQuery.data));
    setChecked(Object.fromEntries(contextQuery.data.checklist.map((item) => [item.id, item.checked])));
  }, [contextQuery.data]);

  if (me === undefined) return null;
  if (!hasModule(me, "moving")) {
    return <div className="p-6"><EmptyState message="이 화면에 접근할 권한이 없습니다. (이사정산 권한 필요)" /></div>;
  }

  const buildings = buildingsQuery.data ?? [];
  const units = unitsQuery.data ?? [];
  const context = contextQuery.data;

  return (
    <div className="flex min-h-screen flex-col gap-5 p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold text-t3">관리업무 · 이사정산</p>
        <h1 className="mt-1 text-2xl font-extrabold text-t1">이사정산</h1>
      </div>
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="mb-1.5 block text-xs font-bold text-t2">건물 선택</span>
            <Select aria-label="건물 선택" value={buildingId?.toString() ?? ""}
              onChange={(event) => { setBuildingId(event.target.value ? Number(event.target.value) : null); setUnitId(null); }}
              options={[{ value: "", label: "건물을 선택해 주세요" }, ...buildings.map((building) => ({ value: String(building.id), label: building.name }))]} />
          </label>
          <label><span className="mb-1.5 block text-xs font-bold text-t2">호실 선택</span>
            <Select aria-label="호실 선택" value={unitId?.toString() ?? ""} disabled={buildingId === null || unitsQuery.isLoading}
              onChange={(event) => setUnitId(event.target.value ? Number(event.target.value) : null)}
              options={[{ value: "", label: "호실을 선택해 주세요" }, ...units.map((unit) => ({ value: String(unit.id), label: [unit.dong, unit.unitNo].filter(Boolean).join(" ") }))]} />
          </label>
        </div>
      </section>
      {unitId === null && <EmptyState message="정산할 호실을 선택해 주세요" />}
      {unitId !== null && contextQuery.isLoading && <Spinner />}
      {unitId !== null && contextQuery.error && <EmptyState message="정산 정보를 불러오지 못했습니다." />}
      {context && context.occupancy === null && <EmptyState message="선택한 호실에 입주 정보가 없습니다." />}
      {context && context.occupancy && draft && (
        <>
          <div className="rounded-xl bg-blue-t px-4 py-3 text-sm font-bold text-blue-d">
            {context.unit.unitNo} · {context.occupancy.tenantName ?? "입주자 미등록"}
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[320px_1fr]">
            <MeterInfoPanel meters={context.meterSummary} />
            <SettlementForm value={draft} onChange={setDraft} />
          </div>
          <ChecklistSection
            items={context.checklist}
            checked={checked}
            onChange={(id, next) => setChecked((current) => ({ ...current, [id]: next }))}
          />
        </>
      )}
    </div>
  );
}
~~~

- [ ] **Step 6: 그룹 2 focused tests와 타입 검사를 통과시킨다.**

~~~powershell
npx vitest run "app/(staff)/staff/moving-settlement/page.test.tsx" "app/(staff)/staff/moving-settlement/components/MeterInfoPanel.test.tsx" "app/(staff)/staff/moving-settlement/components/ChecklistSection.test.tsx" "app/(staff)/staff/moving-settlement/components/SettlementForm.test.tsx"
npx tsc --noEmit
~~~

Expected: 모든 그룹 2 테스트 PASS, TypeScript exit 0.

---

## 그룹 3 — 액션 · 이력 · nav

### Task 5: 네 액션과 미납 확인 모달을 TDD로 추가

**Files:**
- Create: app/(staff)/staff/moving-settlement/components/SettlementActions.tsx
- Create: app/(staff)/staff/moving-settlement/components/SettlementActions.test.tsx
- Modify: app/(staff)/staff/moving-settlement/page.tsx

**Interfaces:**
- 정산금 계산은 로컬 합산만 하고 저장하지 않는다.
- 계산+저장은 현재 draft를 Zod 검증한 뒤 save mutation을 호출하고 반환 settlement id를 page에 반영한다.
- 중도퇴실은 window.confirm 이후 기존 settlement id로 RPC를 호출한다.
- 정산완료+공실은 미납 수납이 실제 처리되지 않는다는 Modal 확인 이후 RPC를 호출한다.
- 출력·빈양식은 toast.info stub이다.

- [ ] **Step 1: 실패 테스트를 작성한다.**

~~~tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMutate = vi.fn();
const completeMutate = vi.fn();
const midMutate = vi.fn();
vi.mock("@/hooks/reactquery/movingSettlement", () => ({
  useSaveSettlement: () => ({ mutate: saveMutate, isPending: false }),
  useCompleteSettlement: () => ({ mutate: completeMutate, isPending: false }),
  useMidMoveout: () => ({ mutate: midMutate, isPending: false }),
}));

import { SettlementActions } from "./SettlementActions";

const draft = {
  moveOutDate: "2026-08-13", mgmtFeeMonthly: 300000, mgmtFeeProrated: 125806,
  waterCharge: 12000, elecCharge: 23000, gasCharge: 8000,
  elecPaidDate: "", gasPaidDate: "", repairAmount: 50000, repairAttribution: "owner" as const,
  repairMemo: "", settleBank: "", settleAcct: "", settleHolder: "", note: "", settlementNote: "",
};
const input = {
  unitId: 101, occupancyId: 9, settlementId: 31,
  data: {
    ...draft, elecPaidDate: null, gasPaidDate: null, repairMemo: null,
    settleBank: null, settleAcct: null, settleHolder: null, note: null, settlementNote: null,
  },
  checklist: [{ checkItemId: 7, checked: true }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("SettlementActions", () => {
  it("계산+저장 payload를 mutation에 전달한다", () => {
    render(<SettlementActions draft={draft} input={input} settlementId={31} amount={218806} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "계산+저장" }));
    expect(saveMutate).toHaveBeenCalledWith(input, expect.any(Object));
  });

  it("중도퇴실 확인 뒤 RPC mutation을 호출한다", () => {
    render(<SettlementActions draft={draft} input={input} settlementId={31} amount={218806} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "중도퇴실" }));
    expect(midMutate).toHaveBeenCalledWith(31, expect.any(Object));
  });

  it("미납 확인 모달 뒤 정산완료를 호출한다", () => {
    render(<SettlementActions draft={draft} input={input} settlementId={31} amount={218806} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "정산완료+공실" }));
    expect(screen.getByText("미납 수납 확인")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "확인하고 완료" }));
    expect(completeMutate).toHaveBeenCalledWith(31, expect.any(Object));
  });
});
~~~

- [ ] **Step 2: 실패를 확인한다.**

~~~powershell
npx vitest run "app/(staff)/staff/moving-settlement/components/SettlementActions.test.tsx"
~~~

Expected: FAIL — SettlementActions가 아직 없다.

- [ ] **Step 3: SettlementActions.tsx를 작성한다.**

~~~tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Modal } from "@/components/common";
import { movingSettlementSchema, type MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import {
  useCompleteSettlement,
  useMidMoveout,
  useSaveSettlement,
  type SaveSettlementInput,
} from "@/hooks/reactquery/movingSettlement";

export function SettlementActions({
  draft,
  input,
  settlementId,
  amount,
  onSaved,
}: {
  draft: MovingSettlementValues;
  input: SaveSettlementInput;
  settlementId: number | null;
  amount: number;
  onSaved: (id: number) => void;
}) {
  const save = useSaveSettlement();
  const complete = useCompleteSettlement();
  const mid = useMidMoveout();
  const [completeOpen, setCompleteOpen] = useState(false);
  const pending = save.isPending || complete.isPending || mid.isPending;

  const validate = () => {
    const result = movingSettlementSchema.safeParse(draft);
    if (!result.success) toast.error("퇴실일과 금액 입력값을 확인해 주세요.");
    return result.success;
  };

  const calculate = () => {
    if (validate()) toast.success("정산금은 " + amount.toLocaleString("ko-KR") + "원입니다.");
  };

  const saveNow = () => {
    if (!validate()) return;
    save.mutate(input, {
      onSuccess: (result) => {
        onSaved(result.settlementId);
        toast.success("이사정산을 저장했습니다.");
      },
      onError: () => toast.error("이사정산 저장에 실패했습니다."),
    });
  };

  const midMoveout = () => {
    if (settlementId === null) {
      toast.error("먼저 계산+저장을 실행해 주세요.");
      return;
    }
    if (!window.confirm("중도퇴실로 처리하시겠습니까?")) return;
    mid.mutate(settlementId, {
      onSuccess: () => toast.success("중도퇴실로 처리했습니다."),
      onError: () => toast.error("중도퇴실 처리에 실패했습니다."),
    });
  };

  const completeNow = () => {
    if (settlementId === null) {
      toast.error("먼저 계산+저장을 실행해 주세요.");
      setCompleteOpen(false);
      return;
    }
    complete.mutate(settlementId, {
      onSuccess: () => {
        setCompleteOpen(false);
        toast.success("정산을 완료하고 공실로 전환했습니다.");
      },
      onError: () => toast.error("정산완료 처리에 실패했습니다."),
    });
  };

  const exportStub = (label: string) =>
    toast.info(label + " 출력은 엑셀 연동 후 제공됩니다.");

  return (
    <>
      <section className="flex flex-wrap justify-end gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <Button variant="ghost" onClick={() => exportStub("정산내역서")}>출력</Button>
        <Button variant="ghost" onClick={() => exportStub("빈양식")}>빈양식</Button>
        <Button variant="ghost" onClick={calculate} disabled={pending}>정산금 계산</Button>
        <Button onClick={saveNow} disabled={pending}>계산+저장</Button>
        <Button variant="ghost" onClick={midMoveout} disabled={pending}>중도퇴실</Button>
        <Button variant="danger" onClick={() => setCompleteOpen(true)} disabled={pending}>정산완료+공실</Button>
      </section>
      <Modal open={completeOpen} onClose={() => setCompleteOpen(false)} title="미납 수납 확인">
        <p className="text-sm text-t2">미납 수납 기능은 아직 연결되지 않았습니다. 미납 여부를 별도로 확인한 뒤 공실 처리해 주세요.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCompleteOpen(false)}>취소</Button>
          <Button variant="danger" onClick={completeNow}>확인하고 완료</Button>
        </div>
      </Modal>
    </>
  );
}
~~~

- [ ] **Step 4: page.tsx에 다음 exact 변환/배선을 추가한다.**

~~~tsx
import { calculateSettlementAmount, type SaveSettlementInput } from "@/hooks/reactquery/movingSettlement";
import { SettlementActions } from "./components/SettlementActions";

const [activeSettlementId, setActiveSettlementId] = useState<number | null>(null);

useEffect(() => {
  if (!contextQuery.data) return;
  setActiveSettlementId(contextQuery.data.latestSettlement?.id ?? null);
}, [contextQuery.data]);

const nullableText = (value: string | undefined): string | null =>
  value && value.trim() !== "" ? value.trim() : null;

const saveInput: SaveSettlementInput | null = context && context.occupancy && draft ? {
  unitId: context.unit.id,
  occupancyId: context.occupancy.id,
  settlementId: activeSettlementId,
  data: {
    moveOutDate: draft.moveOutDate,
    mgmtFeeMonthly: draft.mgmtFeeMonthly,
    mgmtFeeProrated: draft.mgmtFeeProrated,
    waterCharge: draft.waterCharge,
    elecCharge: draft.elecCharge,
    gasCharge: draft.gasCharge,
    elecPaidDate: nullableText(draft.elecPaidDate),
    gasPaidDate: nullableText(draft.gasPaidDate),
    repairAmount: draft.repairAmount,
    repairAttribution: draft.repairAttribution,
    repairMemo: nullableText(draft.repairMemo),
    settleBank: nullableText(draft.settleBank),
    settleAcct: nullableText(draft.settleAcct),
    settleHolder: nullableText(draft.settleHolder),
    note: nullableText(draft.note),
    settlementNote: nullableText(draft.settlementNote),
  },
  checklist: context.checklist.map((item) => ({
    checkItemId: item.id,
    checked: checked[item.id] ?? false,
  })),
} : null;
~~~

SettlementForm과 ChecklistSection 뒤, 선택 context 블록 안에 다음을 렌더한다.

~~~tsx
{saveInput && draft && (
  <SettlementActions
    draft={draft}
    input={saveInput}
    settlementId={activeSettlementId}
    amount={calculateSettlementAmount(draft)}
    onSaved={setActiveSettlementId}
  />
)}
~~~

- [ ] **Step 5: 액션 테스트와 page 회귀 테스트를 통과시킨다.**

~~~powershell
npx vitest run "app/(staff)/staff/moving-settlement/components/SettlementActions.test.tsx" "app/(staff)/staff/moving-settlement/page.test.tsx"
~~~

Expected: PASS.

### Task 6: 날짜범위 이력과 nav 활성화를 TDD로 추가

**Files:**
- Create: app/(staff)/staff/moving-settlement/components/SettlementHistory.tsx
- Create: app/(staff)/staff/moving-settlement/components/SettlementHistory.test.tsx
- Modify: app/(staff)/staff/moving-settlement/page.tsx
- Modify: components/shell/navItems.ts

- [ ] **Step 1: 이력 실패 테스트를 작성한다.**

~~~tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/movingSettlement", () => ({ useSettlementList: vi.fn() }));
import { useSettlementList } from "@/hooks/reactquery/movingSettlement";
import { SettlementHistory } from "./SettlementHistory";

describe("SettlementHistory", () => {
  it("날짜범위 조회 결과를 표시한다", () => {
    vi.mocked(useSettlementList).mockReturnValue({
      data: [{
        settlementId: 31, unitId: 101, occupancyId: 9, unitNo: "101호", tenantName: "홍길동",
        status: "completed", settlementAmount: 218806, moveOutDate: "2026-08-13",
        processedAt: "2026-08-13T03:00:00Z", createdAt: "2026-08-13T01:00:00Z",
      }],
      isLoading: false,
      error: null,
    } as never);
    render(<SettlementHistory buildingId={3} />);
    expect(screen.getByText("101호")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("218,806원")).toBeInTheDocument();
  });
});
~~~

- [ ] **Step 2: 실패를 확인한다.**

~~~powershell
npx vitest run "app/(staff)/staff/moving-settlement/components/SettlementHistory.test.tsx"
~~~

Expected: FAIL — SettlementHistory가 아직 없다.

- [ ] **Step 3: SettlementHistory.tsx를 작성한다.**

~~~tsx
"use client";

import { useState } from "react";
import { EmptyState, Input, Spinner } from "@/components/common";
import { useSettlementList, type SettlementStatus } from "@/hooks/reactquery/movingSettlement";

const STATUS: Record<SettlementStatus, string> = {
  draft: "작성중",
  saved: "저장",
  mid_moveout: "중도퇴실",
  completed: "정산완료",
};

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const year = local.getFullYear();
  const month = local.getMonth() + 1;
  const from = String(year) + "-" + String(month).padStart(2, "0") + "-01";
  const to = new Date(year, month, 0).toISOString().slice(0, 10);
  return { from, to };
}

export function SettlementHistory({ buildingId }: { buildingId: number | null }) {
  const initial = currentMonthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const query = useSettlementList(buildingId, from, to);
  const rows = query.data ?? [];

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="mr-auto text-base font-extrabold text-t1">이사정산 이력</h2>
        <label><span className="mb-1 block text-xs font-bold text-t2">시작일</span>
          <Input aria-label="이력 시작일" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label><span className="mb-1 block text-xs font-bold text-t2">종료일</span>
          <Input aria-label="이력 종료일" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>
      {buildingId === null && <EmptyState message="건물을 선택하면 이력을 조회합니다." />}
      {buildingId !== null && query.isLoading && <Spinner />}
      {buildingId !== null && query.error && <EmptyState message="정산 이력을 불러오지 못했습니다." />}
      {buildingId !== null && !query.isLoading && !query.error && rows.length === 0 && <EmptyState message="조회 기간의 정산 이력이 없습니다." />}
      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-bg">
              <th className="px-3 py-2 text-left">퇴실일</th><th className="px-3 py-2 text-left">호실</th>
              <th className="px-3 py-2 text-left">입주자</th><th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-right">정산금</th>
            </tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.settlementId} className="border-b border-line2">
                <td className="px-3 py-2">{row.moveOutDate ?? "-"}</td>
                <td className="px-3 py-2">{row.unitNo}</td>
                <td className="px-3 py-2">{row.tenantName ?? "-"}</td>
                <td className="px-3 py-2">{STATUS[row.status]}</td>
                <td className="px-3 py-2 text-right">{(row.settlementAmount ?? 0).toLocaleString("ko-KR")}원</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
~~~

- [ ] **Step 4: page.tsx에 이력을 배선한다.**

Import:

~~~tsx
import { SettlementHistory } from "./components/SettlementHistory";
~~~

최상위 div의 마지막 자식으로 렌더:

~~~tsx
<SettlementHistory buildingId={buildingId} />
~~~

- [ ] **Step 5: navItems.ts의 기존 이사정산 한 줄만 exact 교체한다.**

~~~ts
{ label: "이사정산", href: "/staff/moving-settlement", module: "moving", built: true, icon: "M3 8l9-4 9 4-9 4-9-4zM3 8v8l9 4 9-4V8" },
~~~

주의: 기존 icon path 문자열은 실제 파일 값을 그대로 보존하고 built 값만 false에서 true로 바꾼다. 위 코드의 icon은 계획 작성 시점 기존 값을 복사한 것이며 구현 직전 navItems.ts를 다시 확인한다.

- [ ] **Step 6: 그룹 3과 전체 P7a 검증을 실행한다.**

~~~powershell
npx vitest run "app/(staff)/staff/moving-settlement/components/SettlementActions.test.tsx" "app/(staff)/staff/moving-settlement/components/SettlementHistory.test.tsx" "app/(staff)/staff/moving-settlement/page.test.tsx"
npx vitest run hooks/reactquery/movingSettlement/apis.test.ts
npx tsc --noEmit
npm run lint
~~~

Expected: 모든 P7a test PASS, TypeScript exit 0, lint exit 0.

- [ ] **Step 7: verify SQL을 적용 환경에서 실행한다.**

~~~powershell
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/verify/p7a_checks.sql
~~~

Expected: exception 없이 종료. 네트워크가 없는 구현 워커는 실행하지 않고 사용자 PC/오케스트레이터에 넘긴다.

---

## Self-Review

**Spec coverage:**
- §3 테이블 2개·인덱스·0001 do-block updated_at trigger → 그룹 1 Task 1. ✅
- §4 RPC 5개·security definer·anon revoke·org/module 내부 검증 → 그룹 1 Task 1. ✅
- §5 org-open SELECT·moving write RLS·unit→building→org와 settlement→unit→building→org 조인 → 그룹 1 Task 1. ✅
- §6 snake↔camel API·필수 6타입·keys/queries/mutations/index·Zod → 그룹 1 Task 2. ✅
- §7 page·MeterInfoPanel·SettlementForm·ChecklistSection → 그룹 2. SettlementActions·SettlementHistory·nav → 그룹 3. ✅
- §8 mapper/save/list/sum/Zod/API tests, 컴포넌트 RTL, verify SQL, tsc/lint → 각 TDD 태스크와 최종 검증. ✅
- §9 0008→verify 순서와 라이브 적용 분리 → Global Constraints와 그룹 3 Step 7. ✅
- §10 정확히 3그룹 → 본 계획 구조. ✅

**Security review:**
- get/list는 current_user_org 범위만 읽고 save/complete/mid는 moving 모듈을 추가 검증한다. ✅
- save는 occupancy가 unit에 속하는지, checklist item이 caller org에 속하는지 검증한다. ✅
- complete/mid는 settlement→unit→building→org를 확인하고 occupancy id/unit을 함께 제한한다. ✅
- RLS SELECT와 write 정책은 spec의 조인 경로를 그대로 사용한다. ✅

**Data contract review:**
- DB elec는 UI에서도 MeterSummary utility의 elec로 유지하며 별도 electricity 변환을 만들지 않는다. ✅
- 모든 MovingSettlement 필드와 context/list 반환 필드가 snake↔camel 1:1이다. ✅
- SaveSettlementInput의 null/빈 문자열 정규화와 서버 nullif cast가 일치한다. ✅
- 정산금 클라이언트 순수함수와 서버 계산식이 같은 다섯 필드·null→0 규칙이다. ✅
- 건물 manager_name 의존이 없고 room_type_label은 complete 시 room_types.label 스냅샷이다. ✅

**Scope review:**
- 그룹 1에는 UI/nav 변경이 없다. ✅
- 실제 payments, xlsx, messaging, billing/단가 자동화는 구현하지 않고 stub/후속으로 남긴다. ✅
- 별도 수도지침 이월 write가 없다. ✅
- 네트워크 설치와 git 명령이 없다. ✅

**Implementation caution:** navItems icon은 built 외 문자를 바꾸지 않는다. complete는 이미 completed인 settlement에 idempotent하게 ok를 반환하여 occupancy_history 중복 INSERT를 피한다. live 적용 전 병렬 worktree의 migration 번호 충돌 여부를 오케스트레이터가 확인한다.

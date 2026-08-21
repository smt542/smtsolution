# 관리비 세팅 마감(§3.3 신규입주 당월부과 · §3.4 셋팅확인 체크박스) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (인라인, codex 토큰 소진으로 Claude 직접). Steps use checkbox syntax.

**Goal:** 관리비 세팅 화면의 마지막 PRD 공백 2건 구현 — 부과확정 이후 신규입주 세대 당월부과 팝업(§3.3), 건물 셋팅확인 체크박스(§3.4).

**Architecture:** 기존 부과 슬라이스(0012/0021·`hooks/reactquery/billing`·`app/(staff)/staff/management-fee`) 위에 컬럼 1 + RPC 3 + 훅 + 모달 1 + 페이지 배선. confirm_billing 재실행 대신 대상세대 전용 RPC. §3.4 지속화는 shared `save_building` 미변경, 전용 경량 RPC(0073 `receipts_save_building_notes` 선례).

**Tech Stack:** Next.js(App Router)·Supabase RPC(security definer)·@tanstack/react-query·vitest·Tailwind.

## Global Constraints
- 마이그 번호: 커밋 직전 `git fetch && git log origin/master` max 재확인. 작성시 max=`0091` → **0092** 예정. ([[migration-number-collision]])
- 금액 계산은 `confirm_billing`(0021)과 **1:1 동일**(이월 prefill·30일 일할·round_charge). 미러링 주석 필수.
- RPC 전부 `security definer set search_path=public`, `revoke ... from public, anon; grant ... to authenticated;`.
- 물/전기/가스 공유 billing lib(`lib/billing/*`)·`confirm_billing`·`save_building` **무수정**(회귀 금지).
- 스타일: 파랑 #3182F6 앱 표준(청록 아님). 기존 `Modal`/`Button`(@/components/common) 재사용.

---

### Task 1: DB 마이그레이션 0092 (컬럼 + RPC 3)

**Files:**
- Create: `supabase/migrations/0092_management_fee_setting_finish.sql`

**Interfaces (Produces):**
- `list_uncharged_new_occupancies(p_building_id bigint, p_period date) → table(unit_id bigint, unit_no text, dong text, tenant_name text, move_in_date date)`
- `charge_new_occupancies(p_building_id bigint, p_period date, p_unit_ids bigint[]) → jsonb {unit_count, total}`
- `set_building_setup_confirm(p_id bigint, p_required boolean) → void`
- `buildings.setup_confirm_required boolean not null default false`

- [ ] **Step 1: 마이그 작성** (full SQL)

```sql
-- 0092_management_fee_setting_finish.sql
-- 관리비 세팅 §3.3 신규입주 당월부과 + §3.4 건물 셋팅확인 체크박스
-- 의존: 0001(buildings·units·occupancies·fee_items), 0012/0021(fee_item_charges·billing_confirmations·billing_history·round_charge·confirm_billing)
-- confirm_billing / save_building 무수정. 계산은 confirm_billing(0021) 세대루프 미러링.

-- ===== §3.4 컬럼 =====
alter table buildings add column if not exists setup_confirm_required boolean not null default false;

-- ===== §3.4 전용 토글 RPC (shared save_building 미변경) =====
create or replace function set_building_setup_confirm(p_id bigint, p_required boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not exists (select 1 from buildings where id = p_id and org_id = v_org and deleted_at is null) then
    raise exception 'building not in org'; end if;
  update buildings set setup_confirm_required = coalesce(p_required, false) where id = p_id;
end $$;
revoke execute on function set_building_setup_confirm(bigint, boolean) from public, anon;
grant execute on function set_building_setup_confirm(bigint, boolean) to authenticated;

-- ===== §3.3 감지: 부과확정 이후 등록된 미부과 신규 세대 =====
create or replace function list_uncharged_new_occupancies(p_building_id bigint, p_period date)
returns table(unit_id bigint, unit_no text, dong text, tenant_name text, move_in_date date)
language sql stable security definer set search_path = public as $$
  with b as (
    select id from buildings where id = p_building_id and org_id = current_user_org() and deleted_at is null
  ),
  confirmed_at_max as (
    select max(bc.confirmed_at) as v
    from billing_confirmations bc
    join units u on u.id = bc.unit_id
    where u.building_id = p_building_id and bc.period = p_period and bc.confirmed_at is not null
  ),
  latest_occ as (
    select distinct on (o.unit_id)
      o.unit_id, o.tenant_name, o.move_in_date, o.status, o.created_at
    from occupancies o
    join units u on u.id = o.unit_id
    where u.building_id = p_building_id and o.deleted_at is null
    order by o.unit_id, o.created_at desc, o.id desc
  )
  select u.id, u.unit_no, u.dong, lo.tenant_name, lo.move_in_date
  from units u
  join b on true
  join latest_occ lo on lo.unit_id = u.id
  cross join confirmed_at_max cm
  where u.deleted_at is null
    and cm.v is not null                          -- 건물 미확정이면 빈 결과
    and lo.status = 'occupied'
    and lo.created_at > cm.v                       -- 확정 이후 등록
    and not exists (                               -- 당월 확정 안 됨
      select 1 from billing_confirmations bc
      where bc.unit_id = u.id and bc.period = p_period and bc.confirmed_at is not null
    )
  order by u.unit_no;
$$;
revoke execute on function list_uncharged_new_occupancies(bigint, date) from public, anon;
grant execute on function list_uncharged_new_occupancies(bigint, date) to authenticated;

-- ===== §3.3 부과: 감지 대상 세대만 당월 부과 (confirm_billing 세대루프 미러링) =====
create or replace function charge_new_occupancies(p_building_id bigint, p_period date, p_unit_ids bigint[])
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
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed'; end if;

  v_days := extract(day from ((p_period + interval '1 month')::date - 1))::int;

  -- 감지대상(list_uncharged_new_occupancies와 동일 필터) ∩ p_unit_ids 만 처리
  for v_unit in
    select u.id as unit_id, occ.id as occ_id, occ.tenant_name, occ.move_in_date, occ.status, occ.created_at
    from units u
    left join lateral (
      select * from occupancies o where o.unit_id = u.id and o.deleted_at is null
      order by o.created_at desc, o.id desc limit 1
    ) occ on true
    where u.building_id = p_building_id and u.deleted_at is null
      and u.id = any(p_unit_ids)
      and coalesce(occ.status, 'vacant') = 'occupied'
      and occ.created_at > (
        select max(bc.confirmed_at) from billing_confirmations bc
        join units u2 on u2.id = bc.unit_id
        where u2.building_id = p_building_id and bc.period = p_period and bc.confirmed_at is not null
      )
      and not exists (
        select 1 from billing_confirmations bc
        where bc.unit_id = u.id and bc.period = p_period and bc.confirmed_at is not null
      )
  loop
    if v_unit.move_in_date is not null
       and v_unit.move_in_date between p_period and ((p_period + interval '1 month')::date - 1) then
      v_occupied := ((p_period + interval '1 month')::date - v_unit.move_in_date);
    else
      v_occupied := v_days;
    end if;

    v_items := '[]'::jsonb; v_total := 0;
    for v_item in
      select fi.id as fee_item_id, fi.name,
        coalesce(fic.amount, case when fi.carry_over then prev.amount else 0 end, 0) as amount,
        fi.daily_proration, fi.rounding
      from buildings b
      join fee_items fi on fi.type_id = b.type_id and fi.org_id = v_org and fi.deleted_at is null
      left join fee_item_charges fic on fic.unit_id = v_unit.unit_id and fic.fee_item_id = fi.id and fic.period = p_period
      left join fee_item_charges prev on prev.unit_id = v_unit.unit_id and prev.fee_item_id = fi.id
           and prev.period = (p_period - interval '1 month')::date
      where b.id = p_building_id and coalesce(fic.charged, true)
      order by fi.sort_order, fi.id
    loop
      if v_item.daily_proration and v_occupied < v_days then
        v_amt := round_charge(v_item.amount::numeric * v_occupied / 30, v_item.rounding);
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
    values (v_org, auth.uid(), 'BILLING_CHARGE_NEW', 'billing_confirmations', p_building_id::text,
      jsonb_build_object('period', p_period, 'unit_count', v_count, 'total', v_grand));

  return jsonb_build_object('unit_count', v_count, 'total', v_grand);
end $$;
revoke execute on function charge_new_occupancies(bigint, date, bigint[]) from public, anon;
grant execute on function charge_new_occupancies(bigint, date, bigint[]) to authenticated;
```

- [ ] **Step 2: 커밋** `git add supabase/migrations/0092_management_fee_setting_finish.sql && git commit -m "feat(management-fee): 0092 신규입주 부과·셋팅확인 RPC"`
  - (라이브 적용은 사용자 워크플로우로 후속. 코드 테스트는 rpc 목킹.)

---

### Task 2: billing 훅 — 감지 쿼리 + 부과 뮤테이션 (§3.3)

**Files:**
- Modify: `hooks/reactquery/billing/apis.ts`, `keys.ts`, `queries.ts`, `mutations.ts`
- Test: `hooks/reactquery/billing/apis.test.ts`

**Interfaces (Produces):**
- `listUnchargedNewOccupancies(buildingId:number, period:string): Promise<NewOccupancy[]>` where `NewOccupancy = {unitId:number; unitNo:string; dong:string|null; tenantName:string|null; moveInDate:string|null}`
- `chargeNewOccupancies(buildingId:number, period:string, unitIds:number[]): Promise<{unitCount:number; total:number}>`
- `useUnchargedNewOccupancies(buildingId:number|null, period:string)` (enabled !!buildingId)
- `useChargeNewOccupancies()` (invalidate billingKeys.all)
- `billingKeys.newOccupancies(buildingId, period)`

- [ ] **Step 1: 실패 테스트** — `apis.test.ts`에 기존 패턴(supabase mock)으로 두 함수 추가: rpc 이름·파라미터(`p_building_id/p_period/p_unit_ids`) 검증, snake→camel 매핑 검증.
- [ ] **Step 2: 테스트 실패 확인** `npx vitest run hooks/reactquery/billing/apis.test.ts`
- [ ] **Step 3: 구현** — apis.ts에 타입 `NewOccupancy`·`rowToNewOcc`·두 함수, keys.ts에 `newOccupancies`, queries.ts에 `useUnchargedNewOccupancies`, mutations.ts에 `useChargeNewOccupancies`.
- [ ] **Step 4: 통과 확인** 위 vitest.
- [ ] **Step 5: 커밋** `feat(management-fee): 신규입주 감지·부과 훅`

---

### Task 3: NewTenantChargeModal 컴포넌트 (§3.3)

**Files:**
- Create: `app/(staff)/staff/management-fee/components/NewTenantChargeModal.tsx`
- Test: `app/(staff)/staff/management-fee/components/NewTenantChargeModal.test.tsx`

**Interfaces (Consumes NewOccupancy from Task 2; Produces):**
- props `{ open:boolean; units:NewOccupancy[]; pending:boolean; onConfirm:(unitIds:number[])=>void; onClose:()=>void }`

- [ ] **Step 1: 실패 테스트** — 렌더(세대 목록·"이번 달 관리비를 부과하시겠습니까?"), 기본 전체 체크, 개별 토글, 전부 해제 시 확인 버튼 disabled, 확인 클릭이 체크된 unitId 배열로 onConfirm, 취소가 onClose.
- [ ] **Step 2: 실패 확인** `npx vitest run .../NewTenantChargeModal.test.tsx`
- [ ] **Step 3: 구현** — `Modal`/`Button` 재사용, 로컬 state `checked: Set<number>`(open 시 전체 초기화, `useEffect([open, units])`), 행별 체크박스, 확인 시 `[...checked]` 전달, pending 시 버튼 로딩.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** `feat(management-fee): NewTenantChargeModal`

---

### Task 4: management-fee 페이지 §3.3 배선

**Files:**
- Modify: `app/(staff)/staff/management-fee/page.tsx`
- Test: `app/(staff)/staff/management-fee/page.test.tsx`

- [ ] **Step 1: 실패 테스트** — 훅 목킹: `useUnchargedNewOccupancies`가 rows 반환 시 모달 자동 오픈, 확인 클릭이 `useChargeNewOccupancies` mutate를 체크 unitId로 호출. 진입마다 재노출(취소 후 building 변경 시 재오픈).
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — `useUnchargedNewOccupancies(buildingId, period)` 추가, 모달 상태(`newTenantOpen`) + `useEffect`가 `[buildingId, period]` 진입 단위로 rows 있으면 open(취소 플래그는 selection 키로 관리해 같은 selection 내 재오픈 방지). 확인 핸들러가 `chargeNewOccupancies.mutateAsync({buildingId, period, unitIds})` → toast → 모달 close. 모달 하단 마운트.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** `feat(management-fee): §3.3 신규입주 당월부과 팝업 연결`

---

### Task 5: buildings 훅 — setupConfirmRequired 매핑 + 토글 (§3.4)

**Files:**
- Modify: `hooks/reactquery/buildings/apis.ts`, `mutations.ts`
- Test: `hooks/reactquery/buildings/apis.test.ts`

**Interfaces (Produces):**
- `Building.setupConfirmRequired: boolean` (rowToBuilding: `r.setup_confirm_required ?? false`)
- `setBuildingSetupConfirm(id:number, required:boolean): Promise<void>` (rpc `set_building_setup_confirm`)
- `useSetBuildingSetupConfirm()` (invalidate buildingKeys.all)

- [ ] **Step 1: 실패 테스트** — `setBuildingSetupConfirm` rpc 이름·파라미터(`p_id/p_required`), `rowToBuilding`가 `setup_confirm_required` → `setupConfirmRequired` 매핑(누락 시 false).
- [ ] **Step 2: 실패 확인** `npx vitest run hooks/reactquery/buildings/apis.test.ts`
- [ ] **Step 3: 구현** — `Building` 인터페이스·`BuildingRow`·`rowToBuilding`에 필드 추가, apis에 `setBuildingSetupConfirm`, mutations에 `useSetBuildingSetupConfirm`.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** `feat(buildings): 셋팅확인 플래그 매핑·토글 훅`

---

### Task 6: 건물 상세 폼 체크박스 (§3.4)

**Files:**
- Modify: 건물 상세 폼(구현 시 `BuildingForm.tsx` + 적절 섹션 확인) — 체크박스 "관리비 셋팅 시 확인 필요"
- Test: 해당 섹션 `*.test.tsx`

- [ ] **Step 1: 실제 폼 구조 확인** — `app/(staff)/staff/buildings/components/BuildingForm.tsx` + `[id]/page.tsx` 읽어 저장 흐름·섹션 배치 확정.
- [ ] **Step 2: 실패 테스트** — 체크박스 렌더·초기값(building.setupConfirmRequired)·토글 시 `useSetBuildingSetupConfirm` mutate 호출(또는 폼 저장 핸들러에서 flag 변경 시 호출).
- [ ] **Step 3: 실패 확인**
- [ ] **Step 4: 구현** — 체크박스 추가 + 지속화 배선(즉시 토글 저장 or 폼 submit 후 flag diff 시 호출).
- [ ] **Step 5: 통과 확인**
- [ ] **Step 6: 커밋** `feat(buildings): 관리비 셋팅확인 체크박스`

---

### Task 7: management-fee 건물선택 게이트 (§3.4)

**Files:**
- Modify: `app/(staff)/staff/management-fee/page.tsx`
- Test: `app/(staff)/staff/management-fee/page.test.tsx`

- [ ] **Step 1: 실패 테스트** — `window.confirm` 목킹: `setupConfirmRequired=true` 건물 선택 시 confirm 호출, 취소(false)면 buildingId 미변경(테이블 미로드), 확인(true)이면 로드.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — `selectBuilding(v)`에서 대상 건물 `setupConfirmRequired`면 `window.confirm("이 건물은 셋팅 시 확인이 필요합니다. 계속하시겠습니까?")` false 시 early-return. (buildings = `useBuildings()`에 이미 필드 포함.)
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** `feat(management-fee): §3.4 건물 셋팅확인 게이트`

---

### Task 8: 검증 + 마무리

- [ ] `npx tsc --noEmit`
- [ ] `npx vitest run` (전건)
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] 마이그 번호 origin/master max 재확인, 필요 시 리넘버
- [ ] push + PR (master), wbs-commit-sync

## Self-Review (spec 대조)
- §3.3 감지=Task1 RPC+Task4 / 부과(세대별 체크·진입마다)=Task3+Task4 / 대상세대 전용 RPC(D4)=Task1 ✓
- §3.4 컬럼·토글 RPC=Task1 / 매핑=Task5 / 체크박스=Task6 / window.confirm 게이트(D5)=Task7 ✓
- 계산 패리티=Task1 미러링 주석 ✓ / confirm_billing·save_building 무수정 ✓
- 플레이스홀더: Task6 섹션 경로만 impl-time 확정(구조 확인 스텝 포함) — 그 외 없음.

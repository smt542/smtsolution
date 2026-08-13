# P5b 공과금 단가·자동요금·부과확정·검침대장(`/staff/utilities`) Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Keep the checkbox (`- [ ]`) state current, follow each TDD loop in order, and do not apply the migration to a remote database from the worker environment.

**Goal:** P5a가 남긴 `/staff/utilities`의 네 빈 구간을 완성한다 — 고객번호별 단가 설정, `사용량 × 단가 − 할인` 자동요금, 건물×유형×월 공과금 자체 부과확정과 재확정, 서버 생성 검침대장 엑셀 다운로드.

**Architecture:** 신규 `0014`는 `building_customer_numbers`에 1:1로 붙는 `utility_unit_prices`와 건물×유형×월 잠금 원장 `utility_confirmations`를 만든다. 기존 `list_utility_rows`는 현재 해석 단가를 추가하고, `save_meter_readings`는 단가·자동요금을 `meter_readings`에 스냅샷한다. 조회·저장·확정은 org와 `utilities` 모듈을 검증하는 definer RPC로 제공하며, React Query 데이터층이 DB의 snake_case/`elec`을 UI의 camelCase/`electricity`로 변환한다. 화면은 단가 모달·확정 상태·dirty 경고를 기존 P5a UI에 얹고, 검침대장은 세션 기반 Route Handler가 기존 `rowsToXlsxBuffer`로 생성한다.

**Tech Stack:** Next.js 16.3 App Router Route Handler(native `Request`/`Response`) · Supabase(PostgreSQL/Auth/RLS/RPC) · React 19 · React Query v5 · Tailwind v4 · Vitest + Testing Library · 기존 ExcelJS 래퍼 `lib/export/xlsx`.

## Global Constraints

- **기준 spec:** `docs/superpowers/specs/2026-08-13-p5b-utility-pricing-design.md`. 재결정하지 않는다. 핵심은 단가=`utility_unit_prices`의 고객번호별 현재값, 자동요금=`greatest(0, round_charge(usage * unit_price, 'round') - coalesce(discount, 0))`, 부과확정=`utility_confirmations` 자체 잠금·`is_dirty`·재확정, 검침대장=`app/api/utilities/ledger` + 기존 `rowsToXlsxBuffer`다.
- **범위 밖:** 상가 고정 사용량, 관리비 `/management-fee` 통합, `common_elec` 안분, 수납/고지서 연계, 단가 기간 버전, 건물별 반올림 설정. `building_customer_numbers`의 기존 컬럼은 변경하지 않는다.
- **마이그레이션:** 반드시 `supabase/migrations/0014_p5b_utility_pricing.sql`과 `supabase/verify/p5b_checks.sql`. master에는 `0013_p5_bill_publish.sql`과 `0013_platform_drilldown.sql`이 함께 있으므로 `0014` 외 번호를 쓰지 않는다.
- **신규 의존성·env 없음:** `exceljs`를 추가하거나 직접 import하지 않는다. `lib/export/xlsx.rowsToXlsxBuffer(columns, rows)`만 재사용한다.
- **유형 표기:** DB/RPC는 `water | elec | gas`, UI/TypeScript는 `water | electricity | gas`. 모든 경계 변환은 `apis.ts`의 `dbUtility()`를 쓴다. 단가 대상은 `water/elec/gas`뿐이며 `common_elec`은 제외한다.
- **권한:** 신규 테이블 SELECT는 `org_id in (select my_org_ids())` 계열 이디엄으로 같은 org 구성원에게 열고, 쓰기는 `current_user_has_module('utilities')`로 게이트한다. definer RPC는 함수 내부에서 org·모듈·입력 소유권을 다시 검증한다.
- **함수 권한:** 모든 신규/교체 RPC는 `security definer set search_path = public`; `revoke execute ... from public, anon` 뒤 `grant execute ... to authenticated`를 명시한다.
- **기간·금액:** `period`는 월 1일이며 미래월을 거부한다. 단가 `numeric(12,2)`, 세대 요금·할인 `integer`, 확정 합계 `bigint`. 유효요금은 항상 `manual_charge ?? calc_charge`(수동 우선)다.
- **단가 해석:** ① `unit_meters.customer_no`와 같은 건물·유형 고객번호의 단가 → ② 단가가 설정된 같은 유형 고객번호가 정확히 1건이면 그 단가 → ③ 그 외 `null`. 2건 이상에서 미매칭이면 임의 선택하지 않는다.
- **스냅샷:** `list_utility_rows.resolved_unit_price`는 현재 설정 미리보기, `meter_readings.unit_price`는 계산 당시 스냅샷이다. 테이블은 스냅샷이 있으면 그것을 우선 표시한다.
- **확정 의미:** 하드 편집 잠금은 하지 않는다. 확정 후 검침 또는 단가가 바뀌면 `is_dirty=true`; 사용자가 다시 `부과 계산` 후 `재확정`한다. `confirm_utilities` 자체는 재계산하지 않고 현재 저장 요금의 합계만 확정한다.
- **컨벤션:** snake↔camel 매핑은 `apis.ts`, React Query v5는 `useMutation` + 관련 query key `invalidateQueries`, UI는 `@/components/common`의 `Modal`·`Button`·`Select`·`Tabs`를 재사용한다.
- **Next.js 16:** `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` 기준으로 `app/api/utilities/ledger/route.ts`에 `export async function GET(request: Request)`를 둔다. `createClient()`와 `cookies()`는 비동기이므로 반드시 `await`한다. 이 GET은 요청 URL·쿠키·DB를 사용하므로 정적 캐시 opt-in을 하지 않는다.
- **TDD:** DB Task만 원격 미접속 예외다. 나머지는 실패 테스트 작성 → 지정 테스트의 실패 확인 → 최소 구현 → 지정 테스트 통과 → 커밋 순서다. 괄호가 있는 경로는 명령에서 따옴표로 감싼다.
- **DB pending-user:** worker는 원격 DB·라이브 E2E를 실행하지 않는다. 검증은 `npm test`, `npx tsc --noEmit`, `npm run lint`, `p5b_checks.sql` 정적 대조까지다. 실제 적용은 사용자 PC에서 파일명 정렬 순서 `…0013_p5_… → 0013_platform_… → 0014_…`, 이어 `p5b_checks.sql`이다.
- **커밋 트레일러(필수):** 모든 구현 커밋 끝에 `-m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`를 붙인다.
- **WBS:** 화면 커밋 직후 마지막 검증 Task에서 `wbs-commit-sync`를 호출한다. 주택관리ERP 버킷, dev 트랙만 갱신하고 `완료` 자동변경은 하지 않는다.

## File Structure

**DB**
- Create: `supabase/migrations/0014_p5b_utility_pricing.sql`
- Create: `supabase/verify/p5b_checks.sql`

**데이터층 (`hooks/reactquery/utilities/`)**
- Modify: `apis.ts`(단가·확정 API, `unitPrice`/`resolvedUnitPrice`, URL 빌더, 이력의 수동요금 우선 교정)
- Modify: `keys.ts`, `queries.ts`, `mutations.ts`, `apis.test.ts`
- Keep: `index.ts`의 네 re-export(새 export는 각 파일에서 자동 노출)

**화면 (`app/(staff)/staff/utilities/`)**
- Create: `components/UnitPriceModal.tsx`, `components/UnitPriceModal.test.tsx`
- Modify: `page.tsx`, `page.test.tsx`
- Modify: `components/UtilityTable.tsx`
- Modify: `components/UtilityHistoryModal.tsx`, `components/UtilityHistoryModal.test.tsx`
- Keep: `components/UtilitySummaryCards.tsx` API(계산은 page에서 `manual ?? calc`로 전달)

**엑셀 Route Handler**
- Create: `app/api/utilities/ledger/route.ts`
- Create: `app/api/utilities/ledger/route.test.ts`
- Reuse unchanged: `lib/export/xlsx.ts`, `lib/supabase/server.ts`

---

## 그룹 1 — DB · 데이터층

### Task 1: 마이그레이션 `0014` + 검증 SQL

**Files:**
- Create: `supabase/migrations/0014_p5b_utility_pricing.sql`
- Create: `supabase/verify/p5b_checks.sql`

**Interfaces:**
- Produces: `utility_unit_prices`, `utility_confirmations`; `list_utility_prices(bigint,text)`, `save_utility_unit_prices(bigint,text,jsonb)`, `confirm_utilities(bigint,text,date)`, `list_utility_confirmation(bigint,text,date)`.
- Replaces/extends: `list_utility_rows(bigint,text,date)` 반환에 `resolved_unit_price numeric`; `save_meter_readings(bigint,text,date,jsonb)`에 단가 해석·요금 스냅샷.
- Consumes: `building_customer_numbers`, `unit_meters`, `meter_readings`, `water_discounts`, `occupancies`, `profiles`, `audit_log`, `round_charge`, `current_user_org`, `current_user_has_module`, `my_org_ids`, `set_updated_at`.

> **TDD 예외:** 원격 DB에 접속하지 않는다. `p5b_checks.sql`의 카탈로그/함수 정의 검증과 데이터 기반 수동 시나리오를 작성한 뒤 spec §3~§6과 정적으로 대조한다.

- [ ] **Step 1: 신규 테이블·인덱스·트리거 작성**

```sql
-- 0014_p5b_utility_pricing.sql
create table utility_unit_prices (
  id bigint generated always as identity primary key,
  building_customer_number_id bigint not null
    references building_customer_numbers(id) on delete cascade,
  unit_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_customer_number_id)
);
create index on utility_unit_prices (building_customer_number_id);

create table utility_confirmations (
  id bigint generated always as identity primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  utility text not null check (utility in ('water','elec','gas')),
  period date not null check (period = date_trunc('month', period)::date),
  unit_count int not null default 0,
  total_amount bigint not null default 0,
  confirmed_at timestamptz,
  confirmed_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, utility, period)
);
create index on utility_confirmations (building_id, utility, period);

do $$ declare t text; begin
  foreach t in array array['utility_unit_prices','utility_confirmations'] loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();',
      t
    );
  end loop;
end $$;
```

- [ ] **Step 2: RLS 작성** — SELECT는 같은 org, ALL은 같은 org + utilities 모듈이다.

```sql
alter table utility_unit_prices enable row level security;
alter table utility_confirmations enable row level security;

create policy uup_select on utility_unit_prices for select
  using (building_customer_number_id in (
    select bcn.id
    from building_customer_numbers bcn
    join buildings b on b.id = bcn.building_id
    where b.org_id in (select my_org_ids())
  ));
create policy uup_write on utility_unit_prices for all
  using (
    building_customer_number_id in (
      select bcn.id from building_customer_numbers bcn
      join buildings b on b.id = bcn.building_id
      where b.org_id in (select my_org_ids())
    ) and current_user_has_module('utilities')
  )
  with check (
    building_customer_number_id in (
      select bcn.id from building_customer_numbers bcn
      join buildings b on b.id = bcn.building_id
      where b.org_id in (select my_org_ids())
    ) and current_user_has_module('utilities')
  );

create policy uc_select on utility_confirmations for select
  using (building_id in (
    select id from buildings where org_id in (select my_org_ids())
  ));
create policy uc_write on utility_confirmations for all
  using (
    building_id in (select id from buildings where org_id in (select my_org_ids()))
    and current_user_has_module('utilities')
  )
  with check (
    building_id in (select id from buildings where org_id in (select my_org_ids()))
    and current_user_has_module('utilities')
  );
```

- [ ] **Step 3: 단가 조회·저장 RPC 작성**

```sql
create or replace function list_utility_prices(p_building_id bigint, p_utility text)
returns table(
  customer_number_id bigint, customer_no text, holder_name text,
  sort_order int, unit_price numeric
) language sql stable security definer set search_path = public as $$
  select bcn.id, bcn.customer_no, bcn.holder_name, bcn.sort_order, uup.unit_price
  from building_customer_numbers bcn
  join buildings b on b.id = bcn.building_id and b.org_id = current_user_org()
  left join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
  where bcn.building_id = p_building_id
    and bcn.kind = p_utility
    and p_utility in ('water','elec','gas')
    and bcn.deleted_at is null
  order by bcn.sort_order, bcn.id
$$;

create or replace function save_utility_unit_prices(
  p_building_id bigint, p_utility text, p_prices jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint := current_user_org();
  v_item jsonb;
  v_id bigint;
  v_count int := 0;
begin
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('utilities') then
    raise exception 'forbidden: utilities required';
  end if;
  if p_utility not in ('water','elec','gas') then raise exception 'bad utility %', p_utility; end if;
  if not exists (select 1 from buildings where id=p_building_id and org_id=v_org) then
    raise exception 'building not in org';
  end if;
  if jsonb_typeof(coalesce(p_prices, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'prices must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) loop
    v_id := nullif(v_item->>'customer_number_id', '')::bigint;
    if not exists (
      select 1 from building_customer_numbers
      where id=v_id and building_id=p_building_id and kind=p_utility and deleted_at is null
    ) then raise exception 'customer number % not in building/utility', v_id; end if;

    insert into utility_unit_prices(building_customer_number_id, unit_price)
    values (v_id, (v_item->>'unit_price')::numeric)
    on conflict (building_customer_number_id) do update
      set unit_price = excluded.unit_price;
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('saved', v_count);
end $$;
```

- [ ] **Step 4: `list_utility_rows` 반환 확장** — PostgreSQL은 반환형을 `create or replace`로 바꿀 수 없으므로 기존 함수는 **동일 인자 시그니처로 drop 후 재생성**한다. 기존 P5a 컬럼 순서를 유지하고 `discount_type` 뒤에 `resolved_unit_price numeric`을 추가한다.

```sql
drop function list_utility_rows(bigint,text,date);
create function list_utility_rows(
  p_building_id bigint, p_utility text, p_period date
) returns table(
  unit_id bigint, unit_no text, dong text,
  occupancy_id bigint, tenant_name text, occupancy_status occupancy_status, move_in_date date,
  customer_no text, meter_no text,
  previous_reading numeric, current_reading numeric, usage numeric,
  unit_price numeric, calc_charge integer, discount_amount integer,
  manual_charge integer, note text, processed_at timestamptz,
  discount_type text, resolved_unit_price numeric
) language sql stable security definer set search_path = public as $$
  select
    u.id, u.unit_no, u.dong,
    o.id, o.tenant_name, o.status, o.move_in_date,
    m.customer_no, m.meter_no,
    coalesce(cur.previous_reading, prev.current_reading),
    cur.current_reading, cur.usage, cur.unit_price, cur.calc_charge,
    coalesce(cur.discount_amount, wd.amount), cur.manual_charge, cur.note, cur.processed_at,
    wd.discount_type,
    coalesce(
      (select uup.unit_price
       from unit_meters um
       join building_customer_numbers bcn
         on bcn.building_id=p_building_id and bcn.kind=p_utility
        and bcn.customer_no=um.customer_no and bcn.deleted_at is null
       join utility_unit_prices uup on uup.building_customer_number_id=bcn.id
       where um.unit_id=u.id and um.utility=p_utility),
      (select max(uup.unit_price)
       from building_customer_numbers bcn
       join utility_unit_prices uup on uup.building_customer_number_id=bcn.id
       where bcn.building_id=p_building_id and bcn.kind=p_utility and bcn.deleted_at is null
       having count(*)=1)
    ) as resolved_unit_price
  from units u
  join buildings b on b.id=u.building_id and b.org_id=current_user_org()
  left join lateral (
    select * from occupancies oc where oc.unit_id=u.id and oc.deleted_at is null
    order by oc.created_at desc, oc.id desc limit 1
  ) o on true
  left join unit_meters m on m.unit_id=u.id and m.utility=p_utility
  left join meter_readings cur
    on cur.unit_id=u.id and cur.utility=p_utility and cur.period=p_period
  left join meter_readings prev
    on prev.unit_id=u.id and prev.utility=p_utility
   and prev.period=(p_period - interval '1 month')::date
  left join water_discounts wd on wd.unit_id=u.id and p_utility='water'
  where u.building_id=p_building_id and u.deleted_at is null
  order by u.unit_no
$$;
```

- [ ] **Step 5: `save_meter_readings` 단가 해석·자동요금 스냅샷 추가** — 기존 org/모듈/세대 검증과 입력·전월·할인 로직은 보존한다. 선언과 upsert에 다음을 통합한다.

```sql
-- declare
v_price numeric;
v_calc integer;
v_total_calc bigint := 0;

-- 각 v_unit_id의 v_usage/v_disc 계산 직후
select coalesce(
  (select uup.unit_price
   from unit_meters um
   join building_customer_numbers bcn
     on bcn.building_id=p_building_id and bcn.kind=p_utility
    and bcn.customer_no=um.customer_no and bcn.deleted_at is null
   join utility_unit_prices uup on uup.building_customer_number_id=bcn.id
   where um.unit_id=v_unit_id and um.utility=p_utility),
  (select max(uup.unit_price)
   from building_customer_numbers bcn
   join utility_unit_prices uup on uup.building_customer_number_id=bcn.id
   where bcn.building_id=p_building_id and bcn.kind=p_utility and bcn.deleted_at is null
   having count(*)=1)
) into v_price;

v_calc := case
  when v_usage is not null and v_price is not null
    then greatest(0, round_charge(v_usage * v_price, 'round') - coalesce(v_disc, 0))
  else null
end;

insert into meter_readings(
  unit_id, utility, period, previous_reading, current_reading, usage,
  unit_price, calc_charge, discount_amount, manual_charge, note, processed_at
) values (
  v_unit_id, p_utility, p_period, v_prev, v_cur, v_usage,
  v_price, v_calc, v_disc,
  nullif(v_item->>'manual_charge','')::integer, nullif(v_item->>'note',''), now()
)
on conflict (unit_id, utility, period) do update set
  previous_reading=excluded.previous_reading,
  current_reading=excluded.current_reading,
  usage=excluded.usage,
  unit_price=excluded.unit_price,
  calc_charge=excluded.calc_charge,
  discount_amount=excluded.discount_amount,
  manual_charge=excluded.manual_charge,
  note=excluded.note,
  processed_at=excluded.processed_at;

v_total_calc := v_total_calc + coalesce(v_calc, 0);
-- 최종: jsonb_build_object('saved',v_count,'period',p_period,'total_calc',v_total_calc)
```

> `usage` 또는 해석 단가가 `null`이면 `calc_charge`도 반드시 `null`; 할인 때문에 음수가 되면 `0`. 단가 스냅샷은 매 저장/재계산 때 현재 해석값으로 갱신한다.

- [ ] **Step 6: `confirm_utilities` 작성** — 최신 occupancy가 `vacant`이거나 없는 세대는 제외하고, 현재 저장된 `manual_charge` 우선 유효요금을 합산한다. 재호출은 같은 unique 행을 갱신한다.

```sql
create or replace function confirm_utilities(
  p_building_id bigint, p_utility text, p_period date
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint := current_user_org();
  v_count int := 0;
  v_total bigint := 0;
begin
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('utilities') then
    raise exception 'forbidden: utilities required';
  end if;
  if not exists (select 1 from buildings where id=p_building_id and org_id=v_org) then
    raise exception 'building not in org';
  end if;
  if p_utility not in ('water','elec','gas') then raise exception 'bad utility %', p_utility; end if;
  if p_period is null or p_period <> date_trunc('month',p_period)::date then
    raise exception 'period must be first of month';
  end if;
  if p_period > date_trunc('month',now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed';
  end if;

  select count(*)::int, coalesce(sum(coalesce(mr.manual_charge,mr.calc_charge,0)),0)::bigint
    into v_count, v_total
  from units u
  join lateral (
    select o.status from occupancies o
    where o.unit_id=u.id and o.deleted_at is null
    order by o.created_at desc, o.id desc limit 1
  ) occ on occ.status <> 'vacant'
  left join meter_readings mr
    on mr.unit_id=u.id and mr.utility=p_utility and mr.period=p_period
  where u.building_id=p_building_id and u.deleted_at is null;

  insert into utility_confirmations(
    building_id,utility,period,unit_count,total_amount,confirmed_at,confirmed_by
  ) values (p_building_id,p_utility,p_period,v_count,v_total,now(),auth.uid())
  on conflict (building_id,utility,period) do update set
    unit_count=excluded.unit_count,
    total_amount=excluded.total_amount,
    confirmed_at=excluded.confirmed_at,
    confirmed_by=excluded.confirmed_by;

  insert into audit_log(org_id,actor_id,action,table_name,row_pk,after)
  values (
    v_org,auth.uid(),'UTILITY_CONFIRM','utility_confirmations',p_building_id::text,
    jsonb_build_object('utility',p_utility,'period',p_period,'unit_count',v_count,'total',v_total)
  );
  return jsonb_build_object('unit_count',v_count,'total',v_total);
end $$;
```

- [ ] **Step 7: `list_utility_confirmation` 작성**

```sql
create or replace function list_utility_confirmation(
  p_building_id bigint, p_utility text, p_period date
) returns table(
  confirmed_at timestamptz, confirmed_by_name text,
  unit_count int, total_amount bigint, is_dirty boolean
) language sql stable security definer set search_path = public as $$
  select uc.confirmed_at, pr.full_name, uc.unit_count, uc.total_amount,
    (
      uc.confirmed_at is not null and (
        exists (
          select 1 from meter_readings mr
          join units u on u.id=mr.unit_id
          where u.building_id=p_building_id and mr.utility=p_utility
            and mr.period=p_period and mr.updated_at>uc.confirmed_at
        ) or exists (
          select 1 from utility_unit_prices uup
          join building_customer_numbers bcn on bcn.id=uup.building_customer_number_id
          where bcn.building_id=p_building_id and bcn.kind=p_utility
            and bcn.deleted_at is null and uup.updated_at>uc.confirmed_at
        )
      )
    ) as is_dirty
  from utility_confirmations uc
  join buildings b on b.id=uc.building_id and b.org_id=current_user_org()
  left join profiles pr on pr.user_id=uc.confirmed_by
  where uc.building_id=p_building_id and uc.utility=p_utility and uc.period=p_period
$$;
```

- [ ] **Step 8: RPC 권한을 일괄 잠금**

```sql
revoke execute on function list_utility_prices(bigint,text) from public, anon;
revoke execute on function save_utility_unit_prices(bigint,text,jsonb) from public, anon;
revoke execute on function list_utility_rows(bigint,text,date) from public, anon;
revoke execute on function save_meter_readings(bigint,text,date,jsonb) from public, anon;
revoke execute on function confirm_utilities(bigint,text,date) from public, anon;
revoke execute on function list_utility_confirmation(bigint,text,date) from public, anon;
grant execute on function list_utility_prices(bigint,text) to authenticated;
grant execute on function save_utility_unit_prices(bigint,text,jsonb) to authenticated;
grant execute on function list_utility_rows(bigint,text,date) to authenticated;
grant execute on function save_meter_readings(bigint,text,date,jsonb) to authenticated;
grant execute on function confirm_utilities(bigint,text,date) to authenticated;
grant execute on function list_utility_confirmation(bigint,text,date) to authenticated;
```

- [ ] **Step 9: `p5b_checks.sql` 작성** — `p5_checks.sql` 수준의 카탈로그 검증을 자동화하고 데이터 시나리오는 명시한다.

```sql
-- 자동: 신규 2테이블 존재 + RLS 활성 + SELECT/ALL 정책 존재
-- 자동: uup_write/uc_write qual·with_check에 current_user_has_module('utilities') 포함
-- 자동: 6개 RPC to_regprocedure(...) 존재
-- 자동: public/anon EXECUTE 없음 + authenticated EXECUTE 있음
-- 자동: pg_get_functiondef(save_meter_readings)에 round_charge, greatest(0,...),
--       unit_price/calc_charge upsert 포함
-- 자동: pg_get_functiondef(confirm_utilities)에 manual_charge 우선 coalesce,
--       current_user_has_module('utilities'), future period 거부, UTILITY_CONFIRM 포함
-- 자동: pg_get_functiondef(list_utility_confirmation)에 meter_readings.updated_at와
--       utility_unit_prices.updated_at 두 dirty 조건 포함
```

수동 데이터 점검 주석은 다음 8가지를 빠짐없이 둔다.

1. utilities 미보유 구성원은 신규 두 테이블 SELECT 가능, 직접 INSERT/UPDATE와 쓰기 RPC 거부.
2. `unit_meters.customer_no` 일치 단가를 1순위로 해석.
3. 유형별 설정 단가 1건이면 미매칭 세대도 그 단가, 2건 이상이면 `null`.
4. `max(0, round(usage×price)−discount)` 및 `usage/price null → calc null`.
5. 수동요금이 자동요금보다 우선해 확정 합계에 반영되고 공실은 제외.
6. 재확정은 행 추가 없이 `confirmed_at`·합계를 갱신하고 audit를 남김.
7. 확정 뒤 검침 수정뿐 아니라 단가 수정도 `is_dirty=true`.
8. 타 org building/customer number는 조회 0행 또는 쓰기 거부.

- [ ] **Step 10: 정적 대조 후 커밋**

```bash
git add supabase/migrations/0014_p5b_utility_pricing.sql supabase/verify/p5b_checks.sql
git commit -m "feat(db): P5b 공과금 단가·자동요금·부과확정 RPC와 RLS 추가(0014)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: utilities 데이터층 확장

**Files:**
- Modify: `hooks/reactquery/utilities/apis.test.ts`
- Modify: `hooks/reactquery/utilities/apis.ts`
- Modify: `hooks/reactquery/utilities/keys.ts`
- Modify: `hooks/reactquery/utilities/queries.ts`
- Modify: `hooks/reactquery/utilities/mutations.ts`

**Interfaces:**
- Produces: `UtilityPriceRow`, `SaveUtilityUnitPricesInput/Result`, `UtilityConfirmation`, `ConfirmUtilitiesInput/Result`; `listUtilityPrices`, `saveUtilityUnitPrices`, `confirmUtilities`, `getUtilityConfirmation`, `ledgerDownloadUrl`; `useUtilityPrices`, `useUtilityConfirmation`, `useSaveUtilityUnitPrices`, `useConfirmUtilities`.
- Extends: `UtilityUnitRow.unitPrice`, `UtilityUnitRow.resolvedUnitPrice`; query keys `prices`, `confirmation`, rows prefix.
- Consumes: Task 1 RPC 6종과 기존 `createClient`, `dbUtility`.

- [ ] **Step 1: 실패 테스트 작성 — API·매핑·URL**

`apis.test.ts`에 기존 P5a 케이스를 유지하면서 다음 단언을 추가한다.

```ts
it("resolved_unit_price와 스냅샷 unit_price를 camelCase로 매핑한다", async () => {
  rpc.mockResolvedValue({ data: [{
    ...rpcRow,
    unit_price: 910.5,
    resolved_unit_price: 930,
  }], error: null });
  const [row] = await listUtilityRows(3, "water", "2026-08-01");
  expect(row).toMatchObject({ unitPrice: 910.5, resolvedUnitPrice: 930 });
});

it("단가 조회·저장·확정·확정상태 RPC를 DB 유형으로 호출한다", async () => {
  rpc
    .mockResolvedValueOnce({ data: [{
      customer_number_id: 11, customer_no: "E-1", holder_name: "상가",
      sort_order: 0, unit_price: 125.5,
    }], error: null })
    .mockResolvedValueOnce({ data: { saved: 1 }, error: null })
    .mockResolvedValueOnce({ data: { unit_count: 2, total: 60000 }, error: null })
    .mockResolvedValueOnce({ data: [{
      confirmed_at: "2026-08-13T00:00:00Z", confirmed_by_name: "관리자",
      unit_count: 2, total_amount: 60000, is_dirty: false,
    }], error: null });

  await listUtilityPrices(3, "electricity");
  await saveUtilityUnitPrices({ buildingId: 3, utilityType: "electricity",
    prices: [{ customer_number_id: 11, unit_price: 125.5 }] });
  await confirmUtilities({ buildingId: 3, utilityType: "electricity", period: "2026-08-01" });
  const confirmation = await getUtilityConfirmation(3, "electricity", "2026-08-01");

  expect(rpc).toHaveBeenCalledWith("list_utility_prices", { p_building_id: 3, p_utility: "elec" });
  expect(confirmation).toMatchObject({ confirmedByName: "관리자", totalAmount: 60000, isDirty: false });
});

it("확정상태 0행은 null이고 ledger URL은 DB 유형·월을 인코딩한다", async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  await expect(getUtilityConfirmation(3, "gas", "2026-08-01")).resolves.toBeNull();
  expect(ledgerDownloadUrl(3, "electricity", "2026-08-01"))
    .toBe("/api/utilities/ledger?buildingId=3&utility=elec&period=2026-08-01");
});
```

또한 기존 이력 테스트의 기대값은 `manual_charge ?? calc_charge`로 교정한다. 자동 9,000원과 수동 12,000원이 함께 있으면 `charge: 12000`이어야 한다.

- [ ] **Step 2: 실패 테스트 작성 — mutation 무효화 범위**

`@tanstack/react-query`의 `useQueryClient`와 `useMutation`을 목킹해 mutation config의 `onSuccess`를 호출하고 다음을 단언한다.

- `useSaveUtilityUnitPrices`: `utilityKeys.prices(building,type)` + `utilityKeys.rowsScope(building,type)`.
- `useConfirmUtilities`: `utilityKeys.confirmation(building,type,period)` + `utilityKeys.rows(building,type,period)`.
- 기존 검침/할인 mutation은 `utilityKeys.all` 무효화를 유지한다.

- [ ] **Step 3: 실패 확인** — Run: `npx vitest run hooks/reactquery/utilities/apis.test.ts` · Expected: FAIL(신규 export/필드/URL/key 없음).

- [ ] **Step 4: `apis.ts` 타입·매퍼 확장**

```ts
export interface UtilityUnitRow {
  // 기존 필드 유지
  unitPrice: number | null;          // 계산 당시 meter_readings 스냅샷
  resolvedUnitPrice: number | null;  // 현재 설정에서 해석한 단가
}

interface UtilityRowRpc {
  // 기존 필드 유지
  unit_price: number | null;
  resolved_unit_price: number | null;
}

// rpcToUtilityRow
unitPrice: r.unit_price,
resolvedUnitPrice: r.resolved_unit_price,

export interface UtilityPriceRow {
  customerNumberId: number;
  customerNo: string;
  holderName: string | null;
  sortOrder: number;
  unitPrice: number | null;
}
export interface SaveUtilityUnitPricesInput {
  buildingId: number;
  utilityType: UtilityType;
  prices: { customer_number_id: number; unit_price: number }[];
}
export interface SaveUtilityUnitPricesResult { saved: number; }
export interface ConfirmUtilitiesInput {
  buildingId: number; utilityType: UtilityType; period: string;
}
export interface ConfirmUtilitiesResult { unitCount: number; total: number; }
export interface UtilityConfirmation {
  confirmedAt: string;
  confirmedByName: string | null;
  unitCount: number;
  totalAmount: number;
  isDirty: boolean;
}
```

- [ ] **Step 5: 신규 API 함수 구현**

```ts
export async function listUtilityPrices(
  buildingId: number, utilityType: UtilityType,
): Promise<UtilityPriceRow[]> {
  const { data, error } = await createClient().rpc("list_utility_prices", {
    p_building_id: buildingId, p_utility: dbUtility(utilityType),
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as UtilityPriceRpc[]).map((r) => ({
    customerNumberId: r.customer_number_id,
    customerNo: r.customer_no,
    holderName: r.holder_name,
    sortOrder: r.sort_order,
    unitPrice: r.unit_price,
  }));
}

export async function saveUtilityUnitPrices(
  input: SaveUtilityUnitPricesInput,
): Promise<SaveUtilityUnitPricesResult> {
  const { data, error } = await createClient().rpc("save_utility_unit_prices", {
    p_building_id: input.buildingId,
    p_utility: dbUtility(input.utilityType),
    p_prices: input.prices,
  });
  if (error) throw new Error(error.message);
  return { saved: (data as { saved: number }).saved };
}

export async function confirmUtilities(
  input: ConfirmUtilitiesInput,
): Promise<ConfirmUtilitiesResult> {
  const { data, error } = await createClient().rpc("confirm_utilities", {
    p_building_id: input.buildingId,
    p_utility: dbUtility(input.utilityType),
    p_period: input.period,
  });
  if (error) throw new Error(error.message);
  const value = data as { unit_count: number; total: number };
  return { unitCount: value.unit_count, total: value.total };
}

export async function getUtilityConfirmation(
  buildingId: number, utilityType: UtilityType, period: string,
): Promise<UtilityConfirmation | null> {
  const { data, error } = await createClient().rpc("list_utility_confirmation", {
    p_building_id: buildingId, p_utility: dbUtility(utilityType), p_period: period,
  });
  if (error) throw new Error(error.message);
  const row = (data as UtilityConfirmationRpc[] | null)?.[0];
  return row ? {
    confirmedAt: row.confirmed_at,
    confirmedByName: row.confirmed_by_name,
    unitCount: row.unit_count,
    totalAmount: row.total_amount,
    isDirty: row.is_dirty,
  } : null;
}

export function ledgerDownloadUrl(
  buildingId: number, utilityType: UtilityType, period: string,
): string {
  const params = new URLSearchParams({
    buildingId: String(buildingId), utility: dbUtility(utilityType), period,
  });
  return `/api/utilities/ledger?${params.toString()}`;
}
```

`listMeterHistory`는 다음 한 줄을 반드시 함께 고친다.

```ts
charge: r.manual_charge ?? r.calc_charge
```

- [ ] **Step 6: key·query 확장**

```ts
export const utilityKeys = {
  all: ["utilities"] as const,
  rowsScope: (buildingId: number | null, type: UtilityType) =>
    ["utilities", "rows", buildingId, type] as const,
  rows: (buildingId: number | null, type: UtilityType, period: string) =>
    [...utilityKeys.rowsScope(buildingId, type), period] as const,
  history: /* 기존 유지 */,
  prices: (buildingId: number | null, type: UtilityType) =>
    ["utilities", "prices", buildingId, type] as const,
  confirmation: (buildingId: number | null, type: UtilityType, period: string) =>
    ["utilities", "confirmation", buildingId, type, period] as const,
};

export function useUtilityPrices(buildingId: number | null, type: UtilityType) {
  return useQuery({
    queryKey: utilityKeys.prices(buildingId, type),
    queryFn: () => listUtilityPrices(buildingId as number, type),
    enabled: buildingId !== null,
  });
}

export function useUtilityConfirmation(
  buildingId: number | null, type: UtilityType, period: string,
) {
  return useQuery({
    queryKey: utilityKeys.confirmation(buildingId, type, period),
    queryFn: () => getUtilityConfirmation(buildingId as number, type, period),
    enabled: buildingId !== null,
  });
}
```

- [ ] **Step 7: mutation 확장·TODO 제거**

```ts
export function useSaveUtilityUnitPrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveUtilityUnitPrices,
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: utilityKeys.prices(input.buildingId, input.utilityType) });
      qc.invalidateQueries({ queryKey: utilityKeys.rowsScope(input.buildingId, input.utilityType) });
    },
  });
}

export function useConfirmUtilities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmUtilities,
    onSuccess: (_result, input) => {
      qc.invalidateQueries({
        queryKey: utilityKeys.confirmation(input.buildingId, input.utilityType, input.period),
      });
      qc.invalidateQueries({
        queryKey: utilityKeys.rows(input.buildingId, input.utilityType, input.period),
      });
    },
  });
}
```

파일 첫 줄의 `TODO(p3a)` 부과확정 주석은 이번 Task에서 구현되므로 삭제한다.

- [ ] **Step 8: 통과 확인** — Run: `npx vitest run hooks/reactquery/utilities/apis.test.ts` · Expected: PASS(기존 P5a + 신규 API/매핑/URL/무효화).

- [ ] **Step 9: 커밋**

```bash
git add hooks/reactquery/utilities
git commit -m "feat(utilities): 단가·자동요금·부과확정 데이터층과 query key 연결" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 그룹 2 — 단가 · 계산

### Task 3: 고객번호별 `UnitPriceModal`

**Files:**
- Create: `app/(staff)/staff/utilities/components/UnitPriceModal.test.tsx`
- Create: `app/(staff)/staff/utilities/components/UnitPriceModal.tsx`
- Modify: `app/(staff)/staff/utilities/page.test.tsx`
- Modify: `app/(staff)/staff/utilities/page.tsx`

**Interfaces:**
- Produces: `UnitPriceModal({open,buildingId,utilityType,onClose})`.
- Consumes: `useUtilityPrices`, `useSaveUtilityUnitPrices`, `UtilityType`, 공용 `Modal`/`Button`.

- [ ] **Step 1: 모달 실패 테스트 작성**

```tsx
it("고객번호별 기존 단가를 표시하고 입력한 행을 저장한다", () => {
  vi.mocked(useUtilityPrices).mockReturnValue({
    data: [
      { customerNumberId: 11, customerNo: "W-APT", holderName: "주택용", sortOrder: 0, unitPrice: 850 },
      { customerNumberId: 12, customerNo: "W-SHOP", holderName: "상가용", sortOrder: 1, unitPrice: null },
    ], isLoading: false, error: null,
  } as never);
  render(<UnitPriceModal open buildingId={3} utilityType="water" onClose={() => {}} />);
  expect(screen.getByDisplayValue("850")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("W-SHOP 단가"), { target: { value: "920.5" } });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(saveMutate).toHaveBeenCalledWith(expect.objectContaining({
    buildingId: 3,
    utilityType: "water",
    prices: expect.arrayContaining([{ customer_number_id: 12, unit_price: 920.5 }]),
  }), expect.anything());
});

it("고객번호가 없으면 건물 상세 등록 안내를 표시한다", () => {
  vi.mocked(useUtilityPrices).mockReturnValue({ data: [], isLoading: false, error: null } as never);
  render(<UnitPriceModal open buildingId={3} utilityType="gas" onClose={() => {}} />);
  expect(screen.getByText(/건물 상세에서 고객번호를 먼저 등록/)).toBeInTheDocument();
});
```

- [ ] **Step 2: page 실패 테스트 작성** — utilities mock에 `useUtilityPrices`, `useSaveUtilityUnitPrices`, `useUtilityConfirmation`, `useConfirmUtilities`를 기본값과 함께 추가한다. 건물 선택 후 `단가 설정` 클릭 시 현재 탭 고객번호 목록이 보이는지 단언한다.

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run "app/(staff)/staff/utilities/components/UnitPriceModal.test.tsx" "app/(staff)/staff/utilities/page.test.tsx"` · Expected: FAIL(컴포넌트/버튼 없음).

- [ ] **Step 4: `UnitPriceModal.tsx` 구현**

구현 규칙:

- query 데이터가 바뀌면 `Record<customerNumberId,string>` draft를 동기화한다.
- 기존 단가는 문자열로 초기화하고 미설정은 빈 문자열이다.
- 저장 payload에는 **빈칸이 아닌** 유한·0 이상 단가만 포함한다. 음수/비수/전부 빈칸은 toast error로 막는다.
- 저장 성공 시 `"N개 고객번호 단가를 저장했습니다."` toast 후 닫고, 실패 시 error toast.
- 로딩·조회 오류·고객번호 0건을 각각 표시한다.

핵심 렌더 구조:

```tsx
<Modal open={open} onClose={onClose} title={`${TYPE_LABELS[utilityType]} 단가 설정`}>
  {prices.map((row) => (
    <label key={row.customerNumberId} className="grid grid-cols-[1fr_9rem] items-center gap-3">
      <span>
        <strong>{row.customerNo}</strong>
        <small>{row.holderName ?? "명의 미등록"}</small>
      </span>
      <input
        aria-label={`${row.customerNo} 단가`}
        type="number" min="0" step="0.01"
        value={drafts[row.customerNumberId] ?? ""}
        onChange={(event) => setPrice(row.customerNumberId, event.target.value)}
      />
    </label>
  ))}
  {prices.length === 0 && <p>건물 상세에서 고객번호를 먼저 등록해 주세요.</p>}
  <Button variant="ghost" onClick={onClose}>취소</Button>
  <Button onClick={submit} disabled={savePrices.isPending || prices.length === 0}>저장</Button>
</Modal>
```

- [ ] **Step 5: page에 단가 버튼·모달 배선**

```tsx
const [priceModalOpen, setPriceModalOpen] = useState(false);

<Button variant="ghost" onClick={() => setPriceModalOpen(true)} disabled={!buildingId}>
  단가 설정
</Button>

<UnitPriceModal
  open={priceModalOpen}
  buildingId={buildingId}
  utilityType={utilityType}
  onClose={() => setPriceModalOpen(false)}
/>
```

건물·탭 변경 시 모달을 닫아 이전 scope draft가 보이지 않게 한다.

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run "app/(staff)/staff/utilities/components/UnitPriceModal.test.tsx" "app/(staff)/staff/utilities/page.test.tsx"` · Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add "app/(staff)/staff/utilities/components/UnitPriceModal.tsx" "app/(staff)/staff/utilities/components/UnitPriceModal.test.tsx" "app/(staff)/staff/utilities/page.tsx" "app/(staff)/staff/utilities/page.test.tsx"
git commit -m "feat(utilities): 고객번호별 공과금 단가 설정 모달 연결" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 단가·자동요금·요약·이력 실데이터 표시

**Files:**
- Modify: `app/(staff)/staff/utilities/page.test.tsx`
- Modify: `app/(staff)/staff/utilities/page.tsx`
- Modify: `app/(staff)/staff/utilities/components/UtilityTable.tsx`
- Modify: `app/(staff)/staff/utilities/components/UtilityHistoryModal.test.tsx`
- Modify: `app/(staff)/staff/utilities/components/UtilityHistoryModal.tsx`

**Interfaces:**
- Consumes: `UtilityUnitRow.unitPrice/resolvedUnitPrice/automaticCharge`, `MeterHistoryRow.unitPrice`, 기존 draft manual charge.
- Produces: 현재/스냅샷 단가와 자동요금 표시, 유효요금 기반 예상 부과액, 월별 단가 증감.

- [ ] **Step 1: 실패 테스트 작성**

`page.test.tsx`의 fixture에 다음을 추가한다.

```ts
unitPrice: 850,
resolvedUnitPrice: 900,
automaticCharge: 12000,
```

그리고 건물 선택 후 다음을 단언한다.

- 테이블 헤더 `단가`, `자동요금` 존재.
- 스냅샷 단가 `850`이 현재 해석값 `900`보다 우선 표시.
- 수동 draft가 없을 때 예상 부과 `12,000원`; 수동요금 `15,000` 입력 후 `15,000원`.
- 기존 "단가 미연동" 안내 문구가 사라지고, 미설정 세대는 수동요금을 쓰라는 안내가 보임.

`UtilityHistoryModal.test.tsx`의 이력 fixture를 단가 850/800으로 바꾸고 `단가 증감`, `+50`을 단언한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "app/(staff)/staff/utilities/page.test.tsx" "app/(staff)/staff/utilities/components/UtilityHistoryModal.test.tsx"` · Expected: FAIL(단가 컬럼/증감 없음 또는 안내문 불일치).

- [ ] **Step 3: `UtilityTable` 실컬럼 구현**

`사용량` 다음에 `단가`, `자동요금`, `수동 입력 요금` 순서로 둔다. `min-width`를 늘리고 각 행에서:

```tsx
const displayUnitPrice = row.unitPrice ?? row.resolvedUnitPrice;

<td className="num px-4 py-3 text-right text-t3">
  {formatNumber(displayUnitPrice)}
</td>
<td className="num px-4 py-3 text-right">
  {formatNumber(row.automaticCharge)}
</td>
```

`unitPrice`가 존재하면 계산 당시 값을 보존해 보여주며, 아직 계산하지 않은 행만 `resolvedUnitPrice`로 미리보기한다. 할인 뱃지·공실 disabled·행 이력 클릭은 그대로 유지한다.

- [ ] **Step 4: 요약·안내 배너 정리**

현재 page의 예상 부과 reducer는 수동 draft가 있으면 수동, 없으면 `row.automaticCharge ?? 0`이므로 유지한다. 테스트로 이 우선순위를 고정한다. 기존 배너는 아래 의미로 교체한다.

```tsx
단가가 설정된 세대는 부과 계산 시 자동요금이 저장됩니다. 단가를 해석할 수 없는 세대는 수동 입력 요금을 사용해 주세요.
```

`UtilitySummaryCards.tsx`는 이미 숫자 props만 표시하므로 수정하지 않는다.

- [ ] **Step 5: 이력 단가 증감 실데이터화**

현재 history가 최신→과거이므로 같은 index의 다음 행을 전월로 사용한다.

```ts
const rows = history.map((item, index) => {
  const prev = history[index + 1];
  return {
    ...item,
    chargeDelta: item.charge !== null && prev?.charge !== null && prev
      ? item.charge - prev.charge : null,
    unitPriceDelta: item.unitPrice !== null && prev?.unitPrice !== null && prev
      ? item.unitPrice - prev.unitPrice : null,
  };
});
```

표를 `월 | 부과액 | 전월 대비 증감 | 단가 | 단가 증감` 5컬럼으로 만들고 기존 "단가 연동 후 표시" placeholder 문구를 제거한다. 값이 없으면 `—`를 유지한다.

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run "app/(staff)/staff/utilities/page.test.tsx" "app/(staff)/staff/utilities/components/UtilityHistoryModal.test.tsx"` · Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add "app/(staff)/staff/utilities/page.tsx" "app/(staff)/staff/utilities/page.test.tsx" "app/(staff)/staff/utilities/components/UtilityTable.tsx" "app/(staff)/staff/utilities/components/UtilityHistoryModal.tsx" "app/(staff)/staff/utilities/components/UtilityHistoryModal.test.tsx"
git commit -m "feat(utilities): 계산 단가·자동요금·단가 이력을 실데이터로 표시" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 그룹 3 — 부과확정

### Task 5: 공과금 부과확정·재확정·dirty 경고

**Files:**
- Modify: `app/(staff)/staff/utilities/page.test.tsx`
- Modify: `app/(staff)/staff/utilities/page.tsx`

**Interfaces:**
- Consumes: `useUtilityConfirmation(buildingId,type,period)`, `useConfirmUtilities`, `UtilityConfirmation`.
- Produces: 확인 팝업 → 확정 mutation, 확정자/일시/세대수/합계 배지, 확정 후 수정 경고, 재확정 버튼 상태.

- [ ] **Step 1: 실패 테스트 작성**

utilities mock 기본값:

```ts
vi.mocked(useUtilityConfirmation).mockReturnValue({
  data: null, isLoading: false, error: null,
} as never);
vi.mocked(useConfirmUtilities).mockReturnValue({
  mutateAsync: confirmMutateAsync, isPending: false,
} as never);
```

추가 케이스:

```tsx
it("부과 확정 확인 후 현재 건물·유형·월을 확정한다", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  confirmMutateAsync.mockResolvedValue({ unitCount: 2, total: 60000 });
  render(<UtilitiesPage />);
  selectBuilding();
  fireEvent.click(screen.getByRole("button", { name: "부과 확정" }));
  await waitFor(() => expect(confirmMutateAsync).toHaveBeenCalledWith({
    buildingId: 1, utilityType: "water", period: expect.stringMatching(/^\d{4}-\d{2}-01$/),
  }));
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("2세대"));
});

it("확정 배지와 확정 후 수정 dirty 경고를 표시한다", () => {
  vi.mocked(useUtilityConfirmation).mockReturnValue({ data: {
    confirmedAt: "2026-08-13T02:00:00Z", confirmedByName: "김관리",
    unitCount: 2, totalAmount: 60000, isDirty: true,
  }, isLoading: false, error: null } as never);
  render(<UtilitiesPage />);
  selectBuilding();
  expect(screen.getByText(/김관리/)).toBeInTheDocument();
  expect(screen.getByText(/60,000원/)).toBeInTheDocument();
  expect(screen.getByText("확정 후 수정됨 — 재확정 필요")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "재확정" })).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run "app/(staff)/staff/utilities/page.test.tsx"` · Expected: FAIL(확정 버튼/배지/경고 없음).

- [ ] **Step 3: query·mutation 배선**

```tsx
const confirmationQuery = useUtilityConfirmation(buildingId, utilityType, period);
const confirmMutation = useConfirmUtilities();
const confirmation = confirmationQuery.data ?? null;

const confirmCharges = async () => {
  if (!buildingId) return;
  const verb = confirmation ? "재확정" : "부과 확정";
  if (!window.confirm(`당월 ${TYPE_LABELS[utilityType]} 요금을 ${verb}하시겠습니까?`)) return;
  try {
    const result = await confirmMutation.mutateAsync({ buildingId, utilityType, period });
    toast.success(
      `부과가 확정되었습니다. (${result.unitCount}세대 · ${result.total.toLocaleString("ko-KR")}원)`,
    );
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "부과 확정에 실패했습니다.");
  }
};
```

버튼은 `confirmation ? "재확정" : "부과 확정"`, disabled는 건물 미선택·활성 세대 0·mutation pending이다. 확정은 DB에 저장된 자동/수동요금만 합산하므로 버튼 옆 도움말 또는 확인문에 `부과 계산 후 확정` 의미를 포함한다.

- [ ] **Step 4: 확정 상태·dirty UI 구현**

세대 표 상단 또는 요약 카드 바로 아래에 다음 상태를 표시한다.

```tsx
{confirmation && (
  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3">
    <span className="rounded-lg bg-green-t px-2.5 py-1 text-xs font-bold text-green">
      부과 확정
    </span>
    <span className="text-xs text-t3">
      {new Date(confirmation.confirmedAt).toLocaleString("ko-KR")} ·
      {confirmation.confirmedByName ?? "확정자 미상"} ·
      {confirmation.unitCount.toLocaleString("ko-KR")}세대 ·
      {confirmation.totalAmount.toLocaleString("ko-KR")}원
    </span>
  </div>
)}
{confirmation?.isDirty && (
  <div role="alert" className="rounded-xl border border-amber/30 bg-amber-t px-4 py-3 text-sm font-bold text-amber">
    확정 후 수정됨 — 재확정 필요
  </div>
)}
```

실제 토큰 이름은 프로젝트 Tailwind 토큰에 맞추되 공용 컴포넌트 계약은 바꾸지 않는다. query 오류는 화면 전체를 막지 않고 확정 상태 영역에 재조회 안내를 표시한다.

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run "app/(staff)/staff/utilities/page.test.tsx"` · Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add "app/(staff)/staff/utilities/page.tsx" "app/(staff)/staff/utilities/page.test.tsx"
git commit -m "feat(utilities): 공과금 부과확정·재확정과 수정 감지 배지 연결" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 그룹 4 — 검침대장 엑셀

### Task 6: 세션 기반 엑셀 Route Handler + 실제 다운로드

**Files:**
- Create: `app/api/utilities/ledger/route.test.ts`
- Create: `app/api/utilities/ledger/route.ts`
- Modify: `app/(staff)/staff/utilities/page.test.tsx`
- Modify: `app/(staff)/staff/utilities/page.tsx`

**Interfaces:**
- Produces: `GET /api/utilities/ledger?buildingId=<id>&utility=<water|elec|gas>&period=YYYY-MM-01` → XLSX `Response`.
- Consumes: server `createClient()`, `buildings` RLS 조회, `list_utility_rows`, `rowsToXlsxBuffer`, Task 2 `ledgerDownloadUrl`.

- [ ] **Step 1: Route Handler 실패 테스트 작성**

`@/lib/supabase/server.createClient`와 `@/lib/export/xlsx.rowsToXlsxBuffer`를 `vi.hoisted` 목으로 둔다. 최소 케이스:

1. `buildingId` 누락/비정수, utility 허용값 밖, period가 월1일이 아니면 400이고 DB 호출 없음.
2. 건물 RLS 조회가 `null`이면 403.
3. 정상 요청은 `list_utility_rows`를 `{p_building_id,p_utility,p_period}`로 호출하고 11개 컬럼을 xlsx helper에 전달.
4. 파일명은 `[건물명]_[유형]_검침대장_YYYYMM.xlsx`가 `filename*=UTF-8''${encodeURIComponent(...)}`로 들어감.
5. RPC 오류는 500 JSON.

```ts
it("한글 파일명을 RFC 5987로 인코딩한다", async () => {
  createClient.mockResolvedValue(serverClient({ buildingName: "그린 빌라", rows: [rpcRow] }));
  rowsToXlsxBuffer.mockResolvedValue(Buffer.from([1, 2, 3]));
  const response = await GET(new Request(
    "http://localhost/api/utilities/ledger?buildingId=3&utility=elec&period=2026-08-01",
  ));
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toContain(
    `filename*=UTF-8''${encodeURIComponent("그린 빌라_전기_검침대장_202608.xlsx")}`,
  );
});
```

- [ ] **Step 2: page 다운로드 실패 테스트 작성**

기존 toast stub 테스트를 교체한다. `HTMLAnchorElement.prototype.click`을 spy하고 건물 선택→`검침대장 다운` 클릭 후 생성된 anchor의 `href`가 `ledgerDownloadUrl` 결과인지 단언한다. utilities mock의 `ledgerDownloadUrl`은 `"/api/utilities/ledger?buildingId=1&utility=water&period=2026-08-01"`을 반환하도록 한다.

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run app/api/utilities/ledger/route.test.ts "app/(staff)/staff/utilities/page.test.tsx"` · Expected: FAIL(route/실다운로드 없음).

- [ ] **Step 4: Route Handler 입력 검증·조회 구현**

```ts
import { createClient } from "@/lib/supabase/server";
import { rowsToXlsxBuffer } from "@/lib/export/xlsx";

const LABELS = { water: "수도", elec: "전기", gas: "가스" } as const;
type DbUtility = keyof typeof LABELS;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const buildingId = Number(params.get("buildingId"));
  const utility = params.get("utility") as DbUtility | null;
  const period = params.get("period") ?? "";
  if (!Number.isSafeInteger(buildingId) || buildingId <= 0
      || !utility || !(utility in LABELS)
      || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(period)) {
    return Response.json({ error: "invalid ledger parameters" }, { status: 400 });
  }

  const sb = await createClient();
  const { data: building, error: buildingError } = await sb
    .from("buildings").select("name").eq("id", buildingId).maybeSingle();
  if (buildingError) return Response.json({ error: buildingError.message }, { status: 500 });
  if (!building) return Response.json({ error: "forbidden" }, { status: 403 });

  const { data, error } = await sb.rpc("list_utility_rows", {
    p_building_id: buildingId, p_utility: utility, p_period: period,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  // 다음 Step의 table/buffer/Response
}
```

- [ ] **Step 5: 컬럼 매핑·XLSX Response 구현**

```ts
const table = ((data ?? []) as UtilityLedgerRpcRow[]).map((row) => ({
  unitNo: row.dong ? `${row.dong} ${row.unit_no}` : row.unit_no,
  tenantName: row.tenant_name ?? "",
  previousReading: row.previous_reading ?? "",
  currentReading: row.current_reading ?? "",
  usage: row.usage ?? "",
  unitPrice: row.unit_price ?? row.resolved_unit_price ?? "",
  automaticCharge: row.calc_charge ?? "",
  manualCharge: row.manual_charge ?? "",
  discount: row.discount_amount ?? "",
  note: row.note ?? "",
  processedAt: row.processed_at ?? "",
}));
const buffer = await rowsToXlsxBuffer([
  { header: "호실", key: "unitNo", width: 12 },
  { header: "입주자", key: "tenantName", width: 14 },
  { header: "전월지침", key: "previousReading", width: 12 },
  { header: "당월지침", key: "currentReading", width: 12 },
  { header: "사용량", key: "usage", width: 10 },
  { header: "단가", key: "unitPrice", width: 12 },
  { header: "자동요금", key: "automaticCharge", width: 14 },
  { header: "수동요금", key: "manualCharge", width: 14 },
  { header: "할인", key: "discount", width: 12 },
  { header: "적요", key: "note", width: 24 },
  { header: "처리일", key: "processedAt", width: 22 },
], table);

const filename = `${building.name}_${LABELS[utility]}_검침대장_${period.slice(0,7).replace("-","")}.xlsx`;
return new Response(new Uint8Array(buffer), {
  status: 200,
  headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition":
      `attachment; filename="utility_ledger_${period.slice(0,7).replace("-","")}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  },
});
```

`processed_at`은 원본 ISO 문자열을 보존한다. 건물명은 RLS가 적용되는 최소 `buildings` 조회 1회로 얻으며 클라이언트 쿼리 파라미터를 신뢰하지 않는다.

- [ ] **Step 6: page 실제 다운로드 배선**

```tsx
const exportLedger = () => {
  if (!buildingId) return;
  try {
    const anchor = document.createElement("a");
    anchor.href = ledgerDownloadUrl(buildingId, utilityType, period);
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch {
    toast.error("검침대장을 다운로드하지 못했습니다.");
  }
};
```

기존 `TODO(export)`와 `toast.info` stub을 제거한다.

- [ ] **Step 7: 통과 확인**

Run: `npx vitest run app/api/utilities/ledger/route.test.ts "app/(staff)/staff/utilities/page.test.tsx"` · Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
git add app/api/utilities/ledger "app/(staff)/staff/utilities/page.tsx" "app/(staff)/staff/utilities/page.test.tsx"
git commit -m "feat(utilities): 세션 기반 검침대장 XLSX 생성·다운로드 연결" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 전체 검증 + WBS 동기화

**Files:** 없음(검증·동기화만; 검증 과정에서 코드 수정이 생기면 해당 소유 Task의 파일과 테스트를 함께 수정).

**Interfaces:**
- Consumes: Task 1~6의 migration/RPC/data/UI/route 산출물.
- Produces: 전체 test/type/lint 결과, verify 정적 대조 결과, WBS 화면 상태 메모.

- [ ] **Step 1: 마지막 화면 커밋 직후 WBS 동기화**

`wbs-commit-sync`를 호출한다.

- 버킷: **주택관리ERP**
- 대상: 공과금 데이터 `/staff/utilities`
- dev 트랙만 갱신
- 비고: `고객번호별 단가·자동요금·공과금 자체 부과확정/재확정·dirty 감지·검침대장 XLSX`
- `완료` 자동변경 금지

- [ ] **Step 2: 집중 테스트 재실행**

```bash
npx vitest run hooks/reactquery/utilities/apis.test.ts
npx vitest run "app/(staff)/staff/utilities/components/UnitPriceModal.test.tsx"
npx vitest run "app/(staff)/staff/utilities/components/UtilityHistoryModal.test.tsx"
npx vitest run "app/(staff)/staff/utilities/page.test.tsx"
npx vitest run app/api/utilities/ledger/route.test.ts
```

Expected: 모두 PASS.

- [ ] **Step 3: 전체 회귀 테스트**

Run: `npm test` · Expected: 전체 PASS, 기존 P5a/관리비/건물 export 회귀 없음.

- [ ] **Step 4: 타입·린트**

Run: `npx tsc --noEmit` · Expected: 0 error.

Run: `npm run lint` · Expected: 신규/수정 파일 error 0, 기존 warning 수준을 늘리지 않음.

- [ ] **Step 5: verify SQL 정적 대조**

`supabase/verify/p5b_checks.sql`을 spec §3~§6과 대조한다. 특히 다음을 검색한다.

- 신규 두 테이블·RLS·updated_at trigger.
- 6개 함수의 정확한 인자형과 public/anon revoke + authenticated grant.
- `list_utility_rows`의 drop/recreate와 `resolved_unit_price` 반환.
- 단가 해석 `customer_no` 우선 + `having count(*)=1`.
- `save_meter_readings`의 `greatest(0, round_charge(...)-discount)`와 스냅샷.
- `confirm_utilities`의 공실 제외·수동 우선·재확정·audit.
- dirty의 검침 `updated_at` **및 단가 `updated_at`**.

라이브 SQL과 E2E는 실행하지 않고 사용자 PC 적용 순서를 인계한다.

- [ ] **Step 6: placeholder·범위 스캔**

```bash
rg -n "TODO\(export\)|TODO\(p3a\)|단가 미연동|연동 후 표시|exceljs" "app/(staff)/staff/utilities" hooks/reactquery/utilities app/api/utilities supabase/migrations/0014_p5b_utility_pricing.sql
```

Expected: 이번 구현 대상 placeholder 0건, 신규 `exceljs` import 0건. 상가 고정 사용량 등 명시적 후속 문구는 허용한다.

- [ ] **Step 7: 최종 상태 확인**

`git status --short`로 의도한 파일만 변경됐는지 확인한다. 검증 수정이 있었다면 테스트와 같은 커밋에 넣고 필수 트레일러를 붙인다. 검증만 했다면 빈 커밋을 만들지 않는다.

---

## Self-Review

**Spec coverage:**
- §3 신규 스키마·트리거 → Task 1 Steps 1. ✅
- §4 utilities RLS → Task 1 Step 2. ✅
- §5.1~5.2 단가 조회/저장 → Task 1 Step 3 + Task 2. ✅
- §5.3 단가 해석·`resolved_unit_price` → Task 1 Step 4 + Task 2 mapper. ✅
- §5.4 자동요금·스냅샷 → Task 1 Step 5 + Task 4 display. ✅
- §5.5 확정·재확정·audit → Task 1 Step 6 + Task 5. ✅
- §5.6 검침/단가 dirty → Task 1 Step 7 + Task 5 warning. ✅
- §6 데이터층 5개 API·keys·queries·mutations → Task 2. ✅
- §7 단가 모달·테이블·요약·이력·확정 UI → Tasks 3~5. ✅
- §8 Route Handler·기존 xlsx 재사용·한글 파일명 → Task 6. ✅
- §9 테스트 전략 → Tasks 1~7. ✅
- §10 migration/env → Global Constraints + Tasks 1/7. ✅
- §11 4그룹 → 문서 그룹 1~4 그대로. ✅
- §12 후속 항목 → Global Constraints 범위 밖으로 고정. ✅

**Placeholder scan:** `TODO(export)`, `TODO(p3a)`, "단가 미연동", "단가 연동 후 표시"는 각 소유 Task에서 제거하도록 명시했다. `common_elec`, 상가 고정 사용량, 관리비 통합은 구현하지 않는다. ✅

**Type consistency:**
- UI `electricity` → `dbUtility()` → DB/route `elec`가 API·query·mutation·URL 전 구간에서 동일하다. ✅
- `UtilityUnitRow.unitPrice`(스냅샷)와 `resolvedUnitPrice`(현재 설정)를 구분하고 UI 우선순위를 명시했다. ✅
- `manual_charge ?? calc_charge` 우선순위가 history·summary·confirm에서 동일하다. ✅
- RPC snake_case 결과가 `apis.ts`에서만 camelCase로 변환된다. ✅
- `period`는 page/query/mutation/route 모두 `YYYY-MM-01`. ✅

**Security/operability:**
- 신규 두 테이블은 RLS, 쓰기 RPC는 org/module/소유권을 재검증한다. ✅
- definer RPC의 public/anon EXECUTE를 제거하고 authenticated만 grant한다. ✅
- Route Handler는 세션 쿠키 기반 Supabase client와 buildings RLS를 거치며 건물명을 클라이언트에서 받지 않는다. ✅
- worker 원격 적용 금지와 사용자 PC의 `0013…→0014→verify` 순서를 명시했다. ✅

> **Implementation watch-outs:** ① 반환형 추가는 `create or replace`가 아니라 `drop function list_utility_rows(bigint,text,date)` 후 재생성이다. ② `listMeterHistory`의 기존 `calc_charge ?? manual_charge`는 스펙과 반대이므로 Task 2에서 반드시 교정한다. ③ 단가 변경은 저장된 `calc_charge`를 자동 재계산하지 않으므로 dirty 경고 뒤 사용자가 `부과 계산`→`재확정` 순서로 처리한다. ④ 신규 XLSX 경로에서 `exceljs`를 직접 import하지 않는다.

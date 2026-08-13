-- 0014_p5b_utility_pricing.sql
-- P5b: 고객번호별 공과금 단가·자동요금·공과금 자체 부과확정
-- 의존: P0(profiles, audit_log, set_updated_at), P2a(current_user_org,
-- current_user_has_module, my_org_ids), P3a(building_customer_numbers),
-- P3b(unit_meters, occupancies), P5a(meter_readings, water_discounts),
-- P5(round_charge)

-- ===== 고객번호별 현재 단가 =====
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

-- ===== 건물×유형×월 공과금 부과확정 =====
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

-- ===== updated_at 트리거 =====
do $$ declare t text; begin
  foreach t in array array['utility_unit_prices','utility_confirmations'] loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();',
      t
    );
  end loop;
end $$;

-- ===== RLS: SELECT org 개방 / 쓰기 utilities 모듈 =====
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
      select bcn.id
      from building_customer_numbers bcn
      join buildings b on b.id = bcn.building_id
      where b.org_id in (select my_org_ids())
    ) and current_user_has_module('utilities')
  )
  with check (
    building_customer_number_id in (
      select bcn.id
      from building_customer_numbers bcn
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

-- ===== 단가 설정 조회 =====
create or replace function list_utility_prices(p_building_id bigint, p_utility text)
returns table(
  customer_number_id bigint,
  customer_no text,
  holder_name text,
  sort_order int,
  unit_price numeric
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

-- ===== 단가 설정 원자적 저장 =====
create or replace function save_utility_unit_prices(
  p_building_id bigint,
  p_utility text,
  p_prices jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint := current_user_org();
  v_item jsonb;
  v_id bigint;
  v_price numeric;
  v_count int := 0;
begin
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('utilities') then
    raise exception 'forbidden: utilities required';
  end if;
  if p_utility not in ('water','elec','gas') then
    raise exception 'bad utility %', p_utility;
  end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org';
  end if;
  if jsonb_typeof(coalesce(p_prices, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'prices must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'price entries must be objects';
    end if;
    v_id := nullif(v_item->>'customer_number_id', '')::bigint;
    v_price := nullif(v_item->>'unit_price', '')::numeric;
    if v_id is null or not exists (
      select 1
      from building_customer_numbers
      where id = v_id
        and building_id = p_building_id
        and kind = p_utility
        and deleted_at is null
    ) then
      raise exception 'customer number % not in building/utility', v_id;
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'unit price must be zero or greater';
    end if;

    insert into utility_unit_prices(building_customer_number_id, unit_price)
      values (v_id, v_price)
      on conflict (building_customer_number_id) do update
        set unit_price = excluded.unit_price
        where utility_unit_prices.unit_price is distinct from excluded.unit_price;
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('saved', v_count);
end $$;

-- ===== 세대별 검침 조회: 현재 해석 단가 추가 =====
-- PostgreSQL은 RETURNS TABLE 반환형을 create or replace로 바꿀 수 없어 재생성한다.
drop function list_utility_rows(bigint,text,date);
create function list_utility_rows(
  p_building_id bigint,
  p_utility text,
  p_period date
) returns table(
  unit_id bigint,
  unit_no text,
  dong text,
  occupancy_id bigint,
  tenant_name text,
  occupancy_status occupancy_status,
  move_in_date date,
  customer_no text,
  meter_no text,
  previous_reading numeric,
  current_reading numeric,
  usage numeric,
  unit_price numeric,
  calc_charge integer,
  discount_amount integer,
  manual_charge integer,
  note text,
  processed_at timestamptz,
  discount_type text,
  resolved_unit_price numeric
) language sql stable security definer set search_path = public as $$
  select
    u.id,
    u.unit_no,
    u.dong,
    o.id,
    o.tenant_name,
    o.status,
    o.move_in_date,
    m.customer_no,
    m.meter_no,
    coalesce(cur.previous_reading, prev.current_reading) as previous_reading,
    cur.current_reading,
    cur.usage,
    cur.unit_price,
    cur.calc_charge,
    coalesce(cur.discount_amount, wd.amount) as discount_amount,
    cur.manual_charge,
    cur.note,
    cur.processed_at,
    wd.discount_type,
    coalesce(
      (select uup.unit_price
       from unit_meters um
       join building_customer_numbers bcn
         on bcn.building_id = p_building_id
        and bcn.kind = p_utility
        and bcn.customer_no = um.customer_no
        and bcn.deleted_at is null
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where um.unit_id = u.id and um.utility = p_utility),
      (select max(uup.unit_price)
       from building_customer_numbers bcn
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where bcn.building_id = p_building_id
         and bcn.kind = p_utility
         and bcn.deleted_at is null
       having count(*) = 1)
    ) as resolved_unit_price
  from units u
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select *
    from occupancies oc
    where oc.unit_id = u.id and oc.deleted_at is null
    order by oc.created_at desc, oc.id desc
    limit 1
  ) o on true
  left join unit_meters m on m.unit_id = u.id and m.utility = p_utility
  left join meter_readings cur
    on cur.unit_id = u.id and cur.utility = p_utility and cur.period = p_period
  left join meter_readings prev
    on prev.unit_id = u.id
   and prev.utility = p_utility
   and prev.period = (p_period - interval '1 month')::date
  left join water_discounts wd on wd.unit_id = u.id and p_utility = 'water'
  where u.building_id = p_building_id and u.deleted_at is null
  order by u.unit_no
$$;

-- ===== 검침 저장: 단가 해석 + 자동요금 스냅샷 =====
create or replace function save_meter_readings(
  p_building_id bigint,
  p_utility text,
  p_period date,
  p_rows jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint := current_user_org();
  v_item jsonb;
  v_count int := 0;
  v_unit_id bigint;
  v_prev numeric;
  v_cur numeric;
  v_usage numeric;
  v_disc integer;
  v_price numeric;
  v_calc integer;
  v_total_calc bigint := 0;
begin
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('utilities') then
    raise exception 'forbidden: utilities required';
  end if;
  if p_utility not in ('water','elec','gas') then
    raise exception 'bad utility %', p_utility;
  end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org';
  end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month';
  end if;
  if p_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'rows must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'row entries must be objects';
    end if;
    v_unit_id := nullif(v_item->>'unit_id', '')::bigint;
    if v_unit_id is null or not exists (
      select 1
      from units u
      join buildings b on b.id = u.building_id
      where u.id = v_unit_id
        and u.building_id = p_building_id
        and u.deleted_at is null
        and b.org_id = v_org
    ) then
      raise exception 'unit % not in building/org', v_unit_id;
    end if;

    v_cur := nullif(v_item->>'current_reading', '')::numeric;
    select current_reading into v_prev
    from meter_readings
    where unit_id = v_unit_id
      and utility = p_utility
      and period = (p_period - interval '1 month')::date;
    v_usage := case when v_cur is not null and v_prev is not null then v_cur - v_prev end;

    select amount into v_disc
    from water_discounts
    where unit_id = v_unit_id and p_utility = 'water';

    select coalesce(
      (select uup.unit_price
       from unit_meters um
       join building_customer_numbers bcn
         on bcn.building_id = p_building_id
        and bcn.kind = p_utility
        and bcn.customer_no = um.customer_no
        and bcn.deleted_at is null
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where um.unit_id = v_unit_id and um.utility = p_utility),
      (select max(uup.unit_price)
       from building_customer_numbers bcn
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where bcn.building_id = p_building_id
         and bcn.kind = p_utility
         and bcn.deleted_at is null
       having count(*) = 1)
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
      nullif(v_item->>'manual_charge', '')::integer,
      nullif(v_item->>'note', ''),
      now()
    )
    on conflict (unit_id, utility, period) do update set
      previous_reading = excluded.previous_reading,
      current_reading = excluded.current_reading,
      usage = excluded.usage,
      unit_price = excluded.unit_price,
      calc_charge = excluded.calc_charge,
      discount_amount = excluded.discount_amount,
      manual_charge = excluded.manual_charge,
      note = excluded.note,
      processed_at = excluded.processed_at;

    v_count := v_count + 1;
    v_total_calc := v_total_calc + coalesce(v_calc, 0);
  end loop;

  return jsonb_build_object(
    'saved', v_count,
    'period', p_period,
    'total_calc', v_total_calc
  );
end $$;

-- ===== 공과금 부과확정(재확정 가능) =====
create or replace function confirm_utilities(
  p_building_id bigint,
  p_utility text,
  p_period date
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
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org';
  end if;
  if p_utility not in ('water','elec','gas') then
    raise exception 'bad utility %', p_utility;
  end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month';
  end if;
  if p_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed';
  end if;

  select
    count(*)::int,
    coalesce(sum(coalesce(mr.manual_charge, mr.calc_charge, 0)), 0)::bigint
  into v_count, v_total
  from units u
  join lateral (
    select o.status
    from occupancies o
    where o.unit_id = u.id and o.deleted_at is null
    order by o.created_at desc, o.id desc
    limit 1
  ) occ on occ.status <> 'vacant'
  left join meter_readings mr
    on mr.unit_id = u.id
   and mr.utility = p_utility
   and mr.period = p_period
  where u.building_id = p_building_id and u.deleted_at is null;

  insert into utility_confirmations(
    building_id, utility, period, unit_count, total_amount, confirmed_at, confirmed_by
  ) values (
    p_building_id, p_utility, p_period, v_count, v_total, now(), auth.uid()
  )
  on conflict (building_id, utility, period) do update set
    unit_count = excluded.unit_count,
    total_amount = excluded.total_amount,
    confirmed_at = excluded.confirmed_at,
    confirmed_by = excluded.confirmed_by;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (
      v_org,
      auth.uid(),
      'UTILITY_CONFIRM',
      'utility_confirmations',
      p_building_id::text,
      jsonb_build_object(
        'utility', p_utility,
        'period', p_period,
        'unit_count', v_count,
        'total', v_total
      )
    );

  return jsonb_build_object('unit_count', v_count, 'total', v_total);
end $$;

-- ===== 확정 상태 + 확정 후 검침/단가 수정 감지 =====
create or replace function list_utility_confirmation(
  p_building_id bigint,
  p_utility text,
  p_period date
) returns table(
  confirmed_at timestamptz,
  confirmed_by_name text,
  unit_count int,
  total_amount bigint,
  is_dirty boolean
) language sql stable security definer set search_path = public as $$
  select
    uc.confirmed_at,
    pr.full_name,
    uc.unit_count,
    uc.total_amount,
    (
      uc.confirmed_at is not null and (
        exists (
          select 1
          from meter_readings mr
          join units u on u.id = mr.unit_id
          where u.building_id = p_building_id
            and mr.utility = p_utility
            and mr.period = p_period
            and mr.updated_at > uc.confirmed_at
        ) or exists (
          select 1
          from utility_unit_prices uup
          join building_customer_numbers bcn
            on bcn.id = uup.building_customer_number_id
          where bcn.building_id = p_building_id
            and bcn.kind = p_utility
            and bcn.deleted_at is null
            and uup.updated_at > uc.confirmed_at
        )
      )
    ) as is_dirty
  from utility_confirmations uc
  join buildings b on b.id = uc.building_id and b.org_id = current_user_org()
  left join profiles pr on pr.user_id = uc.confirmed_by
  where uc.building_id = p_building_id
    and uc.utility = p_utility
    and uc.period = p_period
$$;

-- ===== definer 함수 권한 잠금 =====
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

-- P5a: 검침·지침(/staff/utilities)
-- 의존: P1a(units, buildings), P2a(current_user_org, current_user_has_module, my_org_ids, set_updated_at),
--       P3b(unit_meters, occupancies 확장, occupancy_status)

-- ===== meter_readings: 세대·유형·월별 지침 이력 =====
create table meter_readings (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  utility text not null check (utility in ('water','elec','gas')),
  period  date not null,                 -- 월1일 정규화
  previous_reading numeric(12,2),
  current_reading  numeric(12,2),
  usage            numeric(12,2),
  unit_price       numeric(12,2),        -- 단가: 미도입(null 자리)
  calc_charge      integer,              -- 자동요금: 미도입(null 자리)
  discount_amount  integer,              -- 계산 시 water_discounts 스냅샷
  manual_charge    integer,
  note             text,
  processed_at     timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, utility, period)
);
create index on meter_readings (unit_id, utility, period desc);

-- ===== water_discounts: 세대 수도 할인(config, 하드삭제) =====
create table water_discounts (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  discount_type text not null check (discount_type in ('recipient','multichild','other')),
  amount integer not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id)
);
create index on water_discounts (unit_id);

-- ===== updated_at 트리거 =====
do $$ declare t text; begin
  foreach t in array array['meter_readings','water_discounts'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- ===== RLS: select org 개방 / write utilities 모듈 =====
alter table meter_readings  enable row level security;
alter table water_discounts enable row level security;

create policy mr_select on meter_readings for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy mr_write on meter_readings for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('utilities'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('utilities'));
create policy wd_select on water_discounts for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy wd_write on water_discounts for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('utilities'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('utilities'));

-- ===== 조회 RPC =====
create or replace function list_utility_rows(
  p_building_id bigint, p_utility text, p_period date
) returns table(
  unit_id bigint, unit_no text, dong text,
  occupancy_id bigint, tenant_name text, occupancy_status occupancy_status, move_in_date date,
  customer_no text, meter_no text,
  previous_reading numeric, current_reading numeric, usage numeric,
  unit_price numeric, calc_charge integer, discount_amount integer,
  manual_charge integer, note text, processed_at timestamptz,
  discount_type text
) language sql stable security definer set search_path = public as $$
  select u.id, u.unit_no, u.dong,
    o.id, o.tenant_name, o.status, o.move_in_date,
    m.customer_no, m.meter_no,
    coalesce(cur.previous_reading, prev.current_reading) as previous_reading,
    cur.current_reading, cur.usage,
    cur.unit_price, cur.calc_charge,
    coalesce(cur.discount_amount, wd.amount) as discount_amount,
    cur.manual_charge, cur.note, cur.processed_at,
    wd.discount_type
  from units u
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select * from occupancies oc where oc.unit_id = u.id and oc.deleted_at is null
    order by oc.created_at desc limit 1
  ) o on true
  left join unit_meters   m    on m.unit_id = u.id and m.utility = p_utility
  left join meter_readings cur  on cur.unit_id = u.id and cur.utility = p_utility and cur.period = p_period
  left join meter_readings prev on prev.unit_id = u.id and prev.utility = p_utility
                                and prev.period = (p_period - interval '1 month')::date
  left join water_discounts wd  on wd.unit_id = u.id and p_utility = 'water'
  where u.building_id = p_building_id and u.deleted_at is null
  order by u.unit_no
$$;
revoke execute on function list_utility_rows(bigint,text,date) from anon;

-- ===== 저장 RPC(원자적) =====
create or replace function save_meter_readings(
  p_building_id bigint, p_utility text, p_period date, p_rows jsonb  -- [{unit_id, current_reading, manual_charge, note}]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_item jsonb; v_count int := 0;
  v_unit_id bigint; v_prev numeric; v_cur numeric; v_usage numeric; v_disc integer;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('utilities') then raise exception 'forbidden: utilities required'; end if;
  if p_utility not in ('water','elec','gas') then raise exception 'bad utility %', p_utility; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    v_unit_id := (v_item->>'unit_id')::bigint;
    if not exists (select 1 from units u join buildings b on b.id=u.building_id
                   where u.id=v_unit_id and u.building_id=p_building_id and b.org_id=v_org) then
      raise exception 'unit % not in building/org', v_unit_id; end if;

    v_cur := nullif(v_item->>'current_reading','')::numeric;
    select current_reading into v_prev from meter_readings
      where unit_id=v_unit_id and utility=p_utility and period=(p_period - interval '1 month')::date;
    v_usage := case when v_cur is not null and v_prev is not null then v_cur - v_prev end;
    select amount into v_disc from water_discounts
      where unit_id=v_unit_id and p_utility='water';

    insert into meter_readings(unit_id, utility, period, previous_reading, current_reading, usage,
        discount_amount, manual_charge, note, processed_at)
      values (v_unit_id, p_utility, p_period, v_prev, v_cur, v_usage,
        v_disc, nullif(v_item->>'manual_charge','')::integer, nullif(v_item->>'note',''), now())
      on conflict (unit_id, utility, period) do update set
        previous_reading=excluded.previous_reading, current_reading=excluded.current_reading,
        usage=excluded.usage, discount_amount=excluded.discount_amount,
        manual_charge=excluded.manual_charge, note=excluded.note, processed_at=now();
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('saved', v_count, 'period', p_period);
end $$;
revoke execute on function save_meter_readings(bigint,text,date,jsonb) from anon;

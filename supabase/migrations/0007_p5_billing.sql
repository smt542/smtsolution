-- 0007_p5_billing.sql
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

-- ===== 우수리 헬퍼 (TS effectiveAmount와 매핑 일치) =====
create or replace function round_charge(p_value numeric, p_rounding text)
returns int language sql immutable as $$
  select case p_rounding
    when 'up'   then ceil(p_value)
    when 'down' then floor(p_value)
    else round(p_value)            -- 'round','raw',기타 → 반올림
  end::int;
$$;
revoke execute on function round_charge(numeric, text) from anon;

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

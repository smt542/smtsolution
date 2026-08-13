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

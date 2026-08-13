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

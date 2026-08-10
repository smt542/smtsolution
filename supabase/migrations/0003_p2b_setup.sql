-- P2b: 셋업·기타 설정(/setup) 5탭
-- 의존: P0(organizations, set_updated_at, my_org_ids), P1a(attachments, attachment_kind),
--       P2a(current_user_has_module)

-- ===== 탭①②③ 단일행 config =====
create table setup_config (
  org_id bigint primary key references organizations(id) on delete cascade,
  customer_notice        text,
  unit_label_default     text not null default 'code' check (unit_label_default in ('code','name')),
  late_fee_merge         boolean not null default false,
  print_utility_cutoff   boolean not null default false,
  print_water_unit_price boolean not null default false,
  print_billing_period   boolean not null default false,
  print_delta            boolean not null default false,
  show_as_on_main        boolean not null default false,
  cutoff_months          int,
  mgmt_bank1  text, mgmt_acct1  text, mgmt_holder1 text, mgmt_print1 boolean not null default true,
  mgmt_bank2  text, mgmt_acct2  text, mgmt_holder2 text, mgmt_print2 boolean not null default true,
  settle_bank text, settle_acct text, settle_holder text,
  water_unit_reflect     boolean not null default false,
  electric_unit_reflect  boolean not null default false,
  vacancy_payment_mode   text not null default 'manual' check (vacancy_payment_mode in ('manual','auto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== 이사정산 체크항목(config 성격, 리스트) =====
create table settlement_check_items (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, label)
);

-- ===== 시스템 설정 마스터 (label) =====
create table room_types (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  label text not null, sort_order int not null default 0, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, label));
create table septic_vendors (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  label text not null, sort_order int not null default 0, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, label));
create table as_categories (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  label text not null, sort_order int not null default 0, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, label));
create table cleaning_teams (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  label text not null, sort_order int not null default 0, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, label));

-- ===== 자주 보내는 문자 (제목+본문) =====
create table quick_messages (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  title text not null, body text not null, sort_order int not null default 0, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, title));

-- ===== 장기수선비 이력 (건물별) =====
create table long_term_repair_history (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  building_id bigint not null references buildings(id) on delete cascade,
  work_name text not null, work_date date, amount bigint, memo text, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on long_term_repair_history (org_id, building_id);

-- ===== updated_at 트리거 =====
do $$ declare t text; begin
  foreach t in array array['setup_config','settlement_check_items','room_types','septic_vendors',
                           'as_categories','cleaning_teams','quick_messages','long_term_repair_history'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;

-- ===== RLS: 민감 config (첫 module-permission) =====
alter table setup_config           enable row level security;
alter table settlement_check_items enable row level security;

create policy sc_select on setup_config for select
  using (org_id in (select my_org_ids()));
create policy sc_insert on setup_config for insert
  with check (org_id in (select my_org_ids()) and current_user_has_module('settings'));
create policy sc_update on setup_config for update
  using (org_id in (select my_org_ids()) and current_user_has_module('settings'))
  with check (org_id in (select my_org_ids()) and current_user_has_module('settings'));

create policy sci_select on settlement_check_items for select
  using (org_id in (select my_org_ids()));
create policy sci_insert on settlement_check_items for insert
  with check (org_id in (select my_org_ids()) and current_user_has_module('settings'));
create policy sci_update on settlement_check_items for update
  using (org_id in (select my_org_ids()) and current_user_has_module('settings'))
  with check (org_id in (select my_org_ids()) and current_user_has_module('settings'));
create policy sci_delete on settlement_check_items for delete
  using (org_id in (select my_org_ids()) and current_user_has_module('settings'));

-- ===== RLS: 참조 마스터 (P1a 개방 CRUD) =====
alter table room_types               enable row level security;
alter table septic_vendors           enable row level security;
alter table as_categories            enable row level security;
alter table cleaning_teams           enable row level security;
alter table quick_messages           enable row level security;
alter table long_term_repair_history enable row level security;

create policy rt_all  on room_types               for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy sv_all  on septic_vendors           for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy asc_all on as_categories            for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy ct_all  on cleaning_teams           for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy qm_all  on quick_messages           for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy ltr_all on long_term_repair_history for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));

-- 0024_billing_period_settings.sql
-- 건물·월분별 부과기준일과 납기일 설정
-- 의존: P0(set_updated_at), P1a(buildings), P2a(my_org_ids·current_user_has_module)
-- 모듈 게이트: billing

create table if not exists billing_period_settings (
  id bigint generated always as identity primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  charge_start_date date not null,
  charge_end_date date not null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (charge_start_date <= charge_end_date)
);

create unique index if not exists billing_period_settings_building_period_key
  on billing_period_settings (building_id, period);
create index if not exists billing_period_settings_period_idx
  on billing_period_settings (period);

drop trigger if exists trg_billing_period_settings_updated on billing_period_settings;
create trigger trg_billing_period_settings_updated
  before update on billing_period_settings
  for each row execute function set_updated_at();

alter table billing_period_settings enable row level security;

drop policy if exists bps_select on billing_period_settings;
create policy bps_select on billing_period_settings for select
  using (building_id in (select id from buildings where org_id in (select my_org_ids())));

drop policy if exists bps_write on billing_period_settings;
create policy bps_write on billing_period_settings for all
  using (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('billing'))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())) and current_user_has_module('billing'));

comment on table billing_period_settings is '건물·월분별 부과기준일 및 납기일';
comment on column billing_period_settings.period is '월분 첫날';
comment on column billing_period_settings.charge_start_date is '부과기준 시작일';
comment on column billing_period_settings.charge_end_date is '부과기준 종료일';
comment on column billing_period_settings.due_date is '납기일(미설정 시 null)';

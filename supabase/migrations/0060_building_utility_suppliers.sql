-- 0060_building_utility_suppliers.sql
-- Building-level utility supplier and payment information.

create table if not exists building_utility_suppliers (
  id             bigint generated always as identity primary key,
  building_id    bigint not null references buildings(id) on delete cascade,
  utility        text not null check (utility in ('water','elec','gas')),
  company_name   text,
  phone          text,
  bank           text,
  account_no     text,
  account_holder text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists building_utility_suppliers_building_utility_key
  on building_utility_suppliers (building_id, utility);

drop trigger if exists trg_building_utility_suppliers_updated
  on building_utility_suppliers;
create trigger trg_building_utility_suppliers_updated
  before update on building_utility_suppliers
  for each row execute function set_updated_at();

alter table building_utility_suppliers enable row level security;

drop policy if exists bus_select on building_utility_suppliers;
create policy bus_select on building_utility_suppliers for select
  using (building_id in (
    select id from buildings where org_id in (select my_org_ids())
  ));

drop policy if exists bus_write on building_utility_suppliers;
create policy bus_write on building_utility_suppliers for all
  using (
    building_id in (select id from buildings where org_id in (select my_org_ids()))
    and current_user_has_module('utilities')
  )
  with check (
    building_id in (select id from buildings where org_id in (select my_org_ids()))
    and current_user_has_module('utilities')
  );

comment on table building_utility_suppliers is 'Building-level utility supplier and payment information';
comment on column building_utility_suppliers.id is 'Utility supplier row identifier';
comment on column building_utility_suppliers.building_id is 'Building that uses the utility supplier';
comment on column building_utility_suppliers.utility is 'Utility code: water, elec, or gas';
comment on column building_utility_suppliers.company_name is 'Utility supplier company name';
comment on column building_utility_suppliers.phone is 'Utility supplier phone number';
comment on column building_utility_suppliers.bank is 'Bank name for utility payments';
comment on column building_utility_suppliers.account_no is 'Bank account number for utility payments';
comment on column building_utility_suppliers.account_holder is 'Bank account holder for utility payments';
comment on column building_utility_suppliers.created_at is 'Row creation timestamp';
comment on column building_utility_suppliers.updated_at is 'Row last-updated timestamp';

-- 0013_p5_bill_publish.sql
-- P5: 고지서 발행 (bill_issues)
-- 의존: P0(profiles·audit_log·set_updated_at), P1a(units), P2a(current_user_org·current_user_has_module·my_org_ids),
--       P3b(occupancies·unit_accounts), P5-billing 0012(billing_confirmations·billing_history)
-- 모듈 게이트: bill_publish

create table bill_issues (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  occupancy_id bigint references occupancies(id) on delete set null,
  issue_type text not null check (issue_type in ('a4','giro','kakao','fax')),
  group_no int not null default 1,
  due_date date,
  unit_label_mode text not null default 'code' check (unit_label_mode in ('code','name')),
  auto_debit boolean not null default false,
  total_amount integer not null default 0,
  send_status text not null default 'none' check (send_status in ('none','sent','failed')),
  issued_at timestamptz not null default now(),
  issued_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, period, issue_type)
);
create index on bill_issues (unit_id, period);

-- updated_at 트리거
create trigger trg_bill_issues_updated before update on bill_issues
  for each row execute function set_updated_at();

-- RLS: SELECT org 개방 / 쓰기 bill_publish 모듈
alter table bill_issues enable row level security;
create policy bi_select on bill_issues for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy bi_write on bill_issues for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('bill_publish'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('bill_publish'));

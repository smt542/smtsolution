-- 0005_p3_notices_complaints.sql
-- 병렬 배치(P3-safe): 공지(notices) + 민원/AS(complaints). P3(건물·입주자, 0004)와 스키마 무관.
-- 의존: P0(organizations, auth.users, set_updated_at, my_org_ids), P1a(buildings, units), P2b(as_categories)

-- ── 공지 ──
create table notices (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  building_id bigint references buildings(id) on delete set null,  -- null = 전사 공지
  title text not null,
  content text not null,
  notice_type text not null default 'normal',   -- 'normal'|'important'|'urgent'
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index on notices (org_id, building_id, published_at);

-- ── 민원/AS ──
create table complaints (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  building_id bigint not null references buildings(id) on delete cascade,
  unit_id bigint references units(id) on delete set null,
  category_id bigint references as_categories(id) on delete set null,  -- P2b as_categories 재사용
  title text not null,
  content text,
  status text not null default 'pending',        -- 'pending'|'completed'|'on_hold'|'repeat'
  reporter_name text,
  reporter_phone text,
  assigned_to uuid references auth.users(id) on delete set null,  -- 담당 기사
  received_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index on complaints (org_id, building_id, status);
create index on complaints (org_id, received_at);

-- 처리 결과(이력 허용: 1 민원 → N 처리로그)
create table complaint_resolutions (
  id bigint generated always as identity primary key,
  complaint_id bigint not null references complaints(id) on delete cascade,
  result_content text,
  result_notes text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index on complaint_resolutions (complaint_id);

-- updated_at triggers (P0 set_updated_at())
do $$ declare t text;
begin
  foreach t in array array['notices','complaints','complaint_resolutions'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- RLS: org 격리 (buildings/fee_items 등과 동일 패턴)
alter table notices               enable row level security;
alter table complaints            enable row level security;
alter table complaint_resolutions enable row level security;

create policy ntc_all on notices    for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy cpl_all on complaints for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy cr_all  on complaint_resolutions for all
  using (complaint_id in (select id from complaints where org_id in (select my_org_ids())))
  with check (complaint_id in (select id from complaints where org_id in (select my_org_ids())));

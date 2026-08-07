-- ===== ENUM & 공통 =====
create type org_status      as enum ('active','suspended','trial');
create type org_member_role as enum ('platform_admin','org_owner','manager','staff','field','tenant');

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ===== organizations =====
create table organizations (
  id         bigint generated always as identity primary key,
  name       text not null,
  slug       text unique,
  status     org_status not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_org_updated before update on organizations
  for each row execute function set_updated_at();

-- ===== profiles (auth.users 1:1) =====
create table profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  username             text not null unique,
  full_name            text not null,
  phone                text,
  is_active            boolean not null default true,
  must_change_password boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- ===== org_members =====
create table org_members (
  org_id     bigint not null references organizations(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  role       org_member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on org_members (user_id);

-- ===== audit_log (append-only) =====
create table audit_log (
  id         bigint generated always as identity primary key,
  org_id     bigint,
  actor_id   uuid,
  action     text not null,
  table_name text,
  row_pk     text,
  before     jsonb,
  after      jsonb,
  ip         inet,
  created_at timestamptz not null default now()
);
create index audit_log_org_time_idx on audit_log (org_id, created_at);

-- ===== RPC =====
create or replace function get_my_context()
returns table (org_id bigint, role org_member_role, org_status org_status,
               username text, full_name text, is_active boolean, must_change_password boolean)
language sql stable security definer set search_path = public as $$
  select m.org_id, m.role, o.status, p.username, p.full_name, p.is_active, p.must_change_password
  from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid()
  order by (o.status = 'active') desc, m.created_at
  limit 1
$$;

create or replace function record_login(p_ip text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  if auth.uid() is null then return; end if;
  select m.org_id into v_org from org_members m
    join organizations o on o.id = m.org_id
    where m.user_id = auth.uid()
    order by (o.status = 'active') desc, m.created_at limit 1;
  insert into audit_log(org_id, actor_id, action, ip)
  values (v_org, auth.uid(), 'LOGIN', nullif(p_ip,'')::inet);
end $$;
revoke execute on function record_login(text) from anon;

-- ===== RLS =====
alter table organizations enable row level security;
alter table profiles      enable row level security;
alter table org_members   enable row level security;
alter table audit_log     enable row level security;

create or replace function my_org_ids() returns setof bigint
  language sql stable security definer set search_path = public as $$
  select m.org_id from org_members m
  join organizations o on o.id = m.org_id
  where m.user_id = (select auth.uid()) and o.status = 'active'
$$;

create policy org_select    on organizations for select using (id in (select my_org_ids()));
create policy member_select on org_members   for select using (org_id in (select my_org_ids()));
create policy profile_select on profiles for select using (
  user_id = (select auth.uid())
  or user_id in (select m.user_id from org_members m where m.org_id in (select my_org_ids()))
);
-- profiles UPDATE 정책 없음(의도적): P0에는 self-service 프로필 편집 UI가 없고,
-- RLS는 컬럼을 제한 못 해 username/is_active/must_change_password 자가변경 위험이 있음.
-- 프로필 발급·수정은 service_role(시드/관리 스크립트)만. P1 staff-management에서 컬럼 GRANT/트리거로 안전 개방.
create policy audit_select on audit_log for select using (org_id in (select my_org_ids()));

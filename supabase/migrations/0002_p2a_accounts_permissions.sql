-- P2a: 계정·직원 관리 + 권한 기반
-- 의존: P0(organizations, org_members, profiles, audit_log, my_org_ids, set_updated_at)

-- ===== ENUM =====
create type staff_type as enum ('manager_staff','field_staff','support_staff','tenant');

-- ===== org_members / profiles 확장 =====
alter table org_members
  add column staff_type          staff_type not null default 'manager_staff',
  add column feature_permissions jsonb      not null default '[]'::jsonb
    check (jsonb_typeof(feature_permissions) = 'array'),
  add column affiliation         text;

alter table profiles add column phone_sub text;

-- ===== 담당역할 마스터 + 조인 =====
create table staff_roles (
  id         bigint generated always as identity primary key,
  org_id     bigint not null references organizations(id) on delete cascade,
  label      text not null,
  sort_order int  not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, label)
);
create trigger trg_staff_roles_updated before update on staff_roles
  for each row execute function set_updated_at();

create table org_member_roles (
  org_id  bigint not null references organizations(id) on delete cascade,
  user_id uuid   not null references auth.users(id)    on delete cascade,
  role_id bigint not null references staff_roles(id)   on delete cascade,
  primary key (org_id, user_id, role_id)
);
create index on org_member_roles (role_id);

-- 기존 org 담당역할 시드(관리·검침·청소)
insert into staff_roles (org_id, label, sort_order)
  select o.id, v.label, v.ord
  from organizations o
  cross join (values ('관리',1),('검침',2),('청소',3)) as v(label,ord)
  on conflict (org_id, label) do nothing;

-- ===== 내부 헬퍼: 호출자 org =====
create or replace function current_user_org()
returns bigint language sql stable security definer set search_path = public as $$
  select m.org_id from org_members m join organizations o on o.id = m.org_id
  where m.user_id = auth.uid() order by (o.status = 'active') desc, m.created_at limit 1;
$$;

-- ===== get_my_context 재정의(권한·유형 반환) =====
drop function if exists get_my_context();
create function get_my_context()
returns table (org_id bigint, role org_member_role, org_status org_status,
               username text, full_name text, is_active boolean, must_change_password boolean,
               staff_type staff_type, permissions jsonb)
language sql stable security definer set search_path = public as $$
  select m.org_id, m.role, o.status, p.username, p.full_name, p.is_active, p.must_change_password,
         m.staff_type, coalesce(m.feature_permissions, '[]'::jsonb)
  from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid()
  order by (o.status = 'active') desc, m.created_at
  limit 1
$$;

-- ===== 권한 헬퍼(향후 테이블 RLS에서 재사용) =====
create or replace function current_user_is_master()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members m join organizations o on o.id = m.org_id
    where m.user_id = (select auth.uid()) and o.status = 'active'
      and m.role in ('org_owner','platform_admin'));
$$;

create or replace function current_user_has_module(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members m join organizations o on o.id = m.org_id
    where m.user_id = (select auth.uid()) and o.status = 'active'
      and (m.role in ('org_owner','platform_admin') or m.feature_permissions ? p_key));
$$;

-- ===== 계정 프로비저닝(라우트에서 auth.users 생성 후 호출) =====
create or replace function provision_member(
  p_user_id uuid, p_username text, p_full_name text, p_phone text, p_phone_sub text,
  p_role org_member_role, p_staff_type staff_type, p_permissions jsonb,
  p_affiliation text, p_role_ids bigint[]
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
  -- 비마스터는 역할/권한 강제 축소(권한 상승 차단)
  if not current_user_is_master() then p_role := 'staff'; p_permissions := '[]'::jsonb; end if;
  insert into profiles(user_id, username, full_name, phone, phone_sub, must_change_password)
    values (p_user_id, lower(p_username), p_full_name, nullif(p_phone,''), nullif(p_phone_sub,''), true);
  insert into org_members(org_id, user_id, role, staff_type, feature_permissions, affiliation)
    values (v_org, p_user_id, p_role, p_staff_type, coalesce(p_permissions,'[]'::jsonb), nullif(p_affiliation,''));
  if p_role_ids is not null then
    insert into org_member_roles(org_id, user_id, role_id) select v_org, p_user_id, unnest(p_role_ids);
  end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'ACCOUNT_CREATE', 'org_members', p_user_id::text,
      jsonb_build_object('username',lower(p_username),'role',p_role,'staff_type',p_staff_type));
end $$;
revoke execute on function provision_member(uuid,text,text,text,text,org_member_role,staff_type,jsonb,text,bigint[]) from anon;

-- ===== 권한/역할 변경(마스터 전용) =====
create or replace function admin_set_member_permissions(
  p_user_id uuid, p_role org_member_role, p_staff_type staff_type,
  p_permissions jsonb, p_role_ids bigint[]
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_other_masters int;
begin
  v_org := current_user_org();
  if not current_user_is_master() then raise exception 'forbidden: master only'; end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  -- 최소 1 마스터 유지: 본인을 마스터 해제하는데 다른 마스터가 없으면 거부
  if p_user_id = auth.uid() and p_role not in ('org_owner','platform_admin') then
    select count(*) into v_other_masters from org_members
      where org_id = v_org and role in ('org_owner','platform_admin') and user_id <> p_user_id;
    if v_other_masters = 0 then raise exception 'must keep at least one master'; end if;
  end if;
  update org_members set role = p_role, staff_type = p_staff_type,
    feature_permissions = coalesce(p_permissions,'[]'::jsonb)
    where user_id = p_user_id and org_id = v_org;
  delete from org_member_roles where user_id = p_user_id and org_id = v_org;
  if p_role_ids is not null then
    insert into org_member_roles(org_id,user_id,role_id) select v_org,p_user_id,unnest(p_role_ids); end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PERMISSION_CHANGE', 'org_members', p_user_id::text,
      jsonb_build_object('role',p_role,'staff_type',p_staff_type,'permissions',p_permissions));
end $$;
revoke execute on function admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[]) from anon;

-- ===== 기본정보 변경(accounts 권한; 역할/권한 미변경) =====
create or replace function admin_update_member_basic(
  p_user_id uuid, p_full_name text, p_phone text, p_phone_sub text,
  p_staff_type staff_type, p_affiliation text, p_role_ids bigint[]
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  update profiles set full_name = p_full_name, phone = nullif(p_phone,''), phone_sub = nullif(p_phone_sub,'')
    where user_id = p_user_id;
  update org_members set staff_type = p_staff_type, affiliation = nullif(p_affiliation,'')
    where user_id = p_user_id and org_id = v_org;
  delete from org_member_roles where user_id = p_user_id and org_id = v_org;
  if p_role_ids is not null then
    insert into org_member_roles(org_id,user_id,role_id) select v_org,p_user_id,unnest(p_role_ids); end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk)
    values (v_org, auth.uid(), 'ACCOUNT_UPDATE', 'profiles', p_user_id::text);
end $$;
revoke execute on function admin_update_member_basic(uuid,text,text,text,staff_type,text,bigint[]) from anon;

-- ===== 활성/비활성(삭제 금지) =====
create or replace function admin_set_active(p_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  update profiles set is_active = p_active where user_id = p_user_id;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), case when p_active then 'ACCOUNT_ACTIVATE' else 'ACCOUNT_DEACTIVATE' end,
      'profiles', p_user_id::text, jsonb_build_object('is_active',p_active));
end $$;
revoke execute on function admin_set_active(uuid,boolean) from anon;

-- ===== 계정 디렉터리 조회 =====
create or replace function list_accounts(p_search text default null, p_type staff_type default null)
returns table (user_id uuid, username text, full_name text, phone text, phone_sub text,
               role org_member_role, staff_type staff_type, affiliation text, is_active boolean,
               permissions jsonb, role_labels text[])
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.full_name, p.phone, p.phone_sub,
         m.role, m.staff_type, m.affiliation, p.is_active,
         coalesce(m.feature_permissions,'[]'::jsonb),
         coalesce(array_agg(sr.label order by sr.sort_order) filter (where sr.id is not null), '{}')
  from org_members m
  join profiles p on p.user_id = m.user_id
  left join org_member_roles omr on omr.user_id = m.user_id and omr.org_id = m.org_id
  left join staff_roles sr on sr.id = omr.role_id and sr.deleted_at is null
  where m.org_id = current_user_org()
    and (p_type is null or m.staff_type = p_type)
    and (p_search is null or p.full_name ilike '%'||p_search||'%'
         or p.username ilike '%'||p_search||'%'
         or p.phone ilike '%'||p_search||'%' or p.phone_sub ilike '%'||p_search||'%')
  group by p.user_id, p.username, p.full_name, p.phone, p.phone_sub,
           m.role, m.staff_type, m.affiliation, p.is_active, m.feature_permissions
  order by p.full_name
$$;
revoke execute on function list_accounts(text,staff_type) from anon;

-- ===== RLS (신규 테이블) =====
alter table staff_roles      enable row level security;
alter table org_member_roles enable row level security;
-- 담당역할 마스터: 활성 org 구성원 CRUD(민감치 않음, P1a 마스터와 동일 수준)
create policy sr_all on staff_roles for all
  using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
-- 조인: 조회만 개방(쓰기는 위 RPC가 definer로 처리)
create policy omr_select on org_member_roles for select
  using (org_id in (select my_org_ids()));

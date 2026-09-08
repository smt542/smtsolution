-- 0148_staff_capabilities.sql
-- 워크포스 겸직 capabilities: org_members에 staff_capabilities jsonb(값=staff_type 문자열 배열) 추가.
-- staff_type은 primary(표시/기본탭)로 유지, capabilities가 '앱 접근'의 authoritative 소스.
-- 불변식: staff_type ∈ staff_capabilities. persona 술어(0147) 바디를 capabilities로 교체.
-- 의존: 0002(staff_type enum, org_members 확장, get_my_context, list_accounts, admin_* RPC),
--       0033(provision_member 11-arg), 0011(current_user_is_platform_admin), 0147(persona 술어).

-- ── 1) 컬럼 + 배열 타입 가드 ──
alter table org_members
  add column if not exists staff_capabilities jsonb not null default '[]'::jsonb;

alter table org_members drop constraint if exists org_members_staff_capabilities_is_array;
alter table org_members
  add constraint org_members_staff_capabilities_is_array
  check (jsonb_typeof(staff_capabilities) = 'array');

-- ── 2) 백필: 기존 단일 staff_type → 1원소 배열(불변식 성립) ──
update org_members
  set staff_capabilities = jsonb_build_array(staff_type::text)
  where staff_capabilities = '[]'::jsonb;

-- ── 3) 정규화 헬퍼: caps에 primary 주입 + 중복제거(정렬) ──
create or replace function normalize_staff_capabilities(p_caps jsonb, p_primary staff_type)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(distinct e order by e), '[]'::jsonb)
  from jsonb_array_elements_text(
    coalesce(p_caps, '[]'::jsonb) || jsonb_build_array(p_primary::text)
  ) as e;
$$;

-- ── 4) persona 술어(0147 재정의): staff_type → staff_capabilities ──
create or replace function current_user_is_manager_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid()) and m.staff_capabilities ? 'manager_staff'
  )
  and exists (
    select 1 from profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  )
$$;
revoke execute on function current_user_is_manager_staff() from public, anon;
grant execute on function current_user_is_manager_staff() to authenticated;

create or replace function current_user_is_field_partner() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid())
      and m.staff_capabilities ?| array['field_staff','support_staff']
  )
  and exists (
    select 1 from profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  )
$$;
revoke execute on function current_user_is_field_partner() from public, anon;
grant execute on function current_user_is_field_partner() to authenticated;

-- ── 5) get_my_context: staff_capabilities 반환 추가(additive) ──
drop function if exists get_my_context();
create function get_my_context()
returns table (org_id bigint, role org_member_role, org_status org_status,
               username text, full_name text, is_active boolean, must_change_password boolean,
               staff_type staff_type, permissions jsonb, staff_capabilities jsonb)
language sql stable security definer set search_path = public as $$
  select m.org_id, m.role, o.status, p.username, p.full_name, p.is_active, p.must_change_password,
         m.staff_type, coalesce(m.feature_permissions, '[]'::jsonb),
         coalesce(m.staff_capabilities, '[]'::jsonb)
  from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid()
  order by (o.status = 'active') desc, m.created_at
  limit 1
$$;

-- ── 6) provision_member(0033 11-arg) → 12-arg(+p_staff_capabilities) ──
drop function if exists provision_member(uuid,text,text,text,text,org_member_role,staff_type,jsonb,text,bigint[],bigint);
create or replace function provision_member(
  p_user_id uuid, p_username text, p_full_name text, p_phone text, p_phone_sub text,
  p_role org_member_role, p_staff_type staff_type, p_permissions jsonb,
  p_affiliation text, p_role_ids bigint[], p_target_org_id bigint default null,
  p_staff_capabilities jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_caps jsonb;
begin
  if current_user_is_platform_admin() and p_target_org_id is not null then
    v_org := p_target_org_id;
  else
    v_org := current_user_org();
  end if;
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
  if not current_user_is_master() then p_role := 'staff'; p_permissions := '[]'::jsonb; end if;
  v_caps := normalize_staff_capabilities(p_staff_capabilities, p_staff_type);
  insert into profiles(user_id, username, full_name, phone, phone_sub, must_change_password)
    values (p_user_id, lower(p_username), p_full_name, nullif(p_phone,''), nullif(p_phone_sub,''), true);
  insert into org_members(org_id, user_id, role, staff_type, feature_permissions, affiliation, staff_capabilities)
    values (v_org, p_user_id, p_role, p_staff_type, coalesce(p_permissions,'[]'::jsonb), nullif(p_affiliation,''), v_caps);
  if p_role_ids is not null then
    insert into org_member_roles(org_id, user_id, role_id) select v_org, p_user_id, unnest(p_role_ids);
  end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'ACCOUNT_CREATE', 'org_members', p_user_id::text,
      jsonb_build_object('username',lower(p_username),'role',p_role,'staff_type',p_staff_type,'staff_capabilities',v_caps));
end $$;
revoke execute on function provision_member(uuid,text,text,text,text,org_member_role,staff_type,jsonb,text,bigint[],bigint,jsonb) from anon;

-- ── 7) admin_update_member_basic(0002) → +p_staff_capabilities ──
drop function if exists admin_update_member_basic(uuid,text,text,text,staff_type,text,bigint[]);
create or replace function admin_update_member_basic(
  p_user_id uuid, p_full_name text, p_phone text, p_phone_sub text,
  p_staff_type staff_type, p_affiliation text, p_role_ids bigint[],
  p_staff_capabilities jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  update profiles set full_name = p_full_name, phone = nullif(p_phone,''), phone_sub = nullif(p_phone_sub,'')
    where user_id = p_user_id;
  update org_members set staff_type = p_staff_type, affiliation = nullif(p_affiliation,''),
    staff_capabilities = normalize_staff_capabilities(coalesce(p_staff_capabilities, staff_capabilities), p_staff_type)
    where user_id = p_user_id and org_id = v_org;
  if p_role_ids is not null then
    delete from org_member_roles where user_id = p_user_id and org_id = v_org;
    insert into org_member_roles(org_id,user_id,role_id) select v_org,p_user_id,unnest(p_role_ids); end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk)
    values (v_org, auth.uid(), 'ACCOUNT_UPDATE', 'profiles', p_user_id::text);
end $$;
revoke execute on function admin_update_member_basic(uuid,text,text,text,staff_type,text,bigint[],jsonb) from anon;

-- ── 8) admin_set_member_permissions(0002): 시그니처 유지, caps 불변식 방어적 재주입 ──
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
  if p_user_id = auth.uid() and p_role not in ('org_owner','platform_admin') then
    select count(*) into v_other_masters from org_members
      where org_id = v_org and role in ('org_owner','platform_admin') and user_id <> p_user_id;
    if v_other_masters = 0 then raise exception 'must keep at least one master'; end if;
  end if;
  update org_members set role = p_role, staff_type = p_staff_type,
    feature_permissions = coalesce(p_permissions,'[]'::jsonb),
    staff_capabilities = normalize_staff_capabilities(staff_capabilities, p_staff_type)
    where user_id = p_user_id and org_id = v_org;
  if p_role_ids is not null then
    delete from org_member_roles where user_id = p_user_id and org_id = v_org;
    insert into org_member_roles(org_id,user_id,role_id) select v_org,p_user_id,unnest(p_role_ids); end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PERMISSION_CHANGE', 'org_members', p_user_id::text,
      jsonb_build_object('role',p_role,'staff_type',p_staff_type,'permissions',p_permissions));
end $$;
revoke execute on function admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[]) from anon;

-- ── 9) list_accounts(0002): staff_capabilities 반환 추가 ──
drop function if exists list_accounts(text, staff_type);
create or replace function list_accounts(p_search text default null, p_type staff_type default null)
returns table (user_id uuid, username text, full_name text, phone text, phone_sub text,
               role org_member_role, staff_type staff_type, affiliation text, is_active boolean,
               permissions jsonb, role_labels text[], staff_capabilities jsonb)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.full_name, p.phone, p.phone_sub,
         m.role, m.staff_type, m.affiliation, p.is_active,
         coalesce(m.feature_permissions,'[]'::jsonb),
         coalesce(array_agg(sr.label order by sr.sort_order) filter (where sr.id is not null), '{}'),
         coalesce(m.staff_capabilities, '[]'::jsonb)
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
           m.role, m.staff_type, m.affiliation, p.is_active, m.feature_permissions, m.staff_capabilities
  order by p.full_name
$$;
revoke execute on function list_accounts(text,staff_type) from anon;

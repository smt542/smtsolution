-- 0228_member_owner_guard.sql
-- 문제점 개선 1차 #2: 계정 RPC가 대상의 계층(마스터)을 확인하지 않아
-- accounts 권한만 있는 직원이 마스터(org_owner)를 비활성화하거나 역할·겸직을 바꿀 수 있었다.
-- 대상이 해당 org의 org_owner이면 같은 org의 org_owner만 허용한다.
-- (admin_set_active의 통합관리자 경로 — p_target_org_id 지정 — 는 기존 동작 유지)
-- 본문은 실 DB 정의(pg_get_functiondef)를 그대로 옮기고 가드만 추가했다.
-- create or replace는 기존 grant/revoke(0215)를 유지한다.

create or replace function public.admin_set_active(p_user_id uuid, p_active boolean, p_target_org_id bigint default null::bigint)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_org bigint;
  v_platform_path boolean := false;
begin
  if current_user_is_platform_admin() and p_target_org_id is not null then
    v_org := p_target_org_id;
    v_platform_path := true;
  else
    if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
    v_org := current_user_org();
  end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  if not v_platform_path
     and exists (select 1 from org_members where user_id = p_user_id and org_id = v_org and role = 'org_owner')
     and not exists (select 1 from org_members where user_id = (select auth.uid()) and org_id = v_org and role = 'org_owner') then
    raise exception 'forbidden: only org_owner can manage org_owner' using errcode = '42501';
  end if;
  update profiles set is_active = p_active where user_id = p_user_id;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), case when p_active then 'ACCOUNT_ACTIVATE' else 'ACCOUNT_DEACTIVATE' end,
      'profiles', p_user_id::text, jsonb_build_object('is_active',p_active));
end $function$;

create or replace function public.admin_update_member_basic(p_user_id uuid, p_full_name text, p_phone text, p_phone_sub text, p_staff_type staff_type, p_affiliation text, p_role_ids bigint[], p_staff_capabilities jsonb default null::jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_org bigint;
begin
  v_org := current_user_org();
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  if exists (select 1 from org_members where user_id = p_user_id and org_id = v_org and role = 'org_owner')
     and not exists (select 1 from org_members where user_id = (select auth.uid()) and org_id = v_org and role = 'org_owner') then
    raise exception 'forbidden: only org_owner can manage org_owner' using errcode = '42501';
  end if;
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
end $function$;

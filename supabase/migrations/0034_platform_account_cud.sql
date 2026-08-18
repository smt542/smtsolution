-- 0034_platform_account_cud.sql
-- 통합관리자 계정 CUD(P2): admin_set_member_permissions/admin_set_active cross-org 확장 + platform_admin 임명 가드.
-- 의존: 0002(원본 RPC·current_user_org·current_user_is_master·current_user_has_module), 0011(current_user_is_platform_admin).
-- 번호: 로컬 0033(platform_org_cud) 다음. 커밋 직전 origin/master max 재확인함.

-- ── 권한/역할 변경: cross-org + platform_admin 임명 가드 ──
drop function if exists admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[]);
create or replace function admin_set_member_permissions(
  p_user_id uuid, p_role org_member_role, p_staff_type staff_type,
  p_permissions jsonb, p_role_ids bigint[], p_target_org_id bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_other_masters int; v_is_pa boolean;
begin
  v_is_pa := current_user_is_platform_admin();
  if v_is_pa and p_target_org_id is not null then
    v_org := p_target_org_id;                 -- platform_admin cross-org
  else
    if not current_user_is_master() then raise exception 'forbidden: master only'; end if;
    v_org := current_user_org();              -- 기존 staff 경로
  end if;
  -- platform_admin 부여/해제는 platform_admin만 가능(자가승격·임의 강등 차단)
  if not v_is_pa and (
    p_role = 'platform_admin'
    or exists (
      select 1 from org_members
      where user_id = p_user_id and org_id = v_org and role = 'platform_admin'
    )
  ) then
    raise exception 'forbidden: platform_admin role changes require platform_admin';
  end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  -- 최소 1 마스터 유지(본인 강등 방지)
  if p_user_id = auth.uid() and p_role not in ('org_owner','platform_admin') then
    select count(*) into v_other_masters from org_members
      where org_id = v_org and role in ('org_owner','platform_admin') and user_id <> p_user_id;
    if v_other_masters = 0 then raise exception 'must keep at least one master'; end if;
  end if;
  update org_members set role = p_role, staff_type = p_staff_type,
    feature_permissions = coalesce(p_permissions,'[]'::jsonb)
    where user_id = p_user_id and org_id = v_org;
  if p_role_ids is not null then
    delete from org_member_roles where user_id = p_user_id and org_id = v_org;
    insert into org_member_roles(org_id,user_id,role_id) select v_org,p_user_id,unnest(p_role_ids); end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PERMISSION_CHANGE', 'org_members', p_user_id::text,
      jsonb_build_object('role',p_role,'staff_type',p_staff_type,'permissions',p_permissions));
end $$;
revoke execute on function admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[],bigint) from anon;

-- ── 활성/비활성: cross-org ──
drop function if exists admin_set_active(uuid,boolean);
create or replace function admin_set_active(
  p_user_id uuid, p_active boolean, p_target_org_id bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  if current_user_is_platform_admin() and p_target_org_id is not null then
    v_org := p_target_org_id;
  else
    if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
    v_org := current_user_org();
  end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  update profiles set is_active = p_active where user_id = p_user_id;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), case when p_active then 'ACCOUNT_ACTIVATE' else 'ACCOUNT_DEACTIVATE' end,
      'profiles', p_user_id::text, jsonb_build_object('is_active',p_active));
end $$;
revoke execute on function admin_set_active(uuid,boolean,bigint) from anon;

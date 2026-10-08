-- provision_member: p_role 화이트리스트(org_owner·staff)
-- 마스터(org_owner)가 p_role='platform_admin'으로 본사 계정을 만들 수 있던 권한 상승을 DB에서 차단한다.
-- 본사 계정은 platform_provision_hq_account 로만 만든다. 본문은 실 DB 현재 정의 기준, v_org 결정 직후 검사만 추가.
create or replace function public.provision_member(p_user_id uuid, p_username text, p_full_name text, p_phone text, p_phone_sub text, p_role org_member_role, p_staff_type staff_type, p_permissions jsonb, p_affiliation text, p_role_ids bigint[], p_target_org_id bigint DEFAULT NULL::bigint, p_staff_capabilities jsonb DEFAULT NULL::jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_org bigint; v_caps jsonb;
begin
  if current_user_is_platform_admin() and p_target_org_id is not null then
    v_org := p_target_org_id;
  else
    v_org := current_user_org();
  end if;
  if v_org is null then raise exception 'no org for caller'; end if;
  if p_role not in ('org_owner','staff') then
    raise exception 'forbidden: role % not allowed', p_role using errcode = '42501';
  end if;
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
end $function$;

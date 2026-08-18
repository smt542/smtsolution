-- 0033_platform_org_cud.sql
-- 통합관리자 조직 CUD(P1): organizations 컬럼 + 조직생성 RPC + provision_member cross-org 확장.
-- 의존: 0000(organizations, audit_log), 0002(provision_member, current_user_org 등), 0011(current_user_is_platform_admin).
-- 번호: 최초 0032 배정했으나 origin/master에 0032_bill_fax_suspend가 병렬 머지되어 0033으로 리네임.

-- ── organizations 컬럼 ──
alter table organizations add column if not exists deleted_at timestamptz;
alter table organizations add column if not exists phone      text;

-- ── 조직 생성(운영자 전용, 감사) ──
create or replace function platform_create_organization(
  p_name text, p_slug text, p_phone text default null
) returns organizations language plpgsql security definer set search_path = public as $$
declare v_org organizations;
begin
  if not current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin only';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  insert into organizations(name, slug, phone, status)
    values (trim(p_name), nullif(lower(trim(p_slug)),''), nullif(trim(p_phone),''), 'trial')
    returning * into v_org;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org.id, auth.uid(), 'ORG_CREATE', 'organizations', v_org.id::text,
      jsonb_build_object('name', v_org.name, 'slug', v_org.slug));
  return v_org;
end $$;
revoke execute on function platform_create_organization(text,text,text) from anon, public;
grant  execute on function platform_create_organization(text,text,text) to authenticated;

-- ── provision_member cross-org 확장 ──
-- 파라미터 추가(시그니처 변경)이므로 기존 10-arg를 drop 후 11-arg로 재생성.
-- route.ts는 named param 호출이라 p_target_org_id 미지정 시 default null → staff 동작 불변.
drop function if exists provision_member(uuid,text,text,text,text,org_member_role,staff_type,jsonb,text,bigint[]);
create or replace function provision_member(
  p_user_id uuid, p_username text, p_full_name text, p_phone text, p_phone_sub text,
  p_role org_member_role, p_staff_type staff_type, p_permissions jsonb,
  p_affiliation text, p_role_ids bigint[], p_target_org_id bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  -- platform_admin이 대상 org를 지정하면 cross-org; 아니면 호출자 org(기존).
  if current_user_is_platform_admin() and p_target_org_id is not null then
    v_org := p_target_org_id;
  else
    v_org := current_user_org();
  end if;
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
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
revoke execute on function provision_member(uuid,text,text,text,text,org_member_role,staff_type,jsonb,text,bigint[],bigint) from anon;

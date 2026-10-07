-- 0227_hq_account_manage_guard.sql
-- 본사 계정 추가·수정·삭제는 마스터·운영만 가능(정책서 통합관리자_계정·권한 2절).
-- 지금까지는 platform_admin이면 지원·영업도 RPC/API로 계정을 만들 수 있었다(E2E PA-027).
-- hq_role이 비어 있는 기존 본사 계정은 잠기지 않도록 마스터로 간주한다.

create or replace function public.current_user_can_manage_hq_accounts()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.current_user_is_platform_admin()
    and exists (
      select 1
      from org_members m
      where m.user_id = (select auth.uid())
        and m.role = 'platform_admin'
        and coalesce(m.hq_role, 'master') in ('master', 'operations')
    )
$$;

revoke execute on function public.current_user_can_manage_hq_accounts() from public, anon;
grant execute on function public.current_user_can_manage_hq_accounts() to authenticated;

-- 1) 계정 발급
create or replace function public.platform_provision_hq_account(p_user_id uuid, p_username text, p_full_name text, p_phone text, p_memo text, p_hq_role text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_org_id bigint;
  v_username text := btrim(coalesce(p_username, ''));
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_hq_role text := btrim(coalesce(p_hq_role, ''));
  v_staff_capabilities jsonb;
begin
  if not public.current_user_can_manage_hq_accounts() then
    raise exception 'forbidden: hq master/operations required' using errcode = '42501';
  end if;

  select member.org_id
  into v_org_id
  from public.org_members member
  where member.user_id = (select auth.uid())
    and member.role = 'platform_admin'::public.org_member_role
  order by member.created_at, member.org_id
  limit 1;
  if not found then
    raise exception 'hq organization not found' using errcode = 'P0002';
  end if;

  if length(v_username) < 1
     or length(v_full_name) < 1
     or length(v_full_name) > 100
     or v_phone !~ '^01[0-9]-[0-9]{3,4}-[0-9]{4}$'
     or v_hq_role not in ('master', 'operations', 'support', 'sales', 'accounting', 'other')
     or (v_memo is not null and length(v_memo) > 500) then
    raise exception 'invalid hq account input' using errcode = '22023';
  end if;

  v_staff_capabilities := public.normalize_staff_capabilities(
    '[]'::jsonb,
    'manager_staff'::public.staff_type
  );

  -- 0148 provision_member와 같은 profile/org_members 불변식을 본사 계정에도 적용한다.
  insert into public.profiles(
    user_id,
    username,
    full_name,
    phone,
    phone_sub,
    is_active,
    must_change_password
  )
  values (
    p_user_id,
    lower(v_username),
    v_full_name,
    v_phone,
    null,
    true,
    true
  );

  insert into public.org_members(
    org_id,
    user_id,
    role,
    staff_type,
    feature_permissions,
    affiliation,
    staff_capabilities,
    memo,
    hq_role
  )
  values (
    v_org_id,
    p_user_id,
    'platform_admin'::public.org_member_role,
    'manager_staff'::public.staff_type,
    '[]'::jsonb,
    null,
    v_staff_capabilities,
    v_memo,
    v_hq_role
  );

  insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, after)
  values (
    v_org_id,
    (select auth.uid()),
    'ACCOUNT_CREATE',
    'org_members',
    p_user_id::text,
    jsonb_build_object(
      'username', lower(v_username),
      'role', 'platform_admin',
      'staff_type', 'manager_staff',
      'staff_capabilities', v_staff_capabilities,
      'hq_role', v_hq_role
    )
  );
end
$function$;

-- 2) 계정 수정·정지
create or replace function public.platform_update_hq_account(p_user_id uuid, p_full_name text, p_phone text, p_memo text, p_hq_role text, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_org_id bigint;
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_hq_role text := btrim(coalesce(p_hq_role, ''));
  v_was_active boolean;
begin
  if not public.current_user_can_manage_hq_accounts() then
    raise exception 'forbidden: hq master/operations required' using errcode = '42501';
  end if;

  select member.org_id
  into v_org_id
  from public.org_members member
  where member.user_id = p_user_id
    and member.role = 'platform_admin'::public.org_member_role
  order by member.created_at, member.org_id
  limit 1;
  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  if length(v_full_name) < 1 or length(v_full_name) > 100
     or v_phone !~ '^01[0-9]-[0-9]{3,4}-[0-9]{4}$'
     or v_hq_role not in ('master', 'operations', 'support', 'sales', 'accounting', 'other')
     or (v_memo is not null and length(v_memo) > 500)
     or p_is_active is null then
    raise exception 'invalid hq account input' using errcode = '22023';
  end if;

  select profile.is_active
  into v_was_active
  from public.profiles profile
  where profile.user_id = p_user_id
  for update;
  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  if not p_is_active then
    if p_user_id = (select auth.uid()) then
      raise exception 'cannot deactivate yourself' using errcode = 'P0001', hint = 'SELF';
    end if;
    if not exists (
      select 1
      from public.org_members member
      join public.profiles profile on profile.user_id = member.user_id
      where member.role = 'platform_admin'::public.org_member_role
        and member.user_id <> p_user_id
        and profile.is_active
    ) then
      raise exception 'must keep at least one active hq account'
        using errcode = 'P0001', hint = 'LAST_ADMIN';
    end if;
  end if;

  update public.profiles profile
  set full_name = v_full_name,
      phone = v_phone,
      is_active = p_is_active
  where profile.user_id = p_user_id;

  update public.org_members member
  set memo = v_memo,
      hq_role = v_hq_role
  where member.user_id = p_user_id
    and member.role = 'platform_admin'::public.org_member_role;

  if v_was_active is distinct from p_is_active then
    insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (
      v_org_id,
      (select auth.uid()),
      case when p_is_active then 'ACCOUNT_ACTIVATE' else 'ACCOUNT_DEACTIVATE' end,
      'profiles',
      p_user_id::text,
      jsonb_build_object('is_active', p_is_active)
    );
  end if;
end
$function$;

-- 3) 계정 삭제 사전 검사
create or replace function public.platform_prepare_hq_account_delete(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_org_id bigint;
begin
  if not public.current_user_can_manage_hq_accounts() then
    raise exception 'forbidden: hq master/operations required' using errcode = '42501';
  end if;

  select member.org_id
  into v_org_id
  from public.org_members member
  where member.user_id = p_user_id
    and member.role = 'platform_admin'::public.org_member_role
  order by member.created_at, member.org_id
  limit 1;
  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'cannot delete yourself' using errcode = 'P0001', hint = 'SELF';
  end if;

  if exists (
    select 1
    from public.org_members member
    where member.user_id = p_user_id
      and member.role <> 'platform_admin'::public.org_member_role
  )
  or exists (
    select 1
    from public.resident_identities identity
    where identity.user_id = p_user_id
  ) then
    raise exception 'account belongs to another organization or resident identity'
      using errcode = 'P0001', hint = 'OTHER_ROLE';
  end if;

  if not exists (
    select 1
    from public.org_members member
    join public.profiles profile on profile.user_id = member.user_id
    where member.role = 'platform_admin'::public.org_member_role
      and member.user_id <> p_user_id
      and profile.is_active
  ) then
    raise exception 'must keep at least one active hq account'
      using errcode = 'P0001', hint = 'LAST_ADMIN';
  end if;

  -- 삭제 뒤에는 프로필이 사라지므로 누가 어떤 계정을 지웠는지 지금 남긴다(로그인 계정 삭제는 API 라우트가 이어서 한다).
  insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, after)
  select
    v_org_id,
    (select auth.uid()),
    'ACCOUNT_DELETE',
    'profiles',
    p_user_id::text,
    jsonb_build_object('username', profile.username, 'role', 'platform_admin')
  from public.profiles profile
  where profile.user_id = p_user_id;
end
$function$;

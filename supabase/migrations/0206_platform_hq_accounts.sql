-- 0206: 본사(통합관리자) 계정 전용 목록·생성·수정·삭제 가드.
-- 본사 계정은 platform_admin 소속을 기준으로 관리하며, 로그인 계정 하드 삭제에 필요한 FK와
-- 포인트 원장 SET NULL cascade 예외를 함께 정비한다.

-- ── 본사 계정 표시 역할 ──
alter table public.org_members
  add column if not exists hq_role text;

alter table public.org_members
  drop constraint if exists org_members_hq_role_check;
alter table public.org_members
  add constraint org_members_hq_role_check
  check (hq_role is null or hq_role in (
    'master', 'operations', 'support', 'sales', 'accounting', 'other'
  ));

update public.org_members
set hq_role = 'master'
where role = 'platform_admin'::public.org_member_role
  and hq_role is null;

-- ── 로그인 계정 삭제를 막는 FK를 SET NULL로 재생성 ──
-- 기존 이름은 환경마다 다를 수 있으므로 pg_constraint에서 대상 컬럼 FK를 찾아 제거한다.
do $$
declare
  v_constraint_name text;
begin
  for v_constraint_name in
    select constraint_row.conname
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.platform_billing_invoices'::regclass
      and constraint_row.confrelid = 'public.profiles'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.conkey = array[
        (
          select attribute.attnum
          from pg_catalog.pg_attribute attribute
          where attribute.attrelid = constraint_row.conrelid
            and attribute.attname = 'updated_by'
            and not attribute.attisdropped
        )
      ]::smallint[]
      and constraint_row.confkey = array[
        (
          select attribute.attnum
          from pg_catalog.pg_attribute attribute
          where attribute.attrelid = constraint_row.confrelid
            and attribute.attname = 'user_id'
            and not attribute.attisdropped
        )
      ]::smallint[]
  loop
    execute format(
      'alter table public.platform_billing_invoices drop constraint %I',
      v_constraint_name
    );
  end loop;

  alter table public.platform_billing_invoices
    add constraint platform_billing_invoices_updated_by_fkey
    foreign key (updated_by) references public.profiles(user_id)
    on delete set null;

  for v_constraint_name in
    select constraint_row.conname
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.platform_settings'::regclass
      and constraint_row.confrelid = 'public.profiles'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.conkey = array[
        (
          select attribute.attnum
          from pg_catalog.pg_attribute attribute
          where attribute.attrelid = constraint_row.conrelid
            and attribute.attname = 'updated_by'
            and not attribute.attisdropped
        )
      ]::smallint[]
      and constraint_row.confkey = array[
        (
          select attribute.attnum
          from pg_catalog.pg_attribute attribute
          where attribute.attrelid = constraint_row.confrelid
            and attribute.attname = 'user_id'
            and not attribute.attisdropped
        )
      ]::smallint[]
  loop
    execute format(
      'alter table public.platform_settings drop constraint %I',
      v_constraint_name
    );
  end loop;

  alter table public.platform_settings
    add constraint platform_settings_updated_by_fkey
    foreign key (updated_by) references public.profiles(user_id)
    on delete set null;
end
$$;

-- auth.users 삭제가 만든 point_transactions.created_by SET NULL UPDATE만 허용한다.
create or replace function public.prevent_point_transaction_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 테넌트 완전 삭제가 표시한 조직의 삭제만 허용한다.
  if tg_op = 'DELETE'
     and old.org_id is not null
     and current_setting('app.purge_org_id', true) = old.org_id::text then
    return old;
  end if;

  -- 로그인 계정 삭제에 따른 created_by SET NULL cascade만 허용한다.
  if tg_op = 'UPDATE'
     and old.created_by is not null
     and new.created_by is null
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by')
     and not exists (
       select 1
       from auth.users auth_user
       where auth_user.id = old.created_by
     ) then
    return new;
  end if;

  raise exception 'point transactions are append-only' using errcode = '55000';
end
$$;

revoke all on function public.prevent_point_transaction_mutation() from public, anon, authenticated;

-- ── 본사 계정 목록 ──
create or replace function public.platform_list_hq_accounts(
  p_search text default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  phone text,
  memo text,
  hq_role text,
  is_active boolean,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;

  return query
  with ranked_members as (
    select
      member.user_id,
      member.memo,
      member.hq_role,
      member.created_at,
      row_number() over (
        partition by member.user_id
        order by member.created_at, member.org_id
      ) as membership_rank
    from public.org_members member
    where member.role = 'platform_admin'::public.org_member_role
  ), filtered_accounts as (
    select
      ranked.user_id,
      profile.username,
      profile.full_name,
      profile.phone,
      ranked.memo,
      ranked.hq_role,
      profile.is_active,
      ranked.created_at
    from ranked_members ranked
    join public.profiles profile on profile.user_id = ranked.user_id
    where ranked.membership_rank = 1
      and (
        v_search is null
        or profile.full_name ilike '%' || v_search || '%'
        or profile.username ilike '%' || v_search || '%'
      )
  ), counted_accounts as (
    select filtered.*, count(*) over ()::bigint as total_count
    from filtered_accounts filtered
  )
  select
    counted.user_id,
    counted.username,
    counted.full_name,
    counted.phone,
    counted.memo,
    counted.hq_role,
    counted.is_active,
    counted.created_at,
    counted.total_count
  from counted_accounts counted
  order by counted.created_at asc, counted.username asc
  limit greatest(1, least(100, coalesce(p_limit, 10)))
  offset greatest(0, coalesce(p_offset, 0));
end
$$;

revoke all on function public.platform_list_hq_accounts(text, integer, integer) from public, anon;
grant execute on function public.platform_list_hq_accounts(text, integer, integer) to authenticated;

-- ── 본사 계정 수정/활성 상태 변경 ──
create or replace function public.platform_update_hq_account(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_memo text,
  p_hq_role text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id bigint;
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_hq_role text := btrim(coalesce(p_hq_role, ''));
  v_was_active boolean;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
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
$$;

revoke all on function public.platform_update_hq_account(uuid, text, text, text, text, boolean)
  from public, anon;
grant execute on function public.platform_update_hq_account(uuid, text, text, text, text, boolean)
  to authenticated;

-- ── 본사 계정 삭제 전 가드 ──
create or replace function public.platform_prepare_hq_account_delete(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id bigint;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
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
$$;

revoke all on function public.platform_prepare_hq_account_delete(uuid) from public, anon;
grant execute on function public.platform_prepare_hq_account_delete(uuid) to authenticated;

-- ── 본사 계정 프로비저닝 ──
create or replace function public.platform_provision_hq_account(
  p_user_id uuid,
  p_username text,
  p_full_name text,
  p_phone text,
  p_memo text,
  p_hq_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id bigint;
  v_username text := btrim(coalesce(p_username, ''));
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_hq_role text := btrim(coalesce(p_hq_role, ''));
  v_staff_capabilities jsonb;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
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
$$;

revoke all on function public.platform_provision_hq_account(uuid, text, text, text, text, text)
  from public, anon;
grant execute on function public.platform_provision_hq_account(uuid, text, text, text, text, text)
  to authenticated;

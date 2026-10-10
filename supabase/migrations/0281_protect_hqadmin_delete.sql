-- 기본 본사 관리자 계정(아이디 hqadmin)은 삭제할 수 없다(2026-10-10 사용자 결정, 0280 정지 금지에 이어).
--  - platform_prepare_hq_account_delete: hqadmin 이면 hint PROTECTED 로 거절(API 가 안내 문구로 변환).
--  - profiles BEFORE DELETE 트리거: 다른 경로(Auth 사용자 삭제 cascade 포함)로도 지워지지 않게 막는다.

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
  select member.org_id into v_org_id from public.org_members member
  where member.user_id = p_user_id and member.role = 'platform_admin'::public.org_member_role
  order by member.created_at, member.org_id limit 1;
  if not found then raise exception 'account not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.profiles profile where profile.user_id = p_user_id and lower(profile.username) = 'hqadmin') then
    raise exception 'protected account' using errcode = 'P0001', hint = 'PROTECTED';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'cannot delete yourself' using errcode = 'P0001', hint = 'SELF';
  end if;
  if exists (select 1 from public.org_members member where member.user_id = p_user_id and member.role <> 'platform_admin'::public.org_member_role)
  or exists (select 1 from public.resident_identities identity where identity.user_id = p_user_id) then
    raise exception 'account belongs to another organization or resident identity' using errcode = 'P0001', hint = 'OTHER_ROLE';
  end if;
  if not exists (
    select 1 from public.org_members member join public.profiles profile on profile.user_id = member.user_id
    where member.role = 'platform_admin'::public.org_member_role and member.user_id <> p_user_id and profile.is_active
  ) then
    raise exception 'must keep at least one active hq account' using errcode = 'P0001', hint = 'LAST_ADMIN';
  end if;
  insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, after)
  select v_org_id, (select auth.uid()), 'ACCOUNT_DELETE', 'profiles', p_user_id::text,
    jsonb_build_object('username', profile.username, 'role', 'platform_admin')
  from public.profiles profile where profile.user_id = p_user_id;
end
$function$;

create or replace function public.profiles_protect_hqadmin_delete()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if lower(old.username) = 'hqadmin' then
    raise exception '기본 본사 관리자 계정(hqadmin)은 삭제할 수 없습니다.'
      using errcode = 'P0001', hint = 'PROTECTED_ACCOUNT';
  end if;
  return old;
end
$function$;

drop trigger if exists profiles_protect_hqadmin_delete on public.profiles;
create trigger profiles_protect_hqadmin_delete
  before delete on public.profiles
  for each row execute function public.profiles_protect_hqadmin_delete();

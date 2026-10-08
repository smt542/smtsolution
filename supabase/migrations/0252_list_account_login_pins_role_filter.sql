-- list_account_login_pins: accounts 권한만 있는 일반 직원이 마스터·본사 계정의 PIN을 복호화해 열람하던 문제 차단.
-- 대상이 platform_admin이면 호출자도 platform_admin일 때만, org_owner이면 호출자도 같은 org의 org_owner(또는 platform_admin)일 때만 반환.
-- 반환 형식은 그대로(받지 못한 PIN은 화면에서 'PIN 없음'으로 표시됨).
create or replace function public.list_account_login_pins()
 returns table(user_id uuid, pin text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_key text;
  v_org bigint := public.current_user_org();
  v_is_platform boolean := public.current_user_is_platform_admin();
  v_is_owner boolean;
begin
  if not public.current_user_has_module('accounts') then
    raise exception 'forbidden: accounts required' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.org_members om
    where om.user_id = (select auth.uid()) and om.org_id = v_org and om.role = 'org_owner'
  ) into v_is_owner;

  select ds.decrypted_secret into v_key
  from vault.decrypted_secrets ds
  where ds.name = 'partner_login_pin_key';
  if v_key is null then
    return;
  end if;

  return query
    select t.user_id, extensions.pgp_sym_decrypt(t.pin_cipher, v_key)
    from public.account_login_pins t
    join public.org_members m on m.user_id = t.user_id
      and m.org_id = v_org
    where (m.role not in ('org_owner', 'platform_admin'))
       or (m.role = 'org_owner' and (v_is_owner or v_is_platform))
       or (m.role = 'platform_admin' and v_is_platform)
    order by t.user_id;
end;
$function$;

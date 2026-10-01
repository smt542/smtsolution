-- 2026-10-01 사용자 결정(고객 확인: 보안 레벨 살짝 낮아져도 됨) — 계정 목록·수정 창에 기존 비밀번호 표시, 0212 현장 PIN 저장을 전 계정으로 확장.
-- 0212의 현장 계정 PIN 저장을 조직 계정 전체로 확장한다. Auth에는 변환된 비밀번호가 저장되므로
-- 사용자가 실제로 입력한 4자리 PIN만 별도로 암호화해 저장한다.

alter table public.partner_login_pins rename to account_login_pins;

alter table public.account_login_pins enable row level security;
revoke all on table public.account_login_pins from public, anon, authenticated, service_role;

-- service_role 서버 경로에서만 호출하는 공통 PIN 저장 함수
create or replace function public.store_account_login_pin(
  p_user_id uuid default null,
  p_pin text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if p_user_id is null or coalesce(p_pin, '') = '' then
    raise exception 'user and pin required' using errcode = '22023';
  end if;

  select ds.decrypted_secret into v_key
  from vault.decrypted_secrets ds
  where ds.name = 'partner_login_pin_key';
  if v_key is null then
    raise exception 'partner_login_pin_key missing';
  end if;

  insert into public.account_login_pins (user_id, pin_cipher, updated_at)
  values (p_user_id, extensions.pgp_sym_encrypt(p_pin, v_key), now())
  on conflict (user_id) do update
    set pin_cipher = excluded.pin_cipher,
        updated_at = excluded.updated_at;
end;
$$;

revoke execute on function public.store_account_login_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.store_account_login_pin(uuid, text) to service_role;

-- 기존 배포 클라이언트 호환: 0212의 함수 시그니처와 호출 방식은 유지한다.
create or replace function public.partner_store_login_pin(p_user_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.store_account_login_pin(p_user_id, p_pin);
end;
$$;

revoke execute on function public.partner_store_login_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.partner_store_login_pin(uuid, text) to service_role;

-- 파트너 본인 PIN 조회도 새 공통 테이블을 사용한다.
create or replace function public.partner_get_my_pin()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cipher bytea;
  v_key text;
begin
  if v_uid is null or not public.current_user_is_field_partner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select t.pin_cipher into v_cipher
  from public.account_login_pins t
  where t.user_id = v_uid;
  if v_cipher is null then
    return null;
  end if;

  select ds.decrypted_secret into v_key
  from vault.decrypted_secrets ds
  where ds.name = 'partner_login_pin_key';
  if v_key is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(v_cipher, v_key);
end;
$$;

revoke execute on function public.partner_get_my_pin() from public, anon;
grant execute on function public.partner_get_my_pin() to authenticated;

-- 조직의 계정 관리 권한을 가진 사용자만 현재 조직의 계정 PIN을 조회할 수 있다.
create or replace function public.list_account_login_pins()
returns table (user_id uuid, pin text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if not public.current_user_has_module('accounts') then
    raise exception 'forbidden: accounts required' using errcode = '42501';
  end if;

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
      and m.org_id = public.current_user_org()
    order by t.user_id;
end;
$$;

revoke execute on function public.list_account_login_pins() from public, anon;
grant execute on function public.list_account_login_pins() to authenticated;

notify pgrst, 'reload schema';

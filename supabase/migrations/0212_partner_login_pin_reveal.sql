-- 파트너 프로필 비밀번호 보기(정본 partner/mobile-profile 눈 버튼 #pfEye): 켜면 본인 비밀번호(PIN)를 보여 준다
-- (2026-09-30 사용자 결정, QA W27 P10).
-- 비밀번호는 Supabase Auth에 해시로만 있어 원래 값을 꺼낼 수 없다. 그래서 파트너 로그인에 성공할 때 입력한
-- 비밀번호를 암호화해 둔다(pgcrypto, 키 = Vault 비밀 — 키는 DB 백업에 평문으로 남지 않는다).
-- - 저장: /api/partner/login 이 로그인 성공 직후 service_role로 partner_store_login_pin 을 부른다.
-- - 조회: partner_get_my_pin() — 로그인한 현장 계정 본인 것만. 저장된 값이 없으면 null.
-- - 사무실·통합관리자가 비밀번호를 바꾸면 그 라우트가 행을 지운다 → 다시 로그인할 때 새 값이 저장된다.
-- - 계정이 지워지면 행도 지워진다(auth.users on delete cascade).
-- 사무실 계정 목록의 비밀번호 칸(●●●●)은 그대로다 — 이 표는 목록 RPC 어디에도 연결하지 않는다.

-- ── 암호화 키: 없을 때만 만든다(다시 실행해도 키가 바뀌지 않아 저장된 값이 계속 풀린다) ──
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'partner_login_pin_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'partner_login_pin_key',
      '파트너 프로필 비밀번호 보기 암호화 키(0212)'
    );
  end if;
end;
$$;

-- ── 저장 표: RLS 켜고 정책 없음 + 권한 회수 = 아래 함수(와 service_role)로만 읽고 쓴다 ──
create table if not exists public.partner_login_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_cipher bytea not null,
  updated_at timestamptz not null default now()
);
alter table public.partner_login_pins enable row level security;
revoke all on table public.partner_login_pins from public, anon, authenticated;

-- ── 저장: 로그인 라우트(서버, service_role)만 부른다 ──
create or replace function public.partner_store_login_pin(p_user_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
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

  insert into public.partner_login_pins (user_id, pin_cipher, updated_at)
  values (p_user_id, extensions.pgp_sym_encrypt(p_pin, v_key), now())
  on conflict (user_id) do update
    set pin_cipher = excluded.pin_cipher,
        updated_at = excluded.updated_at;
end;
$$;

revoke execute on function public.partner_store_login_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.partner_store_login_pin(uuid, text) to service_role;

-- ── 조회: 로그인한 현장 계정 본인 것만 ──
create or replace function public.partner_get_my_pin()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
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
  from public.partner_login_pins t
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

notify pgrst, 'reload schema';

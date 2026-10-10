-- 기본 본사 관리자 계정(아이디 hqadmin)은 정지(비활성)할 수 없다(2026-10-10 사용자 결정).
--  - 본사 계정 모달·직원 계정 화면·직접 RPC 등 어느 경로로든 profiles.is_active=false 전환을 막는다.
--  - 다른 계정에는 영향이 없다.

create or replace function public.profiles_protect_hqadmin_active()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if lower(old.username) = 'hqadmin' and old.is_active and not new.is_active then
    raise exception '기본 본사 관리자 계정(hqadmin)은 정지할 수 없습니다.'
      using errcode = 'P0001', hint = 'PROTECTED_ACCOUNT';
  end if;
  return new;
end
$function$;

drop trigger if exists profiles_protect_hqadmin_active on public.profiles;
create trigger profiles_protect_hqadmin_active
  before update of is_active on public.profiles
  for each row execute function public.profiles_protect_hqadmin_active();

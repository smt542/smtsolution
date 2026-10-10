-- 계정 비밀번호 원문(복호화 가능 암호문) 보관 폐지(2026-10-10 사용자 결정).
--  - 0212/0220/0252 는 로그인·발급 때 입력한 PIN 을 pgp_sym_encrypt 로 저장하고 계정 목록·파트너 프로필에서 복호화해 보여줬다.
--  - 비밀번호는 Supabase Auth 의 단방향 해시로만 보관하고, 어디에서도 다시 보여주지 않는다(변경만 가능).
--  - 관리자가 발급·재설정한 비밀번호는 임시 비밀번호(profiles.must_change_password=true)이며,
--    본인이 /api/auth/change-password 로 바꿀 때까지 업무 화면 진입을 막는다(앱 레이아웃 게이트).
--  - profiles 에는 UPDATE RLS 정책이 없어 사용자가 must_change_password 를 직접 해제할 수 없다(서비스 롤만).

drop function if exists public.list_account_login_pins();
drop function if exists public.partner_get_my_pin();
drop function if exists public.store_account_login_pin(uuid, text);
drop table if exists public.account_login_pins;
delete from vault.secrets where name = 'partner_login_pin_key';

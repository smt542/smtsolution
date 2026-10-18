-- 입주자 등록 시 문자·알림톡 수신 기본 = 동의(2026-10-18).
--
-- 컬럼 기본값(sms_opt_in·alimtalk_opt_in)은 이미 true 이고 등록 폼 기본값도 동의인데,
-- 퇴거 공실 초기화(reset_occupancy_on_vacate)가 둘 다 false 로 바꿔 두어 공실 세대에 새 입주자를 등록하면
-- 폼이 「거부」로 시작했다. 공실 초기화 값을 동의로 바꾸고, 고지 방식도 동의에 맞춰 알림톡으로 둔다
-- (입주민 등록 정책: 알림톡 동의 세대는 알림톡 고지). 기존 공실 행도 같은 값으로 보정한다.
-- 함수 본문의 해당 줄만 현재 정의(0323)에서 치환한다(치환 대상이 없으면 중단).

do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.reset_occupancy_on_vacate'::regproc) into v_def;
  v_new := replace(v_def,
    E'    sms_opt_in = false,\n    alimtalk_opt_in = false,',
    E'    -- 0328: 새 입주자 등록 기본 = 수신 동의\n    sms_opt_in = true,\n    alimtalk_opt_in = true,');
  v_new := replace(v_new,
    E'    bill_delivery = ''post'',',
    E'    bill_delivery = ''alimtalk'',');
  if v_new = v_def or v_new !~ 'sms_opt_in = true' or v_new !~ 'bill_delivery = ''alimtalk''' then
    raise exception '0328: reset_occupancy_on_vacate 치환 대상 없음';
  end if;
  execute v_new;
end
$migration$;

update public.occupancies
   set sms_opt_in = true, alimtalk_opt_in = true, bill_delivery = 'alimtalk'
 where status = 'vacant' and deleted_at is null
   and (not sms_opt_in or not alimtalk_opt_in or bill_delivery <> 'alimtalk');

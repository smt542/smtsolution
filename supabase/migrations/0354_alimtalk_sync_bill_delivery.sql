-- 0354 (2026-11-03): QA #20 보완 — 알림톡 수신 동의가 바뀌면 고지 방법(bill_delivery)도 함께 바꾼다.
--  요청 원문: 세입자가 알림톡 받기를 끄면 알림톡 고지서는 전송 안 되고 종이고지서로 자동 변경, 고지서 출력 여부 Y.
--  0346 트리거는 print_enabled 만 바꿔서, 세입자 앱에서 알림톡을 끄면 bill_delivery 가 'alimtalk' 으로 남았다
--  (입주자 목록 "발송" 칸·세입자 앱 고지 방법이 계속 알림톡으로 보임). 사무실 입주자 폼과 같은 규칙으로 맞춘다:
--  동의 → 'alimtalk' + 출력 N, 거부 → 'post' + 출력 Y. 동의 값이 바뀌지 않는 저장은 건드리지 않는다(0346과 동일).
--  기존 행은 보정하지 않는다.
begin;

create or replace function public.sync_print_enabled_with_alimtalk()
returns trigger
language plpgsql
as $fn$
begin
  if new.alimtalk_opt_in is distinct from old.alimtalk_opt_in then
    new.print_enabled := not new.alimtalk_opt_in;
    new.bill_delivery := case when new.alimtalk_opt_in then 'alimtalk' else 'post' end;
  end if;
  return new;
end
$fn$;

commit;

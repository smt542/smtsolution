-- 세입자 관리비 내역: 입주일 이전 달도 보이게 한다.
--
-- resident_bill_months / resident_bill_detail 이 「입주월 ~ 퇴거월」 기간으로 한 번 더 걸러,
-- 입주일이 실제보다 늦게 등록된 세대는 본인 부과분인데도 최근 몇 달만 보였다(예: 6개월 중 3개월).
-- 두 함수는 이미 billing_confirmations.occupancy_id = 본인 입주 로 범위를 묶으므로 기간 조건만 뺀다.
-- resident_sign_bill_url 은 호실 단위로만 확인하고 있어, 기간 조건 대신 본인 입주 부과분인지 확인한다
-- (같은 호실 이전 세입자 고지서가 공유 링크로 나가지 않게).

do $migration$
declare
  v_def text;
  v_new text;
begin
  -- 1) resident_bill_months
  v_def := pg_get_functiondef('public.resident_bill_months()'::regprocedure);
  v_new := regexp_replace(v_def,
    'where\s+l\.move_in is not null\s+and bc\.period >= date_trunc\(''month'', l\.move_in\)::date\s+and \(\s+l\.move_out is null\s+or bc\.period <= date_trunc\(''month'', l\.move_out\)::date\s+\)',
    '-- 0293: 입주 기간 조건 없음 — 본인 입주(occupancy_id) 부과분은 모두 표시', '');
  if v_new = v_def then raise exception 'resident_bill_months patch failed'; end if;
  execute v_new;

  -- 2) resident_bill_detail
  v_def := pg_get_functiondef('public.resident_bill_detail(date)'::regprocedure);
  v_new := regexp_replace(v_def,
    'where\s+l\.move_in is not null\s+and p_period >= date_trunc\(''month'', l\.move_in\)::date\s+and \(\s+l\.move_out is null\s+or p_period <= date_trunc\(''month'', l\.move_out\)::date\s+\)',
    '-- 0293: 입주 기간 조건 없음 — 본인 입주(occupancy_id) 부과분은 모두 표시', '');
  if v_new = v_def then raise exception 'resident_bill_detail patch failed'; end if;
  execute v_new;

  -- 3) resident_sign_bill_url: 기간 조건 제거 + 본인 입주 부과분만 서명
  v_def := pg_get_functiondef('public.resident_sign_bill_url(date)'::regprocedure);
  v_new := regexp_replace(v_def,
    'if v_link\.move_in is null\s+or p_period < date_trunc\(''month'', v_link\.move_in\)::date\s+or \(\s+v_link\.move_out is not null\s+and p_period > date_trunc\(''month'', v_link\.move_out\)::date\s+\) then\s+raise exception ''period is outside occupancy tenure'' using errcode = ''22023'';\s+end if;',
    '', '');
  if v_new = v_def then raise exception 'resident_sign_bill_url tenure patch failed'; end if;
  v_def := v_new;
  v_new := regexp_replace(v_def,
    'where bc\.unit_id = v_link\.unit_id(\s+)and bc\.period = p_period',
    'where bc.unit_id = v_link.unit_id\1and bc.occupancy_id = v_link.occupancy_id\1and bc.period = p_period', '');
  if v_new = v_def then raise exception 'resident_sign_bill_url occupancy patch failed'; end if;
  execute v_new;
end
$migration$;

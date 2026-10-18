-- 이사정산 수도 입금일 저장(2026-10-18) — 사무실 이사정산 화면에서 전기·가스처럼 수도 입금일을 고른다.
--
-- moving_settlements.water_paid_date 컬럼은 있고 조회(get_settlement_context = to_jsonb, 전체 이사조회)도 이미 돌려주지만,
-- save_moving_settlement 가 저장하지 않았다. 신규 저장은 값을 넣고, 수정은 키를 보낸 경우에만 바꾼다
-- (수도 입금일을 보내지 않는 다른 저장 경로가 기존 값을 지우지 않게).
-- 함수 본문의 해당 줄만 현재 정의에서 치환한다(치환 대상이 없으면 중단).

do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.save_moving_settlement'::regproc) into v_def;

  -- insert 컬럼 목록
  v_new := regexp_replace(v_def,
    'elec_paid_date, gas_paid_date,',
    'elec_paid_date, gas_paid_date, water_paid_date,');
  -- insert values(줄 맨 앞의 nullif — update 의 「gas_paid_date = nullif(...)」 와 구분)
  v_new := regexp_replace(v_new,
    '(\n(\s*))nullif\(p_data->>''gas_paid_date'',''''\)::date,',
    '\1nullif(p_data->>''gas_paid_date'','''')::date,\1nullif(p_data->>''water_paid_date'','''')::date,');
  -- update
  v_new := regexp_replace(v_new,
    '(\n(\s*))gas_paid_date = nullif\(p_data->>''gas_paid_date'',''''\)::date,',
    '\1gas_paid_date = nullif(p_data->>''gas_paid_date'','''')::date,\1water_paid_date = case when p_data ? ''water_paid_date'' then nullif(p_data->>''water_paid_date'','''')::date else water_paid_date end,');

  if (select count(*) from regexp_matches(v_new, 'water_paid_date', 'g')) < 4 then
    raise exception '0329: save_moving_settlement 치환 실패';
  end if;
  execute v_new;
end
$migration$;

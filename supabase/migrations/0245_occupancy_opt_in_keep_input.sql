-- 문자·알림톡 수신 동의를 실제 입력값대로 저장한다.
--  - save_unit_occupancy_full은 값이 빠지면 false로 덮어써, 입력하지 않은 세대가 수신 거부로 저장됐다.
--    값이 오면 그 값, 없으면 기존 값을 유지한다(신규 등록은 컬럼 기본값=동의, 0244).
--  - 기존 기본값(false)으로 거부 저장된 거주 세대는 일괄 동의로 바로잡는다(퇴실 세대는 퇴실 처리의 의도적 거부라 제외).

do $patch$
declare
  v_def text;
  v_pairs text[][] := array[
    array['coalesce((p_occupancy->>''sms_opt_in'')::boolean, false)', 'coalesce((p_occupancy->>''sms_opt_in'')::boolean, sms_opt_in)'],
    array['coalesce((p_occupancy->>''alimtalk_opt_in'')::boolean, false)', 'coalesce((p_occupancy->>''alimtalk_opt_in'')::boolean, alimtalk_opt_in)']
  ];
  i int;
begin
  v_def := pg_get_functiondef('public.save_unit_occupancy_full(bigint,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb)'::regprocedure);
  for i in 1 .. array_length(v_pairs, 1) loop
    if (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]) <> 1 then
      raise exception 'patch target not found exactly once: %', v_pairs[i][1];
    end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end
$patch$;

update public.occupancies set sms_opt_in = true, alimtalk_opt_in = true
where deleted_at is null and (move_out_date is null or move_out_date >= current_date)
  and (sms_opt_in is distinct from true or alimtalk_opt_in is distinct from true);

-- 이사정산: 중도퇴실 건도 저장(수정)할 수 있게 한다.
--
-- 중도퇴실 뒤에도 같은 세입자에게 계속 부과하므로, 나중에 「정산완료+퇴실」로 완전 퇴실할 때
-- 퇴실일·수납액·미납(③, 저장 시 다시 계산) 등을 고쳐 저장해야 한다. 지금까지는 draft·saved 만 수정할 수 있어
-- 중도퇴실 건은 처음 값 그대로만 퇴실 처리됐다.
-- 중도퇴실 건을 저장해도 상태는 「중도퇴실」로 유지한다(공실·적요·알림톡 처리는 이미 끝났으므로).
-- 퇴실완료(completed) 건은 계속 수정할 수 없다.

do $migration$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb)'::regprocedure);

  v_new := replace(v_def,
    $$      status = 'saved',
      processed_at = null
      where id = v_settlement_id and unit_id = p_unit_id and status in ('draft','saved');$$,
    $$      -- 0296: 중도퇴실 건은 상태·처리 시각을 유지한 채 값만 고친다.
      status = case when status = 'mid_moveout' then 'mid_moveout' else 'saved' end,
      processed_at = case when status = 'mid_moveout' then processed_at else null end
      where id = v_settlement_id and unit_id = p_unit_id and status in ('draft','saved','mid_moveout');$$);
  if v_new = v_def then raise exception 'save_moving_settlement patch failed'; end if;
  execute v_new;
end
$migration$;

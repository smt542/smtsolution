-- 0341 (최종 리뷰): partner_save_moving_settlement 가 p_data->'extra' 를 그대로 저장해
--  partner 가 extra.subtotalOverride 를 주입할 수 있던 문제를 막는다.
--  partner payload 의 subtotalOverride 는 제거하고, 기존 사무실 override 는 0337 재병합 로직(v_ovr)으로만 유지한다.
begin;

do $mig$
declare
  v_def text;
  v_new text;
  v_old constant text := E'  v_extra := case when jsonb_typeof(p_data->''extra'') = ''object'' then p_data->''extra'' else null end;\n';
begin
  v_def := pg_get_functiondef('public.partner_save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb)'::regprocedure);
  if position(v_old in v_def) = 0 then
    raise exception 'target statement not found in partner_save_moving_settlement';
  end if;
  v_new := replace(v_def, v_old, v_old || E'  -- 0341: partner 는 소계 override 를 쓸 수 없다(사무실 값만 v_ovr 로 재병합).\n  v_extra := v_extra - ''subtotalOverride'';\n');
  execute v_new;
end
$mig$;

commit;

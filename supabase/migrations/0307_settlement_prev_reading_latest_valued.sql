-- 이사정산 「전월 지침」 기본값: 값이 있는 가장 최근 검침을 쓴다(사용자 결정 2026-10-11).
--
-- 정책(현장 관리자_이사정산 등록·상세.md 3.2, 사무실과 동일): "퇴실월 검침이면 그 달 전월 지침, 이전 달 검침이면
-- 그 달 금월 지침". 지금까지는 퇴실월 이전 가장 최근 **행**을 골라, 공과금 일괄 저장으로 생긴 빈 자리 행(지침이 모두
-- null)이 있으면 그보다 앞선 실제 검침이 가려졌고, 퇴실월 행의 전월 보완도 바로 전 달 하나만 봤다.
--   · cur  : 퇴실월 이하에서 금월·전월 지침 중 하나라도 있는 가장 최근 행
--   · prev : cur 보다 앞선 달 중 금월 지침이 있는 가장 최근 행(전월 지침이 빈 퇴실월 검침의 보완)
-- 화면(사무실 MovingSettlementWorkspace·현장 _ms.ts)은 그대로 — cur.period 가 퇴실월이면 previous_reading,
-- 아니면 current_reading 을 전월 지침 기본값으로 쓴다. 기본값일 뿐이며 직원이 고칠 수 있다.
-- 대상: get_settlement_context(사무실), partner_get_settlement_context(현장) — 같은 조회식을 각각 갖고 있다.

do $migration$
declare
  v_fn text;
  v_def text;
  v_new text;
begin
  foreach v_fn in array array['get_settlement_context', 'partner_get_settlement_context'] loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = v_fn;
    if v_def is null then raise exception '% not found', v_fn; end if;

    v_new := regexp_replace(v_def,
      'left join lateral \(\s*select mr\.\* from meter_readings mr\s+where mr\.unit_id = p_unit_id and mr\.utility = utility_row\.utility\s+and \(v_period is null or mr\.period <= v_period\)\s+order by mr\.period desc limit 1\s*\) cur on true\s+left join meter_readings prev\s+on prev\.unit_id = p_unit_id and prev\.utility = utility_row\.utility\s+and prev\.period = \(cur\.period - interval ''1 month''\)::date',
      'left join lateral (
      -- 0307: 값이 있는 가장 최근 검침(지침이 모두 빈 자리 행은 건너뛴다)
      select mr.* from meter_readings mr
      where mr.unit_id = p_unit_id and mr.utility = utility_row.utility
        and (v_period is null or mr.period <= v_period)
        and (mr.current_reading is not null or mr.previous_reading is not null)
      order by mr.period desc limit 1
    ) cur on true
    left join lateral (
      -- 0307: cur 이전 달 중 금월 지침이 있는 가장 최근 검침(바로 전 달에 한정하지 않음)
      select p.current_reading from meter_readings p
      where p.unit_id = p_unit_id and p.utility = utility_row.utility
        and p.period < cur.period and p.current_reading is not null
      order by p.period desc limit 1
    ) prev on true', '');
    if v_new = v_def then raise exception '% meter lookup patch failed', v_fn; end if;
    execute v_new;
  end loop;
end
$migration$;

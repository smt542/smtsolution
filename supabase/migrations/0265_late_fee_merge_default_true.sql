-- 0265: 개선3차 항목 2·3 보정 — 연체료 「합산」을 기본값으로 (회의록 2026-08-14: 연체료 합산 기본값)
--  - setup_config.late_fee_merge 컬럼 기본값 false → true
--  - 기존 행 백필(false 는 구 기본값에서 온 값이며 사용자 선택이 아님)
--  - load_fax_document 의 설정 미존재 폴백 coalesce(sc.late_fee_merge, false) → true
--    (실DB pg_get_functiondef 에서 출발해 해당 구문만 치환한다. 치환 실패 시 예외.)

alter table public.setup_config alter column late_fee_merge set default true;

update public.setup_config set late_fee_merge = true where late_fee_merge is distinct from true;

do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.load_fax_document(bigint)'::regprocedure);
  v_new := replace(v_def,
    '''late_fee_merge'', coalesce(sc.late_fee_merge, false)',
    '''late_fee_merge'', coalesce(sc.late_fee_merge, true)');
  if v_new = v_def then raise exception 'load_fax_document late_fee_merge fallback patch not applied'; end if;
  execute v_new;
end $$;

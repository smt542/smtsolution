-- 수납관리 화면의 납기일·연체료를 시스템 공통 기한 규칙으로 맞춘다.
--
-- 기존: list_payment_rows 는 발행 고지서(bill_issues) 납기일만, list_receipts_workspace_scoped 는
--       발행 고지서 → 건물·월 납기일까지만 봐서, 둘 다 없는 달은 납기일이 비고 화면 연체료(lateFeeForRow)가 0 이었다.
--       (미납 관리·세입자 앱은 0287/0288 로 이미 회사 기본 납부일·말일까지 본다.)
-- 변경: 납기일 = 발행 고지서 → 건물·월 납기일 → 회사 기본 납부일(billing_default_due_date) → 그 달 말일.
--       list_receipts_workspace 는 list_payment_rows 의 납기일을 쓰므로 함께 맞춰진다.

do $$
declare
  v_def text;
  v_new text;
begin
  -- 1) list_payment_rows: bi 서브쿼리(발행 고지서 납기일)를 공통 기한으로 교체
  v_def := pg_get_functiondef('public.list_payment_rows(bigint,date)'::regprocedure);
  if position('0289:' in v_def) = 0 then
    v_new := regexp_replace(
      v_def,
      'left join lateral \(\s*select due_date from bill_issues x.*?\) bi on true',
      $blk$left join lateral (
    -- 0289: 납기일 = 발행 고지서 → 건물·월 납기일 → 회사 기본 납부일 → 그 달 말일
    select coalesce(
      (select x.due_date from bill_issues x
        where x.unit_id = u.id and x.period = p_period and x.due_date is not null
        order by x.issued_at desc nulls last, x.id desc limit 1),
      (select s.due_date from billing_period_settings s
        where s.building_id = p_building_id and s.period = p_period),
      public.billing_default_due_date(u.id, p_period)
    ) as due_date
  ) bi on true$blk$,
      's'
    );
    if v_new = v_def then raise exception 'bill_issues block not found in list_payment_rows'; end if;
    execute v_new;
  end if;

  -- 2) list_receipts_workspace_scoped: coalesce(bi.due_date, ps.due_date) 뒤에 기본 납부일 대체값 추가
  v_def := pg_get_functiondef('public.list_receipts_workspace_scoped(bigint,date,bigint,bigint,integer,integer)'::regprocedure);
  if position('billing_default_due_date(' in v_def) = 0 then
    v_new := replace(v_def, 'coalesce(bi.due_date, ps.due_date)', 'coalesce(bi.due_date, ps.due_date, public.billing_default_due_date(u.id, p_period))');
    if v_new = v_def then raise exception 'due_date coalesce not found in list_receipts_workspace_scoped'; end if;
    execute v_new;
  end if;
end $$;

-- 세입자 앱(홈·관리비 내역·고지서 상세)·공유 고지서의 납부기한을 시스템 공통 규칙으로 맞춘다.
--
-- 기존: 발행 고지서(bill_issues)의 납기일만 봐서, 고지서를 발행하지 않은 달은 「납부기한 미정」이었고
--       연체료도 계산되지 않았다(미납 관리 화면과 기한·연체료가 달랐다).
-- 변경: 납부기한 = 발행 고지서 납기일 → 건물·월 납기일(billing_period_settings) → 회사 기본 납부일
--       (0287 billing_default_due_date) → 그 달 말일. 같은 issue.due_date 를 쓰는 연체료 계산도 함께 맞춰진다.
-- 대상: resident_bill_months() · resident_bill_detail(date) · public_bill_by_signed(...,integer)
-- 방식: 각 함수의 issue 서브쿼리 블록만 교체한다. 이미 교체돼 있으면 건너뛴다.

do $$
declare
  v_item record;
  v_def text;
  v_new text;
  v_block text;
begin
  for v_item in
    select * from (values
      ('public.resident_bill_months()',                                  'l.unit_id', 'l.building_id'),
      ('public.resident_bill_detail(date)',                              'l.unit_id', 'l.building_id'),
      ('public.public_bill_by_signed(bigint,text,date,text,integer)',    'u.id',      'u.building_id')
    ) as t(sig, unit_expr, building_expr)
  loop
    v_def := pg_get_functiondef(v_item.sig::regprocedure);
    if position('0288:' in v_def) > 0 then continue; end if; -- 이미 적용됨
    v_block := format($blk$left join lateral (
    -- 0288: 납부기한 = 발행 고지서 → 건물·월 납기일 → 회사 기본 납부일 → 그 달 말일
    select coalesce(
      (select bi.due_date
         from public.bill_issues bi
        where bi.unit_id = %1$s and bi.period = bc.period and bi.due_date is not null
        order by bi.issued_at desc, bi.id desc
        limit 1),
      (select bps.due_date
         from public.billing_period_settings bps
        where bps.building_id = %2$s and bps.period = bc.period),
      public.billing_default_due_date(%1$s, bc.period)
    ) as due_date
  ) issue on true$blk$, v_item.unit_expr, v_item.building_expr);
    v_new := regexp_replace(v_def, 'left join lateral \(\s*select bi\.due_date.*?\) issue on true', v_block, 's');
    if v_new = v_def then raise exception 'issue block not found in %', v_item.sig; end if;
    execute v_new;
  end loop;
end $$;

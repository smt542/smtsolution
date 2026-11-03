-- 0353 (2026-11-03): 팩스·알림톡 발행 후 고지서 당월 연체료가 0이 되는 문제 수정.
--  원인: 팩스(fax)·알림톡(kakao) 발행은 bill_issues.due_date 를 저장하지 않는다(null).
--   - bill_document_extras 가 "그 달 가장 최근 발행 기록의 납기일"만 봐서, 지로 발행(납기일 있음) 뒤에
--     팩스를 한 번 보내면 납기일이 null 이 되어 당월 연체료가 0 으로 계산됐다(지로 재출력·팩스 재발송 모두).
--   - load_fax_document 는 팩스 발행 기록 자신의 납기일(null)을 써서 팩스 PDF 의 납기일이 빈칸으로 나갔다.
--  수정: 두 곳 모두 billing_effective_due_date(발행 고지서 중 납기일 있는 최근 건 → 건물·월 납기일 →
--   회사 기본 납부일 → 말일)를 쓴다. 세입자 고지서(resident_bill_detail 등, 0288)와 같은 기준.
--  시그니처·반환 컬럼·권한 변경 없음. 기존 데이터 보정 없음(계산 함수만 변경).
begin;

do $$
declare
  v_def text;
  v_new text;
begin
  -- 1) bill_document_extras: 최근 발행 기록 납기일(lateral issue) → billing_effective_due_date
  v_def := pg_get_functiondef('public.bill_document_extras(bigint,date)'::regprocedure);
  v_new := replace(v_def,
    $a$  left join lateral (
    select bi.due_date
    from bill_issues bi
    where bi.unit_id = bc.unit_id
      and bi.period = bc.period
    order by bi.issued_at desc, bi.id desc
    limit 1
  ) issue on true$a$,
    $b$  left join lateral (
    -- 0353: 납기일 없는 팩스·알림톡 발행 기록은 건너뛴다(0288 세입자 고지서와 같은 기준)
    select public.billing_effective_due_date(bc.unit_id, bc.period) as due_date
  ) issue on true$b$);
  if v_new = v_def then
    raise exception 'bill_document_extras: 납기일 조회 패턴을 찾지 못함';
  end if;
  execute v_new;

  -- 2) load_fax_document: 팩스 PDF 납기일
  v_def := pg_get_functiondef('public.load_fax_document(bigint)'::regprocedure);
  v_new := replace(v_def,
    $a$'due_date', to_char(bi.due_date, 'YYYY-MM-DD'),$a$,
    $b$'due_date', to_char(coalesce(bi.due_date, public.billing_effective_due_date(bi.unit_id, bi.period)), 'YYYY-MM-DD'),$b$);
  if v_new = v_def then
    raise exception 'load_fax_document: due_date 패턴을 찾지 못함';
  end if;
  execute v_new;
end $$;

commit;

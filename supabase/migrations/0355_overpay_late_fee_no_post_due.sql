-- 0355 (2026-11-03): 납기후 가산금 제외 — 연체료 = 미납 원금 × 구간 누적요율만.
--  사무실 화면(lib/billing/lateFee.ts)과 과수납 계산(overpay_late_fee)은 납기후 가산금(setup_config.late_fee_post_due_rate,
--  기본 2%, 10원 단위)을 더했고, 고지서·알림톡·세입자 앱·이사정산(bill_document_extras·bill_carryover·
--  resident_bill_*·settlement_billing_unpaid)은 더하지 않아 같은 세대의 연체료가 화면마다 달랐다
--  (그린빌라 201호 10월: 수납관리 미납합계 323,460 / 고지서·세입자 앱 311,681).
--  정책: 계산 규칙 §3(요율만)과 미납 관리 정책("납.후연체는 산식 확정 전 0")에 맞춰 가산금을 뺀다.
--  overpay_late_fee 의 가산금 항만 제거한다(시그니처·권한·나머지 식 동일). 기존 과수납 원장 0행이라 재계산 대상 없음.
begin;

do $$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.overpay_late_fee(bigint,date,integer,date)'::regprocedure);
  v_new := replace(v_def,
    $a$        ) / 100.0)
        + round(p_principal * coalesce((select sc.late_fee_post_due_rate from setup_config sc where sc.org_id = ctx.org_id), 2.0)
                / 100.0 / 10.0) * 10
      )::int$a$,
    $b$        ) / 100.0)
      )::int$b$);
  if v_new = v_def then
    raise exception 'overpay_late_fee: 납기후 가산금 패턴을 찾지 못함';
  end if;
  execute v_new;
end $$;

commit;

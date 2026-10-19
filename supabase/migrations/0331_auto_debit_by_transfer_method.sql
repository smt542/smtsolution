-- 자동이체 세대 판정 = 입주(occupancy)의 납부방법이 「자동이체」(transfer_method = 'auto_transfer')(2026-10-19 결정).
--
-- 지금까지는 관리비 계좌(unit_accounts kind='mgmt')에 CMS 회원번호가 있으면 자동이체로 봤다.
-- 그래서 납부방법이 「없음」·「지로」인 세대도 회원번호만 있으면 자동이체 세대 출력·자동이체 도장·
-- 카카오 고지 유형(자동이체 템플릿)·수납 목록 자동이체 표시에 잡혔다.
-- 같은 판정을 쓰는 함수 6개를 함께 바꾼다(해당 식만 치환):
--   list_bill_targets, get_bill_documents  — 부과 확정 입주(bc.occupancy_id = o)의 납부방법
--   issue_bills, record_bill_delivery, resolve_fax_bill_issues — 발행 기록(bill_issues.auto_debit)도 같은 기준
--   list_payment_rows — 수납 목록 자동이체 표시(최근 입주)

do $migration$
declare
  v_def text;
  v_new text;
  v_old_pattern constant text :=
    'exists \(\s*select 1 from (public\.)?unit_accounts ua\s+where ua\.unit_id = [a-z_.]+ and ua\.kind = ''mgmt'' and nullif\(ua\.cms_member_no, ?''''\) is not null\s*\)';
  r record;
begin
  for r in
    select * from (values
      ('public.list_bill_targets(bigint,date)', $r$coalesce(o.transfer_method = 'auto_transfer', false)$r$),
      ('public.get_bill_documents(bigint,date,jsonb)', $r$coalesce(o.transfer_method = 'auto_transfer', false)$r$),
      ('public.issue_bills(bigint,date,jsonb,text,date,text,jsonb)',
        $r$exists (select 1 from occupancies ao where ao.id = v_occ_id and ao.transfer_method = 'auto_transfer')$r$),
      ('public.record_bill_delivery(bigint,date,jsonb,text,text,bigint,bigint,timestamp with time zone)',
        $r$exists (select 1 from public.occupancies ao where ao.id = v_occ_id and ao.transfer_method = 'auto_transfer')$r$),
      ('public.resolve_fax_bill_issues(bigint,date,jsonb)',
        $r$exists (select 1 from public.occupancies ao where ao.id = v_occ and ao.transfer_method = 'auto_transfer')$r$)
    ) as t(fn, repl)
  loop
    select pg_get_functiondef(r.fn::regprocedure) into v_def;
    v_new := regexp_replace(v_def, v_old_pattern, r.repl);
    if v_new = v_def then raise exception '0331: % 치환 대상 없음', r.fn; end if;
    execute v_new;
  end loop;

  -- list_payment_rows: occ 에 납부방법을 싣고 is_auto_debit 을 그것으로 판정한다.
  select pg_get_functiondef('public.list_payment_rows(bigint,date)'::regprocedure) into v_def;
  v_new := replace(v_def,
    'o.tenant_name, o.payer_name, o.status',
    'o.tenant_name, o.payer_name, o.status, o.transfer_method');
  v_new := replace(v_new,
    '(ua.cms_member_no is not null) as is_auto_debit',
    $r$coalesce(occ.transfer_method = 'auto_transfer', false) as is_auto_debit$r$);
  if v_new = v_def or strpos(v_new, 'occ.transfer_method') = 0 or strpos(v_new, 'o.status, o.transfer_method') = 0 then
    raise exception '0331: list_payment_rows 치환 대상 없음';
  end if;
  execute v_new;
end
$migration$;

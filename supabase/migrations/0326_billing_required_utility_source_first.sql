-- 관리비 부과 확정 시 필수 공과금(전기·수도료·가스)은 공과금 화면 부과액을 우선한다.
--
-- 문제(2026-10-18, 그린빌라 902호 10월): 공과금 저장(10:26~10:28) 뒤 관리비 저장(10:29)으로 확정했는데,
-- confirm_billing 이 fee_item_charges(10/10 이월값)를 공과금보다 먼저 써 예전 금액이 확정됐다.
-- 관리비 부과 화면은 필수 공과금 항목 칸을 숨겨 직원이 그 값을 보거나 고칠 수 없고,
-- 정책(관리비 부과 세팅 3.6)상 공과금 원천 = 공과금 화면 해당 월 부과액이다.
--
-- 변경: list_billing·confirm_billing·charge_new_occupancies 의 항목 금액
--   필수 공과금 → 공과금 부과액(billing_utility_default) → fee_item_charges → (이월·0)
--   그 외 항목   → 기존과 같음(fee_item_charges → 이월 → 0)
-- 이미 확정된 고지서는 바꾸지 않는다(재확정 시 반영, 0324 '재확정 필요' 표시 유지).
--
-- 세 함수의 해당 coalesce 첫 줄만 바꾸도록 현재 정의에서 치환한다(0324 정의 기준, 치환 실패 시 중단).

do $migration$
declare
  v_fn text;
  v_def text;
  v_new text;
begin
  foreach v_fn in array array['list_billing', 'confirm_billing', 'charge_new_occupancies'] loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_fn;
    v_new := regexp_replace(
      v_def,
      'fic\.amount,(\s*\n)(\s*)billing_utility_default\(([^)]*)\),',
      '-- 0326: 필수 공과금은 공과금 화면 부과액 우선\1\2case when fi.is_required then billing_utility_default(\3) end,\1\2fic.amount,\1\2billing_utility_default(\3),'
    );
    if v_new = v_def then
      raise exception '0326: % 치환 대상 없음', v_fn;
    end if;
    execute v_new;
  end loop;
end
$migration$;

-- OM2-080: 일할(daily_proration) 항목이 있는 월중 입주 세대가 있으면 confirm_billing 이
-- round_charge(numeric, fee_rounding) 를 호출하는데 round_charge(numeric, text) 오버로드만
-- 존재해 `function round_charge(numeric, fee_rounding) does not exist` 로 부과 확정이 실패했다.
-- fee_rounding enum 을 받는 오버로드를 추가해 기존 text 구현에 위임한다(동작 변경 없음).
CREATE OR REPLACE FUNCTION public.round_charge(p_value numeric, p_rounding fee_rounding)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $function$
  select public.round_charge(p_value, p_rounding::text);
$function$;

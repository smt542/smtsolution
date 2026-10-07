-- 수납 이력 일괄 저장을 한 트랜잭션으로 처리한다.
--  - 수납 이력 화면은 행마다 cancel_payment / record_payment / record_payment_edit 를 순차 호출해
--    중간에 실패하면 앞 행만 반영되는 부분 저장이 생겼다.
--  - 이 함수는 같은 함수들을 한 호출 안에서 차례로 실행한다. 하나라도 실패하면 전부 롤백된다.
--  - 권한·org·금액 검증과 감사 로그는 각 함수가 그대로 수행한다.
--
-- p_ops: [{ "op": "cancel", "payment_id": 1 }
--        ,{ "op": "record", "unit_id": 1, "period": "2026-10-01", "amount": 1000, "fee": 0,
--           "method": "cash", "kind": "full", "paid_at": "2026-10-08", "memo": null }
--        ,{ "op": "edit", "old_payment_id": 1, ...record 와 같은 필드 }]

create or replace function public.save_payment_history(p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_op jsonb;
  v_canceled int := 0;
  v_recorded int := 0;
  v_edited int := 0;
begin
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then raise exception 'ops must be an array'; end if;

  for v_op in select value from jsonb_array_elements(p_ops) loop
    case v_op->>'op'
      when 'cancel' then
        perform cancel_payment((v_op->>'payment_id')::bigint);
        v_canceled := v_canceled + 1;
      when 'record' then
        perform record_payment(
          (v_op->>'unit_id')::bigint, (v_op->>'period')::date, (v_op->>'amount')::int,
          v_op->>'method', v_op->>'kind', v_op->>'memo', (v_op->>'paid_at')::date,
          coalesce((v_op->>'fee')::int, 0));
        v_recorded := v_recorded + 1;
      when 'edit' then
        perform record_payment_edit(
          (v_op->>'old_payment_id')::bigint,
          (v_op->>'unit_id')::bigint, (v_op->>'period')::date, (v_op->>'amount')::int,
          v_op->>'method', v_op->>'kind', v_op->>'memo', (v_op->>'paid_at')::date,
          (v_op->>'fee')::int, null);
        v_edited := v_edited + 1;
      else
        raise exception 'invalid op: %', v_op->>'op';
    end case;
  end loop;

  return jsonb_build_object('ok', true, 'canceled', v_canceled, 'recorded', v_recorded, 'edited', v_edited);
end $function$;

revoke execute on function public.save_payment_history(jsonb) from public, anon;
grant execute on function public.save_payment_history(jsonb) to authenticated;

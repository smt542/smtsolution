-- 입주민 표 '이사청소' 컬럼(정책 33컬럼): list_tenants 가 occupancies.move_cleaning_fee 를 반환한다.
-- 반환 타입이 바뀌므로 drop 후 재생성하고 권한(0154/0219)을 복원한다. DB 현재 정의를 패치한다.
do $mig$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.list_tenants(bigint)'::regprocedure) into v_def;
  if v_def like '%move_cleaning_fee%' then
    return;
  end if;
  v_new := replace(v_def, 'mgmt_fee_amount bigint, ', 'mgmt_fee_amount bigint, move_cleaning_fee bigint, ');
  v_new := replace(v_new, 'u.area_pyeong, o.mgmt_fee_amount,', 'u.area_pyeong, o.mgmt_fee_amount, o.move_cleaning_fee,');
  if v_new = v_def or v_new not like '%o.mgmt_fee_amount, o.move_cleaning_fee,%' then
    raise exception 'list_tenants patch failed';
  end if;
  drop function public.list_tenants(bigint);
  execute v_new;
  revoke execute on function public.list_tenants(bigint) from public, anon;
  grant execute on function public.list_tenants(bigint) to authenticated;
end
$mig$;

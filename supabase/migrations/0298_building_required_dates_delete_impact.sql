-- 건물 등록·상세 정책 위배 보완 (1-1, 1-2, 1-4)
--
-- 1-1: 사무 담당자·현장 관리자는 필수 → save_building 이 둘 중 하나라도 org_members 에서 못 찾으면 예외.
--      (기존 건물에 비어 있는 행이 있어도 백필하지 않는다. 수정 저장 때 채우게 된다.)
-- 1-2: 계약일보다 해지일이 빠르면 저장 불가 (basic_extra 의 contractDate/terminationDate, 'YYYY-MM-DD').
-- 1-4: 부과(확정)·수납 이력이 있는 건물·호수를 지울 때 경고하려고 사전 점검 RPC 를 추가한다(차단하지 않는다).

do $migration$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.save_building(bigint,text,text,text,uuid,uuid,uuid,jsonb,text,jsonb,jsonb,bigint,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure);

  v_new := replace(v_def,
    $$  if v_id is null then
    insert into buildings($$,
    $$  -- 0298: 사무 담당자·현장 관리자 필수(정책 건물 등록/상세).
  if v_mgr is null then
    raise exception '사무 담당자를 선택해 주세요.' using errcode = '22023';
  end if;
  if v_meter is null then
    raise exception '현장 관리자를 선택해 주세요.' using errcode = '22023';
  end if;

  -- 0298: 계약일보다 해지일이 빠르면 저장할 수 없다.
  if coalesce(p_basic_extra->>'contractDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
     and coalesce(p_basic_extra->>'terminationDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
     and (p_basic_extra->>'terminationDate') < (p_basic_extra->>'contractDate') then
    raise exception '해지일은 계약일보다 빠를 수 없어요.' using errcode = '22023';
  end if;

  if v_id is null then
    insert into buildings($$);
  if v_new = v_def then raise exception 'save_building patch failed'; end if;
  execute v_new;
end
$migration$;

-- 삭제 전 '과거 데이터 영향' 점검. SECURITY INVOKER 라 호출자의 RLS 범위만 보인다.
create or replace function public.building_delete_impact(p_id bigint)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'confirmationCount', (select count(*) from billing_confirmations bc join units u on u.id = bc.unit_id where u.building_id = p_id),
    'paymentCount',      (select count(*) from payments p join units u on u.id = p.unit_id where u.building_id = p_id)
  );
$$;

create or replace function public.unit_delete_impact(p_unit_id bigint)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'confirmationCount', (select count(*) from billing_confirmations where unit_id = p_unit_id),
    'paymentCount',      (select count(*) from payments where unit_id = p_unit_id)
  );
$$;

revoke all on function public.building_delete_impact(bigint) from public, anon;
revoke all on function public.unit_delete_impact(bigint) from public, anon;
grant execute on function public.building_delete_impact(bigint) to authenticated;
grant execute on function public.unit_delete_impact(bigint) to authenticated;

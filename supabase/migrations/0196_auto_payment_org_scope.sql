-- 자동수납(지로·은행 입금) RPC 3종을 건물 없이 조직 전체로도 부를 수 있게 한다.
--
-- 수납관리 헤더의 자동수납 메뉴(지로수납처리·지로수납원장·지로처리일자 확인·은행 입금내역 업로드)는
-- 정본대로 건물 선택과 상관없이 조직 전체를 다룬다. p_building_id 에 null 을 넘기면 조직 전체,
-- 건물 id 를 넘기면 지금과 같다. 인자 구성은 그대로라 오버로드가 생기지 않고 기존 호출도 그대로 동작한다.
-- 조직 전체 범위는 list_receipts_workspace 와 같다(삭제된 건물·호실 제외).

-- list_giro_payments: 건물이 섞이므로 행마다 unit_id·building_id·building_name 을 덧붙인다.
-- 반환 컬럼이 바뀌어 create or replace 가 안 되므로 지웠다 다시 만든다(기존 컬럼 순서 유지, 새 컬럼은 뒤에).
drop function if exists list_giro_payments(bigint, date);
create function list_giro_payments(p_building_id bigint, p_period date)
returns table(id bigint, unit_no text, dong text, tenant_name text, amount int, paid_at date, status text, memo text,
              unit_id bigint, building_id bigint, building_name text)
language sql stable security definer set search_path = public as $$
  with u as (
    select un.id, un.unit_no, un.dong, un.building_id, b.name as building_name
    from units un
    join buildings b on b.id = un.building_id and b.org_id = current_user_org()
    where un.deleted_at is null
      and ((p_building_id is null and b.deleted_at is null) or un.building_id = p_building_id)
  ),
  occ as (
    select distinct on (o.unit_id) o.unit_id, o.tenant_name
    from occupancies o join u on u.id=o.unit_id
    where o.deleted_at is null
    order by o.unit_id, o.created_at desc, o.id desc
  )
  select p.id, u.unit_no, u.dong, occ.tenant_name, p.amount, p.paid_at, p.status, p.memo,
         u.id, u.building_id, u.building_name
  from payments p
  join u on u.id=p.unit_id
  left join occ on occ.unit_id=u.id
  where p.period=p_period and p.method='giro'
  order by p.paid_at desc, p.id desc
$$;
revoke execute on function list_giro_payments(bigint, date) from public, anon;
grant execute on function list_giro_payments(bigint, date) to authenticated;

-- list_bank_payments: 은행 업로드 미리보기의 '이미 반영됨' 판정용. 반환형은 그대로.
create or replace function list_bank_payments(p_building_id bigint, p_period date)
returns table(unit_id bigint, amount int, paid_at date)
language sql stable security definer set search_path = public as $$
  select p.unit_id, p.amount, p.paid_at
  from payments p
  join units u on u.id=p.unit_id
  join buildings b on b.id=u.building_id and b.org_id=current_user_org()
  where ((p_building_id is null and b.deleted_at is null and u.deleted_at is null) or u.building_id=p_building_id)
    and p.period=p_period
    and p.source='bank_excel' and p.status='active'
$$;

-- record_bank_payments: null 이면 건물 검사를 건너뛰고, 세대마다 조직 소속(삭제 건물 제외)만 확인한다.
-- 조직 전체 반영은 감사 로그 row_pk 를 'org' 로 남긴다.
create or replace function record_bank_payments(p_building_id bigint, p_period date, p_entries jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_item jsonb; v_unit bigint; v_amount int; v_occ bigint;
        v_paid_at date; v_memo text; v_id bigint;
        v_recorded int := 0; v_skipped int := 0; v_duplicate int := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if p_building_id is not null
     and not exists (select 1 from buildings where id=p_building_id and org_id=v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if jsonb_typeof(coalesce(p_entries,'[]'::jsonb)) is distinct from 'array' then
    raise exception 'entries must be an array'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_entries,'[]'::jsonb)) loop
    v_unit := nullif(v_item->>'unit_id','')::bigint;
    v_amount := nullif(v_item->>'amount','')::int;
    if v_unit is null or coalesce(v_amount,0) <= 0 then v_skipped := v_skipped + 1; continue; end if;
    if not exists (select 1 from units uu join buildings b on b.id=uu.building_id
                   where uu.id=v_unit and b.org_id=v_org and uu.deleted_at is null
                     and ((p_building_id is null and b.deleted_at is null) or uu.building_id=p_building_id)) then
      v_skipped := v_skipped + 1; continue; end if;
    -- 귀속: 해당 (unit, period) 확정부과 occupancy 우선, 없으면 최근 occupancy 폴백.
    select bc.occupancy_id into v_occ from billing_confirmations bc
      where bc.unit_id=v_unit and bc.period=p_period;
    if v_occ is null then
      select o.id into v_occ from occupancies o where o.unit_id=v_unit and o.deleted_at is null
        order by o.created_at desc, o.id desc limit 1;
    end if;

    v_paid_at := coalesce(nullif(v_item->>'paid_at','')::date, current_date);
    v_memo := nullif(v_item->>'memo','');

    -- 멱등: 동일 논리키(org·unit·period·amount·paid_at·memo)의 active 은행수납이 이미 있으면 스킵(재업로드 이중 반영 방지).
    insert into payments(org_id, unit_id, period, occupancy_id, amount, method, kind, memo, paid_at, source, created_by)
      values (v_org, v_unit, p_period, v_occ, v_amount, 'transfer', 'full', v_memo,
              v_paid_at, 'bank_excel', auth.uid())
      on conflict (org_id, unit_id, period, amount, paid_at, coalesce(memo, ''))
        where source = 'bank_excel' and status = 'active'
      do nothing
      returning id into v_id;

    if v_id is null then
      v_duplicate := v_duplicate + 1;   -- 이미 존재 → 스킵
    else
      v_recorded := v_recorded + 1;
    end if;
    v_id := null;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_BANK_IMPORT', 'payments', coalesce(p_building_id::text, 'org'),
      jsonb_build_object('period', p_period, 'recorded', v_recorded,
                         'skipped', v_skipped, 'duplicate', v_duplicate));

  -- skipped = 무효행(단위 없음/금액 0/범위 밖) + 중복행. duplicate는 별도로도 노출해 UI가 "이미 반영됨"을 구분.
  return jsonb_build_object('recorded', v_recorded,
                            'skipped', v_skipped + v_duplicate,
                            'duplicate', v_duplicate);
end $$;

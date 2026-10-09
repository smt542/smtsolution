-- 0262: 개선3차 항목 24·26·30
--  24: public_bill_by_signed(5인자) 당월 late_fee 에 late_fee_factor 복구 (0261 재정의로 누락된 회귀)
--  26: resident_bill_months / resident_bill_detail 고지 조인에 occupancy 귀속, 수납 집계에 occupancy 일치 추가
--  30: resident_create_move_out 중복검사·부분 유니크 인덱스를 pending+confirmed 로 확대
-- 함수 정의는 실DB pg_get_functiondef 에서 출발해 해당 구문만 치환한다(다른 수정 회귀 방지). 치환 실패 시 예외.

do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
begin
  -- 24
  select p.oid into v_oid from pg_proc p
   where p.proname = 'public_bill_by_signed' and p.pronamespace = 'public'::regnamespace and p.pronargs = 5;
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(v_def,
    '* lf.cumulative_rate / 100.0)::int else null end',
    '* lf.cumulative_rate * public.late_fee_factor(b.org_id, bc.occupancy_id) / 100.0)::int else null end');
  if v_new = v_def then raise exception 'public_bill_by_signed patch not applied'; end if;
  execute v_new;

  -- 26 months
  select p.oid into v_oid from pg_proc p
   where p.proname = 'resident_bill_months' and p.pronamespace = 'public'::regnamespace;
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(v_def,
    E'on bc.unit_id = l.unit_id\n     and bc.confirmed_at is not null',
    E'on bc.unit_id = l.unit_id\n     and bc.occupancy_id = l.occupancy_id\n     and bc.confirmed_at is not null');
  if v_new = v_def then raise exception 'resident_bill_months join patch not applied'; end if;
  v_def := v_new;
  v_new := replace(v_def,
    E'where p.unit_id = l.unit_id\n        and p.period = bc.period',
    E'where p.unit_id = l.unit_id\n        and p.occupancy_id = bc.occupancy_id\n        and p.period = bc.period');
  if v_new = v_def then raise exception 'resident_bill_months pay patch not applied'; end if;
  execute v_new;

  -- 26 detail
  select p.oid into v_oid from pg_proc p
   where p.proname = 'resident_bill_detail' and p.pronamespace = 'public'::regnamespace;
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(v_def,
    E'and bc.period = p_period\n   and bc.confirmed_at is not null',
    E'and bc.occupancy_id = l.occupancy_id\n   and bc.period = p_period\n   and bc.confirmed_at is not null');
  if v_new = v_def then raise exception 'resident_bill_detail join patch not applied'; end if;
  v_def := v_new;
  v_new := replace(v_def,
    E'where p.unit_id = l.unit_id\n      and p.period = bc.period',
    E'where p.unit_id = l.unit_id\n      and p.occupancy_id = bc.occupancy_id\n      and p.period = bc.period');
  if v_new = v_def then raise exception 'resident_bill_detail pay patch not applied'; end if;
  execute v_new;

  -- 30
  select p.oid into v_oid from pg_proc p
   where p.proname = 'resident_create_move_out' and p.pronamespace = 'public'::regnamespace;
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(v_def,
    E'and mor.status = ''pending''',
    E'and mor.status in (''pending'', ''confirmed'')');
  if v_new = v_def then raise exception 'resident_create_move_out patch not applied'; end if;
  v_new := replace(v_new, 'pending move-out request already exists', 'active move-out request already exists');
  execute v_new;
end $$;

drop index if exists public.move_out_one_pending_per_occupancy;
create unique index move_out_one_pending_per_occupancy
  on public.move_out_requests (resident_user_id, occupancy_id)
  where status in ('pending', 'confirmed');

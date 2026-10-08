-- 퇴실(occupancy.status -> vacant) 시 세대의 수도 할인을 리셋한다.
-- 정책: 부과·정산 계산 규칙 2.2 / 수도공과금 결정 로그(2026-08-12) "수도 할인은 정액 자동·퇴실 리셋".
-- 퇴실 경로(execute_move_out, execute_due_move_outs, complete_moving_settlement, save_unit_occupancy_full,
-- 입주민 퇴실 확정 등)가 모두 occupancies.status 를 vacant 로 바꾸므로 트리거 한 곳에서 처리한다.
-- 이미 저장된 meter_readings.discount_amount 는 건드리지 않는다(이후 산정부터 적용).
create or replace function public.reset_water_discount_on_vacate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- 같은 세대에 입주 중인 다른 occupancy 가 있으면 리셋하지 않는다.
  if not exists (
    select 1 from occupancies o
    where o.unit_id = new.unit_id and o.id <> new.id
      and o.deleted_at is null and o.status = 'occupied'
  ) then
    delete from water_discounts where unit_id = new.unit_id;
  end if;
  return new;
end $$;

revoke all on function public.reset_water_discount_on_vacate() from public, anon, authenticated;

drop trigger if exists trg_occupancies_reset_water_discount on public.occupancies;
create trigger trg_occupancies_reset_water_discount
  after update of status on public.occupancies
  for each row
  when (new.status = 'vacant'::occupancy_status and old.status is distinct from new.status)
  execute function public.reset_water_discount_on_vacate();

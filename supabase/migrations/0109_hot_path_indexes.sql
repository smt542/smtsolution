-- Active occupancy lookups and the staff dashboard use these predicates on every load.
create index if not exists occupancies_active_unit_created_idx
  on public.occupancies (unit_id, created_at desc)
  where deleted_at is null;

create index if not exists occupancies_occupied_move_in_unit_idx
  on public.occupancies (move_in_date, unit_id)
  where status = 'occupied' and deleted_at is null;

create index if not exists complaints_active_org_status_idx
  on public.complaints (org_id, status)
  where deleted_at is null;

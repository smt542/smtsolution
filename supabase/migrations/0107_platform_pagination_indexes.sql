-- Stable cursor and status-page ordering for platform point administration.

create index if not exists point_transactions_created_at_id_idx
  on public.point_transactions(created_at desc, id desc);

create index if not exists message_point_reservations_status_created_at_id_idx
  on public.message_point_reservations(status, created_at desc, id desc);

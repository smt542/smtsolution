-- 매월 반복 예약: 어느 경로로 확정되든(complete_message_schedule, 정산 settle_message_points_from_jobs)
-- 상태가 sent/partial로 바뀌면 다음 회차를 만든다. enqueue_next_message_occurrence는 같은 회차가 있으면
-- 기존 id를 돌려주므로 두 경로가 겹쳐도 1건이다. 전원 실패(failed)면 다음 회차를 만들지 않는다(2026-09-09 결정).

create or replace function public.message_schedules_enqueue_next_occurrence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_next_message_occurrence(new.id);
  return null;
end
$$;
revoke all on function public.message_schedules_enqueue_next_occurrence() from public, anon, authenticated;

drop trigger if exists trg_message_schedules_enqueue_next on public.message_schedules;
create trigger trg_message_schedules_enqueue_next
  after update of status on public.message_schedules
  for each row
  when (
    new.status in ('sent', 'partial')
    and old.status is distinct from new.status
    and new.recurrence_mode = 'monthly'
  )
  execute function public.message_schedules_enqueue_next_occurrence();

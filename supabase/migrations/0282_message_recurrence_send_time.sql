-- 반복 발송 설정에서 발송 시각(시:분)도 지정한다.
--
-- 반복 회차는 직전 예약 일시(scheduled_at)를 기준으로 다음 회차를 만들므로, 이 예약의
-- 발송 시각을 바꾸면 이후 모든 회차가 같은 시각을 따른다. 날짜(KST)는 그대로 두고 시각만 바꾼다.
-- 시각을 바꾼 결과가 이미 지난 시점이면 거절한다(대기 중 예약이 과거가 되지 않게).

drop function if exists public.set_message_schedule_recurrence(bigint, text, integer);

create or replace function public.set_message_schedule_recurrence(
  p_schedule_id bigint,
  p_mode text,
  p_end_count integer default null,
  p_send_time time default null
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v message_schedules%rowtype;
  v_seq int;
  v_scheduled_at timestamptz;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;
  if p_mode is not null and p_mode not in ('monthly', 'weekly') then
    raise exception 'invalid recurrence: null|monthly|weekly required';
  end if;
  if p_end_count is not null and (p_mode is null or p_end_count < 1) then
    raise exception 'invalid recurrence end: positive count with recurrence required';
  end if;

  select * into v from message_schedules
    where id = p_schedule_id and org_id = v_org and status = 'scheduled'
    for update;
  if not found then raise exception 'scheduled message not found or already processed'; end if;

  if p_mode is null then
    update message_schedules
      set recurrence_mode = null, recurrence_anchor_day = null,
          recurrence_end_count = null, recurrence_seq = null
      where id = v.id;
    return;
  end if;

  v_scheduled_at := v.scheduled_at;
  if p_send_time is not null then
    v_scheduled_at := (((v.scheduled_at at time zone 'Asia/Seoul')::date + p_send_time)
      at time zone 'Asia/Seoul');
    if v_scheduled_at <= now() then
      raise exception '발송 시각이 이미 지났습니다. 이후 시각을 선택해 주세요.' using errcode = '22023';
    end if;
  end if;

  v_seq := coalesce(v.recurrence_seq, 1);
  update message_schedules
    set scheduled_at = v_scheduled_at,
        recurrence_mode = p_mode,
        recurrence_anchor_day = case when p_mode = 'monthly'
          then extract(day from (v_scheduled_at at time zone 'Asia/Seoul'))::int else null end,
        recurrence_seq = v_seq,
        recurrence_end_count = case when p_end_count is null then null else v_seq + p_end_count - 1 end
    where id = v.id;
end $function$;

revoke all on function public.set_message_schedule_recurrence(bigint, text, integer, time) from public, anon;
grant execute on function public.set_message_schedule_recurrence(bigint, text, integer, time) to authenticated, service_role;

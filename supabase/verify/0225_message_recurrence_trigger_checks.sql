-- 0225 확인: 트리거 존재 + 동작. 마지막 raise는 의도된 롤백이다(아무것도 남지 않는다).
-- 통과 = 오류 메시지가 'OK 0225'로 시작. 'FAIL 0225'면 실패.
-- 실행: node --env-file=C:/Users/leebj/orca/projects/home_erp/.env.local C:/Users/leebj/orca/projects/home_erp/scripts/db-query.mjs <이 파일>
do $$
declare
  v_org bigint;
  v_sent_id bigint;
  v_failed_id bigint;
  v_next int;
  v_next_again int;
  v_failed_next int;
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_message_schedules_enqueue_next' and not tgisinternal
  ) then
    raise exception 'FAIL 0225: trigger missing';
  end if;
  select min(id) into v_org from public.organizations;

  -- sending → sent: 다음 회차 1건
  insert into public.message_schedules(
    org_id, channel, body, context, recipient_count, recipients,
    scheduled_at, status, recurrence_mode, recurrence_anchor_day
  ) values (
    v_org, 'sms', '0225 probe sent', 'manual', 0, '[]'::jsonb,
    now() + interval '1 day', 'sending', 'monthly',
    extract(day from ((now() + interval '1 day') at time zone 'Asia/Seoul'))::int
  ) returning id into v_sent_id;
  update public.message_schedules set status = 'sent' where id = v_sent_id;
  select count(*) into v_next from public.message_schedules where recurrence_parent_id = v_sent_id;

  -- complete_message_schedule 경로가 한 번 더 불러도 1건
  perform public.enqueue_next_message_occurrence(v_sent_id);
  select count(*) into v_next_again from public.message_schedules where recurrence_parent_id = v_sent_id;

  -- sending → failed: 다음 회차 없음
  insert into public.message_schedules(
    org_id, channel, body, context, recipient_count, recipients,
    scheduled_at, status, recurrence_mode, recurrence_anchor_day
  ) values (
    v_org, 'sms', '0225 probe failed', 'manual', 0, '[]'::jsonb,
    now() + interval '1 day', 'sending', 'monthly',
    extract(day from ((now() + interval '1 day') at time zone 'Asia/Seoul'))::int
  ) returning id into v_failed_id;
  update public.message_schedules set status = 'failed' where id = v_failed_id;
  select count(*) into v_failed_next from public.message_schedules where recurrence_parent_id = v_failed_id;

  if v_next = 1 and v_next_again = 1 and v_failed_next = 0 then
    raise exception 'OK 0225 (sent→%, again→%, failed→%) — rolled back', v_next, v_next_again, v_failed_next;
  end if;
  raise exception 'FAIL 0225 (sent→%, again→%, failed→%) — rolled back', v_next, v_next_again, v_failed_next;
end $$;

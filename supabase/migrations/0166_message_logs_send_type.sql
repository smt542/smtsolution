-- 발송 내역 그리드에서 즉시·예약 발송 유형을 구분할 수 있도록 로그 조회 RPC를 확장한다.

create index if not exists message_schedules_message_log_idx
  on public.message_schedules (message_log_id)
  where message_log_id is not null;

drop function if exists public.list_message_logs(int);

create function public.list_message_logs(p_limit int default 50)
returns table(
  id bigint,
  org_id bigint,
  channel text,
  body text,
  context text,
  recipient_count int,
  recipients jsonb,
  result text,
  sent_by uuid,
  sent_at timestamptz,
  created_at timestamptz,
  template_id bigint,
  estimated_points integer,
  charged_points integer,
  point_status text,
  notice_id bigint,
  is_scheduled boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;

  return query
    select
      ml.id,
      ml.org_id,
      ml.channel,
      ml.body,
      ml.context,
      ml.recipient_count,
      ml.recipients,
      ml.result,
      ml.sent_by,
      ml.sent_at,
      ml.created_at,
      ml.template_id,
      ml.estimated_points,
      ml.charged_points,
      ml.point_status,
      ml.notice_id,
      exists (
        select 1
        from public.message_schedules ms
        where ms.message_log_id = ml.id
      ) as is_scheduled
    from public.message_logs ml
    where ml.org_id in (select my_org_ids())
    order by ml.sent_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end
$$;

revoke execute on function public.list_message_logs(int) from public, anon;
grant execute on function public.list_message_logs(int) to authenticated;

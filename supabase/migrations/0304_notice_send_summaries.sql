-- 공지 목록용 발송 요약 일괄 조회: 공지별 최근 발송 1건(수신자 수·전송 시각·결과). 호출자 org 스코프.
create or replace function public.notice_send_summaries(p_notice_ids bigint[])
returns table (notice_id bigint, recipient_count int, sent_at timestamptz, result text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct on (ml.notice_id)
         ml.notice_id, ml.recipient_count, ml.sent_at, ml.result
  from public.message_logs ml
  where ml.notice_id = any(p_notice_ids)
    and ml.org_id in (select my_org_ids())
  order by ml.notice_id, ml.sent_at desc;
$$;

revoke all on function public.notice_send_summaries(bigint[]) from public, anon;
grant execute on function public.notice_send_summaries(bigint[]) to authenticated;

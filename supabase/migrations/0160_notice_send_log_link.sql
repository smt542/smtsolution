-- 공지별 발송 이력 연결: message_logs 에 notice_id 를 추가하고, 발송 후 공지에 귀속시키는 RPC 제공.
-- 발송 파이프라인 RPC(send_messages/reserve/schedule/popbill)는 건드리지 않는다.
-- 앱이 발송 완료 후 반환된 log_id 를 공지에 연결한다(비침습적).

alter table public.message_logs
  add column if not exists notice_id bigint references public.notices(id) on delete set null;

create index if not exists message_logs_notice_idx
  on public.message_logs (notice_id) where notice_id is not null;

comment on column public.message_logs.notice_id is
  '이 발송이 속한 공지(있으면). 공지 상세의 발송 이력 집계에 사용.';

-- 발송 로그를 공지에 귀속(호출자 org 소속 로그·공지에 한함).
create or replace function public.attach_notice_to_message_log(p_log_id bigint, p_notice_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.message_logs ml
     set notice_id = p_notice_id
   where ml.id = p_log_id
     and ml.org_id in (select my_org_ids())
     and exists (
       select 1 from public.notices n
       where n.id = p_notice_id and n.org_id = ml.org_id
     );
end;
$$;

revoke all on function public.attach_notice_to_message_log(bigint, bigint) from public, anon;
grant execute on function public.attach_notice_to_message_log(bigint, bigint) to authenticated;

-- 공지의 최근 발송 1건 요약(수신자 수·전송 시각·결과). 호출자 org 스코프.
create or replace function public.notice_send_summary(p_notice_id bigint)
returns table (recipient_count int, sent_at timestamptz, result text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ml.recipient_count, ml.sent_at, ml.result
  from public.message_logs ml
  where ml.notice_id = p_notice_id
    and ml.org_id in (select my_org_ids())
  order by ml.sent_at desc
  limit 1;
$$;

revoke all on function public.notice_send_summary(bigint) from public, anon;
grant execute on function public.notice_send_summary(bigint) to authenticated;

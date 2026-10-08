-- 0250: 정기 발송 다음 회차 생성 함수의 실행 권한 회수 (정책문제점 개선1차 #1, P0-2)
-- enqueue_next_message_occurrence 는 SECURITY DEFINER + 권한 검사 없음인데 PUBLIC/anon/authenticated 가
-- 실행할 수 있어, 비로그인 호출로 임의 schedule_id 의 다음 회차(실발송·포인트 차감)가 만들어졌다.
-- 호출처는 소유자(postgres) 권한으로 도는 트리거/함수(message_schedules_enqueue_next_occurrence,
-- complete_message_schedule)뿐이므로 본문은 건드리지 않고 실행 권한만 회수한다.
revoke execute on function public.enqueue_next_message_occurrence(bigint) from public, anon, authenticated;
grant execute on function public.enqueue_next_message_occurrence(bigint) to service_role;

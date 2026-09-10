-- 건물·입주자 통합 화면에서 건물 선택 시 호출하는 RPC 권한 복구.
-- 일부 배포 환경에서 함수 재생성 후 authenticated grant가 누락되어
-- 정상 로그인 사용자도 입주민 목록을 읽지 못하는 문제를 방지한다.

revoke execute on function execute_due_move_outs() from public, anon;
revoke execute on function list_tenants(bigint) from public, anon;

grant execute on function execute_due_move_outs() to authenticated;
grant execute on function list_tenants(bigint) to authenticated;

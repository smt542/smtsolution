-- 세입자(resident)의 테이블 직접 쓰기 RLS 제거 (P0-9, P1-9)
-- 기존 정책은 resident_user_id = auth.uid() 만 검사해 org/건물/세대/occupancy를 위조한
-- 퇴실신청·세대연결요청을 직접 만들 수 있었다. 앱의 세입자 쓰기 경로는 모두
-- SECURITY DEFINER RPC(resident_create_move_out / resident_update_move_out /
-- resident_cancel_move_out / resident_request_claim / resident_confirm)이므로 직접 쓰기 정책은 불필요하다.
-- SELECT 정책(*_resident_select)과 staff 정책은 유지한다.
drop policy if exists move_out_requests_resident_insert on public.move_out_requests;
drop policy if exists move_out_requests_resident_update on public.move_out_requests;
drop policy if exists res_claims_resident_insert on public.res_claims;

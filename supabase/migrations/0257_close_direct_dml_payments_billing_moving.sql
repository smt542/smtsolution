-- 정책문제점_개선1차 #8: 수납·부과확정·이사정산 테이블의 직접 DML을 닫는다.
-- 앱의 쓰기는 모두 SECURITY DEFINER RPC(record_payment·record_payment_edit·cancel_payment·
-- save_payment_history·record_bank_payments·record_giro_payments·confirm_billing·save_billing_charges·
-- save_moving_settlement·partner_save_moving_settlement·complete_moving_settlement·mid_moveout_settlement 등)를
-- 거치므로, REST로 직접 수납 하드삭제·금액 변경·부과확정 총액 변경·완료 정산 수정을 못 하게 쓰기 정책을 지운다.
-- SELECT 정책(pay_select·bc_select·ms_select)은 그대로 둔다.
-- 이사정산은 사무실 화면의 삭제(hooks/reactquery/movingSettlement/apis.ts deleteMovingSettlement)가
-- 직접 DELETE를 쓰므로, draft/saved 상태만 지울 수 있는 DELETE 전용 정책으로 바꾼다
-- (0249의 사무실 직원 조건은 유지).

drop policy if exists pay_write on public.payments;
drop policy if exists bc_write on public.billing_confirmations;
drop policy if exists ms_write on public.moving_settlements;

create policy ms_delete_draft on public.moving_settlements for delete to authenticated
  using (
    unit_id in (
      select u.id from public.units u
      join public.buildings b on b.id = u.building_id
      where b.org_id in (select public.my_org_ids())
    )
    and (select public.current_user_is_office_staff())
    and (select public.current_user_has_module('moving'))
    and status in ('draft', 'saved')
  );

-- 0312: 이사정산 「정산완료+퇴실」 취소(퇴실 취소, 2026-10-14 사용자 요청).
-- complete_moving_settlement(0167·0275) 가 한 일을 같은 트랜잭션 시각(processed_at = audit_log.created_at)의
-- 감사 기록으로 되돌린다.
--   · occupancies: reset_occupancy_on_vacate 직전 행(audit UPDATE_OCCUPANCIES.before)으로 입주 정보 복원
--   · occupancy_history: 그때 적재한 전출 이력 1건 삭제
--   · lease_contracts: 그때 지운 임대 정보(audit DELETE_LEASE_CONTRACTS.before) 복원
--   · res_claims: 퇴실로 끊긴 세입자 세대 연결(audit CLAIM_UNLINK_MOVE_OUT) 복원
--   · payments: 그때 자동수납한 '퇴실정산 자동수납' 건 취소
--   · moving_settlements: 상태를 퇴실 전으로(적요에 '중도퇴실'이 있으면 mid_moveout, 아니면 saved)
-- 수도 감면(water_discounts)은 감사 기록이 없어 복원하지 않는다.
-- 이미 새 입주자가 들어왔거나 퇴실 당시 기록을 찾지 못하면 취소하지 않는다.
create or replace function public.cancel_moving_settlement_moveout(p_settlement_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org bigint;
  v_row moving_settlements%rowtype;
  v_occ occupancies%rowtype;
  v_snapshot jsonb;
  v_at timestamptz;
  v_restored occupancies;
  v_lease jsonb;
  v_claim record;
  v_history_id bigint;
  v_canceled_payments int := 0;
  v_restored_claims int := 0;
  v_restored_lease boolean := false;
  v_next_status text;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_is_office_staff() then raise exception 'forbidden: office staff only'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;

  select s.* into v_row
    from moving_settlements s
    join units u on u.id = s.unit_id
    join buildings b on b.id = u.building_id and b.org_id = v_org
   where s.id = p_settlement_id
   for update of s;
  if not found then raise exception 'settlement not in org'; end if;
  if v_row.status <> 'completed' then
    raise exception '퇴실완료된 이사정산만 퇴실 취소할 수 있습니다.' using errcode = '55000';
  end if;
  if v_row.occupancy_id is null then raise exception 'settlement has no occupancy'; end if;

  select o.* into v_occ
    from occupancies o
   where o.id = v_row.occupancy_id and o.unit_id = v_row.unit_id and o.deleted_at is null
   for update of o;
  if not found then raise exception 'occupancy not in unit'; end if;
  if v_occ.status <> 'vacant' or v_occ.tenant_name is not null
     or exists (select 1 from occupancies o
                 where o.unit_id = v_row.unit_id and o.id <> v_occ.id
                   and o.deleted_at is null and o.status <> 'vacant') then
    raise exception '이 세대에는 이미 새 입주자가 있어 퇴실을 취소할 수 없습니다.'
      using errcode = '55000', hint = 'MOVEOUT_CANCEL_REOCCUPIED';
  end if;

  -- 퇴실 처리 트랜잭션의 공실화 직전 행. processed_at 과 감사 기록 시각이 같다(같은 트랜잭션 now()).
  select a.before, a.created_at into v_snapshot, v_at
    from audit_log a
   where a.table_name = 'occupancies'
     and a.row_pk = v_occ.id::text
     and a.action = 'UPDATE_OCCUPANCIES'
     and coalesce(a.before->>'status', '') <> 'vacant'
     and a.after->>'status' = 'vacant'
     and v_row.processed_at is not null
     and a.created_at between v_row.processed_at - interval '5 seconds' and v_row.processed_at + interval '5 seconds'
   order by a.id
   limit 1;
  if v_snapshot is null then
    raise exception '퇴실 당시 입주 정보 기록을 찾을 수 없어 퇴실을 취소할 수 없습니다.'
      using errcode = '55000', hint = 'MOVEOUT_CANCEL_NO_SNAPSHOT';
  end if;
  v_restored := jsonb_populate_record(null::occupancies, v_snapshot);

  update occupancies set
    tenant_name = v_restored.tenant_name,
    payer_name = v_restored.payer_name,
    resident_count = v_restored.resident_count,
    move_in_date = v_restored.move_in_date,
    expected_move_in_date = v_restored.expected_move_in_date,
    discount_type = v_restored.discount_type,
    discount_amount = v_restored.discount_amount,
    phone = v_restored.phone,
    phone2 = v_restored.phone2,
    phone3 = v_restored.phone3,
    phones_extra = v_restored.phones_extra,
    vehicle_no = v_restored.vehicle_no,
    vehicles_extra = v_restored.vehicles_extra,
    sms_opt_in = v_restored.sms_opt_in,
    alimtalk_opt_in = v_restored.alimtalk_opt_in,
    transfer_method = v_restored.transfer_method,
    late_fee_enabled = v_restored.late_fee_enabled,
    single_print = v_restored.single_print,
    print_enabled = v_restored.print_enabled,
    bill_name_display = v_restored.bill_name_display,
    bill_delivery = v_restored.bill_delivery,
    bill_auth = v_restored.bill_auth,
    bill_auth_info = v_restored.bill_auth_info,
    fax_number = v_restored.fax_number,
    settlement_note = v_restored.settlement_note,
    billing_note = v_restored.billing_note,
    move_out_date = v_restored.move_out_date,
    move_out_scheduled_date = v_restored.move_out_scheduled_date,
    status = v_restored.status
  where id = v_occ.id;

  -- 퇴실 때 적재한 전출 이력 1건.
  select h.id into v_history_id
    from occupancy_history h
   where h.unit_id = v_row.unit_id
     and h.move_out_date = v_row.move_out_date
     and h.tenant_name is not distinct from v_restored.tenant_name
     and h.created_at between v_at - interval '5 seconds' and v_at + interval '5 seconds'
   order by h.id desc
   limit 1;
  if v_history_id is not null then
    delete from occupancy_history where id = v_history_id;
  end if;

  -- 퇴실 때 지운 임대 정보.
  if not exists (select 1 from lease_contracts where occupancy_id = v_occ.id) then
    select a.before into v_lease
      from audit_log a
     where a.table_name = 'lease_contracts'
       and a.action = 'DELETE_LEASE_CONTRACTS'
       and a.before->>'occupancy_id' = v_occ.id::text
       and a.created_at between v_at - interval '5 seconds' and v_at + interval '5 seconds'
     order by a.id desc
     limit 1;
    if v_lease is not null then
      insert into lease_contracts overriding system value
        select * from jsonb_populate_record(null::lease_contracts, v_lease);
      v_restored_lease := true;
    end if;
  end if;

  -- 퇴실로 끊긴 세입자 세대 연결.
  for v_claim in
    select a.before
      from audit_log a
     where a.table_name = 'res_claims'
       and a.action = 'CLAIM_UNLINK_MOVE_OUT'
       and a.before->>'occupancy_id' = v_occ.id::text
       and a.created_at between v_at - interval '5 seconds' and v_at + interval '5 seconds'
     order by a.id
  loop
    if not exists (select 1 from res_claims rc
                    where rc.status = 'linked'
                      and (rc.resident_user_id = (v_claim.before->>'resident_user_id')::uuid
                           or rc.occupancy_id = v_occ.id)) then
      insert into res_claims(org_id, resident_user_id, building_id, unit_id, occupancy_id,
                             status, kind, memo, created_at, resolved_at, resolved_by)
      values (v_org, (v_claim.before->>'resident_user_id')::uuid,
              nullif(v_claim.before->>'building_id', '')::bigint,
              nullif(v_claim.before->>'unit_id', '')::bigint,
              v_occ.id, 'linked', 'auto', '퇴실 취소로 세대 연결 복원',
              coalesce(nullif(v_claim.before->>'linked_at', '')::timestamptz, now()),
              coalesce(nullif(v_claim.before->>'linked_at', '')::timestamptz, now()),
              auth.uid());
      v_restored_claims := v_restored_claims + 1;
    end if;
  end loop;

  -- 퇴실 때 자동수납한 미납(vacancy_payment_mode = auto).
  update payments
     set status = 'canceled', canceled_at = now(), canceled_by = auth.uid()
   where unit_id = v_row.unit_id
     and occupancy_id = v_occ.id
     and memo = '퇴실정산 자동수납'
     and status = 'active'
     and created_at between v_at - interval '5 seconds' and v_at + interval '5 seconds';
  get diagnostics v_canceled_payments = row_count;

  v_next_status := case when coalesce(v_restored.billing_note, '') ~ '(^|\s·\s)중도퇴실($|\s·\s)'
                        then 'mid_moveout' else 'saved' end;
  update moving_settlements
     set status = v_next_status,
         processed_at = case when v_next_status = 'saved' then null else processed_at end
   where id = p_settlement_id;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
    values (v_org, auth.uid(), 'MOVING_SETTLEMENT_MOVEOUT_CANCEL', 'moving_settlements', p_settlement_id::text,
      jsonb_build_object('status', 'completed', 'move_out_date', v_row.move_out_date),
      jsonb_build_object('status', v_next_status, 'occupancy_id', v_occ.id, 'unit_id', v_row.unit_id,
                         'history_deleted', v_history_id, 'lease_restored', v_restored_lease,
                         'claims_restored', v_restored_claims, 'payments_canceled', v_canceled_payments));

  return jsonb_build_object(
    'ok', true,
    'status', v_next_status,
    'claims_restored', v_restored_claims,
    'lease_restored', v_restored_lease,
    'payments_canceled', v_canceled_payments);
end $$;

revoke all on function public.cancel_moving_settlement_moveout(bigint) from public, anon;
grant execute on function public.cancel_moving_settlement_moveout(bigint) to authenticated;

-- OM2-194: 퇴실 취소 후 수도 감면 처리 정합성
-- (1) cancel_moving_settlement_moveout: 정책 3.12 "수도 감면 설정은 복원하지 않는다"에 맞춰
--     퇴실 취소 시 occupancies.discount_type/discount_amount 를 복원하지 않고 비운다.
--     (복원하면 입주자 상세에는 「수급자할인」이 보이는데 water_discounts 는 없어 수도 할인이
--      실제로는 적용되지 않는 불일치가 생긴다.)
-- (2) save_unit_occupancy_full: 입주자 상세에서 할인유형/할인금액을 지정하면 water_discounts 에
--     동기화(upsert)해 수도 공과금에 정액 할인이 자동 적용되도록 한다. '일반'/미지정 저장은
--     수도공과금 할인 모달에서 설정한 값을 지우지 않도록 삭제하지 않는다(비파괴적 동기화).

-- (1) 퇴실 취소: 감면 미복원 ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_moving_settlement_moveout(p_settlement_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- OM2-194: 수도 감면 설정은 복원하지 않는다(정책 3.12).
    discount_type = null,
    discount_amount = null,
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
end $function$;

-- (2) 입주자 상세 저장 → water_discounts 동기화 -----------------------------------------
CREATE OR REPLACE FUNCTION public.save_unit_occupancy_full(p_building_id bigint, p_unit_id bigint, p_occupancy_id bigint, p_unit jsonb, p_occupancy jsonb, p_meters jsonb, p_accounts jsonb, p_lease jsonb, p_fax_number text, p_property jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
  v_unit_id bigint;
  v_occ_id bigint;
  v_disc_type text;
  v_disc_amount bigint;
begin
  -- 코어 저장(권한/조직/건물 검증은 내부 함수가 수행: current_user_has_module('tenants') 등)
  v_result := save_unit_occupancy(
    p_building_id, p_unit_id, p_occupancy_id,
    p_unit, p_occupancy, p_meters, p_accounts, p_lease
  );
  v_unit_id := (v_result->>'unit_id')::bigint;
  v_occ_id  := (v_result->>'occupancy_id')::bigint;

  -- 확장 occupancy 컬럼(코어가 기록하지 않는 필드) + fax(값이 오면 갱신, 없으면 보존)
  update occupancies set
    fax_number            = case when p_fax_number is null then fax_number
                                 else nullif(btrim(p_fax_number), '') end,
    sms_opt_in            = coalesce((p_occupancy->>'sms_opt_in')::boolean, sms_opt_in),
    alimtalk_opt_in       = coalesce((p_occupancy->>'alimtalk_opt_in')::boolean, alimtalk_opt_in),
    expected_move_in_date = nullif(p_occupancy->>'expected_move_in_date','')::date,
    discount_type         = coalesce(nullif(p_occupancy->>'discount_type',''), 'general'),
    discount_amount       = nullif(p_occupancy->>'discount_amount','')::bigint,
    homepage_password     = p_occupancy->>'homepage_password',
    mgmt_fee_amount       = nullif(p_occupancy->>'mgmt_fee_amount','')::bigint,
    move_cleaning_fee     = nullif(p_occupancy->>'move_cleaning_fee','')::bigint,
    increase_amount       = nullif(p_occupancy->>'increase_amount','')::bigint,
    billing_day           = p_occupancy->>'billing_day',
    etc_note              = p_occupancy->>'etc_note',
    bill_auth_info        = p_occupancy->>'bill_auth_info',
    cms_member_no         = nullif(p_occupancy->>'cms_member_no',''),
    cms_contract_no       = nullif(p_occupancy->>'cms_contract_no',''),
    phones_extra          = coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(p_occupancy->'phones_extra','[]'::jsonb)) x), '{}'),
    vehicles_extra        = coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(p_occupancy->'vehicles_extra','[]'::jsonb)) x), '{}')
  where id = v_occ_id;

  -- OM2-194: 입주자 상세의 할인유형/금액을 수도 할인(water_discounts)에 동기화한다.
  -- recipient/multichild/etc(→other) + 금액>0 이면 upsert 해 수도 공과금에 정액 할인이 자동 적용된다.
  -- '일반'/미지정 저장은 수도공과금 할인 모달에서 설정한 값을 지우지 않도록 삭제하지 않는다(비파괴적).
  v_disc_type := nullif(p_occupancy->>'discount_type','');
  v_disc_amount := nullif(p_occupancy->>'discount_amount','')::bigint;
  if v_disc_type in ('recipient','multichild','etc') and coalesce(v_disc_amount,0) > 0 then
    insert into water_discounts(unit_id, discount_type, amount)
    values (v_unit_id, case when v_disc_type = 'etc' then 'other' else v_disc_type end, v_disc_amount)
    on conflict (unit_id) do update
      set discount_type = excluded.discount_type,
          amount = excluded.amount,
          updated_at = now();
  end if;

  -- 확장 lease 컬럼(코어는 base 5필드만 upsert) — lease row가 있을 때만
  if p_lease is not null and p_lease <> 'null'::jsonb then
    update lease_contracts set
      lease_type     = nullif(p_lease->>'lease_type',''),
      deposit_date   = nullif(p_lease->>'deposit_date','')::date,
      jeonse_deposit = nullif(p_lease->>'jeonse_deposit','')::bigint,
      bank_account   = p_lease->>'bank_account'
    where occupancy_id = v_occ_id;
  end if;

  -- 부동산(매물)·시설 upsert
  if p_property is not null and p_property <> 'null'::jsonb then
    insert into unit_property_listings(
      unit_id, property_name, address, address_detail, property_type, deal_type, rent_type,
      area_m2, deposit, jeonse_deposit, monthly_rent, mgmt_fee_desc, available_date, location, facilities)
    values (
      v_unit_id, p_property->>'property_name', p_property->>'address', p_property->>'address_detail',
      p_property->>'property_type', p_property->>'deal_type', p_property->>'rent_type',
      nullif(p_property->>'area_m2','')::numeric, nullif(p_property->>'deposit','')::bigint,
      nullif(p_property->>'jeonse_deposit','')::bigint, nullif(p_property->>'monthly_rent','')::bigint,
      p_property->>'mgmt_fee_desc', nullif(p_property->>'available_date','')::date, p_property->>'location',
      coalesce(p_property->'facilities','[]'::jsonb))
    on conflict (unit_id) do update set
      property_name = excluded.property_name, address = excluded.address, address_detail = excluded.address_detail,
      property_type = excluded.property_type, deal_type = excluded.deal_type, rent_type = excluded.rent_type,
      area_m2 = excluded.area_m2, deposit = excluded.deposit, jeonse_deposit = excluded.jeonse_deposit,
      monthly_rent = excluded.monthly_rent, mgmt_fee_desc = excluded.mgmt_fee_desc,
      available_date = excluded.available_date, location = excluded.location, facilities = excluded.facilities,
      deleted_at = null;
  end if;

  return v_result;
end $function$;

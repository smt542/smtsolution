-- 이사정산 삭제: 「중도퇴실」 건도 삭제할 수 있게 한다(사용자 결정 2026-10-11).
--
-- 지금까지는 RLS(ms_delete_draft)가 작성중·저장(draft/saved)만 지울 수 있게 했다. 중도퇴실 건은 입주자 정보에
-- 부수 효과를 남겼으므로(mid_moveout_settlement: 적요에 '중도퇴실' 덧붙임 · 알림톡 수신 동의 · 고지서 출력 N)
-- 테이블 직접 삭제가 아니라 이 RPC 로 지운다.
--   · draft/saved   : 그대로 삭제
--   · mid_moveout   : 적요에 덧붙였던 '중도퇴실'을 걷어 낸 뒤 삭제. 알림톡 수신 동의·고지서 출력은 이전 값을
--                     기록해 두지 않아 되돌리지 않는다(필요하면 입주자 상세에서 고친다).
--   · completed     : 삭제 불가(공실 처리·전출 이력이 이미 반영됨)
-- 체크리스트 결과·정산 공유 토큰은 FK on delete cascade 로 함께 지워진다. 감사 로그 MOVING_SETTLEMENT_DELETE.

create or replace function public.delete_moving_settlement(p_settlement_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_row moving_settlements%rowtype;
  v_note text;
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
  if v_row.status = 'completed' then
    raise exception '퇴실완료된 이사정산은 삭제할 수 없습니다.' using errcode = '55000';
  end if;
  if v_row.status not in ('draft', 'saved', 'mid_moveout') then
    raise exception '삭제할 수 없는 이사정산 상태입니다: %', v_row.status using errcode = '55000';
  end if;

  if v_row.status = 'mid_moveout' and v_row.occupancy_id is not null then
    -- mid_moveout_settlement 가 concat_ws(' · ', 기존, '중도퇴실') 로 덧붙인 토큰만 걷어 낸다.
    select o.billing_note into v_note
      from occupancies o
     where o.id = v_row.occupancy_id and o.unit_id = v_row.unit_id
     for update of o;
    if found and v_note is not null then
      v_note := nullif(btrim(regexp_replace(
        regexp_replace(v_note, '(^|\s·\s)중도퇴실(?=$|\s·\s)', '\1', 'g'),
        '(^\s·\s)|(\s·\s$)|(\s·\s)(?=\s·\s)', '', 'g')), '');
      update occupancies set billing_note = v_note
       where id = v_row.occupancy_id and unit_id = v_row.unit_id;
    end if;
  end if;

  delete from moving_settlements where id = p_settlement_id;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, before)
    values (v_org, auth.uid(), 'MOVING_SETTLEMENT_DELETE', 'moving_settlements', p_settlement_id::text,
      jsonb_build_object('unit_id', v_row.unit_id, 'occupancy_id', v_row.occupancy_id,
                         'status', v_row.status, 'move_out_date', v_row.move_out_date,
                         'settlement_amount', v_row.settlement_amount));

  return jsonb_build_object('ok', true, 'status', v_row.status);
end $function$;

revoke all on function public.delete_moving_settlement(bigint) from public, anon;
grant execute on function public.delete_moving_settlement(bigint) to authenticated;

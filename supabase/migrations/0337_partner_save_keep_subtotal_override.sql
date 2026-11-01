-- 0337 (QA #49 후속): partner 재저장이 사무실의 소계 수기 수정(extra.subtotalOverride, 0336)을 지우지 않게 한다.
--  partner_save_moving_settlement 는 extra 를 통째로 교체하므로, 기존 행의 subtotalOverride 를 읽어
--  ① 저장 extra 에 다시 병합하고 ② 미납 스냅샷(unpaid_amount)·반환 정산액·수납액 초과 검사도 override 기준으로 계산한다.
--  partner 화면에서는 override 를 편집하지 않는다(사무실 전용). 라이브 정의를 치환한다.
begin;

do $do$
declare
  v_def text;
  v_new text;
  r record;
begin
  v_def := pg_get_functiondef('public.partner_save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb)'::regprocedure);
  v_new := v_def;
  for r in select * from (values
    ($q$  v_extra jsonb;
begin$q$,
     $q$  v_extra jsonb;
  v_ovr jsonb;
begin$q$),
    ($q$  v_unpaid := settlement_billing_unpaid(p_unit_id, p_occupancy_id, nullif(p_data->>'move_out_date','')::date)::integer;
  v_amount := calculate_moving_settlement_amount(p_data) + v_unpaid;$q$,
     $q$  -- 0337: 사무실에서 고친 소계(extra.subtotalOverride)는 partner 재저장에도 유지한다.
  if v_settlement_id is not null then
    select s.extra -> 'subtotalOverride' into v_ovr
      from moving_settlements s
     where s.id = v_settlement_id and s.unit_id = p_unit_id
       and jsonb_typeof(s.extra -> 'subtotalOverride') = 'object';
  end if;
  v_unpaid := coalesce(
    settlement_subtotal_override(jsonb_build_object('subtotalOverride', v_ovr), 'unpaid'),
    settlement_billing_unpaid(p_unit_id, p_occupancy_id, nullif(p_data->>'move_out_date','')::date)::integer
  );
  v_amount := calculate_moving_settlement_amount(
    p_data || jsonb_build_object(
      'extra',
      case when jsonb_typeof(p_data->'extra') = 'object' then p_data->'extra' else '{}'::jsonb end
        || jsonb_build_object('subtotalOverride', v_ovr)
    )
  ) + v_unpaid;$q$),
    ($q$      extra = v_extra,$q$,
     $q$      extra = case when v_ovr is null then v_extra
                   else coalesce(v_extra, '{}'::jsonb) || jsonb_build_object('subtotalOverride', v_ovr) end,$q$)
  ) t(o, n)
  loop
    if position(r.o in v_new) = 0 then raise exception 'partner save patch target not found: %', left(r.o, 60); end if;
    if position(r.o in substr(v_new, position(r.o in v_new) + 1)) > 0 then raise exception 'partner save patch target not unique: %', left(r.o, 60); end if;
    v_new := replace(v_new, r.o, r.n);
  end loop;
  execute v_new;
end $do$;

commit;

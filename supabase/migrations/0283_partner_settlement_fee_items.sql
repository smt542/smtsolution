-- 파트너 이사정산: 관리비 항목·퇴실월 부과액 조회.
--
-- 파트너 화면은 관리비 항목을 코드 고정 5개(부과액 0)로 그려, 실제 부과액이 반영되지 않았다.
-- 사무실 이사정산(useManagementFeeRows)과 같은 원천을 쓴다:
--   항목 = 건물 유형의 관리비 항목(필수 공과금 항목 제외 — 공과금은 이사 검침으로 따로 정산),
--   부과액 = 그 세대의 퇴실월 fee_item_charges(charged) 금액, 일할·반올림 = 항목 설정.
-- 권한: partner_get_settlement_context 와 같이 담당 건물 세대만.

create or replace function public.partner_get_settlement_fee_items(
  p_unit_id bigint,
  p_period date
)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_type_id bigint;
begin
  select b.org_id, b.type_id into v_org, v_type_id
    from units u
    join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null
      and b.id in (select partner_my_building_ids());
  if v_org is null then raise exception 'unit not assigned to caller'; end if;
  if p_period is not null and p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'fee_item_id', fi.id,
        'name', fi.name,
        'daily', fi.daily_proration,
        'rounding', fi.rounding,
        'charged', coalesce(fic.amount, 0)
      ) order by fi.sort_order, fi.id
    )
    from fee_items fi
    left join fee_item_charges fic
      on fic.fee_item_id = fi.id and fic.unit_id = p_unit_id
     and fic.period = p_period and fic.charged
    where fi.org_id = v_org and fi.type_id = v_type_id
      and fi.deleted_at is null and not fi.is_required
  ), '[]'::jsonb);
end $function$;

revoke all on function public.partner_get_settlement_fee_items(bigint, date) from public, anon;
grant execute on function public.partner_get_settlement_fee_items(bigint, date) to authenticated, service_role;

-- 0214_partner_meter_cards.sql
-- 현장 앱 검침 자료(정본 partner/mobile-meter) 세대 카드에 필요한 읽기 전용 값.
--   입주일·연락처(마스킹)·적요·지난 3개월 사용량·미납 원금.
-- 지침 조회·저장(0072 partner_list_meter_readings / partner_save_meter_readings)은 그대로 둔다.
--
-- 입주자 = 지금 입주 중(occupied)인 세대. 0072와 같은 기준이다.
-- 적요 = 그 달 meter_readings.note. 사무실 공과금 화면에서 수도·전기·가스별로 적는다.
-- 사용량 이력 = 공과금별 [1개월 전, 2개월 전, 3개월 전] meter_readings.usage.
-- 미납 = 사무실 미납관리(list_overdue_periods, 0183)와 같은 식:
--   부과확정 고지서 중 p_period 이하 달의 (확정액 - 유효 수납) > 0,
--   납기일 = billing_period_settings.due_date, 없으면 그 달 말일.
--   연체료(요율표·납기후 가산)는 화면에서 lib/billing/lateFee.ts로 계산한다.

create or replace function partner_list_meter_cards(p_building_id bigint, p_period date)
returns table (
  unit_id bigint,
  occupancy_id bigint,
  move_in_date date,
  phone text,
  notes jsonb,
  usage_history jsonb,
  overdue_periods jsonb
)
language sql stable security definer set search_path = public as $$
  with u as (
    select un.id, o.id as occupancy_id, o.move_in_date, o.phone
    from units un
    left join occupancies o
      on o.unit_id = un.id and o.deleted_at is null and o.status = 'occupied'
    where un.building_id = p_building_id and un.deleted_at is null
      and un.building_id in (select partner_my_building_ids())
  )
  select
    u.id,
    u.occupancy_id,
    u.move_in_date,
    public.mask_phone(u.phone),
    coalesce((
      select jsonb_object_agg(mr.utility, btrim(mr.note))
      from meter_readings mr
      where mr.unit_id = u.id
        and mr.period = p_period
        and nullif(btrim(mr.note), '') is not null
    ), '{}'::jsonb),
    (
      select jsonb_object_agg(k.utility, (
        select jsonb_agg(h.usage order by h.back)
        from (
          select b.back, (
            select mr.usage
            from meter_readings mr
            where mr.unit_id = u.id
              and mr.utility = k.utility
              and mr.period = (p_period - make_interval(months => b.back))::date
          ) as usage
          from generate_series(1, 3) as b(back)
        ) h
      ))
      from (values ('water'), ('elec'), ('gas')) as k(utility)
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object(
          'period', pb.period,
          'unpaid_principal', pb.outstanding,
          'due_date', coalesce(
            bps.due_date,
            (date_trunc('month', pb.period) + interval '1 month' - interval '1 day')::date
          )
        ) order by pb.period)
      from (
        select
          bc.period,
          greatest(bc.total_amount::bigint - coalesce(sum(p.amount), 0)::bigint, 0::bigint) as outstanding
        from billing_confirmations bc
        left join payments p
          on p.occupancy_id = bc.occupancy_id
         and p.unit_id = bc.unit_id
         and p.period = bc.period
         and p.status = 'active'
        where bc.occupancy_id = u.occupancy_id
          and bc.unit_id = u.id
          and bc.confirmed_at is not null
          and bc.period <= p_period
        group by bc.period, bc.total_amount
      ) pb
      left join billing_period_settings bps
        on bps.building_id = p_building_id
       and bps.period = pb.period
      where pb.outstanding > 0
    ), '[]'::jsonb)
  from u
  order by u.id;
$$;

revoke execute on function partner_list_meter_cards(bigint, date) from public, anon;
grant execute on function partner_list_meter_cards(bigint, date) to authenticated;

notify pgrst, 'reload schema';

-- 단수(斷水) 예고 기본값: 端數 출력 플래그(single_print) 대신 연속 미납 개월 수로 자동 판정한다.
-- 정책: 계산규칙 4절 "2개월 이상 연체 시 3개월째 고지서에 단전·단수 예고 인쇄(개월수 임계는 setup에서 변경)".
-- 사용자가 발행 때 바꾼 값(paper.water_cutoff)이 계속 우선한다. 시그니처·다른 컬럼은 그대로.
begin;

create or replace function public.list_bill_targets(p_building_id bigint, p_period date)
 returns table(unit_id bigint, unit_no text, dong text, occupancy_id bigint, tenant_name text, phone text, phone2 text, fax_number text, total_amount integer, auto_debit boolean, issue_type text, due_date date, send_status text, issued_at timestamp with time zone, single_print boolean, water_cutoff boolean, scheduled_at timestamp with time zone, message_schedule_id bigint, kakao_send_status text, fax_send_status text, transfer_method text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    u.id, u.unit_no, u.dong, bc.occupancy_id,
    o.tenant_name, o.phone, o.phone2, o.fax_number,
    bc.total_amount,
    exists (
      select 1 from unit_accounts ua
      where ua.unit_id = u.id and ua.kind = 'mgmt' and nullif(ua.cms_member_no, '') is not null
    ) as auto_debit,
    latest.issue_type, latest.due_date,
    kakao.send_status, latest.issued_at,
    coalesce(o.single_print, false),
    coalesce(
      paper.water_cutoff,
      -- 자동판정: setup 에서 사용 + 임계 개월 지정 시, 직전 (임계-1)개월이 모두 부과확정 후 미납이면 임계 도달
      (
        sc.print_utility_cutoff is true
        and sc.cutoff_months is not null
        and not exists (
          select 1
          from generate_series(1, sc.cutoff_months - 1) k
          where not exists (
            select 1
            from billing_confirmations pbc
            where pbc.unit_id = u.id
              and pbc.period = (p_period - make_interval(months => k))::date
              and pbc.confirmed_at is not null
              and pbc.total_amount - coalesce((
                select sum(pay.amount)
                from payments pay
                where pay.unit_id = u.id and pay.period = pbc.period and pay.status = 'active'
              ), 0) > 0
          )
        )
      ),
      false
    ),
    kakao.scheduled_at, kakao.message_schedule_id,
    kakao.send_status, fax.send_status,
    coalesce(o.transfer_method, 'none')
  from billing_confirmations bc
  join units u on u.id = bc.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.id = p_building_id and b.org_id = current_user_org()
  left join setup_config sc on sc.org_id = b.org_id
  left join occupancies o on o.id = bc.occupancy_id
  left join lateral (
    select x.issue_type, x.due_date, x.issued_at
    from bill_issues x
    where x.unit_id = u.id and x.period = p_period
    order by x.issued_at desc, x.id desc limit 1
  ) latest on true
  left join lateral (
    select x.water_cutoff
    from bill_issues x
    where x.unit_id = u.id and x.period = p_period and x.issue_type in ('a4', 'giro')
    order by x.issued_at desc, x.id desc limit 1
  ) paper on true
  left join lateral (
    select x.send_status, x.scheduled_at, x.message_schedule_id
    from bill_issues x
    where x.unit_id = u.id and x.period = p_period and x.issue_type = 'kakao'
    order by x.issued_at desc, x.id desc limit 1
  ) kakao on true
  left join lateral (
    select x.send_status
    from bill_issues x
    where x.unit_id = u.id and x.period = p_period and x.issue_type = 'fax'
    order by x.issued_at desc, x.id desc limit 1
  ) fax on true
  where bc.period = p_period and bc.confirmed_at is not null
  order by u.unit_no
$function$;

commit;

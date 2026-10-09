-- 0268: 개선3차 항목 8 보정 — 이사정산 ③ 미납 = 퇴실 세대(occupancy)의 미납관리비 + 연체료
--  정책 `부과·정산 계산 규칙` 6절 ③ "미납 합산 = 미납관리비 + 미납액(연체료 포함)".
--  - 범위: 정산의 occupancy 로 부과된 확정 부과분만(bc.occupancy_id = 정산 occupancy, 수납도 같은 occupancy 귀속).
--          이전 입주자의 미납이 퇴실 세입자에게 붙지 않는다.
--  - 연체료: 고지서·세입자 앱과 같은 당월 식을 재사용한다 — bill_document_extras(unit, period).late_fee
--          = 미납 × 누적요율(bill_issues 최신 납기 → 현재 KST 월) × late_fee_factor(org, occupancy) (0262/0264).
--  - settlement_billing_unpaid(unit, occupancy) = Σ period [ max(0, 부과액 − 유효수납) + 연체료 ].
--    moving_settlements.unpaid_amount 는 이 값(③ 전체, 연체료 포함)의 저장 시점 스냅샷이다.
--  - 호출부(save_moving_settlement · partner_save_moving_settlement · get_settlement_context)는 실DB 정의(0266)에서
--    해당 호출 구문만 치환한다. 치환 대상이 없으면 예외.

create or replace function public.settlement_billing_unpaid(p_unit_id bigint, p_occupancy_id bigint)
returns bigint
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(sum(x.principal + x.late_fee), 0)::bigint
    from (
      select
        greatest(0, bc.total_amount - coalesce(sum(p.amount) filter (where p.status = 'active'), 0))::bigint as principal,
        coalesce((select ex.late_fee from bill_document_extras(bc.unit_id, bc.period) ex limit 1), 0)::bigint as late_fee
      from billing_confirmations bc
      left join payments p
        on p.unit_id = bc.unit_id
       and p.period = bc.period
       and p.occupancy_id = bc.occupancy_id
      where bc.unit_id = p_unit_id
        and bc.occupancy_id = p_occupancy_id
        and bc.confirmed_at is not null
      group by bc.id, bc.unit_id, bc.period, bc.total_amount
    ) x
$function$;
revoke all on function public.settlement_billing_unpaid(bigint, bigint) from public, anon, authenticated;
comment on function public.settlement_billing_unpaid(bigint, bigint) is
  '이사정산 ③ 미납 = 정산 occupancy 의 확정 부과 미납관리비 + 연체료(bill_document_extras 당월 식). settlement_amount 의 ③.';

do $$
declare
  v_def text;
  v_new text;
begin
  -- staff 저장
  v_def := pg_get_functiondef('public.save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb)'::regprocedure);
  v_new := replace(v_def,
    'v_unpaid := settlement_billing_unpaid(p_unit_id)::integer;',
    'v_unpaid := settlement_billing_unpaid(p_unit_id, p_occupancy_id)::integer;');
  if v_new = v_def then raise exception '0268: save_moving_settlement 치환 대상 없음'; end if;
  execute v_new;

  -- partner 저장
  v_def := pg_get_functiondef('public.partner_save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb)'::regprocedure);
  v_new := replace(v_def,
    'v_unpaid := settlement_billing_unpaid(p_unit_id)::integer;',
    'v_unpaid := settlement_billing_unpaid(p_unit_id, p_occupancy_id)::integer;');
  if v_new = v_def then raise exception '0268: partner_save_moving_settlement 치환 대상 없음'; end if;
  execute v_new;

  -- 화면 컨텍스트: 열린 정산의 occupancy(없으면 현재 입주 occupancy) 기준
  v_def := pg_get_functiondef('public.get_settlement_context(bigint,bigint)'::regprocedure);
  v_new := replace(v_def,
    'v_billing_unpaid := settlement_billing_unpaid(p_unit_id);',
    'v_billing_unpaid := settlement_billing_unpaid(p_unit_id, coalesce((v_settlement->>''occupancy_id'')::bigint, (v_occupancy->>''id'')::bigint));');
  if v_new = v_def then raise exception '0268: get_settlement_context 치환 대상 없음'; end if;
  execute v_new;
end $$;

-- 0266 의 unit 단위 1인자 헬퍼는 더 이상 호출하지 않는다(DROP 대신 주석으로 표시 — 파괴적 변경 회피).
comment on function public.settlement_billing_unpaid(bigint) is
  'DEPRECATED(0268): 호출 금지. unit 전체 미납(연체료 제외). settlement_billing_unpaid(unit, occupancy) 를 쓴다.';

-- 백필: 모든 정산의 ③ 스냅샷을 새 정의로 다시 채운다(트리거가 settlement_amount 재계산).
update public.moving_settlements s
   set unpaid_amount = public.settlement_billing_unpaid(s.unit_id, s.occupancy_id)::integer
 where s.unpaid_amount is distinct from public.settlement_billing_unpaid(s.unit_id, s.occupancy_id)::integer;

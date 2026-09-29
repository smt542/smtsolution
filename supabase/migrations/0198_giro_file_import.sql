-- 지로수납처리(e지로 GR15 수납내역 파일) 반영이 서버에서 한 번만 들어가게 한다.
--
-- 1) payments.external_ref: 외부 파일의 거래 식별값. 지로 파일은 'GR15:입금일:거래번호:고객조회번호'
--    (세대 매칭 결과와 무관한 원본 값만 쓴다 — 매칭이 바뀌어도 같은 거래로 본다).
-- 2) source 'giro_file' + 활성 지로 파일 수납의 (org_id, external_ref) 유일 — 같은 파일을 다시 올리거나
--    두 사람이 동시에 반영해도 한 번만 기록된다. giro_file 은 external_ref 가 반드시 있어야 한다(없으면 유일 조건이 무력해진다).
-- 3) record_giro_payments(p_entries jsonb): 줄마다 세대·부과월·금액·수수료·수납일·external_ref 를 받아 한 번에 반영하고
--    줄별 결과(recorded·duplicate·skipped)를 입력 순서대로 돌려준다.
-- 4) record_payment_edit: 수정은 기존 수납을 취소하고 source 를 물려받아 새로 넣으므로 external_ref 도 물려받게 한다
--    (0131 본문 그대로에 세 곳만 바꿈, 인자 구성 동일 — 오버로드 없음).

alter table payments add column if not exists external_ref text;

-- source 에 'giro_file' 추가 (0015 인라인 check 는 이름이 자동 생성이라 정의로 찾아서 지운다)
do $$
declare v_name text;
begin
  select conname into v_name from pg_constraint
   where conrelid = 'public.payments'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%source%bank_excel%';
  if v_name is not null then
    execute format('alter table payments drop constraint %I', v_name);
  end if;
end $$;
alter table payments add constraint payments_source_check
  check (source in ('manual','bank_excel','cms','giro_file'));
alter table payments add constraint payments_giro_file_ref_check
  check (source <> 'giro_file' or external_ref is not null);

create unique index if not exists payments_giro_file_dedup_uidx
  on payments (org_id, external_ref)
  where source = 'giro_file' and status = 'active';

create function record_giro_payments(p_entries jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_item jsonb;
  v_index int := 0;
  v_unit bigint;
  v_period date;
  v_amount int;
  v_fee int;
  v_paid_at date;
  v_ref text;
  v_occ bigint;
  v_id bigint;
  v_recorded int := 0;
  v_duplicate int := 0;
  v_skipped int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'entries must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(p_entries) loop
    v_unit := nullif(v_item->>'unit_id', '')::bigint;
    v_period := nullif(v_item->>'period', '')::date;
    v_amount := nullif(v_item->>'amount', '')::int;
    v_fee := coalesce(nullif(v_item->>'fee', '')::int, 0);
    v_paid_at := nullif(v_item->>'paid_at', '')::date;
    v_ref := nullif(btrim(v_item->>'external_ref'), '');
    v_occ := null;
    v_id := null;

    if v_unit is null
       or v_period is null
       or v_period <> date_trunc('month', v_period)::date
       or coalesce(v_amount, 0) <= 0
       or v_fee < 0
       or v_paid_at is null
       or v_ref is null
       or not exists (
         select 1 from units uu
         join buildings b on b.id = uu.building_id
         where uu.id = v_unit
           and uu.deleted_at is null
           and b.org_id = v_org
           and b.deleted_at is null
       ) then
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('index', v_index, 'external_ref', v_ref, 'status', 'skipped')
      );
      v_index := v_index + 1;
      continue;
    end if;

    select bc.occupancy_id into v_occ
      from billing_confirmations bc
     where bc.unit_id = v_unit and bc.period = v_period;
    if v_occ is null then
      select o.id into v_occ
        from occupancies o
       where o.unit_id = v_unit and o.deleted_at is null
       order by o.created_at desc, o.id desc
       limit 1;
    end if;

    insert into payments(
      org_id, unit_id, period, occupancy_id, amount, fee, method, kind, memo,
      paid_at, source, external_ref, created_by
    ) values (
      v_org, v_unit, v_period, v_occ, v_amount, v_fee, 'giro', 'full', null,
      v_paid_at, 'giro_file', v_ref, auth.uid()
    )
    on conflict (org_id, external_ref)
      where source = 'giro_file' and status = 'active'
    do nothing
    returning id into v_id;

    if v_id is null then
      v_duplicate := v_duplicate + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('index', v_index, 'external_ref', v_ref, 'status', 'duplicate')
      );
    else
      v_recorded := v_recorded + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('index', v_index, 'external_ref', v_ref, 'status', 'recorded')
      );
    end if;
    v_index := v_index + 1;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (
      v_org, auth.uid(), 'PAYMENT_GIRO_IMPORT', 'payments', 'org',
      jsonb_build_object('recorded', v_recorded, 'duplicate', v_duplicate, 'skipped', v_skipped)
    );

  return jsonb_build_object(
    'recorded', v_recorded,
    'duplicate', v_duplicate,
    'skipped', v_skipped,
    'results', v_results
  );
end $$;
revoke execute on function record_giro_payments(jsonb) from public, anon;
grant execute on function record_giro_payments(jsonb) to authenticated;

create or replace function record_payment_edit(
  p_old_payment_id bigint,
  p_unit_id bigint, p_period date, p_amount int,
  p_method text, p_kind text, p_memo text,
  p_paid_at date default null, p_fee int default null, p_source text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_occ bigint; v_id bigint; v_charged int; v_paid int;
        v_old_fee int; v_old_source text; v_old_paid_at date; v_old_ref text;
        v_fee int; v_source text; v_paid_at date;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if not exists (select 1 from units u join buildings b on b.id=u.building_id
                 where u.id=p_unit_id and b.org_id=v_org and u.deleted_at is null) then
    raise exception 'unit not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'amount must be positive'; end if;
  if p_fee is not null and p_fee < 0 then raise exception 'fee must be >= 0'; end if;
  if p_method not in ('cash','transfer','auto_debit','giro','card','other') then raise exception 'invalid method'; end if;
  if p_kind not in ('full','principal','partial') then raise exception 'invalid kind'; end if;
  if p_source is not null and p_source not in ('manual','bank_excel','cms','giro_file') then raise exception 'invalid source'; end if;

  -- 1) 기존 수납 취소 (본인 org·동일 세대·active만) + 원본 provenance 캡처
  update payments p set status='canceled', canceled_at=now(), canceled_by=auth.uid()
   where p.id=p_old_payment_id and p.status='active' and p.org_id=v_org and p.unit_id=p_unit_id
     and exists (select 1 from units u join buildings b on b.id=u.building_id
                 where u.id=p.unit_id and b.org_id=v_org)
   returning p.fee, p.source, p.paid_at, p.external_ref into v_old_fee, v_old_source, v_old_paid_at, v_old_ref;
  if not found then raise exception 'original payment not found or already canceled'; end if;

  -- 미지정 필드는 원본값 승계(은행/지로/CMS 수납 수정 시 fee·source·paid_at 유실 방지).
  v_fee := coalesce(p_fee, v_old_fee, 0);
  v_source := coalesce(p_source, v_old_source, 'manual');
  v_paid_at := coalesce(p_paid_at, v_old_paid_at, current_date);

  -- 2) 새 수납 기록 (같은 트랜잭션 — 실패 시 취소도 롤백)
  --    귀속: 해당 (unit, period) 확정부과 occupancy 우선, 없으면 최근 occupancy 폴백.
  select bc.occupancy_id into v_occ from billing_confirmations bc
   where bc.unit_id=p_unit_id and bc.period=p_period;
  if v_occ is null then
    select o.id into v_occ from occupancies o
     where o.unit_id=p_unit_id and o.deleted_at is null
     order by o.created_at desc, o.id desc limit 1;
  end if;

  insert into payments(org_id, unit_id, period, occupancy_id, amount, fee, method, kind, memo, paid_at, source, external_ref, created_by)
    values (v_org, p_unit_id, p_period, v_occ, p_amount, v_fee, p_method, p_kind, nullif(p_memo,''),
            v_paid_at, v_source, case when v_source = 'giro_file' then v_old_ref else null end, auth.uid())
    returning id into v_id;

  select bc.total_amount into v_charged from billing_confirmations bc
    where bc.unit_id=p_unit_id and bc.period=p_period;
  select coalesce(sum(amount),0)::int into v_paid from payments
    where unit_id=p_unit_id and period=p_period and status='active';

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_EDIT', 'payments', v_id::text,
      jsonb_build_object('old_id',p_old_payment_id,'unit_id',p_unit_id,'period',p_period,
                         'amount',p_amount,'fee',v_fee,'kind',p_kind,'method',p_method,'source',v_source));

  return jsonb_build_object('ok',true,'payment_id',v_id,'canceled_id',p_old_payment_id,
    'charged',v_charged,'paid',v_paid,
    'unpaid', case when v_charged is null then null else v_charged - v_paid end);
end $$;
revoke execute on function record_payment_edit(bigint, bigint, date, int, text, text, text, date, int, text) from public, anon;
grant execute on function record_payment_edit(bigint, bigint, date, int, text, text, text, date, int, text) to authenticated;

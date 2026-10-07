-- 0235: 장기수선비 원장 RPC 권한 키 정정 (문제점 개선1차 #19)
-- 실 DB 정의를 그대로 옮기고 해당 부분만 바꾼다.

-- ============================================================================
-- (1) 장기수선비 원장 RPC의 권한 키를 셋업(`settings`)에서 장기수선비 관리(`long_term_repair`)로 바로잡는다.
-- 권한 매트릭스(policy/01_공통 정책/권한 매트릭스) §2: 「장기수선비 관리」는 「셋업 설정」과 별개의 LNB 항목이며
-- 계정별 권한 칩(`long_term_repair`)으로 부여한다. 지금까지는 칩을 받은 직원은 원장을 열 수 없고,
-- 셋업 권한만 있는 직원이 금전 원장을 수정할 수 있었다.
-- 실 DB 정의를 그대로 옮기고 current_user_has_module 키와 오류 문구만 바꾼다.
-- (적용 시점 기준 org_members 중 settings 보유자는 없음 — 권한 이전 데이터 보정 불필요)

create or replace function public.list_long_term_repair_ledger(p_building_id bigint, p_start_date date, p_end_date date)
 returns table(id bigint, org_id bigint, building_id bigint, entry_date date, entry_no text, fund_note text, deposit bigint, withdrawal bigint, running_balance numeric, memo text, created_at timestamp with time zone, updated_at timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then
    raise exception 'no org for caller';
  end if;
  if not current_user_has_module('long_term_repair') then
    raise exception 'forbidden: long_term_repair required';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'invalid date range';
  end if;
  if not exists (
    select 1 from buildings b
    where b.id = p_building_id and b.org_id = v_org and b.deleted_at is null
  ) then
    raise exception 'building not in org';
  end if;

  return query
  with balanced as (
    select
      l.id,
      l.org_id,
      l.building_id,
      l.entry_date,
      l.entry_no,
      l.fund_note,
      l.deposit,
      l.withdrawal,
      sum(l.deposit - l.withdrawal) over (
        partition by l.building_id
        order by l.entry_date, l.entry_no, l.id
        rows between unbounded preceding and current row
      ) as running_balance,
      l.memo,
      l.created_at,
      l.updated_at
    from long_term_repair_ledger l
    where l.building_id = p_building_id
      and l.org_id = v_org
      and l.deleted_at is null
  )
  select
    b.id,
    b.org_id,
    b.building_id,
    b.entry_date,
    b.entry_no,
    b.fund_note,
    b.deposit,
    b.withdrawal,
    b.running_balance,
    b.memo,
    b.created_at,
    b.updated_at
  from balanced b
  where b.entry_date between p_start_date and p_end_date
  order by b.entry_date, b.entry_no, b.id;
end
$function$;

create or replace function public.get_long_term_repair_ledger_opening_balance(p_building_id bigint, p_start_date date)
 returns numeric
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_balance numeric;
begin
  v_org := current_user_org();
  if v_org is null then
    raise exception 'no org for caller';
  end if;
  if not current_user_has_module('long_term_repair') then
    raise exception 'forbidden: long_term_repair required';
  end if;
  if p_start_date is null then
    raise exception 'start date is required';
  end if;
  if not exists (
    select 1 from buildings b
    where b.id = p_building_id and b.org_id = v_org and b.deleted_at is null
  ) then
    raise exception 'building not in org';
  end if;

  select coalesce(sum(l.deposit - l.withdrawal), 0)
  into v_balance
  from long_term_repair_ledger l
  where l.building_id = p_building_id
    and l.org_id = v_org
    and l.entry_date < p_start_date
    and l.deleted_at is null;
  return v_balance;
end
$function$;

create or replace function public.save_long_term_repair_ledger(p_building_id bigint, p_rows jsonb, p_deleted_ids bigint[] default '{}'::bigint[])
 returns bigint[]
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_item jsonb;
  v_id bigint;
  v_before jsonb;
  v_entry_date date;
  v_entry_no text;
  v_fund_note text;
  v_deposit bigint;
  v_withdrawal bigint;
  v_memo text;
  v_ids bigint[] := '{}'::bigint[];
  v_deleted_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then
    raise exception 'no org for caller';
  end if;
  if not current_user_has_module('long_term_repair') then
    raise exception 'forbidden: long_term_repair required';
  end if;
  if not exists (
    select 1 from buildings b
    where b.id = p_building_id and b.org_id = v_org and b.deleted_at is null
  ) then
    raise exception 'building not in org';
  end if;
  if p_rows is not null and jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_id := nullif(v_item ->> 'id', '')::bigint;
    v_entry_date := (v_item ->> 'entry_date')::date;
    v_entry_no := coalesce(v_item ->> 'entry_no', '');
    v_fund_note := coalesce(v_item ->> 'fund_note', '');
    v_deposit := coalesce((v_item ->> 'deposit')::bigint, 0);
    v_withdrawal := coalesce((v_item ->> 'withdrawal')::bigint, 0);
    v_memo := nullif(v_item ->> 'memo', '');

    if v_entry_date is null then
      raise exception 'entry_date is required';
    end if;
    if v_deposit < 0 or v_withdrawal < 0 then
      raise exception 'amount must be non-negative';
    end if;

    if v_id is null then
      insert into long_term_repair_ledger(
        org_id, building_id, entry_date, entry_no, fund_note, deposit, withdrawal, memo
      ) values (
        v_org, p_building_id, v_entry_date, v_entry_no, v_fund_note,
        v_deposit, v_withdrawal, v_memo
      )
      returning id into v_id;
    else
      select to_jsonb(l) into v_before
      from long_term_repair_ledger l
      where l.id = v_id
        and l.org_id = v_org
        and l.building_id = p_building_id
        and l.deleted_at is null;
      if v_before is null then
        raise exception 'ledger row not found: %', v_id;
      end if;

      update long_term_repair_ledger l
      set entry_date = v_entry_date,
          entry_no = v_entry_no,
          fund_note = v_fund_note,
          deposit = v_deposit,
          withdrawal = v_withdrawal,
          memo = v_memo
      where l.id = v_id
        and row(l.entry_date, l.entry_no, l.fund_note, l.deposit, l.withdrawal, l.memo)
          is distinct from
            row(v_entry_date, v_entry_no, v_fund_note, v_deposit, v_withdrawal, v_memo);
    end if;

    v_ids := v_ids || v_id;
  end loop;

  for v_deleted_id in select unnest(coalesce(p_deleted_ids, '{}'::bigint[])) loop
    update long_term_repair_ledger l
    set deleted_at = now()
    where l.id = v_deleted_id
      and l.org_id = v_org
      and l.building_id = p_building_id
      and l.deleted_at is null;
  end loop;

  return v_ids;
end
$function$;

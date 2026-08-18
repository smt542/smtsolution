-- 장기수선비 입출금 원장
-- 의존: P0(organizations, audit_log, my_org_ids, set_updated_at),
--       P1a(buildings, attachments, attachment_kind), P2a(current_user_org, current_user_has_module)
-- 모듈 게이트: settings (기존 setup 장기수선비와 동일)

-- 장기수선비 원장 첨부를 영수증과 공사사진으로 구분한다.
alter type attachment_kind add value if not exists 'receipt';
alter type attachment_kind add value if not exists 'photo';

create table if not exists long_term_repair_ledger (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  building_id bigint not null references buildings(id) on delete cascade,
  entry_date date not null,
  entry_no text not null default '',
  fund_note text not null default '',
  deposit bigint not null default 0 check (deposit >= 0),
  withdrawal bigint not null default 0 check (withdrawal >= 0),
  memo text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists long_term_repair_ledger_org_building_idx
  on long_term_repair_ledger (org_id, building_id);
create index if not exists long_term_repair_ledger_order_idx
  on long_term_repair_ledger (building_id, entry_date, entry_no, id)
  where deleted_at is null;

drop trigger if exists trg_long_term_repair_ledger_updated on long_term_repair_ledger;
create trigger trg_long_term_repair_ledger_updated
  before update on long_term_repair_ledger
  for each row execute function set_updated_at();

-- 기존 long_term_repair_history와 동일한 조직 격리 패턴을 유지한다.
alter table long_term_repair_ledger enable row level security;
drop policy if exists ltr_ledger_all on long_term_repair_ledger;
create policy ltr_ledger_all on long_term_repair_ledger for all
  using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));

-- RPC뿐 아니라 RLS 직접 쓰기도 기존 감사 원장에 남긴다.
create or replace function audit_long_term_repair_ledger_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (new.org_id, auth.uid(), 'LONG_TERM_REPAIR_LEDGER_CREATE',
            'long_term_repair_ledger', new.id::text, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    v_action := case
      when old.deleted_at is null and new.deleted_at is not null
        then 'LONG_TERM_REPAIR_LEDGER_DELETE'
      else 'LONG_TERM_REPAIR_LEDGER_UPDATE'
    end;
    insert into audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
    values (new.org_id, auth.uid(), v_action, 'long_term_repair_ledger',
            new.id::text, to_jsonb(old), to_jsonb(new));
    return new;
  end if;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, before)
  values (old.org_id, auth.uid(), 'LONG_TERM_REPAIR_LEDGER_DELETE',
          'long_term_repair_ledger', old.id::text, to_jsonb(old));
  return old;
end
$$;

drop trigger if exists trg_long_term_repair_ledger_audit on long_term_repair_ledger;
create trigger trg_long_term_repair_ledger_audit
  after insert or update or delete on long_term_repair_ledger
  for each row execute function audit_long_term_repair_ledger_change();

-- 기간 필터보다 먼저 누적합을 구해 기간 첫 행도 전체 이력 기준 잔액을 반환한다.
create or replace function list_long_term_repair_ledger(
  p_building_id bigint,
  p_start_date date,
  p_end_date date
)
returns table(
  id bigint,
  org_id bigint,
  building_id bigint,
  entry_date date,
  entry_no text,
  fund_note text,
  deposit bigint,
  withdrawal bigint,
  running_balance numeric,
  memo text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then
    raise exception 'no org for caller';
  end if;
  if not current_user_has_module('settings') then
    raise exception 'forbidden: settings required';
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
$$;

-- 조회기간에 행이 없어도 현잔액과 신규 행 누적의 시작점을 정확히 계산한다.
create or replace function get_long_term_repair_ledger_opening_balance(
  p_building_id bigint,
  p_start_date date
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org bigint;
  v_balance numeric;
begin
  v_org := current_user_org();
  if v_org is null then
    raise exception 'no org for caller';
  end if;
  if not current_user_has_module('settings') then
    raise exception 'forbidden: settings required';
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
$$;

-- 화면의 수정/취소/저장 모델에 맞춰 신규·수정·소프트삭제를 한 트랜잭션으로 반영한다.
create or replace function save_long_term_repair_ledger(
  p_building_id bigint,
  p_rows jsonb,
  p_deleted_ids bigint[] default '{}'::bigint[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
begin
  v_org := current_user_org();
  if v_org is null then
    raise exception 'no org for caller';
  end if;
  if not current_user_has_module('settings') then
    raise exception 'forbidden: settings required';
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
      );
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
  end loop;

  for v_id in select unnest(coalesce(p_deleted_ids, '{}'::bigint[])) loop
    update long_term_repair_ledger l
    set deleted_at = now()
    where l.id = v_id
      and l.org_id = v_org
      and l.building_id = p_building_id
      and l.deleted_at is null;
  end loop;
end
$$;

revoke execute on function list_long_term_repair_ledger(bigint, date, date) from public, anon;
grant execute on function list_long_term_repair_ledger(bigint, date, date) to authenticated;
revoke execute on function get_long_term_repair_ledger_opening_balance(bigint, date) from public, anon;
grant execute on function get_long_term_repair_ledger_opening_balance(bigint, date) to authenticated;
revoke execute on function save_long_term_repair_ledger(bigint, jsonb, bigint[]) from public, anon;
grant execute on function save_long_term_repair_ledger(bigint, jsonb, bigint[]) to authenticated;

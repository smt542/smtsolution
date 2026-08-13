-- 0013_p5_bill_publish.sql
-- P5: 고지서 발행 (bill_issues)
-- 의존: P0(profiles·audit_log·set_updated_at), P1a(units), P2a(current_user_org·current_user_has_module·my_org_ids),
--       P3b(occupancies·unit_accounts), P5-billing 0012(billing_confirmations·billing_history)
-- 모듈 게이트: bill_publish

create table bill_issues (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  occupancy_id bigint references occupancies(id) on delete set null,
  issue_type text not null check (issue_type in ('a4','giro','kakao','fax')),
  group_no int not null default 1,
  due_date date,
  unit_label_mode text not null default 'code' check (unit_label_mode in ('code','name')),
  auto_debit boolean not null default false,
  total_amount integer not null default 0,
  send_status text not null default 'none' check (send_status in ('none','sent','failed')),
  issued_at timestamptz not null default now(),
  issued_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, period, issue_type)
);
create index on bill_issues (unit_id, period);

-- updated_at 트리거
create trigger trg_bill_issues_updated before update on bill_issues
  for each row execute function set_updated_at();

-- RLS: SELECT org 개방 / 쓰기 bill_publish 모듈
alter table bill_issues enable row level security;
create policy bi_select on bill_issues for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy bi_write on bill_issues for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('bill_publish'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('bill_publish'));

-- ===== 확정 세대 목록 (화면 테이블 + 발송 수신처) =====
create or replace function list_bill_targets(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, occupancy_id bigint, tenant_name text, phone text,
  total_amount integer, auto_debit boolean,
  issue_type text, due_date date, send_status text, issued_at timestamptz
) language sql stable security definer set search_path = public as $$
  select
    u.id, u.unit_no, u.dong, bc.occupancy_id, o.tenant_name, o.phone,
    bc.total_amount,
    exists (select 1 from unit_accounts ua where ua.unit_id = u.id and ua.kind = 'mgmt' and nullif(ua.cms_member_no,'') is not null) as auto_debit,
    bi.issue_type, bi.due_date, bi.send_status, bi.issued_at
  from billing_confirmations bc
  join units u on u.id = bc.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.id = p_building_id and b.org_id = current_user_org()
  left join occupancies o on o.id = bc.occupancy_id
  left join lateral (
    select x.issue_type, x.due_date, x.send_status, x.issued_at
    from bill_issues x where x.unit_id = u.id and x.period = p_period
    order by x.issued_at desc, x.id desc limit 1
  ) bi on true
  where bc.period = p_period and bc.confirmed_at is not null
  order by u.unit_no
$$;
revoke execute on function list_bill_targets(bigint, date) from public, anon;
grant execute on function list_bill_targets(bigint, date) to authenticated;

-- ===== 선택 세대 A4 렌더 데이터 (확정 스냅샷 + 최신 history items) =====
create or replace function get_bill_documents(p_building_id bigint, p_period date, p_unit_ids jsonb)
returns table(
  unit_id bigint, unit_no text, dong text, tenant_name text,
  total_amount integer, auto_debit boolean, items jsonb, billing_note text, unit_notice text
) language sql stable security definer set search_path = public as $$
  select
    u.id, u.unit_no, u.dong, o.tenant_name,
    bc.total_amount,
    exists (select 1 from unit_accounts ua where ua.unit_id = u.id and ua.kind = 'mgmt' and nullif(ua.cms_member_no,'') is not null) as auto_debit,
    coalesce(bh.items, '[]'::jsonb) as items, bc.billing_note, bc.unit_notice
  from billing_confirmations bc
  join units u on u.id = bc.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.id = p_building_id and b.org_id = current_user_org()
  left join occupancies o on o.id = bc.occupancy_id
  left join lateral (
    select h.items from billing_history h
    where h.unit_id = u.id and h.period = p_period
    order by h.confirmed_at desc, h.id desc limit 1
  ) bh on true
  where bc.period = p_period and bc.confirmed_at is not null
    and bc.unit_id in (select jsonb_array_elements_text(coalesce(p_unit_ids,'[]'::jsonb))::bigint)
  order by u.unit_no
$$;
revoke execute on function get_bill_documents(bigint, date, jsonb) from public, anon;
grant execute on function get_bill_documents(bigint, date, jsonb) to authenticated;

-- ===== 발행 기록 (확정 세대만, upsert) =====
create or replace function issue_bills(
  p_building_id bigint, p_period date, p_unit_ids jsonb,
  p_issue_type text, p_due_date date, p_unit_label_mode text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint; v_unit_id bigint; v_count int := 0;
  v_total int; v_occ_id bigint; v_auto boolean;
  v_mode text := coalesce(p_unit_label_mode, 'code');
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('bill_publish') then raise exception 'forbidden: bill_publish required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_issue_type not in ('a4','giro','kakao','fax') then raise exception 'invalid issue_type'; end if;
  if v_mode not in ('code','name') then raise exception 'invalid unit_label_mode'; end if;

  for v_unit_id in select jsonb_array_elements_text(coalesce(p_unit_ids,'[]'::jsonb))::bigint loop
    select bc.total_amount, bc.occupancy_id into v_total, v_occ_id
    from billing_confirmations bc
    join units u on u.id = bc.unit_id and u.building_id = p_building_id and u.deleted_at is null
    where bc.unit_id = v_unit_id and bc.period = p_period and bc.confirmed_at is not null;
    if not found then raise exception 'unit % not confirmed for period', v_unit_id; end if;

    v_auto := exists (select 1 from unit_accounts ua where ua.unit_id = v_unit_id and ua.kind = 'mgmt' and nullif(ua.cms_member_no,'') is not null);

    insert into bill_issues(unit_id, period, occupancy_id, issue_type, group_no, due_date, unit_label_mode, auto_debit, total_amount, issued_by)
      values (v_unit_id, p_period, v_occ_id, p_issue_type, 1, p_due_date, v_mode, v_auto, coalesce(v_total,0), auth.uid())
      on conflict (unit_id, period, issue_type) do update
        set due_date = excluded.due_date, unit_label_mode = excluded.unit_label_mode,
            auto_debit = excluded.auto_debit, total_amount = excluded.total_amount,
            occupancy_id = excluded.occupancy_id, issued_by = excluded.issued_by, issued_at = now();
    v_count := v_count + 1;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILL_ISSUE', 'bill_issues', p_building_id::text,
      jsonb_build_object('period', p_period, 'issue_type', p_issue_type, 'count', v_count));

  return jsonb_build_object('count', v_count);
end $$;
revoke execute on function issue_bills(bigint, date, jsonb, text, date, text) from public, anon;
grant execute on function issue_bills(bigint, date, jsonb, text, date, text) to authenticated;

-- P5 후속: 고지서 팩스·단수 회차 설정·예약 발송
-- 의존: 0010(message_logs), 0013(bill_issues), 0023(save_unit_occupancy)
-- 0030(message_templates)보다 먼저 실행될 수 있으므로 예약 테이블은 템플릿 FK를 두지 않는다.

alter table occupancies
  add column if not exists fax_number text;

create or replace function clear_occupancy_fax_on_vacancy()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'vacant' then new.fax_number := null; end if;
  return new;
end $$;
drop trigger if exists trg_clear_occupancy_fax_on_vacancy on occupancies;
create trigger trg_clear_occupancy_fax_on_vacancy
  before update of status on occupancies
  for each row execute function clear_occupancy_fax_on_vacancy();

alter table bill_issues
  add column if not exists water_cutoff boolean not null default false,
  add column if not exists scheduled_at timestamptz,
  add column if not exists message_log_id bigint references message_logs(id) on delete set null;

alter table bill_issues drop constraint if exists bill_issues_send_status_check;
alter table bill_issues add constraint bill_issues_send_status_check
  check (send_status in ('none','scheduled','sent','failed'));

-- 공용 발송 모듈의 예약 스텁. 실제 NCP 작업자는 status='scheduled' 레코드를 소비한다.
create table if not exists message_schedules (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('sms','alimtalk','auto')),
  body text not null,
  context text not null default 'manual',
  recipient_count int not null default 0,
  recipients jsonb not null default '[]'::jsonb,
  template_id bigint,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','sent','failed')),
  created_by uuid references profiles(user_id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists message_schedules_org_scheduled_idx
  on message_schedules (org_id, scheduled_at desc);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_message_schedules_updated') then
    create trigger trg_message_schedules_updated before update on message_schedules
      for each row execute function set_updated_at();
  end if;
end $$;

alter table message_schedules enable row level security;
drop policy if exists message_schedules_select on message_schedules;
create policy message_schedules_select on message_schedules for select
  using (org_id in (select my_org_ids()) and current_user_has_module('messaging'));

alter table bill_issues
  add column if not exists message_schedule_id bigint references message_schedules(id) on delete set null;

create or replace function schedule_messages(
  p_channel text,
  p_body text,
  p_context text,
  p_recipients jsonb,
  p_template_id bigint,
  p_scheduled_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_schedule_id bigint;
  v_count int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;
  if p_channel not in ('sms','alimtalk','auto') then
    raise exception 'invalid channel: sms|alimtalk|auto required';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'invalid body: nonempty text required';
  end if;
  if p_channel in ('alimtalk','auto') and p_template_id is null then
    raise exception 'invalid template: template required for alimtalk/auto';
  end if;
  if p_recipients is null or jsonb_typeof(p_recipients) <> 'array'
    or jsonb_array_length(p_recipients) = 0 then
    raise exception 'invalid recipients: nonempty JSON array required';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_recipients) r(recipient)
    where nullif(regexp_replace(r.recipient->>'phone', '[^0-9]', '', 'g'), '') is null
  ) then
    raise exception 'invalid recipients: every recipient phone must contain digits';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_recipients) r(recipient)
    where r.recipient->>'channel' = 'alimtalk'
      and not exists (
        select 1
        from occupancies o
        join units u on u.id = o.unit_id
        join buildings b on b.id = u.building_id and b.org_id = v_org
        where o.id = nullif(r.recipient->'ref'->>'occupancyId', '')::bigint
          and o.deleted_at is null
          and coalesce(o.alimtalk_opt_in, false)
      )
  ) then
    raise exception 'invalid recipients: alimtalk consent required';
  end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'invalid schedule: future time required';
  end if;

  v_count := jsonb_array_length(p_recipients);
  insert into message_schedules(
    org_id, channel, body, context, recipient_count, recipients,
    template_id, scheduled_at, created_by
  ) values (
    v_org, p_channel, p_body, coalesce(p_context, 'manual'), v_count, p_recipients,
    p_template_id, p_scheduled_at, auth.uid()
  ) returning id into v_schedule_id;

  return jsonb_build_object(
    'schedule_id', v_schedule_id,
    'count', v_count,
    'scheduled_at', p_scheduled_at
  );
end $$;
revoke execute on function schedule_messages(text,text,text,jsonb,bigint,timestamptz) from public, anon;
grant execute on function schedule_messages(text,text,text,jsonb,bigint,timestamptz) to authenticated;

create or replace function cancel_scheduled_message(p_schedule_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;

  update message_schedules
    set status = 'cancelled', cancelled_at = now()
    where id = p_schedule_id and org_id = v_org and status = 'scheduled';
  if not found then raise exception 'scheduled message not found or already processed'; end if;

  update bill_issues
    set send_status = 'none', scheduled_at = null, message_schedule_id = null
    where message_schedule_id = p_schedule_id;
end $$;
revoke execute on function cancel_scheduled_message(bigint) from public, anon;
grant execute on function cancel_scheduled_message(bigint) to authenticated;

-- 기존 통합 저장 RPC를 감싸 팩스번호까지 같은 트랜잭션에서 저장한다.
create or replace function save_unit_occupancy_with_fax(
  p_building_id bigint, p_unit_id bigint, p_occupancy_id bigint,
  p_unit jsonb, p_occupancy jsonb, p_meters jsonb, p_accounts jsonb, p_lease jsonb,
  p_fax_number text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_occupancy_id bigint;
begin
  v_result := save_unit_occupancy(
    p_building_id, p_unit_id, p_occupancy_id,
    p_unit, p_occupancy, p_meters, p_accounts, p_lease
  );
  v_occupancy_id := (v_result->>'occupancy_id')::bigint;

  update occupancies o
    set fax_number = nullif(btrim(p_fax_number), '')
    from units u, buildings b
    where o.id = v_occupancy_id
      and u.id = o.unit_id
      and b.id = u.building_id
      and b.id = p_building_id
      and b.org_id = current_user_org();
  if not found then raise exception 'occupancy not in building'; end if;

  return v_result;
end $$;
revoke execute on function save_unit_occupancy_with_fax(bigint,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb,text) from public, anon;
grant execute on function save_unit_occupancy_with_fax(bigint,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb,text) to authenticated;

-- 확정 세대 목록: 주·부번호, 팩스, 단수 회차 override, 예약 식별자를 함께 제공한다.
drop function if exists list_bill_targets(bigint, date);
create function list_bill_targets(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, occupancy_id bigint,
  tenant_name text, phone text, phone2 text, fax_number text,
  total_amount integer, auto_debit boolean,
  issue_type text, due_date date, send_status text, issued_at timestamptz,
  single_print boolean, water_cutoff boolean, scheduled_at timestamptz,
  message_schedule_id bigint, kakao_send_status text, fax_send_status text
) language sql stable security definer set search_path = public as $$
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
    coalesce(paper.water_cutoff, o.single_print, false),
    kakao.scheduled_at, kakao.message_schedule_id,
    kakao.send_status, fax.send_status
  from billing_confirmations bc
  join units u on u.id = bc.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.id = p_building_id and b.org_id = current_user_org()
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
$$;
revoke execute on function list_bill_targets(bigint, date) from public, anon;
grant execute on function list_bill_targets(bigint, date) to authenticated;

-- 종이 고지서 발행: single_print를 기본값으로 쓰되 호출자가 회차별 세대를 명시하면 override한다.
drop function if exists issue_bills(bigint, date, jsonb, text, date, text);
drop function if exists issue_bills(bigint, date, jsonb, text, date, text, jsonb);
create function issue_bills(
  p_building_id bigint, p_period date, p_unit_ids jsonb,
  p_issue_type text, p_due_date date, p_unit_label_mode text,
  p_water_cutoff_unit_ids jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint; v_unit_id bigint; v_count int := 0;
  v_total int; v_occ_id bigint; v_auto boolean; v_water_cutoff boolean;
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

  for v_unit_id in select jsonb_array_elements_text(coalesce(p_unit_ids, '[]'::jsonb))::bigint loop
    select bc.total_amount, bc.occupancy_id into v_total, v_occ_id
    from billing_confirmations bc
    join units u on u.id = bc.unit_id and u.building_id = p_building_id and u.deleted_at is null
    where bc.unit_id = v_unit_id and bc.period = p_period and bc.confirmed_at is not null;
    if not found then raise exception 'unit % not confirmed for period', v_unit_id; end if;

    v_auto := exists (
      select 1 from unit_accounts ua
      where ua.unit_id = v_unit_id and ua.kind = 'mgmt' and nullif(ua.cms_member_no, '') is not null
    );
    if p_water_cutoff_unit_ids is null then
      select coalesce(o.single_print, false) into v_water_cutoff from occupancies o where o.id = v_occ_id;
      v_water_cutoff := coalesce(v_water_cutoff, false);
    else
      v_water_cutoff := exists (
        select 1 from jsonb_array_elements_text(p_water_cutoff_unit_ids) x(value)
        where x.value::bigint = v_unit_id
      );
    end if;

    insert into bill_issues(
      unit_id, period, occupancy_id, issue_type, group_no, due_date,
      unit_label_mode, auto_debit, total_amount, water_cutoff, issued_by
    ) values (
      v_unit_id, p_period, v_occ_id, p_issue_type, 1, p_due_date,
      v_mode, v_auto, coalesce(v_total, 0), v_water_cutoff, auth.uid()
    ) on conflict (unit_id, period, issue_type) do update
      set due_date = excluded.due_date,
          unit_label_mode = excluded.unit_label_mode,
          auto_debit = excluded.auto_debit,
          total_amount = excluded.total_amount,
          occupancy_id = excluded.occupancy_id,
          water_cutoff = excluded.water_cutoff,
          issued_by = excluded.issued_by,
          issued_at = now();
    v_count := v_count + 1;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILL_ISSUE', 'bill_issues', p_building_id::text,
      jsonb_build_object('period', p_period, 'issue_type', p_issue_type, 'count', v_count));

  return jsonb_build_object('count', v_count);
end $$;
revoke execute on function issue_bills(bigint,date,jsonb,text,date,text,jsonb) from public, anon;
grant execute on function issue_bills(bigint,date,jsonb,text,date,text,jsonb) to authenticated;

-- 카톡·팩스 결과를 bill_issues에 반영한다. 팩스 성공은 번호 등록을 서버에서도 검증한다.
create or replace function record_bill_delivery(
  p_building_id bigint, p_period date, p_unit_ids jsonb,
  p_issue_type text, p_send_status text,
  p_message_log_id bigint default null,
  p_message_schedule_id bigint default null,
  p_scheduled_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint; v_unit_id bigint; v_count int := 0;
  v_total int; v_occ_id bigint; v_auto boolean; v_fax text;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('bill_publish') then raise exception 'forbidden: bill_publish required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_issue_type not in ('kakao','fax') then raise exception 'invalid delivery issue_type'; end if;
  if p_send_status not in ('scheduled','sent','failed') then raise exception 'invalid send_status'; end if;
  if p_send_status = 'scheduled' and (p_message_schedule_id is null or p_scheduled_at is null) then
    raise exception 'scheduled delivery requires schedule id and time'; end if;
  if p_message_log_id is not null and not exists (
    select 1 from message_logs ml where ml.id = p_message_log_id and ml.org_id = v_org
  ) then raise exception 'message log not found in org'; end if;
  if p_message_schedule_id is not null and not exists (
    select 1 from message_schedules ms
    where ms.id = p_message_schedule_id and ms.org_id = v_org and ms.status = 'scheduled'
  ) then raise exception 'message schedule not found in org'; end if;

  for v_unit_id in select jsonb_array_elements_text(coalesce(p_unit_ids, '[]'::jsonb))::bigint loop
    select bc.total_amount, bc.occupancy_id, o.fax_number
      into v_total, v_occ_id, v_fax
    from billing_confirmations bc
    join units u on u.id = bc.unit_id and u.building_id = p_building_id and u.deleted_at is null
    left join occupancies o on o.id = bc.occupancy_id
    where bc.unit_id = v_unit_id and bc.period = p_period and bc.confirmed_at is not null;
    if not found then raise exception 'unit % not confirmed for period', v_unit_id; end if;
    if p_issue_type = 'fax' and p_send_status = 'sent' and nullif(btrim(v_fax), '') is null then
      raise exception 'fax number required for unit %', v_unit_id;
    end if;

    v_auto := exists (
      select 1 from unit_accounts ua
      where ua.unit_id = v_unit_id and ua.kind = 'mgmt' and nullif(ua.cms_member_no, '') is not null
    );
    insert into bill_issues(
      unit_id, period, occupancy_id, issue_type, group_no, unit_label_mode,
      auto_debit, total_amount, send_status, scheduled_at,
      message_log_id, message_schedule_id, issued_by
    ) values (
      v_unit_id, p_period, v_occ_id, p_issue_type, 1, 'name',
      v_auto, coalesce(v_total, 0), p_send_status, p_scheduled_at,
      p_message_log_id, p_message_schedule_id, auth.uid()
    ) on conflict (unit_id, period, issue_type) do update
      set occupancy_id = excluded.occupancy_id,
          auto_debit = excluded.auto_debit,
          total_amount = excluded.total_amount,
          send_status = excluded.send_status,
          scheduled_at = excluded.scheduled_at,
          message_log_id = excluded.message_log_id,
          message_schedule_id = excluded.message_schedule_id,
          issued_by = excluded.issued_by,
          issued_at = now();
    v_count := v_count + 1;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILL_DELIVERY', 'bill_issues', p_building_id::text,
      jsonb_build_object(
        'period', p_period, 'issue_type', p_issue_type,
        'send_status', p_send_status, 'count', v_count
      ));

  return jsonb_build_object('count', v_count);
end $$;
revoke execute on function record_bill_delivery(bigint,date,jsonb,text,text,bigint,bigint,timestamptz) from public, anon;
grant execute on function record_bill_delivery(bigint,date,jsonb,text,text,bigint,bigint,timestamptz) to authenticated;

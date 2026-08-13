-- P4a: 문자·알림 공용 모듈 코어

-- ===== 문자 수신처 조회 보강 =====
-- 0006이 이미 적용된 환경에서도 Composer가 세대별 추가 조회 없이 현재 입주자의
-- 전화번호를 받을 수 있도록 기존 목록 RPC의 반환 계약을 확장한다.
drop function if exists list_tenants(bigint);
create function list_tenants(p_building_id bigint)
returns table(
  unit_id bigint, occupancy_id bigint, unit_no text, tenant_name text, phone text,
  room_type_label text, resident_count int, move_in_date date,
  is_vacant boolean, is_overdue boolean
) language sql stable security definer set search_path = public as $$
  select u.id, o.id, u.unit_no, o.tenant_name, o.phone, rt.label, o.resident_count, o.move_in_date,
    coalesce(o.status = 'vacant', true) as is_vacant,
    false as is_overdue
  from units u
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select * from occupancies oc where oc.unit_id = u.id and oc.deleted_at is null
    order by oc.created_at desc limit 1
  ) o on true
  left join room_types rt on rt.id = o.room_type_id
  where u.building_id = p_building_id and u.deleted_at is null
  order by u.unit_no
$$;
revoke execute on function list_tenants(bigint) from public, anon;
grant execute on function list_tenants(bigint) to authenticated;

-- ===== 발송 이력 =====
create table message_logs (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('sms')),        -- P4b: 'alimtalk' 추가
  body text not null,
  context text not null default 'manual',                   -- 프리셋 컨텍스트('독촉' 등)
  recipient_count int not null default 0,
  recipients jsonb not null default '[]'::jsonb,            -- [{name,phone,unitNo,kind,result}]
  result text not null check (result in ('stub','sent','failed')) default 'stub',
  sent_by uuid references profiles(user_id) on delete set null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on message_logs (org_id, sent_at desc);

-- ===== RLS: 조회만 org에 개방, 쓰기는 definer RPC 전용 =====
alter table message_logs enable row level security;

create policy ml_select on message_logs for select
  using (
    org_id in (select my_org_ids())
    and current_user_has_module('messaging')
  );

-- ===== 발송 RPC(stub) =====
create or replace function send_messages(
  p_channel text,
  p_body text,
  p_context text,
  p_recipients jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_recipients jsonb;
  v_recipient_count int;
  v_log_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;

  if p_channel is distinct from 'sms' then
    raise exception 'invalid channel: sms required';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'invalid body: nonempty text required';
  end if;
  if p_recipients is null or jsonb_typeof(p_recipients) <> 'array' then
    raise exception 'invalid recipients: nonempty JSON array required';
  end if;
  if jsonb_array_length(p_recipients) = 0 then
    raise exception 'invalid recipients: nonempty JSON array required';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_recipients) as r(recipient)
    where jsonb_typeof(r.recipient->'phone') is distinct from 'string'
  ) then
    raise exception 'invalid recipients: every recipient phone must be a string';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_recipients) as r(recipient)
    where regexp_replace(r.recipient->>'phone', '[^0-9]', '', 'g') = ''
  ) then
    raise exception 'invalid recipients: every recipient phone must contain digits';
  end if;
  if exists (
    select 1
    from (
      select regexp_replace(r.recipient->>'phone', '[^0-9]', '', 'g') as normalized_phone
      from jsonb_array_elements(p_recipients) as r(recipient)
    ) as phones
    group by phones.normalized_phone
    having count(*) > 1
  ) then
    raise exception 'invalid recipients: duplicate normalized phone';
  end if;

  v_recipient_count := jsonb_array_length(p_recipients);
  select coalesce(
    jsonb_agg(r.recipient || jsonb_build_object('result', 'stub') order by r.ordinality),
    '[]'::jsonb
  )
  into v_recipients
  from jsonb_array_elements(p_recipients)
    with ordinality as r(recipient, ordinality);

  insert into message_logs(
    org_id, channel, body, context, recipient_count, recipients, result, sent_by
  ) values (
    v_org, p_channel, p_body, coalesce(p_context, 'manual'),
    v_recipient_count, v_recipients, 'stub', auth.uid()
  )
  returning id into v_log_id;

  return jsonb_build_object('log_id', v_log_id, 'count', v_recipient_count);
end $$;
revoke execute on function send_messages(text,text,text,jsonb) from public, anon;
grant execute on function send_messages(text,text,text,jsonb) to authenticated;

-- ===== 발송 이력 목록 RPC =====
create or replace function list_message_logs(p_limit int default 50)
returns setof message_logs
language plpgsql stable security definer set search_path = public as $$
begin
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;

  return query select ml.*
  from message_logs ml
  where ml.org_id in (select my_org_ids())
  order by ml.sent_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end
$$;
revoke execute on function list_message_logs(int) from public, anon;
grant execute on function list_message_logs(int) to authenticated;

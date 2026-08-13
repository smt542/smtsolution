-- P4a: 문자·알림 공용 모듈 코어

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
  using (org_id in (select my_org_ids()));

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
revoke execute on function send_messages(text,text,text,jsonb) from anon;

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
  limit p_limit;
end
$$;
revoke execute on function list_message_logs(int) from anon;

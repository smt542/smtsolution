-- P4b: 알림톡 채널 · 메시지 템플릿

-- ===== 템플릿 테이블 (quick_messages 패턴) =====
create table if not exists message_templates (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  title text not null,
  body text not null,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, title)
);
create index if not exists message_templates_org_idx on message_templates (org_id, sort_order);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_message_templates_updated') then
    create trigger trg_message_templates_updated before update on message_templates
      for each row execute function set_updated_at();
  end if;
end $$;

alter table message_templates enable row level security;

drop policy if exists mt_select on message_templates;
create policy mt_select on message_templates for select
  using (org_id in (select my_org_ids()) and current_user_has_module('messaging'));
drop policy if exists mt_insert on message_templates;
create policy mt_insert on message_templates for insert
  with check (org_id in (select my_org_ids()) and current_user_has_module('messaging'));
drop policy if exists mt_update on message_templates;
create policy mt_update on message_templates for update
  using (org_id in (select my_org_ids()) and current_user_has_module('messaging'))
  with check (org_id in (select my_org_ids()) and current_user_has_module('messaging'));

-- ===== message_logs 확장 =====
alter table message_logs add column if not exists template_id bigint references message_templates(id);
alter table message_logs drop constraint if exists message_logs_channel_check;
alter table message_logs add constraint message_logs_channel_check
  check (channel in ('sms','alimtalk','auto'));

-- ===== 동의 조회 RPC =====
create or replace function list_tenant_alimtalk_consent(p_building_id bigint)
returns table(occupancy_id bigint, alimtalk_opt_in boolean, sms_opt_in boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;
  return query
    select o.id, coalesce(o.alimtalk_opt_in,false), coalesce(o.sms_opt_in,false)
    from occupancies o
    join units u on u.id = o.unit_id
    join buildings b on b.id = u.building_id and b.org_id = current_user_org()
    where u.building_id = p_building_id and o.deleted_at is null;
end $$;
revoke execute on function list_tenant_alimtalk_consent(bigint) from public, anon;
grant execute on function list_tenant_alimtalk_consent(bigint) to authenticated;

-- ===== 발송 RPC 확장(stub·자동 라우팅) =====
create or replace function send_messages(
  p_channel text,       -- 요청 모드: 'sms'|'alimtalk'|'auto'
  p_body text,
  p_context text,
  p_recipients jsonb,   -- [{name,phone,unitNo,kind,ref:{occupancyId,...},channel,renderedBody}]
  p_template_id bigint default null
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
  if p_channel not in ('sms','alimtalk','auto') then
    raise exception 'invalid channel: sms|alimtalk|auto required';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'invalid body: nonempty text required';
  end if;
  if p_channel in ('alimtalk','auto') and p_template_id is null then
    raise exception 'invalid template: template required for alimtalk/auto';
  end if;
  if p_template_id is not null and not exists (
    select 1 from message_templates t where t.id = p_template_id and t.org_id = v_org and t.deleted_at is null
  ) then
    raise exception 'invalid template: not found in org';
  end if;
  if p_recipients is null or jsonb_typeof(p_recipients) <> 'array' or jsonb_array_length(p_recipients) = 0 then
    raise exception 'invalid recipients: nonempty JSON array required';
  end if;

  -- 수신처별 채널 서버 재판정(동의 권위). alimtalk 모드의 미동의자는 제외.
  select coalesce(jsonb_agg(x.row order by x.ordinality), '[]'::jsonb), count(*)::int
  into v_recipients, v_recipient_count
  from (
    select r.ordinality,
      (r.recipient
        || jsonb_build_object('channel', c.resolved_channel)
        || jsonb_build_object('result', 'stub')) as row,
      c.resolved_channel
    from jsonb_array_elements(p_recipients) with ordinality as r(recipient, ordinality)
    cross join lateral (
      select case
        when p_channel = 'sms' then 'sms'
        else case when coalesce((
          select o.alimtalk_opt_in from occupancies o
          where o.id = nullif(r.recipient->'ref'->>'occupancyId','')::bigint
            and o.deleted_at is null
        ), false)
          then 'alimtalk'
          else case when p_channel = 'alimtalk' then null else 'sms' end
        end
      end as resolved_channel
    ) c
    where c.resolved_channel is not null   -- alimtalk 모드 미동의자 제외
  ) x;

  if v_recipient_count = 0 then
    raise exception 'no eligible recipients (alimtalk consent required)';
  end if;

  insert into message_logs(
    org_id, channel, body, context, recipient_count, recipients, result, sent_by, template_id
  ) values (
    v_org, p_channel, p_body, coalesce(p_context, 'manual'),
    v_recipient_count, v_recipients, 'stub', auth.uid(), p_template_id
  ) returning id into v_log_id;

  return jsonb_build_object('log_id', v_log_id, 'count', v_recipient_count);
end $$;
revoke execute on function send_messages(text,text,text,jsonb,bigint) from public, anon;
grant execute on function send_messages(text,text,text,jsonb,bigint) to authenticated;

drop function if exists send_messages(text,text,text,jsonb);

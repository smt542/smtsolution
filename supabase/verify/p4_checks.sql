-- P4a 검증 (사용자 PC psql). 실패 시 raise.

do $$ begin
  perform 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'message_logs'
    and table_type = 'BASE TABLE';
  if not found then raise exception 'message_logs missing'; end if;
end $$;

do $$ begin
  perform 1
  from pg_policies
  where schemaname = 'public'
    and tablename = 'message_logs'
    and policyname = 'ml_select'
    and cmd = 'SELECT'
    and coalesce(qual, '') like '%my_org_ids%'
    and coalesce(qual, '') not like '%current_user_has_module%';
  if not found then
    raise exception 'ml_select must allow org-wide SELECT without a module gate';
  end if;
end $$;

do $$ begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'message_logs'
      and cmd <> 'SELECT'
  ) then
    raise exception 'message_logs must not have a write policy';
  end if;
end $$;

do $$
declare
  v_send regprocedure := to_regprocedure('public.send_messages(text,text,text,jsonb)');
  v_list regprocedure := to_regprocedure('public.list_message_logs(integer)');
  v_send_def text;
  v_list_def text;
  v_insert_pos int;
  v_list_query_pos int;
begin
  if v_send is null then
    raise exception 'send_messages missing';
  end if;
  if v_list is null then
    raise exception 'list_message_logs missing';
  end if;

  v_send_def := regexp_replace(lower(pg_get_functiondef(v_send)), '[[:space:]]+', '', 'g');
  v_list_def := regexp_replace(lower(pg_get_functiondef(v_list)), '[[:space:]]+', '', 'g');
  v_insert_pos := position('insertintomessage_logs' in v_send_def);
  v_list_query_pos := position('returnqueryselect' in v_list_def);

  if v_insert_pos = 0 then
    raise exception 'send_messages must insert a message log';
  end if;
  if position('current_user_org()' in v_send_def) = 0
     or position('current_user_org()' in v_send_def) > v_insert_pos then
    raise exception 'send_messages must resolve the caller org before insert';
  end if;
  if position('current_user_has_module(''messaging'')' in v_send_def) = 0
     or position('current_user_has_module(''messaging'')' in v_send_def) > v_insert_pos then
    raise exception 'send_messages must gate by messaging module';
  end if;
  if position('p_channelisdistinctfrom''sms''' in v_send_def) = 0
     or position('p_channelisdistinctfrom''sms''' in v_send_def) > v_insert_pos then
    raise exception 'send_messages must reject non-SMS channels';
  end if;
  if position('btrim(p_body)=''''' in v_send_def) = 0
     or position('btrim(p_body)=''''' in v_send_def) > v_insert_pos then
    raise exception 'send_messages must reject blank bodies';
  end if;
  if position('jsonb_typeof(p_recipients)<>''array''' in v_send_def) = 0
     or position('jsonb_typeof(p_recipients)<>''array''' in v_send_def) > v_insert_pos
     or position('jsonb_array_length(p_recipients)=0' in v_send_def) = 0
     or position('jsonb_array_length(p_recipients)=0' in v_send_def) > v_insert_pos then
    raise exception 'send_messages must require a nonempty recipients array';
  end if;
  if position('jsonb_typeof(r.recipient->''phone'')isdistinctfrom''string''' in v_send_def) = 0
     or position('jsonb_typeof(r.recipient->''phone'')isdistinctfrom''string''' in v_send_def) > v_insert_pos
     or position('regexp_replace(r.recipient->>''phone'',''[^0-9]'','''',''g'')=''''' in v_send_def) = 0
     or position('regexp_replace(r.recipient->>''phone'',''[^0-9]'','''',''g'')=''''' in v_send_def) > v_insert_pos then
    raise exception 'send_messages must validate and normalize recipient phones';
  end if;
  if position('havingcount(*)>1' in v_send_def) = 0
     or position('havingcount(*)>1' in v_send_def) > v_insert_pos then
    raise exception 'send_messages must reject duplicate normalized phones';
  end if;
  if position('jsonb_build_object(''result'',''stub'')' in v_send_def) = 0
     or position('v_recipients,''stub'',auth.uid()' in v_send_def) = 0 then
    raise exception 'send_messages must preserve stub results';
  end if;
  if v_list_query_pos = 0 then
    raise exception 'list_message_logs must return message logs';
  end if;
  if position('current_user_has_module(''messaging'')' in v_list_def) = 0
     or position('current_user_has_module(''messaging'')' in v_list_def) > v_list_query_pos then
    raise exception 'list_message_logs must gate by messaging module';
  end if;
end $$;

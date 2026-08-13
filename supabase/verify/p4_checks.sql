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
    and cmd = 'SELECT';
  if not found then raise exception 'ml_select policy missing'; end if;
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

do $$ begin
  if to_regprocedure('public.send_messages(text,text,text,jsonb)') is null then
    raise exception 'send_messages missing';
  end if;
  if to_regprocedure('public.list_message_logs(integer)') is null then
    raise exception 'list_message_logs missing';
  end if;
end $$;

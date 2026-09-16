-- 0161: 팝빌 승인 알림톡 템플릿을 우리 DB(message_templates)로 동기화하는 RPC.
-- 등록·심사는 팝빌/카카오 콘솔에서만 가능(SDK에 등록 API 없음). 여기서는 승인 템플릿을 upsert만 한다.

create index if not exists message_templates_alimtalk_code_idx
  on message_templates (org_id, alimtalk_template_code)
  where alimtalk_template_code is not null;

-- p_templates: [{ templateCode, name, body, buttons:[{name,type,url}] }]
create or replace function sync_alimtalk_templates(p_templates jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_tpl jsonb;
  v_code text;
  v_name text;
  v_body text;
  v_buttons jsonb;
  v_id bigint;
  v_count int := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;
  if p_templates is null or jsonb_typeof(p_templates) <> 'array' then
    return 0;
  end if;

  for v_tpl in select value from jsonb_array_elements(p_templates) loop
    v_code := nullif(btrim(v_tpl->>'templateCode'), '');
    if v_code is null then continue; end if;
    v_name := coalesce(nullif(btrim(v_tpl->>'name'), ''), v_code);
    v_body := coalesce(v_tpl->>'body', '');
    v_buttons := coalesce(v_tpl->'buttons', '[]'::jsonb);

    -- 1) 코드 일치 행 갱신
    select id into v_id from message_templates
      where org_id = v_org and alimtalk_template_code = v_code and deleted_at is null
      order by id limit 1;
    if v_id is not null then
      update message_templates
        set body = v_body, buttons = v_buttons, channel_type = 'alimtalk'
        where id = v_id;
      -- 제목 갱신은 (org, title) 유니크 충돌이 없을 때만
      update message_templates set title = v_name
        where id = v_id and not exists (
          select 1 from message_templates m
          where m.org_id = v_org and m.title = v_name
            and m.id <> v_id and m.deleted_at is null);
      v_count := v_count + 1;
      continue;
    end if;

    -- 2) 제목이 같은(코드 미부착) 수동 템플릿이 있으면 코드 부착
    select id into v_id from message_templates
      where org_id = v_org and title = v_name and deleted_at is null
      order by id limit 1;
    if v_id is not null then
      update message_templates
        set alimtalk_template_code = v_code, body = v_body,
            buttons = v_buttons, channel_type = 'alimtalk'
        where id = v_id;
      v_count := v_count + 1;
      continue;
    end if;

    -- 3) 신규 삽입
    insert into message_templates
      (org_id, title, body, channel_type, alimtalk_template_code, buttons, sort_order)
      values (v_org, v_name, v_body, 'alimtalk', v_code, v_buttons, 0);
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

revoke execute on function sync_alimtalk_templates(jsonb) from public, anon;
grant execute on function sync_alimtalk_templates(jsonb) to authenticated;

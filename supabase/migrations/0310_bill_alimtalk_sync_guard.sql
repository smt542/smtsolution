-- 카카오 관리비 고지서(알림톡) 후속 — 발송 기록 권한·팝빌 템플릿 동기화·승인 템플릿 잠금 (2026-10-12).
--
-- 1) record_bill_delivery: bill_publish 에 더해 messaging 보유자도 카카오(issue_type='kakao') 발송 기록을 남긴다
--    (문자·알림톡 관리 「관리비 고지서」 탭). 팩스 기록은 bill_publish 전용 그대로. org·건물·부과확정 범위 검사는 그대로.
-- 2) sync_alimtalk_templates(팝빌 승인 템플릿 동기화):
--    (a) 같은 alimtalk_template_code 행이 있으면 title 은 바꾸지 않는다(앱이 제목으로 찾는 템플릿 — 공지·관리비 고지).
--        body·buttons·emphasize_title·channel_type 만 갱신.
--    (b) 팝빌 emphasizeTitle → emphasize_title 저장(제목 일치 행에 코드 부착·신규 삽입 포함).
--    (c) buttons 는 호출부(app/api/messaging/templates)가 넘긴 팝빌 원문 형식({t,n,u1,u2}) 그대로 저장.
-- 3) 승인 템플릿 잠금: alimtalk_template_code 가 있는 행은 화면(authenticated) 직접 수정으로
--    템플릿명·본문·버튼·강조표기·유형·템플릿 코드를 바꿀 수 없다. 팝빌에서 수정 후 동기화(security definer 함수)로만 바뀐다.
--    구분(category)·정렬·삭제 표시는 그대로 수정 가능.

-- 1) record_bill_delivery 권한(DB 현재 정의 기준 치환)
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.record_bill_delivery(bigint,date,jsonb,text,text,bigint,bigint,timestamp with time zone)'::regprocedure
  ) into v_def;
  v_new := replace(
    v_def,
    $r$if not public.current_user_has_module('bill_publish') then raise exception 'forbidden: bill_publish required'; end if;$r$,
    $r$if not (
    public.current_user_has_module('bill_publish')
    or (p_issue_type = 'kakao' and public.current_user_has_module('messaging'))
  ) then raise exception 'forbidden: bill_publish required'; end if;$r$
  );
  if v_new = v_def then
    raise exception 'record_bill_delivery permission pattern not found';
  end if;
  execute v_new;
end $$;

-- 2) 팝빌 승인 템플릿 동기화
create or replace function public.sync_alimtalk_templates(p_templates jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_tpl jsonb;
  v_code text;
  v_name text;
  v_body text;
  v_buttons jsonb;
  v_emphasize text;
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
    v_emphasize := nullif(btrim(coalesce(v_tpl->>'emphasizeTitle', '')), '');

    -- 1) 코드 일치 행 갱신 — 제목(앱 이름)은 유지한다.
    select id into v_id from message_templates
      where org_id = v_org and alimtalk_template_code = v_code and deleted_at is null
      order by id limit 1;
    if v_id is not null then
      update message_templates
        set body = v_body, buttons = v_buttons, emphasize_title = v_emphasize, channel_type = 'alimtalk'
        where id = v_id;
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
            buttons = v_buttons, emphasize_title = v_emphasize, channel_type = 'alimtalk'
        where id = v_id;
      v_count := v_count + 1;
      continue;
    end if;

    -- 3) 신규 삽입
    insert into message_templates
      (org_id, title, body, channel_type, alimtalk_template_code, buttons, emphasize_title, sort_order)
      values (v_org, v_name, v_body, 'alimtalk', v_code, v_buttons, v_emphasize, 0);
    v_count := v_count + 1;
  end loop;

  return v_count;
end $function$;

-- 3) 승인 템플릿 잠금 트리거
create or replace function public.trg_message_templates_lock_approved()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- 화면(세션 역할)의 직접 수정만 막는다. 동기화·기본 템플릿 제공(security definer, 소유자 권한)은 통과한다.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if nullif(btrim(coalesce(old.alimtalk_template_code, '')), '') is null then
    return new;
  end if;
  if new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.buttons is distinct from old.buttons
     or new.emphasize_title is distinct from old.emphasize_title
     or new.channel_type is distinct from old.channel_type
     or new.alimtalk_template_code is distinct from old.alimtalk_template_code then
    raise exception 'APPROVED_TEMPLATE_LOCKED: 팝빌 승인 템플릿은 팝빌에서 수정 후 동기화해 주세요.'
      using errcode = '42501';
  end if;
  return new;
end $function$;

create or replace trigger trg_message_templates_lock_approved
  before update on public.message_templates
  for each row execute function public.trg_message_templates_lock_approved();

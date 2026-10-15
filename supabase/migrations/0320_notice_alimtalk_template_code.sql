-- 공지 알림톡(신규) 템플릿 코드 — 팝빌 승인 템플릿 연결 (2026-10-15).
--
-- 공지 안내(신규)·(중요)·(긴급) 기본 템플릿(0098)은 alimtalk_template_code 가 비어 있어
-- 발송 시 NO_TEMPLATE_CODE 로 전부 실패했다. 팝빌 테스트 계정 ListATSTemplate 조회 결과
-- 공지용 승인 템플릿은 「신규 공지」(026100000523) 하나뿐이다.
-- 1) 「공지 안내(신규)」를 승인 원문(본문·버튼) 그대로 모든 조직에 upsert 한다.
--    본문·버튼이 승인본과 다르면 팝빌이 전송실패 처리한다. 버튼 링크는 #{버튼1}(share/notice/<token>).
-- 2) 신규 조직은 provision_default_alimtalk_templates 가 같은 함수로 넣는다.
-- 「공지 안내(중요)·(긴급)」은 팝빌에 승인 템플릿이 없어 이번에 건드리지 않는다.

create or replace function public.provision_notice_alimtalk_templates(p_org_id bigint)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_count int := 0;
begin
  insert into message_templates
    (org_id, title, body, category, channel_type, alimtalk_template_code, buttons, emphasize_title, sort_order)
  values (
    p_org_id,
    '공지 안내(신규)',
    E'신규 공지사항입니다\n\n#{건물명} 입주자님께 안내드립니다.\n\n■ #{공지제목}:\n새로운 공지사항이 등록되었습니다.\n아래 공지 확인하기 버튼을 눌러 자세한 내용을 확인해 주세요.\n\n※ 본 공지는 입주생활 및 건물관리에 관한 안내사항입니다.',
    'notice',
    'alimtalk',
    '026100000523',
    '[{"t":"WL","n":"공지 확인하기","u1":"https://www.smtsolution.kr/#{버튼1}","u2":"https://www.smtsolution.kr/#{버튼1}"}]'::jsonb,
    null,
    140
  )
  on conflict (org_id, title) do update
    set body = excluded.body,
        category = excluded.category,
        channel_type = excluded.channel_type,
        alimtalk_template_code = excluded.alimtalk_template_code,
        buttons = excluded.buttons,
        emphasize_title = excluded.emphasize_title,
        deleted_at = null,
        updated_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end $function$;

revoke all on function public.provision_notice_alimtalk_templates(bigint) from public, anon, authenticated;

-- 신규 조직 기본 템플릿에 공지(신규) 승인본을 덮어쓴다(DB 현재 정의 기준 치환).
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.provision_default_alimtalk_templates(bigint)'::regprocedure) into v_def;
  if position('provision_notice_alimtalk_templates' in v_def) > 0 then
    return;
  end if;
  v_new := replace(
    v_def,
    E'  v_count := v_count + public.provision_bill_alimtalk_templates(p_org_id);\n',
    E'  v_count := v_count + public.provision_bill_alimtalk_templates(p_org_id);\n  v_count := v_count + public.provision_notice_alimtalk_templates(p_org_id);\n'
  );
  if v_new = v_def then
    raise exception 'provision_default_alimtalk_templates pattern not found';
  end if;
  execute v_new;
end $$;

-- 기존 조직 전체(삭제 안 된)에 upsert.
do $$
declare r record;
begin
  for r in select id from public.organizations where deleted_at is null loop
    perform public.provision_notice_alimtalk_templates(r.id);
  end loop;
end $$;

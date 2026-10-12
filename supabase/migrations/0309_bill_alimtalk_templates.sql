-- 카카오 관리비 고지서(알림톡) 발송 — 승인 템플릿 3종·강조표기·발송 권한 (결정 2026-10-12).
--
-- 1) message_templates.emphasize_title: 알림톡 강조표기 타이틀(강조표기형 템플릿만 값이 있다).
--    /api/messaging/send·예약 발송(reserve_scheduled_message)이 읽어 팝빌 msgs[].emphasizeTitle 로 싣는다.
-- 2) 팝빌 승인 템플릿 3종(테스트 계정 ListATSTemplate 원문 그대로 — 본문·버튼·강조표기가 다르면 팝빌이 전송실패 처리)을
--    모든 조직(삭제 안 된)에 upsert. 앱 제목: 관리비 고지(일반)·관리비 고지(자동이체)·관리비 고지(장기미납).
--    신규 조직은 provision_default_alimtalk_templates(0098, 조직 생성 트리거)가 같은 함수로 넣는다.
--    기존 「관리비 고지서」 행은 건드리지 않는다.
-- 3) staff_sign_bill_urls: bill_publish·overdue(0303)에 더해 messaging 보유자도 호출(문자·알림톡 관리의 고지서 발송).
--    org·건물·부과확정 범위 검사는 그대로.
-- 4) reserve_scheduled_message: 템플릿 강조표기 타이틀(emphasize_title)을 함께 돌려준다(예약 발송 경로).
-- 5) staff_bill_due_dates: 세대별 그 달 납부 마감일(billing_effective_due_date — 발행 고지서 → 건물·월 → 회사 기본 납부일 → 말일).
--    list_bill_targets.due_date 는 최근 발행 고지서 값만 담아(미발행이면 null) 알림톡 변수로 쓸 수 없다.

alter table public.message_templates add column if not exists emphasize_title text;

create or replace function public.provision_bill_alimtalk_templates(p_org_id bigint)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_count int := 0;
begin
  insert into message_templates
    (org_id, title, body, category, channel_type, alimtalk_template_code, buttons, emphasize_title, sort_order)
  select p_org_id, t->>'title', t->>'body', 'bill', 'alimtalk', t->>'code', t->'buttons', t->>'emphasize', (t->>'sort')::int
  from jsonb_array_elements($seed$[
  {
    "title": "관리비 고지(일반)",
    "code": "026100000610",
    "body": "#{건물명} #{호수}호\n관리비가 고지되었습니다.\n\n■ 관리비 기간: #{관리비기간}\n■ 납부 마감일: #{납부마감일}\n■ 고객번호: #{고객번호}\n*계좌이체 시 입금자명에 고객번호 6자리만 입력 바랍니다.\n■ 당월 관리비: #{당월관리비}\n■ 미납 관리비: #{미납관리비}\n■ 총 납부금액: #{총납부금액}\n\n■ 관리실: ☎ #{관리실연락처}\n*카카오고지서 수신 고객님은 종이고지서를 송달하지 않으니 참고하시기 바랍니다.\n\n아래 관리비 상세보기에서 관리비 명세와 납부계좌를 확인해 주세요.",
    "buttons": [
      {
        "t": "WL",
        "n": "관리비 상세보기",
        "u1": "https://smtsolution.kr/share/bill/#{상세경로}",
        "u2": "https://smtsolution.kr/share/bill/#{상세경로}"
      }
    ],
    "emphasize": "관리비 고지 안내",
    "sort": 101
  },
  {
    "title": "관리비 고지(자동이체)",
    "code": "026100000609",
    "body": "#{건물명} #{호수}호\n관리비가 고지되었습니다.\n\n■ 관리비 기간: #{관리비기간}\n■ 출금 예정일: #{출금예정일}\n■ 고객번호: #{고객번호}\n■ 당월 관리비: #{당월관리비}\n■ 미납 관리비: #{미납관리비}\n■ 총 납부금액: #{총납부금액}\n\n■ 관리실: ☎ #{관리실연락처}\n*카카오고지서 수신 고객님은 종이고지서를 송달하지 않으니 참고하시기 바랍니다.\n\n고객님은 자동이체 신청 세대입니다.\n출금예정일 전까지 계좌 잔액을 확인해 주세요.\n\n아래 관리비 상세보기에서 관리비 명세를 확인해 주세요.",
    "buttons": [
      {
        "t": "WL",
        "n": "관리비 상세보기",
        "u1": "https://smtsolution.kr/share/bill/#{상세경로}",
        "u2": "https://smtsolution.kr/share/bill/#{상세경로}"
      }
    ],
    "emphasize": "관리비 자동이체 안내",
    "sort": 102
  },
  {
    "title": "관리비 고지(장기미납)",
    "code": "026100000608",
    "body": "#{건물명} #{호수}호\n관리비가 고지되었습니다.\n\n■ 관리비 기간: #{관리비기간}\n■ 납부 마감일: #{납부마감일}\n■ 고객번호: #{고객번호}\n*계좌이체 시 입금자명에 고객번호 6자리만 입력 바랍니다.\n■ 당월 관리비: #{당월관리비}\n■ 미납 관리비: #{미납관리비}\n■ 총 납부금액: #{총납부금액}\n\n■ 관리실: ☎ #{관리실연락처}\n*카카오고지서 수신 고객님은 종이고지서를 송달하지 않으니 참고하시기 바랍니다.\n\n★★★ 장기미납 안내: 현재 관리비가 2개월 이상 미납되어 있습니다. 이번 납기일까지 미납관리비를 포함한 총 납부금액을 납부해 주시기 바랍니다.\n계속하여 관리비가 미납될 경우 예고 없이 단전·단수될 수 있습니다.\n\n아래 관리비 상세보기에서 관리비 명세와 납부계좌를 확인해 주세요.",
    "buttons": [
      {
        "t": "WL",
        "n": "관리비 상세보기",
        "u1": "https://smtsolution.kr/share/bill/#{상세경로}",
        "u2": "https://smtsolution.kr/share/bill/#{상세경로}"
      }
    ],
    "emphasize": "관리비 고지 안내",
    "sort": 103
  }
]$seed$::jsonb) as seed(t)
  on conflict (org_id, title) do update
    set body = excluded.body,
        category = excluded.category,
        channel_type = excluded.channel_type,
        alimtalk_template_code = excluded.alimtalk_template_code,
        buttons = excluded.buttons,
        emphasize_title = excluded.emphasize_title,
        sort_order = excluded.sort_order,
        updated_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end $function$;

revoke all on function public.provision_bill_alimtalk_templates(bigint) from public, anon, authenticated;

-- 신규 조직 기본 템플릿(0098)에 고지서 알림톡 3종을 더한다(DB 현재 정의 기준 치환).
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.provision_default_alimtalk_templates(bigint)'::regprocedure) into v_def;
  if position('provision_bill_alimtalk_templates' in v_def) > 0 then
    return;
  end if;
  v_new := replace(
    v_def,
    E'  get diagnostics v_count = row_count;\n  return v_count;',
    E'  get diagnostics v_count = row_count;\n  v_count := v_count + public.provision_bill_alimtalk_templates(p_org_id);\n  return v_count;'
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
    perform public.provision_bill_alimtalk_templates(r.id);
  end loop;
end $$;

-- 예약 발송: 강조표기 타이틀을 함께 반환(DB 현재 정의 기준 치환).
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.reserve_scheduled_message(bigint)'::regprocedure) into v_def;
  if position('v_emphasize' in v_def) > 0 then
    return;
  end if;
  v_new := replace(v_def,
    $r$v_tpl_code text := null; v_buttons jsonb := '[]'::jsonb;$r$,
    $r$v_tpl_code text := null; v_buttons jsonb := '[]'::jsonb; v_emphasize text := null;$r$);
  v_new := replace(v_new,
    $r$coalesce(mt.buttons, '[]'::jsonb)$r$,
    $r$coalesce(mt.buttons, '[]'::jsonb), mt.emphasize_title$r$);
  v_new := replace(v_new,
    $r$into v_tpl_code, v_buttons$r$,
    $r$into v_tpl_code, v_buttons, v_emphasize$r$);
  v_new := replace(v_new,
    $r$'alimtalk_template_code', v_tpl_code, 'buttons', v_buttons$r$,
    $r$'alimtalk_template_code', v_tpl_code, 'buttons', v_buttons, 'emphasize_title', v_emphasize$r$);
  -- 선언 1 + into 1 + 반환 2 = 4곳.
  if (length(v_new) - length(replace(v_new, 'v_emphasize', ''))) / length('v_emphasize') <> 4 then
    raise exception 'reserve_scheduled_message pattern mismatch';
  end if;
  execute v_new;
end $$;

-- 고지서 서명 링크: messaging 보유자도 발급(org·건물·부과확정 범위는 그대로).
create or replace function public.staff_sign_bill_urls(p_unit_ids bigint[], p_period date)
returns table(unit_id bigint, building_id bigint, unit_no text, sig text, issued_day integer)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_org bigint;
  v_issued_day integer;
begin
  v_org := public.current_user_org();
  if v_org is null then
    raise exception 'no org' using errcode = '42501';
  end if;
  if not (
    public.current_user_has_module('bill_publish')
    or public.current_user_has_module('overdue')
    or public.current_user_has_module('messaging')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_issued_day := floor(extract(epoch from now()) / 86400)::integer;

  return query
  select
    u.id as unit_id,
    b.id as building_id,
    u.unit_no,
    public.bill_signature(b.id, u.unit_no, p_period, v_issued_day) as sig,
    v_issued_day
  from unnest(p_unit_ids) as requested(unit_id)
  join public.units u
    on u.id = requested.unit_id
   and u.deleted_at is null
  join public.buildings b
    on b.id = u.building_id
   and b.org_id = v_org
  join public.billing_confirmations bc
    on bc.unit_id = u.id
   and bc.period = p_period
   and bc.confirmed_at is not null;
end;
$function$;

-- 세대별 그 달 납부 마감일(고지서 알림톡 「납부마감일」·「출금예정일」). 권한·범위는 staff_sign_bill_urls 와 같다.
create or replace function public.staff_bill_due_dates(p_unit_ids bigint[], p_period date)
returns table(unit_id bigint, due_date date)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_org bigint;
begin
  v_org := public.current_user_org();
  if v_org is null then
    raise exception 'no org' using errcode = '42501';
  end if;
  if not (
    public.current_user_has_module('bill_publish')
    or public.current_user_has_module('overdue')
    or public.current_user_has_module('messaging')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select u.id as unit_id, public.billing_effective_due_date(u.id, p_period) as due_date
  from unnest(p_unit_ids) as requested(unit_id)
  join public.units u
    on u.id = requested.unit_id
   and u.deleted_at is null
  join public.buildings b
    on b.id = u.building_id
   and b.org_id = v_org;
end;
$function$;

revoke all on function public.staff_bill_due_dates(bigint[], date) from public, anon;
grant execute on function public.staff_bill_due_dates(bigint[], date) to authenticated;

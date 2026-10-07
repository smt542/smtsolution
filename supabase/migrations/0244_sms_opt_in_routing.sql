-- 문제점 개선 1차 #8: 문자 수신 거부(sms_opt_in)를 발송 경로에서 지킨다.
-- 즉시 발송(reserve_message_points)·예약 발송(reserve_scheduled_message)·견적(quote_message_points)이
-- 모두 resolve_message_point_quote의 라우팅을 쓰므로 여기 한 곳만 바꾼다.
--  - 세대(tenant): 자동 모드 = 알림톡 동의 → 알림톡, 아니면 문자 동의일 때만 문자, 둘 다 거부면 제외.
--                  문자 모드 = 문자 동의일 때만. 알림톡 모드 = 기존과 같이 알림톡 동의일 때만.
--  - 건물주·직원·업체 등 세대 외 수신처는 수신 동의 설정 대상이 아니므로 기존처럼 문자.
-- 정책(2026-08-14 회의: 입주민 등록 시 문자·알림톡 수신 동의가 기본값)에 맞춰 컬럼 기본값도 동의로 바꾼다.

do $patch$
declare
  v_def text;
  v_old text := E'        when p_mode = ''sms'' then ''sms''\n'
    || E'        when deduplicated.value->>''kind'' in (''owner'', ''staff'', ''vendor'', ''etc'') then ''sms''\n'
    || E'        when coalesce((\n';
  v_new text := E'        when deduplicated.value->>''kind'' in (''owner'', ''staff'', ''vendor'', ''etc'') then ''sms''\n'
    || E'        when p_mode = ''sms'' and deduplicated.value->>''kind'' <> ''tenant'' then ''sms''\n'
    || E'        when p_mode <> ''sms'' and coalesce((\n';
  v_old_tail text := E'        when p_mode = ''alimtalk'' then null\n        else ''sms''\n';
  v_new_tail text := E'        when p_mode = ''alimtalk'' then null\n'
    || E'        -- 세대는 문자 수신 동의(sms_opt_in)일 때만 문자로 보낸다(거부·미설정은 제외).\n'
    || E'        when deduplicated.value->>''kind'' = ''tenant'' and not coalesce((\n'
    || E'          select occupancy.sms_opt_in\n'
    || E'          from public.occupancies occupancy\n'
    || E'          join public.units unit on unit.id = occupancy.unit_id\n'
    || E'          join public.buildings building on building.id = unit.building_id and building.org_id = p_org_id\n'
    || E'          where occupancy.id = case\n'
    || E'            when deduplicated.value->''ref''->>''occupancyId'' ~ ''^[0-9]+$''\n'
    || E'              then (deduplicated.value->''ref''->>''occupancyId'')::bigint else null end\n'
    || E'            and occupancy.deleted_at is null\n'
    || E'        ), false) then null\n'
    || E'        else ''sms''\n';
begin
  v_def := pg_get_functiondef('public.resolve_message_point_quote(bigint,text,jsonb,bigint,text)'::regprocedure);
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'patch target (routing head) not found exactly once';
  end if;
  if (length(v_def) - length(replace(v_def, v_old_tail, ''))) / length(v_old_tail) <> 1 then
    raise exception 'patch target (routing tail) not found exactly once';
  end if;
  v_def := replace(replace(v_def, v_old, v_new), v_old_tail, v_new_tail);
  execute v_def;
end
$patch$;

alter table public.occupancies alter column sms_opt_in set default true;
alter table public.occupancies alter column alimtalk_opt_in set default true;

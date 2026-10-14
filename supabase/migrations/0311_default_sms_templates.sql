-- 0311: 플로팅 메신저 문자(SMS) 기본 템플릿 10종 org별 프로비저닝 (2026-10-14).
-- 원본: previous_lhw/staff/*/Messenger.dc.html TDEFAULTS. 원본 {변수} → 서버 renderTemplate 형식 #{변수}.
-- 변수는 수신자별로 자동 치환한다(components/messenger/MessengerFab): 건물명·호실·입주자명·건물주명·청소담당자명.
-- 제목은 (org_id,title) 유니크라 알림톡 「관리비 미납 안내」와 겹치는 것만 「(문자)」를 붙인다.
create or replace function public.provision_default_sms_templates(p_org_id bigint)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count int := 0;
begin
  insert into message_templates (org_id, title, body, category, channel_type, buttons, sort_order)
  values
    (p_org_id, '입주 환영 안내',
     '#{건물명}의 #{입주자명}님, 입주를 진심으로 환영합니다. 생활 중 궁금하신 점은 관리사무소로 연락 주세요.',
     'recurring', 'sms', '[]'::jsonb, 10),
    (p_org_id, '관리비 납부 안내',
     '#{건물명} #{호실} #{입주자명}님, 이번 달 관리비 납부 기한이 다가왔습니다. 기한 내 납부 부탁드립니다.',
     'recurring', 'sms', '[]'::jsonb, 20),
    (p_org_id, '관리비 미납 안내(문자)',
     '#{건물명} #{호실} #{입주자명}님, 관리비가 미납되어 안내드립니다. 확인 후 납부 부탁드립니다.',
     'recurring', 'sms', '[]'::jsonb, 30),
    (p_org_id, '정기 점검 안내',
     '#{건물명} 입주자님께 안내드립니다. 공용시설 정기 점검이 예정되어 있으니 협조 부탁드립니다.',
     'notice', 'sms', '[]'::jsonb, 40),
    (p_org_id, '건물주 정산 안내',
     '#{건물주명}님, #{건물명} 이번 달 정산 내역을 안내드립니다. 확인 후 회신 부탁드립니다.',
     'recurring', 'sms', '[]'::jsonb, 50),
    (p_org_id, '청소 일정 안내',
     '#{건물명} 입주자님, 이번 주 공용부 청소 일정을 안내드립니다. 확인 부탁드립니다.',
     'notice', 'sms', '[]'::jsonb, 60),
    (p_org_id, '단수 안내',
     '#{건물명} 입주자님, 배관 공사로 단수가 예정되어 있습니다. 이용에 참고 부탁드립니다.',
     'notice', 'sms', '[]'::jsonb, 70),
    (p_org_id, '정전 안내',
     '#{건물명} 입주자님, 전기 설비 점검으로 정전이 예정되어 있습니다. 양해 부탁드립니다.',
     'notice', 'sms', '[]'::jsonb, 80),
    (p_org_id, '택배 도착 안내',
     '#{건물명} #{호실} #{입주자명}님, 택배가 도착하여 관리실에 보관 중입니다. 수령 부탁드립니다.',
     'recurring', 'sms', '[]'::jsonb, 90),
    (p_org_id, '이사 정산 안내',
     '#{건물명} #{호실} #{입주자명}님, 이사 정산 내역을 안내드립니다. 확인 후 정산 부탁드립니다.',
     'recurring', 'sms', '[]'::jsonb, 95)
  on conflict (org_id, title) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.provision_default_sms_templates(bigint) from public, anon, authenticated;

-- 기존 org 백필
do $$ declare r record; begin
  for r in select id from organizations where deleted_at is null loop
    perform public.provision_default_sms_templates(r.id);
  end loop;
end $$;

-- 신규 org 자동 프로비저닝
create or replace function public.trg_provision_sms_templates()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.provision_default_sms_templates(new.id);
  return new;
end $$;
drop trigger if exists trg_org_provision_sms on organizations;
create trigger trg_org_provision_sms
  after insert on organizations for each row
  execute function public.trg_provision_sms_templates();

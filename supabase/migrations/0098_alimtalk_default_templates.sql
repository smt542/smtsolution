-- 0098: 기본 알림톡 템플릿 org별 프로비저닝 (정본: docs/superpowers/specs/2026-08-25-alimtalk-templates-design.md)
-- 의존: 0030(message_templates), 0093(category/channel_type/alimtalk_template_code/buttons)
-- 버튼·승인코드는 Phase 2/4에서 확정(여기서는 buttons='[]', alimtalk_template_code=null).
create or replace function public.provision_default_alimtalk_templates(p_org_id bigint)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count int := 0;
begin
  insert into message_templates (org_id, title, body, category, channel_type, buttons, sort_order)
  values
    (p_org_id, '관리비 고지서',
     E'[#{건물명}] #{청구월} 관리비 고지서\n\n#{세대} 세대의 #{청구월} 관리비가 발행되었습니다.\n\n▶ 청구금액: #{청구금액}원\n▶ 납부기한: #{납기일}\n▶ 납부계좌: #{납부계좌}\n\n자세한 내역은 아래 [고지서 상세보기]에서 확인하실 수 있습니다.\n문의: #{관리사무소연락처}',
     'bill', 'alimtalk', '[]'::jsonb, 100),
    (p_org_id, '관리비 미납 안내',
     E'[#{건물명}] 관리비 미납 안내\n\n#{세대} 세대의 관리비가 미납되어 안내드립니다.\n\n▶ 미납금액: #{미납금액}원\n▶ 대상월: #{미납월}\n▶ 납부기한: #{납기일}\n\n기한 내 납부 부탁드립니다. 이미 납부하셨다면 본 안내는 무시해 주세요.\n문의: #{관리사무소연락처}',
     'overdue', 'alimtalk', '[]'::jsonb, 110),
    (p_org_id, '이사정산 내역서',
     E'[#{건물명}] 이사정산 내역 안내\n\n#{세대} 세대의 퇴실 정산 내역이 확정되었습니다.\n\n▶ 퇴실일: #{퇴실일}\n▶ 정산구분: #{정산구분}\n▶ 정산금액: #{정산금액}원\n\n상세 내역은 아래 [정산내역 보기]에서 확인하실 수 있습니다.\n문의: #{관리사무소연락처}',
     'settlement', 'alimtalk', '[]'::jsonb, 120),
    (p_org_id, '민원·AS 처리 안내',
     E'[#{건물명}] 민원·AS 처리 안내\n\n#{세대} 세대에서 접수하신 건의 처리 상태를 안내드립니다.\n\n▶ 접수내용: #{접수내용}\n▶ 처리상태: #{처리상태}\n▶ 담당자: #{담당자}\n\n문의: #{관리사무소연락처}',
     'complaint', 'alimtalk', '[]'::jsonb, 130),
    (p_org_id, '공지 안내(신규)',
     E'[#{건물명}] 새 공지사항 안내\n\n#{건물명}에 새로운 공지사항이 등록되었습니다.\n\n▶ 제목: #{공지제목}\n\n자세한 내용은 아래 [공지 확인하기]에서 확인해 주세요.\n문의: #{관리사무소연락처}',
     'notice', 'alimtalk', '[]'::jsonb, 140),
    (p_org_id, '공지 안내(중요)',
     E'[#{건물명}] 중요 공지사항 안내\n\n#{건물명}에 중요 공지사항이 등록되었습니다. 확인 부탁드립니다.\n\n▶ 제목: #{공지제목}\n\n자세한 내용은 아래 [공지 확인하기]에서 확인해 주세요.\n문의: #{관리사무소연락처}',
     'notice', 'alimtalk', '[]'::jsonb, 150),
    (p_org_id, '공지 안내(긴급)',
     E'[#{건물명}] 긴급 공지사항 안내\n\n#{건물명}에 긴급 공지사항이 등록되었습니다. 즉시 확인해 주세요.\n\n▶ 제목: #{공지제목}\n\n자세한 내용은 아래 [공지 확인하기]에서 확인해 주세요.\n문의: #{관리사무소연락처}',
     'notice', 'alimtalk', '[]'::jsonb, 160)
  on conflict (org_id, title) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.provision_default_alimtalk_templates(bigint) from public, anon, authenticated;

-- 기존 org 백필
do $$ declare r record; begin
  for r in select id from organizations where deleted_at is null loop
    perform public.provision_default_alimtalk_templates(r.id);
  end loop;
end $$;

-- 신규 org 자동 프로비저닝
create or replace function public.trg_provision_alimtalk_templates()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.provision_default_alimtalk_templates(new.id);
  return new;
end $$;
drop trigger if exists trg_org_provision_alimtalk on organizations;
create trigger trg_org_provision_alimtalk
  after insert on organizations for each row
  execute function public.trg_provision_alimtalk_templates();

-- 0102: 알림톡 기본 템플릿의 수신자별 공개 상세 링크 버튼 확정
-- 상세링크는 발송 컨텍스트에서 공개 토큰을 포함한 전체 URL로 렌더링한다.

update public.message_templates
set buttons = '[{"name":"고지서 상세보기","type":"WL","url":"#{상세링크}"}]'::jsonb
where title in ('관리비 고지서', '관리비 미납 안내');

update public.message_templates
set buttons = '[{"name":"정산내역 보기","type":"WL","url":"#{상세링크}"}]'::jsonb
where title = '이사정산 내역서';

update public.message_templates
set buttons = '[{"name":"공지 확인하기","type":"WL","url":"#{상세링크}"}]'::jsonb
where title in ('공지 안내(신규)', '공지 안내(중요)', '공지 안내(긴급)');

-- 0093_message_template_fields.sql
-- 문자·알림톡 템플릿 필드 확장 (Track E): 유형/구분 · 알림톡 템플릿코드 · 버튼
-- 의존: 0030_p4b_messaging_templates(message_templates). 저장은 직접 insert/update(RLS messaging) — RPC 변경 없음.
alter table message_templates
  add column if not exists category text,
  add column if not exists channel_type text not null default 'sms',   -- 'sms' | 'alimtalk'
  add column if not exists alimtalk_template_code text,
  add column if not exists buttons jsonb not null default '[]'::jsonb;  -- [{name, type, url}]

alter table public.setup_config
  add column if not exists sms_sender text,
  add column if not exists fax_sender text,
  add column if not exists sms_sender_verified_at timestamptz,
  add column if not exists fax_sender_verified_at timestamptz;

comment on column public.setup_config.sms_sender is '조직별 SMS 발신번호(숫자만). NULL이면 운영사 env 기본값 사용';
comment on column public.setup_config.fax_sender is '조직별 팩스 발신번호(숫자만). NULL이면 운영사 env 기본값 사용';

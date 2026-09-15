-- 첨부 원본 메타데이터와 공통 이미지 정책을 저장한다.
-- 기존 행은 메타데이터를 알 수 없으므로 nullable로 유지하고, 신규 업로드부터 기록한다.
alter table public.attachments
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint;

alter table public.attachments
  drop constraint if exists attachments_size_bytes_check;
alter table public.attachments
  add constraint attachments_size_bytes_check
  check (size_bytes is null or (size_bytes >= 0 and size_bytes <= 10485760));

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
where id = 'attachments';

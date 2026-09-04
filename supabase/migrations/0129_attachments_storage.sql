-- 0129_attachments_storage.sql
-- Security: promote the manually-provisioned private 'attachments' bucket and its
-- org-isolation Storage RLS policies into a tracked, reproducible migration. Previously
-- these lived only in supabase/verify/p1a_storage.sql with a manual "create the private
-- bucket first" prerequisite, so a fresh environment (or a recreated bucket) could ship
-- with no policies — or, if created public by mistake, expose every org's receipts / repair
-- photos. Also pins bucket-level content-type/size limits as a server-enforced backstop to
-- the client-side upload validation. Idempotent: safe whether or not the objects already exist.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'attachments',
  'attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- org 경로(첫 폴더 = org_id) 격리: 활성 org 구성원만 자기 org 경로 read/write/update/delete.
drop policy if exists att_read on storage.objects;
create policy att_read on storage.objects for select to authenticated using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::bigint in (select public.my_org_ids()));

drop policy if exists att_write on storage.objects;
create policy att_write on storage.objects for insert to authenticated with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::bigint in (select public.my_org_ids()));

drop policy if exists att_update on storage.objects;
create policy att_update on storage.objects for update to authenticated using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::bigint in (select public.my_org_ids()))
with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::bigint in (select public.my_org_ids()));

drop policy if exists att_delete on storage.objects;
create policy att_delete on storage.objects for delete to authenticated using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::bigint in (select public.my_org_ids()));

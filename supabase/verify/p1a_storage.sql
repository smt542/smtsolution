-- 대시보드: private 버킷 'attachments' 생성 후 실행.
-- org 경로(첫 폴더 = org_id) 격리: 활성 org 구성원만 자기 org 경로 read/write.
create policy att_read on storage.objects for select to authenticated using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::bigint in (select my_org_ids()));
create policy att_write on storage.objects for insert to authenticated with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::bigint in (select my_org_ids()));
create policy att_update on storage.objects for update to authenticated using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::bigint in (select my_org_ids()));
create policy att_delete on storage.objects for delete to authenticated using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::bigint in (select my_org_ids()));

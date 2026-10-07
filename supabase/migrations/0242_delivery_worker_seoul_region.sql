-- 발송 워커 Edge Function을 서울 리전(ap-northeast-2)에서 실행한다.
-- x-region 헤더가 없으면 DB와 가까운 싱가포르에서 실행되고, 팝빌이 그 IP를
-- -10010039(허용되지 않은 IP)로 거절해 결과 재조회·예약 발송이 모두 실패했다.
create or replace function public.invoke_delivery_worker(p_function text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'delivery_cron_secret');
begin
  if p_function not in ('delivery-reconcile', 'dispatch-scheduled') then
    raise exception 'unknown worker %', p_function;
  end if;
  if v_url is null or v_secret is null then return null; end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json',
      'x-region', 'ap-northeast-2'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
end $$;

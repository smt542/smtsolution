-- 0237_delivery_reconcile_cron.sql
-- 문제점 개선1차 #29: 발송 결과 재조회(reconcile)와 예약 발송을 주기적으로 돌리는 곳이 없음.
--
-- 구성(Supabase 단독, 외부 스케줄러 없음):
--   pg_cron(1분) → invoke_delivery_worker('<함수명>') → pg_net HTTP POST
--     → Edge Function (verify_jwt=false, Authorization: Bearer <Vault delivery_cron_secret>)
--        · delivery-reconcile : lib/messaging/reconcile.ts      (팝빌 결과 재조회·최종화)
--        · dispatch-scheduled : lib/messaging/drainSchedules.ts (도래한 예약 발송 접수)
--   Edge Function은 scripts/build-edge-app.mjs가 복사한 앱 코드(supabase/functions/_shared/app)를 그대로 쓴다.
--
-- 비밀값은 SQL·저장소에 평문으로 두지 않고 Supabase Vault에 넣는다(이 마이그레이션 밖에서 1회 등록).
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<랜덤 32바이트 hex>', 'delivery_cron_secret');   -- .env.local CRON_SECRET과 같은 값
--   select vault.create_secret('{"POPBILL_LINK_ID":"…","POPBILL_SECRET_KEY":"…", …}', 'popbill_env');
--     (popbill_env = 서버 .env의 POPBILL_* 전부를 담은 JSON. 운영 전환·발신번호 변경 시 vault.update_secret으로 갱신)
-- reconcile_required 작업은 재조회 대상이 아니다(운영 확인 절차 별도 — 문서 #29-6).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Edge Function이 서비스 롤로 읽는 워커 설정. 다른 역할에는 열지 않는다.
create or replace function public.get_delivery_worker_config()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'cron_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'delivery_cron_secret'),
    'popbill_env', (select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'popbill_env')
  )
$$;

revoke execute on function public.get_delivery_worker_config() from public, anon, authenticated;
grant execute on function public.get_delivery_worker_config() to service_role;

-- 크론이 부르는 호출기. 허용된 워커만, Vault 값이 없으면 아무것도 하지 않는다.
create or replace function public.invoke_delivery_worker(p_function text)
returns bigint
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'delivery_cron_secret');
begin
  if p_function not in ('delivery-reconcile', 'dispatch-scheduled') then
    raise exception 'unknown worker %', p_function;
  end if;
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end
$$;

revoke execute on function public.invoke_delivery_worker(text) from public, anon, authenticated;

-- 1분 주기(재조회 백오프: 접수 후 10분까지 1분 간격 / 예약 발송은 분 단위 예약). 같은 이름이면 갱신된다.
select cron.schedule('delivery-reconcile', '* * * * *', $$select public.invoke_delivery_worker('delivery-reconcile')$$);
select cron.schedule('dispatch-scheduled', '* * * * *', $$select public.invoke_delivery_worker('dispatch-scheduled')$$);

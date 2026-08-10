-- P2b 검증 (사용자 PC에서 psql로 실행). 각 블록은 실패 시 raise.
-- 1) setup_config 컬럼 존재
do $$ begin
  perform 1 from information_schema.columns where table_name='setup_config' and column_name='vacancy_payment_mode';
  if not found then raise exception 'setup_config.vacancy_payment_mode missing'; end if;
end $$;

-- 2) 첫 module-permission RLS: setup_config write 정책이 current_user_has_module 사용
do $$ begin
  perform 1 from pg_policies where tablename='setup_config' and policyname='sc_update'
    and qual like '%current_user_has_module%';
  if not found then raise exception 'sc_update must gate by current_user_has_module'; end if;
end $$;

-- 3) 참조 마스터는 settings 게이트가 없어야(개방) — rt_all에 module 함수 미포함
do $$ begin
  perform 1 from pg_policies where tablename='room_types' and policyname='rt_all'
    and coalesce(qual,'') not like '%current_user_has_module%';
  if not found then raise exception 'rt_all must NOT gate by module'; end if;
end $$;

-- 4) 단일행 upsert 동작(수동 확인용 주석):
--   insert into setup_config(org_id, customer_notice) values (<org>, 'x')
--     on conflict (org_id) do update set customer_notice = excluded.customer_notice;
--   → 두 번 실행해도 1행 유지.

-- 5) 타 org 격리(수동): 다른 org 세션에서 room_types select 시 0행.

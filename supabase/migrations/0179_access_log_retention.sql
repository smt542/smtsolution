-- 0179: 감사 로그(access_log) 보존기간 적용 — 2년
--
-- 개인정보보호법 「개인정보의 안전성 확보조치 기준」상 접속기록은 최소 1년 보관이고,
-- 5만명 이상의 정보주체에 관한 개인정보 또는 고유식별정보·민감정보를 처리하는
-- 개인정보처리시스템은 2년이다. 향후 규모 증가에도 안전하도록 2년(730일)을 기본값으로 둔다.
-- 기간을 바꿀 때는 이 함수의 기본값 한 곳만 고치면 된다(호출부는 인수를 넘기지 않는다).
--
-- 0174가 깔아둔 access_log_created_at_idx를 그대로 쓴다.

create or replace function public.purge_access_log(p_retention_days int default 730)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted bigint;
begin
  if p_retention_days is null or p_retention_days < 365 then
    -- 법정 최소치 미만으로 줄이는 실수를 막는다.
    raise exception 'retention must be at least 365 days, got %', p_retention_days;
  end if;

  delete from public.access_log
    where created_at < now() - make_interval(days => p_retention_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

comment on function public.purge_access_log(int) is
  '접속기록 보존기간 경과분 삭제. 기본 730일(2년). service_role 전용이며 /api/cron/purge-access-log가 호출한다.';

-- service_role만 실행한다. 직원·입주자·비로그인 누구도 감사기록을 지울 수 없어야 한다.
revoke execute on function public.purge_access_log(int) from public, anon, authenticated;

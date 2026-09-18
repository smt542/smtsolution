-- 0169_setup_late_fee_enabled.sql
-- 셋업 설정 > 고지서 설정의 `관리비 연체 설정` 카드 on/off 토글.
--
-- 요율 값 자체는 0031의 late_fee_rate_tiers를 그대로 쓴다(/staff/overdue와 단일 원장).
-- 여기서 추가하는 것은 org 단위로 연체료 적용을 통째로 끄는 스위치뿐이다.
-- occupancies.late_fee_enabled(0006)는 세대별 플래그라 이것과 별개다.

alter table setup_config
  add column if not exists late_fee_enabled boolean not null default true;

comment on column setup_config.late_fee_enabled is
  'org 단위 연체료 적용 on/off. 요율 값은 late_fee_rate_tiers에 있다.';

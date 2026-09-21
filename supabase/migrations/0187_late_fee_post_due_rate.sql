-- 납기후 가산율 설정 추가 — 미납 표·출력물의 "납.후연체" 컬럼 계산 근거.
--
-- 미납 표는 정본을 따라 연체료를 두 갈래로 보여준다.
--   납.연체료 = 미납원금 × Σ(월차별 연체 요율)   ← 기존 late_fee_rate_tiers, 이미 계산 중
--   납.후연체 = 미납원금 × 납기후 가산율          ← 근거가 없어 지금까지 0/빈칸이었다
--   연체료계 = 둘의 합
-- 관리비 고지서의 납기내/납기후 2단 구조다(사용자 결정 2026-09-21).
--
-- 저장 위치는 setup_config — /staff/setup "고지서 설정" 탭이 읽고 쓰는 org 단위 설정 테이블이다
-- (연체 요율 12구간은 별도 테이블 late_fee_rate_tiers 이고, 이건 단일 스칼라라 여기가 맞다).
--
-- 기본값 2.00% — 정본 프로토타입의 더미가 쓰던 비율(postFee = 미납액 × 0.02)에 맞췄다.
-- 실제 값은 org 마다 /staff/setup 에서 바꾼다.
--
-- 기존 행에도 default 가 채워지므로 백필이 따로 필요 없다. 끄고 싶으면 0 으로 두면 된다
-- (연체 설정 전체 on/off 는 기존 late_fee_enabled 가 담당한다).

alter table setup_config
  add column if not exists late_fee_post_due_rate numeric(6, 4) not null default 2.0;

comment on column setup_config.late_fee_post_due_rate is
  '납기후 가산율(%). 미납 표·고지서의 "납.후연체" = 미납원금 × 이 비율. 0이면 부과하지 않는다.';

-- 음수·비현실적인 값 방지. 상한은 넉넉히 둔다(요율 규정은 org 마다 다르다).
alter table setup_config
  drop constraint if exists setup_config_late_fee_post_due_rate_check;
alter table setup_config
  add constraint setup_config_late_fee_post_due_rate_check
  check (late_fee_post_due_rate >= 0 and late_fee_post_due_rate <= 100);

notify pgrst, 'reload schema';

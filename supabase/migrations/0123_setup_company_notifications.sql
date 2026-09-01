-- 셋업: 회사 정보 + 알림 설정 컬럼 (Claude Design 프로토타입 6탭 정합)
-- setup_config(0003)에 관리업체 정보 카드 + 알림 토글을 추가한다.
-- 순수 additive — 기존 컬럼/값/RLS 정책(0003 sc_select/insert/update)에 영향 없음.
-- (컬럼은 setup_config 정책이 그대로 커버하므로 추가 정책 불필요.)

alter table setup_config
  -- 회사 정보(관리업체 정보) 카드
  add column if not exists company_name     text,           -- 상호
  add column if not exists company_phone    text,           -- 대표 전화
  add column if not exists company_fax      text,           -- 팩스
  add column if not exists biz_reg_no       text,           -- 사업자등록번호
  add column if not exists ceo_name         text,           -- 대표자
  add column if not exists company_address  text,           -- 주소
  add column if not exists operating_hours  text,           -- 운영 시간
  -- 알림 설정
  add column if not exists notify_move_in      boolean not null default true,  -- 입주 예정 세대 알림
  add column if not exists notify_lease_expiry boolean not null default true,  -- 임대 만료일 알림
  add column if not exists lease_expiry_days   int     not null default 7;      -- 만료 N일 전부터

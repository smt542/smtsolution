# 주택관리 ERP — Supabase DB 명세서

- 프로젝트: `amhtprmapxlizdnsgbeg` (https://amhtprmapxlizdnsgbeg.supabase.co)
- 추출일: 2026-10-06 · Supabase MCP로 실 DB(`public` 스키마)에서 직접 조회
- 규모: 테이블 71개 · DB 함수(RPC/트리거) 233개 · Enum 7개 · Edge Function 0개

## 목차
1. [Edge Function](#1-edge-function)
2. [DB 구조 개요(도메인별 테이블 목록)](#2-db-구조-개요)
3. [ER 관계 요약](#3-er-관계-요약)
4. [Enum 타입](#4-enum-타입)
5. [DB 함수(RPC) 목록](#5-db-함수rpc-목록)
6. [테이블 상세 명세](#6-테이블-상세-명세)

## 1. Edge Function

배포된 Edge Function은 **없음**(`list_edge_functions` 결과 0건).

서버 측 로직은 ① Postgres 함수(RPC, 대부분 `SECURITY DEFINER`) ② Next.js Route Handler(`app/api/**`, 예: `/api/cron/purge-access-log`)에서 처리한다. `pg_cron` 확장이 없어 예약 작업은 앱 API 엔드포인트가 RPC를 호출한다(예: `/api/cron/purge-access-log` → `purge_access_log`, `/api/messaging/dispatch-scheduled` → `claim_due_message_schedules`).

## 2. DB 구조 개요

모든 테이블은 RLS가 활성화되어 있다. 멀티테넌시는 `org_id`(직접 또는 building/unit 경유)로 분리된다.

### 조직·계정·권한

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`organizations`](#organizations) | 0 | 관리사무소(테넌트) 조직. 계약기간·사업자 정보·계약서 파일 경로를 보관하며, 생성 시 트리거로 기본 알림톡 템플릿·방 타입·업체 분류를 프로비저닝한다. |
| [`profiles`](#profiles) | 5 | auth.users 1:1 사용자 프로필(로그인 ID·이름·연락처·활성 여부·비밀번호 변경 강제). |
| [`org_members`](#org_members) | 5 | 조직-사용자 소속. 역할(role)·직원 유형(staff_type)·기능 권한(feature_permissions)·현장 권한(staff_capabilities)·본사 역할(hq_role)을 가진다. |
| [`staff_roles`](#staff_roles) | 0 | 조직별 직원 직책 마스터. |
| [`org_member_roles`](#org_member_roles) | 0 | 직원-직책 N:M 매핑. |
| [`account_login_pins`](#account_login_pins) | 5 | 계정별 로그인 PIN(암호화 bytea). 협력업체 PIN 로그인에 사용. |
| [`login_rate_limit`](#login_rate_limit) | 12 | 로그인 무차별 대입 방지 버킷. service_role이 login_rate_limit_hit()로만 기록. |
| [`app_secrets`](#app_secrets) | 1 | 서버 내부 비밀값 키-값 저장소(공유 링크 서명키 등). 클라이언트 접근 불가. |

### 건물·세대·입주

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`building_types`](#building_types) | 5 | 건물 유형 마스터(조직별). 유형별 관리비 항목(fee_items)의 기준이며, 생성 시 필수 공과금 항목(전기·수도료·가스)을 시드한다. |
| [`buildings`](#buildings) | 14 | 건물 기본정보. 담당자(관리·검침·청소), 시설(facilities)·소유주·장기수선 적립 등 부가정보 JSON, 청구 메모를 보관. |
| [`building_customer_numbers`](#building_customer_numbers) | 44 | 건물 단위 공과금 고객번호(수도·공용전기·전기·가스), 검침일·청구 기준(전월/당월)·계산 방식. |
| [`building_vendors`](#building_vendors) | 10 | 건물별 협력업체 연락처(승강기·소방·전기·정화조 등). |
| [`building_utility_suppliers`](#building_utility_suppliers) | 0 | 건물별 공과금 공급사 및 납부 계좌 정보. |
| [`units`](#units) | 44 | 세대(호실). 동·층·평형·방 수·주거/상가 구분. |
| [`unit_meters`](#unit_meters) | 60 | 세대별 계량기(수도·전기·가스 등) 번호·고객번호. fixed_* 컬럼은 0203 이후 미사용(unit_fixed_values로 이관). |
| [`unit_fixed_values`](#unit_fixed_values) | 4 | 세대별 공과금 고정 사용량/고정 금액을 적용 시작월(from_period) 단위로 이력 관리. |
| [`unit_accounts`](#unit_accounts) | 37 | 세대별 납부 계좌(수도·전기·가스·관리비)와 CMS 회원번호·납부자번호. |
| [`unit_property_listings`](#unit_property_listings) | 9 | 세대 매물(임대) 정보: 보증금·월세·면적·입주 가능일 등. |
| [`room_types`](#room_types) | 5 | 방 타입 마스터(원룸·투룸 등). |
| [`occupancies`](#occupancies) | 44 | 세대 현재 입주(점유) 정보. 입주자·연락처·차량·입퇴실일·고지서 수신 방식·자동이체·연체료 적용·알림 수신동의 등 청구 관련 설정 포함. |
| [`occupancy_history`](#occupancy_history) | 6 | 과거 입주 이력 스냅샷. |
| [`lease_contracts`](#lease_contracts) | 6 | 입주(occupancy)별 임대차 계약(보증금·월세·계약기간·만기 알림). |
| [`water_discounts`](#water_discounts) | 0 | 세대별 수도 감면(수급자·다자녀 등). |

### 청구·고지서

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`fee_items`](#fee_items) | 35 | 건물 유형별 관리비 부과 항목(반올림 방식·일할계산·이월·필수 여부). |
| [`fee_item_charges`](#fee_item_charges) | 584 | 세대·월분·항목별 부과 금액. |
| [`billing_period_settings`](#billing_period_settings) | 9 | 건물·월분별 부과기준일(시작/종료)과 납기일. |
| [`billing_confirmations`](#billing_confirmations) | 148 | 세대·월분 청구 확정 상태와 총액·청구 메모. |
| [`billing_history`](#billing_history) | 73 | 확정 시점의 청구 내역 스냅샷(items JSON). |
| [`bill_issues`](#bill_issues) | 37 | 고지서 발행 기록(A4·지로·카카오·팩스), 발송 상태·예약 시각·연결된 메시지 로그. |
| [`bill_share_tokens`](#bill_share_tokens) | 1 | 고지서 공개 공유 링크 토큰(만료·폐기). |
| [`late_fee_rate_tiers`](#late_fee_rate_tiers) | 12 | 연체 개월 구간별 월 연체 요율. |
| [`setup_config`](#setup_config) | 1 | 조직 환경설정: 고지서 출력 옵션, 관리비/정산 계좌, 회사 정보, 알림 설정, 발신번호, 연체료 설정. |

### 검침·공과금

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`meter_readings`](#meter_readings) | 338 | 세대·공과금·월분별 검침값(전월/당월/사용량), 단가·계산요금·감면·수동요금, 확인필요 플래그. |
| [`utility_unit_prices`](#utility_unit_prices) | 2 | 고객번호(building_customer_numbers)별 공과금 단가. |
| [`utility_scoped_prices`](#utility_scoped_prices) | 0 | 건물·공과금·용도(주거/상가)·층 범위별 단가. |
| [`utility_confirmations`](#utility_confirmations) | 0 | 건물·공과금·월분 단위 공과금 확정(세대수·합계). |

### 수납

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`payments`](#payments) | 81 | 수납 기록(현금·이체·자동이체·지로·카드). 원천(manual·은행엑셀·CMS·지로파일), 취소 상태, 수수료 포함. |

### 이사정산·퇴실

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`moving_settlements`](#moving_settlements) | 12 | 이사(퇴실) 정산서: 관리비 일할, 공과금, 수리비·귀책, 청소비, 정산 계좌, 상태(draft→saved→mid_moveout→completed). 트리거로 정산금액 자동 계산. |
| [`settlement_check_items`](#settlement_check_items) | 53 | 정산 체크리스트 항목 마스터. |
| [`settlement_checklist_results`](#settlement_checklist_results) | 120 | 정산서별 체크 항목 결과·메모. |
| [`settlement_share_tokens`](#settlement_share_tokens) | 0 | 정산서 공개 공유 링크 토큰. |
| [`move_out_requests`](#move_out_requests) | 4 | 입주민 퇴실 신청(희망일·사유·처리 상태). |

### 민원(AS)·공지

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`as_categories`](#as_categories) | 15 | AS(민원) 분류 마스터. |
| [`complaints`](#complaints) | 34 | 민원/AS 접수(건물·세대·분류·상태·담당자). |
| [`complaint_resolutions`](#complaint_resolutions) | 32 | 민원 처리 결과. |
| [`notices`](#notices) | 4 | 공지사항(Tiptap JSON 본문, 게시/만료). 대상 건물은 notice_buildings로 다중 지정. |
| [`notice_buildings`](#notice_buildings) | 6 | 공지 대상 건물(다중). 링크가 없으면 조직 전체 공지. |
| [`notice_share_tokens`](#notice_share_tokens) | 1 | 공지 공개 공유 링크 토큰. |
| [`resident_notice_reads`](#resident_notice_reads) | 5 | 입주민 공지 읽음 기록. |

### 입주민(카카오) 연동

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`resident_identities`](#resident_identities) | 13 | 카카오 로그인 입주민 신원(kakao_id·이름·전화·프로필). |
| [`res_claims`](#res_claims) | 7 | 입주민-세대 연결 요청(자동/수동/검색)과 승인·거절 상태. |

### 메시지·포인트·발송

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`message_templates`](#message_templates) | 1 | 메시지 템플릿(SMS/알림톡, 알림톡 템플릿 코드·버튼). |
| [`quick_messages`](#quick_messages) | 0 | 자주 쓰는 문구. |
| [`message_logs`](#message_logs) | 18 | 메시지 발송 로그(채널·본문·수신자·결과·포인트 상태·연결 공지). |
| [`message_schedules`](#message_schedules) | 23 | 예약/반복(월간) 발송 스케줄. |
| [`message_point_rates`](#message_point_rates) | 0 | 채널별 포인트 단가(유효기간 이력). |
| [`message_point_reservations`](#message_point_reservations) | 3 | 발송 전 포인트 예약(멱등키·수신자별 비용·정산/해제 상태). |
| [`point_transactions`](#point_transactions) | 3 | 포인트 원장(충전·사용·조정). append-only 트리거로 수정 금지. |
| [`provider_dispatch_jobs`](#provider_dispatch_jobs) | 3 | Popbill 발송 작업(메시지/팩스) 접수·폴링·결과 집계, test/live 환경 구분. |
| [`provider_dispatch_recipients`](#provider_dispatch_recipients) | 44 | 발송 작업별 수신자 결과. |

### 업체·장기수선·기타 마스터

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`vendor_categories`](#vendor_categories) | 8 | 협력업체 분류 마스터. |
| [`vendors`](#vendors) | 3 | 협력업체(조직 단위). |
| [`septic_vendors`](#septic_vendors) | 0 | 정화조 업체 마스터. |
| [`cleaning_teams`](#cleaning_teams) | 0 | 청소팀 마스터. |
| [`long_term_repair_ledger`](#long_term_repair_ledger) | 12 | 건물별 장기수선충당금 입출금 원장(감사 트리거). |
| [`long_term_repair_history`](#long_term_repair_history) | 0 | 장기수선 공사 이력. |
| [`attachments`](#attachments) | 14 | 범용 첨부파일 메타(entity_type/entity_id 다형 참조, 10MB 제한). |

### 플랫폼 운영

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`platform_settings`](#platform_settings) | 0 | 플랫폼 전역 설정 단일 행(id=1): 채널별 요금, VAT, 청구 계좌 등. |
| [`platform_billing_invoices`](#platform_billing_invoices) | 7 | 조직별 월 플랫폼 이용료 청구서(채널별 건수·금액·납부 상태). |

### 감사·로그

| 테이블 | 행 수 | 기능 |
|---|---:|---|
| [`audit_log`](#audit_log) | 2225 | 데이터 변경 감사 로그(before/after JSON). |
| [`access_log`](#access_log) | 356 | 개인정보 열람·내보내기·발송·공개링크 조회 접속기록(보존 730일, purge_access_log). |

## 3. ER 관계 요약

```text
organizations
 ├─ org_members ── profiles ── auth.users
 ├─ building_types ── fee_items ── fee_item_charges
 ├─ buildings
 │   ├─ building_customer_numbers ── utility_unit_prices
 │   ├─ building_vendors / building_utility_suppliers / utility_scoped_prices
 │   ├─ billing_period_settings / utility_confirmations
 │   ├─ long_term_repair_ledger / long_term_repair_history
 │   ├─ complaints ── complaint_resolutions
 │   └─ units
 │       ├─ occupancies ── lease_contracts
 │       ├─ unit_meters / unit_fixed_values / unit_accounts / water_discounts
 │       ├─ meter_readings
 │       ├─ billing_confirmations / billing_history / bill_issues / bill_share_tokens
 │       ├─ payments
 │       ├─ moving_settlements ── settlement_checklist_results / settlement_share_tokens
 │       └─ occupancy_history / unit_property_listings
 ├─ notices ── notice_buildings / notice_share_tokens / resident_notice_reads
 ├─ message_templates / quick_messages
 ├─ message_logs ── message_point_reservations ── point_transactions
 │   └─ provider_dispatch_jobs ── provider_dispatch_recipients
 ├─ message_schedules
 ├─ res_claims / move_out_requests   (auth.users 입주민 ↔ resident_identities)
 ├─ setup_config (1:1) / late_fee_rate_tiers
 └─ platform_billing_invoices
```

## 4. Enum 타입

| 타입 | 값 |
|---|---|
| `attachment_kind` | contract, repair, facility, etc, receipt, photo |
| `fee_rounding` | up, round, down, raw |
| `occupancy_status` | occupied, vacant, moving_out |
| `org_member_role` | platform_admin, org_owner, manager, staff, field, tenant |
| `org_status` | active, suspended, trial |
| `point_tx_type` | charge, usage, adjustment |
| `staff_type` | manager_staff, field_staff, support_staff, tenant |

## 5. DB 함수(RPC) 목록

보안: **D** = `SECURITY DEFINER`(RLS 우회, 함수 내부에서 권한 검사), **I** = `SECURITY INVOKER`. 기능 설명이 비어 있는 함수는 이름·시그니처로 역할을 파악할 수 있다.

### 트리거 함수 (17)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `audit_long_term_repair_ledger_change` | `-` | `trigger` | D |  |
| `clear_occupancy_fax_on_vacancy` | `-` | `trigger` | I |  |
| `close_move_out_requests_on_vacate` | `-` | `trigger` | D |  |
| `message_schedules_enqueue_next_occurrence` | `-` | `trigger` | D |  |
| `notice_buildings_set_org` | `-` | `trigger` | D |  |
| `notices_sync_building_link` | `-` | `trigger` | D |  |
| `prevent_point_transaction_mutation` | `-` | `trigger` | D |  |
| `provider_dispatch_job_status_guard` | `-` | `trigger` | D |  |
| `provider_dispatch_recipient_status_guard` | `-` | `trigger` | D |  |
| `restore_required_utility_fee_items` | `-` | `trigger` | D |  |
| `seed_required_utility_fee_items` | `-` | `trigger` | D |  |
| `set_moving_settlement_amount` | `-` | `trigger` | I |  |
| `set_updated_at` | `-` | `trigger` | I | updated_at 자동 갱신 트리거 |
| `trg_office_default_permissions` | `-` | `trigger` | I |  |
| `trg_provision_alimtalk_templates` | `-` | `trigger` | D |  |
| `trg_provision_default_room_types` | `-` | `trigger` | D |  |
| `trg_provision_vendor_categories` | `-` | `trigger` | D |  |

### 인증·권한 헬퍼 (19)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `admin_set_active` | `p_user_id uuid, p_active boolean, p_target_org_id bigint` | `void` | D |  |
| `admin_set_member_permissions` | `p_user_id uuid, p_role org_member_role, p_staff_type staff_type, p_permissions jsonb, p_role_ids bigint[], p_target_org_id bigint` | `void` | D |  |
| `admin_update_member_basic` | `p_user_id uuid, p_full_name text, p_phone text, p_phone_sub text, p_staff_type staff_type, p_affiliation text, p_role_ids bigint[], p_staff_capabilities jsonb` | `void` | D |  |
| `current_user_has_module` | `p_key text` | `boolean` | D |  |
| `current_user_is_field_partner` | `-` | `boolean` | D |  |
| `current_user_is_manager_staff` | `-` | `boolean` | D |  |
| `current_user_is_master` | `-` | `boolean` | D |  |
| `current_user_is_platform_admin` | `-` | `boolean` | D |  |
| `current_user_org` | `-` | `bigint` | D | 현재 사용자 소속 org_id |
| `get_my_context` | `-` | `TABLE(org_id bigint, role org_member_role, org_status org…` | D | 로그인 사용자 컨텍스트(조직·역할·권한) |
| `list_account_login_pins` | `-` | `TABLE(user_id uuid, pin text)` | D |  |
| `list_accounts` | `p_search text, p_type staff_type` | `TABLE(user_id uuid, username text, full_name text, phone …` | D |  |
| `login_rate_limit_hit` | `p_key text, p_max_fails integer, p_window_seconds integer, p_lock_seconds integer, p_action text` | `TABLE(allowed boolean, retry_after_seconds integer)` | D | 로그인 실패 카운트/잠금 판정 |
| `my_org_ids` | `-` | `SETOF bigint` | D | 현재 사용자 소속 org 목록(RLS 헬퍼) |
| `provision_member` | `p_user_id uuid, p_username text, p_full_name text, p_phone text, p_phone_sub text, p_role org_member_role, p_staff_type staff_type, p_permissions jsonb, p_affiliation text, p_role_ids bigint[], p_target_org_id bigint, p_staff_capabilities jsonb` | `void` | D |  |
| `record_login` | `p_actor_id uuid, p_ip text` | `void` | D |  |
| `record_login` | `p_ip text` | `void` | D |  |
| `revoke_user_sessions` | `p_user_id uuid` | `integer` | D |  |
| `store_account_login_pin` | `p_user_id uuid, p_pin text` | `void` | D |  |

### 플랫폼 운영자(platform_*) (28)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `platform_create_organization` | `p_name text, p_slug text, p_phone text` | `organizations` | D | 조직 생성 |
| `platform_delete_point_charge` | `p_tx_id bigint` | `jsonb` | D |  |
| `platform_get_monthly_send_cost` | `p_year integer` | `TABLE(month integer, alimtalk_krw numeric, sms_krw numeri…` | D |  |
| `platform_get_organization_contract_kpis` | `-` | `TABLE(operating_count bigint, expiring_within_90_days_cou…` | D |  |
| `platform_get_overview_metrics` | `p_month date` | `TABLE(org_active integer, org_suspended integer, org_term…` | D |  |
| `platform_list_accounts` | `p_search text, p_limit integer, p_offset integer` | `TABLE(org_id bigint, organization_name text, user_id uuid…` | D |  |
| `platform_list_hq_accounts` | `p_search text, p_limit integer, p_offset integer` | `TABLE(user_id uuid, username text, full_name text, phone …` | D |  |
| `platform_list_message_point_rates` | `p_include_history boolean` | `TABLE(id bigint, channel text, points integer, effective_…` | D |  |
| `platform_list_org_billing` | `p_month date` | `TABLE(org_id bigint, org_name text, org_email text, statu…` | D |  |
| `platform_list_organizations` | `p_search text, p_include_deleted boolean, p_status text, p_limit integer, p_offset integer` | `TABLE(id bigint, name text, slug text, status org_status,…` | D |  |
| `platform_list_point_balances` | `-` | `TABLE(org_id bigint, ledger_balance bigint, reserved_poin…` | D |  |
| `platform_list_point_reservations` | `p_status text` | `TABLE(id bigint, org_id bigint, organization_name text, m…` | D |  |
| `platform_list_point_reservations_page` | `p_statuses text[], p_limit integer, p_offset integer` | `TABLE(id bigint, org_id bigint, organization_name text, m…` | D |  |
| `platform_list_point_transactions` | `p_type text, p_before_created_at timestamp with time zone, p_before_id bigint, p_limit integer` | `TABLE(id bigint, org_id bigint, organization_name text, t…` | D |  |
| `platform_mark_org_billing_paid` | `p_org_id bigint, p_month date, p_paid boolean` | `platform_billing_invoices` | D |  |
| `platform_org_usage` | `p_month date` | `TABLE(org_id bigint, sms_count integer, lms_count integer…` | D |  |
| `platform_prepare_hq_account_delete` | `p_user_id uuid` | `void` | D |  |
| `platform_provision_hq_account` | `p_user_id uuid, p_username text, p_full_name text, p_phone text, p_memo text, p_hq_role text` | `void` | D |  |
| `platform_purge_organization` | `p_org_id bigint` | `jsonb` | D | 조직 영구 삭제 |
| `platform_record_point_adjustment` | `p_org_id bigint, p_kind text, p_points integer, p_amount_krw integer, p_memo text` | `jsonb` | D |  |
| `platform_record_point_charge` | `p_org_id bigint, p_points integer, p_amount_krw integer, p_memo text` | `jsonb` | D | 포인트 충전 기록 |
| `platform_release_stale_reservation` | `p_id bigint, p_reason text` | `jsonb` | D |  |
| `platform_set_message_point_rates` | `p_sms_points integer, p_alimtalk_points integer, p_lms_points integer` | `jsonb` | D |  |
| `platform_update_account` | `p_org_id bigint, p_user_id uuid, p_full_name text, p_phone text, p_memo text` | `TABLE(org_id bigint, user_id uuid, full_name text, phone …` | D |  |
| `platform_update_hq_account` | `p_user_id uuid, p_full_name text, p_phone text, p_memo text, p_hq_role text, p_is_active boolean` | `void` | D |  |
| `platform_update_organization_contract` | `p_org_id bigint, p_name text, p_slug text, p_phone text, p_contract_start_date date, p_contract_end_date date, p_representative_name text, p_business_registration_number text, p_fax text, p_email text, p_address text, p_region text, p_operating_hours text, p_contract_file_path text, p_contract_file_paths text[]` | `organizations` | D |  |
| `platform_update_point_charge` | `p_tx_id bigint, p_points integer` | `jsonb` | D |  |
| `platform_update_settings` | `p_rate_krw_alimtalk integer, p_rate_krw_sms integer, p_rate_krw_lms integer, p_rate_krw_fax integer, p_low_balance_threshold integer, p_billing_bank text, p_billing_account_no text, p_billing_account_holder text, p_business_reg_no text, p_invoice_notice text, p_billing_basis text, p_payment_due_days integer, p_vat_rate numeric, p_contact_person text` | `platform_settings` | D |  |

### 협력업체(partner_*) (26)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `partner_create_complaint` | `p_building_id bigint, p_unit_id bigint, p_category_id bigint, p_content text, p_status text, p_completed_at timestamp with time zone, p_result_content text, p_reporter_phone text` | `bigint` | D |  |
| `partner_delete_complaint` | `p_id bigint` | `void` | D |  |
| `partner_delete_moving_settlement` | `p_settlement_id bigint` | `jsonb` | D |  |
| `partner_get_building` | `p_building_id bigint` | `TABLE(id bigint, code text, name text, address text, memo…` | D |  |
| `partner_get_complaint` | `p_id bigint` | `TABLE(id bigint, building_id bigint, building_name text, …` | D |  |
| `partner_get_my_pin` | `-` | `text` | D |  |
| `partner_get_occupancy` | `p_unit_id bigint` | `TABLE(unit_id bigint, building_id bigint, building_name t…` | D |  |
| `partner_get_profile` | `-` | `TABLE(full_name text, username text, phone text, affiliat…` | D |  |
| `partner_get_settlement_context` | `p_unit_id bigint, p_settlement_id bigint` | `jsonb` | D |  |
| `partner_list_as_categories` | `-` | `TABLE(id bigint, label text)` | D |  |
| `partner_list_building_vendors` | `p_building_id bigint` | `TABLE(id bigint, vendor_type text, name text, phone text,…` | D |  |
| `partner_list_buildings` | `p_search text` | `TABLE(id bigint, code text, name text, address text, tota…` | D |  |
| `partner_list_complaints` | `p_before_received_at timestamp with time zone, p_before_id bigint, p_status text, p_search text, p_sort_direction text, p_limit integer` | `TABLE(id bigint, building_id bigint, building_name text, …` | D |  |
| `partner_list_meter_cards` | `p_building_id bigint, p_period date` | `TABLE(unit_id bigint, occupancy_id bigint, move_in_date d…` | D |  |
| `partner_list_meter_readings` | `p_building_id bigint, p_period date` | `TABLE(unit_id bigint, unit_no text, dong text, tenant_nam…` | D |  |
| `partner_list_unit_payments` | `p_unit_id bigint, p_before_period date, p_limit integer` | `TABLE(period date, due_date date, charged integer, paid i…` | D |  |
| `partner_list_unit_settlements` | `p_unit_id bigint` | `TABLE(id bigint, tenant_name text, status text, settlemen…` | D |  |
| `partner_list_units` | `p_building_id bigint` | `TABLE(unit_id bigint, unit_no text, dong text, tenant_nam…` | D |  |
| `partner_my_building_ids` | `-` | `SETOF bigint` | D |  |
| `partner_org_building_ids` | `-` | `SETOF bigint` | D |  |
| `partner_save_meter_readings` | `p_building_id bigint, p_period date, p_readings jsonb` | `void` | D | 협력업체 검침 입력 저장 |
| `partner_save_moving_settlement` | `p_unit_id bigint, p_occupancy_id bigint, p_settlement_id bigint, p_data jsonb, p_checklist jsonb` | `jsonb` | D |  |
| `partner_search_tenants` | `p_search text` | `TABLE(occupancy_id bigint, unit_id bigint, building_id bi…` | D |  |
| `partner_store_login_pin` | `p_user_id uuid, p_pin text` | `void` | D |  |
| `partner_unit_belongs_to_building` | `p_building_id bigint, p_unit_id bigint` | `boolean` | D |  |
| `partner_update_complaint` | `p_id bigint, p_category_id bigint, p_content text, p_status text, p_completed_at timestamp with time zone, p_result_content text` | `void` | D |  |

### 입주민(resident_*)·공개 링크 (35)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `approve_res_claim` | `p_claim_id bigint, p_occupancy_id bigint` | `void` | D | 세대 연결 승인 |
| `bill_signature` | `p_building_id bigint, p_unit_no text, p_period date` | `text` | D |  |
| `bill_signature` | `p_building_id bigint, p_unit_no text, p_period date, p_issued_day integer` | `text` | D |  |
| `list_res_claims` | `p_status text` | `TABLE(claim_id bigint, org_id bigint, resident_user_id uu…` | D |  |
| `mint_notice_share_token` | `p_notice_id bigint` | `uuid` | D |  |
| `mint_settlement_share_token` | `p_settlement_id bigint` | `uuid` | D |  |
| `public_bill_by_signed` | `p_building_id bigint, p_unit_no text, p_period date, p_sig text` | `TABLE(period date, building_name text, unit_no text, tota…` | D | 서명 URL로 고지서 공개 조회 |
| `public_bill_by_signed` | `p_building_id bigint, p_unit_no text, p_period date, p_sig text, p_issued_day integer` | `TABLE(period date, building_name text, unit_no text, tota…` | D | 서명 URL로 고지서 공개 조회 |
| `public_notice_by_token` | `p_token uuid` | `jsonb` | D | 토큰으로 공지 공개 조회 |
| `public_settlement_by_token` | `p_token uuid` | `jsonb` | D | 토큰으로 정산서 공개 조회 |
| `reject_res_claim` | `p_claim_id bigint` | `void` | D | 세대 연결 거절 |
| `resident_automatch` | `-` | `TABLE(org_id bigint, building_id bigint, building_name te…` | D | 카카오 입주민 자동 세대 매칭 |
| `resident_bill_detail` | `p_period date` | `TABLE(period date, building_name text, unit_no text, tena…` | D |  |
| `resident_bill_months` | `-` | `TABLE(period date, total_amount integer, paid_amount inte…` | D |  |
| `resident_building_notice` | `-` | `text` | D |  |
| `resident_cancel_move_out` | `-` | `void` | D |  |
| `resident_confirm` | `p_occupancy_id bigint` | `void` | D |  |
| `resident_create_move_out` | `p_desired_date date, p_reason text` | `bigint` | D |  |
| `resident_get_move_out` | `-` | `TABLE(id bigint, desired_date date, reason text, status t…` | D |  |
| `resident_get_profile` | `-` | `TABLE(tenant_name text, kakao_name text, phone text, buil…` | D |  |
| `resident_linked_unit` | `-` | `TABLE(org_id bigint, building_id bigint, unit_id bigint, …` | D |  |
| `resident_mark_notice_read` | `p_notice_id bigint` | `void` | D |  |
| `resident_my_link` | `-` | `TABLE(claim_id bigint, org_id bigint, building_id bigint,…` | D |  |
| `resident_notice_detail` | `p_id bigint` | `TABLE(id bigint, title text, content text, content_json j…` | D |  |
| `resident_notice_read_ids` | `-` | `TABLE(notice_id bigint)` | D |  |
| `resident_notices` | `-` | `TABLE(id bigint, title text, notice_type text, building_i…` | D |  |
| `resident_pending_contact` | `-` | `TABLE(company_name text, company_phone text)` | D |  |
| `resident_request_claim` | `p_building_id bigint, p_unit_text text` | `void` | D | 입주민 세대 연결 요청 |
| `resident_search_buildings` | `p_q text` | `TABLE(building_id bigint, org_id bigint, name text, addre…` | D |  |
| `resident_set_notify_prefs` | `p_alimtalk boolean, p_sms boolean` | `void` | D |  |
| `resident_sign_bill_url` | `p_period date` | `TABLE(building_id bigint, unit_no text, sig text, issued_…` | D |  |
| `resident_update_move_out` | `p_desired_date date` | `void` | D |  |
| `resident_withdraw` | `-` | `void` | D | 입주민 탈퇴 |
| `resolve_bill_token_occupancy` | `p_unit_id bigint, p_period date` | `bigint` | D |  |
| `staff_sign_bill_urls` | `p_unit_ids bigint[], p_period date` | `TABLE(unit_id bigint, building_id bigint, unit_no text, s…` | D |  |

### 청구·고지서 (20)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `billing_utility_default` | `p_unit_id bigint, p_period date, p_is_required boolean, p_item_name text` | `integer` | I |  |
| `charge_new_occupancies` | `p_building_id bigint, p_period date, p_unit_ids bigint[]` | `jsonb` | D | 신규 입주 세대 일괄 부과 |
| `confirm_billing` | `p_building_id bigint, p_period date` | `jsonb` | D | 세대·월분 청구 확정 및 이력 스냅샷 |
| `count_overdue_households` | `p_target_year integer, p_target_month integer` | `bigint` | D |  |
| `ensure_required_utility_fee_items` | `p_type_id bigint` | `void` | D |  |
| `get_bill_documents` | `p_building_id bigint, p_period date, p_unit_ids jsonb` | `TABLE(unit_id bigint, unit_no text, dong text, tenant_nam…` | D |  |
| `issue_bills` | `p_building_id bigint, p_period date, p_unit_ids jsonb, p_issue_type text, p_due_date date, p_unit_label_mode text, p_water_cutoff_unit_ids jsonb` | `jsonb` | D | 고지서 발행 기록 생성 |
| `list_bill_targets` | `p_building_id bigint, p_period date` | `TABLE(unit_id bigint, unit_no text, dong text, occupancy_…` | D |  |
| `list_billing` | `p_building_id bigint, p_period date` | `TABLE(unit_id bigint, unit_no text, dong text, room_type_…` | D | 청구 화면 목록 조회 |
| `list_billing_history` | `p_unit_id bigint, p_period date, p_months integer` | `TABLE(period date, total_amount integer, items jsonb, con…` | D |  |
| `list_overdue_aggregates` | `p_building_id bigint, p_target_year integer, p_target_month integer, p_scope text` | `TABLE(occupancy_id bigint, unit_id bigint, overdue_amount…` | D |  |
| `list_overdue_periods` | `p_building_id bigint, p_target_year integer, p_target_month integer, p_scope text` | `TABLE(occupancy_id bigint, unit_id bigint, period date, u…` | D |  |
| `list_uncharged_new_occupancies` | `p_building_id bigint, p_period date` | `TABLE(unit_id bigint, unit_no text, dong text, tenant_nam…` | D |  |
| `popbill_byte_length` | `p_text text` | `integer` | I | Popbill 기준 바이트 길이(SMS/LMS 판정) |
| `record_bill_delivery` | `p_building_id bigint, p_period date, p_unit_ids jsonb, p_issue_type text, p_send_status text, p_message_log_id bigint, p_message_schedule_id bigint, p_scheduled_at timestamp with time zone` | `jsonb` | D |  |
| `reorder_building_types` | `p_ordered_ids bigint[]` | `void` | I |  |
| `reorder_fee_items` | `p_ordered_ids bigint[]` | `void` | I |  |
| `resolve_fax_bill_issues` | `p_building_id bigint, p_period date, p_unit_ids jsonb` | `TABLE(bill_issue_id bigint, unit_id bigint)` | D |  |
| `round_charge` | `p_value numeric, p_rounding text` | `integer` | I | 반올림 규칙 적용 |
| `save_billing_charges` | `p_building_id bigint, p_period date, p_charges jsonb, p_notes jsonb` | `void` | D | 관리비 항목 부과액 저장 |

### 검침·공과금 (7)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `confirm_utilities` | `p_building_id bigint, p_utility text, p_period date` | `jsonb` | D | 건물 공과금 확정 |
| `list_utility_confirmation` | `p_building_id bigint, p_utility text, p_period date` | `TABLE(confirmed_at timestamp with time zone, confirmed_by…` | D |  |
| `list_utility_prices` | `p_building_id bigint, p_utility text` | `TABLE(customer_number_id bigint, customer_no text, holder…` | D |  |
| `list_utility_rows` | `p_building_id bigint, p_utility text, p_period date` | `TABLE(unit_id bigint, unit_no text, dong text, occupancy_…` | D |  |
| `save_meter_readings` | `p_building_id bigint, p_utility text, p_period date, p_rows jsonb` | `jsonb` | D | 검침값 저장 및 요금 계산 |
| `save_unit_fixed_values` | `p_building_id bigint, p_utility text, p_period date, p_rows jsonb` | `jsonb` | D |  |
| `save_utility_unit_prices` | `p_building_id bigint, p_utility text, p_prices jsonb` | `jsonb` | D |  |

### 수납 (18)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `cancel_payment` | `p_payment_id bigint` | `jsonb` | D | 수납 취소 |
| `get_payment_statement_data` | `p_building_id bigint, p_unit_id bigint, p_start_period date, p_end_period date` | `jsonb` | D |  |
| `list_bank_payments` | `p_building_id bigint, p_period date` | `TABLE(unit_id bigint, amount integer, paid_at date)` | D |  |
| `list_cms_debit_rows` | `p_building_id bigint, p_period date` | `TABLE(cms_member_no text, holder text, unit_no text, dong…` | D |  |
| `list_giro_payments` | `p_building_id bigint, p_period date` | `TABLE(id bigint, unit_no text, dong text, tenant_name tex…` | D |  |
| `list_payment_rows` | `p_building_id bigint, p_period date` | `TABLE(unit_id bigint, unit_no text, dong text, occupancy_…` | D |  |
| `list_receipts_workspace` | `p_org_id bigint, p_period date` | `TABLE(building_id bigint, building_code text, building_na…` | D |  |
| `list_receipts_workspace_fee_totals` | `p_org_id bigint, p_period date, p_building_id bigint` | `TABLE(building_id bigint, building_name text, fee_item_id…` | D |  |
| `list_receipts_workspace_navigation` | `p_org_id bigint, p_building_id bigint, p_limit integer, p_offset integer` | `TABLE(total_count bigint, unit_id bigint, unit_no text, d…` | D |  |
| `list_receipts_workspace_scoped` | `p_org_id bigint, p_period date, p_building_id bigint, p_unit_id bigint, p_limit integer, p_offset integer` | `TABLE(total_count bigint, building_id bigint, building_na…` | D |  |
| `list_unit_payments` | `p_unit_id bigint, p_period date` | `TABLE(id bigint, amount integer, fee integer, method text…` | D |  |
| `receipts_save_building_notes` | `p_building_id bigint, p_memo text, p_billing_note text` | `void` | D |  |
| `receipts_save_occupancy_fields` | `p_occupancy_id bigint, p_tenant_name text, p_payer_name text, p_phone text, p_move_in_date date, p_move_out_date date, p_note text, p_billing_enabled boolean, p_print_enabled boolean, p_sms_opt_in boolean, p_alimtalk_opt_in boolean` | `void` | D |  |
| `record_bank_payments` | `p_building_id bigint, p_period date, p_entries jsonb` | `jsonb` | D | 은행 엑셀 수납 일괄 반영 |
| `record_giro_payments` | `p_entries jsonb` | `jsonb` | D | 지로 파일 수납 일괄 반영 |
| `record_payment` | `p_unit_id bigint, p_period date, p_amount integer, p_method text, p_kind text, p_memo text, p_paid_at date, p_fee integer` | `jsonb` | D | 수납 등록 |
| `record_payment_edit` | `p_old_payment_id bigint, p_unit_id bigint, p_period date, p_amount integer, p_method text, p_kind text, p_memo text, p_paid_at date, p_fee integer, p_source text` | `jsonb` | D |  |
| `search_receipts_workspace` | `p_org_id bigint, p_period date, p_search_mode text, p_result_kind text, p_term text, p_limit integer, p_offset integer` | `TABLE(total_count bigint, building_id bigint, building_na…` | D |  |

### 이사정산·퇴실 (12)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `calculate_moving_settlement_amount` | `p_data jsonb` | `integer` | I |  |
| `cancel_move_out_schedule` | `p_occupancy_id bigint` | `void` | D |  |
| `complete_moving_settlement` | `p_settlement_id bigint` | `jsonb` | D | 이사정산 완료 처리 |
| `execute_due_move_outs` | `-` | `integer` | D | 예정일 도래 퇴실 일괄 실행 |
| `execute_move_out` | `p_occupancy_id bigint, p_move_out_date date` | `void` | D | 퇴실 실행(입주→공실 전환) |
| `get_settlement_context` | `p_unit_id bigint, p_settlement_id bigint` | `jsonb` | D |  |
| `list_settlement_inquiries` | `p_type text, p_building_id bigint, p_from date, p_to date, p_search text, p_status text, p_sort text, p_limit integer, p_offset integer, p_applied_from date` | `TABLE(settlement_id bigint, building_id bigint, building_…` | D |  |
| `list_settlements` | `p_building_id bigint, p_from date, p_to date` | `TABLE(settlement_id bigint, unit_id bigint, occupancy_id …` | D |  |
| `mid_moveout_settlement` | `p_settlement_id bigint` | `jsonb` | D | 중도 퇴실 정산 |
| `save_moving_settlement` | `p_unit_id bigint, p_occupancy_id bigint, p_settlement_id bigint, p_data jsonb, p_checklist jsonb` | `jsonb` | D | 이사정산 저장 |
| `schedule_move_out` | `p_occupancy_id bigint, p_move_out_date date` | `date` | D | 퇴실 예약 |
| `update_settlement_inquiry_rows` | `p_rows jsonb` | `jsonb` | D |  |

### 메시지·포인트·Popbill 발송 (30)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `apply_fax_dispatch_result` | `p_job_id bigint, p_status text, p_send_pages integer, p_success_pages integer, p_fail_pages integer, p_charge_pages integer, p_refund_pages integer, p_next_poll_at timestamp with time zone` | `jsonb` | D |  |
| `apply_provider_dispatch_results` | `p_job_id bigint, p_results jsonb, p_next_poll_at timestamp with time zone` | `jsonb` | D | Popbill 결과 반영 |
| `attach_notice_to_message_log` | `p_log_id bigint, p_notice_id bigint` | `void` | D |  |
| `cancel_scheduled_message` | `p_schedule_id bigint` | `void` | D |  |
| `claim_due_message_schedules` | `p_org_id bigint, p_limit integer, p_stale_after interval` | `TABLE(id bigint, org_id bigint, channel text, body text, …` | D | 실행 시각 도래 예약 발송 선점(워커) |
| `claim_provider_dispatch_jobs` | `p_limit integer, p_provider_env text` | `SETOF provider_dispatch_jobs` | D | 폴링 대상 발송 작업 선점 |
| `claim_provider_dispatch_submission` | `p_reservation_id bigint, p_request_num text, p_owner uuid` | `jsonb` | D |  |
| `classify_message_product` | `p_body text, p_subject text` | `text` | I |  |
| `complete_message_schedule` | `p_schedule_id bigint, p_message_log_id bigint, p_final text` | `jsonb` | D |  |
| `create_fax_dispatch_job` | `p_bill_issue_id bigint, p_provider_env text` | `jsonb` | D | 팩스 고지서 발송 작업 생성 |
| `create_provider_dispatch_jobs` | `p_reservation_id bigint, p_jobs jsonb` | `jsonb` | D | Popbill 발송 작업 생성 |
| `enqueue_next_message_occurrence` | `p_schedule_id bigint` | `bigint` | D |  |
| `list_current_message_point_rates` | `-` | `TABLE(id bigint, channel text, points integer, effective_…` | D |  |
| `list_message_logs` | `p_limit integer` | `TABLE(id bigint, org_id bigint, channel text, body text, …` | D |  |
| `list_tenant_alimtalk_consent` | `p_building_id bigint` | `TABLE(occupancy_id bigint, alimtalk_opt_in boolean, sms_o…` | D |  |
| `load_fax_document` | `p_bill_issue_id bigint` | `jsonb` | D | 팩스 문서 데이터 로드 |
| `mark_fax_dispatch_result` | `p_job_id bigint, p_outcome text, p_receipt_num text, p_error_code text` | `jsonb` | D |  |
| `mark_message_reservation_provider_pending` | `p_reservation_id bigint, p_outcomes jsonb` | `jsonb` | D |  |
| `notice_send_summary` | `p_notice_id bigint` | `TABLE(recipient_count integer, sent_at timestamp with tim…` | D |  |
| `provision_default_alimtalk_templates` | `p_org_id bigint` | `integer` | D |  |
| `quote_message_points` | `p_mode text, p_recipients jsonb, p_template_id bigint, p_body text` | `jsonb` | D | 발송 포인트 견적 |
| `reserve_message_points` | `p_org_id bigint, p_requested_by uuid, p_idempotency_key uuid, p_payload_hash text, p_mode text, p_body text, p_context text, p_recipients jsonb, p_template_id bigint, p_confirmed_rate_ids jsonb, p_confirmed_points integer` | `jsonb` | D | 발송 포인트 예약 |
| `reserve_scheduled_message` | `p_schedule_id bigint` | `jsonb` | D |  |
| `resolve_message_point_quote` | `p_org_id bigint, p_mode text, p_recipients jsonb, p_template_id bigint, p_body text` | `jsonb` | D |  |
| `save_unit_occupancy_with_fax` | `p_building_id bigint, p_unit_id bigint, p_occupancy_id bigint, p_unit jsonb, p_occupancy jsonb, p_meters jsonb, p_accounts jsonb, p_lease jsonb, p_fax_number text` | `jsonb` | D |  |
| `schedule_messages` | `p_channel text, p_body text, p_context text, p_recipients jsonb, p_template_id bigint, p_scheduled_at timestamp with time zone, p_recurrence_mode text, p_recurrence_anchor_day integer` | `jsonb` | D | 메시지 예약 발송 등록 |
| `send_messages` | `p_channel text, p_body text, p_context text, p_recipients jsonb, p_template_id bigint` | `jsonb` | D | 메시지 즉시 발송 요청(포인트 예약 포함) |
| `settle_message_points` | `p_reservation_id bigint, p_provider_request_id text, p_results jsonb` | `jsonb` | D | 발송 결과 기준 포인트 정산 |
| `settle_message_points_from_jobs` | `p_reservation_id bigint` | `jsonb` | D |  |
| `sync_alimtalk_templates` | `p_templates jsonb` | `integer` | D |  |

### 건물·세대·입주 (14)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `delete_unit` | `p_unit_id bigint` | `void` | D | 세대 삭제 |
| `get_long_term_repair_ledger_opening_balance` | `p_building_id bigint, p_start_date date` | `numeric` | D |  |
| `list_buildings` | `p_search text, p_manager uuid, p_meter uuid, p_cleaning uuid, p_limit integer, p_offset integer` | `TABLE(id bigint, code text, name text, address text, mana…` | D |  |
| `list_customer_number_lookup` | `p_kind text, p_query text, p_limit integer, p_offset integer` | `TABLE(id bigint, building_id bigint, building_code text, …` | D |  |
| `list_long_term_repair_ledger` | `p_building_id bigint, p_start_date date, p_end_date date` | `TABLE(id bigint, org_id bigint, building_id bigint, entry…` | D |  |
| `list_occupancy_history` | `p_unit_id bigint` | `TABLE(id bigint, unit_id bigint, tenant_name text, phone …` | D |  |
| `list_tenants` | `p_building_id bigint` | `TABLE(unit_id bigint, occupancy_id bigint, unit_no text, …` | D |  |
| `save_building` | `p_id bigint, p_code text, p_name text, p_address text, p_manager_user_id uuid, p_meter_user_id uuid, p_cleaning_user_id uuid, p_facilities jsonb, p_memo text, p_customer_numbers jsonb, p_vendors jsonb, p_type_id bigint, p_entrance_password text, p_owner_name text, p_owner_phone text, p_billing_note text, p_reserve_fund jsonb, p_owner_extra jsonb, p_basic_extra jsonb, p_extra_info jsonb, p_vendor_details jsonb` | `jsonb` | D | 건물 저장(부가정보 포함) |
| `save_long_term_repair_ledger` | `p_building_id bigint, p_rows jsonb, p_deleted_ids bigint[]` | `bigint[]` | D |  |
| `save_unit_occupancy` | `p_building_id bigint, p_unit_id bigint, p_occupancy_id bigint, p_unit jsonb, p_occupancy jsonb, p_meters jsonb, p_accounts jsonb, p_lease jsonb` | `jsonb` | D |  |
| `save_unit_occupancy_full` | `p_building_id bigint, p_unit_id bigint, p_occupancy_id bigint, p_unit jsonb, p_occupancy jsonb, p_meters jsonb, p_accounts jsonb, p_lease jsonb, p_fax_number text, p_property jsonb` | `jsonb` | D | 세대·입주 정보 일괄 저장 |
| `set_building_setup_confirm` | `p_id bigint, p_required boolean` | `void` | D |  |
| `soft_delete_building` | `p_id bigint` | `void` | I | 건물 소프트 삭제 |
| `soft_delete_unit` | `p_id bigint` | `void` | I |  |

### 공지 (1)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `list_notice_org_recipients` | `-` | `TABLE(building_id bigint, unit_id bigint, occupancy_id bi…` | D |  |

### 유틸 (6)

| 함수 | 인자 | 반환 | 보안 | 기능 |
|---|---|---|---|---|
| `mask_phone` | `p_phone text` | `text` | I | 전화번호 마스킹 |
| `normalize_phone` | `p_phone text` | `text` | I | 전화번호 정규화 |
| `normalize_staff_capabilities` | `p_caps jsonb, p_primary staff_type` | `jsonb` | I |  |
| `provision_default_room_types` | `p_org_id bigint` | `void` | D |  |
| `provision_default_vendor_categories` | `p_org_id bigint` | `integer` | D |  |
| `purge_access_log` | `p_retention_days integer` | `bigint` | D | 접속기록 보존기간 경과분 삭제. 기본 730일(2년). service_role 전용이며 /api/cron/purge-access-log가 호출한다. |

## 6. 테이블 상세 명세

### `access_log`

<a id="access_log"></a>**도메인**: 감사·로그 · **행 수**: 356

**기능**: 개인정보 열람·내보내기·발송·공개링크 조회 접속기록(보존 730일, purge_access_log).

> PII access audit log. App-surface writes are append-only and service_role-only; org_id and actor_id intentionally have no foreign keys so history survives organization and actor deletion.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y | nextval('access_log_id_seq'::regclass) |  |
| 2 | `org_id` | bigint |  |  | Organization identifier snapshot. Intentionally has no foreign key so the log survives organization deletion. |
| 3 | `actor_id` | uuid |  |  | auth.users identifier snapshot. Intentionally has no foreign key so resident hard-delete cannot erase the audit trail. |
| 4 | `actor_label` | text |  |  | Login ID or display-name snapshot captured at event time. |
| 5 | `persona` | text |  |  |  |
| 6 | `event` | text | Y |  |  |
| 7 | `target_kind` | text |  |  |  |
| 8 | `target_id` | text |  |  |  |
| 9 | `field` | text |  |  | PII field revealed or included in the operation, such as phone, phone2, phone3, or fax_number. |
| 10 | `row_count` | integer |  |  |  |
| 11 | `detail` | jsonb |  |  |  |
| 12 | `ip` | text |  |  | Client IP snapshot stored as text, not inet: x-forwarded-for is attacker-controlled and a malformed value must never fail the insert. |
| 13 | `user_agent` | text |  |  |  |
| 14 | `created_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- CHECK: `CHECK ((event = ANY (ARRAY['PII_REVEAL', 'EXPORT_XLSX', 'EXPORT_CSV', 'PRINT', 'SEND_SMS', 'SEND_ALIMTALK', 'SEND_FAX', 'PUBLIC_LINK_VIEW'])))`
- CHECK: `CHECK ((persona = ANY (ARRAY['manager_staff', 'field_partner', 'platform_admin', 'resident', 'public'])))`

**인덱스**
- `CREATE INDEX access_log_org_created_at_idx ON public.access_log USING btree (org_id, created_at DESC)`
- `CREATE INDEX access_log_actor_created_at_idx ON public.access_log USING btree (actor_id, created_at DESC)`
- `CREATE INDEX access_log_event_created_at_idx ON public.access_log USING btree (event, created_at DESC)`
- `CREATE INDEX access_log_created_at_idx ON public.access_log USING btree (created_at)`

**RLS 정책**
- **access_log_select** (SELECT, authenticated): USING `(((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_is_manager_staff()) OR current_user_is_platform_admin())`

### `account_login_pins`

<a id="account_login_pins"></a>**도메인**: 조직·계정·권한 · **행 수**: 5

**기능**: 계정별 로그인 PIN(암호화 bytea). 협력업체 PIN 로그인에 사용.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `user_id` | uuid | Y |  |  |
| 2 | `pin_cipher` | bytea | Y |  |  |
| 3 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (user_id)`
- FK: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

**RLS 정책**
- 정책 없음 (RLS 활성 + 정책 없음 → anon/authenticated 접근 차단, service_role 전용)

### `app_secrets`

<a id="app_secrets"></a>**도메인**: 조직·계정·권한 · **행 수**: 1

**기능**: 서버 내부 비밀값 키-값 저장소(공유 링크 서명키 등). 클라이언트 접근 불가.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `key` | text | Y |  |  |
| 2 | `value` | text | Y |  |  |
| 3 | `created_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (key)`

**RLS 정책**
- 정책 없음 (RLS 활성 + 정책 없음 → anon/authenticated 접근 차단, service_role 전용)

### `as_categories`

<a id="as_categories"></a>**도메인**: 민원(AS)·공지 · **행 수**: 15

**기능**: AS(민원) 분류 마스터.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `label` | text | Y |  |  |
| 4 | `sort_order` | integer | Y | 0 |  |
| 5 | `deleted_at` | timestamp with time zone |  |  |  |
| 6 | `created_at` | timestamp with time zone | Y | now() |  |
| 7 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**트리거**
- `trg_as_categories_updated` → `set_updated_at()`

**RLS 정책**
- **asc_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `attachments`

<a id="attachments"></a>**도메인**: 업체·장기수선·기타 마스터 · **행 수**: 14

**기능**: 범용 첨부파일 메타(entity_type/entity_id 다형 참조, 10MB 제한).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `entity_type` | text | Y |  |  |
| 4 | `entity_id` | bigint | Y |  |  |
| 5 | `kind` | attachment_kind | Y | 'etc'::attachment_kind |  |
| 6 | `file_url` | text | Y |  |  |
| 7 | `file_name` | text |  |  |  |
| 8 | `uploaded_by` | uuid |  |  |  |
| 9 | `created_at` | timestamp with time zone | Y | now() |  |
| 10 | `mime_type` | text |  |  |  |
| 11 | `size_bytes` | bigint |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- CHECK: `CHECK (((size_bytes IS NULL) OR ((size_bytes >= 0) AND (size_bytes <= 10485760))))`

**인덱스**
- `CREATE INDEX attachments_entity_type_entity_id_idx ON public.attachments USING btree (entity_type, entity_id)`

**RLS 정책**
- **att_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `audit_log`

<a id="audit_log"></a>**도메인**: 감사·로그 · **행 수**: 2225

**기능**: 데이터 변경 감사 로그(before/after JSON).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint |  |  |  |
| 3 | `actor_id` | uuid |  |  |  |
| 4 | `action` | text | Y |  |  |
| 5 | `table_name` | text |  |  |  |
| 6 | `row_pk` | text |  |  |  |
| 7 | `before` | jsonb |  |  |  |
| 8 | `after` | jsonb |  |  |  |
| 9 | `ip` | inet |  |  |  |
| 10 | `created_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`

**인덱스**
- `CREATE INDEX audit_log_org_time_idx ON public.audit_log USING btree (org_id, created_at)`

**RLS 정책**
- **audit_select** (SELECT, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `bill_issues`

<a id="bill_issues"></a>**도메인**: 청구·고지서 · **행 수**: 37

**기능**: 고지서 발행 기록(A4·지로·카카오·팩스), 발송 상태·예약 시각·연결된 메시지 로그.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `period` | date | Y |  |  |
| 4 | `occupancy_id` | bigint |  |  |  |
| 5 | `issue_type` | text | Y |  |  |
| 6 | `group_no` | integer | Y | 1 |  |
| 7 | `due_date` | date |  |  |  |
| 8 | `unit_label_mode` | text | Y | 'code'::text |  |
| 9 | `auto_debit` | boolean | Y | false |  |
| 10 | `total_amount` | integer | Y | 0 |  |
| 11 | `send_status` | text | Y | 'none'::text |  |
| 12 | `issued_at` | timestamp with time zone | Y | now() |  |
| 13 | `issued_by` | uuid |  |  |  |
| 14 | `created_at` | timestamp with time zone | Y | now() |  |
| 15 | `updated_at` | timestamp with time zone | Y | now() |  |
| 16 | `water_cutoff` | boolean | Y | false |  |
| 17 | `scheduled_at` | timestamp with time zone |  |  |  |
| 18 | `message_log_id` | bigint |  |  |  |
| 19 | `message_schedule_id` | bigint |  |  |  |

**제약조건**
- UNIQUE: `UNIQUE (unit_id, period, issue_type)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (issued_by) REFERENCES profiles(user_id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (message_log_id) REFERENCES message_logs(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (message_schedule_id) REFERENCES message_schedules(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (occupancy_id) REFERENCES occupancies(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK ((issue_type = ANY (ARRAY['a4', 'giro', 'kakao', 'fax'])))`
- CHECK: `CHECK ((period = (date_trunc('month', (period)::timestamp with time zone))::date))`
- CHECK: `CHECK ((send_status = ANY (ARRAY['none', 'scheduled', 'queued', 'sent', 'partial', 'failed'])))`
- CHECK: `CHECK ((unit_label_mode = ANY (ARRAY['code', 'name'])))`

**인덱스**
- `CREATE INDEX bill_issues_unit_id_period_idx ON public.bill_issues USING btree (unit_id, period)`

**트리거**
- `trg_bill_issues_updated` → `set_updated_at()`

**RLS 정책**
- **bi_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`
- **bi_write** (ALL, authenticated): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('bill_publish'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('bill_publish'::text))`

### `bill_share_tokens`

<a id="bill_share_tokens"></a>**도메인**: 청구·고지서 · **행 수**: 1

**기능**: 고지서 공개 공유 링크 토큰(만료·폐기).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `token` | uuid | Y | gen_random_uuid() |  |
| 3 | `org_id` | bigint | Y |  |  |
| 4 | `unit_id` | bigint | Y |  |  |
| 5 | `period` | date | Y |  |  |
| 6 | `created_by` | uuid |  |  |  |
| 7 | `expires_at` | timestamp with time zone | Y |  |  |
| 8 | `created_at` | timestamp with time zone | Y | now() |  |
| 9 | `occupancy_id` | bigint |  |  |  |
| 10 | `revoked_at` | timestamp with time zone |  |  |  |

**제약조건**
- UNIQUE: `UNIQUE (token)`
- UNIQUE: `UNIQUE (unit_id, period)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (occupancy_id) REFERENCES occupancies(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK ((period = (date_trunc('month', (period)::timestamp with time zone))::date))`

**인덱스**
- `CREATE INDEX bill_share_tokens_occupancy_active_idx ON public.bill_share_tokens USING btree (occupancy_id) WHERE (revoked_at IS NULL)`

**RLS 정책**
- 정책 없음 (RLS 활성 + 정책 없음 → anon/authenticated 접근 차단, service_role 전용)

### `billing_confirmations`

<a id="billing_confirmations"></a>**도메인**: 청구·고지서 · **행 수**: 148

**기능**: 세대·월분 청구 확정 상태와 총액·청구 메모.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `period` | date | Y |  |  |
| 4 | `occupancy_id` | bigint |  |  |  |
| 5 | `total_amount` | integer | Y | 0 |  |
| 6 | `billing_note` | text |  |  |  |
| 7 | `unit_notice` | text |  |  |  |
| 8 | `confirmed_at` | timestamp with time zone |  |  |  |
| 9 | `confirmed_by` | uuid |  |  |  |
| 10 | `created_at` | timestamp with time zone | Y | now() |  |
| 11 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (unit_id, period)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (confirmed_by) REFERENCES profiles(user_id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (occupancy_id) REFERENCES occupancies(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK ((period = (date_trunc('month', (period)::timestamp with time zone))::date))`

**인덱스**
- `CREATE INDEX billing_confirmations_unit_id_period_idx ON public.billing_confirmations USING btree (unit_id, period)`

**트리거**
- `trg_billing_confirmations_updated` → `set_updated_at()`

**RLS 정책**
- **bc_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`
- **bc_write** (ALL, authenticated): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('billing'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('billing'::text))`

### `billing_history`

<a id="billing_history"></a>**도메인**: 청구·고지서 · **행 수**: 73

**기능**: 확정 시점의 청구 내역 스냅샷(items JSON).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `period` | date | Y |  |  |
| 4 | `occupancy_id` | bigint |  |  |  |
| 5 | `tenant_name` | text |  |  |  |
| 6 | `total_amount` | integer | Y |  |  |
| 7 | `items` | jsonb | Y |  |  |
| 8 | `confirmed_at` | timestamp with time zone | Y | now() |  |
| 9 | `confirmed_by` | uuid |  |  |  |
| 10 | `created_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (confirmed_by) REFERENCES profiles(user_id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (occupancy_id) REFERENCES occupancies(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX billing_history_unit_id_period_confirmed_at_idx ON public.billing_history USING btree (unit_id, period, confirmed_at DESC)`

**RLS 정책**
- **bh_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `billing_period_settings`

<a id="billing_period_settings"></a>**도메인**: 청구·고지서 · **행 수**: 9

**기능**: 건물·월분별 부과기준일(시작/종료)과 납기일.

> 건물·월분별 부과기준일 및 납기일

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `building_id` | bigint | Y |  |  |
| 3 | `period` | date | Y |  | 월분 첫날 |
| 4 | `charge_start_date` | date | Y |  | 부과기준 시작일 |
| 5 | `charge_end_date` | date | Y |  | 부과기준 종료일 |
| 6 | `due_date` | date |  |  | 납기일(미설정 시 null) |
| 7 | `created_at` | timestamp with time zone | Y | now() |  |
| 8 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE`
- CHECK: `CHECK ((charge_start_date <= charge_end_date))`
- CHECK: `CHECK ((period = (date_trunc('month', (period)::timestamp with time zone))::date))`

**인덱스**
- `CREATE INDEX billing_period_settings_period_idx ON public.billing_period_settings USING btree (period)`

**트리거**
- `trg_billing_period_settings_updated` → `set_updated_at()`

**RLS 정책**
- **bps_select** (SELECT, authenticated): USING `(building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`
- **bps_write** (ALL, authenticated): USING `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('billing'::text))` / CHECK `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('billing'::text))`

### `building_customer_numbers`

<a id="building_customer_numbers"></a>**도메인**: 건물·세대·입주 · **행 수**: 44

**기능**: 건물 단위 공과금 고객번호(수도·공용전기·전기·가스), 검침일·청구 기준(전월/당월)·계산 방식.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `building_id` | bigint | Y |  |  |
| 3 | `kind` | text | Y |  |  |
| 4 | `customer_no` | text | Y |  |  |
| 5 | `meter_day` | integer |  |  |  |
| 6 | `billing_basis` | text | Y | 'current'::text |  |
| 7 | `print_on_bill` | boolean | Y | true |  |
| 8 | `holder_name` | text |  |  |  |
| 9 | `sort_order` | integer | Y | 0 |  |
| 10 | `deleted_at` | timestamp with time zone |  |  |  |
| 11 | `created_at` | timestamp with time zone | Y | now() |  |
| 12 | `updated_at` | timestamp with time zone | Y | now() |  |
| 13 | `line_name` | text |  |  |  |
| 14 | `calculation_method` | text | Y | 'auto'::text |  |
| 15 | `note` | text |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE`
- CHECK: `CHECK ((billing_basis = ANY (ARRAY['prev', 'current'])))`
- CHECK: `CHECK ((calculation_method = ANY (ARRAY['auto', 'manual'])))`
- CHECK: `CHECK ((kind = ANY (ARRAY['water', 'common_elec', 'elec', 'gas'])))`
- CHECK: `CHECK (((meter_day >= 1) AND (meter_day <= 31)))`

**인덱스**
- `CREATE INDEX building_customer_numbers_building_id_idx ON public.building_customer_numbers USING btree (building_id)`

**트리거**
- `trg_building_customer_numbers_updated` → `set_updated_at()`

**RLS 정책**
- **bcn_write** (ALL, authenticated): USING `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('buildings'::text))` / CHECK `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('buildings'::text))`
- **bcn_select** (SELECT, authenticated): USING `(building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `building_types`

<a id="building_types"></a>**도메인**: 건물·세대·입주 · **행 수**: 5

**기능**: 건물 유형 마스터(조직별). 유형별 관리비 항목(fee_items)의 기준이며, 생성 시 필수 공과금 항목(전기·수도료·가스)을 시드한다.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `label` | text | Y |  |  |
| 4 | `sort_order` | integer | Y | 0 |  |
| 5 | `created_at` | timestamp with time zone | Y | now() |  |
| 6 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (org_id, label)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**트리거**
- `trg_building_types_updated` → `set_updated_at()`
- `building_types_seed_required_utility_fee_items` → `seed_required_utility_fee_items()`

**RLS 정책**
- **bt_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `building_utility_suppliers`

<a id="building_utility_suppliers"></a>**도메인**: 건물·세대·입주 · **행 수**: 0

**기능**: 건물별 공과금 공급사 및 납부 계좌 정보.

> Building-level utility supplier and payment information

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  | Utility supplier row identifier |
| 2 | `building_id` | bigint | Y |  | Building that uses the utility supplier |
| 3 | `utility` | text | Y |  | Utility code: water, elec, or gas |
| 4 | `company_name` | text |  |  | Utility supplier company name |
| 5 | `phone` | text |  |  | Utility supplier phone number |
| 6 | `bank` | text |  |  | Bank name for utility payments |
| 7 | `account_no` | text |  |  | Bank account number for utility payments |
| 8 | `account_holder` | text |  |  | Bank account holder for utility payments |
| 9 | `created_at` | timestamp with time zone | Y | now() | Row creation timestamp |
| 10 | `updated_at` | timestamp with time zone | Y | now() | Row last-updated timestamp |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE`
- CHECK: `CHECK ((utility = ANY (ARRAY['water', 'elec', 'gas'])))`

**트리거**
- `trg_building_utility_suppliers_updated` → `set_updated_at()`

**RLS 정책**
- **bus_select** (SELECT, authenticated): USING `(building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`
- **bus_write** (ALL, authenticated): USING `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))` / CHECK `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))`

### `building_vendors`

<a id="building_vendors"></a>**도메인**: 건물·세대·입주 · **행 수**: 10

**기능**: 건물별 협력업체 연락처(승강기·소방·전기·정화조 등).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `building_id` | bigint | Y |  |  |
| 3 | `vendor_type` | text | Y |  |  |
| 4 | `name` | text | Y |  |  |
| 5 | `phone` | text |  |  |  |
| 6 | `memo` | text |  |  |  |
| 7 | `sort_order` | integer | Y | 0 |  |
| 8 | `deleted_at` | timestamp with time zone |  |  |  |
| 9 | `created_at` | timestamp with time zone | Y | now() |  |
| 10 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE`
- CHECK: `CHECK ((vendor_type = ANY (ARRAY['elevator', 'fire', 'electric', 'septic', 'etc'])))`

**인덱스**
- `CREATE INDEX building_vendors_building_id_idx ON public.building_vendors USING btree (building_id)`

**트리거**
- `trg_building_vendors_updated` → `set_updated_at()`

**RLS 정책**
- **bv_write** (ALL, authenticated): USING `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('buildings'::text))` / CHECK `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('buildings'::text))`
- **bv_select** (SELECT, authenticated): USING `(building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `buildings`

<a id="buildings"></a>**도메인**: 건물·세대·입주 · **행 수**: 14

**기능**: 건물 기본정보. 담당자(관리·검침·청소), 시설(facilities)·소유주·장기수선 적립 등 부가정보 JSON, 청구 메모를 보관.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `code` | text | Y |  |  |
| 4 | `name` | text | Y |  |  |
| 5 | `address` | text |  |  |  |
| 6 | `type_id` | bigint |  |  |  |
| 7 | `owner_name` | text |  |  |  |
| 8 | `owner_phone` | text |  |  |  |
| 9 | `entrance_password` | text |  |  |  |
| 13 | `memo` | text |  |  |  |
| 14 | `deleted_at` | timestamp with time zone |  |  |  |
| 15 | `created_at` | timestamp with time zone | Y | now() |  |
| 16 | `updated_at` | timestamp with time zone | Y | now() |  |
| 17 | `manager_user_id` | uuid |  |  |  |
| 18 | `meter_user_id` | uuid |  |  |  |
| 19 | `cleaning_user_id` | uuid |  |  |  |
| 20 | `facilities` | jsonb | Y | '{}'::jsonb |  |
| 21 | `billing_note` | text |  |  |  |
| 22 | `setup_confirm_required` | boolean | Y | false |  |
| 23 | `reserve_fund` | jsonb |  |  |  |
| 24 | `owner_extra` | jsonb |  |  |  |
| 25 | `basic_extra` | jsonb |  |  |  |
| 26 | `extra_info` | jsonb |  |  |  |
| 27 | `vendor_details` | jsonb |  |  |  |

**제약조건**
- UNIQUE: `UNIQUE (org_id, code)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (cleaning_user_id) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (manager_user_id) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (meter_user_id) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (type_id) REFERENCES building_types(id) ON DELETE SET NULL`

**인덱스**
- `CREATE INDEX buildings_org_id_meter_user_id_idx ON public.buildings USING btree (org_id, meter_user_id)`
- `CREATE INDEX buildings_org_id_manager_user_id_idx ON public.buildings USING btree (org_id, manager_user_id)`
- `CREATE INDEX buildings_org_id_cleaning_user_id_idx ON public.buildings USING btree (org_id, cleaning_user_id)`

**트리거**
- `trg_buildings_updated` → `set_updated_at()`

**RLS 정책**
- **bld_select** (SELECT, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`
- **building_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`
- **bld_write** (ALL, authenticated): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('buildings'::text))` / CHECK `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('buildings'::text))`

### `cleaning_teams`

<a id="cleaning_teams"></a>**도메인**: 업체·장기수선·기타 마스터 · **행 수**: 0

**기능**: 청소팀 마스터.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `label` | text | Y |  |  |
| 4 | `sort_order` | integer | Y | 0 |  |
| 5 | `deleted_at` | timestamp with time zone |  |  |  |
| 6 | `created_at` | timestamp with time zone | Y | now() |  |
| 7 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**트리거**
- `trg_cleaning_teams_updated` → `set_updated_at()`

**RLS 정책**
- **ct_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `complaint_resolutions`

<a id="complaint_resolutions"></a>**도메인**: 민원(AS)·공지 · **행 수**: 32

**기능**: 민원 처리 결과.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `complaint_id` | bigint | Y |  |  |
| 3 | `result_content` | text |  |  |  |
| 4 | `result_notes` | text |  |  |  |
| 5 | `resolved_by` | uuid |  |  |  |
| 6 | `resolved_at` | timestamp with time zone |  |  |  |
| 7 | `created_at` | timestamp with time zone | Y | now() |  |
| 8 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL`

**인덱스**
- `CREATE INDEX complaint_resolutions_complaint_id_idx ON public.complaint_resolutions USING btree (complaint_id)`

**트리거**
- `trg_complaint_resolutions_updated` → `set_updated_at()`

**RLS 정책**
- **cr_all** (ALL, authenticated): USING `(complaint_id IN ( SELECT complaints.id
   FROM complaints
  WHERE (complaints.org_id IN ( SELECT my_org_ids() AS my_org_ids))))` / CHECK `(complaint_id IN ( SELECT complaints.id
   FROM complaints
  WHERE (complaints.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `complaints`

<a id="complaints"></a>**도메인**: 민원(AS)·공지 · **행 수**: 34

**기능**: 민원/AS 접수(건물·세대·분류·상태·담당자).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `building_id` | bigint | Y |  |  |
| 4 | `unit_id` | bigint |  |  |  |
| 5 | `category_id` | bigint |  |  |  |
| 6 | `title` | text | Y |  |  |
| 7 | `content` | text |  |  |  |
| 8 | `status` | text | Y | 'pending'::text |  |
| 9 | `reporter_name` | text |  |  |  |
| 10 | `reporter_phone` | text |  |  |  |
| 11 | `assigned_to` | uuid |  |  |  |
| 12 | `received_at` | timestamp with time zone | Y | now() |  |
| 13 | `completed_at` | timestamp with time zone |  |  |  |
| 14 | `created_by` | uuid |  |  |  |
| 15 | `deleted_at` | timestamp with time zone |  |  |  |
| 16 | `created_at` | timestamp with time zone | Y | now() |  |
| 17 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (category_id) REFERENCES as_categories(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL`

**인덱스**
- `CREATE INDEX complaints_active_org_status_idx ON public.complaints USING btree (org_id, status) WHERE (deleted_at IS NULL)`
- `CREATE INDEX complaints_org_id_received_at_idx ON public.complaints USING btree (org_id, received_at)`
- `CREATE INDEX complaints_org_id_building_id_status_idx ON public.complaints USING btree (org_id, building_id, status)`

**트리거**
- `trg_complaints_updated` → `set_updated_at()`

**RLS 정책**
- **cpl_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `fee_item_charges`

<a id="fee_item_charges"></a>**도메인**: 청구·고지서 · **행 수**: 584

**기능**: 세대·월분·항목별 부과 금액.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `fee_item_id` | bigint | Y |  |  |
| 4 | `period` | date | Y |  |  |
| 5 | `occupancy_id` | bigint |  |  |  |
| 6 | `charged` | boolean | Y | true |  |
| 7 | `amount` | integer | Y | 0 |  |
| 8 | `created_at` | timestamp with time zone | Y | now() |  |
| 9 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (unit_id, fee_item_id, period)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (fee_item_id) REFERENCES fee_items(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (occupancy_id) REFERENCES occupancies(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK ((period = (date_trunc('month', (period)::timestamp with time zone))::date))`

**인덱스**
- `CREATE INDEX fee_item_charges_fee_item_id_idx ON public.fee_item_charges USING btree (fee_item_id)`
- `CREATE INDEX fee_item_charges_unit_id_period_idx ON public.fee_item_charges USING btree (unit_id, period)`

**트리거**
- `trg_fee_item_charges_updated` → `set_updated_at()`

**RLS 정책**
- **fic_write** (ALL, authenticated): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('billing'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('billing'::text))`
- **fic_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `fee_items`

<a id="fee_items"></a>**도메인**: 청구·고지서 · **행 수**: 35

**기능**: 건물 유형별 관리비 부과 항목(반올림 방식·일할계산·이월·필수 여부).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `type_id` | bigint | Y |  |  |
| 4 | `name` | text | Y |  |  |
| 5 | `rounding` | fee_rounding | Y | 'round'::fee_rounding |  |
| 6 | `daily_proration` | boolean | Y | false |  |
| 7 | `carry_over` | boolean | Y | false |  |
| 8 | `is_required` | boolean | Y | false |  |
| 9 | `sort_order` | integer | Y | 0 |  |
| 10 | `deleted_at` | timestamp with time zone |  |  |  |
| 11 | `created_at` | timestamp with time zone | Y | now() |  |
| 12 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (type_id, name)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (type_id) REFERENCES building_types(id) ON DELETE CASCADE`
- CHECK: `CHECK (((name <> ALL (ARRAY['전기', '수도료', '가스'])) OR (is_required AND (deleted_at IS NULL))))`

**인덱스**
- `CREATE INDEX fee_items_org_id_type_id_sort_order_idx ON public.fee_items USING btree (org_id, type_id, sort_order)`

**트리거**
- `trg_fee_items_updated` → `set_updated_at()`
- `fee_items_restore_deleted_required_utility` → `restore_required_utility_fee_items()`
- `fee_items_restore_renamed_required_utility` → `restore_required_utility_fee_items()`

**RLS 정책**
- **fi_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `late_fee_rate_tiers`

<a id="late_fee_rate_tiers"></a>**도메인**: 청구·고지서 · **행 수**: 12

**기능**: 연체 개월 구간별 월 연체 요율.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `tier_order` | integer | Y |  |  |
| 4 | `from_month` | integer | Y |  |  |
| 5 | `to_month` | integer |  |  |  |
| 6 | `monthly_rate` | numeric(6,4) | Y |  |  |
| 7 | `created_at` | timestamp with time zone | Y | now() |  |
| 8 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- CHECK: `CHECK (((to_month IS NULL) OR (to_month > from_month)))`
- CHECK: `CHECK ((from_month >= 0))`
- CHECK: `CHECK ((monthly_rate >= (0)::numeric))`

**인덱스**
- `CREATE INDEX idx_late_fee_rate_tiers_org ON public.late_fee_rate_tiers USING btree (org_id, tier_order)`

**RLS 정책**
- **lfrt_select** (SELECT, public): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`
- **lfrt_write** (ALL, public): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('billing'::text))` / CHECK `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('billing'::text))`

### `lease_contracts`

<a id="lease_contracts"></a>**도메인**: 건물·세대·입주 · **행 수**: 6

**기능**: 입주(occupancy)별 임대차 계약(보증금·월세·계약기간·만기 알림).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `occupancy_id` | bigint | Y |  |  |
| 3 | `deposit` | bigint |  |  |  |
| 4 | `monthly_rent` | bigint |  |  |  |
| 5 | `start_date` | date |  |  |  |
| 6 | `end_date` | date |  |  |  |
| 7 | `expiry_alert` | boolean | Y | false |  |
| 8 | `created_at` | timestamp with time zone | Y | now() |  |
| 9 | `updated_at` | timestamp with time zone | Y | now() |  |
| 10 | `lease_type` | text |  |  |  |
| 11 | `deposit_date` | date |  |  |  |
| 12 | `jeonse_deposit` | bigint |  |  |  |
| 13 | `bank_account` | text |  |  |  |

**제약조건**
- UNIQUE: `UNIQUE (occupancy_id)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (occupancy_id) REFERENCES occupancies(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX lease_contracts_occupancy_id_idx ON public.lease_contracts USING btree (occupancy_id)`

**트리거**
- `trg_lease_contracts_updated` → `set_updated_at()`

**RLS 정책**
- **lc_write** (ALL, authenticated): USING `((occupancy_id IN ( SELECT o.id
   FROM ((occupancies o
     JOIN units u ON ((u.id = o.unit_id)))
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))` / CHECK `((occupancy_id IN ( SELECT o.id
   FROM ((occupancies o
     JOIN units u ON ((u.id = o.unit_id)))
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))`
- **lc_select** (SELECT, authenticated): USING `(occupancy_id IN ( SELECT o.id
   FROM ((occupancies o
     JOIN units u ON ((u.id = o.unit_id)))
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `login_rate_limit`

<a id="login_rate_limit"></a>**도메인**: 조직·계정·권한 · **행 수**: 12

**기능**: 로그인 무차별 대입 방지 버킷. service_role이 login_rate_limit_hit()로만 기록.

> Login brute-force throttling buckets. Written only by service_role via login_rate_limit_hit(). Rows are self-expiring by window; safe to periodically delete where updated_at < now() - interval '1 day'.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `bucket_key` | text | Y |  |  |
| 2 | `fail_count` | integer | Y | 0 |  |
| 3 | `window_started_at` | timestamp with time zone | Y | now() |  |
| 4 | `locked_until` | timestamp with time zone |  |  |  |
| 5 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (bucket_key)`

**RLS 정책**
- 정책 없음 (RLS 활성 + 정책 없음 → anon/authenticated 접근 차단, service_role 전용)

### `long_term_repair_history`

<a id="long_term_repair_history"></a>**도메인**: 업체·장기수선·기타 마스터 · **행 수**: 0

**기능**: 장기수선 공사 이력.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `building_id` | bigint | Y |  |  |
| 4 | `work_name` | text | Y |  |  |
| 5 | `work_date` | date |  |  |  |
| 6 | `amount` | bigint |  |  |  |
| 7 | `memo` | text |  |  |  |
| 8 | `deleted_at` | timestamp with time zone |  |  |  |
| 9 | `created_at` | timestamp with time zone | Y | now() |  |
| 10 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX long_term_repair_history_org_id_building_id_idx ON public.long_term_repair_history USING btree (org_id, building_id)`

**트리거**
- `trg_long_term_repair_history_updated` → `set_updated_at()`

**RLS 정책**
- **ltr_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `long_term_repair_ledger`

<a id="long_term_repair_ledger"></a>**도메인**: 업체·장기수선·기타 마스터 · **행 수**: 12

**기능**: 건물별 장기수선충당금 입출금 원장(감사 트리거).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `building_id` | bigint | Y |  |  |
| 4 | `entry_date` | date | Y |  |  |
| 5 | `entry_no` | text | Y | ''::text |  |
| 6 | `fund_note` | text | Y | ''::text |  |
| 7 | `deposit` | bigint | Y | 0 |  |
| 8 | `withdrawal` | bigint | Y | 0 |  |
| 9 | `memo` | text |  |  |  |
| 10 | `deleted_at` | timestamp with time zone |  |  |  |
| 11 | `created_at` | timestamp with time zone | Y | now() |  |
| 12 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- CHECK: `CHECK ((deposit >= 0))`
- CHECK: `CHECK ((withdrawal >= 0))`

**인덱스**
- `CREATE INDEX long_term_repair_ledger_order_idx ON public.long_term_repair_ledger USING btree (building_id, entry_date, entry_no, id) WHERE (deleted_at IS NULL)`
- `CREATE INDEX long_term_repair_ledger_org_building_idx ON public.long_term_repair_ledger USING btree (org_id, building_id)`

**트리거**
- `trg_long_term_repair_ledger_updated` → `set_updated_at()`
- `trg_long_term_repair_ledger_audit` → `audit_long_term_repair_ledger_change()`

**RLS 정책**
- **ltr_ledger_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `message_logs`

<a id="message_logs"></a>**도메인**: 메시지·포인트·발송 · **행 수**: 18

**기능**: 메시지 발송 로그(채널·본문·수신자·결과·포인트 상태·연결 공지).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `channel` | text | Y |  |  |
| 4 | `body` | text | Y |  |  |
| 5 | `context` | text | Y | 'manual'::text |  |
| 6 | `recipient_count` | integer | Y | 0 |  |
| 7 | `recipients` | jsonb | Y | '[]'::jsonb |  |
| 8 | `result` | text | Y | 'stub'::text |  |
| 9 | `sent_by` | uuid |  |  |  |
| 10 | `sent_at` | timestamp with time zone | Y | now() |  |
| 11 | `created_at` | timestamp with time zone | Y | now() |  |
| 12 | `template_id` | bigint |  |  |  |
| 13 | `estimated_points` | integer | Y | 0 |  |
| 14 | `charged_points` | integer | Y | 0 |  |
| 15 | `point_status` | text | Y | 'none'::text |  |
| 16 | `notice_id` | bigint |  |  | 이 발송이 속한 공지(있으면). 공지 상세의 발송 이력 집계에 사용. |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (sent_by) REFERENCES profiles(user_id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (template_id) REFERENCES message_templates(id)`
- CHECK: `CHECK ((channel = ANY (ARRAY['sms', 'alimtalk', 'auto'])))`
- CHECK: `CHECK ((charged_points >= 0))`
- CHECK: `CHECK ((estimated_points >= 0))`
- CHECK: `CHECK ((point_status = ANY (ARRAY['none', 'quoted', 'reserved', 'provider_pending', 'settled', 'released', 'reconcile_required'])))`
- CHECK: `CHECK ((result = ANY (ARRAY['stub', 'queued', 'sent', 'partial', 'failed'])))`

**인덱스**
- `CREATE INDEX message_logs_org_id_sent_at_idx ON public.message_logs USING btree (org_id, sent_at DESC)`
- `CREATE INDEX message_logs_notice_idx ON public.message_logs USING btree (notice_id) WHERE (notice_id IS NOT NULL)`

**RLS 정책**
- **ml_select** (SELECT, authenticated): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('messaging'::text))`

### `message_point_rates`

<a id="message_point_rates"></a>**도메인**: 메시지·포인트·발송 · **행 수**: 0

**기능**: 채널별 포인트 단가(유효기간 이력).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `channel` | text | Y |  |  |
| 3 | `points` | integer | Y |  |  |
| 4 | `effective_from` | timestamp with time zone | Y | now() |  |
| 5 | `effective_to` | timestamp with time zone |  |  |  |
| 6 | `created_by` | uuid |  |  |  |
| 7 | `created_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL`
- CHECK: `CHECK ((channel = ANY (ARRAY['sms', 'lms', 'alimtalk'])))`
- CHECK: `CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))`
- CHECK: `CHECK ((points > 0))`

**인덱스**
- `CREATE INDEX message_point_rates_history_idx ON public.message_point_rates USING btree (channel, effective_from DESC)`

**RLS 정책**
- 정책 없음 (RLS 활성 + 정책 없음 → anon/authenticated 접근 차단, service_role 전용)

### `message_point_reservations`

<a id="message_point_reservations"></a>**도메인**: 메시지·포인트·발송 · **행 수**: 3

**기능**: 발송 전 포인트 예약(멱등키·수신자별 비용·정산/해제 상태).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `message_log_id` | bigint | Y |  |  |
| 4 | `idempotency_key` | uuid | Y |  |  |
| 5 | `payload_hash` | text | Y |  |  |
| 6 | `status` | text | Y |  |  |
| 7 | `reserved_points` | integer | Y |  |  |
| 8 | `charged_points` | integer | Y | 0 |  |
| 9 | `rate_snapshot` | jsonb | Y |  |  |
| 10 | `recipient_costs` | jsonb | Y |  |  |
| 11 | `provider_request_id` | text |  |  |  |
| 12 | `requested_by` | uuid |  |  |  |
| 13 | `expires_at` | timestamp with time zone | Y |  |  |
| 14 | `settled_at` | timestamp with time zone |  |  |  |
| 15 | `created_at` | timestamp with time zone | Y | now() |  |
| 16 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (message_log_id)`
- UNIQUE: `UNIQUE (org_id, idempotency_key)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (message_log_id) REFERENCES message_logs(id) ON DELETE RESTRICT`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT`
- FK: `FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL`
- CHECK: `CHECK ((charged_points >= 0))`
- CHECK: `CHECK ((charged_points <= reserved_points))`
- CHECK: `CHECK (((length(payload_hash) >= 1) AND (length(payload_hash) <= 128)))`
- CHECK: `CHECK ((jsonb_typeof(rate_snapshot) = 'object'))`
- CHECK: `CHECK ((jsonb_typeof(recipient_costs) = 'array'))`
- CHECK: `CHECK ((reserved_points >= 0))`
- CHECK: `CHECK ((status = ANY (ARRAY['reserved', 'provider_pending', 'settled', 'released', 'reconcile_required'])))`

**인덱스**
- `CREATE INDEX message_point_reservations_expiry_idx ON public.message_point_reservations USING btree (expires_at) WHERE (status = 'reserved'::text)`
- `CREATE INDEX message_point_reservations_org_status_idx ON public.message_point_reservations USING btree (org_id, status, created_at DESC)`
- `CREATE INDEX message_point_reservations_status_created_at_id_idx ON public.message_point_reservations USING btree (status, created_at DESC, id DESC)`

**트리거**
- `trg_message_point_reservations_updated` → `set_updated_at()`

**RLS 정책**
- **message_point_reservations_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`

### `message_schedules`

<a id="message_schedules"></a>**도메인**: 메시지·포인트·발송 · **행 수**: 23

**기능**: 예약/반복(월간) 발송 스케줄.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `channel` | text | Y |  |  |
| 4 | `body` | text | Y |  |  |
| 5 | `context` | text | Y | 'manual'::text |  |
| 6 | `recipient_count` | integer | Y | 0 |  |
| 7 | `recipients` | jsonb | Y | '[]'::jsonb |  |
| 8 | `template_id` | bigint |  |  |  |
| 9 | `scheduled_at` | timestamp with time zone | Y |  |  |
| 10 | `status` | text | Y | 'scheduled'::text |  |
| 11 | `created_by` | uuid |  |  |  |
| 12 | `cancelled_at` | timestamp with time zone |  |  |  |
| 13 | `created_at` | timestamp with time zone | Y | now() |  |
| 14 | `updated_at` | timestamp with time zone | Y | now() |  |
| 15 | `claimed_at` | timestamp with time zone |  |  |  |
| 16 | `message_log_id` | bigint |  |  |  |
| 17 | `recurrence_mode` | text |  |  |  |
| 18 | `recurrence_anchor_day` | integer |  |  |  |
| 19 | `recurrence_parent_id` | bigint |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (message_log_id) REFERENCES message_logs(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (recurrence_parent_id) REFERENCES message_schedules(id) ON DELETE SET NULL`
- CHECK: `CHECK ((channel = ANY (ARRAY['sms', 'alimtalk', 'auto'])))`
- CHECK: `CHECK (((recurrence_anchor_day IS NULL) OR ((recurrence_anchor_day >= 1) AND (recurrence_anchor_day <= 31))))`
- CHECK: `CHECK (((recurrence_mode IS NULL) OR (recurrence_mode = 'monthly')))`
- CHECK: `CHECK ((status = ANY (ARRAY['scheduled', 'sending', 'cancelled', 'sent', 'partial', 'failed'])))`

**인덱스**
- `CREATE INDEX message_schedules_due_idx ON public.message_schedules USING btree (scheduled_at) WHERE (status = ANY (ARRAY['scheduled'::text, 'sending'::text]))`
- `CREATE INDEX message_schedules_message_log_idx ON public.message_schedules USING btree (message_log_id) WHERE (message_log_id IS NOT NULL)`
- `CREATE INDEX message_schedules_org_scheduled_idx ON public.message_schedules USING btree (org_id, scheduled_at DESC)`

**트리거**
- `trg_message_schedules_updated` → `set_updated_at()`
- `trg_message_schedules_enqueue_next` → `message_schedules_enqueue_next_occurrence()`

**RLS 정책**
- **message_schedules_select** (SELECT, authenticated): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('messaging'::text))`

### `message_templates`

<a id="message_templates"></a>**도메인**: 메시지·포인트·발송 · **행 수**: 1

**기능**: 메시지 템플릿(SMS/알림톡, 알림톡 템플릿 코드·버튼).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `title` | text | Y |  |  |
| 4 | `body` | text | Y |  |  |
| 5 | `sort_order` | integer | Y | 0 |  |
| 6 | `deleted_at` | timestamp with time zone |  |  |  |
| 7 | `created_at` | timestamp with time zone | Y | now() |  |
| 8 | `updated_at` | timestamp with time zone | Y | now() |  |
| 9 | `category` | text |  |  |  |
| 10 | `channel_type` | text | Y | 'sms'::text |  |
| 11 | `alimtalk_template_code` | text |  |  |  |
| 12 | `buttons` | jsonb | Y | '[]'::jsonb |  |

**제약조건**
- UNIQUE: `UNIQUE (org_id, title)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX message_templates_org_idx ON public.message_templates USING btree (org_id, sort_order)`
- `CREATE INDEX message_templates_alimtalk_code_idx ON public.message_templates USING btree (org_id, alimtalk_template_code) WHERE (alimtalk_template_code IS NOT NULL)`

**트리거**
- `trg_message_templates_updated` → `set_updated_at()`

**RLS 정책**
- **mt_insert** (INSERT, authenticated): USING `-` / CHECK `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('messaging'::text))`
- **mt_select** (SELECT, authenticated): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('messaging'::text))`
- **mt_update** (UPDATE, authenticated): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('messaging'::text))` / CHECK `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('messaging'::text))`

### `meter_readings`

<a id="meter_readings"></a>**도메인**: 검침·공과금 · **행 수**: 338

**기능**: 세대·공과금·월분별 검침값(전월/당월/사용량), 단가·계산요금·감면·수동요금, 확인필요 플래그.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `utility` | text | Y |  |  |
| 4 | `period` | date | Y |  |  |
| 5 | `previous_reading` | numeric(12,2) |  |  |  |
| 6 | `current_reading` | numeric(12,2) |  |  |  |
| 7 | `usage` | numeric(12,2) |  |  |  |
| 8 | `unit_price` | numeric(12,2) |  |  |  |
| 9 | `calc_charge` | integer |  |  |  |
| 10 | `discount_amount` | integer |  |  |  |
| 11 | `manual_charge` | integer |  |  |  |
| 12 | `note` | text |  |  |  |
| 13 | `processed_at` | timestamp with time zone |  |  |  |
| 14 | `created_at` | timestamp with time zone | Y | now() |  |
| 15 | `updated_at` | timestamp with time zone | Y | now() |  |
| 16 | `needs_review` | boolean | Y | false | True when the reading needs operator correction (e.g. negative computed usage from a meter rollover/replacement). Blocks confirmation and drives the client 확인필요 indicator. |

**제약조건**
- UNIQUE: `UNIQUE (unit_id, utility, period)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK ((utility = ANY (ARRAY['water', 'elec', 'gas'])))`

**인덱스**
- `CREATE INDEX meter_readings_needs_review_idx ON public.meter_readings USING btree (unit_id, utility, period) WHERE needs_review`
- `CREATE INDEX meter_readings_unit_id_utility_period_idx ON public.meter_readings USING btree (unit_id, utility, period DESC)`

**트리거**
- `trg_meter_readings_updated` → `set_updated_at()`

**RLS 정책**
- **mr_write** (ALL, authenticated): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))`
- **mr_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `move_out_requests`

<a id="move_out_requests"></a>**도메인**: 이사정산·퇴실 · **행 수**: 4

**기능**: 입주민 퇴실 신청(희망일·사유·처리 상태).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `resident_user_id` | uuid | Y |  |  |
| 4 | `occupancy_id` | bigint |  |  |  |
| 5 | `unit_id` | bigint |  |  |  |
| 6 | `building_id` | bigint |  |  |  |
| 7 | `desired_date` | date | Y |  |  |
| 8 | `reason` | text |  |  |  |
| 9 | `status` | text | Y | 'pending'::text |  |
| 10 | `created_at` | timestamp with time zone | Y | now() |  |
| 11 | `updated_at` | timestamp with time zone | Y | now() |  |
| 12 | `canceled_at` | timestamp with time zone |  |  |  |
| 13 | `resolved_at` | timestamp with time zone |  |  |  |
| 14 | `resolved_by` | uuid |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (occupancy_id) REFERENCES occupancies(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (resident_user_id) REFERENCES auth.users(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL`
- CHECK: `CHECK ((status = ANY (ARRAY['pending', 'confirmed', 'canceled', 'rejected', 'done'])))`

**인덱스**
- `CREATE INDEX move_out_requests_org_status_idx ON public.move_out_requests USING btree (org_id, status)`
- `CREATE INDEX move_out_requests_resident_user_idx ON public.move_out_requests USING btree (resident_user_id)`

**트리거**
- `trg_move_out_requests_updated` → `set_updated_at()`

**RLS 정책**
- **move_out_requests_resident_update** (UPDATE, authenticated): USING `((resident_user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text))` / CHECK `((resident_user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text))`
- **move_out_requests_staff_select** (SELECT, authenticated): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('tenants'::text))`
- **move_out_requests_staff_update** (UPDATE, authenticated): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('tenants'::text))` / CHECK `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('tenants'::text))`
- **move_out_requests_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`
- **move_out_requests_resident_insert** (INSERT, authenticated): USING `-` / CHECK `((resident_user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text))`
- **move_out_requests_resident_select** (SELECT, authenticated): USING `(resident_user_id = ( SELECT auth.uid() AS uid))`

### `moving_settlements`

<a id="moving_settlements"></a>**도메인**: 이사정산·퇴실 · **행 수**: 12

**기능**: 이사(퇴실) 정산서: 관리비 일할, 공과금, 수리비·귀책, 청소비, 정산 계좌, 상태(draft→saved→mid_moveout→completed). 트리거로 정산금액 자동 계산.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `occupancy_id` | bigint |  |  |  |
| 4 | `move_out_date` | date |  |  |  |
| 5 | `mgmt_fee_monthly` | integer |  |  |  |
| 6 | `mgmt_fee_prorated` | integer |  |  |  |
| 7 | `water_charge` | integer |  |  |  |
| 8 | `elec_charge` | integer |  |  |  |
| 9 | `gas_charge` | integer |  |  |  |
| 10 | `elec_paid_date` | date |  |  |  |
| 11 | `gas_paid_date` | date |  |  |  |
| 12 | `repair_amount` | integer |  |  |  |
| 13 | `repair_attribution` | text |  |  |  |
| 14 | `repair_memo` | text |  |  |  |
| 15 | `settle_bank` | text |  |  |  |
| 16 | `settle_acct` | text |  |  |  |
| 17 | `settle_holder` | text |  |  |  |
| 18 | `settlement_amount` | integer |  |  |  |
| 19 | `note` | text |  |  |  |
| 20 | `settlement_note` | text |  |  |  |
| 21 | `status` | text | Y | 'draft'::text |  |
| 22 | `processed_at` | timestamp with time zone |  |  |  |
| 23 | `created_at` | timestamp with time zone | Y | now() |  |
| 24 | `updated_at` | timestamp with time zone | Y | now() |  |
| 25 | `extra` | jsonb |  |  |  |
| 26 | `cleaning_cost` | integer |  |  |  |
| 27 | `checked_by` | uuid |  |  |  |
| 28 | `water_paid_date` | date |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (checked_by) REFERENCES profiles(user_id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (occupancy_id) REFERENCES occupancies(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK ((repair_attribution = ANY (ARRAY['owner', 'manager', 'office'])))`
- CHECK: `CHECK ((status = ANY (ARRAY['draft', 'saved', 'mid_moveout', 'completed'])))`

**인덱스**
- `CREATE INDEX moving_settlements_unit_id_created_at_idx ON public.moving_settlements USING btree (unit_id, created_at DESC)`
- `CREATE INDEX moving_settlements_move_out_date_idx ON public.moving_settlements USING btree (move_out_date DESC, created_at DESC)`

**트리거**
- `trg_moving_settlements_updated` → `set_updated_at()`
- `trg_moving_settlement_amount` → `set_moving_settlement_amount()`

**RLS 정책**
- **ms_write** (ALL, authenticated): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('moving'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('moving'::text))`
- **ms_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `notice_buildings`

<a id="notice_buildings"></a>**도메인**: 민원(AS)·공지 · **행 수**: 6

**기능**: 공지 대상 건물(다중). 링크가 없으면 조직 전체 공지.

> 공지 대상 건물(다중). 링크가 없으면 전체(org-wide) 공지.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `notice_id` | bigint | Y |  |  |
| 2 | `building_id` | bigint | Y |  |  |
| 3 | `org_id` | bigint | Y |  |  |
| 4 | `created_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (notice_id, building_id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX notice_buildings_org_idx ON public.notice_buildings USING btree (org_id)`
- `CREATE INDEX notice_buildings_building_idx ON public.notice_buildings USING btree (building_id)`

**트리거**
- `notice_buildings_set_org_trg` → `notice_buildings_set_org()`

**RLS 정책**
- **notice_buildings_all** (ALL, public): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `notice_share_tokens`

<a id="notice_share_tokens"></a>**도메인**: 민원(AS)·공지 · **행 수**: 1

**기능**: 공지 공개 공유 링크 토큰.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `token` | uuid | Y | gen_random_uuid() |  |
| 3 | `org_id` | bigint | Y |  |  |
| 4 | `notice_id` | bigint | Y |  |  |
| 5 | `created_by` | uuid |  |  |  |
| 6 | `expires_at` | timestamp with time zone | Y |  |  |
| 7 | `created_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (notice_id)`
- UNIQUE: `UNIQUE (token)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**RLS 정책**
- 정책 없음 (RLS 활성 + 정책 없음 → anon/authenticated 접근 차단, service_role 전용)

### `notices`

<a id="notices"></a>**도메인**: 민원(AS)·공지 · **행 수**: 4

**기능**: 공지사항(Tiptap JSON 본문, 게시/만료). 대상 건물은 notice_buildings로 다중 지정.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `building_id` | bigint |  |  | [레거시] 단일 대상 건물. 다중 대상은 notice_buildings 로 이관됨. 앱은 참조하지 않는다. |
| 4 | `title` | text | Y |  |  |
| 5 | `content` | text | Y |  |  |
| 6 | `notice_type` | text | Y | 'normal'::text |  |
| 7 | `published_at` | timestamp with time zone |  |  |  |
| 8 | `expires_at` | timestamp with time zone |  |  |  |
| 9 | `created_by` | uuid |  |  |  |
| 10 | `deleted_at` | timestamp with time zone |  |  |  |
| 11 | `created_at` | timestamp with time zone | Y | now() |  |
| 12 | `updated_at` | timestamp with time zone | Y | now() |  |
| 13 | `content_json` | jsonb |  |  | Tiptap JSON 원본. null이면 레거시 plain text(content)만 존재한다. |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX notices_org_id_building_id_published_at_idx ON public.notices USING btree (org_id, building_id, published_at)`

**트리거**
- `trg_notices_updated` → `set_updated_at()`
- `notices_sync_building_link_trg` → `notices_sync_building_link()`

**RLS 정책**
- **ntc_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `occupancies`

<a id="occupancies"></a>**도메인**: 건물·세대·입주 · **행 수**: 44

**기능**: 세대 현재 입주(점유) 정보. 입주자·연락처·차량·입퇴실일·고지서 수신 방식·자동이체·연체료 적용·알림 수신동의 등 청구 관련 설정 포함.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `tenant_name` | text |  |  |  |
| 4 | `payer_name` | text |  |  |  |
| 5 | `phone` | text |  |  |  |
| 6 | `resident_count` | integer |  |  |  |
| 7 | `vehicle_no` | text |  |  |  |
| 8 | `move_in_date` | date |  |  |  |
| 9 | `move_out_date` | date |  |  |  |
| 12 | `status` | occupancy_status | Y | 'occupied'::occupancy_status |  |
| 13 | `memo` | text |  |  |  |
| 14 | `deleted_at` | timestamp with time zone |  |  |  |
| 15 | `created_at` | timestamp with time zone | Y | now() |  |
| 16 | `updated_at` | timestamp with time zone | Y | now() |  |
| 17 | `phone2` | text |  |  |  |
| 18 | `phone3` | text |  |  |  |
| 19 | `room_type_id` | bigint |  |  |  |
| 20 | `billing_enabled` | boolean | Y | true |  |
| 21 | `print_enabled` | boolean | Y | true |  |
| 22 | `late_fee_enabled` | boolean | Y | true |  |
| 23 | `single_print` | boolean | Y | false |  |
| 24 | `billing_note` | text |  |  |  |
| 25 | `settlement_note` | text |  |  |  |
| 26 | `facility_note` | text |  |  |  |
| 27 | `transfer_method` | text | Y | 'none'::text |  |
| 28 | `bill_name_display` | text | Y | 'name'::text |  |
| 29 | `bill_delivery` | text | Y | 'post'::text |  |
| 30 | `bill_auth` | boolean | Y | false |  |
| 31 | `move_out_scheduled_date` | date |  |  |  |
| 35 | `sms_opt_in` | boolean | Y | false |  |
| 36 | `alimtalk_opt_in` | boolean | Y | false |  |
| 37 | `fax_number` | text |  |  |  |
| 38 | `expected_move_in_date` | date |  |  |  |
| 39 | `discount_type` | text |  |  |  |
| 40 | `discount_amount` | bigint |  |  |  |
| 41 | `homepage_password` | text |  |  |  |
| 42 | `mgmt_fee_amount` | bigint |  |  |  |
| 43 | `move_cleaning_fee` | bigint |  |  |  |
| 44 | `increase_amount` | bigint |  |  |  |
| 45 | `billing_day` | text |  |  |  |
| 46 | `etc_note` | text |  |  |  |
| 47 | `bill_auth_info` | text |  |  |  |
| 48 | `phones_extra` | text[] | Y | '{}'::text[] |  |
| 49 | `vehicles_extra` | text[] | Y | '{}'::text[] |  |
| 50 | `cms_member_no` | text |  |  |  |
| 51 | `cms_contract_no` | text |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK ((bill_delivery = ANY (ARRAY['post', 'alimtalk'])))`
- CHECK: `CHECK ((bill_name_display = ANY (ARRAY['none', 'name', 'code'])))`
- CHECK: `CHECK ((transfer_method = ANY (ARRAY['giro', 'transfer', 'auto_transfer', 'deposit', 'none'])))`

**인덱스**
- `CREATE INDEX occupancies_active_unit_created_idx ON public.occupancies USING btree (unit_id, created_at DESC) WHERE (deleted_at IS NULL)`
- `CREATE INDEX occupancies_unit_id_idx ON public.occupancies USING btree (unit_id)`
- `CREATE INDEX occupancies_room_type_id_idx ON public.occupancies USING btree (room_type_id)`
- `CREATE INDEX occupancies_occupied_move_in_unit_idx ON public.occupancies USING btree (move_in_date, unit_id) WHERE ((status = 'occupied'::occupancy_status) AND (deleted_at IS NULL))`

**트리거**
- `trg_occupancies_updated` → `set_updated_at()`
- `trg_clear_occupancy_fax_on_vacancy` → `clear_occupancy_fax_on_vacancy()`
- `trg_occupancies_close_move_out_requests` → `close_move_out_requests_on_vacate()`

**RLS 정책**
- **occ_write** (ALL, authenticated): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))`
- **occ_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`
- **occ_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `occupancy_history`

<a id="occupancy_history"></a>**도메인**: 건물·세대·입주 · **행 수**: 6

**기능**: 과거 입주 이력 스냅샷.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `tenant_name` | text |  |  |  |
| 4 | `move_in_date` | date |  |  |  |
| 5 | `move_out_date` | date |  |  |  |
| 6 | `room_type_label` | text |  |  |  |
| 7 | `created_at` | timestamp with time zone | Y | now() |  |
| 8 | `phone` | text |  |  |  |
| 9 | `phone2` | text |  |  |  |
| 10 | `phone3` | text |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX occupancy_history_unit_id_move_out_date_idx ON public.occupancy_history USING btree (unit_id, move_out_date DESC)`

**RLS 정책**
- **oh_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`
- **oh_write** (ALL, authenticated): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))`

### `org_member_roles`

<a id="org_member_roles"></a>**도메인**: 조직·계정·권한 · **행 수**: 0

**기능**: 직원-직책 N:M 매핑.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `org_id` | bigint | Y |  |  |
| 2 | `user_id` | uuid | Y |  |  |
| 3 | `role_id` | bigint | Y |  |  |

**제약조건**
- PK: `PRIMARY KEY (org_id, user_id, role_id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (role_id) REFERENCES staff_roles(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX org_member_roles_role_id_idx ON public.org_member_roles USING btree (role_id)`

**RLS 정책**
- **omr_select** (SELECT, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `org_members`

<a id="org_members"></a>**도메인**: 조직·계정·권한 · **행 수**: 5

**기능**: 조직-사용자 소속. 역할(role)·직원 유형(staff_type)·기능 권한(feature_permissions)·현장 권한(staff_capabilities)·본사 역할(hq_role)을 가진다.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `org_id` | bigint | Y |  |  |
| 2 | `user_id` | uuid | Y |  |  |
| 3 | `role` | org_member_role | Y | 'staff'::org_member_role |  |
| 4 | `created_at` | timestamp with time zone | Y | now() |  |
| 5 | `staff_type` | staff_type | Y | 'manager_staff'::staff_type |  |
| 6 | `feature_permissions` | jsonb | Y | '[]'::jsonb |  |
| 7 | `affiliation` | text |  |  |  |
| 8 | `memo` | text |  |  |  |
| 9 | `staff_capabilities` | jsonb | Y | '[]'::jsonb |  |
| 10 | `hq_role` | text |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (org_id, user_id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`
- CHECK: `CHECK ((jsonb_typeof(feature_permissions) = 'array'))`
- CHECK: `CHECK (((hq_role IS NULL) OR (hq_role = ANY (ARRAY['master', 'operations', 'support', 'sales', 'accounting', 'other']))))`
- CHECK: `CHECK ((jsonb_typeof(staff_capabilities) = 'array'))`

**인덱스**
- `CREATE INDEX org_members_user_idx ON public.org_members USING btree (user_id)`

**트리거**
- `trg_org_members_office_default_permissions` → `trg_office_default_permissions()`

**RLS 정책**
- **member_select** (SELECT, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`
- **member_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`

### `organizations`

<a id="organizations"></a>**도메인**: 조직·계정·권한 · **행 수**: 0

**기능**: 관리사무소(테넌트) 조직. 계약기간·사업자 정보·계약서 파일 경로를 보관하며, 생성 시 트리거로 기본 알림톡 템플릿·방 타입·업체 분류를 프로비저닝한다.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `name` | text | Y |  |  |
| 3 | `slug` | text |  |  |  |
| 4 | `status` | org_status | Y | 'active'::org_status |  |
| 5 | `created_at` | timestamp with time zone | Y | now() |  |
| 6 | `updated_at` | timestamp with time zone | Y | now() |  |
| 7 | `deleted_at` | timestamp with time zone |  |  |  |
| 8 | `phone` | text |  |  |  |
| 9 | `contract_start_date` | date |  |  |  |
| 10 | `contract_end_date` | date |  |  |  |
| 11 | `representative_name` | text |  |  |  |
| 12 | `business_registration_number` | text |  |  |  |
| 13 | `fax` | text |  |  |  |
| 14 | `email` | text |  |  |  |
| 15 | `address` | text |  |  |  |
| 16 | `region` | text |  |  |  |
| 17 | `operating_hours` | text |  |  |  |
| 18 | `contract_file_path` | text |  |  |  |
| 19 | `contract_file_paths` | text[] | Y | '{}'::text[] |  |

**제약조건**
- UNIQUE: `UNIQUE (slug)`
- PK: `PRIMARY KEY (id)`

**트리거**
- `trg_org_updated` → `set_updated_at()`
- `trg_org_provision_alimtalk` → `trg_provision_alimtalk_templates()`
- `trg_org_provision_vendor_categories` → `trg_provision_vendor_categories()`
- `trg_org_provision_default_room_types` → `trg_provision_default_room_types()`

**RLS 정책**
- **org_platform_update** (UPDATE, authenticated): USING `current_user_is_platform_admin()` / CHECK `current_user_is_platform_admin()`
- **org_select** (SELECT, authenticated): USING `(id IN ( SELECT my_org_ids() AS my_org_ids))`
- **org_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`

### `payments`

<a id="payments"></a>**도메인**: 수납 · **행 수**: 81

**기능**: 수납 기록(현금·이체·자동이체·지로·카드). 원천(manual·은행엑셀·CMS·지로파일), 취소 상태, 수수료 포함.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `unit_id` | bigint | Y |  |  |
| 4 | `period` | date | Y |  |  |
| 5 | `occupancy_id` | bigint |  |  |  |
| 6 | `amount` | integer | Y |  |  |
| 7 | `method` | text | Y | 'transfer'::text |  |
| 8 | `kind` | text | Y |  |  |
| 9 | `memo` | text |  |  |  |
| 10 | `paid_at` | date | Y | CURRENT_DATE |  |
| 11 | `status` | text | Y | 'active'::text |  |
| 12 | `canceled_at` | timestamp with time zone |  |  |  |
| 13 | `canceled_by` | uuid |  |  |  |
| 14 | `source` | text | Y | 'manual'::text |  |
| 15 | `created_at` | timestamp with time zone | Y | now() |  |
| 16 | `updated_at` | timestamp with time zone | Y | now() |  |
| 17 | `created_by` | uuid |  |  |  |
| 18 | `fee` | integer | Y | 0 |  |
| 19 | `external_ref` | text |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (canceled_by) REFERENCES profiles(user_id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (occupancy_id) REFERENCES occupancies(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK ((amount > 0))`
- CHECK: `CHECK ((fee >= 0))`
- CHECK: `CHECK (((source <> 'giro_file') OR (external_ref IS NOT NULL)))`
- CHECK: `CHECK ((kind = ANY (ARRAY['full', 'principal', 'partial'])))`
- CHECK: `CHECK ((method = ANY (ARRAY['cash', 'transfer', 'auto_debit', 'giro', 'card', 'other'])))`
- CHECK: `CHECK ((period = (date_trunc('month', (period)::timestamp with time zone))::date))`
- CHECK: `CHECK ((source = ANY (ARRAY['manual', 'bank_excel', 'cms', 'giro_file'])))`
- CHECK: `CHECK ((status = ANY (ARRAY['active', 'canceled'])))`

**인덱스**
- `CREATE INDEX payments_org_id_period_idx ON public.payments USING btree (org_id, period)`
- `CREATE INDEX payments_unit_id_period_idx ON public.payments USING btree (unit_id, period)`

**트리거**
- `trg_payments_updated` → `set_updated_at()`

**RLS 정책**
- **pay_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`
- **pay_write** (ALL, authenticated): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('payment'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('payment'::text))`

### `platform_billing_invoices`

<a id="platform_billing_invoices"></a>**도메인**: 플랫폼 운영 · **행 수**: 7

**기능**: 조직별 월 플랫폼 이용료 청구서(채널별 건수·금액·납부 상태).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `billing_month` | date | Y |  |  |
| 4 | `status` | text | Y | 'unpaid'::text |  |
| 5 | `alimtalk_count` | integer | Y | 0 |  |
| 6 | `sms_count` | integer | Y | 0 |  |
| 7 | `fax_count` | integer | Y | 0 |  |
| 8 | `subtotal_krw` | bigint | Y | 0 |  |
| 9 | `vat_krw` | bigint | Y | 0 |  |
| 10 | `total_krw` | bigint | Y | 0 |  |
| 11 | `issued_at` | timestamp with time zone | Y | now() |  |
| 12 | `paid_at` | timestamp with time zone |  |  |  |
| 13 | `updated_by` | uuid |  |  |  |
| 14 | `updated_at` | timestamp with time zone | Y | now() |  |
| 15 | `lms_count` | integer | Y | 0 |  |
| 16 | `fax_page_count` | integer | Y | 0 |  |
| 17 | `alimtalk_amount_krw` | bigint | Y | 0 |  |
| 18 | `sms_amount_krw` | bigint | Y | 0 |  |
| 19 | `fax_amount_krw` | bigint | Y | 0 |  |

**제약조건**
- UNIQUE: `UNIQUE (org_id, billing_month)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id)`
- FK: `FOREIGN KEY (updated_by) REFERENCES profiles(user_id) ON DELETE SET NULL`
- CHECK: `CHECK ((billing_month = (date_trunc('month', (billing_month)::timestamp with time zone))::date))`
- CHECK: `CHECK ((status = ANY (ARRAY['unpaid', 'paid'])))`

**인덱스**
- `CREATE INDEX platform_billing_invoices_billing_month_idx ON public.platform_billing_invoices USING btree (billing_month)`

**RLS 정책**
- **platform_billing_invoices_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`
- **platform_billing_invoices_platform_all** (ALL, authenticated): USING `current_user_is_platform_admin()` / CHECK `current_user_is_platform_admin()`

### `platform_settings`

<a id="platform_settings"></a>**도메인**: 플랫폼 운영 · **행 수**: 0

**기능**: 플랫폼 전역 설정 단일 행(id=1): 채널별 요금, VAT, 청구 계좌 등.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | smallint | Y | 1 |  |
| 2 | `rate_krw_alimtalk` | integer | Y | 0 |  |
| 3 | `rate_krw_sms` | integer | Y | 0 |  |
| 4 | `rate_krw_fax` | integer | Y | 0 |  |
| 5 | `low_balance_threshold` | integer | Y | 0 |  |
| 6 | `billing_bank` | text |  |  |  |
| 7 | `billing_account_no` | text |  |  |  |
| 8 | `billing_account_holder` | text |  |  |  |
| 9 | `business_reg_no` | text |  |  |  |
| 10 | `invoice_notice` | text |  |  |  |
| 11 | `billing_basis` | text |  |  |  |
| 12 | `payment_due_days` | integer | Y | 0 |  |
| 13 | `vat_rate` | numeric | Y | 10 |  |
| 14 | `contact_person` | text |  |  |  |
| 15 | `updated_by` | uuid |  |  |  |
| 16 | `updated_at` | timestamp with time zone | Y | now() |  |
| 17 | `rate_krw_lms` | integer | Y | 0 |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (updated_by) REFERENCES profiles(user_id) ON DELETE SET NULL`
- CHECK: `CHECK ((id = 1))`

**RLS 정책**
- **platform_settings_platform_all** (ALL, authenticated): USING `current_user_is_platform_admin()` / CHECK `current_user_is_platform_admin()`
- **platform_settings_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`

### `point_transactions`

<a id="point_transactions"></a>**도메인**: 메시지·포인트·발송 · **행 수**: 3

**기능**: 포인트 원장(충전·사용·조정). append-only 트리거로 수정 금지.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `type` | point_tx_type | Y |  |  |
| 4 | `points` | integer | Y |  |  |
| 5 | `amount_krw` | integer |  |  |  |
| 6 | `memo` | text |  |  |  |
| 7 | `created_by` | uuid |  |  |  |
| 8 | `created_at` | timestamp with time zone | Y | now() |  |
| 9 | `message_log_id` | bigint |  |  |  |
| 10 | `reservation_id` | bigint |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (message_log_id) REFERENCES message_logs(id) ON DELETE RESTRICT`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (reservation_id) REFERENCES message_point_reservations(id) ON DELETE RESTRICT`

**인덱스**
- `CREATE INDEX point_transactions_created_at_id_idx ON public.point_transactions USING btree (created_at DESC, id DESC)`
- `CREATE INDEX point_transactions_org_id_created_at_idx ON public.point_transactions USING btree (org_id, created_at DESC)`

**트리거**
- `trg_point_transactions_append_only` → `prevent_point_transaction_mutation()`

**RLS 정책**
- **pt_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`

### `profiles`

<a id="profiles"></a>**도메인**: 조직·계정·권한 · **행 수**: 5

**기능**: auth.users 1:1 사용자 프로필(로그인 ID·이름·연락처·활성 여부·비밀번호 변경 강제).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `user_id` | uuid | Y |  |  |
| 2 | `username` | text | Y |  |  |
| 3 | `full_name` | text | Y |  |  |
| 4 | `phone` | text |  |  |  |
| 5 | `is_active` | boolean | Y | true |  |
| 6 | `must_change_password` | boolean | Y | false |  |
| 7 | `created_at` | timestamp with time zone | Y | now() |  |
| 8 | `updated_at` | timestamp with time zone | Y | now() |  |
| 9 | `phone_sub` | text |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (user_id)`
- FK: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

**트리거**
- `trg_profiles_updated` → `set_updated_at()`

**RLS 정책**
- **profile_select** (SELECT, authenticated): USING `((user_id = ( SELECT auth.uid() AS uid)) OR (user_id IN ( SELECT m.user_id
   FROM org_members m
  WHERE (m.org_id IN ( SELECT my_org_ids() AS my_org_ids)))))`
- **profile_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`

### `provider_dispatch_jobs`

<a id="provider_dispatch_jobs"></a>**도메인**: 메시지·포인트·발송 · **행 수**: 3

**기능**: Popbill 발송 작업(메시지/팩스) 접수·폴링·결과 집계, test/live 환경 구분.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `provider` | text | Y | 'popbill'::text |  |
| 4 | `kind` | text | Y |  |  |
| 5 | `product` | text | Y |  |  |
| 6 | `reservation_id` | bigint |  |  |  |
| 7 | `message_log_id` | bigint |  |  |  |
| 8 | `schedule_id` | bigint |  |  |  |
| 9 | `bill_issue_id` | bigint |  |  |  |
| 10 | `request_num` | text | Y |  |  |
| 11 | `receipt_num` | text |  |  |  |
| 12 | `status` | text | Y | 'submitting'::text |  |
| 13 | `next_poll_at` | timestamp with time zone |  |  |  |
| 14 | `lease_until` | timestamp with time zone |  |  |  |
| 15 | `poll_attempts` | integer | Y | 0 |  |
| 16 | `last_error_code` | text |  |  |  |
| 17 | `last_error_message` | text |  |  |  |
| 18 | `send_page_count` | integer |  |  |  |
| 19 | `success_page_count` | integer |  |  |  |
| 20 | `fail_page_count` | integer |  |  |  |
| 21 | `charge_page_count` | integer |  |  |  |
| 22 | `refund_page_count` | integer |  |  |  |
| 23 | `created_at` | timestamp with time zone | Y | now() |  |
| 24 | `submitted_at` | timestamp with time zone |  |  |  |
| 25 | `completed_at` | timestamp with time zone |  |  |  |
| 26 | `updated_at` | timestamp with time zone | Y | now() |  |
| 27 | `submit_owner` | uuid |  |  | Owner token for the single process allowed to cross the provider submission boundary |
| 28 | `claimed_at` | timestamp with time zone |  |  | Time the provider submission owner was acquired; retained for reconciliation age |
| 29 | `provider_env` | text | Y | 'test'::text | 접수 환경(test=팝빌 테스트베드, live=운영). 결과 재조회는 같은 환경 작업만 조회한다. |

**제약조건**
- UNIQUE: `UNIQUE (provider, receipt_num)`
- UNIQUE: `UNIQUE (request_num)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (bill_issue_id) REFERENCES bill_issues(id) ON DELETE RESTRICT`
- FK: `FOREIGN KEY (message_log_id) REFERENCES message_logs(id) ON DELETE RESTRICT`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT`
- FK: `FOREIGN KEY (reservation_id) REFERENCES message_point_reservations(id) ON DELETE RESTRICT`
- FK: `FOREIGN KEY (schedule_id) REFERENCES message_schedules(id) ON DELETE SET NULL`
- CHECK: `CHECK (((charge_page_count IS NULL) OR (charge_page_count >= 0)))`
- CHECK: `CHECK (((fail_page_count IS NULL) OR (fail_page_count >= 0)))`
- CHECK: `CHECK ((kind = ANY (ARRAY['message', 'fax'])))`
- CHECK: `CHECK ((((kind = 'fax') AND (product = 'fax')) OR ((kind = 'message') AND (product = ANY (ARRAY['sms', 'lms', 'alimtalk'])))))`
- CHECK: `CHECK ((poll_attempts >= 0))`
- CHECK: `CHECK ((product = ANY (ARRAY['sms', 'lms', 'alimtalk', 'fax'])))`
- CHECK: `CHECK ((provider = 'popbill'))`
- CHECK: `CHECK ((provider_env = ANY (ARRAY['test', 'live'])))`
- CHECK: `CHECK ((((kind = 'message') AND (reservation_id IS NOT NULL)) OR ((kind = 'fax') AND (bill_issue_id IS NOT NULL))))`
- CHECK: `CHECK (((refund_page_count IS NULL) OR (refund_page_count >= 0)))`
- CHECK: `CHECK (((length(request_num) >= 1) AND (length(request_num) <= 36)))`
- CHECK: `CHECK (((send_page_count IS NULL) OR (send_page_count >= 0)))`
- CHECK: `CHECK ((status = ANY (ARRAY['submitting', 'pending', 'sent', 'partial', 'failed', 'reconcile_required'])))`
- CHECK: `CHECK (((success_page_count IS NULL) OR (success_page_count >= 0)))`

**인덱스**
- `CREATE INDEX provider_dispatch_jobs_message_log_idx ON public.provider_dispatch_jobs USING btree (message_log_id) WHERE (message_log_id IS NOT NULL)`
- `CREATE INDEX provider_dispatch_jobs_bill_issue_idx ON public.provider_dispatch_jobs USING btree (bill_issue_id) WHERE (bill_issue_id IS NOT NULL)`
- `CREATE INDEX provider_dispatch_jobs_org_created_idx ON public.provider_dispatch_jobs USING btree (org_id, created_at DESC)`
- `CREATE INDEX provider_dispatch_jobs_poll_idx ON public.provider_dispatch_jobs USING btree (status, next_poll_at) WHERE (status = 'pending'::text)`
- `CREATE INDEX provider_dispatch_jobs_submission_lease_idx ON public.provider_dispatch_jobs USING btree (status, lease_until) WHERE ((kind = 'message'::text) AND (status = ANY (ARRAY['submitting'::text, 'reconcile_required'::text])))`
- `CREATE INDEX provider_dispatch_jobs_reservation_idx ON public.provider_dispatch_jobs USING btree (reservation_id) WHERE (reservation_id IS NOT NULL)`
- `CREATE INDEX provider_dispatch_jobs_schedule_idx ON public.provider_dispatch_jobs USING btree (schedule_id) WHERE (schedule_id IS NOT NULL)`

**트리거**
- `trg_provider_dispatch_jobs_updated` → `set_updated_at()`
- `trg_provider_dispatch_jobs_status_guard` → `provider_dispatch_job_status_guard()`

**RLS 정책**
- **provider_dispatch_jobs_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`

### `provider_dispatch_recipients`

<a id="provider_dispatch_recipients"></a>**도메인**: 메시지·포인트·발송 · **행 수**: 44

**기능**: 발송 작업별 수신자 결과.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `job_id` | bigint | Y |  |  |
| 3 | `recipient_key` | text | Y |  |  |
| 4 | `provider_ref_key` | text | Y |  |  |
| 5 | `product` | text | Y |  |  |
| 6 | `status` | text | Y | 'pending'::text |  |
| 7 | `result_code` | text |  |  |  |
| 8 | `result_message` | text |  |  |  |
| 9 | `completed_at` | timestamp with time zone |  |  |  |
| 10 | `created_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (job_id, recipient_key)`
- UNIQUE: `UNIQUE (job_id, provider_ref_key)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (job_id) REFERENCES provider_dispatch_jobs(id) ON DELETE CASCADE`
- CHECK: `CHECK ((product = ANY (ARRAY['sms', 'lms', 'alimtalk', 'fax'])))`
- CHECK: `CHECK (((length(provider_ref_key) >= 1) AND (length(provider_ref_key) <= 20)))`
- CHECK: `CHECK (((length(recipient_key) >= 1) AND (length(recipient_key) <= 64)))`
- CHECK: `CHECK ((status = ANY (ARRAY['pending', 'success', 'failed'])))`

**인덱스**
- `CREATE INDEX provider_dispatch_recipients_job_idx ON public.provider_dispatch_recipients USING btree (job_id)`

**트리거**
- `trg_provider_dispatch_recipients_status_guard` → `provider_dispatch_recipient_status_guard()`

**RLS 정책**
- **provider_dispatch_recipients_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`

### `quick_messages`

<a id="quick_messages"></a>**도메인**: 메시지·포인트·발송 · **행 수**: 0

**기능**: 자주 쓰는 문구.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `title` | text | Y |  |  |
| 4 | `body` | text | Y |  |  |
| 5 | `sort_order` | integer | Y | 0 |  |
| 6 | `deleted_at` | timestamp with time zone |  |  |  |
| 7 | `created_at` | timestamp with time zone | Y | now() |  |
| 8 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (org_id, title)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**트리거**
- `trg_quick_messages_updated` → `set_updated_at()`

**RLS 정책**
- **qm_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `res_claims`

<a id="res_claims"></a>**도메인**: 입주민(카카오) 연동 · **행 수**: 7

**기능**: 입주민-세대 연결 요청(자동/수동/검색)과 승인·거절 상태.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint |  |  |  |
| 3 | `resident_user_id` | uuid | Y |  |  |
| 4 | `kakao_id` | text |  |  |  |
| 5 | `kakao_name` | text |  |  |  |
| 6 | `claimed_name` | text |  |  |  |
| 7 | `claimed_phone` | text |  |  |  |
| 8 | `building_id` | bigint |  |  |  |
| 9 | `unit_id` | bigint |  |  |  |
| 10 | `claimed_unit_text` | text |  |  |  |
| 11 | `occupancy_id` | bigint |  |  |  |
| 12 | `status` | text | Y | 'pending'::text |  |
| 13 | `kind` | text | Y |  |  |
| 14 | `memo` | text |  |  |  |
| 15 | `created_at` | timestamp with time zone | Y | now() |  |
| 16 | `resolved_at` | timestamp with time zone |  |  |  |
| 17 | `resolved_by` | uuid |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (occupancy_id) REFERENCES occupancies(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (resident_user_id) REFERENCES auth.users(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL`
- CHECK: `CHECK ((kind = ANY (ARRAY['auto', 'manual', 'search'])))`
- CHECK: `CHECK ((status = ANY (ARRAY['pending', 'linked', 'rejected'])))`

**인덱스**
- `CREATE INDEX res_claims_org_idx ON public.res_claims USING btree (org_id)`
- `CREATE INDEX res_claims_status_idx ON public.res_claims USING btree (status)`
- `CREATE INDEX res_claims_resident_user_idx ON public.res_claims USING btree (resident_user_id)`

**RLS 정책**
- **res_claims_staff_write** (ALL, authenticated): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('tenants'::text))` / CHECK `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('tenants'::text))`
- **res_claims_staff_select** (SELECT, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`
- **res_claims_resident_select** (SELECT, authenticated): USING `(resident_user_id = ( SELECT auth.uid() AS uid))`
- **res_claims_resident_insert** (INSERT, authenticated): USING `-` / CHECK `((resident_user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM resident_identities ri
  WHERE (ri.user_id = ( SELECT auth.uid() AS uid)))) AND (status = 'pending'::text))`
- **res_claims_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`

### `resident_identities`

<a id="resident_identities"></a>**도메인**: 입주민(카카오) 연동 · **행 수**: 13

**기능**: 카카오 로그인 입주민 신원(kakao_id·이름·전화·프로필).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `user_id` | uuid | Y |  |  |
| 2 | `kakao_id` | text | Y |  |  |
| 3 | `kakao_name` | text |  |  |  |
| 4 | `phone` | text |  |  |  |
| 5 | `created_at` | timestamp with time zone | Y | now() |  |
| 6 | `profile_image_url` | text |  |  |  |

**제약조건**
- UNIQUE: `UNIQUE (kakao_id)`
- PK: `PRIMARY KEY (user_id)`
- FK: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

**RLS 정책**
- **resident_identities_self_select** (SELECT, authenticated): USING `(user_id = ( SELECT auth.uid() AS uid))`

### `resident_notice_reads`

<a id="resident_notice_reads"></a>**도메인**: 민원(AS)·공지 · **행 수**: 5

**기능**: 입주민 공지 읽음 기록.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `user_id` | uuid | Y |  |  |
| 2 | `notice_id` | bigint | Y |  |  |
| 3 | `read_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (user_id, notice_id)`
- FK: `FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX resident_notice_reads_notice_idx ON public.resident_notice_reads USING btree (notice_id)`

**RLS 정책**
- 정책 없음 (RLS 활성 + 정책 없음 → anon/authenticated 접근 차단, service_role 전용)

### `room_types`

<a id="room_types"></a>**도메인**: 건물·세대·입주 · **행 수**: 5

**기능**: 방 타입 마스터(원룸·투룸 등).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `label` | text | Y |  |  |
| 4 | `sort_order` | integer | Y | 0 |  |
| 5 | `deleted_at` | timestamp with time zone |  |  |  |
| 6 | `created_at` | timestamp with time zone | Y | now() |  |
| 7 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**트리거**
- `trg_room_types_updated` → `set_updated_at()`

**RLS 정책**
- **rt_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`
- **room_type_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`

### `septic_vendors`

<a id="septic_vendors"></a>**도메인**: 업체·장기수선·기타 마스터 · **행 수**: 0

**기능**: 정화조 업체 마스터.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `label` | text | Y |  |  |
| 4 | `sort_order` | integer | Y | 0 |  |
| 5 | `deleted_at` | timestamp with time zone |  |  |  |
| 6 | `created_at` | timestamp with time zone | Y | now() |  |
| 7 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**트리거**
- `trg_septic_vendors_updated` → `set_updated_at()`

**RLS 정책**
- **sv_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `settlement_check_items`

<a id="settlement_check_items"></a>**도메인**: 이사정산·퇴실 · **행 수**: 53

**기능**: 정산 체크리스트 항목 마스터.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `label` | text | Y |  |  |
| 4 | `sort_order` | integer | Y | 0 |  |
| 5 | `deleted_at` | timestamp with time zone |  |  |  |
| 6 | `created_at` | timestamp with time zone | Y | now() |  |
| 7 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**트리거**
- `trg_settlement_check_items_updated` → `set_updated_at()`

**RLS 정책**
- **sci_delete** (DELETE, authenticated): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('settings'::text))`
- **sci_insert** (INSERT, authenticated): USING `-` / CHECK `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('settings'::text))`
- **sci_select** (SELECT, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`
- **sci_update** (UPDATE, authenticated): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('settings'::text))` / CHECK `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('settings'::text))`

### `settlement_checklist_results`

<a id="settlement_checklist_results"></a>**도메인**: 이사정산·퇴실 · **행 수**: 120

**기능**: 정산서별 체크 항목 결과·메모.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `settlement_id` | bigint | Y |  |  |
| 3 | `check_item_id` | bigint | Y |  |  |
| 4 | `checked` | boolean | Y | false |  |
| 5 | `note` | text |  |  | 정산 체크 항목별 메모. staff 화면의 입력값이고 checked 는 이 값이 비어있지 않은지로 파생된다. |

**제약조건**
- UNIQUE: `UNIQUE (settlement_id, check_item_id)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (check_item_id) REFERENCES settlement_check_items(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (settlement_id) REFERENCES moving_settlements(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX settlement_checklist_results_settlement_id_idx ON public.settlement_checklist_results USING btree (settlement_id)`

**RLS 정책**
- **scr_write** (ALL, authenticated): USING `((settlement_id IN ( SELECT s.id
   FROM ((moving_settlements s
     JOIN units u ON ((u.id = s.unit_id)))
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('moving'::text))` / CHECK `((settlement_id IN ( SELECT s.id
   FROM ((moving_settlements s
     JOIN units u ON ((u.id = s.unit_id)))
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('moving'::text))`
- **scr_select** (SELECT, authenticated): USING `(settlement_id IN ( SELECT s.id
   FROM ((moving_settlements s
     JOIN units u ON ((u.id = s.unit_id)))
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `settlement_share_tokens`

<a id="settlement_share_tokens"></a>**도메인**: 이사정산·퇴실 · **행 수**: 0

**기능**: 정산서 공개 공유 링크 토큰.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `token` | uuid | Y | gen_random_uuid() |  |
| 3 | `org_id` | bigint | Y |  |  |
| 4 | `settlement_id` | bigint | Y |  |  |
| 5 | `created_by` | uuid |  |  |  |
| 6 | `expires_at` | timestamp with time zone | Y |  |  |
| 7 | `created_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (settlement_id)`
- UNIQUE: `UNIQUE (token)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (settlement_id) REFERENCES moving_settlements(id) ON DELETE CASCADE`

**RLS 정책**
- 정책 없음 (RLS 활성 + 정책 없음 → anon/authenticated 접근 차단, service_role 전용)

### `setup_config`

<a id="setup_config"></a>**도메인**: 청구·고지서 · **행 수**: 1

**기능**: 조직 환경설정: 고지서 출력 옵션, 관리비/정산 계좌, 회사 정보, 알림 설정, 발신번호, 연체료 설정.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `org_id` | bigint | Y |  |  |
| 2 | `customer_notice` | text |  |  |  |
| 3 | `unit_label_default` | text | Y | 'code'::text |  |
| 4 | `late_fee_merge` | boolean | Y | false |  |
| 5 | `print_utility_cutoff` | boolean | Y | false |  |
| 6 | `print_water_unit_price` | boolean | Y | false |  |
| 7 | `print_billing_period` | boolean | Y | false |  |
| 8 | `print_delta` | boolean | Y | false |  |
| 9 | `show_as_on_main` | boolean | Y | false |  |
| 10 | `cutoff_months` | integer |  |  |  |
| 11 | `mgmt_bank1` | text |  |  |  |
| 12 | `mgmt_acct1` | text |  |  |  |
| 13 | `mgmt_holder1` | text |  |  |  |
| 14 | `mgmt_print1` | boolean | Y | true |  |
| 15 | `mgmt_bank2` | text |  |  |  |
| 16 | `mgmt_acct2` | text |  |  |  |
| 17 | `mgmt_holder2` | text |  |  |  |
| 18 | `mgmt_print2` | boolean | Y | true |  |
| 19 | `settle_bank` | text |  |  |  |
| 20 | `settle_acct` | text |  |  |  |
| 21 | `settle_holder` | text |  |  |  |
| 22 | `water_unit_reflect` | boolean | Y | true |  |
| 23 | `electric_unit_reflect` | boolean | Y | true |  |
| 24 | `vacancy_payment_mode` | text | Y | 'manual'::text |  |
| 25 | `created_at` | timestamp with time zone | Y | now() |  |
| 26 | `updated_at` | timestamp with time zone | Y | now() |  |
| 27 | `company_name` | text |  |  |  |
| 28 | `company_phone` | text |  |  |  |
| 29 | `company_fax` | text |  |  |  |
| 30 | `biz_reg_no` | text |  |  |  |
| 31 | `ceo_name` | text |  |  |  |
| 32 | `company_address` | text |  |  |  |
| 33 | `operating_hours` | text |  |  |  |
| 34 | `notify_move_in` | boolean | Y | true |  |
| 35 | `notify_lease_expiry` | boolean | Y | true |  |
| 36 | `lease_expiry_days` | integer | Y | 7 |  |
| 37 | `sms_sender` | text |  |  | 조직별 SMS 발신번호(숫자만). NULL이면 운영사 env 기본값 사용 |
| 38 | `fax_sender` | text |  |  | 조직별 팩스 발신번호(숫자만). NULL이면 운영사 env 기본값 사용 |
| 39 | `sms_sender_verified_at` | timestamp with time zone |  |  |  |
| 40 | `fax_sender_verified_at` | timestamp with time zone |  |  |  |
| 41 | `late_fee_enabled` | boolean | Y | true | org 단위 연체료 적용 on/off. 요율 값은 late_fee_rate_tiers에 있다. |
| 42 | `late_fee_post_due_rate` | numeric(6,4) | Y | 2.0 | 납기후 가산율(%). 미납 표·고지서의 "납.후연체" = 미납원금 × 이 비율. 0이면 부과하지 않는다. |

**제약조건**
- PK: `PRIMARY KEY (org_id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- CHECK: `CHECK (((late_fee_post_due_rate >= (0)::numeric) AND (late_fee_post_due_rate <= (100)::numeric)))`
- CHECK: `CHECK ((unit_label_default = ANY (ARRAY['code', 'name'])))`
- CHECK: `CHECK ((vacancy_payment_mode = ANY (ARRAY['manual', 'auto'])))`

**트리거**
- `trg_setup_config_updated` → `set_updated_at()`

**RLS 정책**
- **sc_update** (UPDATE, authenticated): USING `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('settings'::text))` / CHECK `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('settings'::text))`
- **sc_select** (SELECT, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`
- **sc_insert** (INSERT, authenticated): USING `-` / CHECK `((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND current_user_has_module('settings'::text))`

### `staff_roles`

<a id="staff_roles"></a>**도메인**: 조직·계정·권한 · **행 수**: 0

**기능**: 조직별 직원 직책 마스터.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `label` | text | Y |  |  |
| 4 | `sort_order` | integer | Y | 0 |  |
| 5 | `deleted_at` | timestamp with time zone |  |  |  |
| 6 | `created_at` | timestamp with time zone | Y | now() |  |
| 7 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (org_id, label)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**트리거**
- `trg_staff_roles_updated` → `set_updated_at()`

**RLS 정책**
- **sr_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `unit_accounts`

<a id="unit_accounts"></a>**도메인**: 건물·세대·입주 · **행 수**: 37

**기능**: 세대별 납부 계좌(수도·전기·가스·관리비)와 CMS 회원번호·납부자번호.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `kind` | text | Y |  |  |
| 4 | `bank` | text |  |  |  |
| 5 | `account` | text |  |  |  |
| 6 | `holder` | text |  |  |  |
| 7 | `cms_member_no` | text |  |  |  |
| 8 | `created_at` | timestamp with time zone | Y | now() |  |
| 9 | `updated_at` | timestamp with time zone | Y | now() |  |
| 10 | `payer_no` | text |  |  |  |

**제약조건**
- UNIQUE: `UNIQUE (unit_id, kind)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK ((kind = ANY (ARRAY['water', 'elec', 'gas', 'mgmt'])))`

**인덱스**
- `CREATE INDEX unit_accounts_unit_id_idx ON public.unit_accounts USING btree (unit_id)`

**트리거**
- `trg_unit_accounts_updated` → `set_updated_at()`

**RLS 정책**
- **ua_write** (ALL, authenticated): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))`
- **ua_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `unit_fixed_values`

<a id="unit_fixed_values"></a>**도메인**: 건물·세대·입주 · **행 수**: 4

**기능**: 세대별 공과금 고정 사용량/고정 금액을 적용 시작월(from_period) 단위로 이력 관리.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `unit_id` | bigint | Y |  |  |
| 2 | `utility` | text | Y |  |  |
| 3 | `kind` | text | Y |  |  |
| 4 | `from_period` | date | Y |  |  |
| 5 | `value` | numeric |  |  |  |
| 6 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- PK: `PRIMARY KEY (unit_id, utility, kind, from_period)`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK ((from_period = (date_trunc('month', (from_period)::timestamp with time zone))::date))`
- CHECK: `CHECK ((kind = ANY (ARRAY['usage', 'manual'])))`
- CHECK: `CHECK ((utility = ANY (ARRAY['water', 'elec', 'gas'])))`

**RLS 정책**
- **ufv_select** (SELECT, public): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `unit_meters`

<a id="unit_meters"></a>**도메인**: 건물·세대·입주 · **행 수**: 60

**기능**: 세대별 계량기(수도·전기·가스 등) 번호·고객번호. fixed_* 컬럼은 0203 이후 미사용(unit_fixed_values로 이관).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `utility` | text | Y |  |  |
| 4 | `meter_no` | text |  |  |  |
| 5 | `customer_no` | text |  |  |  |
| 6 | `created_at` | timestamp with time zone | Y | now() |  |
| 7 | `updated_at` | timestamp with time zone | Y | now() |  |
| 8 | `fixed_usage` | numeric(12,2) |  |  | 0203부터 사용 안 함 — unit_fixed_values 가 기준 |
| 9 | `fixed_usage_from` | date |  |  | 0203부터 사용 안 함 — unit_fixed_values 가 기준 |
| 10 | `fixed_manual_charge` | integer |  |  | 0203부터 사용 안 함 — unit_fixed_values 가 기준 |
| 11 | `fixed_manual_charge_from` | date |  |  | 0203부터 사용 안 함 — unit_fixed_values 가 기준 |

**제약조건**
- UNIQUE: `UNIQUE (unit_id, utility)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK (((fixed_manual_charge_from IS NULL) OR (fixed_manual_charge_from = (date_trunc('month', (fixed_manual_charge_from)::timestamp with time zone))::date)))`
- CHECK: `CHECK (((fixed_usage_from IS NULL) OR (fixed_usage_from = (date_trunc('month', (fixed_usage_from)::timestamp with time zone))::date)))`
- CHECK: `CHECK ((utility = ANY (ARRAY['water', 'elec', 'gas', 'elec_shared', 'kepco'])))`

**인덱스**
- `CREATE INDEX unit_meters_unit_id_idx ON public.unit_meters USING btree (unit_id)`

**트리거**
- `trg_unit_meters_updated` → `set_updated_at()`

**RLS 정책**
- **um_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`
- **um_write** (ALL, authenticated): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))`

### `unit_property_listings`

<a id="unit_property_listings"></a>**도메인**: 건물·세대·입주 · **행 수**: 9

**기능**: 세대 매물(임대) 정보: 보증금·월세·면적·입주 가능일 등.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `property_name` | text |  |  |  |
| 4 | `address` | text |  |  |  |
| 5 | `address_detail` | text |  |  |  |
| 6 | `property_type` | text |  |  |  |
| 7 | `deal_type` | text |  |  |  |
| 8 | `rent_type` | text |  |  |  |
| 9 | `area_m2` | numeric(10,2) |  |  |  |
| 10 | `deposit` | bigint |  |  |  |
| 11 | `jeonse_deposit` | bigint |  |  |  |
| 12 | `monthly_rent` | bigint |  |  |  |
| 13 | `mgmt_fee_desc` | text |  |  |  |
| 14 | `available_date` | date |  |  |  |
| 15 | `location` | text |  |  |  |
| 16 | `facilities` | jsonb | Y | '[]'::jsonb |  |
| 17 | `deleted_at` | timestamp with time zone |  |  |  |
| 18 | `created_at` | timestamp with time zone | Y | now() |  |
| 19 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (unit_id)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX idx_unit_property_listings_unit ON public.unit_property_listings USING btree (unit_id)`

**트리거**
- `trg_unit_property_listings_updated` → `set_updated_at()`

**RLS 정책**
- **upl_write** (ALL, public): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))`
- **upl_select** (SELECT, public): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `units`

<a id="units"></a>**도메인**: 건물·세대·입주 · **행 수**: 44

**기능**: 세대(호실). 동·층·평형·방 수·주거/상가 구분.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `building_id` | bigint | Y |  |  |
| 3 | `unit_no` | text | Y |  |  |
| 4 | `dong` | text |  |  |  |
| 5 | `area_pyeong` | numeric(8,2) |  |  |  |
| 6 | `room_count` | integer |  |  |  |
| 10 | `memo` | text |  |  |  |
| 11 | `deleted_at` | timestamp with time zone |  |  |  |
| 12 | `created_at` | timestamp with time zone | Y | now() |  |
| 13 | `updated_at` | timestamp with time zone | Y | now() |  |
| 14 | `floor` | integer |  |  |  |
| 15 | `usage_type` | text | Y | 'residential'::text |  |

**제약조건**
- UNIQUE: `UNIQUE (building_id, unit_no)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE`
- CHECK: `CHECK ((usage_type = ANY (ARRAY['residential', 'commercial'])))`

**인덱스**
- `CREATE INDEX units_building_id_idx ON public.units USING btree (building_id)`

**트리거**
- `trg_units_updated` → `set_updated_at()`

**RLS 정책**
- **unit_select** (SELECT, authenticated): USING `(building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`
- **unit_platform_select** (SELECT, authenticated): USING `current_user_is_platform_admin()`
- **unit_write** (ALL, authenticated): USING `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))` / CHECK `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('tenants'::text))`

### `utility_confirmations`

<a id="utility_confirmations"></a>**도메인**: 검침·공과금 · **행 수**: 0

**기능**: 건물·공과금·월분 단위 공과금 확정(세대수·합계).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `building_id` | bigint | Y |  |  |
| 3 | `utility` | text | Y |  |  |
| 4 | `period` | date | Y |  |  |
| 5 | `unit_count` | integer | Y | 0 |  |
| 6 | `total_amount` | bigint | Y | 0 |  |
| 7 | `confirmed_at` | timestamp with time zone |  |  |  |
| 8 | `confirmed_by` | uuid |  |  |  |
| 9 | `created_at` | timestamp with time zone | Y | now() |  |
| 10 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (building_id, utility, period)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE`
- FK: `FOREIGN KEY (confirmed_by) REFERENCES profiles(user_id) ON DELETE SET NULL`
- CHECK: `CHECK ((period = (date_trunc('month', (period)::timestamp with time zone))::date))`
- CHECK: `CHECK ((utility = ANY (ARRAY['water', 'elec', 'gas'])))`

**인덱스**
- `CREATE INDEX utility_confirmations_building_id_utility_period_idx ON public.utility_confirmations USING btree (building_id, utility, period)`

**트리거**
- `trg_utility_confirmations_updated` → `set_updated_at()`

**RLS 정책**
- **uc_write** (ALL, authenticated): USING `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))` / CHECK `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))`
- **uc_select** (SELECT, authenticated): USING `(building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `utility_scoped_prices`

<a id="utility_scoped_prices"></a>**도메인**: 검침·공과금 · **행 수**: 0

**기능**: 건물·공과금·용도(주거/상가)·층 범위별 단가.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `building_id` | bigint | Y |  |  |
| 3 | `utility` | text | Y |  |  |
| 4 | `usage_type` | text | Y |  |  |
| 5 | `floor` | integer |  |  |  |
| 6 | `unit_price` | numeric(12,2) | Y |  |  |
| 7 | `created_at` | timestamp with time zone | Y | now() |  |
| 8 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE NULLS NOT DISTINCT (building_id, utility, usage_type, floor)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE`
- CHECK: `CHECK ((usage_type = ANY (ARRAY['residential', 'commercial'])))`
- CHECK: `CHECK ((utility = ANY (ARRAY['water', 'elec', 'gas'])))`

**트리거**
- `trg_utility_scoped_prices_updated` → `set_updated_at()`

**RLS 정책**
- **usp_write** (ALL, authenticated): USING `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))` / CHECK `((building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))`
- **usp_select** (SELECT, authenticated): USING `(building_id IN ( SELECT buildings.id
   FROM buildings
  WHERE (buildings.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `utility_unit_prices`

<a id="utility_unit_prices"></a>**도메인**: 검침·공과금 · **행 수**: 2

**기능**: 고객번호(building_customer_numbers)별 공과금 단가.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `building_customer_number_id` | bigint | Y |  |  |
| 3 | `unit_price` | numeric(12,2) | Y | 0 |  |
| 4 | `created_at` | timestamp with time zone | Y | now() |  |
| 5 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (building_customer_number_id)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (building_customer_number_id) REFERENCES building_customer_numbers(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX utility_unit_prices_building_customer_number_id_idx ON public.utility_unit_prices USING btree (building_customer_number_id)`

**트리거**
- `trg_utility_unit_prices_updated` → `set_updated_at()`

**RLS 정책**
- **uup_write** (ALL, authenticated): USING `((building_customer_number_id IN ( SELECT bcn.id
   FROM (building_customer_numbers bcn
     JOIN buildings b ON ((b.id = bcn.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))` / CHECK `((building_customer_number_id IN ( SELECT bcn.id
   FROM (building_customer_numbers bcn
     JOIN buildings b ON ((b.id = bcn.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))`
- **uup_select** (SELECT, authenticated): USING `(building_customer_number_id IN ( SELECT bcn.id
   FROM (building_customer_numbers bcn
     JOIN buildings b ON ((b.id = bcn.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`

### `vendor_categories`

<a id="vendor_categories"></a>**도메인**: 업체·장기수선·기타 마스터 · **행 수**: 8

**기능**: 협력업체 분류 마스터.

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `label` | text | Y |  |  |
| 4 | `sort_order` | integer | Y | 0 |  |
| 5 | `created_at` | timestamp with time zone | Y | now() |  |
| 6 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (org_id, label)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**트리거**
- `trg_vendor_categories_updated` → `set_updated_at()`

**RLS 정책**
- **vc_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `vendors`

<a id="vendors"></a>**도메인**: 업체·장기수선·기타 마스터 · **행 수**: 3

**기능**: 협력업체(조직 단위).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `org_id` | bigint | Y |  |  |
| 3 | `category_id` | bigint |  |  |  |
| 4 | `name` | text | Y |  |  |
| 5 | `phone` | text |  |  |  |
| 6 | `bank_account` | text |  |  |  |
| 7 | `memo` | text |  |  |  |
| 8 | `created_at` | timestamp with time zone | Y | now() |  |
| 9 | `updated_at` | timestamp with time zone | Y | now() |  |
| 10 | `manager` | text |  |  |  |

**제약조건**
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (category_id) REFERENCES vendor_categories(id) ON DELETE SET NULL`
- FK: `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`

**인덱스**
- `CREATE INDEX vendors_org_id_category_id_idx ON public.vendors USING btree (org_id, category_id)`

**트리거**
- `trg_vendors_updated` → `set_updated_at()`

**RLS 정책**
- **vnd_all** (ALL, authenticated): USING `(org_id IN ( SELECT my_org_ids() AS my_org_ids))` / CHECK `(org_id IN ( SELECT my_org_ids() AS my_org_ids))`

### `water_discounts`

<a id="water_discounts"></a>**도메인**: 건물·세대·입주 · **행 수**: 0

**기능**: 세대별 수도 감면(수급자·다자녀 등).

| # | 컬럼 | 타입 | NOT NULL | 기본값 | 설명 |
|---|---|---|---|---|---|
| 1 | `id` | bigint | Y |  |  |
| 2 | `unit_id` | bigint | Y |  |  |
| 3 | `discount_type` | text | Y |  |  |
| 4 | `amount` | integer | Y | 0 |  |
| 5 | `memo` | text |  |  |  |
| 6 | `created_at` | timestamp with time zone | Y | now() |  |
| 7 | `updated_at` | timestamp with time zone | Y | now() |  |

**제약조건**
- UNIQUE: `UNIQUE (unit_id)`
- PK: `PRIMARY KEY (id)`
- FK: `FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE`
- CHECK: `CHECK ((discount_type = ANY (ARRAY['recipient', 'multichild', 'other'])))`

**인덱스**
- `CREATE INDEX water_discounts_unit_id_idx ON public.water_discounts USING btree (unit_id)`

**트리거**
- `trg_water_discounts_updated` → `set_updated_at()`

**RLS 정책**
- **wd_write** (ALL, authenticated): USING `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))` / CHECK `((unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids)))) AND current_user_has_module('utilities'::text))`
- **wd_select** (SELECT, authenticated): USING `(unit_id IN ( SELECT u.id
   FROM (units u
     JOIN buildings b ON ((b.id = u.building_id)))
  WHERE (b.org_id IN ( SELECT my_org_ids() AS my_org_ids))))`


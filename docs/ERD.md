# 관리비서 주택관리 ERP — 데이터베이스 ERD

- 기준: Supabase 프로젝트 `amhtprmapxlizdnsgbeg`, `public` 스키마 실DB 조회 결과(2026-10-13)
- 규모: 테이블 74개, 외래키(FK) 148개
- 표기: `PK` 기본키, `FK` 외래키, `UK` 유니크(복합 포함). `||--o{` 1:N, `||--o|` 1:0..1
- `auth_users` 는 Supabase `auth.users`(로그인 계정)를 뜻한다. 직원·현장·통합관리자·세입자 모두 이 계정을 쓴다.
- 다이어그램은 도메인별로 나누고, 각 엔터티에는 키 컬럼과 핵심 업무 컬럼만 적었다. 전체 컬럼은 맨 아래 「테이블 목록」과 `supabase/migrations/` 를 본다.

## 0. 전체 개요 (도메인 간 연결)

```mermaid
erDiagram
    organizations ||--o{ buildings : "관리"
    organizations ||--o{ org_members : "소속"
    auth_users ||--o{ org_members : "직원 계정"
    auth_users ||--o| profiles : "프로필"
    auth_users ||--o| resident_identities : "세입자(카카오)"
    buildings ||--o{ units : "세대"
    units ||--o{ occupancies : "입주"
    units ||--o{ meter_readings : "검침"
    units ||--o{ fee_item_charges : "부과"
    units ||--o{ billing_confirmations : "부과확정"
    units ||--o{ bill_issues : "고지"
    units ||--o{ payments : "수납"
    units ||--o{ moving_settlements : "이사정산"
    organizations ||--o{ message_logs : "발송"
    message_logs ||--o{ provider_dispatch_jobs : "팝빌 접수"
    bill_issues ||--o{ provider_dispatch_jobs : "고지서 발송"
    organizations ||--o{ notices : "공지"
    organizations ||--o{ complaints : "민원(AS)"
    organizations ||--o{ point_transactions : "포인트"
    organizations ||--o{ platform_billing_invoices : "플랫폼 청구"
```

## 1. 조직 · 계정 · 권한

```mermaid
erDiagram
    organizations {
        bigint id PK
        text name
        text slug UK
        org_status status
        text phone
        date contract_start_date
        date contract_end_date
    }
    auth_users {
        uuid id PK
    }
    profiles {
        uuid user_id PK,FK
        text username
        text full_name
        text phone
        bool is_active
        bool must_change_password
    }
    org_members {
        bigint org_id PK,FK
        uuid user_id PK,FK
        org_member_role role
        staff_type staff_type
        jsonb feature_permissions
        jsonb staff_capabilities
        text hq_role
    }
    staff_roles {
        bigint id PK
        bigint org_id FK
        text label "UK(org_id,label)"
    }
    org_member_roles {
        bigint org_id PK,FK
        uuid user_id PK,FK
        bigint role_id PK,FK
    }
    resident_identities {
        uuid user_id PK,FK
        text kakao_id UK
        text kakao_name
        text phone
    }
    setup_config {
        bigint org_id PK,FK
        text company_name
        text company_phone
        bool late_fee_merge
        int cutoff_months
        text sms_sender
        text fax_sender
        bool late_fee_enabled
    }
    org_billing_due_settings {
        bigint org_id PK,FK
        smallint month_offset "0 당월, 1 익월"
        smallint due_day "31 말일"
    }
    organizations ||--o{ org_members : ""
    auth_users ||--o{ org_members : ""
    organizations ||--o{ staff_roles : ""
    organizations ||--o{ org_member_roles : ""
    auth_users ||--o{ org_member_roles : ""
    staff_roles ||--o{ org_member_roles : ""
    auth_users ||--o| profiles : ""
    auth_users ||--o| resident_identities : ""
    organizations ||--o| setup_config : ""
    organizations ||--o| org_billing_due_settings : ""
```

FK 없는 보조 테이블: `access_log`(개인정보 열람 감사, org_id·actor_id FK 없음 — 조직/계정 삭제 후에도 이력 보존), `audit_log`(변경 감사), `login_rate_limit`(로그인 무차별 대입 제한 버킷), `app_secrets`(서버 비밀값 키-값).

## 2. 건물 · 세대 · 입주

```mermaid
erDiagram
    organizations {
        bigint id PK
    }
    building_types {
        bigint id PK
        bigint org_id FK
        text label "UK(org_id,label)"
    }
    buildings {
        bigint id PK
        bigint org_id FK
        text code "UK(org_id,code) 숫자3자리"
        text name
        text address
        bigint type_id FK
        uuid manager_user_id FK
        uuid meter_user_id FK
        uuid cleaning_user_id FK
        jsonb facilities
        jsonb reserve_fund
    }
    units {
        bigint id PK
        bigint building_id FK
        text unit_no "UK(building_id,unit_no)"
        text dong
        int floor
        text usage_type
    }
    room_types {
        bigint id PK
        bigint org_id FK
        text label
    }
    occupancies {
        bigint id PK
        bigint unit_id FK
        bigint room_type_id FK
        text tenant_name
        text payer_name
        text phone
        occupancy_status status
        date move_in_date
        date move_out_date
        date move_out_scheduled_date
        bool billing_enabled
        bool sms_opt_in
        bool alimtalk_opt_in
        text fax_number
    }
    occupancy_history {
        bigint id PK
        bigint unit_id FK
        text tenant_name
        date move_in_date
        date move_out_date
    }
    lease_contracts {
        bigint id PK
        bigint occupancy_id FK,UK
        text lease_type
        bigint deposit
        bigint monthly_rent
        date start_date
        date end_date
    }
    unit_accounts {
        bigint id PK
        bigint unit_id FK
        text kind "UK(unit_id,kind)"
        text payer_no "납부자번호"
        text cms_member_no
    }
    unit_meters {
        bigint id PK
        bigint unit_id FK
        text utility "UK(unit_id,utility)"
        text meter_no
        numeric fixed_usage
    }
    unit_fixed_values {
        bigint unit_id PK,FK
        text utility PK
        text kind PK
        date from_period PK
        numeric value
    }
    unit_property_listings {
        bigint id PK
        bigint unit_id FK,UK
        text deal_type
        bigint deposit
        bigint monthly_rent
    }
    water_discounts {
        bigint id PK
        bigint unit_id FK,UK
        text discount_type
        int amount
    }
    building_utility_suppliers {
        bigint id PK
        bigint building_id FK
        text utility
        text company_name
    }
    building_vendors {
        bigint id PK
        bigint building_id FK
        text vendor_type
        text name
    }
    long_term_repair_ledger {
        bigint id PK
        bigint org_id FK
        bigint building_id FK
        date entry_date
        bigint deposit
        bigint withdrawal
    }
    long_term_repair_history {
        bigint id PK
        bigint org_id FK
        bigint building_id FK
        text work_name
        date work_date
        bigint amount
    }
    organizations ||--o{ building_types : ""
    organizations ||--o{ buildings : ""
    building_types ||--o{ buildings : ""
    auth_users ||--o{ buildings : "담당자(관리/검침/청소)"
    buildings ||--o{ units : ""
    organizations ||--o{ room_types : ""
    units ||--o{ occupancies : ""
    room_types ||--o{ occupancies : ""
    units ||--o{ occupancy_history : ""
    occupancies ||--o| lease_contracts : ""
    units ||--o{ unit_accounts : ""
    units ||--o{ unit_meters : ""
    units ||--o{ unit_fixed_values : ""
    units ||--o| unit_property_listings : ""
    units ||--o| water_discounts : ""
    buildings ||--o{ building_utility_suppliers : ""
    buildings ||--o{ building_vendors : ""
    buildings ||--o{ long_term_repair_ledger : ""
    buildings ||--o{ long_term_repair_history : ""
```

조직 단위 코드성 테이블(모두 `organizations` 1:N): `room_types`, `building_types`, `cleaning_teams`, `septic_vendors`, `vendor_categories` → `vendors`(협력업체, `category_id` FK), `settlement_check_items`, `as_categories`.

## 3. 부과 · 고지 · 수납

```mermaid
erDiagram
    fee_items {
        bigint id PK
        bigint org_id FK
        bigint type_id FK
        text name "UK(type_id,name)"
        fee_rounding rounding
        bool daily_proration
        bool carry_over
        bool is_required
    }
    fee_item_charges {
        bigint id PK
        bigint unit_id FK
        bigint fee_item_id FK
        date period "UK(unit,fee_item,period)"
        bigint occupancy_id FK
        bool charged
        int amount
    }
    billing_period_settings {
        bigint id PK
        bigint building_id FK
        date period
        date charge_start_date
        date charge_end_date
        date due_date
    }
    billing_confirmations {
        bigint id PK
        bigint unit_id FK
        date period "UK(unit_id,period)"
        bigint occupancy_id FK
        int total_amount
        int late_fee_override
        uuid confirmed_by FK
    }
    billing_history {
        bigint id PK
        bigint unit_id FK
        date period
        bigint occupancy_id FK
        int total_amount
        jsonb items
    }
    late_fee_rate_tiers {
        bigint id PK
        bigint org_id FK
        int from_month
        int to_month
        numeric monthly_rate
    }
    bill_issues {
        bigint id PK
        bigint unit_id FK
        date period "UK(unit,period,issue_type)"
        text issue_type
        bigint occupancy_id FK
        date due_date
        bool auto_debit
        bool water_cutoff
        int total_amount
        text send_status
        bigint message_log_id FK
        bigint message_schedule_id FK
    }
    bill_share_tokens {
        bigint id PK
        uuid token UK
        bigint org_id FK
        bigint unit_id FK
        date period "UK(unit_id,period)"
        bigint occupancy_id FK
        timestamptz expires_at
        timestamptz revoked_at
    }
    payments {
        bigint id PK
        bigint org_id FK
        bigint unit_id FK
        date period
        bigint occupancy_id FK
        int amount
        int fee
        text method
        text kind
        text status
        bigint replaced_by FK "self"
        bigint late_fee_split_id FK
    }
    payment_late_fee_splits {
        bigint id PK
        bigint org_id FK
        bigint unit_id FK
        date period
        int amount "수.연 미수금"
        text status
    }
    building_types ||--o{ fee_items : "건물유형별 항목"
    fee_items ||--o{ fee_item_charges : ""
    units ||--o{ fee_item_charges : ""
    occupancies ||--o{ fee_item_charges : ""
    buildings ||--o{ billing_period_settings : ""
    units ||--o{ billing_confirmations : ""
    occupancies ||--o{ billing_confirmations : ""
    units ||--o{ billing_history : ""
    organizations ||--o{ late_fee_rate_tiers : ""
    units ||--o{ bill_issues : ""
    occupancies ||--o{ bill_issues : ""
    message_logs ||--o{ bill_issues : ""
    message_schedules ||--o{ bill_issues : ""
    units ||--o{ bill_share_tokens : ""
    units ||--o{ payments : ""
    occupancies ||--o{ payments : ""
    payments ||--o| payments : "replaced_by"
    payment_late_fee_splits ||--o{ payments : ""
    units ||--o{ payment_late_fee_splits : ""
```

확정자·처리자 컬럼(`confirmed_by`, `issued_by`, `created_by`, `canceled_by`)은 `profiles.user_id` 를 참조한다.

## 4. 공과금 · 검침

```mermaid
erDiagram
    building_customer_numbers {
        bigint id PK
        bigint building_id FK
        text kind "수도/전기/가스"
        text customer_no
        int meter_day
        text billing_basis
        text calculation_method
        bool print_on_bill
    }
    utility_unit_prices {
        bigint id PK
        bigint building_customer_number_id FK,UK
        numeric unit_price
    }
    utility_customer_bills {
        bigint id PK
        bigint building_customer_number_id FK
        date period "UK(bcn,period)"
        int amount "관공서 청구총액"
    }
    utility_scoped_prices {
        bigint id PK
        bigint building_id FK
        text utility
        text usage_type
        int floor "UK(building,utility,usage_type,floor)"
        numeric unit_price
    }
    utility_confirmations {
        bigint id PK
        bigint building_id FK
        text utility
        date period "UK(building,utility,period)"
        int unit_count
        bigint total_amount
        uuid confirmed_by FK
    }
    meter_readings {
        bigint id PK
        bigint unit_id FK
        text utility
        date period "UK(unit,utility,period)"
        numeric previous_reading
        numeric current_reading
        numeric usage
        numeric unit_price
        int calc_charge
        int manual_charge
        bool needs_review
    }
    buildings ||--o{ building_customer_numbers : ""
    building_customer_numbers ||--o| utility_unit_prices : ""
    building_customer_numbers ||--o{ utility_customer_bills : ""
    buildings ||--o{ utility_scoped_prices : ""
    buildings ||--o{ utility_confirmations : ""
    units ||--o{ meter_readings : ""
    units ||--o{ unit_meters : ""
```

## 5. 이사정산 · 퇴실 · 세대연결

```mermaid
erDiagram
    moving_settlements {
        bigint id PK
        bigint unit_id FK
        bigint occupancy_id FK
        date move_out_date
        int mgmt_fee_prorated
        int water_charge
        int elec_charge
        int gas_charge
        int repair_amount
        int cleaning_cost
        int unpaid_amount
        int settlement_amount
        text status
        jsonb extra
        uuid checked_by FK
    }
    settlement_check_items {
        bigint id PK
        bigint org_id FK
        text label
    }
    settlement_checklist_results {
        bigint id PK
        bigint settlement_id FK
        bigint check_item_id FK "UK(settlement,check_item)"
        bool checked
    }
    settlement_share_tokens {
        bigint id PK
        uuid token UK
        bigint org_id FK
        bigint settlement_id FK,UK
        timestamptz expires_at
    }
    move_out_requests {
        bigint id PK
        bigint org_id FK
        uuid resident_user_id FK
        bigint occupancy_id FK
        bigint unit_id FK
        bigint building_id FK
        date desired_date
        text status
    }
    res_claims {
        bigint id PK
        bigint org_id FK
        uuid resident_user_id FK
        text kakao_id
        text claimed_name
        text claimed_phone
        bigint building_id FK
        bigint unit_id FK
        bigint occupancy_id FK
        text status
        text kind
    }
    units ||--o{ moving_settlements : ""
    occupancies ||--o{ moving_settlements : ""
    moving_settlements ||--o{ settlement_checklist_results : ""
    settlement_check_items ||--o{ settlement_checklist_results : ""
    moving_settlements ||--o| settlement_share_tokens : ""
    occupancies ||--o{ move_out_requests : ""
    auth_users ||--o{ move_out_requests : "세입자"
    occupancies ||--o{ res_claims : "연결 승인 대상"
    auth_users ||--o{ res_claims : "세입자"
```

## 6. 메시지 · 발송(팝빌) · 포인트

```mermaid
erDiagram
    message_templates {
        bigint id PK
        bigint org_id FK
        text title "UK(org_id,title)"
        text body
        text category
        text channel_type
        text alimtalk_template_code
        jsonb buttons
        text emphasize_title
    }
    quick_messages {
        bigint id PK
        bigint org_id FK
        text title "UK(org_id,title)"
        text body
    }
    message_logs {
        bigint id PK
        bigint org_id FK
        text channel
        text context
        int recipient_count
        jsonb recipients
        text result
        bigint template_id FK
        bigint notice_id FK
        int estimated_points
        int charged_points
        text point_status
        uuid sent_by FK
    }
    message_schedules {
        bigint id PK
        bigint org_id FK
        text channel
        timestamptz scheduled_at
        text status
        bigint template_id "FK 없음"
        bigint message_log_id FK
        text recurrence_mode
        bigint recurrence_parent_id FK "self"
    }
    message_point_rates {
        bigint id PK
        text channel
        int points
        timestamptz effective_from
        timestamptz effective_to
    }
    message_point_reservations {
        bigint id PK
        bigint org_id FK
        bigint message_log_id FK,UK
        uuid idempotency_key "UK(org_id,key)"
        text status
        int reserved_points
        int charged_points
    }
    point_transactions {
        bigint id PK
        bigint org_id FK
        point_tx_type type
        int points
        int amount_krw
        bigint message_log_id FK
        bigint reservation_id FK
    }
    provider_dispatch_jobs {
        bigint id PK
        bigint org_id FK
        text provider
        text kind
        text product
        bigint reservation_id FK
        bigint message_log_id FK
        bigint schedule_id FK
        bigint bill_issue_id FK
        text request_num UK
        text receipt_num "UK(provider,receipt_num)"
        text status
        text provider_env
    }
    provider_dispatch_recipients {
        bigint id PK
        bigint job_id FK
        text recipient_key "UK(job,recipient_key)"
        text provider_ref_key "UK(job,provider_ref_key)"
        text status
        text result_code
    }
    organizations ||--o{ message_templates : ""
    organizations ||--o{ quick_messages : ""
    message_templates ||--o{ message_logs : ""
    notices ||--o{ message_logs : "공지 발송"
    organizations ||--o{ message_schedules : ""
    message_logs ||--o{ message_schedules : ""
    message_schedules ||--o{ message_schedules : "반복 부모"
    message_logs ||--o| message_point_reservations : ""
    message_point_reservations ||--o{ point_transactions : ""
    message_logs ||--o{ point_transactions : ""
    message_point_reservations ||--o{ provider_dispatch_jobs : ""
    message_logs ||--o{ provider_dispatch_jobs : ""
    message_schedules ||--o{ provider_dispatch_jobs : ""
    bill_issues ||--o{ provider_dispatch_jobs : ""
    provider_dispatch_jobs ||--o{ provider_dispatch_recipients : ""
```

## 7. 공지 · 민원(AS) · 첨부

```mermaid
erDiagram
    notices {
        bigint id PK
        bigint org_id FK
        bigint building_id FK "레거시 단일 건물"
        text title
        text notice_type
        jsonb content_json
        timestamptz published_at
        timestamptz expires_at
        uuid created_by FK
    }
    notice_buildings {
        bigint notice_id PK,FK
        bigint building_id PK,FK
        bigint org_id FK
    }
    notice_share_tokens {
        bigint id PK
        uuid token UK
        bigint org_id FK
        bigint notice_id FK,UK
        timestamptz expires_at
    }
    resident_notice_reads {
        uuid user_id PK,FK
        bigint notice_id PK,FK
        timestamptz read_at
    }
    as_categories {
        bigint id PK
        bigint org_id FK
        text label
    }
    complaints {
        bigint id PK
        bigint org_id FK
        bigint building_id FK
        bigint unit_id FK
        bigint category_id FK
        text title
        text status
        uuid assigned_to FK
        uuid created_by FK
    }
    complaint_resolutions {
        bigint id PK
        bigint complaint_id FK
        text result_content
        uuid resolved_by FK
    }
    attachments {
        bigint id PK
        bigint org_id FK
        text entity_type "다형 참조"
        bigint entity_id "FK 없음"
        attachment_kind kind
        text file_url
    }
    organizations ||--o{ notices : ""
    notices ||--o{ notice_buildings : "대상 건물(없으면 전체)"
    buildings ||--o{ notice_buildings : ""
    notices ||--o| notice_share_tokens : ""
    notices ||--o{ resident_notice_reads : ""
    auth_users ||--o{ resident_notice_reads : ""
    organizations ||--o{ as_categories : ""
    as_categories ||--o{ complaints : ""
    buildings ||--o{ complaints : ""
    units ||--o{ complaints : ""
    complaints ||--o{ complaint_resolutions : ""
    organizations ||--o{ attachments : ""
```

## 8. 플랫폼(통합관리자)

```mermaid
erDiagram
    platform_settings {
        smallint id PK "단일 행"
        int rate_krw_alimtalk
        int rate_krw_sms
        int rate_krw_lms
        int rate_krw_fax
        numeric vat_rate
        int low_balance_threshold
        uuid updated_by FK
    }
    platform_billing_invoices {
        bigint id PK
        bigint org_id FK
        date billing_month "UK(org_id,billing_month)"
        text status
        int alimtalk_count
        int sms_count
        int lms_count
        int fax_count
        bigint total_krw
        uuid updated_by FK
    }
    data_migration_runs {
        bigint id PK
        bigint org_id FK
        text kind
        int total_count
        int ok_count
        int fail_count
    }
    organizations ||--o{ platform_billing_invoices : ""
    organizations ||--o{ data_migration_runs : ""
    profiles ||--o{ platform_settings : "updated_by"
```

## 테이블 목록 (74)

| 도메인 | 테이블 | 설명 |
|---|---|---|
| 조직·계정 | organizations | 관리회사(조직) |
| | profiles | 로그인 계정 프로필(auth.users 1:1) |
| | org_members | 조직 소속 직원·역할·기능 권한 |
| | staff_roles / org_member_roles | 조직별 직책과 직원-직책 매핑 |
| | resident_identities | 세입자 카카오 계정 정보(auth.users 1:1) |
| | setup_config | 조직 셋업(회사 정보, 고지서·연체료 옵션, 발신번호) |
| | org_billing_due_settings | 조직 기본 납부기한 |
| | access_log / audit_log | 개인정보 열람 감사 / 데이터 변경 감사(FK 없음) |
| | login_rate_limit / app_secrets | 로그인 제한 버킷 / 서버 비밀값 |
| 건물·세대 | buildings | 건물(조직 내 코드 3자리 유니크) |
| | building_types | 건물 유형(관리비 항목 묶음 기준) |
| | units | 세대(호실) |
| | occupancies | 입주(세입자) — 현재·과거 입주 행 |
| | occupancy_history | 이전 입주자 이력 |
| | lease_contracts | 임대차 계약(입주 1:1) |
| | room_types | 방 타입 |
| | unit_accounts | 세대 계좌·납부자번호·CMS |
| | unit_meters / unit_fixed_values | 세대 계량기·고정 사용량 / 기간별 고정값 |
| | unit_property_listings | 공실 매물 정보(세대 1:1) |
| | water_discounts | 수도 감면(세대 1:1) |
| | building_utility_suppliers / building_vendors | 건물 공급사·업체 정보 |
| | long_term_repair_ledger / long_term_repair_history | 장기수선충당금 장부 / 수선 이력 |
| | cleaning_teams / septic_vendors | 청소팀·정화조 업체 코드 |
| | vendor_categories / vendors | 협력업체 분류 / 협력업체 |
| 부과·수납 | fee_items / fee_item_charges | 관리비 항목 / 세대·월별 부과 금액 |
| | billing_period_settings | 건물·월별 부과기간·납기일 |
| | billing_confirmations / billing_history | 세대·월 부과확정 / 확정 스냅샷 이력 |
| | late_fee_rate_tiers | 연체료 구간 요율 |
| | bill_issues | 고지서 발행·발송 상태(세대·월·유형) |
| | bill_share_tokens | 고지서 공개 공유 토큰 |
| | payments | 수납(취소·대체 이력 포함) |
| | payment_late_fee_splits | 수.연(연체료 분리) 미수금 |
| 공과금 | building_customer_numbers | 건물 공과금 고객번호(수도·전기·가스) |
| | utility_unit_prices / utility_scoped_prices | 고객번호 단가 / 용도·층별 단가 |
| | utility_customer_bills | 고객번호·월 관공서 청구총액 |
| | utility_confirmations | 건물·공과금·월 확정 |
| | meter_readings | 세대·공과금·월 검침 |
| 이사정산 | moving_settlements | 이사정산 |
| | settlement_check_items / settlement_checklist_results | 퇴실 점검 항목 / 정산별 점검 결과 |
| | settlement_share_tokens | 정산 공개 공유 토큰 |
| | move_out_requests | 세입자 퇴실 신청 |
| | res_claims | 세입자 세대연결 요청 |
| 메시지 | message_templates / quick_messages | 문자·알림톡 템플릿 / 빠른 문구 |
| | message_logs / message_schedules | 발송 이력 / 예약·반복 발송 |
| | message_point_rates / message_point_reservations / point_transactions | 채널별 포인트 단가 / 발송 포인트 예약 / 포인트 거래 |
| | provider_dispatch_jobs / provider_dispatch_recipients | 팝빌 접수 단위 / 수신자별 결과 |
| 공지·민원 | notices / notice_buildings | 공지 / 공지 대상 건물(없으면 전체) |
| | notice_share_tokens / resident_notice_reads | 공지 공유 토큰 / 세입자 읽음 |
| | as_categories / complaints / complaint_resolutions | AS 분류 / 민원 / 처리 결과 |
| | attachments | 첨부파일(entity_type·entity_id 다형 참조) |
| 플랫폼 | platform_settings | 플랫폼 단가·청구 설정(단일 행) |
| | platform_billing_invoices | 조직별 월 이용료 청구서 |
| | data_migration_runs | 데이터 이관 실행 이력 |

## 참고 — FK 없이 값으로 연결되는 컬럼

- `message_schedules.template_id` → `message_templates.id` (FK 없음)
- `attachments.entity_type` + `entity_id` → 여러 테이블(다형)
- `access_log`, `audit_log` 의 `org_id`, `actor_id` (이력 보존 목적)
- `org_billing_due_settings.updated_by`, `utility_customer_bills.updated_by`, `attachments.uploaded_by`, `data_migration_runs.run_by` → 계정 uuid (FK 없음)

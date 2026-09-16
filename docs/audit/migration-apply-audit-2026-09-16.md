# 라이브 DB 마이그레이션 적용 상태 전수 감사

- **일자**: 2026-09-16
- **대상 DB**: Supabase 프로덕션 (ref `amhtprmapxlizdnsgbeg`)
- **범위**: `supabase/migrations/*.sql` 전 파일(124개) ↔ 라이브 스키마 introspection 대조
- **계기**: 직전 세션에서 0157(attachments mime_type/size_bytes)이 **미적용인데 0158~0160은 적용된 "순서 갭"**을 발견(공용 uploadAttachment 첨부 INSERT 전건 400 → 이미지 렌더 불가). 근본 원인은 마이그레이션을 supabase CLI가 아니라 Management API `/database/query`로 수동 적용하면서 `supabase_migrations.schema_migrations` 추적 테이블을 갱신하지 않아 "무엇이 실제 적용됐는지" 신뢰할 기록이 없다는 것.
- **조회 방식**: `.env.local`의 `SUPABASE_ACCESS_TOKEN` + Management API `/database/query`(읽기 전용 introspection). 재현 스크립트는 본 문서 말미 참조.

> **[업데이트 · 2026-09-16 적용 완료]** 아래 미적용 4건(0121·0153·0155·0156)은 사용자가 `!`로 번호순 전체 재실행하여 **전부 적용·검증 완료**. 재대조 결과 감사범위(0000~0160) 내 **잔여 갭 0**, 함수본문 currency에서도 0121·0155 해소. ⚠️ 단 감사 이후 병렬 세션이 `0161_alimtalk_template_sync`를 새로 추가 — 관찰 시점 기준 함수 `sync_alimtalk_templates`는 라이브 존재하나 인덱스 `message_templates_alimtalk_code_idx`는 미적용(부분 상태)이며, 본 감사 범위 밖·해당 세션 소관.

---

## 1. 요약 (TL;DR)

전체 124개 마이그레이션 중 **4개가 라이브에 미적용**임을 확정했다. 모두 `information_schema`/`pg_catalog` 직접 조회로 교차 확인했다.

| # | 마이그레이션 | 상태 | 핵심 누락 | 성격 |
|---|---|---|---|---|
| 1 | `0121_moving_inquiry_figma` | ❌ 미적용 | moving_settlements 2컬럼 + RPC 2종(신규/재정의) | 화면 저장 경로 파손 |
| 2 | `0153_default_vendor_categories` | ❌ 미적용 | 함수 2 + 트리거 1 + 백필 | 신규 조직 자동 프로비저닝 결손 |
| 3 | `0155_tenant_cms_credentials` | ❌ 미적용 | occupancies 2컬럼 + RPC 본문 재정의 | 세대 CMS 자격 저장 불가 |
| 4 | `0156_delete_unit` | ❌ 미적용 | 함수 1 | 세대 삭제 RPC 부재 |

- **공통 패턴**: 미적용 4건 중 3건(0153·0155·0156)이 **0154 직후 연속 구간**이다. 즉 노치(Notice) 트랙 마이그레이션(0157~0160)은 적용됐으나, **같은 시기 다른 트랙에서 만들어진 0153·0155·0156이 함께 반영되지 않았다**. 0121은 더 이른(2026-09-10 moving-settlement 트랙) 고립 누락.
- **0157은 이미 해소**됨(bucket 설정·컬럼·constraint 모두 라이브 확인). 0158·0159·0160도 모두 적용됨.
- 나머지 117건은 적용 확인, 3건(0102·0103·0154)은 객체존재로는 검증 불가하나 별도 근거로 적용 정황 확인(§5).

> ⚠️ **커밋·푸시·프로덕션 적용은 이 감사 범위 밖이며 전부 별도 승인 대상.** 아래 수정 SQL은 사용자가 `!` 로 직접 실행하거나 승인 후 적용한다.

---

## 2. 근본 원인: 추적 테이블이 신뢰 불가

`supabase_migrations.schema_migrations`에 기록된 버전:

```
0000‥0025, 0030‥0041, 0050,0051, 0060‥0063, 0070‥0074,
0090‥0103, 0117, 0118, 0120, 0154
```

- 0104~0116, 0119, 0121~0153, 0155~0160 등 **실제로는 적용된 다수 버전이 기록에 없다**(예: 0157~0160은 적용됐지만 테이블에 없음). 반대로 0121은 테이블에도 없고 실제로도 미적용.
- 즉 이 테이블은 **적용 여부의 근거로 쓸 수 없다**. 본 감사는 전부 실제 스키마 객체 introspection으로 판정했다.

---

## 3. 감사 방법 (3중 교차검증)

1. **객체 존재 대조** (`tmp-migration-audit/reconcile.mjs`)
   - 각 마이그레이션 DDL에서 생성 객체(table·ADD COLUMN·function·policy·index·trigger·constraint·enum·bucket)를 추출 → 라이브 스냅샷과 대조.
   - **마지막-연산(last-op) 모델**: 객체별로 마이그레이션 순서상 마지막 연산이 create면 "존재 기대", drop이면 "부재 기대". 같은 파일 내 `drop … if exists; create …`(멱등 가드)는 create로 판정 → 자기-드롭이 갭을 가리지 않도록 함.
2. **함수 본문 최신성 검사** (`tmp-migration-audit/currency.mjs`)
   - 이름만 같고 시그니처가 같은 `CREATE OR REPLACE`는 존재 검사를 통과해도 본문이 구버전일 수 있음(0155가 정확히 이 유형). 함수별 **마지막 정의 마이그레이션이 추가한 토큰**을 라이브 본문(`pg_get_functiondef`)에서 찾아 없으면 "구버전(미적용)"으로 플래그.
3. **라이브 직접 조회 확정** (`verify1~4.sql`)
   - 위 후보 전건을 `information_schema.columns`/`pg_proc`/`pg_trigger`/`pg_constraint`/`pg_policies` 직접 카운트로 확정.

### 방법론이 잡아낸 자기-버그(참고)
- 초기 정규화 불일치로 storage.objects 정책(0111·0129)이 "누락"으로 오검출 → `pg_policies.tablename`은 스키마 없는 `objects`인데 probe는 `storage.objects`로 키를 만든 탓. 수정 후 정상(정책 8종 모두 라이브 존재 확인).
- 초기 drop-netting 버그(멱등 자기-드롭을 "부재 기대"로 처리)가 0153 트리거 갭을 가릴 뻔함 → last-op 모델로 교정.

---

## 4. 확정 갭 상세 + 수정 SQL

> 4건 모두 **멱등**(`add column if not exists` / `create or replace` / `drop … if exists; create …`)이라 재실행 안전. 시그니처 충돌도 확인 완료(§4.5). **번호 순서(0121 → 0153 → 0155 → 0156)** 로 적용 권장.

### 4.1 `0121_moving_inquiry_figma` — 전체 미적용
**라이브 상태**
- `moving_settlements.cleaning_cost`, `moving_settlements.checked_by` 컬럼 **없음**
- `update_settlement_inquiry_rows(jsonb)` 함수 **없음**
- `list_settlement_inquiries` 는 **pre-0121 8-arg 구버전**(신 9-arg=`p_sort` 추가·`cleaning_cost` 반환 없음)

**영향**
- 스태프 이사조회 통합표의 **입금일/청소비 인라인 저장**(update_settlement_inquiry_rows) 동작 불가.
- ⚠️ **연쇄**: `0122_partner_moving_settlement`(적용됨)의 파트너 정산 저장 RPC가 `cleaning_cost`/`checked_by`를 write → **런타임 실패**. 즉 파트너앱 정산 저장이 현재 깨져 있을 것.

**수정**: `supabase/migrations/0121_moving_inquiry_figma.sql` 전체 재실행. (컬럼 추가 → `list_settlement_inquiries` 8-arg drop 후 9-arg 생성 → `update_settlement_inquiry_rows` 생성 순서로 안전.)

**적용 후 검증**
```sql
select count(*) from information_schema.columns
 where table_name='moving_settlements' and column_name in ('cleaning_cost','checked_by'); -- 기대 2
select count(*) from pg_proc where proname='update_settlement_inquiry_rows'; -- 기대 1
```

### 4.2 `0153_default_vendor_categories` — 전체 미적용
**라이브 상태**: `provision_default_vendor_categories(bigint)`·`trg_provision_vendor_categories()` 함수 **없음**, `trg_org_provision_vendor_categories` 트리거 **없음**, 기존 조직 백필 **미실행**.

**영향**
- **신규 조직 생성 시 협력업체 구분 8종 자동 프로비저닝 안 됨**(트리거 부재).
- 기존 조직의 변형 라벨('청소업체' 등) → 정본 라벨 정규화 미수행.
- 현재 프로덕션 조직 **1개**뿐이고 이미 vendor_categories 8행 보유 → **즉시 장애는 아님**. 단, 향후 조직 온보딩 시 결손.

**수정**: `supabase/migrations/0153_default_vendor_categories.sql` 전체 재실행(함수 2종 → 백필 DO블록 → 트리거 함수 → 트리거).

**적용 후 검증**
```sql
select count(*) from pg_proc where proname in
 ('provision_default_vendor_categories','trg_provision_vendor_categories'); -- 기대 2
select count(*) from pg_trigger where tgname='trg_org_provision_vendor_categories'; -- 기대 1
```

### 4.3 `0155_tenant_cms_credentials` — 전체 미적용
**라이브 상태**
- `occupancies.cms_member_no`, `occupancies.cms_contract_no` 컬럼 **없음**
- `save_unit_occupancy_full`(10-arg)은 존재하나 **본문이 0117 구버전** — `pg_get_functiondef`에 `cms_member_no` 문자열 부재(=0155 재정의 미반영).

**영향**: 입주자 폼에서 **효성 CMS 회원번호·계약번호 저장 불가**. 저장 RPC가 두 필드를 조용히 누락(save_unit_occupancy_full이 구버전이라 SET 목록에 없음). 자동이체(효성 CMS) 세대 자격 입력 기능 결손.

**수정**: `supabase/migrations/0155_tenant_cms_credentials.sql` 전체 재실행(컬럼 2종 추가 → `save_unit_occupancy_full` 10-arg `create or replace`). 의존 함수 `save_unit_occupancy`(8-arg) 라이브 존재 확인됨.

**적용 후 검증**
```sql
select count(*) from information_schema.columns
 where table_name='occupancies' and column_name in ('cms_member_no','cms_contract_no'); -- 기대 2
select position('cms_member_no' in pg_get_functiondef(oid))>0
 from pg_proc where proname='save_unit_occupancy_full'; -- 기대 t
```

### 4.4 `0156_delete_unit` — 전체 미적용
**라이브 상태**: `delete_unit(bigint)` 함수 **없음**(0001의 `soft_delete_unit`와 별개 신규 함수).

**영향**: 건물/입주민 관리 화면의 **호수(세대) 소프트 삭제 액션이 RPC 부재로 실패**.

**수정**: `supabase/migrations/0156_delete_unit.sql` 전체 재실행(`create or replace function delete_unit` + revoke/grant).

**적용 후 검증**
```sql
select count(*) from pg_proc where proname='delete_unit'; -- 기대 1
```

### 4.5 적용 방식·순서
동일 세션의 수동 적용 경로(Management API `/database/query`)로 **각 파일 전체를 한 번에** 실행한다. 저장소 헬퍼 예:
```bash
# 쓰기 → 사용자가 ! 로 직접 실행하거나 승인 후 적용 (에이전트는 classifier 차단)
node scripts/notice-e2e/db.mjs f supabase/migrations/0121_moving_inquiry_figma.sql
node scripts/notice-e2e/db.mjs f supabase/migrations/0153_default_vendor_categories.sql
node scripts/notice-e2e/db.mjs f supabase/migrations/0155_tenant_cms_credentials.sql
node scripts/notice-e2e/db.mjs f supabase/migrations/0156_delete_unit.sql
```
- 서로 독립적이나 번호 순서 유지가 안전. 4건 모두 멱등이라 부분 실패 시 재실행 무해.
- 시그니처 충돌 없음 확인: `list_settlement_inquiries` 라이브=8-arg(0121 drop 대상과 일치), `save_unit_occupancy_full` 라이브=10-arg(0155 재정의 대상과 일치).

---

## 5. 검증했으나 "정상(적용됨)"으로 확인한 항목

- **0157~0160 (Notice 트랙)**: 전부 적용. 0157 = attachments 컬럼·`attachments_size_bytes_check`·bucket 설정(public=false·10MB·mime 목록) 라이브 확인. 0158 content_json·0159 notice_buildings(+트리거·정책)·0160 message_logs.notice_id 모두 존재.
- **storage.objects 정책**: `att_read/write/update/delete`(0129), `org_contracts_platform_select/insert/update/delete`(0111) 8종 모두 라이브 존재. bucket `attachments`·`org-contracts` 존재.
- **CHECK constraint 최신성**: `bill_issues_send_status_check`(popbill 상태 포함), `unit_meters_utility_check`(elec_shared/kepco 포함), `building_customer_numbers_calculation_method_check`, `org_members_staff_capabilities_is_array`(0148), `message_logs_result_check`(0037) — 정의 모두 최신.
- **0023 set default/not null**: occupancies.transfer_method = `NOT NULL / default 'none'` 확인. `move_in_scheduled_date` 부재는 정상(0038이 의도적으로 drop).
- **0154 grant-only**: `has_function_privilege('authenticated', list_tenants, execute)=true`.
- **0159 백필**: notice_buildings 0행 = 정상(building_id 지정 공지가 0건이라 백필 대상 없음).
- **중복 번호 마이그레이션**(0013·0129·0130·0131·0132·0140·0146 각 2파일): 각 파일의 객체 전건 라이브 존재 — 한쪽 누락 없음.
- **함수 본문 최신성**: 라이브 195개 함수 대상 검사에서 **0121·0155 외 신규 구버전(stale) 없음** → 0104~0160 재정의 계열(0122·0132·0134·0135~0137·0140s·0141~0144·0146·0147·0149·0151·0152 등) 최신 반영 확인. (currency 검사의 `partner_list_unit_payments`·`settle_message_points` 플래그는 definers=1·주석/문자열 토큰화 아티팩트로 오탐 확인.)

---

## 6. 방법론 한계 (이 감사가 못 잡는 것)

- `pg_get_functiondef`는 **주석을 제거**한다 → 주석만 다른 재정의는 본문검사로 구분 불가(영향 없음).
- `ALTER COLUMN … TYPE` 등 **타입 변경**, 순수 **데이터/백필 DML**(0102 등), 일부 grant 세부는 객체존재로 검증 불가 → 본 감사는 대표 항목만 직접 조회로 보강(§5). 전수 데이터 정합성은 범위 밖.
- 프로덕션 조직이 **1개**뿐이라 다중 조직 백필 영향은 완전 재현되지 않음.

---

## 7. 프로세스 권고 (재발 방지)

- 수동 적용을 유지한다면, **적용 직후 어떤 형태로든 적용 원장을 갱신**(전용 audit 테이블 또는 CLI 채택)해 "무엇이 적용됐는지"를 신뢰 가능하게 만든다. 현재처럼 `schema_migrations`가 방치되면 순서 갭(0157형)이 재발한다.
- 특히 **여러 트랙이 병렬로 마이그레이션을 만든 시점**(이번 0153·0155·0156)에는 트랙별 최신 번호를 한 번에 적용했는지 교차 확인.
- 본 감사 스크립트(`tmp-migration-audit/`)로 언제든 재대조 가능(§9).

---

## 8. 부록 A: 전체 마이그레이션별 상태표

(probes = reconcile가 검사한 구조 객체 수. 0 = 로직/DML/grant 전용이라 객체존재로 검증 불가.)

| 마이그레이션 | probes | 상태 | 비고 |
|---|---|---|---|
| 0000_p0_auth_foundation | 18 | ✅ 적용 |  |
| 0001_p1a_master_data | 21 | ✅ 적용 |  |
| 0002_p2a_accounts_permissions | 19 | ✅ 적용 |  |
| 0003_p2b_setup | 21 | ✅ 적용 |  |
| 0004_p3a_buildings | 15 | ✅ 적용 |  |
| 0005_p3_notices_complaints | 6 | ✅ 적용 |  |
| 0006_p3b_tenants | 28 | ✅ 적용 |  |
| 0007_p5a_utilities | 8 | ✅ 적용 |  |
| 0008_p7a_moving_settlement | 11 | ✅ 적용 |  |
| 0009_p7b_moving_inquiries | 2 | ✅ 적용 |  |
| 0010_p4_messaging | 5 | ✅ 적용 |  |
| 0011_platform_admin | 8 | ✅ 적용 |  |
| 0012_p5_billing | 13 | ✅ 적용 |  |
| 0013_p5_bill_publish | 7 | ✅ 적용 |  |
| 0013_platform_drilldown | 4 | ✅ 적용 |  |
| 0014_p5b_utility_pricing | 12 | ✅ 적용 |  |
| 0015_p6_payments | 8 | ✅ 적용 |  |
| 0016_p5c_utility_mixeduse | 8 | ✅ 적용 |  |
| 0017_p5c_unit_usage_floor | 1 | ✅ 적용 |  |
| 0018_p6_payments_bank_match | 5 | ✅ 적용 |  |
| 0019_p6_cms_debit_download | 1 | ✅ 적용 |  |
| 0020_p6_giro_ledger | 1 | ✅ 적용 |  |
| 0021_fix_billing_calc | 2 | ✅ 적용 |  |
| 0022_overdue_aggregates | 1 | ✅ 적용 |  |
| 0023_tenant_form_moveout | 24 | ✅ 적용 |  |
| 0024_billing_period_settings | 6 | ✅ 적용 |  |
| 0025_long_term_repair_ledger | 12 | ✅ 적용 |  |
| 0030_p4b_messaging_templates | 10 | ✅ 적용 |  |
| 0031_overdue_late_fees | 5 | ✅ 적용 |  |
| 0032_bill_fax_suspend | 18 | ✅ 적용 |  |
| 0033_platform_org_cud | 4 | ✅ 적용 |  |
| 0034_platform_account_cud | 2 | ✅ 적용 |  |
| 0035_platform_point_adjustment | 1 | ✅ 적용 |  |
| 0036_point_ledger_safety_rates | 12 | ✅ 적용 |  |
| 0037_message_point_reservations | 21 | ✅ 적용 |  |
| 0038_drop_dead_tenant_columns | 1 | ✅ 적용 |  |
| 0039_resident_claims | 21 | ✅ 적용 |  |
| 0040_resident_app_billing | 10 | ✅ 적용 |  |
| 0041_resident_move_out | 15 | ✅ 적용 |  |
| 0050_platform_hq_settings | 4 | ✅ 적용 |  |
| 0051_platform_billing_invoices | 7 | ✅ 적용 |  |
| 0060_building_utility_suppliers | 5 | ✅ 적용 |  |
| 0061_gas_fixed_usage_from | 3 | ✅ 적용 |  |
| 0062_partner_field_app | 2 | ✅ 적용 |  |
| 0063_resident_withdraw | 1 | ✅ 적용 |  |
| 0070_partner_field_lookup | 6 | ✅ 적용 |  |
| 0071_partner_complaints | 5 | ✅ 적용 |  |
| 0072_partner_meter | 2 | ✅ 적용 |  |
| 0073_receipts_edit | 6 | ✅ 적용 |  |
| 0074_payment_edit_atomic | 1 | ✅ 적용 |  |
| 0090_partner_tenant_billing | 2 | ✅ 적용 |  |
| 0091_partner_building_detail | 2 | ✅ 적용 |  |
| 0092_management_fee_setting_finish | 4 | ✅ 적용 |  |
| 0093_message_template_fields | 4 | ✅ 적용 |  |
| 0094_scheduled_message_worker | 7 | ✅ 적용 |  |
| 0095_popbill_dispatch_foundation | 24 | ✅ 적용 |  |
| 0096_popbill_point_settlement | 19 | ✅ 적용 |  |
| 0097_popbill_platform_billing | 8 | ✅ 적용 |  |
| 0098_alimtalk_default_templates | 3 | ✅ 적용 |  |
| 0099_settlement_context_contact | 1 | ✅ 적용 |  |
| 0100_staff_bill_token_mint | 1 | ✅ 적용 |  |
| 0101_notice_settlement_share_tokens | 6 | ✅ 적용 |  |
| 0102_finalize_alimtalk_buttons | 0 | ➖ 검증불가 | DML/토큰 정리 — 객체존재로 검증불가(별도 확인: alimtalk 객체 존재로 정황상 적용) |
| 0103_rls_hardening | 0 | ➖ 검증불가 | revoke/grant·정책강화 — 객체존재로 검증불가(2026-08-26 RLS 감사에서 적용확인) |
| 0104_receipts_workspace_rpc | 1 | ✅ 적용 |  |
| 0105_payment_statement_rpc | 1 | ✅ 적용 |  |
| 0106_dashboard_overdue_count | 1 | ✅ 적용 |  |
| 0107_platform_pagination_indexes | 2 | ✅ 적용 |  |
| 0108_platform_paginated_lists | 4 | ✅ 적용 |  |
| 0109_hot_path_indexes | 3 | ✅ 적용 |  |
| 0110_bulk_reorder | 2 | ✅ 적용 |  |
| 0111_admin_tenant_contract | 18 | ✅ 적용 |  |
| 0112_admin_accounts_and_amounts | 8 | ✅ 적용 |  |
| 0116_buildings_tenant_manager_columns | 2 | ✅ 적용 |  |
| 0117_tenant_registration_redesign | 20 | ✅ 적용 |  |
| 0118_customer_number_lookup_figma | 6 | ✅ 적용 |  |
| 0119_editable_meter_reading_fields | 1 | ✅ 적용 |  |
| 0120_required_utility_fee_items | 7 | ✅ 적용 |  |
| 0121_moving_inquiry_figma | 4 | ❌ 미적용 | moving_settlements.cleaning_cost/checked_by 컬럼 없음, update_settlement_inquiry_rows 없음, list_settlement_inquiries 는 pre-0121(8-arg) 구버전 |
| 0122_partner_moving_settlement | 4 | ✅ 적용 |  |
| 0123_setup_company_notifications | 10 | ✅ 적용 |  |
| 0124_building_register_redesign | 6 | ✅ 적용 |  |
| 0125_org_sender_numbers | 4 | ✅ 적용 |  |
| 0126_platform_monthly_send_cost | 1 | ✅ 적용 |  |
| 0127_resident_phone_normalization | 3 | ✅ 적용 |  |
| 0128_login_rate_limit | 2 | ✅ 적용 |  |
| 0129_attachments_storage | 5 | ✅ 적용 |  |
| 0129_payment_ledger_fixes | 3 | ✅ 적용 |  |
| 0130_late_fee_org_scope | 2 | ✅ 적용 |  |
| 0130_utility_reading_validation | 5 | ✅ 적용 |  |
| 0131_payment_occupancy_attribution | 3 | ✅ 적용 |  |
| 0131_resident_search_buildings_scope | 1 | ✅ 적용 |  |
| 0132_res_claims_one_linked_per_occupancy | 1 | ✅ 적용 |  |
| 0132_settlement_autocollect | 3 | ✅ 적용 |  |
| 0133_session_active_enforcement | 5 | ✅ 적용 |  |
| 0134_resident_scope_onboarding_fixes | 5 | ✅ 적용 |  |
| 0135_utility_price_fallback | 2 | ✅ 적용 |  |
| 0136_cms_net_balance | 1 | ✅ 적용 |  |
| 0137_record_login_service_role | 1 | ✅ 적용 |  |
| 0138_messaging_dispatch_fences | 8 | ✅ 적용 |  |
| 0139_resident_token_occupancy_binding | 8 | ✅ 적용 |  |
| 0140_resident_automatch_details | 1 | ✅ 적용 |  |
| 0140_revoke_user_sessions | 1 | ✅ 적용 |  |
| 0141_resident_profile_kakao_name | 1 | ✅ 적용 |  |
| 0142_resident_bill_late_fee | 1 | ✅ 적용 |  |
| 0143_resident_bill_paid_date | 1 | ✅ 적용 |  |
| 0144_resident_bill_detail_usage_late | 2 | ✅ 적용 |  |
| 0145_resident_profile_image | 2 | ✅ 적용 |  |
| 0146_resident_automatch_profile_image | 1 | ✅ 적용 |  |
| 0146_resident_bill_signed_url | 5 | ✅ 적용 |  |
| 0147_persona_predicates | 2 | ✅ 적용 |  |
| 0148_staff_capabilities | 10 | ✅ 적용 |  |
| 0149_resident_signed_url_expiry_1month | 1 | ✅ 적용 |  |
| 0150_messenger_recurrence | 6 | ✅ 적용 |  |
| 0151_billing_area_pyeong | 1 | ✅ 적용 |  |
| 0152_get_my_context_org_name | 1 | ✅ 적용 |  |
| 0153_default_vendor_categories | 3 | ❌ 미적용 | provision_default_vendor_categories / trg_provision_vendor_categories 함수·트리거 없음, 백필 미실행 |
| 0154_restore_tenant_directory_rpc_grants | 0 | ➖ 검증불가 | grant-only — has_function_privilege(list_tenants)=true 로 적용확인 |
| 0155_tenant_cms_credentials | 3 | ❌ 미적용 | occupancies.cms_member_no/cms_contract_no 컬럼 없음, save_unit_occupancy_full 본문에 cms 로직 없음(구버전) |
| 0156_delete_unit | 1 | ❌ 미적용 | delete_unit 함수 없음 |
| 0157_attachment_metadata_and_image_policy | 4 | ✅ 적용 |  |
| 0158_notice_rich_text | 3 | ✅ 적용 |  |
| 0159_notice_multi_building | 11 | ✅ 적용 |  |
| 0160_notice_send_log_link | 4 | ✅ 적용 |  |

---

## 9. 부록 B: 재현 방법

감사에 쓴 스크립트·스냅샷은 임시 작업물(`tmp-migration-audit/`)로 **감사 후 제거**했다(git 미추적). 아래만 있으면 언제든 재현 가능하다.

**읽기 경로**: `.env.local`의 `SUPABASE_ACCESS_TOKEN` + `POST https://api.supabase.com/v1/projects/amhtprmapxlizdnsgbeg/database/query`(읽기 전용).

**핵심 introspection 쿼리**(라이브 스냅샷):
```sql
-- 컬럼
select table_schema||'.'||table_name tbl, column_name, udt_name from information_schema.columns where table_schema in ('public','storage');
-- 함수(시그니처)
select p.proname, pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
-- 함수 본문(최신성 검사용)
select p.proname, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
-- 정책 / 트리거 / 제약 / 인덱스 / enum / bucket
select schemaname, tablename, policyname from pg_policies where schemaname in ('public','storage'); -- tablename 은 스키마 없는 bare 이름
select event_object_table, trigger_name from information_schema.triggers where trigger_schema in ('public','storage');
select conrelid::regclass::text tbl, conname, contype from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public';
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
```

**대조 2기법**:
1. **객체 존재(last-op 모델)** — 각 마이그레이션 DDL에서 생성 객체를 추출, 마이그레이션 순서상 객체별 마지막 연산이 create면 "존재 기대"·drop이면 "부재 기대"(같은 파일 `drop … if exists; create …`는 create로 판정). 라이브 스냅샷에 없으면 갭 후보.
2. **함수 본문 최신성** — 함수별 마지막 정의 마이그레이션이 (직전 정의 대비) 추가한 토큰(문자열 리터럴·식별자)을 라이브 `pg_get_functiondef` 본문에서 검색, 없으면 구버전(미적용) 후보. (시그니처 동일 `CREATE OR REPLACE` 미적용 탐지 — 0155가 이 유형.)

후보는 전건 `information_schema`/`pg_catalog` 직접 카운트로 확정.

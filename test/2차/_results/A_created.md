# 그룹 A 생성 데이터 정리 현황

앱 화면으로 삭제했지만 DB에 행이 남는 것(soft delete/비활성화)과 앱으로 지울 수 없는 것을 적는다. SQL로 직접 삭제한 것은 없다.

| 테이블 | id | 내용 | 상태 | 사유 |
|---|---|---|---|---|
| buildings | 33 | TC2A-테스트빌딩(코드 005) | 앱에서 건물 삭제(soft delete, deleted_at 설정) | 앱 삭제가 soft delete라 행과 코드 005는 남음(삭제 코드도 중복 검사 대상이므로 005 재사용 불가) |
| buildings | 34 | TC2A-삭제빌딩(코드 130) | 앱에서 삭제(soft delete) | 위와 같음 |
| buildings | 35 | TC2A-이관1(코드 140, 데이터 이관으로 생성) | 앱에서 삭제(soft delete) | 위와 같음 |
| units / occupancies / occupancy_history / unit_meters / lease_contracts | units 73·74·75 등 | 건물 33의 101·102·103호, 전출 이력 3건 | 건물 삭제와 함께 soft delete(103호는 호수 삭제) | 앱에 하드 삭제 경로가 없음 |
| building_customer_numbers | 62, 63, 64, 65 | TC2A-W1/W2/C1, TC2A-DEL-W1 | 63은 soft delete, 나머지는 건물과 함께 남음 | 앱에 하드 삭제 경로가 없음 |
| profiles / org_members / auth.users | 93c9f0be-532b-4b97-b719-acaee4f9dbd7 (tc2a_office1), aeb2a4f7-dfed-46da-8dc7-ba9f664dedc1 (tc2a_office2), 0362e659-e221-4841-ab53-510fba4efde7 (tc2a_office3), 0ae5c79e-0512-4bad-b611-0d9b3b48a409 (tc2a_field1) | 테스트 직원 계정 4개 | 앱의 `삭제` = 비활성화(is_active=false) | 앱에는 계정 하드 삭제 기능이 없음. 아이디가 남아 같은 아이디 재사용 불가 |
| attachments (+ Storage 파일) | entity_type=vendor, entity_id=21, 10행 | 삭제된 협력업체 TC2A-소방의 계약서 사진(p*.png) | 업체를 삭제해도 첨부 행이 남음(고아 데이터) | 업체 삭제 시 첨부가 정리되지 않음. 업체가 없어져 앱에서 지울 경로가 없다(별도 결함 후보: 업체 삭제 시 attachments·storage 연쇄 삭제 필요) |
| data_migration_runs | building 1건 | 이관 진행 기록 | 앱 `진행 기록 초기화`로 초기화 → 화면은 미실행으로 복귀 | 초기화 방식에 따라 이력 행이 남을 수 있음 |
| audit_log / access_log | 다수 | 테스트 중 생성된 감사·반출 로그 | 남김 | 감사 로그는 삭제 대상이 아님 |

삭제가 끝나 남은 것이 없는 데이터: 협력업체 TC2A-CCTV·TC2A-방역·TC2A-소방, 사용자 구분 TC2A-방역 업체·TC2A-조경 업체(업체2).

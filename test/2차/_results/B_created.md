# 그룹 B 생성 데이터 정리 현황

앱 화면으로 삭제했지만 DB에 행이 남는 것(soft delete)과 앱으로 지울 수 없는 것을 적는다. SQL로 직접 삭제한 것은 없다. (예외: 가스 단가 1건은 화면에 가스 단가 입력 UI가 없어 로그인 세션으로 앱 RPC `save_utility_unit_prices`를 호출해 넣었다.)

| 테이블 | id | 내용 | 상태 | 사유 |
|---|---|---|---|---|
| buildings | 30 | TC2B-테스트빌딩(코드 002, 그룹 3, 유형 TC2B유형) | 앱 `건물 삭제`(soft delete, deleted_at 설정) | 앱 삭제가 soft delete라 행과 코드 002가 남음 |
| buildings | 31 | TC2B-빈건물(코드 003) | 앱 `건물 삭제`(soft delete) | 위와 같음 |
| units / occupancies / unit_meters / occupancy_history | units 62·64·66·67·69·71·76·77 / occupancies 54·56·58·59·61·63·68·69 | 30번 건물 101·102·103·104·105·201·202호, 31번 건물 101호(105·202호는 앱에서 퇴실 처리) | 건물 삭제로 화면에서 사라짐, 행은 남음 | 앱에 호실 하드 삭제 경로 없음(건물 삭제 후에는 호실 화면 접근 불가) |
| building_customer_numbers | 59·60·61(TC2B-W1/E1/G1), 66·67(TC2B-W9/E9) | 테스트 고객번호 | 건물과 함께 남음 | 앱에 하드 삭제 경로 없음 |
| meter_readings / utility_customer_bills / utility_unit_prices / unit_fixed_values / billing_period_settings | 28 / 7 / 1(가스 TC2B-G1 950원) / 4 / 3행 | 8~10월 전기·수도·가스 검침·청구총액·단가·고정 사용량·부과기준일 | 남음 | 건물 단위 데이터라 앱에서 개별 삭제 경로 없음 |
| water_discounts | unit_id 62 1행 | 101호 수급자 10,000원 | 남음 | 건물 삭제 전에 할인 해제를 하지 못했고, 삭제 후에는 수도 화면에서 건물이 보이지 않음 |
| fee_item_charges / billing_confirmations / billing_history | 16 / 4 / 12행 | 9·10월 관리비 입력·10월 부과 확정 이력 | 남음 | 확정·이력 데이터는 앱에서 삭제하지 않음(과거 부과 보호) |
| bill_issues | 128, 129 | 10월분 지로 고지서 발행 기록(101·102호, 인쇄 시 자동 생성) | 남음 | 앱에 발행 기록 삭제 경로 없음 |
| long_term_repair_ledger | 20, 21, 22 | 장기수선 원장 3행 | 앱에서 행 삭제·저장(soft delete) | 첨부 5장은 앱에서 삭제 완료(attachments 0행) |
| building_types / fee_items | building_types 37 `TC2B유형` / fee_items 171~177 | 테스트 건물 유형과 항목(전기·수도료·가스·정화조·일반관리비·승강기유지비, 청소비는 soft delete) | **삭제 불가로 남음** — 다른 그룹 화면의 항목등록 관리 탭과 건물 유형 선택지에 `TC2B유형`이 보임 | 부과 이력(fee_item_charges 16행)이 있어 DB 트리거 guard_building_type_delete가 삭제 차단. 정리하려면 관리자 판단으로 해당 이력 처리 후 삭제 필요 |
| audit_log | 다수 | 테스트 중 생성된 감사 로그 | 남김 | 감사 로그는 삭제 대상 아님 |

삭제가 끝나 남은 것이 없는 데이터: 건물 유형 `TC2B삭제`(앱에서 삭제), 장기수선 첨부 이미지 5장.

변경 후 원복한 설정: TC2B-테스트빌딩 `중요 건물` 체크(해제 원복). 다른 건물·조직 설정·admin 계정은 변경하지 않았다. 문자·알림톡·팩스 발송은 하지 않았다(팩스는 `발송` 클릭 시 선택 세대 없음 안내까지만).

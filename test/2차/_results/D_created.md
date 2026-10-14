# 그룹 D 생성 데이터 정리 현황

앱에서 지운 항목
- 이사정산 30(201호), 31(205호), 35(202호): 이사정산 입력의 「삭제」로 지움
- 건물 TC2D-테스트빌딩(buildings.id 32): 건물 상세의 「건물 삭제」로 지움. soft_delete_building 이 실행되어 deleted_at 이 2026-10-14 09:22 UTC 로 기록되고, 호실 6개와 입주 정보도 함께 soft delete 됨
- 테스트 사무실 계정 tc2d_perm(TC2D권한B): 계정 모달의 「삭제」를 실행함. 실제 동작은 admin_set_active 이므로 비활성화만 됨

앱에서 지울 수 없어 남은 항목

| 테이블 | id / 키 | 사유 |
|---|---|---|
| moving_settlements | 34 (204호), 36 (101호) | 퇴실완료 건은 앱에서 삭제할 수 없음. 204호는 새 입주자가 있어 퇴실 취소도 안 됨. 건물이 soft delete 되어 조회 화면에는 나오지 않음 |
| billing_confirmations | 건물 32 소속 호실 18건 (2026-08~10월분) | 부과 확정 이력은 삭제 기능이 없음. 건물 soft delete 로 화면에서는 숨겨짐 |
| payments | 101호(unit 72) 2026-08 수납 66,600원 1건 | 수납관리에서 삭제(취소)하면 취소 행으로 남음. 건물 삭제 전에 취소하지 않았음 |
| meter_readings | 건물 32 호실 25건 (수도·전기, 9~10월) | 검침 이력은 삭제 기능이 없음 |
| utility_scoped_prices | building_id 32, 수도 주거 820원 1건 | 건물 soft delete 후에는 편집 화면에 들어갈 수 없음 |
| occupancy_history | unit 68(204호) 등 2건 | 전출 이력. 건물과 함께 숨겨짐 |
| bill_issues | 101호 2026-10 지로 발행 이력 1건 | 발행 이력은 삭제 기능이 없음 |
| settlement_checklist_results / audit_log | 정산 30~36 관련 | 시스템 이력이라 남음 |
| org_members / profiles | 사용자명 tc2d_perm (비활성) | 앱의 계정 「삭제」는 비활성화만 함 |

변경했지만 원상 복구한 공유 데이터: 없음. 조직 설정, 항목 설정, 다른 건물, admin·field1 계정은 바꾸지 않았음. 문자, 알림톡, 팩스, 푸시는 실제로 발송하지 않았음(독촉 문자 작업창은 열기만 함).

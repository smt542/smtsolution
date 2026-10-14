# 그룹 C 테스트 데이터 정리 현황 (TC2C)

앱 화면에서 삭제 가능한 데이터는 모두 삭제했다. 아래는 앱에 삭제 경로가 없거나 소프트 삭제로 행이 남은 데이터다(SQL 삭제는 하지 않음).

| 테이블 | id / 키 | 상태 | 남은 사유 |
|---|---|---|---|
| buildings | 29 (TC2C-테스트빌딩) | 소프트 삭제(deleted_at) | 앱 「건물 삭제」 = soft_delete_building |
| units | 55~60 (101~106호) | 소프트 삭제 | 건물 삭제에 연동 |
| occupancies | 47~52 | 소프트 삭제 | 건물 삭제에 연동 |
| lease_contracts | occupancy_id 47~52 (6행) | 행 유지 | 삭제 경로 없음(점유 소프트 삭제만) |
| billing_confirmations | unit_id 55~60, 16행(2026-02~09) | 행 유지 | 수납 이력 「추가」 당월계·연체로 생성. 앱에 확정 삭제 경로 없음 |
| payments | unit_id 55~60, 12행(active 11·canceled 1) | 행 유지 | 수납 취소는 status=canceled 로만 남고 물리 삭제 경로 없음. 건물 삭제로 화면 비노출 |
| payment_late_fee_splits | unit_id 55~60, 5행 | 행 유지 | 수.연 미수금. 삭제 경로 없음 |
| complaints | 63~66 (TC2C AS ...) | 소프트 삭제 | A/S 상세 「삭제」 |
| notices | 10~13 (TC2C-공지-*) | 소프트 삭제 | 공지 상세 「삭제」 |
| notice_share_tokens | notice_id 12, 1행 | 행 유지 | 공유 링크 비로그인 열람 확인용으로 mint_notice_share_token 호출. 공지가 삭제돼 열람 불가 |
| message_templates | TC2C-문자템플릿, TC2C-승인템플릿(316) | 소프트 삭제 | 템플릿 관리 「삭제」 |
| message_schedules | 45 (TC2C 예약테스트 발송금지) | status=cancelled | 예약 취소 완료. 실제 발송 없음 |
| audit_log | BILLING_OVERRIDE·PAYMENT_RESTORE 등 | 행 유지 | 감사 로그는 삭제 대상 아님 |

- 실제 문자·알림톡·팩스 발송 및 포인트 차감 없음(확인 모달에서 취소, 예약 1건은 취소).
- 진입 알림 「오늘 그만보기」는 테스트용 헤드리스 브라우저 localStorage 에만 기록(다른 세션 영향 없음).

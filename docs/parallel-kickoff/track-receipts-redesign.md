# Track: 수납관리·민원접수 세대중심 재설계 (`/staff/receipts`)

> 정본 킥오프 문서. 2026-08-20 세션에서 복원 작성(이전 세션이 경로만 예약하고 파일을 만들지 않음).
> 디자인 **정본**은 staff.zip 프로토타입 `staff/receipt-management/`(`.md`+`.dc.html`, 2026-08-12/14). 본 문서는 그 요약+실행계획이다.

## 0. 결정·배경

- **결정(2026-08-20, 사용자)**: `/staff/receipts`(수납관리·민원접수)를 프로토타입 **세대중심 설계로 전면 재설계**하고, `/staff/payment`(지로·은행 자동수납·효성CMS·지로원장)를 **흡수·삭제**한다. 구 '분리 2화면 유지'(2026-07-03 PRD) 판단을 뒤집는다. 프로토타입 우선.
- **세션 결정(2026-08-20)**:
  - 머지: **단계별 PR**(P1·P2·P3·P4 각각 master 머지). 라이브는 미사용 상태라 중간노출 무시.
  - A/S(3.3): 라이브 회귀 무시, **더 나은 구현 우선** → 기존 민원 CRUD 컴포넌트를 신설계 3.3에 재사용(P1부터 접수/상세 동작), P2에서 확인문자 단문화.
  - 조회: **풀 4소스**(청구·이사정산·세입자·건물주) + `jumpTo` 를 P1에서 완성.
  - 권한 게이트: 흡수 화면이므로 **`payment || complaints`** 둘 중 하나면 접근(payment 사용자 접근 보존).

## 1. 목적

건물·호실을 선택해 세대별 **수납 이력·입주자 정보·A/S(민원)** 를 통합 관리. 부과/미납/수납 조회, 명세서·영수증 출력, 지로·은행 자동수납, A/S 접수·확인문자까지 한 화면.

## 2. 구조 (프로토타입 3.0~3.5)

- **3.0 좌측 레일 + 상단 도구**: 건물명·주소 검색 → 건물 선택 → 호실 선택. 건물 영역에 **수납 건물메모/부과시 참조사항**(수정→저장). 상단: `조회 · 월별 부과금액 · 빌라▾(부과금액·미납내역·수납내역) · 호실▾(명세서·영수증) · 자동수납▾(지로수납처리·지로원장·처리일자확인·은행 업로드·은행 양식다운)`.
  - **조회 = 통합검색 모달**: 금액으로 / 입금자명·전화·동호로 → 청구·이사정산·세입자·건물주. 결과 클릭 시 해당 세대 전환(`jumpTo`).
- **3.1 수납 이력(월별)**: 컬럼 `처리·년월·당월계·연체·수납액·수료·수납일자·은행·구분·비고·기한` + 합계(미납·연체료·미납합계) + 미납 문자전송.
- **3.2 입주자 정보**: `입주자명·입금자명·전화·입주일·퇴거일·적요·문자(동의)·알림톡(동의)·부과(Y/N)·출력(Y/N)`. 수정/저장.
- **3.3 A/S(민원) 현황·접수**: 컬럼 `No·호수·접수일시·유형·접수내용·전화·처리결과·처리결과내용·시행일자·시간·접수자·담당자`. 호실/건물전체 스코프, 결과필터. 접수 추가·상세. **확인문자=상세폼 단문**(3종 템플릿 모달 폐지).
- **3.4 자동수납**: 지로 수납처리·원장·처리일자, 은행 엑셀 업로드 자동매칭(키 고객번호·이름·금액), 에러체크 정상/이중수납.
- **3.5 출력**: 명세서·영수증.
- **폐지**: AS접수현황 전용 팝업·엑셀·호실 더블클릭(신설계 미채택) → `receipts/as-status` + `api/receipts/as-status/export` 제거(P4 정리).

## 3. 재사용 자산

- 훅: `receipts.useReceiptPaymentStatus`, `units.useUnits`, `occupancies.useUnitOccupancyFull/useTenantList`, `payments.usePaymentRows/useUnitPayments/useBankPayments/useGiroPayments`, `unitAccounts.useUnitAccounts`, `complaints.*`, `movingSettlement.useSettlementInquiry`, `buildings.useBuildings`(ownerName/ownerPhone), `accounts.useAccounts`, `asCategories`.
- 컴포넌트: `payment/components/{PaymentHistoryModal,PaymentStatementModal,PaymentReceiptModal,BankImportModal,GiroLedgerModal,PaymentAmountModal}`, `receipts/components/{ComplaintFormModal,ComplaintDetailModal,ComplaintTable}`, `messaging/components/MessagingModal`, `components/common/*`.
- lib: `billing/{period,lateFee,total,proration,pivot}`, `payments/{status,match,bankParse}`.

## 4. 단계 (각 단계 = 커밋·검증·wbs-sync·PR)

- **P1 셸·조회**(마이그 0): 세대중심 레이아웃(좌측 선택 + 우측 3섹션) + 통합검색(4소스)+jumpTo. 3.1/3.2 읽기표시, 3.3은 기존 민원 CRUD 재사용. 도구바: 조회 배선, 나머지(빌라·호실·자동수납)는 `/staff/payment` deep-link 유지. 게이트 `payment||complaints`.
- **P2 편집**: 건물메모·부과참조 / 입주자정보 / 월별 수납이력(추가·수정·저장) / 미납·A/S 확인문자(단문). 마이그 0073+ (건물 부과참조 필드, 문자·알림톡 동의 필드 등).
- **P3 자동수납 흡수**: /payment 지로·은행·CMS·원장을 자동수납▾로 인라인 이관 → `/staff/payment` 삭제·GNB·deep-link 정리. 회귀 테스트 필수(payment 테스트 대량 영향).
- **P4 출력·정리**: 명세서·영수증 인라인화(기존 payment 재사용), `receipts/as-status`+export 제거.

## 5. 제약

- 건드리는 범위: `(staff)/receipts`·`(staff)/payment` + 관련 lib/hooks/api만. `(resident)/(platform-admin)/(partner)` 및 (staff) 내 타 화면 로직 미접촉.
- 확인문자/미납문자 **실발송 stub 유지**(NCP 키 대기 = Track E). UI·프리셋 배선까지.
- 마이그 0073부터(커밋 직전 origin/master max 재확인). 기존 payment 데이터·로직 보존·이관.
- 검증 tsc/vitest/lint/next build 매 단계 통과. 커밋 직후 wbs-commit-sync(dev).

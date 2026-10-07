<!-- source: 주택관리ERP / page_id: 700d352b-575a-4c91-a67a-dc8d46c58452 / updated_at: 2026-08-14T05:37:03.328624+00:00 -->

# 주택관리ERP — 상태·코드 정의 (Status & Codes)

> 여러 화면이 공유하는 **열거형(enum)·상태값**의 표준 정의. 화면 PRD는 값을 새로 정의하지 말고 이 표를 참조한다. (62개 화면 실제 검토 기반)
> 상위 참조: [_service-policy.md](_service-policy.md) · 필드는 [_data-dictionary.md](_data-dictionary.md)

## 1. 민원 · A/S

| 코드군 | 값 | 사용처 |
|--------|----|--------|
| **A/S 처리결과/상태** | 미결 · 보류 · 완결 · 반복 (일부 화면 `진행` 포함) | receipt-management, mobile-as, RNB 패널 |
| **A/S 유형** | A/S신청 · 건물주수납 · 이사정산 · 건물주요청 · 안내문공지 · 기타 | 공통(setup에서 최대 6개 등록·변경) |
| 상태 색상 | 미결=red · 보류=amber · 완결=green · 반복=violet | 공통 뱃지 |
| 처리결과 상세문구 | 확인 중 · 부품 주문 대기 · 현장 방문 예정 · 조치 완료 · 재점검 필요 | RNB, receipt |

## 2. 퇴실 · 이사정산

| 코드군 | 값 | 사용처 |
|--------|----|--------|
| **퇴실 신청 상태(staff)** | 신규 · 확인 | RNB 퇴실 카드 |
| **퇴실 신청 상태(resident)** | received(접수·확인 중) · done(정산 완료) | resident-home/me |
| **이사정산 상태(staff)** | 작성중 · 정산완료 · 중도퇴실 · 퇴실완료 | moving-settlement |
| **이사정산 상태(조회)** | 완결 · 미결 (전체/완결/미결) | moving-status/elec/water/gas |
| **이사정산 상태(partner)** | 미결(미수금>0) · 완료 | mobile-tenant/ms-new |
| 청소 처리 | 미결 · 완료 | mobile-ms-new |

## 3. 수납 · 미납

| 코드군 | 값 | 사용처 |
|--------|----|--------|
| **수납 처리 유형** | 수동 · 원금 · 취소 · 분할 | payment-processing, receipt |
| **수납 상태** | 완납 · 부분(분할) | payment-processing |
| **수납 구분** | 일반 · 지로 · 이체 · 무통(무통장) | receipt (partner: 지로/일반) |
| **입금 은행(수납)** | 무통장입금 · 지로입금 | receipt |
| **지로 은행** | 농협 · 국민 · 우리 · 신한 | receipt |
| **에러 체크** | 정상 · 이중수납 | receipt(지로/은행 매칭) |
| 미납 조회 범위 | 전체(all) · 당계(cur) | overdue-management |
| 독촉 대상 기준 | 연체 2개월↑ **AND** 합계 10만원↑ | overdue-management |

## 4. 건물 · 세대 · 입주자

| 코드군 | 값 | 사용처 |
|--------|----|--------|
| **건물 유형** | 빌라 · 빌딩 · 아파트 · 오피스텔 · 상가 (화면별 부분집합) | building-*, mobile-building |
| **룸 타입** | 원룸 · 1.5룸 · 투룸 · 쓰리룸 · 기타 | tenant-*, building-list |
| **할인 유형** | 일반 · 수급자할인 · 다자녀할인 · 기타할인 | tenant-*, utility-* |
| 세대 상태 뱃지 | 공실 · 입주예정 · 연체 · 신규(입주 60일 이내) | tenant-list, mobile-meter |
| 문자·알림톡 수신 | 동의 · 거부(비동의) | tenant-detail |
| 부과금 여부 / 고지서 출력 여부 | Y · N | tenant-detail, building-list |
| 연체료 부과 / 단수 출력 여부 | O · X | tenant-detail |
| 이체 방식 | 지로 · 이체 · 자동이체 · 입금 · 없음 | tenant-detail |
| 고지서 이름 출력 | 이름 미출력 · 이름 출력 · 코드번호 출력 | tenant-detail |
| 고지서 발송 | 문자 · 우편 | tenant-detail |
| 적립금 유형 | 적립금 · 장기수선충당금 · 기타 · 없음 | building-detail |

## 5. 임대 · 부동산

| 코드군 | 값 |
|--------|----|
| 임대 구분 | 월세 · 전세 · 협의가능 |
| 거래 형태 | 직거래 · 중개거래 |
| 부동산 구분 | 월세 · 전세 · 전·월세 |

## 6. 공과금 · 검침 · 부과

| 코드군 | 값 | 사용처 |
|--------|----|--------|
| **검침 항목** | 수도(㎥) · 전기(kWh) · 가스(㎥) · 공용전기 | utility-*, mobile-meter, management-fee-setting |
| **부과 기준** | 면적 · 인원 · 균등 · 계량 | utility-*, tenant |
| **계산법(고객번호)** | 기본 · 인원 · 시조례 · 시+톤당 · 시+인원 · 한전 · 기타 | building-detail |
| 계산 방식 | 자동 · 수동 | building-detail, utility-lookup |
| 이체 구분(고객번호) | 이체 · 입금 · 보류 · 조회 | building-detail |
| 고지 기간 | 당월 · 전월 · 전전월 | building-detail |
| 고지 기간 출력 | Y · N | building-detail |
| 검침 구분(월) | 당월 · 전월 | utility-* |
| 부과기준일 범위 | 전월16일 ~ 당월15일(기본) | utility-*, management-fee-setting |
| 단가 상수(기본) | 전기 120 · 가스 950 · 수도 800 · 알림톡 12 · 문자 20 · 팩스 50 | utility-*, settings |
| 세대 행 플래그 | 퇴실 예정 · 공실 사용량(이상치) · 최근 입주 · 공실 | utility-* |

## 7. 관리비 항목 (fee-item)

| 코드군 | 값 |
|--------|----|
| **반올림** | 절상(10원 올림) · 4사5입 · 절하(10원 내림) · 그대로 |
| **일자 계산** | 적용(실거주 일할·중간입퇴실 반영) · 안함(고정금액) |
| **이월** | 이월(전월 부과금액 유지) · 안함 |
| 부과 그룹 유형 | 1 ~ 5 (건물별, 부과기간 상이 대응) |

## 8. 공지 (notice)

| 코드군 | 값 | 비고 |
|--------|----|------|
| **공지 유형** | normal(신규/일반) · important(중요) · urgent(긴급) | important=앱 홈 상단 강조, urgent=알림톡 즉시 발송 |
| 읽음 상태 | unread(미확인) · read | resident-notice |
| 진입 모드 | app · guest(비로그인 공유링크) | resident-notice-detail, bill-detail |

## 9. 계정 · 권한

| 코드군 | 값 | 사용처 |
|--------|----|--------|
| **staff 계정 유형** | 사무실 관리자(office) · 현장 관리자(field) · 입주자(tenant) | staff-management 탭 |
| **회원 유형** | 마스터(master) · 일반(normal) | staff-management |
| **계정 상태** | 활성(on) · 비활성(off) | staff-management |
| **입주자 연결 상태** | 연결됨(linked) · 미연결 · 매핑실패 | staff-management (매핑실패만 수동연결) |
| 세대 연결요청(claim) 상태 | pending · linked | res_claims |
| 세대 확인요청 종류(kind) | unit(호수 지정) · search(건물 검색) | resident-verify |

## 10. admin (본사)

| 코드군 | 값 |
|--------|----|
| **테넌트 상태** | 운영(run) · 정지(stop) · 해지(end) + 파생 "90일 내 만료" |
| **본사 계정 역할** | 마스터 · 운영 · 지원 · 영업 · 회계 · 기타 |
| 본사 계정 상태 | 활성 · 정지 |
| **청구 상태** | 미입금(wait) · 입금완료(paid) · 청구 없음(none) |
| **포인트 잔액 상태** | 정상 · 충전 필요(≤기준) · 발송 중단(≤0) |
| 데이터 이관 대상(kind) | vendorMaster · building · vendor · util · feeitem · tenant · meter · unpaid |
| 이관 상태 | 미실행 · 완료 |

## 11. 발송 (messaging) — 상세는 [_notification-policy.md](_notification-policy.md)

| 코드군 | 값 |
|--------|----|
| **채널** | 문자(SMS) · 알림톡 · 팩스 |
| 예약 유형 | 예약 · 예약(매월) · 예약(매주) |
| 발송 상태 | 완료 · 실패 · 예약 |
| 수신자 대상 | 입주자 · 건물주 · 담당자 · 청소 담당자 |
| 발신자 | 관리비서 채널(알림톡) · 042-632-8770(문자) |

## 12. 협력업체 구분 (vendor-management)

기본 구분(사용자 추가 가능): 청소 업체 · 정화조 업체 · 인터넷 업체 · 전기안전업체 · 유선방송정보업체 · 승강기보수업체 · 승강기정기검사업체 · 소방검사업체 · CCTV 업체

# 주택관리ERP — 화면 지도 (Screen Map)

> 4개 롤 **62개 화면**의 전체 목록·진입·이동 관계. 화면 PRD 범위 파악과 누락 방지용. 각 화면 파일은 `{role}/{screen}/{screen}.dc.html`, PRD는 `{role}/{screen}/{screen}.md`.
> 상위 참조: [_service-policy.md](_service-policy.md)

| 롤 | 화면 수 |
|----|:---:|
| admin (본사 웹) | 7 |
| staff (사무 PC ERP) | 26 |
| partner (현장 모바일) | 10 |
| resident (세입자 앱) | 14 |
| **합계** | **57** |

---

## admin — 본사 웹 (HQ)

**공통 LNB**: 대시보드 · 테넌트 관리 · 포인트 관리 · 청구 관리 · 계정·권한 · 설정 (푸터: 본사 관리자 · 로그아웃)

| 화면 | 폴더 | 목적 | 주요 이동 |
|------|------|------|-----------|
| 로그인 | `login` | 본사 콘솔 로그인 | → overview |
| 대시보드 | `overview` | 계약·건물·입주자·발송비 현황(표시 전용) | — |
| 테넌트 관리 | `tenants` | 관리업체 목록·생성·수정·상태변경·삭제(목록+모달) | — |
| 포인트 관리 | `points` | 팝빌 포인트 잔액·소진·충전 | — |
| 청구 관리 | `usage` | 월별 발송비 청구서 발행·입금관리 | → points(발송중단) |
| 계정·권한 | `accounts` | 본사 내부 계정 관리 | — |
| 설정 | `settings` | 발송단가·잔액기준·청구계좌·청구기준 | — |

## staff — 사무 PC ERP

**공통 LNB**: 수납관리·민원접수 · 건물·입주자 관리 · 공과금 관리[고객번호 조회·전기·수도·가스] · 관리비 부과 세팅 · 항목등록 관리 · 서류 발행·출력 · 미납 관리 · 이사정산[입력·전체·전기·수도·가스 이사조회] · 협력업체 관리 · 장기수선비 관리 · 문자·알림톡 관리 · 공지 관리 (프로필 하위: 계정·직원 · 셋업 설정 · 로그아웃)
**공통 RNB**: "A/S 접수·퇴실 신청 현황" 패널 — 카드 클릭 시 `receipt-management`/`moving-settlement`로 이동

| 화면 | 폴더 | 목적 | 주요 이동 |
|------|------|------|-----------|
| 로그인 | `login` | 업무 시스템 로그인(LNB/RNB 없음) | — |
| 수납관리·민원접수 | `receipt-management` | 세대별 수납이력·입주자정보·A/S 통합, 출력·자동수납 | — |
| 건물·입주자 관리 | `building-list` | 건물 목록 + 호수·입주민 관리(인라인) | → building-detail, building-register, tenant-register, tenant-detail(입주민 행) |
| 건물 상세 | `building-detail` | 건물 상세 조회·수정·삭제 | ← building-list |
| 건물 등록 | `building-register` | 신규 건물 등록 | ← building-list |
| 입주자 상세 | `tenant-detail` | 입주민 상세 조회·수정, 퇴실처리·호수삭제 | ← building-list(입주민 행) |
| 입주민 등록 | `tenant-register` | 신규 호수·입주민 등록 | ← building-list |
| 고객번호 조회 | `utility-lookup` | 수도/공용전기 고객번호 조회(전용) | — |
| 전기 | `utility-electric` | 전기 검침·부과 편집, 검침대장 출력 | — |
| 수도 | `utility-water` | 수도 검침·부과 편집, 검침대장 출력 | — |
| 가스 | `utility-gas` | 가스 검침·부과 편집, 검침대장 출력 | — |
| 관리비 부과 세팅 | `management-fee-setting` | 건물·월 단위 부과 세팅·공과금 계산 | — |
| 항목등록 관리 | `fee-item` | 건물유형별 관리비 항목 등록 | — |
| 서류 발행·출력 | `bill-publish` | 고지서/부속서류 출력·팩스 발송 | — |
| 미납 관리 | `overdue-management` | 미납 조회·독촉 문자·A4 출력 | → moving-settlement(RNB) |
| 이사정산 입력 | `moving-settlement` | 퇴실 세대 이사정산 입력·완료 | — |
| 전체 이사조회 | `moving-status` | 전 건물 이사정산 조회·출력 | — |
| 전기 이사조회 | `moving-elec` | 전기 이사정산 조회·출력 | — |
| 수도 이사조회 | `moving-water` | 수도 이사정산 조회·출력 | — |
| 가스 이사조회 | `moving-gas` | 가스 이사정산 조회·출력 | — |
| 협력업체 관리 | `vendor-management` | 협력업체 구분별 등록·관리 | — |
| 장기수선비 관리 | `long-term-repair` | 건물별 장기수선충당금 입출금 | — |
| 문자·알림톡 관리 | `messaging` | 문자/알림톡 예약·발송내역·템플릿 | — |
| 공지 관리 | `notice-management` | 세입자 앱 공지 등록·알림톡 전송 | — |
| 계정·직원 | `staff-management` | 계정 관리(권한 부여)·입주자 세대연결 | — |
| 셋업 설정 | `setup` | 회사·고지서·이사정산·A/S·알림·이관 설정 | — |

> 고도화 전 4개 화면(moving-settlement·messaging·staff-management·setup)은 정책서 참조. **staff 대시보드 화면은 없음.**

## partner — 현장 모바일 웹

**하단 탭**: 홈(A/S현황) · 조회 · 프로필

| 화면 | 폴더 | 목적 | 주요 이동 |
|------|------|------|-----------|
| 로그인 | `mobile-login` | 현장관리자 로그인 | → mobile-home |
| 홈(A/S현황) | `mobile-home` | 담당 A/S 목록 조회·필터 | → mobile-as, mobile-as-new |
| A/S 상세 | `mobile-as` | A/S 1건 처리결과 수정·저장 | ← mobile-home |
| 신규 접수 | `mobile-as-new` | 새 A/S 접수 등록 | ← mobile-home |
| 조회 | `mobile-inquiry` | 건물/입주자 검색 | → mobile-building |
| 건물 | `mobile-building` | 건물 정보·입주자 목록 조회 | → mobile-meter, mobile-tenant |
| 입주자 | `mobile-tenant` | 입주자 정보·수납·이사정산 조회 | → mobile-ms-new |
| 검침 자료 | `mobile-meter` | 세대별 수도·전기·가스 검침 입력 | ← mobile-building |
| 이사정산 등록/상세 | `mobile-ms-new` | 이사정산 항목 입력·계산·저장 | ← mobile-tenant |
| 프로필 | `mobile-profile` | 계정 조회·로그아웃 | → mobile-login |

## resident — 세입자 앱 (카카오 기반)

**하단 탭**: 홈 · 관리비 · 내 정보

| 화면 | 폴더 | 목적 | 주요 이동 |
|------|------|------|-----------|
| 로그인 | `resident-login` | 카카오로 시작 | → resident-auth, terms, privacy |
| 인증 중 | `resident-auth` | 카카오 인증·세대 조회 로딩 | → verify(ok) / nomatch(fail) |
| 세대 확인 | `resident-verify` | 매칭 세대 확인 또는 직접 검색 | → notify / pending |
| 매칭 실패 | `resident-nomatch` | 세대 못 찾음 안내 | → login |
| 확인 대기 | `resident-pending` | 세대 승인 대기 | → login, notify |
| 알림 동의 | `resident-notify` | 알림톡 수신 온보딩 | → home |
| 홈 | `resident-home` | 세대 대시보드·당월 관리비·공지·퇴실신청 | → notice, bill-detail, bill, me |
| 관리비 | `resident-bill` | 연도별 관리비 목록 | → bill-detail |
| 관리비 상세 | `resident-bill-detail` | 항목별 상세·납부계좌(앱/guest 링크) | ← bill, home |
| 공지 | `resident-notice` | 건물 공지 목록 | → notice-detail |
| 공지 상세 | `resident-notice-detail` | 공지 본문(앱/guest 링크) | ← notice |
| 내 정보 | `resident-me` | 프로필·세대·알림설정·탈퇴 | → terms, privacy, login |
| 이용약관 | `resident-terms` | 약관 전문 | — |
| 개인정보 처리방침 | `resident-privacy` | 처리방침 전문(보유기간 명시) | — |

---

## 롤 간 연동 지점

- **staff ↔ resident**: staff `notice-management` 공지 → resident `resident-notice`(알림톡 딥링크). staff 고지서 → resident `resident-bill-detail`(guest 공유링크). resident 세대확인 요청(`res_claims`) → staff `staff-management` 입주자 연결(매핑실패 수동연결).
- **staff ↔ partner**: partner 검침·A/S·이사정산 입력이 staff 데이터에 반영. (partner는 발송 없음 — 문자는 staff `messaging` 소관.)
- **admin ↔ tenant(전체)**: admin은 테넌트 운영 메타데이터만 관리(업무 데이터·입주자 개인정보 미열람).

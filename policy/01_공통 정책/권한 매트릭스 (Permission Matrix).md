<!-- source: 주택관리ERP / page_id: 83d78132-2ecb-4507-bf39-9e6d576c133d / updated_at: 2026-09-09T01:02:18.273177+00:00 -->

# 주택관리ERP — 권한 매트릭스 (Permission Matrix)

> [_service-policy.md](_service-policy.md) 2절의 권한 모델을 **화면/기능 단위 접근표**로 구체화. 화면 PRD의 "권한" 섹션은 이 표를 참조한다. (62개 화면·staff-management 권한 UI 검토 기반)
> 표기: **O**=가능 · **R**=조회(읽기)전용 · **◐**=마스터가 계정별로 부여/제한(설정형) · **—**=접근 불가

## 1. 계정 유형 요약

| 롤 | 계정 유형 | 권한 성격 |
|----|-----------|-----------|
| **admin** (본사) | 역할: 마스터·운영·지원·영업·회계·기타 | 본사 콘솔 전체 접근(역할은 분류 라벨). 개별 테넌트 **업무 데이터는 미열람**(운영 메타데이터만) |
| **staff** (관리업체) | 회원유형: **마스터** / 일반 | 마스터=전체+계정·권한 설정. 일반=마스터가 부여한 **LNB 항목만** |
| **partner** (현장관리자) | 현장 관리자 | **고정 기능 세트**(설정 불가) |
| **resident** (세입자) | 입주자 | **본인 세대 한정** |

> 계정 유형·상태 값: [_status-codes.md](_status-codes.md) 9절. staff 계정 등록·권한 부여는 `staff-management`(마스터 전용)에서 수행.
> **겸직(capabilities)**: 한 staff 계정에 복수 역할(capability)을 부여할 수 있다(예: 사무실+현장 겸임). `staff-management`의 **겸직 토글**로 설정하며, 로그인은 보유 capability에 따라 진입 표면을 판정한다(마이그 0148 `org_members.staff_capabilities`).

---

## 2. staff — LNB 항목별 접근권한

마스터가 `staff-management`의 **페이지별 권한 칩**으로 계정마다 부여/제한한다. 마스터는 전체 O.

| LNB 항목 | 화면 | 마스터 | 일반(설정형) |
|----------|------|:---:|:---:|
| 수납관리·민원접수 | receipt-management | O | ◐ |
| 건물·입주자 관리 | building-list/detail/register, tenant-* | O | ◐ |
| 공과금 관리(고객번호·전기·수도·가스) | utility-* | O | ◐ |
| 관리비 부과 세팅 | management-fee-setting | O | ◐ |
| 항목등록 관리 | fee-item | O | ◐ |
| 서류 발행·출력 | bill-publish | O | ◐ |
| 미납 관리 | overdue-management | O | ◐ |
| 이사정산(입력·조회) | moving-settlement/status/elec/water/gas | O | ◐ |
| 협력업체 관리 | vendor-management | O | ◐ |
| 장기수선비 관리 | long-term-repair | O | ◐ |
| 문자·알림톡 관리 | messaging | O | ◐ |
| 공지 관리 | notice-management | O | ◐ |
| 계정·직원 (설정) | staff-management | O | ◐ |
| 셋업 설정 (설정) | setup | O | ◐ |

> `staff-management`의 권한 칩 그룹: **관리업무 / 공과금 관리 / 이사정산 / 설정**. 계정 유형(사무실/현장/입주자)과 별개로, 부여된 LNB 항목만 노출된다.
> 수납처리(payment-processing)는 수납관리 흐름에 연결.

---

## 3. partner — 현장관리자 고정 기능

| 기능 | 화면 | 권한 |
|------|------|:---:|
| 검침(지침) 입력 | mobile-meter | **O**(쓰기) |
| 이사정산 입력(계산+저장) | mobile-ms-new, mobile-moving-settlement | **O**(쓰기, 계산+저장만) |
| 본인 할당 A/S 등록·처리 | mobile-as, mobile-as-new | **O**(쓰기) |
| 수납 조회 | mobile-tenant | **R** |
| 건물 정보 열람 | mobile-building | **R** |
| 세입자 정보 열람 | mobile-building, mobile-tenant | **R** |
| 문자·알림톡·공지 발송/열람 | — | **—**(불가) |

> partner의 쓰기는 검침·이사정산·본인 A/S뿐. 나머지는 읽기 전용. 목록 외 기능 없음([_service-policy.md](_service-policy.md) 2.3).
> 유일한 발송 관련 요소: `mobile-moving-settlement`의 "정산내역서 문자 전송"은 자체 발송이 아니라 staff `messaging` 공용 모듈 호출.

---

## 4. resident — 세입자(본인 세대 한정)

| 기능 | 화면 | 권한 | 로그인 |
|------|------|:---:|:---:|
| 본인 세대 관리비 확인·상세 | resident-bill, bill-detail | R | 필요(guest 링크는 예외) |
| 우리건물 공지 확인 | resident-notice, notice-detail | R | 필요(guest 링크는 예외) |
| 퇴실 신청 | resident-home | O | 필요 |
| 카카오/스마트 고지서 신청 | resident-home/me | O | 필요 |
| 알림톡 수신 설정 | resident-notify, me | O | 필요 |
| 세대 확인 요청 | resident-verify | O | 로그인 후·연결 전 |
| 약관·개인정보 열람 | resident-terms, privacy | R | 불필요 |

> **guest(비로그인) 공유링크**: 관리비 상세·공지 상세는 알림톡 딥링크로 **로그인 없이 열람**(고령자·접근성). 관리비 상세 링크 = **건물·호수·월+HMAC 서명 URL**(`/rb/…?s=`), 유효기간 **고지월+12개월**(만료 시 금액 마스킹), 서버가 무상태로 자동 발급하며 **건물 바인딩**으로 교차 접근을 차단한다(기존 토큰 `/r/[token]` 대체).

---

## 5. admin — 본사

| 기능 | 화면 | 권한 |
|------|------|:---:|
| 테넌트 생성·수정·삭제·정지 | tenants, tenant-detail | O |
| 대리 접속(테넌트 업무화면) | tenant-detail | O(확인 모달·**감사 로그 기록**) |
| 개별 테넌트 업무 데이터(건물·입주자·관리비) 직접 열람 | — | **—**(대리 접속으로만) |
| 본사 계정 관리 | accounts | O |
| 포인트 충전 | points | O |
| 청구서 발행·입금 처리 | usage | O |
| 발송단가·청구 설정 | settings | O |
| 발송비 현황 조회 | overview | R |

> 본사 역할(마스터/운영/지원/영업/회계) 간 세부 접근 차이는 현재 미구현(분류 라벨). 필요 시 화면 PRD에서 정의.

---

## 6. 공통 권한 UI 규칙

- 권한 없는 **LNB 메뉴는 숨김**, 화면 내 권한 없는 **액션(버튼)은 비활성(disabled)** ([_service-policy.md](_service-policy.md) 6절 화면 상태).
- 조회 전용(R) 영역은 입력 컨트롤을 노출하지 않는다.
- 되돌릴 수 없는 액션(삭제·정지·퇴실처리 등)은 확인 모달을 거친다.
- 대리 접속·로그인 등 민감 행위는 감사 로그에 기록([_service-policy.md](_service-policy.md) 8절).

---

## 7. 크로스-persona 인가 게이트 & 겸직

- **staff · partner(현장) · admin(본사/HQ) · resident(세입자)** 4개 persona는 **하나의 인증 풀(auth.users)** 을 공유한다.
- 각 로그인·API·페이지는 **서버 인가 게이트**로 자기 persona만 통과시키고 다른 persona로의 교차 접근을 차단한다(예: staff 계정으로 현장/세입자 표면 접근 불가). 게이트는 **API(`requirePersonaApi`)·페이지(`requirePersona`)** 양쪽에 적용된다.
- 로그인 시 아이디는 **서버에서 계정으로 해석·인증**한다(회사코드/슬러그 불필요).
- **겸직 계정**은 보유한 capability에 해당하는 persona 표면에 모두 접근할 수 있다(예: 사무실+현장 겸직 → 사무실 ERP·현장 모바일 양쪽 로그인).
- 근거: 마이그 **0147**(persona 술어)·**0148**(staff_capabilities). PR #171/#173/#174(페이지·API 게이트).

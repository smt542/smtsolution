# 통합관리자 프로토타입 대비 현행 구현 갭 분석

- 기준일: 2026-08-26
- 대상: 통합관리자 7화면 (`login`, `overview`, `tenants`, `points`, `usage`, `accounts`, `settings`)
- 현행 매핑: `/platform-admin/login`, `/platform-admin`, `/platform-admin/organizations`, `/platform-admin/points`, `/platform-admin/billing`, `/platform-admin/accounts`, `/platform-admin/settings`
- 결론: 7화면 중 프로토타입 핵심 정보구조와 기능이 대체로 맞는 화면은 `settings` 1개뿐이다. `login`은 핵심 입력은 유사하지만 레이아웃·아이디·자동 로그인 동작이 다르고, 나머지 5개 업무 화면은 핵심 모델 또는 주요 액션의 차이로 매칭도가 낮다.

## 1. 판정 기준과 범위

1. 정본 우선순위는 요청대로 **프로토타입 HTML/인라인 JS > `docs/prototype/prd` > 옛 `docs/*.zip` 스펙**으로 적용했다. 프로토타입과 구현이 다르면 프로토타입을 정답으로 판정했다.
2. `docs/prototype/prd`에는 통합관리자 전용 화면 PRD가 없다. 다만 `messaging.md`는 사용량 로그를 금액 집계의 원천으로 두고, 벤더 포인트는 업체 단위 단일 풀이라고 명시한다(`docs/prototype/prd/messaging.md:92`, `docs/prototype/prd/messaging.md:120`, `docs/prototype/prd/messaging.md:134-135`). 이는 `points`·`usage`의 프로토타입 모델과 일치하는 보조 근거다.
3. `docs/admin.zip` 안의 화면별 정책서는 읽기 전용으로 확인했으며 프로토타입이 침묵한 부분의 보조 자료로만 사용했다. 프로토타입과 충돌하는 구현을 정당화하는 근거로 사용하지 않았다.
4. 색상·teal 계열 디자인은 제외했다. 레이아웃, 정보구조, 입력필드, 테이블 컬럼, 필터, 버튼/액션, 상태, 핵심 문구만 비교했다.
5. 갭 수는 각 화면의 **고유 갭**만 센다. 아래의 공통 셸 4건은 6개 로그인 후 화면에 모두 적용되지만 화면별 수에 중복 합산하지 않았다.

### 분류·심각도

| 구분 | 의미 |
|---|---|
| 누락 | 프로토타입에 명시된 구조·필드·액션·상태가 구현에 없음 |
| 불일치 | 양쪽에 대응 요소가 있으나 의미, 데이터, 계산, 동작, 문구가 다름 |
| 초과 | 구현에만 존재하고 프로토타입에는 없는 구조·필드·액션·상태 |

| 심각도 | 기준 |
|---|---|
| 높음 | 화면의 목적·데이터 모델·핵심 계산 또는 주요 업무 액션이 달라 사용자 업무가 달라짐 |
| 중간 | 필수 정보, 필터, 상태 전이, 입력 방식이 달라 운영 판단 또는 처리에 영향 |
| 낮음 | 보조 레이아웃, 안내 문구, 상태 표현 등 핵심 업무를 막지는 않는 차이 |

## 2. 요약

> 총 화면 고유 갭: **52건 = 누락 14 / 불일치 20 / 초과 18**. 공통 셸 4건은 별도이며 총계에 포함하지 않았다.

| 화면 | 매칭도 | 갭수(누락/불일치/초과) | 최고 심각도 | 한줄 코멘트 |
|---|---|---:|---|---|
| login | 중 | 1 / 3 / 0 | 높음 | 입력 구성은 유사하지만 아이디가 이메일로 제한되고 자동 로그인이 아이디 프리필이 아님 |
| overview | 하 | 2 / 2 / 2 | 높음 | KPI는 유사하나 연간 채널별 비용 차트가 없고 테넌트 표가 금액 대신 건수를 표시 |
| tenants ↔ organizations | 하 | 3 / 3 / 3 | 높음 | 계약 테넌트 관리 화면이 조직 기본정보·포인트·계층 드릴다운 화면으로 바뀜 |
| points | 하 | 2 / 3 / 4 | 높음 | 본사 단일 팝빌 포인트 풀이 조직별 내부 포인트 원장으로 대체됨 |
| usage ↔ billing | 하 | 4 / 4 / 2 | 높음 | 사용량 기반 청구서 발행보다 후불 청구원장·입금 처리 중심이며 계산·문서 액션이 다름 |
| accounts | 하 | 2 / 3 / 4 | 높음 | 본사 내부 계정 화면이 전 조직 계정·세부 권한 관리 화면으로 확대됨 |
| settings | 상 | 0 / 2 / 3 | 중간 | 핵심 설정은 대부분 일치하나 LMS·청구기준이 추가되고 기한/부가세 입력 의미가 달라짐 |

## 3. 로그인 후 공통 셸 갭

적용 화면: `overview`, `tenants/organizations`, `points`, `usage/billing`, `accounts`, `settings`.

| ID | 분류 | 심각도 | 갭 | 근거 |
|---|---|---|---|---|
| C-01 | 누락 | 중간 | 프로토타입의 프로필 메뉴 **로그아웃** 액션이 현행 셸에 없다. 현행은 사용자 정보를 정적으로 표시할 뿐 클릭 메뉴나 로그아웃이 없다. | 프로토타입 `docs/prototype/admin/overview.dc.html:316-319`; 구현 `app/(platform-admin)/_components/PlatformShell.tsx:91-103` |
| C-02 | 불일치 | 낮음 | 프로토타입은 데스크톱에서도 LNB 접기 토글을 제공한다. 현행 메뉴 버튼은 `md:hidden` 모바일 드로어 전용이라 데스크톱 사이드바를 접을 수 없다. | 프로토타입 `docs/prototype/admin/overview.dc.html:301`, `docs/prototype/admin/overview.dc.html:323-325`; 구현 `app/(platform-admin)/_components/PlatformShell.tsx:20-28`, `app/(platform-admin)/_components/PlatformShell.tsx:139-154` |
| C-03 | 초과 | 중간 | 현행 셸에 프로토타입에 없는 **직원 운영 화면** 이동 링크가 있다. 통합관리자 정보구조 바깥의 표면 전환 액션이다. | 프로토타입 메뉴 `docs/prototype/admin/overview.dc.html:308-319`; 구현 `app/(platform-admin)/_components/PlatformShell.tsx:80-89` |
| C-04 | 불일치 | 낮음 | 프로토타입은 `HQ CONSOLE`과 본사 관리자 이메일을 표시하고 프로필 메뉴를 연다. 현행은 `PLATFORM ADMIN`과 역할명만 표시하며 이메일·프로필 메뉴가 없다. | 프로토타입 `docs/prototype/admin/overview.dc.html:304-318`; 구현 `app/(platform-admin)/_components/PlatformShell.tsx:53-64`, `app/(platform-admin)/_components/PlatformShell.tsx:91-100` |

## 4. 화면별 상세 갭

### 4.1 login ↔ `/platform-admin/login`

프로토타입 기준 상태는 기본, 필수값 검증 실패, 로그인 중, 성공 토스트 후 대시보드 이동이다(`docs/prototype/admin/login.dc.html:104-118`). 현행도 오류·진행 상태와 비밀번호 보기 토글은 구현했으나 성공 피드백과 저장 의미가 다르다.

| ID | 분류 | 심각도 | 갭 | 근거 |
|---|---|---|---|---|
| L-01 | 불일치 | 중간 | 프로토타입은 좌측 브랜드/데이터 경계 패널과 우측 480px 로그인 폼의 **2열 분할**이다. 현행은 브랜드·소개·폼을 하나의 중앙 카드에 세로 배치한다. 색상이 아니라 페이지 구조 자체가 다르다. | 프로토타입 `docs/prototype/admin/login.dc.html:20-35`; 구현 `app/(platform-admin)/platform-admin/login/page.tsx:10-41` |
| L-02 | 불일치 | 높음 | 프로토타입 자격증명은 일반 **아이디**(`autocomplete=username`)다. 현행은 `type=email`, `autocomplete=email`, “본사 관리자 이메일”로 이메일 형식을 강제한다. 본사 계정의 로그인 식별자 계약이 달라진다. | 프로토타입 `docs/prototype/admin/login.dc.html:45-52`; 구현 `app/(platform-admin)/platform-admin/login/LoginForm.tsx:64-75` |
| L-03 | 불일치 | 중간 | 프로토타입의 “자동 로그인”은 체크 시 **아이디 문자열 저장 및 재방문 프리필**이다. 현행은 아이디가 아니라 플래그 `"1"`만 저장해 세션 유지 여부를 제어하고, 진입 시 체크 상태나 아이디를 복원하지 않는다. | 프로토타입 `docs/prototype/admin/login.dc.html:83-97`, `docs/prototype/admin/login.dc.html:107-112`; 구현 `app/(platform-admin)/platform-admin/login/LoginForm.tsx:16-18`, `app/(platform-admin)/platform-admin/login/LoginForm.tsx:47-48`; 보조 구현 `lib/auth/sessionPersistence.ts:1-5` |
| L-04 | 누락 | 낮음 | 프로토타입은 성공 시 “로그인되었습니다” 토스트를 보여 준 뒤 이동한다. 현행은 감사 기록 후 즉시 라우팅하여 성공 피드백이 없다. | 프로토타입 `docs/prototype/admin/login.dc.html:113-115`; 구현 `app/(platform-admin)/platform-admin/login/LoginForm.tsx:50-53` |

### 4.2 overview ↔ `/platform-admin`

프로토타입의 핵심은 4 KPI, 연도별 월간 채널 비용 차트, 별도 연월 선택이 있는 테넌트별 비용 표다(`docs/prototype/admin/overview.dc.html:329-376`). 현행 KPI 4종은 항목과 하위 문구까지 대체로 맞는다(`app/(platform-admin)/platform-admin/page.tsx:66-101`).

| ID | 분류 | 심각도 | 갭 | 근거 |
|---|---|---|---|---|
| O-01 | 누락 | 높음 | **알림톡·문자·팩스 월별 누적 막대 차트**, 연도 선택, hover 채널 금액, 연 누계·집계 개월·월평균이 모두 없다. 구현은 KPI 다음에 바로 테넌트 표가 온다. | 프로토타입 `docs/prototype/admin/overview.dc.html:337-353`, `docs/prototype/admin/overview.dc.html:393-425`; 구현 `app/(platform-admin)/platform-admin/page.tsx:103-145` |
| O-02 | 불일치 | 높음 | 프로토타입 “테넌트별 발송 비용” 표의 채널 열은 **각 채널 금액(원)**이고 합계도 금액이다. 현행은 채널 열에 `alimtalkCount`·`smsCount`·`faxCount` **건수**를 출력하면서 마지막 열만 `subtotalKrw` 금액을 출력한다. 표 제목은 같지만 정보 의미가 다르다. | 프로토타입 `docs/prototype/admin/overview.dc.html:354-375`, `docs/prototype/admin/overview.dc.html:439-447`; 구현 `app/(platform-admin)/platform-admin/page.tsx:120-137`; 데이터형 `hooks/reactquery/platform/billing.ts:8-20` |
| O-03 | 누락 | 중간 | 프로토타입 표는 0원 업체도 포함한 전체 목록과 숫자 페이지네이션/전체 N곳을 제공한다. 현행은 발송 건수 0인 행을 제거하고 페이지네이션 없이 전부 렌더링한다. | 프로토타입 `docs/prototype/admin/overview.dc.html:374`, `docs/prototype/admin/overview.dc.html:427-452`; 구현 `app/(platform-admin)/platform-admin/page.tsx:44-47`, `app/(platform-admin)/platform-admin/page.tsx:131-145` |
| O-04 | 불일치 | 중간 | 프로토타입은 차트의 **연도**와 테넌트 표의 **연월**을 독립 선택한다. 현행의 단일 월 스테퍼는 KPI 발송비와 표를 함께 바꾸며 미래/과거 범위 제한도 없다. | 프로토타입 `docs/prototype/admin/overview.dc.html:340-346`, `docs/prototype/admin/overview.dc.html:354-366`; 구현 `app/(platform-admin)/platform-admin/page.tsx:33-36`, `app/(platform-admin)/platform-admin/page.tsx:53-60`, `app/(platform-admin)/platform-admin/page.tsx:149-169` |
| O-05 | 초과 | 낮음 | 현행은 프로토타입에 없는 본문 `HQ CONSOLE` 설명 헤더와 `platform_admin` 데이터 범위 안내를 추가한다. | 프로토타입 본문 시작 `docs/prototype/admin/overview.dc.html:322-335`; 구현 `app/(platform-admin)/platform-admin/page.tsx:53-64` |
| O-06 | 초과 | 낮음 | 현행은 KPI와 테넌트 표에 명시적 로딩·재시도 오류·빈 상태를 추가한다. 프로토타입 HTML/JS에는 이 상태 표면이 없고 미래 월만 `—`로 표시한다. | 프로토타입 미래 월 상태 `docs/prototype/admin/overview.dc.html:403-405`; 구현 `app/(platform-admin)/platform-admin/page.tsx:67-70`, `app/(platform-admin)/platform-admin/page.tsx:112-117` |

### 4.3 tenants ↔ `/platform-admin/organizations`

프로토타입은 별도 상세 페이지 없이 **계약 테넌트 목록 + 동일 등록/수정 모달**에서 모든 관리를 끝낸다. 현행은 조직 기본정보 CRUD와 건물→세대 드릴다운을 중심으로 한다.

| ID | 분류 | 심각도 | 갭 | 근거 |
|---|---|---|---|---|
| T-01 | 누락 | 높음 | 운영 중, 90일 내 만료, 정지, 최근 12개월 해지의 **4개 계약 KPI**가 없다. 현행은 헤더 다음에 곧바로 조직 목록 패널을 렌더링한다. | 프로토타입 `docs/prototype/admin/tenants.dc.html:335-341`; 구현 `app/(platform-admin)/platform-admin/organizations/page.tsx:111-123` |
| T-02 | 불일치 | 중간 | 프로토타입 필터는 전체/운영/정지/해지 세그먼트와 업체명·지역 검색이다. 현행은 “해지 포함” 체크박스와 조직명·회사코드 검색이며 상태 집합도 체험/운영 중/정지 + 별도 soft-delete다. | 프로토타입 `docs/prototype/admin/tenants.dc.html:343-355`, `docs/prototype/admin/tenants.dc.html:611-612`; 구현 `app/(platform-admin)/platform-admin/organizations/page.tsx:129-150`, `app/(platform-admin)/platform-admin/organizations/components/OrgStatusControl.tsx:5-9` |
| T-03 | 누락 | 높음 | 테이블에서 업체 **지역, 세대, 직원, 세입자, 계약 시작일, 계약 만료일**이 빠졌다. 이 정보는 계약·운영 규모 판단의 핵심이다. | 프로토타입 `docs/prototype/admin/tenants.dc.html:357-405`; 구현 `app/(platform-admin)/platform-admin/organizations/page.tsx:174-183` |
| T-04 | 초과 | 중간 | 현행 표에는 프로토타입에 없는 회사코드, 계정 수, 포인트 잔액, 등록일, 관리 버튼 열이 있다. | 프로토타입 컬럼 `docs/prototype/admin/tenants.dc.html:361-365`; 구현 `app/(platform-admin)/platform-admin/organizations/page.tsx:177-183`, `app/(platform-admin)/platform-admin/organizations/page.tsx:201-240` |
| T-05 | 누락 | 높음 | 등록/수정 폼에서 계약 시작·만료 달력, 대표자, 사업자등록번호, 팩스, 이메일, 주소, 운영시간, 계약서 사진 업로드/미리보기가 빠졌다. 현행 수정 폼은 회사명·회사코드·대표 연락처뿐이다. | 프로토타입 `docs/prototype/admin/tenants.dc.html:438-471`; 구현 `app/(platform-admin)/platform-admin/organizations/components/OrgFormModal.tsx:87-120`, `app/(platform-admin)/platform-admin/organizations/components/OrgFormModal.tsx:147-166` |
| T-06 | 불일치 | 높음 | 프로토타입은 관리자 아이디와 숫자 4자리 비밀번호를 폼에서 직접 정하고 동일 모달에서 테넌트 정보를 편집한다. 현행은 owner 이름·연락처와 회사코드를 받고 서버가 임시 비밀번호를 별도 발급하며, 생성 후 1회성 복사 모달을 띄운다. | 프로토타입 `docs/prototype/admin/tenants.dc.html:468-480`, `docs/prototype/admin/tenants.dc.html:631-655`; 구현 `app/(platform-admin)/platform-admin/organizations/components/OrgFormModal.tsx:87-118`, `app/(platform-admin)/platform-admin/organizations/page.tsx:280-305` |
| T-07 | 불일치 | 높음 | 생명주기 의미가 다르다. 프로토타입은 운영/정지/해지 변경 시 접근 제한을 경고하고, 삭제는 관련 데이터·계정 전체를 제거하는 복구 불가 작업이다. 현행은 확인 없는 인라인 체험/운영/정지 변경과 **복구 가능한 soft-delete(해지)**다. | 프로토타입 `docs/prototype/admin/tenants.dc.html:624-685`; 구현 `app/(platform-admin)/platform-admin/organizations/components/OrgStatusControl.tsx:17-31`, `app/(platform-admin)/platform-admin/organizations/components/OrgRowActions.tsx:14-42` |
| T-08 | 초과 | 높음 | 프로토타입은 행 클릭으로 수정 모달을 열고 별도 상세가 없다. 현행은 조직명 링크에서 건물 목록→세대 목록→입주 상세까지 탐색하며 입주 상태·거주인원 등 프로토타입 범위 밖 정보를 노출한다. | 프로토타입 `docs/prototype/admin/tenants.dc.html:688-690`; 구현 진입 `app/(platform-admin)/platform-admin/organizations/page.tsx:194-200`; 구현 상세 `app/(platform-admin)/platform-admin/organizations/[orgId]/components/OrgBuildingsList.tsx:20-47`, `app/(platform-admin)/platform-admin/organizations/[orgId]/buildings/[buildingId]/components/BuildingTenantsList.tsx:22-53`, `app/(platform-admin)/platform-admin/organizations/[orgId]/buildings/[buildingId]/units/[unitId]/components/UnitDetailView.tsx:35-65` |
| T-09 | 초과 | 낮음 | 현행은 프로토타입에 없는 설명형 본문 헤더·데이터 범위 안내와 명시적 로딩/재시도 오류/빈 상태를 추가한다. | 프로토타입 본문 `docs/prototype/admin/tenants.dc.html:327-357`; 구현 `app/(platform-admin)/platform-admin/organizations/page.tsx:113-123`, `app/(platform-admin)/platform-admin/organizations/page.tsx:162-171` |

### 4.4 points ↔ `/platform-admin/points`

이 화면은 필드 차이가 아니라 **포인트 소유 모델**이 다르다. 프로토타입은 본사가 외부 팝빌에서 보유한 단일 공용 풀의 잔액·소진·충전 기록이고, 현행은 조직마다 보유하는 내부 메시지 크레딧 원장이다.

| ID | 분류 | 심각도 | 갭 | 근거 |
|---|---|---|---|---|
| P-01 | 불일치 | 높음 | 프로토타입은 “팝빌 포인트, 1원=1P, 알림톡·문자·팩스 공통 차감”의 **본사 단일 잔액**이다. 현행은 조직별 원장 잔액·예약·가용 잔액을 관리한다. 소유자와 회계 단위가 완전히 다르다. | 프로토타입 `docs/prototype/admin/points.dc.html:379-387`, `docs/prototype/admin/points.dc.html:420-447`; 구현 `app/(platform-admin)/platform-admin/points/page.tsx:163-222` |
| P-02 | 누락 | 높음 | 현재 팝빌 잔액, 이번 달 사용 P, 임계 이하 “충전 필요”, 0P “발송 중단” 경고가 없다. 현행 어느 조직의 잔액도 본사 공용 팝빌 잔액을 대체하지 못한다. | 프로토타입 `docs/prototype/admin/points.dc.html:444-466`; 구현 주요 섹션 `app/(platform-admin)/platform-admin/points/page.tsx:136-222` |
| P-03 | 누락 | 높음 | 당월 알림톡·문자·팩스별 **소진 P + 발송 건수 + 합계** 시각화가 없다. 현행 채널 표시는 사용량이 아니라 내부 차감 단가 요약이다. | 프로토타입 `docs/prototype/admin/points.dc.html:453-461`; 구현 `app/(platform-admin)/platform-admin/points/page.tsx:136-160` |
| P-04 | 불일치 | 높음 | 프로토타입 충전은 본사 단일 금액, 50/100/300/500만 빠른 선택, 1원=1P의 외부 충전 기록이다. 현행은 대상 조직·충전 포인트·결제금액·메모를 독립 입력하는 조직 원장 기록이며 빠른 금액 선택이 없다. | 프로토타입 `docs/prototype/admin/points.dc.html:394-406`, `docs/prototype/admin/points.dc.html:496-507`; 구현 `app/(platform-admin)/platform-admin/points/components/PointChargeModal.tsx:42-80` |
| P-05 | 불일치 | 중간 | 프로토타입 이력은 충전 금액·일자·충전자만 있는 **충전 이력**과 숫자 페이지네이션이다. 현행은 조직·구분(충전/사용/조정)·포인트·메모·기록자를 합친 전체 원장이고 “더 보기” 방식이다. | 프로토타입 `docs/prototype/admin/points.dc.html:384-388`, `docs/prototype/admin/points.dc.html:425-478`; 구현 `app/(platform-admin)/platform-admin/points/page.tsx:288-333` |
| P-06 | 초과 | 중간 | 메시지 채널 단가 조회/설정이 `points`에 추가됐다. 프로토타입에서는 단가가 `settings`의 전역 설정이며 포인트 화면에는 편집 액션이 없다. | 프로토타입 points 본문 `docs/prototype/admin/points.dc.html:376-388`; 프로토타입 설정 `docs/prototype/admin/settings.dc.html:387-394`; 구현 `app/(platform-admin)/platform-admin/points/page.tsx:136-160` |
| P-07 | 초과 | 높음 | 조직별 포인트 잔액 표와 차감·환불·정정 “포인트 조정” 원장 기능이 추가됐다. 본사 단일 풀 프로토타입에는 조직 배분/조정 개념이 없다. | 프로토타입 `docs/prototype/admin/points.dc.html:379-388`; 구현 `app/(platform-admin)/platform-admin/points/page.tsx:163-222`, `app/(platform-admin)/platform-admin/points/components/PointAdjustmentModal.tsx:89-139` |
| P-08 | 초과 | 높음 | 활성 메시지 포인트 예약, 공급자 대사 필요 상태, 수동 예약 해제가 추가됐다. 프로토타입 정보구조와 액션에 없는 별도 운영 원장이다. | 프로토타입 본문 `docs/prototype/admin/points.dc.html:376-388`; 구현 `app/(platform-admin)/platform-admin/points/page.tsx:224-286` |
| P-09 | 초과 | 낮음 | 현행은 설명형 본문 헤더와 단가/조직/예약/내역별 로딩·오류·빈 상태를 명시한다. 프로토타입 HTML/JS에는 이런 데이터 상태 표면이 없다. | 프로토타입 `docs/prototype/admin/points.dc.html:369-389`; 구현 `app/(platform-admin)/platform-admin/points/page.tsx:132-160`, `app/(platform-admin)/platform-admin/points/page.tsx:185-190`, `app/(platform-admin)/platform-admin/points/page.tsx:236-241`, `app/(platform-admin)/platform-admin/points/page.tsx:291-296` |

### 4.5 usage ↔ `/platform-admin/billing`

#### 정보구조·계산·주요 액션 병렬 비교

| 비교축 | 프로토타입 `usage.dc.html` | 현행 `billing/page.tsx` | 판정 |
|---|---|---|---|
| 화면 목적 | 월별 테넌트 발송 사용량으로 **청구서를 발행**하고 입금 상태를 관리 (`docs/prototype/admin/usage.dc.html:416-450`) | 테넌트별 월 사용량·청구액·입금 상태 조회와 paid 토글 (`app/(platform-admin)/platform-admin/billing/page.tsx:103-140`) | 청구서 발행 중심에서 후불 청구원장 중심으로 축소/변형 |
| 월 선택 | 연/월 팝오버, 2025~현재 범위, 미래 월 비활성 (`docs/prototype/admin/usage.dc.html:418-424`, `docs/prototype/admin/usage.dc.html:609-615`) | 이전/다음 월 스테퍼, 범위 제한 없음 (`app/(platform-admin)/platform-admin/billing/page.tsx:201-221`) | 불일치 |
| 상단 요약 | 총 청구액, 미입금액, 미입금/입금 업체 수의 문장형 리드 + 알림톡/문자/팩스 합계 (`docs/prototype/admin/usage.dc.html:416-433`, `docs/prototype/admin/usage.dc.html:518-533`) | 알림톡/SMS/LMS/팩스 성공 페이지 4개 건수 카드만 제공 (`app/(platform-admin)/platform-admin/billing/page.tsx:114-119`) | 금액·수금 판단 정보 누락, LMS 초과 |
| 채널/계산 | 알림톡·문자·팩스 건수 × settings 단가 = 표의 공급가액; 청구서에서 VAT를 별도 더함 (`docs/prototype/admin/usage.dc.html:483-504`, `docs/prototype/admin/usage.dc.html:587-598`) | 알림톡·SMS·LMS·팩스 페이지와 `subtotalKrw`/`vatKrw`/`totalKrw`를 RPC에서 받으며 표는 `totalKrw` 표시 (`hooks/reactquery/platform/billing.ts:8-22`, `app/(platform-admin)/platform-admin/billing/page.tsx:166-175`) | 표 금액 기준과 채널 정의 불일치 |
| 표 | 업체명, 이메일, 알림톡, 문자, 팩스, 청구액, 전월비(%), 상태, 처리 + 페이지네이션 (`docs/prototype/admin/usage.dc.html:437-450`, `docs/prototype/admin/usage.dc.html:539-552`) | LMS·팩스 성공 페이지가 추가되고 전월비는 금액 증감, 페이지네이션 없음 (`app/(platform-admin)/platform-admin/billing/page.tsx:150-195`) | 불일치/초과/누락 혼재 |
| 개별 액션 | 발행 → 청구서 미리보기; 청구서 다운로드; 입금 확인/취소 (`docs/prototype/admin/usage.dc.html:458-465`, `docs/prototype/admin/usage.dc.html:583-608`, `docs/prototype/admin/usage.dc.html:638-655`) | 입금 처리/취소만 제공 (`app/(platform-admin)/platform-admin/billing/page.tsx:177-188`) | 발행·문서 액션 누락 |
| 일괄/내보내기 | 전체 발행 → 모든 청구서를 개별 문서로 생성·저장 (`docs/prototype/admin/usage.dc.html:642-648`) | “청구서 다운로드” 버튼이 실제로는 필터된 원장 CSV를 생성 (`app/(platform-admin)/platform-admin/billing/page.tsx:78-100`, `app/(platform-admin)/platform-admin/billing/page.tsx:137-139`) | 핵심 액션 의미 불일치 |

#### 상세 갭

| ID | 분류 | 심각도 | 갭 | 근거 |
|---|---|---|---|---|
| U-01 | 누락 | 높음 | 월 총 청구액, 미입금액, 미입금/입금 업체 수를 한 문장으로 보여 주는 청구 요약이 없다. 현행 4개 카드는 채널 사용량만 보여 줘 수금 판단을 할 수 없다. | 프로토타입 `docs/prototype/admin/usage.dc.html:416-433`, `docs/prototype/admin/usage.dc.html:518-533`; 구현 `app/(platform-admin)/platform-admin/billing/page.tsx:114-119` |
| U-02 | 누락 | 중간 | 팝빌 공용 포인트가 0이면 알림톡·문자·팩스 발송 중단과 포인트 관리 이동 필요를 알리는 경고가 없다. | 프로토타입 `docs/prototype/admin/usage.dc.html:435`, `docs/prototype/admin/usage.dc.html:554-561`; 구현 전체 본문 `app/(platform-admin)/platform-admin/billing/page.tsx:103-197` |
| U-03 | 불일치 | 높음 | 프로토타입 표의 청구액은 채널 건수×전역 단가의 **VAT 전 공급가액**이며 청구서 안에서 VAT를 별도 합산한다. 현행 표는 `totalKrw`를 표시해 VAT 포함 총액을 노출한다. 전월비도 프로토타입은 백분율, 현행은 절대 원화 차이다. | 프로토타입 `docs/prototype/admin/usage.dc.html:502-504`, `docs/prototype/admin/usage.dc.html:540-544`, `docs/prototype/admin/usage.dc.html:587-598`; 구현 `hooks/reactquery/platform/billing.ts:18-21`, `app/(platform-admin)/platform-admin/billing/page.tsx:32-35`, `app/(platform-admin)/platform-admin/billing/page.tsx:174-175` |
| U-04 | 불일치 | 중간 | 프로토타입의 “팩스”는 발송 건수이고 상태 문구는 “입금완료/미입금/청구 없음”이다. 현행은 “팩스 성공 페이지”와 “입금”을 사용하고 처리 문구도 “입금 확인” 대신 “입금 처리”다. | 프로토타입 `docs/prototype/admin/usage.dc.html:429-431`, `docs/prototype/admin/usage.dc.html:505-507`, `docs/prototype/admin/usage.dc.html:541-547`; 구현 `app/(platform-admin)/platform-admin/billing/page.tsx:115-119`, `app/(platform-admin)/platform-admin/billing/page.tsx:158-162`, `app/(platform-admin)/platform-admin/billing/page.tsx:181-187` |
| U-05 | 초과 | 중간 | LMS 요약 카드·테이블 컬럼·CSV 컬럼이 추가됐다. 프로토타입 채널 집합은 알림톡·문자·팩스 3개다. | 프로토타입 `docs/prototype/admin/usage.dc.html:429-431`, `docs/prototype/admin/usage.dc.html:445-447`; 구현 `app/(platform-admin)/platform-admin/billing/page.tsx:78-87`, `app/(platform-admin)/platform-admin/billing/page.tsx:114-119`, `app/(platform-admin)/platform-admin/billing/page.tsx:155-158` |
| U-06 | 불일치 | 중간 | 월 선택이 제한된 연월 팝오버에서 무제한 이전/다음 월 스테퍼로 바뀌었다. 미래월·허용 연도 비활성 규칙이 사라졌다. | 프로토타입 `docs/prototype/admin/usage.dc.html:418-424`, `docs/prototype/admin/usage.dc.html:609-615`; 구현 `app/(platform-admin)/platform-admin/billing/page.tsx:201-221` |
| U-07 | 누락 | 높음 | 행별 **발행**, 청구서 미리보기(항목·건수·단가·공급가·VAT·입금계좌·안내문구), 문서 다운로드가 전부 없다. | 프로토타입 `docs/prototype/admin/usage.dc.html:458-465`, `docs/prototype/admin/usage.dc.html:545-547`, `docs/prototype/admin/usage.dc.html:583-608`; 구현 `app/(platform-admin)/platform-admin/billing/page.tsx:177-188` |
| U-08 | 불일치 | 높음 | 프로토타입 헤더 액션은 전 업체 청구서를 생성하는 **전체 발행**이다. 현행 “청구서 다운로드”는 청구서가 아니라 필터된 원장의 CSV 내보내기다. 버튼 문구와 실제 산출물도 어긋난다. | 프로토타입 `docs/prototype/admin/usage.dc.html:437-444`, `docs/prototype/admin/usage.dc.html:642-648`; 구현 `app/(platform-admin)/platform-admin/billing/page.tsx:78-100`, `app/(platform-admin)/platform-admin/billing/page.tsx:137-139` |
| U-09 | 누락 | 중간 | 프로토타입의 숫자 페이지네이션과 전체 N곳 표시가 없다. 현행은 필터 결과를 한 번에 렌더링한다. | 프로토타입 `docs/prototype/admin/usage.dc.html:449`, `docs/prototype/admin/usage.dc.html:537-552`; 구현 `app/(platform-admin)/platform-admin/billing/page.tsx:149-196` |
| U-10 | 초과 | 낮음 | 현행은 프로토타입에 없는 설명형 본문 헤더와 명시적 로딩·재시도 오류·빈 상태를 추가한다. | 프로토타입 본문 `docs/prototype/admin/usage.dc.html:406-416`; 구현 `app/(platform-admin)/platform-admin/billing/page.tsx:103-110`, `app/(platform-admin)/platform-admin/billing/page.tsx:142-147` |

### 4.6 accounts ↔ `/platform-admin/accounts`

프로토타입은 **본사 콘솔 내부 계정**만 관리하고 역할은 마스터/운영/지원/영업/회계/기타의 업무 분류다. 현행은 모든 조직의 소유자·관리자·직원 계정까지 다루고 플랫폼 관리자 승격과 기능별 권한을 편집한다.

| ID | 분류 | 심각도 | 갭 | 근거 |
|---|---|---|---|---|
| A-01 | 불일치 | 높음 | 화면 범위가 “본사 계정”에서 “소속 계정 목록”으로 바뀌어 각 조직 계정을 함께 노출·발급한다. 생성 폼도 대상 조직 선택을 필수로 둔다. | 프로토타입 `docs/prototype/admin/accounts.dc.html:286-300`; 구현 `app/(platform-admin)/platform-admin/accounts/page.tsx:154-185`, `app/(platform-admin)/platform-admin/accounts/components/AccountCreateModal.tsx:81-96` |
| A-02 | 누락 | 중간 | 목록에서 프로토타입의 전화번호와 메모 컬럼이 빠졌다. 현행은 이름/아이디를 한 셀에 합치지만 전화·메모는 어디에도 표시하지 않는다. | 프로토타입 `docs/prototype/admin/accounts.dc.html:298-305`; 구현 `app/(platform-admin)/platform-admin/accounts/page.tsx:201-240` |
| A-03 | 초과 | 중간 | 현행 표에는 프로토타입에 없는 조직과 관리 열이 있고, 각 행에 권한 변경·활성/비활성·비번 초기화 버튼을 항상 노출한다. | 프로토타입 컬럼 `docs/prototype/admin/accounts.dc.html:298-300`; 구현 `app/(platform-admin)/platform-admin/accounts/page.tsx:204-209`, `app/(platform-admin)/platform-admin/accounts/page.tsx:230-237` |
| A-04 | 불일치 | 높음 | 역할 체계가 마스터/운영/지원/영업/회계/기타에서 조직 소유자/관리자/직원/플랫폼 관리자 + 직원 유형으로 바뀌었다. 상태도 프로토타입 “활성/정지”가 현행 “활성/비활성/확인 불가”다. | 프로토타입 `docs/prototype/admin/accounts.dc.html:326-339`; 구현 `app/(platform-admin)/platform-admin/accounts/page.tsx:26-49`, `app/(platform-admin)/platform-admin/accounts/page.tsx:306-319` |
| A-05 | 불일치 | 높음 | 프로토타입 생성 폼은 이름·본사 역할·필수 전화·아이디·필수 숫자 4자리 비밀번호·메모다. 현행은 대상 조직과 직원 유형을 추가하고 전화·비밀번호를 선택으로 바꾸며 비밀번호 자동 발급을 허용하고 메모를 제거했다. | 프로토타입 `docs/prototype/admin/accounts.dc.html:329-351`, `docs/prototype/admin/accounts.dc.html:423-433`; 구현 `app/(platform-admin)/platform-admin/accounts/components/AccountCreateModal.tsx:81-100`, `app/(platform-admin)/platform-admin/accounts/components/AccountCreateModal.tsx:104-157` |
| A-06 | 누락 | 높음 | 프로토타입은 행 클릭으로 동일 폼을 열어 이름·역할·전화·비밀번호·메모·상태를 수정하고 계정을 복구 불가 삭제한다. 현행은 권한 변경·상태 토글·비밀번호 초기화만 제공하며 이름/전화/메모 편집과 삭제가 없다. | 프로토타입 `docs/prototype/admin/accounts.dc.html:387-414`, `docs/prototype/admin/accounts.dc.html:489-509`; 구현 `app/(platform-admin)/platform-admin/accounts/components/AccountRowActions.tsx:25-62` |
| A-07 | 초과 | 높음 | 플랫폼 관리자 승격/강등 경고, 직원 유형, 모듈별 기능 권한 체크박스 편집이 추가됐다. 프로토타입 역할은 본사 업무 분류 라벨이며 이런 세부 권한 모델이 없다. | 프로토타입 역할 `docs/prototype/admin/accounts.dc.html:330-340`; 구현 `app/(platform-admin)/platform-admin/accounts/page.tsx:323-448` |
| A-08 | 초과 | 중간 | 서버 자동 발급 임시 비밀번호를 1회 표시하고 클립보드에 복사하는 후속 모달이 추가됐다. 프로토타입은 생성 폼에서 4자리 비밀번호를 직접 입력한다. | 프로토타입 `docs/prototype/admin/accounts.dc.html:345-351`; 구현 `app/(platform-admin)/platform-admin/accounts/page.tsx:270-300` |
| A-09 | 초과 | 낮음 | 현행은 설명형 본문 헤더·데이터 범위 안내와 명시적 로딩·재시도 오류·빈 상태를 추가한다. 프로토타입 HTML/JS에는 해당 표면이 없다. | 프로토타입 본문 `docs/prototype/admin/accounts.dc.html:286-310`; 구현 `app/(platform-admin)/platform-admin/accounts/page.tsx:154-164`, `app/(platform-admin)/platform-admin/accounts/page.tsx:189-198` |

### 4.7 settings ↔ `/platform-admin/settings`

수정/저장/취소 전환, 알림톡·문자·팩스 단가, 잔액 임계치, 은행·계좌·예금주·사업자번호, 안내 문구, 입금 기한, 부가세, 담당자는 양쪽에 모두 있어 핵심 매칭도가 가장 높다(`docs/prototype/admin/settings.dc.html:376-415`; `app/(platform-admin)/platform-admin/settings/page.tsx:81-215`).

| ID | 분류 | 심각도 | 갭 | 근거 |
|---|---|---|---|---|
| S-01 | 초과 | 중간 | 현행에 LMS 단가 필드가 추가됐다. 프로토타입 채널 단가는 알림톡·문자·팩스 3개다. | 프로토타입 `docs/prototype/admin/settings.dc.html:387-394`; 구현 `app/(platform-admin)/platform-admin/settings/page.tsx:118-148` |
| S-02 | 초과 | 중간 | 현행에 별도 `billingBasis` “청구 기준” 자유입력 필드가 추가됐다. 프로토타입의 “청구 기준”은 입금 기한·부가세·담당자를 묶는 섹션명이며 동명의 입력 필드는 없다. | 프로토타입 `docs/prototype/admin/settings.dc.html:408-415`; 구현 `app/(platform-admin)/platform-admin/settings/page.tsx:184-186`, `hooks/reactquery/platform/settings.ts:15-19` |
| S-03 | 불일치 | 중간 | 프로토타입 입금 기한과 부가세는 “발행일로부터 14일”, “별도 (10%)” 같은 **표시 문구**를 자유 입력한다. 현행은 각각 0 이상 정수 일수와 숫자 퍼센트로 구조화해 문구 표현력을 잃는다. | 프로토타입 `docs/prototype/admin/settings.dc.html:409-414`; 구현 `app/(platform-admin)/platform-admin/settings/page.tsx:188-208`, `app/(platform-admin)/platform-admin/settings/page.tsx:335-359` |
| S-04 | 불일치 | 낮음 | 정보 묶음이 달라졌다. 프로토타입은 잔액 임계치를 발송 단가 카드에, 청구 안내 문구를 청구 계좌 카드에, 기한·VAT·담당자를 한 청구 기준 카드에 둔다. 현행은 각각 독립 섹션으로 분리한다. | 프로토타입 `docs/prototype/admin/settings.dc.html:387-415`; 구현 `app/(platform-admin)/platform-admin/settings/page.tsx:118-213` |
| S-05 | 초과 | 낮음 | 현행은 프로토타입에 없는 “HQ 공통 설정” 안내 카드와 명시적 조회 로딩·재시도 오류 상태를 추가한다. | 프로토타입 본문 `docs/prototype/admin/settings.dc.html:376-387`; 구현 `app/(platform-admin)/platform-admin/settings/page.tsx:89-116` |

## 5. 우선순위 제안

1. **데이터 모델 결정이 먼저 필요한 화면:** `points`의 본사 단일 팝빌 풀 vs 조직별 원장, `accounts`의 본사 계정 vs 전 조직 계정. 단순 UI 수정으로 해결할 수 없는 높은 심각도 갭이다.
2. **금액 정합성이 먼저 필요한 화면:** `overview` 채널 열의 건수/금액 혼용, `billing`의 VAT 포함 총액/공급가액과 전월비 단위 차이를 우선 확정해야 한다.
3. **업무 완료 액션 복구가 필요한 화면:** `billing`의 개별 발행·미리보기·다운로드·전체 발행, `tenants`의 계약 필드/상태 경고/삭제 의미, `accounts`의 동일 폼 편집·삭제다.
4. **공통 셸:** 로그아웃은 운영 안전상 우선 보완하고, 직원 화면 링크와 HQ/PLATFORM 명칭은 정보구조 결정을 거쳐 정리해야 한다.

## 6. 분석 한계

- 프로토타입은 목업 데이터와 `localStorage`를 사용하므로 실제 API·RLS·감사로그 저장 여부 자체는 화면 갭으로 판정하지 않았다. 다만 HTML/JS가 명시한 사용자 동작과 계산식은 정본으로 판정했다.
- 앱 코드를 실행하지 않고 정적 소스와 인라인 JS를 대조했다. 런타임 데이터 품질, RPC 결과값, 반응형 세부 동작은 이 리포트 범위 밖이다.
- 색상 차이는 요청대로 제외했다.

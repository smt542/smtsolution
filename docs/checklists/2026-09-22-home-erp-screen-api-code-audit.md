# 주택관리ERP 화면·API 코드 대조 결과

> 점검일: 2026-09-22 KST
> 기준: 현재 작업 트리의 화면 코드, React Query API 훅, Next.js Route Handler, Supabase 마이그레이션
> 범위: 정책 체크리스트의 최초 **정적 코드 대조**. 라이브 DB·외부 발송·브라우저 세션 smoke는 포함하지 않음.

## 결론

- 화면 지도 기준 62개 정식 화면 중 **60개는 현재 코드의 페이지 경로 또는 통합 기능 경로와 대조**되었습니다.
- **현장 모바일 2개 화면은 실제 페이지 경로가 없습니다.** `/partner/mobile-moving-settlement`, `/partner/mobile-utility-charge`가 빌드 산출물과 `app/`에서 모두 확인되지 않았습니다.
- 정책 체크리스트의 56개 문서 패키지는 모두 실제 코드 표면 또는 업무 도메인 훅과 대응합니다. 별도 정책 문서가 없던 본사 테넌트 상세·사무실 세대 목록·수납처리/자동이체는 코드상 구현 흔적이 있습니다.
- `npm run build`는 성공했고, `npm run lint`는 오류 0건·경고 6건입니다.
- 자동 테스트 스크립트와 `.test/.spec` 파일은 현재 저장소에서 확인되지 않았습니다. 따라서 기능별 `검증` 칸은 아직 완료 처리하면 안 됩니다.

## 화면 커버리지

| 역할 | 정책 화면 수 | 코드 대조 결과 | 근거 |
|---|:---:|---|---|
| 본사 관리자 | 8 | 8/8 대조 | `/platform-admin`, accounts, billing, organizations, organizations/[orgId], points, settings, login |
| 사무실 관리자 | 28 | 28/28 기능 대조 | `/staff` 대시보드, buildings·tenants, receipts(수납/자동이체 통합), utilities, bill, moving-settlement, setup 등 |
| 현장 관리자 | 12 | 10/12 대조 | mobile-home, inquiry, profile, building, tenant, meter, A/S, ms-new, login 구현. 간이 이사정산·간이 지침 입력 경로 없음 |
| 세입자 | 14 | 14/14 대조 | onboarding, home, bill/detail, notice/detail, me, legal, guest 공유 경로 |
| **합계** | **62** | **60/62** | 현장 모바일 2개 화면 미구현 또는 화면 지도 정리가 필요 |

## 정책 문서 공백과 코드 상태

| 화면 지도상 문서 공백 | 코드 대조 | 구현 근거 |
|---|---|---|
| 본사 테넌트 상세 | 구현 경로 존재 | `app/(platform-admin)/platform-admin/(app)/organizations/[orgId]/page.tsx`, platform 조직 API |
| 사무실 입주자 세대 목록 | 구현 경로 존재 | `app/(staff)/staff/(app)/buildings/[id]/tenants/page.tsx`, `listTenants` |
| 수납처리·자동이체 | 수납관리 화면에 통합 | `/staff/receipts`, `payments/apis.ts`, `/api/payment/cms` |
| 현장 간이 이사정산 | 페이지 경로 없음 | `app/` 및 production build routes 미발견 |
| 현장 간이 지침 등록 | 페이지 경로 없음 | `app/` 및 production build routes 미발견 |

## 핵심 기능별 코드 증적

| 업무 영역 | 구현된 인터페이스/코드 증적 | 판정 |
|---|---|---|
| 인증·persona 분리 | `requirePersona`, `requirePersonaApi`, staff/partner/platform/resident 레이아웃 게이트, 각 로그인 Route | 구현 근거 확인 |
| 건물·세대·입주자 | `listBuildings`, `getBuildingFull`, `saveBuilding`, `listTenants`, `getUnitOccupancyFull`, `saveUnitOccupancy`, 퇴실/삭제 RPC | 구현 근거 확인 |
| 관리비 부과 | `listBilling`, `saveBillingCharges`, `copyPreviousBilling`, `confirmBilling`, 신규 입주세대 부과 RPC | 구현 근거 확인 |
| 전기·수도·가스 | `listUtilityRows`, `saveMeterReadings`, 단가·부과기간·확정·이월·검침대장 API | 구현 근거 확인 |
| 고지서·팩스 | `listBillTargets`, `getBillDocuments`, `issueBills`, `recordBillDelivery`, `/api/bill/page-data`, `/api/bill/fax/send` | 구현 근거 확인 |
| 수납·은행·CMS | `recordPayment`, 수정/취소, `recordBankPayments`, 지로 원장, `/api/payment/cms` | 구현 근거 확인 |
| 미납 | `listOverdueBuildings`, `listOverdueHouseholds`, `listOverduePeriods` | 구현 근거 확인 |
| 이사정산 | staff 정산 context/save/complete/inquiry와 partner 정산 context/save/delete RPC | 구현 근거 확인 |
| 민원·A/S | staff CRUD와 partner 전용 complaint RPC, 현장 A/S 신규·상세 페이지 | 구현 근거 확인 |
| 문자·알림톡 | 포인트 견적·예약·취소·이력 RPC, `/api/messaging/send`, 템플릿 Route, dispatch worker | 구현 근거 확인 |
| 공지·공유 링크 | 공지 CRUD, resident 공지 API, 서명/공개 공지 경로 | 구현 근거 확인 |
| 장기수선·첨부 | 장기수선 원장 RPC, Storage 첨부 업로드·삭제·서명 URL | 구현 근거 확인 |
| 세입자 앱 | 카카오 OAuth 시작/콜백, 세대 매칭, 관리비·공지·프로필·퇴실·탈퇴 API | 구현 근거 확인 |
| 본사 운영 | 조직·계정·포인트·사용량/청구·설정 플랫폼 API와 화면 | 구현 근거 확인 |

## 공통 API·보안 증적

- **권한**: 화면은 `requirePersona`과 `hasModule`으로 persona·메뉴 권한을 점검하고, export·CMS·고지서 등 서버 Route는 `requirePersonaApi`으로 다시 막습니다.
- **데이터 범위**: 일반 업무 기능은 직접 Next API가 아니라 Supabase RPC/PostgREST를 주 경계로 씁니다. 권한·조직 범위는 RPC/RLS와 함께 기능별 추가 확인이 필요합니다.
- **감사**: 부과, 수납, 정산, 계정, 포인트 등 변경 RPC가 `audit_log` 기록을 포함합니다. 개인정보 열람, 반출, 출력, 발송은 `access_log` 이벤트를 남기는 Route/마이그레이션이 존재합니다.
- **주민 로그인**: 실제 Kakao OAuth 시작·콜백 경로가 있고, 개발용 stub은 production에서 `RESIDENT_STUB_ENABLED=true`이 아닌 한 404로 차단됩니다.

## 확인된 갭과 우선순위

1. **높음 — 현장 모바일 화면 2개 부재**
   화면 지도에는 있으나 라우트·페이지가 없습니다. 두 화면을 구현할지, `mobile-meter`·`mobile-ms-new`로 기능을 흡수한 것으로 확정하고 화면 지도를 정리할지 결정이 필요합니다.

2. **높음 — 자동 검증 부재**
   `package.json`에 test 스크립트가 없고 테스트 파일도 확인되지 않았습니다. 286개 기능을 “작동 확인”으로 완료하려면 최소한 역할별 smoke와 핵심 RPC의 정상/오류/권한/중복 테스트가 필요합니다.

3. **중간 — 정책 문서 3개 공백**
   본사 테넌트 상세, 세대 목록, 수납처리·자동이체는 코드가 있지만 독립 정책서가 없습니다. API 계약의 입력·상태 전이·오류 기준을 확정하려면 문서 보완이 필요합니다.

4. **중간 — 외부·운영 검증 미포함**
   이번 점검은 코드와 빌드 기준입니다. Popbill, Kakao, CMS, 운영 Supabase RLS와 실제 수신 결과는 실행하지 않았습니다.

## 빌드·정적 검사

| 명령 | 결과 |
|---|---|
| `npm run build` | 성공 — TypeScript와 76개 Next route 생성 완료 |
| `npm run lint` | 오류 0건, 경고 6건 |
| 테스트 탐색 | `.test/.spec` 파일 및 `test` 스크립트 미발견 |

린트 경고는 `scripts/notice-e2e`의 미사용 변수 6건이며, 제품 코드 오류는 아닙니다.

## 체크리스트 반영 방법

[화면별 API 기능 체크리스트](./2026-09-22-home-erp-screen-api-checklist.md)의 기능 ID별 `코드 연결`과 `검증`은 아직 일괄 완료하지 않습니다. 화면/도메인 단위의 구현 근거는 위에서 확인했지만, 각 기능의 요청·응답·오류·권한·테스트 증적까지 확인해야 개별 행을 완료 처리할 수 있기 때문입니다.

다음 점검에서는 수납 → 부과 → 고지 → 이사정산처럼 금전·상태 전이가 있는 흐름부터 기능 ID별 실제 RPC/Route와 마이그레이션을 매핑해 완료 처리합니다.

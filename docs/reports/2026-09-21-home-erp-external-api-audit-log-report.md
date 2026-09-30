# 주택 ERP 주요 API(외부·Supabase)·테스트·감사로그·데이터 정합성 통합 보고

> 최초 작성일: 2026-09-21
> 통합 갱신일: 2026-09-22
> 보고 요청: 주요 외부 API, API 테스트 결과, 감사로그 반영 상세
> 확인 기준: 저장소 코드·마이그레이션·운영문서·개발환경 설정·운영 Supabase 조회. 9/22 이사정산 보정 마이그레이션만 명시 승인 후 적용했고, 그 외 운영 데이터는 읽기 전용으로 확인했다.

## 1. 요약

- ERP의 일반 업무 기능은 별도 백엔드 API가 아니라 Supabase Auth·PostgREST(`from`)·RPC(`rpc`)·Storage를 통해 통신하고, 서버 전용 작업만 Next.js Route Handler를 경유한다.
- 외부 발송은 Popbill 하나로 통합되어 있으며 SMS, LMS, 알림톡, 팩스의 접수·결과 재조회·포인트 정산 흐름이 구현되어 있다.
- API 통신 전후로 화면·Route Handler·Supabase RPC/DB·외부 공급자 계층에서 값 형식, 범위, 조직 소유권, 중복, 상태 전이를 검증하는 구조가 들어가 있다.
- SMS/LMS와 팩스는 현재 개발환경에 Popbill 테스트 자격증명과 발신 설정이 들어가 있다. 다만 이번 확인에서 실제 외부 발송을 실행하지 않았고, 접수번호 및 최종 성공 결과(state=3/result=100) 증거도 확인하지 못했다.
- 알림톡은 Popbill 어댑터와 템플릿 연동 코드는 있으나 현재 개발환경의 `POPBILL_KAKAO_SENDER`가 비어 있어 실발송 전 단계다. 카카오 비즈니스 채널 등록 및 승인 템플릿도 운영 전제다.
- 감사는 기존 업무 변경 원장 `audit_log`와 개인정보·발송·반출 접근 원장 `access_log`로 나뉜다. 개인정보 원문 열람은 감사기록 저장에 성공한 경우에만 원문을 반환하는 fail-closed 방식이다.
- 현재 브랜치 검증 결과는 `npm run build`와 `npm run lint`가 통과했다. `npm test`는 현재 `package.json`에 스크립트가 없어 실행되지 않는다.
- Supabase 운영 DB는 9/21에 스키마·권한·값을 읽기 전용으로 확인했고, 9/22에는 이사정산 합계 보정 `0191`만 트랜잭션으로 적용한 뒤 P7 검증을 통과했다. 기존 정산 데이터 행을 일괄 수정하지는 않았다.
- 화면/API 명세 관점에서는 WBS 57개 화면을 56개 정책 패키지·286개 기능 요구사항으로 분해했고, 코드 경로 존재 여부를 대조했다. 화면 기능의 구현 적합성·실사용 테스트는 별도 단계로 구분한다.

## 2. 주요 API 현황(외부 연동 + Supabase)

| 구분 | 연동 서비스/기능 | 구현 내용 | 현재 판단 |
| --- | --- | --- | --- |
| SMS/LMS | Popbill `MessageService` | `sendSMS_multi`·`sendLMS_multi`, 수신자별 `interOPRefKey`, SMS/LMS 바이트 판정, 접수번호 저장, 결과 재조회 | 코드 구현 완료. 개발환경은 테스트 모드이며 실발송 결과 미확인 |
| 알림톡 | Popbill `KakaoService` | 승인 템플릿 코드·버튼·수신자별 본문 전송, 미치환 변수 차단, 발신 채널 등록 확인, 대체문자 미사용 | 코드 배선 완료. `POPBILL_KAKAO_SENDER` 미설정으로 현재 환경 실발송 불가 |
| 팩스 | Popbill `FaxService` | 세대별 A4 PDF를 메모리에서 생성해 `sendFaxBinary`로 접수, 팩스 페이지별 결과 재조회 및 성공 페이지만 청구 | 코드 구현 완료. 개발환경 발신번호는 설정되어 있으나 실발송 결과 미확인 |
| 세입자 로그인 | Kakao OAuth | `kauth.kakao.com/oauth/authorize`, 토큰 교환, `kapi.kakao.com/v2/user/me`, 상태 쿠키 검증 | 별도 인증 연동으로 구현됨. 발송용 Popbill 카카오 채널과는 별개이며 외부 로그인 스모크 결과는 미확인 |
| 운영 자동화 | AWS EventBridge API Destination | 예약 발송·Popbill 결과 재조회·접속기록 purge를 CRON_SECRET으로 호출 | 운영문서상 2026-09-21 기준 배선 완료. 실제 호출 결과는 이번 확인에서 재실행하지 않음 |
| 내부 핵심 API | Supabase Auth/DB/RPC | 조직·권한·RLS·발송 작업·포인트 예약/정산·감사로그 저장 | ERP의 핵심 백엔드. 검증 SQL은 저장소에 있으나 이번 확인에서 라이브 DB 실행은 하지 않음 |

### 2.1 공통 Supabase 통신 구조

현재 화면의 React Query API 훅 대부분은 `createClient()`로 인증된 Supabase client를 만들고, 다음 경로로 통신한다.

```text
화면/React Query hook
  → Supabase Auth 세션 + PostgREST(.from) / RPC(.rpc) / Storage(.storage)
  → RLS·security definer 권한 검사
  → Supabase Database/Storage
```

외부 공급자 호출이나 service role이 필요한 작업은 다음 서버 경계를 사용한다.

```text
화면
  → Next.js app/api Route Handler
  → 세션·persona·조직 권한 확인
  → Supabase admin/RPC 또는 Popbill·Kakao·AWS 연동
```

즉, `audit_log`, `access_log`, 발송 작업, 포인트 원장, 파일 첨부까지 포함해 ERP 데이터 대부분이 Supabase API를 통과한다. 대표 기능별 통신 범위는 다음과 같다.

| 기능 영역 | Supabase API 통신 예시 | 저장·처리 대상 |
| --- | --- | --- |
| 인증·권한·세션 | Auth SDK, `get_my_context`, `current_user_is_manager_staff`, `record_login`, `revoke_user_sessions` | 로그인, 조직/역할, persona 게이트, 세션 종료, 로그인 감사 |
| 건물·세대·입주자 | `list_buildings`, `save_building`, `list_tenants`, `save_unit_occupancy_full`, `list_occupancy_history`, `soft_delete_building`, `delete_unit` 및 `buildings`·`units`·`occupancies` 조회 | 건물/호실/입주자/계약·퇴실 정보 |
| 설정·거래처·마스터 | setup 관련 테이블 CRUD, `building_vendors`, `vendors`, `staff_roles`, `quick_messages`, `room_types`, `fee_items` 등 | 회사 설정, 발신번호, 업체·직원역할·관리항목 마스터 |
| 공과금·검침 | `list_utility_rows`, `save_meter_readings`, `list_utility_prices`, `save_utility_unit_prices`, `confirm_utilities`, 파트너 검침 RPC | 전기·수도·가스 검침, 단가, 확정·공급업체 |
| 관리비 부과·고지 | `list_billing`, `save_billing_charges`, `confirm_billing`, `list_bill_targets`, `get_bill_documents`, `issue_bills`, `record_bill_delivery` | 부과 입력/확정, 고지서 생성·발행·발송 상태 |
| 수납·미납·CMS/지로 | `list_receipts_workspace`, `record_payment`, `record_payment_edit`, `cancel_payment`, `record_bank_payments`, `list_overdue_aggregates`, `list_cms_debit_rows` | 수납 원장, 은행/지로/CMS, 미납·연체 집계 |
| 이사정산 | `get_settlement_context`, `save_moving_settlement`, `complete_moving_settlement`, `mid_moveout_settlement`, `list_settlements`, `list_settlement_inquiries` | 이사정산 계산·저장·완료·문의 |
| 문자·알림톡·예약 | `quote_message_points`, `schedule_messages`, `cancel_scheduled_message`, `list_message_logs`, `message_templates` CRUD + 서버 발송 Route Handler | 견적, 예약, 수신자·발송이력, 포인트 예약/정산 |
| 공지·첨부·공유링크 | `notices`·`notice_buildings`·`attachments` PostgREST, Storage bucket, `mint_notice_share_token`, resident/public notice RPC | 공지 본문·이미지·다중 건물·비로그인 공유 |
| 장기수선·민원/AS | `list_long_term_repair_ledger`, `save_long_term_repair_ledger`, `partner_create/update/delete_complaint`, `partner_get_complaint` | 장기수선 원장, 현장 파트너 민원·처리결과 |
| 파트너 앱 | `partner_get_building`, `partner_list_units`, `partner_list_meter_readings`, `partner_save_meter_readings`, tenant/settlement RPC | 현장 담당 건물 범위의 입주자·검침·민원·정산 |
| 세입자 앱 | `resident_bill_months`, `resident_bill_detail`, `resident_sign_bill_url`, `resident_notices`, `resident_get_profile`, `resident_automatch`, `resident_update_move_out`, `resident_withdraw` | 관리비 조회, 공지, 프로필, 세대연결, 퇴실·탈퇴 |
| 통합관리자 | `platform_list_organizations`, `platform_list_accounts`, `platform_update_settings`, `platform_list_org_billing`, point/billing RPC 및 조직·건물 drill-down 조회 | 조직·계정·플랫폼 설정, 포인트·월 청구·운영 지표 |
| 파일·반출·민감정보 | export Route Handler, `POST /api/pii/reveal`, Supabase Storage signed URL, service role 조회 | XLSX/CSV 반출, 원문 열람, 첨부파일·서명 URL |

위 목록은 저장소의 `hooks/reactquery/**/apis.ts`, `app/api/**/route.ts`, `lib/supabase/**` 호출을 기준으로 한 대표 목록이며, 모든 RPC 시그니처를 나열한 API 명세서는 아니다.

### 2.2 값 유효성·무결성 검증 현황

| 검증 계층 | 현재 반영된 검증 | 판정 |
| --- | --- | --- |
| 화면 입력 | Zod + React Hook Form으로 로그인, 건물, 세대, 수납, 이사정산, 공지, 계정, 조직, 포인트 등의 필수값·문자열 길이·UUID·날짜·금액·enum을 검증 | 구현 확인 |
| CSV 일괄등록 | 필수 열, 숫자·년월·날짜·전화번호 형식, enum 값, 파일 내 중복키를 등록 전에 검사하고 오류 행을 별도 출력 | 구현 확인 |
| 전화번호·식별자 | 전화번호 숫자 정규화, 국가번호 `82` 보정, PII 원문 열람 대상 ID/필드 형식, 원문 열람 최대 8개 필드 제한 | 구현 확인 |
| 첨부파일 | 이미지 JPG/PNG/WEBP·문서 PDF MIME 허용목록, 파일당 10MB, 이미지 최대 10개, 파일명 경로문자 제거·정규화 | 구현 확인 |
| 메시지 payload | 수신자 최대 5,000명, 팩스 최대 500건, UUID `Idempotency-Key`, 수신자 전화번호 정규화·중복 제거, SMS 90바이트/LMS 2,000바이트, 미치환 변수·템플릿·발신번호 검증 | 구현 확인 |
| Route Handler | JSON 형식, 인증 세션, persona·모듈 권한, 조직 소유권, 외부 발송 설정, Popbill 접수/mark 결과의 `ok` 여부를 확인하고 오류를 분류 | 구현 확인 |
| Supabase RPC·DB | RLS, 조직·건물·세대 소속, foreign key·unique·check·not null, 날짜가 월 1일인지/미래인지, 수납금액·수수료·포인트 범위, 허용 enum, 원자 트랜잭션을 검증 | 코드·SQL 정적 확인 + 라이브 객체 적용 확인 |
| 업무 정합성 | 검침값↔사용량 일치, 음수 사용량 review, 확정 전 검토 대상 차단, 수납 수정의 취소+재기록 원자성, 발송 포인트 예약≤차감, provider 결과의 미등록·중복 수신자 차단 | 핵심 함수·제약 적용 확인; 전체 오류 케이스 자동 실행은 미완료 |

대표 사례는 다음과 같다.

- 관리비 수납 수정은 금액 양수, 수수료 0 이상, 허용된 수납수단·수납종류, 조직 소속 세대를 확인한 뒤 기존 수납 취소와 신규 수납 기록을 한 트랜잭션으로 처리한다.
- 공과금 검침은 `water/elec/gas`만 허용하고, 미래 월·타 조직 건물·타 세대·잘못된 JSON 배열을 거절한다. 현재/이전 지침과 명시 사용량이 맞지 않으면 review 대상으로 남기며 검침 확정을 막는다.
- 메시지 발송은 클라이언트가 보낸 전화번호를 그대로 신뢰하지 않고 수신자 `ref`를 기준으로 서버에서 번호를 해석한다. 다른 조직·삭제 세대·비활성 직원 수신처, 템플릿 누락, 2,000바이트 초과 본문은 접수 전에 거절한다.
- 포인트 예약은 조직+멱등키 unique, 예약 포인트·차감 포인트 음수 금지, 차감액이 예약액을 넘지 않도록 DB 제약으로 막는다.

다만 Supabase 응답 payload 전체를 공통 Zod schema로 재검증하는 체계나, 모든 기능의 정상·비정상 입력을 라이브 환경에서 자동 실행하는 통합 테스트는 현재 확인되지 않았다. 따라서 “검증 로직이 존재한다”와 “실제 DB에서 모든 거부/허용 케이스가 통과했다”는 별도로 보고해야 한다.

### 2.3 라이브 Supabase 검증 결과와 적용 판단

9/21에 운영 프로젝트 `amhtprmapxlizdnsgbeg`를 대상으로 Management API의 읽기 전용 SQL을 실행했다. 테이블·컬럼·함수·함수 본문 토큰·인덱스·RLS·정책·권한만 조회했으며, INSERT/UPDATE/DELETE/DDL은 실행하지 않았다.

- 이전 갭으로 기록됐던 `0121`, `0153`, `0155`, `0156`은 컬럼·RPC·트리거·함수 본문 기준 모두 존재한다.
- `0161` 알림톡 템플릿 인덱스/동기화 함수, `0162`, `0166`, `0167`, `0172`, `0173`, `0174`~`0180`의 핵심 객체도 확인됐다. `0173`은 `water_paid_date`와 10개 인자 `list_settlement_inquiries`로 적용되어 있다.
- `access_log`는 RLS 활성화, 관리자 조회 정책, 인증 사용자 직접 INSERT/UPDATE/DELETE 차단이 적용되어 있다. `purge_access_log` 기본값은 실제 `730`일이고 service role만 실행할 수 있다.
- 수납 수정·검침 저장·발송 작업/수신자·포인트 예약 테이블, 첨부파일 10MB 제약, Storage `attachments` 버킷의 private/허용 MIME/10MB 설정도 확인됐다.
- 읽기 전용 값 스모크에서 전화번호 마스킹, SMS 90바이트/LMS 91바이트 경계, 잘못된 발송 모드·빈 수신자·알림톡 템플릿 누락이 기대값으로 반환됐다.
- 계정관리 RPC 권한은 예외가 있다. `admin_set_member_permissions`는 `authenticated` 전용이지만, `provision_member`, `list_accounts`, `admin_update_member_basic`, `admin_set_active`는 `PUBLIC` 기본 실행권한 때문에 `anon` 실행권한이 남아 있다. 비로그인 호출은 함수 내부의 `auth.uid()`/조직 검증에서 막히지만, 최소권한 기준으로는 운영 반영 전 권한 회수가 필요하다.

권한 보정 대상은 다음과 같다. 기존 인증 사용자 흐름은 유지하되 `PUBLIC, anon`만 회수하면 된다.

| RPC | 라이브 시그니처 요약 | 현재 | 목표 |
| --- | --- | --- | --- |
| `provision_member` | 12개 인자 | anon 실행 가능 | `authenticated`·`service_role`만 |
| `list_accounts` | `text, staff_type` | anon 실행 가능 | `authenticated`·`service_role`만 |
| `admin_update_member_basic` | 8개 인자 | anon 실행 가능 | `authenticated`·`service_role`만 |
| `admin_set_active` | `uuid, boolean, bigint` | anon 실행 가능 | `authenticated`·`service_role`만 |

기존 `supabase/verify` 중 실패했던 3건은 DB 미적용 증거가 아니라 검증 SQL의 구버전 기대값 문제였다. `p4_checks.sql`은 이미 제거된 4개 인자 `send_messages`를 요구했고, `p7b_checks.sql`은 `0173` 이전 9개 인자 RPC를 요구했으며, `platform_admin_checks.sql`은 현재의 append-only `pt_platform_select` 대신 과거 `pt_platform` 전체 쓰기 정책을 요구했다. 세 검증 SQL을 현재 시그니처·정책으로 정비한 뒤 모두 재실행 통과했다. 최신 `p4_point_checks.sql`도 통과했다.

따라서 현재는 검증용 마이그레이션을 일괄 재적용하지 않는 것이 맞다. 검증 SQL 정비·재실행은 완료했다. 단, 계정관리 RPC 4종의 `PUBLIC/anon` 실행권한 회수는 별도 대상이며, 영향 범위를 확인한 후 최소 권한 보정 마이그레이션을 적용하는 것을 권고한다. DB 쓰기는 별도 승인 후에만 진행한다.

### 2.4 9/22 화면/API·운영 데이터 정합성 추가 확인

WBS 원본의 화면 요구사항과 저장소 코드를 대조해 화면별 API·테이블 점검표를 작성했다. 57개 화면 범위를 56개 정책 패키지와 286개 기능 요구사항으로 분해했으며, 화면·클라이언트 API 훅·Route Handler/RPC·테이블의 연결을 추적했다. 정적 경로 확인에서는 파트너 모바일의 2개 경로가 별도 화면 라우트로 확인되지 않아 구현/요구사항 재확인 대상으로 남겼다. 경로가 존재한다는 사실만으로 화면 동작 완료를 판단하지 않으며, 세션 기반 기능 시험은 후속 단계다.

운영 DB에는 서비스 역할로 읽기 전용 교차 검증을 수행했다. 개인정보나 원문값은 수집하지 않고 건수·관계 일치 여부만 확인했다.

| 점검 대상 | 확인 결과 |
| --- | --- |
| 기본 관계 | buildings 4건, units 37건, occupancies 37건. 건물 없는 세대·세대 없는 입주 관계 0건 |
| 관리비·수납 | payments 64건, billing_confirmations 112건, fee_item_charges 536건. 점유/세대 불일치와 조직 불일치 0건 |
| 이사정산 | moving_settlements 11건. 관리비·수도·전기·가스·수선·청소비를 포함한 합계 불일치 0건 |
| 검침 | meter_readings 201건. 음수 사용량인데 검토 대상이 아닌 건 0건 |
| 부가 업무 | bill_issues 31건, message_logs 16건, message_schedules 23건, complaints 1건, long_term_repair_ledger 11건, point_transactions 1건의 주요 관계·집계 불일치 0건 |

이사정산 저장 RPC에는 청소비(`cleaning_cost`)가 저장되지만 합계에 빠질 수 있는 경로가 발견됐다. 이에 승인 후 `0191_settlement_total_cleaning_cost.sql`을 적용했다. 공통 합계 함수, INSERT/UPDATE 시 합계를 재계산하는 트리거, 직원/협력사 저장 RPC의 공통 함수 사용을 추가했으며, 기존 11건은 모두 올바른 합계여서 데이터 보정 UPDATE는 하지 않았다. 원본 `p7_settlement_total_checks.sql`은 트랜잭션 후 `ROLLBACK`되는 방식으로 운영 DB에서 통과했다.

상세 근거는 다음 점검 문서에 보관한다.

- [화면/API 기능 체크리스트](../checklists/2026-09-22-home-erp-screen-api-checklist.md)
- [화면/API 코드 대조 결과](../checklists/2026-09-22-home-erp-screen-api-code-audit.md)
- [운영 데이터 정합성 감사](../checklists/2026-09-22-home-erp-data-integrity-audit.md)

### 발송 판정 기준

Popbill 접수번호(receipt)는 “접수됨”을 뜻할 뿐 성공이 아니다. 문자·알림톡은 `state=3`이고 `result=100`인 경우에만 성공으로 확정하고, 팩스는 성공 페이지 수를 기준으로 `sent` 또는 `partial`을 확정한다. 접수 직후에는 `queued`/`provider_pending`으로 남기며, 결과 재조회가 24시간을 초과하면 자동 환불하지 않고 `reconcile_required`로 수동 확인 대상에 둔다.

근거: [Popbill 운영 가이드](../ops/popbill-delivery.md), [Popbill 어댑터](../../lib/popbill/messages.ts), [팩스 어댑터](../../lib/popbill/fax.ts), [결과 정규화](../../lib/popbill/results.ts)

## 3. 1번 API 테스트 결과

### 3.1 이번 확인에서 실행한 검증

| 검증 | 결과 | 의미 |
| --- | --- | --- |
| `npm run lint` | 통과, 오류 0건·경고 6건 | `scripts/notice-e2e/*.mjs`의 미사용 변수 경고만 남음 |
| `npm run build` | 통과(exit 0) | Next.js 컴파일·TypeScript·정적 페이지 생성·외부 연동 라우트 등록 통과 |
| `npm test` | 실행 불가 | 현재 `package.json`에 `test` 스크립트가 없음. 현재 브랜치에는 Vitest/Testing Library 테스트 파일이 추적되어 있지 않고 SQL 검증 파일만 일부 존재 |
| Supabase 운영 스키마·권한 조회 | 통과(읽기 전용) | 핵심 마이그레이션 객체, RPC 본문, 인덱스, RLS, 정책, 실행권한을 Management API로 확인. 운영 데이터 변경 없음 |
| Supabase 값 검증 스모크 | 부분 통과(읽기 전용) | 전화번호 마스킹, SMS/LMS 경계, 잘못된 모드·빈 수신자·템플릿 누락의 기대 오류코드 확인 |
| 이사정산 0191 적용 후 P7 SQL | 통과 | 공통 합계 함수의 청소비 포함·누락값 0 처리·직원/협력사 RPC 연결·저장 트리거를 확인. 검증 SQL은 `ROLLBACK`되어 시험 데이터 변경 없음 |
| 운영 업무 데이터 관계·집계 점검 | 통과(읽기 전용) | 핵심 테이블의 소속 관계, 결제/부과/정산 합계, 검침 검토 상태, 메시지 수신자 집계를 확인했고 불일치 0건 |
| Supabase 화면 세션 기반 CRUD/RLS smoke | 미수행 | 실제 staff·partner·resident 세션으로 화면을 순회하는 브라우저/통합 테스트는 아직 미수행 |
| 값 유효성 전체 음성·경계값 테스트 | 미수행 | 잘못된 날짜·금액·조직 ID·중복키·미치환 변수·대용량 첨부·과다 수신자 등을 각 업무 API에 넣는 전체 테스트는 미수행 |
| Popbill 실제 SMS/LMS/알림톡/팩스 발송 | 미수행 | 외부 수신번호로 메시지를 보내거나 과금이 발생하는 작업은 실행하지 않음 |
| Supabase verify SQL | 핵심 검증 통과, P2a는 권한 보정 전 실패 | `p0`, `p1a`, `p2b`, `p3a`, `p3b`, `p4`, `p4_point`, `p5`, `p5a`, `p5b`, `p5_bill`, `p7a`, `p7b`, `platform_admin`, `platform_drilldown`, `alimtalk_templates` 통과. 보강한 `p2a`는 계정관리 RPC 4종의 anon 실행권한 잔존을 정확히 실패로 검출 |

`p2a_checks.sql`에는 이제 `anon/PUBLIC` 실행권한을 실패시키는 검사가 추가됐다. 현재 실행 결과는 `admin_set_active`, `admin_update_member_basic`, `list_accounts`, `provision_member` 4종의 권한 잔존으로 실패했다. 권한 보정 후 동일 검증이 통과해야 한다.

### 3.2 채널별 테스트 판정

- **SMS/LMS:** 어댑터, 접수 후 결과 재조회, 멱등키, 포인트 예약·최종 정산 로직은 코드와 검증 SQL로 확인된다. 현재 `.env.local`은 `POPBILL_IS_TEST=true`이고 SMS 발신 설정이 있으나, 실제 `receipt → pending → terminal success` 실행 이력은 확인되지 않았다.
- **알림톡:** 어댑터는 구현되어 있으나 현재 `.env.local`에 `POPBILL_KAKAO_SENDER`가 없다. 따라서 현재 환경에서는 `PROVIDER_NOT_CONFIGURED` 또는 발신 설정 누락으로 차단되는 것이 정상이며, 카카오 채널·템플릿 승인 후 별도 스모크가 필요하다.
- **팩스:** PDF 생성·Popbill 접수·페이지별 결과 정규화·중복 접수 방지 흐름은 확인된다. 현재 팩스 발신 설정은 있으나 실제 팩스 접수·수신 및 성공 페이지 확인 결과는 없다.
- **이전 자동 테스트 기록:** 2026-08-24 Popbill 전환 보고서는 SDK 경계 모킹 기준 `961 passed, 9 skipped, 0 failed`를 기록했지만, 같은 문서에서 실제 Popbill 발송 및 DB 실행은 환경 부재로 미수행이라고 명시한다. 현재 브랜치에서 해당 테스트를 재실행할 수 있는 `npm test` 구성은 확인되지 않았다.

### 3.3 9/22 보고 전 필요한 실제 스모크

운영사 승인 후 Popbill 테스트 모드에서 내부 번호로 SMS 1건, LMS 1건, 알림톡 1건, 1페이지 팩스 1건을 각각 접수한다. 각 건에 대해 접수번호, 최종 상태, 실패 코드, 포인트 정산, 발송 이력을 기록해야 “테스트 완료”로 판정할 수 있다. 이후 운영 모드 전환 시에는 승인된 발신번호로 소량 카나리 발송이 필요하다.

## 4. 감사로그 반영 내용 상세

현재 감사는 목적이 다른 두 원장을 함께 사용한다.

### 4.1 `audit_log`: 업무 변경·권한·재무 행위 원장

`audit_log`는 `org_id`, `actor_id`, `action`, `table_name`, `row_pk`, `before`, `after`, `ip`, `created_at`을 저장한다. 조직별 조회 RLS가 있고, 일반 세션에는 INSERT/UPDATE/DELETE 정책을 열지 않아 애플리케이션 사용자가 직접 수정·삭제하지 못하는 append-only 구조다.

현재 반영된 대표 행위는 다음과 같다.

- 인증·계정: `LOGIN`, `ACCOUNT_CREATE`, `ACCOUNT_UPDATE`, `ACCOUNT_ACTIVATE`, `ACCOUNT_DEACTIVATE`, `PERMISSION_CHANGE`
- 부과·고지: `BILLING_CONFIRM`, `BILLING_CHARGE_NEW`, `BILL_ISSUE`, `BILL_DELIVERY`
- 수납·정산: `PAYMENT_RECORD`, `PAYMENT_EDIT`, `PAYMENT_CANCEL`, `PAYMENT_BANK_IMPORT`, `SETTLEMENT_AUTOCOLLECT`
- 장기수선·조직·플랫폼: 장기수선 원장 생성/수정/삭제, `ORG_CREATE`, 플랫폼 설정·포인트 단가 변경, 플랫폼 청구 상태 변경
- 세입자·민감 업무: 세대 연결/해제, 주민 탈퇴 등 관련 RPC에서 행위자와 대상 행을 남긴다.

최근에는 권한 저장 RPC 오버로드 충돌을 제거하면서 `PERMISSION_CHANGE` 기록을 유지했고, 서비스 역할을 통한 로그인 기록과 반출 행위의 `actor_id` 기록을 보강했다.

근거: [감사 원장 기본 스키마](../../supabase/migrations/0000_p0_auth_foundation.sql), [권한 변경 보정](../../supabase/migrations/0178_fix_admin_permissions_overload.sql)

### 4.2 `access_log`: 개인정보·발송·반출 접근 원장

`access_log`는 개인정보 보호 목적의 별도 원장이다. 조직과 행위자 외에도 `actor_label`, `persona`, `event`, `target_kind`, `target_id`, `field`, `row_count`, `detail`, `ip`, `user_agent`, `created_at`을 보존한다. 조직·행위자에 외래키를 걸지 않아 조직 삭제나 주민 계정 hard-delete 뒤에도 감사 이력이 남도록 했다.

현재 이벤트 종류는 다음 8개다.

| 이벤트 | 반영 내용 |
| --- | --- |
| `PII_REVEAL` | 마스킹된 전화·팩스 원문 열람. 대상 종류·대상 ID·열람 필드·필드 수·행위자·조직·IP·User-Agent 저장 |
| `EXPORT_XLSX` / `EXPORT_CSV` | 건물·입주자·요금·공과금·고객번호·수납 자료 반출 기록 |
| `PRINT` | 고지서/문서 출력 요청 기록 |
| `SEND_SMS` | 즉시 문자 발송이 Popbill 접수된 수신자 수와 message log 대상을 기록 |
| `SEND_ALIMTALK` | 즉시 알림톡 발송이 Popbill 접수된 수신자 수와 message log 대상을 기록 |
| `SEND_FAX` | 팩스가 접수된 건수와 요청 건수 요약 기록 |
| `PUBLIC_LINK_VIEW` | 비로그인 공지·관리비·정산 링크의 성공 조회 기록 |

### 4.3 개인정보 원문 열람 보호

`POST /api/pii/reveal`은 `manager_staff`, `field_partner`, `platform_admin`만 허용한다. 조회 자체는 세션 Supabase client와 RLS를 사용하고, 현장 파트너는 담당 건물 범위까지 추가로 확인한다. 한 번에 최대 8개 필드를 요청할 수 있어 편집 폼이 마스킹 값을 저장하는 문제를 막는다.

열람 처리 순서는 다음과 같다.

1. persona·조직·대상·건물 범위를 검증한다.
2. 원문을 조회한다.
3. `PII_REVEAL`을 `access_log`에 먼저 저장한다.
4. 감사 저장이 성공한 경우에만 원문을 응답한다. 감사 저장 실패 시 `503`을 반환하고 원문은 반환하지 않는다.

즉, 원문 열람은 감사기록 실패를 허용하지 않는 fail-closed 정책이며, IP와 User-Agent는 포렌식 정보로만 저장하고 권한 판단에는 사용하지 않는다.

근거: [원문 열람 API](../../app/api/pii/reveal/route.ts), [접근로그 공통 헬퍼](../../lib/audit/accessLog.ts), [PII 접근로그 마이그레이션](../../supabase/migrations/0174_pii_access_log.sql)

### 4.4 발송·반출 감사의 적용 범위와 유의점

- 즉시 메시지 발송은 `SEND_SMS`와 `SEND_ALIMTALK`을 남긴다. 단, 접수 결과가 `queued`로 확정된 뒤 기록한다. 최종 성공 여부는 Popbill 결과 재조회 원장과 별도로 확정한다.
- 팩스는 `queued > 0`인 경우 `SEND_FAX`를 남긴다. PDF 생성 실패·발신번호 누락·중복 진행 중 건은 발송 감사 이벤트로 세지 않는다.
- XLSX/CSV 반출 및 출력은 해당 API 호출 시 접근로그에 남긴다.
- 예약 발송 워커는 현재 `access_log`의 `SEND_SMS`/`SEND_ALIMTALK`를 직접 기록하는 호출이 확인되지 않았다. 예약 발송 자체는 message log·provider dispatch job·포인트 원장으로 추적되지만, 예약 발송도 접근로그 이벤트로 남겨야 한다면 후속 보강이 필요하다.
- 공통 `logAccess`는 기록 실패 시 `false`를 반환하고 호출을 계속할 수 있는 fail-open 헬퍼다. 다만 개인정보 원문 열람 API는 반환 전에 결과를 검사해 fail-closed로 동작한다. 발송·반출·출력까지 감사기록 실패 시 업무를 중단할지는 운영 정책 결정이 필요하다.
- 현재 저장소 검색 기준 `access_log` 전용 조회 화면/API는 확인되지 않았다. DB RLS상 관리자 조회는 가능하지만, 운영자가 이벤트를 검색·다운로드하는 화면이 필요하면 별도 작업이다.

### 4.5 보존·삭제 정책

- `access_log`는 기본 **730일(2년)** 보존한다.
- 보존기간은 `purge_access_log(p_retention_days default 730)` DB 함수 한 곳에서 관리하며 365일 미만으로 줄이지 못하게 방어한다.
- `/api/cron/purge-access-log`는 `CRON_SECRET`만 허용하고 timing-safe 비교 후 service role로 purge를 호출한다. 세션 폴백은 없다.
- 운영문서상 EventBridge Rule `home-erp-access-log-purge-daily`가 매일 03:00 KST에 해당 라우트를 호출하도록 배선되어 있다.
- 위 purge는 `access_log` 대상이다. 기존 업무 변경 원장 `audit_log`는 이 함수의 삭제 대상이 아니다.

근거: [보존기간 마이그레이션](../../supabase/migrations/0179_access_log_retention.sql), [purge API](../../app/api/cron/purge-access-log/route.ts), [EventBridge 운영기록](../ops/eventbridge-scheduled-messaging.md#감사-로그-보존-purge-배선-완료됨)

## 5. 보고 결론 및 후속 조치

### 보고 가능한 상태

- **구현 상태:** Popbill SMS/LMS·알림톡·팩스 및 결과 재조회·정산 구조 구현 완료.
- **자동 검증 상태:** 현재 브랜치 build 통과, lint 오류 없음. 다만 lint 경고 6건과 현재 테스트 스크립트 부재가 있음.
- **API 통신 구조:** 화면 기능은 Supabase Auth/PostgREST/RPC/Storage를 기본 통신 계층으로 사용하고, Popbill·Kakao·AWS는 별도 외부 경계에서 호출한다.
- **값 유효성 상태:** 화면·서버·RPC·DB에 다층 검증이 구현되어 있고 핵심 Supabase 객체·권한·일부 값 경계 스모크까지 라이브 확인했다. 다만 전체 기능의 정상/오류/경계값 테스트 증적은 아직 없다.
- **감사 상태:** 업무 변경 원장, 개인정보 원문 열람 감사, 반출·출력·즉시 발송 감사, 2년 보존 purge 배선이 반영됨.
- **화면/API·데이터 정합성:** WBS 화면 요구사항과 코드 연결을 점검표로 구조화했고, 운영 주요 테이블의 관계·집계 불일치는 이번 읽기 전용 점검에서 0건이었다. 이사정산 청소비 합계 누락 가능성은 0191 적용과 P7 검증으로 보완했다.
- **Supabase 적용 판단:** 핵심 검증·보안 마이그레이션은 이미 운영 DB에 적용되어 있어 일괄 재적용은 보류한다. 9/22에는 명시 승인된 0191만 적용했다. 계정관리 RPC 4종의 `PUBLIC/anon` 실행권한 회수는 별도 적용 후보로 남긴다. `schema_migrations` 보정이나 추가 권한 DDL은 별도 승인 없이는 진행하지 않는다.

### 미완료/확인 필요

1. Supabase 테스트 계정으로 staff·partner·resident·platform-admin 주요 화면을 순회하며 Auth, RLS, RPC CRUD, Storage 업로드/다운로드 smoke를 수행한다.
2. `p4_checks.sql`, `p7b_checks.sql`, `platform_admin_checks.sql`을 최신 시그니처·append-only 정책에 맞게 정비하고 재실행 완료했다.
3. `provision_member`, `list_accounts`, `admin_update_member_basic`, `admin_set_active`의 `PUBLIC/anon` 실행권한을 회수하고 `authenticated`만 명시적으로 부여하는 권한 보정안을 검토·승인한다.
4. 주요 RPC별 정상·오류·경계값 테스트를 수행한다: 타 조직 ID, 없는 세대, 미래 검침월, 음수/초과 금액, 잘못된 enum, 중복 멱등키, 초과 수신자, 2,001바이트 메시지, 잘못된 파일 형식·10MB 초과 파일.
5. Popbill 테스트 계정으로 SMS/LMS/알림톡/팩스 4종 실제 스모크를 수행하고 접수번호·최종 결과·정산 증적을 남긴다.
6. 알림톡 발신 채널(`POPBILL_KAKAO_SENDER`)과 카카오 승인 템플릿을 등록한 뒤 알림톡 테스트를 수행한다.
7. 예약 발송도 `SEND_SMS`/`SEND_ALIMTALK` 접근로그를 남길지 결정하고 필요 시 워커에 actor·schedule 기준을 추가한다.
8. `npm test` 복구 또는 현재 테스트 체계에 맞는 실행 명령을 `package.json`에 등록한다.
9. `access_log` 관리자 조회 화면/API가 필요한지 결정한다.

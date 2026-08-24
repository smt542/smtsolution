# Popbill 통합 발송 운영 가이드

> 대상: SMS/LMS·알림톡·팩스 실발송을 Popbill로 통일. 접수(receipt)는 "접수됨"일 뿐 성공이 아니며,
> 최종 결과 재조회로 확정된 성공 건/성공 팩스 페이지만 포인트·월 청구에 반영한다.

## 1. 운영 계정과 사전 준비

운영사(파트너)는 하나의 Popbill 연동 계정으로 발송비를 부담하고, ERP가 관리업체별 포인트·월 청구를 관리한다.

1. Popbill 연동 신청 및 운영사 **파트너과금** 계약 확인.
2. 운영사 사업자번호, Popbill 연동회원 등록, **Link ID / Secret Key** 발급.
3. 문자·팩스 **발신번호 등록 및 승인**(발신번호 사전등록제).
4. **카카오비즈니스 통합가입 + 비즈니스 채널 개설** → 해당 채널을 Popbill에 등록.
5. 관리비·연체·공지 등 **알림톡 템플릿을 카카오 승인**받아 Popbill에 등록(승인 템플릿만 발송 가능).

Popbill은 카카오 메시지 발송 대행사이므로 카카오비즈니스 채널을 대체하지 않는다. 카카오 공식 절차로
비즈니스 채널을 만든 뒤 Popbill에 등록해야 한다. **카카오 주민 로그인**은 별도 Kakao Developers OAuth 앱이
필요한 독립 기능이며 이 발송 연동과 무관하다.

참고: 채널 등록 <https://developers.popbill.com/guide/kakaotalk/vb/introduction/manage-channel> ·
템플릿 <https://developers.popbill.com/guide/kakaotalk/introduction/regist-atstemplate> ·
결과확인 <https://developers.popbill.com/guide/kakaotalk/introduction/ats>

## 2. 환경 변수 (서버 전용, `.env.example` 참조)

| 변수 | 설명 |
| --- | --- |
| `POPBILL_LINK_ID` / `POPBILL_SECRET_KEY` | 연동 인증 키(비밀값) |
| `POPBILL_CORP_NUM` | 운영사 사업자번호(숫자만) |
| `POPBILL_USER_ID` | 팝빌 담당자 아이디(선택) |
| `POPBILL_IS_TEST` | `true`=테스트, `false`=운영(기본 true) |
| `POPBILL_IP_RESTRICT_ON` | 연동회원 IP 제한(기본 true) |
| `POPBILL_USE_STATIC_IP` | 고정 IP 서버 사용 시 true |
| `POPBILL_USE_LOCAL_TIME` | 로컬시간 표기(기본 true) |
| `POPBILL_SMS_SENDER` / `POPBILL_FAX_SENDER` | 등록·승인된 발신번호 |
| `POPBILL_KAKAO_SENDER` | 등록된 카카오 채널(검색용 아이디) |
| `CRON_SECRET` | 예약 발송·결과 재조회 라우트 인증 |

- 모든 `POPBILL_*`와 `CRON_SECRET`은 **서버 전용**이다. `NEXT_PUBLIC_` 접두사 금지, 저장소 커밋 금지.
- 필수(`LINK_ID`/`SECRET_KEY`/`CORP_NUM`) 또는 해당 제품 발신번호가 없으면 발송 API는
  `PROVIDER_NOT_CONFIGURED`로 명시적으로 실패한다(가짜 성공 stub 없음).

## 3. 테스트 → 운영 전환

1. `POPBILL_IS_TEST=true`로 테스트 자격증명 연결 후 SMS 1건·LMS 1건·알림톡 1건·1페이지 팩스 1건을
   허용된 내부 번호로 접수하고 `receipt → pending → 최종(state=3/result=100) → 정확한 정산`까지 확인.
2. 운영 발신번호·알림톡 템플릿 승인 완료를 재확인.
3. `POPBILL_IS_TEST=false`로 전환하고 승인된 발신번호로 소수 내부 번호에 **카나리 발송**.
4. IP 제한을 사용하는 경우, 운영 서버 아웃바운드 IP를 Popbill 연동회원 허용 IP에 등록(`POPBILL_IP_RESTRICT_ON=true`).
   오토스케일/NAT 환경은 고정 IP 확보 후 `POPBILL_USE_STATIC_IP=true`.

## 4. 결과 재조회(폴링)와 상태

- 예약 발송 소비: `POST /api/messaging/dispatch-scheduled`
- 결과 재조회: `POST /api/delivery/reconcile` — 둘 다 `Authorization: Bearer $CRON_SECRET`.
- 조회 간격은 최초 10분 1분, 2시간까지 5분, 24시간까지 30분으로 늘고, 24시간 후 최종 결과가 없으면
  자동 실패·환불하지 않고 `reconcile_required`로 남긴다(수동 검토 대상).
- 접수만 된 건은 성공/확정 차감으로 표기하지 않는다. 실제 성공 수신자·성공 팩스 페이지만 정산·청구한다.
- 알림톡 실패 시 Popbill 대체문자(altSendType)는 **사용하지 않는다**(중복 과금·이중 정산 방지).

## 5. 모니터링·경보

- **잔액**: Popbill 파트너/연동회원 잔액을 주기 점검. 부족 시 발송 실패.
- **reconcile_required**: 관리업체 포인트 예약이 이 상태로 쌓이면 공급자 결과를 수동 확인(만료만으로 해제 금지).
- **24시간 초과 pending**: 폴링이 확정하지 못한 작업. Popbill 콘솔에서 실제 상태 대조.
- **provider 오류 코드**: 저장된 오류 코드(예: 팩스 506/517)로 원인 파악. 로그·오류 응답에 비밀키·전체 응답·수신자 개인정보를 남기지 않는다.

## 6. 자격증명 취급·키 교체

- 아이디/비밀번호 공유 대신 **연동용 Link ID/Secret Key와 최소 권한**을 전달한다.
- 키 교체 시: 새 Secret Key 발급 → 배포 환경 변수 교체 → 무중단 확인(캐나리 발송) → 구 키 폐기.
- 발신번호·카카오 채널·템플릿 변경 시 Popbill 재등록·재승인 후 `.env`의 발신 설정을 갱신한다.

## 7. 단가 설정·멱등·타임아웃 운영 주의

- **LMS 조직 포인트 단가는 승인 전 임의로 seed하지 않는다.** `message_point_rates`에 `lms` 단가가 없으면
  LMS 견적/예약은 `RATE_NOT_CONFIGURED`로 **안전하게 실패**한다(의도된 운영 게이트 — 승인되지 않은 가격으로
  청구하지 않기 위함). 관리자가 `/platform-admin` 포인트 단가 화면에서 **LMS 단가를 명시 설정**해야 LMS 발송이
  활성화된다. (참고: `platform_settings.rate_krw_lms`는 운영사가 관리업체에 청구하는 **플랫폼 KRW 단가**로,
  초기값은 SMS KRW 단가로 시작하며 관리자가 조정한다. 이는 조직 포인트 단가와 별개다.)
- **즉시 발송은 `Idempotency-Key`(UUID) 헤더가 필수**다. 동일 초안의 중복 클릭·재시도·동시 호출은 같은 키로
  묶여 예약이 replay되므로 **이중 발송·이중 차감이 발생하지 않는다**. 헤더 누락/비UUID는 접수 전에 400으로 거절한다.
- **접수 오류 분류**: Popbill SDK 오류 콜백과 로컬 검증(설정/템플릿/미치환 변수)은 **확정 실패**로 처리해
  예약 금액을 반환한다. 오직 전송/무응답 **타임아웃**만 `reconcile_required`(불명확)로 남기며 **즉시 재발송하지
  않는다** — 접수번호/요청번호로 결과를 먼저 조회한다. 팩스도 동일: 렌더/생성 실패는 job을 즉시 실패 처리해
  재시도를 허용하고, 접수는 됐으나 DB 반영이 실패하면 성공(queued)으로 표기하지 않고 확인 대상으로 남긴다.

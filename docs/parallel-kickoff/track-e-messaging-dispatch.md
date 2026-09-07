# Track E — 외부 발송 연동 (실발송 stub 교체)

- **주 대상**: `lib/messaging` 발송 worker + `(staff)/messaging`·`(staff)/bill` 발송부 + api 라우트 · **마이그 범위**: 0080~0089(필요시)
- **준비도**: ⚠️ **BLOCKED — NCP 알림톡/SMS 키 + 팩스 게이트웨이 엔드포인트/인증정보 필요**. 키 없으면 인터페이스·큐소비·포인트 하드스톱·템플릿필드까지만 구현하고 실 API 호출부는 인터페이스 뒤 stub 유지.
- **현상**: `send_messages`가 `message_logs` INSERT만(result='stub'), 외부 SMS/알림톡/팩스 API 미연동.
- **PRD/정책**: `docs/policy.zip`의 `_notification-policy.md`(발송정책 정본) + `docs/prototype/prd/messaging.md`. 프로토타입=staging `/staff/messaging…`, bill 발송 모달(staff.zip).
- **WBS 페이지**: 사무실 관리자_문자·알림톡 관리 / 사무실 관리자_서류 발행·출력 / 통합관리자_포인트 관리
- **의존**: Track G의 "확인문자 실발송"이 이 worker에 의존.

## 복사용 프롬프트

```
[역할] 너는 주택관리ERP(Next.js+Supabase)의 오케스트레이터다. CLAUDE.md/AGENTS.md 규칙을 그대로 따른다(PRD-first, 무거운 작업은 codex 위임, DB적용·커밋·리뷰는 Claude, 커밋 직후 wbs-commit-sync).

⚠️[선행조건 — 먼저 확인] 실발송에는 NCP 알림톡/SMS API 키와 팩스 게이트웨이 엔드포인트/인증정보가 필요하다. 착수 첫 단계로 사용자에게 키 확보 여부를 물어라. 키가 없으면: (a) 발송 worker의 인터페이스·큐 소비·포인트 차감 하드스톱·템플릿 필드까지만 구현하고, 실제 외부 API 호출부는 인터페이스 뒤 stub으로 남긴다. (b) 키가 있으면 실 연동까지 완성한다.

[목표] messaging·bill의 "실발송"을 stub→실연동으로 완성한다. 현재 send_messages는 message_logs INSERT만 하고 result='stub'이다.

[먼저 읽을 자료 — 3곳 모두 확인]
1) 정책 정본: docs/policy.zip(미추적)의 _notification-policy.md(발송정책) + docs/prototype/prd/messaging.md. 발송 실패대체(알림톡→SMS)·과금·재발송 규칙 확인.
2) 프로토타입: https://staging.d2h12382xiksft.amplifyapp.com/ 에서 staff 문자·알림톡 화면과 bill 발송 모달(staff.zip 참조).
3) WBS: bucket 9514ec1f-cb2d-4cfa-9ee6-6aff04127c73, "사무실 관리자_문자·알림톡 관리"·"사무실 관리자_서류 발행·출력"·"통합관리자_포인트 관리". get_project_status로 확인.

[구현 범위]
- 발송 worker: message_schedules/message_logs를 소비 → NCP 알림톡(실패 시 SMS 대체)·SMS·팩스 게이트웨이 실호출, 성공/실패 result 기록·재발송.
- 예약/반복(매월·매주) 스케줄 소비.
- 포인트: 발송 전 견적·차감·잔액0 하드스톱(기존 포인트 원장 0035~0037 연동, 초과 발송 차단).
- 템플릿 유형/구분·알림톡 버튼링크 필드.

[제약/조정]
- lib/messaging·(staff)/messaging·(staff)/bill 발송부·관련 api 라우트만 건드린다. app/(resident)/**·app/(platform-admin)/** 미접촉. (staff) 내 utilities/payment 등 타 화면 로직 변경 금지.
- ⚠️ 키·시크릿은 서버 전용 env로만(하드코딩 금지). 
- 마이그레이션 번호는 0080~0089만(필요 시). 커밋 직전 origin/master 최대번호 재확인(현재 0039).
- DB 적용은 Claude가 .env.local SUPABASE_ACCESS_TOKEN + Management API(projects/amhtprmapxlizdnsgbeg/database/query)로. Supabase MCP는 다른 프로젝트라 사용 금지.

[진행 순서] 선행조건(키) 확인 → 자료 3곳 정독 → 짧은 구현계획(worker·스케줄·포인트·템플릿 분해) 제시·애매한 점 질문 → 승인 후 codex 위임 → tsc/vitest/lint/next build 검증 → 커밋 → wbs-commit-sync. 먼저 키 확인과 계획부터 보고하라.
```

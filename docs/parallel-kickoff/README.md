# 병렬 트랙 킥오프 (2026-08-19 작성)

WBS·PRD·프로토타입 기준으로 도출한 다음 병렬 작업 트랙 6개(즉시 4 + 선행조건 2). 각 파일의 "복사용 프롬프트"를 **새 Claude Code 세션**에 그대로 붙여넣으면 자립 실행된다.

| 트랙 | 파일 | 라우트그룹 | 마이그 | 준비도 |
|---|---|---|---|---|
| A 세입자앱 기능화면 | [track-a-resident.md](./track-a-resident.md) | `app/(resident)` | 0040s | ✅ 즉시 |
| B 통합관리자 마감 | [track-b-platform-admin.md](./track-b-platform-admin.md) | `app/(platform-admin)` | 0050s | ✅ 즉시 |
| C 가스공과금 마감 | [track-c-gas-utility.md](./track-c-gas-utility.md) | `(staff)/utilities` 가스탭 | 0060s | ✅ 즉시 |
| D 현장 파트너 모바일 | [track-d-partner-mobile.md](./track-d-partner-mobile.md) | `app/(partner)` (신규) | 0070s | ✅ 즉시(대형) |
| E 외부 발송 연동 | [track-e-messaging-dispatch.md](./track-e-messaging-dispatch.md) | `(staff)/messaging`·`bill`+lib | 0080s | ⚠️ NCP·팩스 키 대기 |
| G 수납·민원 통합 마감 | [track-g-payment-receipts.md](./track-g-payment-receipts.md) | `(staff)/payment`·`receipts` | 0090s | ⚠️ 통합/분리 결정 먼저 |

## 공통 사실
- **프로토타입(디자인 정본)**: https://staging.d2h12382xiksft.amplifyapp.com/ — 패턴 `/[role]/[feature]/[file].dc.html` (role = admin·staff·partner·resident)
- **WBS 버킷**: `9514ec1f-cb2d-4cfa-9ee6-6aff04127c73` (주택관리ERP) — wbs-scheduler `get_project_status`로 조회
- **PRD**: `docs/prototype/prd/*.md`(기획 정본) + `docs/*.zip`(2026-08-14 5롤 프로토타입 export, 화면별 `.md`+`.dc.html`). admin/resident/partner 상세는 zip이 원천.
- **DB 적용**: Claude가 `.env.local` `SUPABASE_ACCESS_TOKEN` + Management API `https://api.supabase.com/v1/projects/amhtprmapxlizdnsgbeg/database/query`. Supabase MCP는 다른 프로젝트라 사용 금지.
- **현재 origin/master 최대 마이그**: `0039_resident_claims` → 각 트랙 커밋 직전 재확인.

## 충돌 안전
- **A·B·D는 서로 없는 라우트그룹**(`resident`/`platform-admin`/`partner`) → 파일 충돌 0. 가장 안전한 동시 3종.
- **C·E·G는 모두 `(staff)` 공유** → 각자 레인 안에서만: C=`utilities` 가스탭 · E=`messaging`/`bill` 발송부+lib · G=`payment`/`receipts`. 레인 벗어나면 충돌하니 동시 진행 시 조율.
- D는 staff 백엔드 테이블을 **읽기/추가 RPC로만** 재사용(기존 staff RLS·화면 불변).
- 마이그 번호는 표의 범위로 분할. 커밋 직전 origin/master max 재확인.

## 트랙별 착수 전 확인(Open Question)
- **A**: 퇴실신청/고지서신청(구 tenant-app.md 3.4/3.5)이 최신 resident.zip엔 없음 → 이번 범위 제외(뷰어 위주)로 가정. 포함할지 확정 필요.
- **B**: 코드의 `(platform-admin)/billing` 라우트 ↔ admin.zip의 `usage` 명칭/중복 정리 필요.
- **C**: 부과기준일(전월16~당월15)은 기존 `0024_billing_period_settings` 재사용 여부 확인.
- **D**: 사진 업로드용 Supabase Storage 버킷 신규 필요. 현장 계정 인증 흐름(field 롤) 재확인.
- **E**: 🔑 NCP 알림톡/SMS 키 + 팩스 게이트웨이 확보 여부 — 없으면 인터페이스까지만.
- **G**: 🧭 수납+민원 통합 vs 분리 제품결정 먼저. 확인문자 실발송은 E에 의존.

## 진행 방식
각 세션은 자료 3곳(프로토타입·PRD·WBS) 정독 → 짧은 계획 보고·애매한 점 질문 → codex 위임 구현 → tsc/vitest/lint/build 검증 → 커밋 → wbs-commit-sync. 오케스트레이터 세션이 교차 리뷰·머지 순서 조율.

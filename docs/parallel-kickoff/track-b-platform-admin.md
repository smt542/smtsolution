# Track B — 통합관리자 마감

- **라우트그룹**: `app/(platform-admin)` · **마이그 범위**: 0050~0059
- **프로토타입**(패턴 `/[role]/[feature]/[file].dc.html`):
  - 대시보드 `/admin/overview/overview.dc.html`
  - 사용량/청구 `/admin/usage/usage.dc.html`
  - 설정 `/admin/settings/settings.dc.html`
  - 로그인 `/admin/login/login.dc.html`
  - (이미구현: `/admin/tenants` `/admin/accounts` `/admin/points`)
- **PRD**: prd/*.md에 없음 → `docs/admin.zip`의 화면별 .md가 정본. 횡단=`docs/policy.zip`
- **WBS 페이지**: 통합관리자_대시보드 / 로그인 / 설정 / 청구 관리
- **Open Q**: 코드 `(platform-admin)/billing` ↔ admin.zip `usage` 명칭·중복 정리.

## 복사용 프롬프트

```
[역할] 너는 주택관리ERP(Next.js+Supabase, app/ 라우트그룹 구조)의 오케스트레이터다. CLAUDE.md/AGENTS.md 규칙을 그대로 따른다(PRD-first, 무거운 작업은 codex 위임, DB적용·커밋·리뷰는 Claude, 커밋 직후 wbs-commit-sync).

[목표] 통합관리자(본사 HQ 콘솔, app/(platform-admin))의 남은 화면을 완성한다. 코어(테넌트/계정/포인트 CUD·콘솔·드릴다운)는 이미 구현됨. 남은 4화면(대시보드·사용량/청구·설정·로그인)을 얹는 작업이다.

[먼저 읽을 자료 — 3곳 모두 확인]
1) 프로토타입(디자인 정본, 패턴 /[role]/[feature]/[file].dc.html):
   - 대시보드  https://staging.d2h12382xiksft.amplifyapp.com/admin/overview/overview.dc.html
   - 사용량/청구 https://staging.d2h12382xiksft.amplifyapp.com/admin/usage/usage.dc.html
   - 설정     https://staging.d2h12382xiksft.amplifyapp.com/admin/settings/settings.dc.html
   - 로그인    https://staging.d2h12382xiksft.amplifyapp.com/admin/login/login.dc.html
   (참고=이미구현: /admin/tenants /admin/accounts /admin/points)
2) PRD: 통합관리자는 docs/prototype/prd/에 별도 .md가 없다. docs/admin.zip(미추적)을 풀면 화면별 .md(동작규칙)+.dc.html(디자인)이 정본이다. 반드시 admin.zip의 overview/usage/settings/login .md를 읽어라. 횡단 규칙은 docs/policy.zip(_permission-matrix·_service-policy).
3) WBS: bucket 9514ec1f-cb2d-4cfa-9ee6-6aff04127c73, 페이지 "통합관리자_대시보드/로그인/설정/청구 관리"(예정). get_project_status로 확인.

[구현 범위]
- overview(대시보드): 계약업체·관리건물·입주자(앱연결률)·월 발송비용 등 집계 카드 + 발송비용(알림톡/SMS/팩스) 분석표. 실데이터 집계 쿼리 필요.
- usage/청구: 테넌트(조직)별 포인트/발송 사용량·청구 명세. 기존 포인트 원장(0035~0037) 재사용.
- settings: HQ 설정. login: 통합관리자 로그인(platform_admin 롤).
- 코드의 app/(platform-admin)/billing 라우트와 admin.zip의 usage 매핑을 먼저 정리(중복/명칭). 애매하면 사용자에게 물어라.

[제약/조정]
- 오직 app/(platform-admin)/** 와 platform 전용 lib/hooks/마이그만 건드린다. app/(resident)/**·app/(staff)/**는 절대 손대지 마라(세션1이 세입자앱 병렬 진행중).
- 마이그레이션 번호는 0050~0059만 사용. 커밋 직전 origin/master 최대번호 재확인(현재 0039). 기존 platform 마이그 0011·0013_platform_drilldown·0033~0035 참고.
- proxy.ts 게이팅·platform_admin RLS 패턴 준수. 앱 전체 파랑(#3182F6) 디자인시스템.
- DB 적용은 Claude가 .env.local SUPABASE_ACCESS_TOKEN + Management API(projects/amhtprmapxlizdnsgbeg/database/query)로. Supabase MCP는 다른 프로젝트라 사용 금지.

[진행 순서] 자료 3곳 정독 → 짧은 구현계획(화면·DB·집계쿼리 분해) 제시하고 애매한 점 먼저 질문 → 승인 후 codex 위임 구현 → tsc/vitest/lint/next build 검증 → 커밋 → wbs-commit-sync. 먼저 계획부터 보고하라.
```

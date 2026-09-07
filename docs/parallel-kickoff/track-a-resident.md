# Track A — 세입자앱 기능화면

- **라우트그룹**: `app/(resident)` · **마이그 범위**: 0040~0049
- **프로토타입**(패턴 `/[role]/[feature]/[file].dc.html`):
  - 홈 허브 `/resident/resident-home/resident-home.dc.html`
  - 관리비 `/resident/resident-bill/resident-bill.dc.html`
  - 관리비상세 `/resident/resident-bill-detail/resident-bill-detail.dc.html`
  - 공지목록 `/resident/resident-notice/resident-notice.dc.html`
  - 공지상세 `/resident/resident-notice-detail/resident-notice-detail.dc.html`
  - 내정보 `/resident/resident-me/resident-me.dc.html`
- **PRD**: `docs/prototype/prd/tenant-app.md` + `docs/resident.zip`(화면별 .md 정본)
- **WBS 페이지**: 세입자_홈 / 관리비 내역 / 관리비 상세고지서 / 공지 목록 / 공지 상세 / 내 정보
- **Open Q**: 퇴실신청/고지서신청은 최신 resident.zip에 없음 → 이번 범위 제외(뷰어 위주) 가정.

## 복사용 프롬프트

```
[역할] 너는 주택관리ERP(Next.js+Supabase, app/ 라우트그룹 구조)의 오케스트레이터다. CLAUDE.md/AGENTS.md 규칙을 그대로 따른다(PRD-first, 무거운 작업은 codex 위임, DB적용·커밋·리뷰는 Claude, 커밋 직후 wbs-commit-sync).

[목표] 세입자앱(resident)의 "기능화면"을 구현한다. 온보딩(카카오 로그인→세대매칭)은 이미 완료(app/(resident), res_claims·resident_identities·RPC 7종·hooks/reactquery/residentClaims, 마이그 0039 라이브). 그 위에 실사용 화면을 얹는 작업이다.

[먼저 읽을 자료 — 3곳 모두 확인]
1) 프로토타입(디자인 정본, 패턴 /[role]/[feature]/[file].dc.html):
   - 홈 허브   https://staging.d2h12382xiksft.amplifyapp.com/resident/resident-home/resident-home.dc.html
   - 관리비    https://staging.d2h12382xiksft.amplifyapp.com/resident/resident-bill/resident-bill.dc.html
   - 관리비상세 https://staging.d2h12382xiksft.amplifyapp.com/resident/resident-bill-detail/resident-bill-detail.dc.html
   - 공지목록   https://staging.d2h12382xiksft.amplifyapp.com/resident/resident-notice/resident-notice.dc.html
   - 공지상세   https://staging.d2h12382xiksft.amplifyapp.com/resident/resident-notice-detail/resident-notice-detail.dc.html
   - 내정보    https://staging.d2h12382xiksft.amplifyapp.com/resident/resident-me/resident-me.dc.html
   (참고=이미구현 온보딩: resident-login/auth/nomatch/pending/notify)
2) PRD: docs/prototype/prd/tenant-app.md + docs/resident.zip(미추적)을 풀면 화면별 .md(동작규칙)+.dc.html(디자인)이 있다. resident.zip이 최신 정본. 데이터 의미는 bill-publish.md·payment-processing.md·management-fee-setting.md 참조.
3) WBS: bucket 9514ec1f-cb2d-4cfa-9ee6-6aff04127c73, 페이지 "세입자_홈/관리비 내역/관리비 상세고지서/공지 목록/공지 상세/내 정보"(전부 예정). get_project_status로 확인.

[구현 범위]
- 신규 화면: resident-home(온보딩 종료셸→기능 허브로), resident-bill(월별 항목·납부상태·자동이체 안내), resident-bill-detail(무로그인 1년 토큰 링크+계좌/계좌+금액 복사), resident-notice + notice-detail, resident-me.
- 백엔드: 로그인 세입자의 res_claims.status='linked' 세대만 보는 SECURITY DEFINER RPC(부과=fee_item_charges/payments, 공지=notices, 세대=occupancies). 무로그인 상세는 만료 토큰(1년) 공개 접근 경로.
- ⚠️ 퇴실신청/고지서신청(구 tenant-app.md 3.4/3.5)은 최신 resident.zip에 화면이 없다 → 이번 범위 제외(뷰어 위주). 넣을지 애매하면 사용자에게 물어라.

[제약/조정]
- 오직 app/(resident)/** 와 세입자 전용 lib/hooks/마이그만 건드린다. app/(platform-admin)/**·app/(staff)/**는 절대 손대지 마라(세션2가 통합관리자 병렬 진행중).
- 마이그레이션 번호는 0040~0049만 사용. 커밋 직전 origin/master 최대번호 재확인(현재 0039).
- teal 스코프(app/(resident)/resident.css) 유지, globals.css 파랑 불변.
- DB 적용은 Claude가 .env.local SUPABASE_ACCESS_TOKEN + Management API(projects/amhtprmapxlizdnsgbeg/database/query)로. Supabase MCP는 다른 프로젝트라 사용 금지.

[진행 순서] 자료 3곳 정독 → 짧은 구현계획(화면·DB·RPC 분해) 제시하고 애매한 점 먼저 질문 → 승인 후 codex 위임 구현 → tsc/vitest/lint/next build 검증 → 커밋 → wbs-commit-sync. 먼저 계획부터 보고하라.
```

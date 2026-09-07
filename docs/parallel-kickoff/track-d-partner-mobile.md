# Track D — 현장 파트너(현장관리자) 모바일 앱

- **라우트그룹**: `app/(partner)` (신규) · **마이그 범위**: 0070~0079
- **준비도**: ✅ 즉시 착수 가능(그린필드·완전 독립). 규모 [L].
- **프로토타입**(패턴 `/partner/[feature]/[file].dc.html`):
  - 홈·AS현황 `/partner/mobile-home/mobile-home.dc.html`
  - 로그인 `/partner/mobile-login/mobile-login.dc.html`
  - AS 상세 `/partner/mobile-as/mobile-as.dc.html` · AS 신규 `/partner/mobile-as-new/mobile-as-new.dc.html`
  - 검침 `/partner/mobile-meter/mobile-meter.dc.html`
  - 건물정보 `/partner/mobile-building/mobile-building.dc.html` · 입주자정보 `/partner/mobile-tenant/mobile-tenant.dc.html`
  - 조회·검색 `/partner/mobile-inquiry/mobile-inquiry.dc.html`
  - 이사정산 등록 `/partner/mobile-ms-new/mobile-ms-new.dc.html`
  - 프로필 `/partner/mobile-profile/mobile-profile.dc.html`
- **PRD**: `docs/prototype/prd/mobile-home.md·mobile-as.md·mobile-inquiry.md·mobile-utility-charge.md·mobile-moving-settlement.md` + `docs/partner.zip` 화면별 .md(정본)
- **WBS 페이지**(현장 관리자 폴더): 검침 자료 / 모바일 AS 상세 / 모바일 AS 신규 접수 / 모바일 건물 정보 / 모바일 입주자 정보 / 모바일 조회건물·입주자 검색 / 모바일 홈AS현황 / 프로필 / 현장관리자 로그인 (이사정산 등록·상세는 완료)

## 복사용 프롬프트

```
[역할] 너는 주택관리ERP(Next.js+Supabase, app/ 라우트그룹 구조)의 오케스트레이터다. CLAUDE.md/AGENTS.md 규칙을 그대로 따른다(PRD-first, 무거운 작업은 codex 위임, DB적용·커밋·리뷰는 Claude, 커밋 직후 wbs-commit-sync).

[목표] 현장 관리자(=파트너) 모바일 웹앱을 신규 구축한다. 제품의 4번째 롤. 기존 staff 백엔드(건물·AS/민원·검침·이사정산)를 재사용하고, 현장(field) 계정은 이미 accounts 3탭(사무실·현장·입주자)에 존재한다. 신규 라우트그룹 app/(partner)로 만든다.

[먼저 읽을 자료 — 3곳 모두 확인]
1) 프로토타입(디자인 정본, 패턴 /partner/[feature]/[file].dc.html):
   - 홈·AS현황 https://staging.d2h12382xiksft.amplifyapp.com/partner/mobile-home/mobile-home.dc.html
   - 로그인    https://staging.d2h12382xiksft.amplifyapp.com/partner/mobile-login/mobile-login.dc.html
   - AS 상세   https://staging.d2h12382xiksft.amplifyapp.com/partner/mobile-as/mobile-as.dc.html
   - AS 신규   https://staging.d2h12382xiksft.amplifyapp.com/partner/mobile-as-new/mobile-as-new.dc.html
   - 검침     https://staging.d2h12382xiksft.amplifyapp.com/partner/mobile-meter/mobile-meter.dc.html
   - 건물정보  https://staging.d2h12382xiksft.amplifyapp.com/partner/mobile-building/mobile-building.dc.html
   - 입주자정보 https://staging.d2h12382xiksft.amplifyapp.com/partner/mobile-tenant/mobile-tenant.dc.html
   - 조회·검색  https://staging.d2h12382xiksft.amplifyapp.com/partner/mobile-inquiry/mobile-inquiry.dc.html
   - 이사정산등록 https://staging.d2h12382xiksft.amplifyapp.com/partner/mobile-ms-new/mobile-ms-new.dc.html
   - 프로필    https://staging.d2h12382xiksft.amplifyapp.com/partner/mobile-profile/mobile-profile.dc.html
2) PRD: docs/prototype/prd/mobile-home.md·mobile-as.md·mobile-inquiry.md·mobile-utility-charge.md·mobile-moving-settlement.md + docs/partner.zip(미추적)을 풀면 화면별 .md(동작규칙)+.dc.html(디자인). partner.zip이 최신 정본.
3) WBS: bucket 9514ec1f-cb2d-4cfa-9ee6-6aff04127c73, "현장 관리자_*" 페이지 10개(이사정산 등록·상세만 완료, 나머지 예정). get_project_status로 확인.

[구현 범위]
- 신규 app/(partner) 라우트그룹 + 모바일 셸/레이아웃 + 현장 로그인(field 롤 인증, proxy 게이팅).
- 화면: 홈(담당 AS현황), AS 상세/신규접수(사진 카메라 업로드→Supabase Storage), 모바일 검침(지침 입력), 건물/입주자 조회, 조회·검색, 이사정산 등록(계산+저장·정산서 SMS), 프로필.
- 백엔드: 현장 계정이 담당 건물만 접근하는 SECURITY DEFINER RPC/RLS. AS(complaints)·검침(meter_readings)·이사정산(moving_settlement)·건물/입주자 읽기를 재사용.

[제약/조정]
- app/(partner)/** 와 partner 전용 lib/hooks/마이그만 건드린다. app/(resident)/**·app/(platform-admin)/**·app/(staff)/** 미접촉. staff 백엔드 테이블은 재사용하되(신규 field RPC/RLS만 추가) 기존 staff 화면·기존 RLS/정책은 변경 금지.
- 마이그레이션 번호는 0070~0079만 사용. 커밋 직전 origin/master 최대번호 재확인(현재 0039).
- 모바일 파랑(#3182F6) 디자인시스템. 사진 업로드는 Supabase Storage 버킷(신규 시 RLS 포함).
- DB 적용은 Claude가 .env.local SUPABASE_ACCESS_TOKEN + Management API(projects/amhtprmapxlizdnsgbeg/database/query)로. Supabase MCP는 다른 프로젝트라 사용 금지.

[진행 순서] 자료 3곳 정독 → 짧은 구현계획(라우트그룹·인증·화면·DB·Storage 분해) 제시하고 애매한 점 먼저 질문 → 승인 후 codex 위임 구현 → tsc/vitest/lint/next build 검증 → 커밋 → wbs-commit-sync. 먼저 계획부터 보고하라.
```

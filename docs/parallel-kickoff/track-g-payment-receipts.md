# Track G — 수납·민원 통합 마감

- **주 대상**: `(staff)/payment` + `(staff)/receipts` + 관련 lib · **마이그 범위**: 0090~0099(필요시)
- **준비도**: ⚠️ **제품결정 선행** — PRD(receipt-management)는 수납+민원 **통합 1화면**인데 코드는 `/payment`(수납)+`/receipts`(민원) **2분리**. 통합 재구성 vs 분리 유지 확정 후 착수.
- **미구현(감사 기준)**: 통합검색(수납+민원) · 호실 더블클릭 jumpTo · 미납 문자전송 · 입주자정보 수정 · 수납 건물메모 · 월별 이력 편집표 · 확인문자 실발송(→Track E 의존)
- **PRD**: `docs/prototype/prd/receipt-management.md` + `payment-processing.md` + `overdue-management.md`
- **WBS 페이지**: 사무실 관리자_수납관리·민원접수 (감사 비고에 미구현 목록)

## 복사용 프롬프트

```
[역할] 너는 주택관리ERP(Next.js+Supabase)의 오케스트레이터다. CLAUDE.md/AGENTS.md 규칙을 그대로 따른다(PRD-first, 무거운 작업은 codex 위임, DB적용·커밋·리뷰는 Claude, 커밋 직후 wbs-commit-sync).

⚠️[제품결정 선행 — 착수 첫 단계] PRD(receipt-management.md)는 수납+민원을 통합 1화면으로 규정하지만, 현재 코드는 /staff/payment(수납·자동수납)와 /staff/receipts(민원·AS)로 2분리되어 있다. 착수 첫 단계로 사용자에게 "통합 재구성 vs 분리 유지"를 확정받아라. 통합=재구성 규모 큼, 분리유지=각 화면 미구현분만 보강.

[목표] 수납·민원 화면을 receipt-management PRD 기준으로 마감한다.

[먼저 읽을 자료 — 3곳 모두 확인]
1) PRD: docs/prototype/prd/receipt-management.md(정본) + payment-processing.md + overdue-management.md. + docs/staff.zip(미추적)의 해당 화면 .md/.dc.html.
2) 프로토타입: https://staging.d2h12382xiksft.amplifyapp.com/ 의 staff 수납/민원 화면.
3) WBS: bucket 9514ec1f-cb2d-4cfa-9ee6-6aff04127c73, "사무실 관리자_수납관리·민원접수"의 감사 비고(미구현 목록) 확인.

[구현 범위 — 결정 후]
- 통합검색(수납+민원), 호실 더블클릭 jumpTo(입주자/세대 상세 이동), 미납 문자전송, 입주자정보 수정, 수납 건물메모, 월별 이력 편집표.
- 확인문자 실발송: ⚠️ Track E(외부 발송 연동) worker에 의존 → E 미완이면 stub 유지하거나 E 이후 진행.

[제약/조정]
- (staff)/payment·(staff)/receipts·관련 lib만 건드린다. app/(resident)/**·app/(platform-admin)/** 미접촉. (staff) 내 utilities/messaging/bill 등 타 화면 로직 변경 금지.
- 마이그레이션 번호는 0090~0099만(필요 시). 커밋 직전 origin/master 최대번호 재확인(현재 0039).
- 기존 수납 마이그 0015·0018·0019·0020, 미납 0022 참고.
- DB 적용은 Claude가 .env.local SUPABASE_ACCESS_TOKEN + Management API(projects/amhtprmapxlizdnsgbeg/database/query)로. Supabase MCP는 다른 프로젝트라 사용 금지.

[진행 순서] 통합/분리 결정 → 자료 3곳 정독 → 짧은 구현계획 제시·애매한 점 질문 → 승인 후 codex 위임 → tsc/vitest/lint/next build 검증 → 커밋 → wbs-commit-sync. 먼저 결정과 계획부터 보고하라.
```

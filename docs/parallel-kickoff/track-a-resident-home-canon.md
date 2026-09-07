# Track A' — 세입자앱 홈 정본 정합 (Claude Design)

> 2026-09-07 작성. 세입자앱 온보딩/기능화면은 이미 구현·머지됨(PR #50/#54/#150). 이 트랙은 **기능 유지 + 표현을 클로드 디자인 정본에 맞추는 재정합**이다. 1차 대상 = **홈**, 2차 = 나머지 resident 화면 정본 diff.

## 요약 (무엇을/왜)
- 현재 `app/(resident)/resident/home/page.tsx` 는 정본과 **레이아웃이 다르다**: 이름을 h1로, 관리비 카드에 상태칩·연체료 없음, 관리비 추이가 **가로 막대**.
- 정본 `docs/prototype/resident/resident-home.dc.html` 은: 건물·호수를 헤더 타이틀로, 관리비 카드에 미납칩+당월부과/연체료 2줄, 추이는 **세로 막대 차트**(당월 강조·플로팅 값배지), 공지 카드가 관리비 위.
- 목표: **데이터 배선·가드·훅은 그대로 두고** 마크업/CSS 모듈만 정본 구성으로 교체.

## 착수 전 필독 (경로)
- **정본(디자인)**: `docs/prototype/resident/resident-home.dc.html` — 로컬에 있음(스테이징 curl 불필요). 토큰: `--blue:#14A497`(청록, primary)·Pretendard·`--t1..t4` 그레이·`--red:#F04452`·`--amber:#FF922B`.
- **현재 구현**: `app/(resident)/resident/home/page.tsx` + `app/(resident)/resident/home/home.module.css`
- **재사용 컴포넌트(먼저 확인 — 이미 정본과 맞을 가능성 큼)**: `app/(resident)/_components/BottomNav`(홈/관리비/내정보 3탭)·`MoveOutSection`(퇴실 시트+캘린더)·`ResidentAsyncState`(로딩/에러)
- **훅/데이터**: `hooks/reactquery/residentBilling`(useResidentBillMonths)·`residentNotices`·`residentProfile`(useResidentProfile — kakaoName 포함, PR #150)
- **PRD**: `docs/prototype/prd/tenant-app.md` §3.1 홈 (동작 규칙 정본)
- **WBS**: bucket `9514ec1f-cb2d-4cfa-9ee6-6aff04127c73`, 페이지 **세입자_홈 `cec51639-f566-4374-b5d2-e9b3438bca33`** (dev=진행중). 커밋 직후 `wbs-commit-sync`.

## 구체 갭 (현재 → 정본)
1. **헤더 계층 뒤집기**: 타이틀 = `{건물} {호수}`(19px/800), 서브 = `{kakaoName || "사용자"} 님 · {orgName}`(12.5px/t3). ⚠️PR #150 규칙(홈 이름=카카오 실명, 없으면 "사용자", 마스킹 없음) 유지하되 위치만 서브라인으로. 우측 **알림 벨 아이콘 + 미읽음 dot** → 공지 목록(`/resident/notice`).
2. **공지 카드를 관리비 카드 위로**: amber 아이콘 박스 + "건물 공지" + 본문 1줄 clamp. (현재는 관리비 아래 단순 배너.)
3. **관리비 카드**: ① 상태 **칩**("미납"=red / 완납=blue`.ok` / 부분납=amber`.warn`) ② 큰 금액 = **총 청구액(당월부과+연체료)** ③ "납부기한 {날짜}" ④ 구분선 ⑤ `당월 부과액` / `연체료` 2줄(li) ⑥ CTA를 **버튼(.pri, 청록)** 으로(현재는 텍스트 링크) → `/resident/bill`.
4. **관리비 추이 = 세로 막대 차트**로 재작성: 3개월, 당월 `.on`(청록 그라디언트+플로팅 값배지+캐럿), grow 애니메이션, 월 라벨 하단. thead "최근 3개월 평균보다 **{차액}원 많아요/적어요**"(차액 색: 많으면 red·적으면 blue), tfoot "3개월 평균 {avg} · 이번 달 {cur}". (현재는 가로 막대.)
5. **퇴실/바텀탭/모달**: `MoveOutSection`·`BottomNav` 재사용 — 정본과 이미 일치하는지 먼저 확인 후 필요 시만 손봄.

## 데이터 갭 (먼저 확인·결정 필요)
- **연체료 분리값**: 정본은 `당월 부과액`/`연체료`를 나눠 보여주고 큰 금액=합계. `resident_bill_months` RPC가 **연체료를 따로 반환하는지** 확인. 없으면 RPC 확장(마이그) 또는 overdue 집계 재사용 필요 → 스펙 결정 후 진행.
- **추이 비교문구**: 당월 vs 직전 3개월 평균 차액 계산 로직(많아요/적어요·색).
- **공지 카드 탭 동작**: 정본은 인페이지 **모달**, 현재는 상세 **라우트**. 권장 = 라우트 유지(현 패턴)하되 카드 표현만 정본화. 모달로 갈지 애매하면 사용자에게 질문.

## 제약
- **오직 `app/(resident)/**`** 만 수정. staff·platform-admin·partner 절대 금지.
- **AGENTS.md**: 이 Next는 포크라 관례가 다르다 — Next 코드 쓰기 전 `node_modules/next/dist/docs/` 해당 가이드 확인.
- **청록 토큰**(#14A497)이 앱 전역 기본(2026-09-01 피벗). resident는 CSS 모듈이므로 정본 토큰값을 모듈에 반영(globals import 아님). "파랑 유지" 옛 메모는 STALE.
- **단위 테스트 신규 작성 금지**(2026-08-28 정책). 홈 재작성으로 깨지는 `home/page.test.tsx`는 **기존 테스트 수정**만. 검증 = tsc·lint·next build·기존 vitest 그린 + 눈으로 정본 대조.
- **마이그 필요 시** origin/master 최대번호 재확인 후 다음 번호(현재 최신 0141 → **0142+**). DB 적용은 Claude가 `.env.local` `SUPABASE_ACCESS_TOKEN` + Management API(`projects/amhtprmapxlizdnsgbeg/database/query`), Supabase MCP 금지.

## 권장 워크플로우
- **워크트리보다 master 체크아웃의 feature 브랜치 권장**: dev 서버(:3000)가 master 체크아웃을 서빙하므로 브랜치를 바로 핫리로드 → 정본과 나란히 보며 반복하기 좋다. (다른 트랙과 **병렬**로 돌릴 때만 워크트리 — 그 경우 :3000 라이브 미반영·검증 시 master node_modules 정션 필요.)
- 순서: 자료 정독 → 짧은 계획+데이터 갭 결정 질문 → codex 위임 구현 → tsc/lint/vitest/next build → 커밋 → `wbs-commit-sync`(cec51639) → 필요 시 PRD §3.1 갱신.

## 2차 (홈 끝난 뒤, 화면별 diff 후 결정)
`resident-notify`(알림설정)·`resident-nomatch`(매칭실패)·`resident-pending`(승인대기)·`resident-auth` — 초기 목업 산출물이라 정본과 어긋날 수 있음. 이미 정합됨: 약관·처리방침·**verify(매칭세대확인)**·로그인(부분). 화면별로 `.dc.html` 대조 후 갭 있으면만 착수.

## 복사용 프롬프트
```
[역할] 너는 주택관리ERP(Next.js 포크+Supabase, app/ 라우트그룹) 오케스트레이터다. CLAUDE.md·AGENTS.md를 그대로 따른다: PRD-first, 무거운 작업은 codex 위임(빈 stdin·본문 큰따옴표 금지), DB적용·커밋·리뷰·의존성설치는 Claude, 커밋 직후 wbs-commit-sync(dev 트랙만·완료 자동전환 금지). AGENTS.md대로 이 Next는 포크라 Next 코드 쓰기 전 node_modules/next/dist/docs/ 확인.

[목표] 세입자앱 "홈" 화면을 클로드 디자인 정본에 맞춰 재정합한다. 데이터 배선·가드·훅은 유지하고 마크업/CSS 모듈만 정본 구성으로 교체한다.

[먼저 읽어라]
1) 정본(로컬): docs/prototype/resident/resident-home.dc.html — 토큰 청록 #14A497·Pretendard·t1~t4·red #F04452·amber #FF922B.
2) 현재 구현: app/(resident)/resident/home/page.tsx + home.module.css.
3) 재사용 컴포넌트(이미 정본과 맞는지 먼저 확인): app/(resident)/_components/ BottomNav·MoveOutSection·ResidentAsyncState.
4) 훅: hooks/reactquery/residentBilling·residentNotices·residentProfile(kakaoName 포함).
5) PRD docs/prototype/prd/tenant-app.md §3.1 홈. WBS bucket 9514ec1f… 페이지 세입자_홈 cec51639.

[정본 갭 — 반영할 것]
- 헤더: 타이틀={건물} {호수}, 서브={kakaoName || "사용자"} 님 · {orgName}(이름 실명·마스킹 없음, PR #150 규칙 유지, 위치만 서브라인). 우측 알림 벨+미읽음 dot → /resident/notice.
- 공지 카드를 관리비 위로(amber 아이콘+제목+본문 1줄 clamp).
- 관리비 카드: 상태칩(미납 red/완납 blue/부분 amber) + 큰 금액=총 청구액(당월부과+연체료) + 납부기한 + 구분선 + '당월 부과액'/'연체료' 2줄 + 청록 CTA 버튼 → /resident/bill.
- 관리비 추이: 세로 막대 차트(3개월, 당월 청록 강조+플로팅 값배지+캐럿+grow 애니메이션, 월라벨 하단), thead "최근 3개월 평균보다 {차액}원 많아요/적어요"(많으면 red·적으면 blue), tfoot "3개월 평균 {avg} · 이번 달 {cur}".

[먼저 결정할 데이터 갭 — 계획 단계에서 질문]
- resident_bill_months RPC가 연체료를 따로 반환하나? 없으면 RPC 확장(마이그 0142+) vs overdue 재사용 — 스펙 확정 후 진행.
- 추이 비교문구(당월 vs 직전3개월 평균 차액·색) 계산.
- 공지 카드 탭: 정본은 모달, 현재는 상세 라우트 — 권장은 라우트 유지+표현만 정본화. 애매하면 사용자에게 질문.

[제약] 오직 app/(resident)/** 수정(staff·platform-admin·partner 금지). 청록 토큰을 CSS 모듈에 반영. 단위 테스트 신규 금지(깨지는 home/page.test.tsx는 기존 수정만). 마이그 필요 시 origin/master max 재확인 후 0142+, DB는 Claude가 Management API(projects/amhtprmapxlizdnsgbeg/database/query, .env.local 토큰)로 적용·Supabase MCP 금지.

[워크플로우] master 체크아웃의 feature 브랜치 권장(:3000 핫리로드로 정본 대조). 순서: 자료 정독 → 짧은 계획+데이터 갭 결정 질문 → codex 위임 구현 → tsc/lint/vitest/next build → 커밋 → wbs-commit-sync(cec51639) → 필요 시 PRD §3.1 갱신. 먼저 계획부터 보고하라.
```

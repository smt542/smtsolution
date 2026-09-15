@AGENTS.md

## Reference-only prototype documents

- `docs/prototype/**` is reference-only material.
- Exclude it from routine code discovery, implementation, refactoring, bulk migrations, lint, and verification.
- Read it only when the user explicitly asks to consult it.
- This rule takes precedence over any later instruction to consult `docs/prototype/prd/**` automatically.

## PRD 문서 우선 참조 (수정 전 필독)
화면·기능을 수정하기 전, `docs/prototype/prd/`에서 **해당 화면에 대응하는 PRD 문서를 먼저 읽는다**(이 디렉터리가 기획 정본). 파일명이 화면과 1:1로 매핑된다 — 예: 고지서 발행=`bill-publish.md`, 관리비 세팅=`management-fee-setting.md`, 공과금=`utility-charge.md`, 수납=`payment-processing.md`, 미납=`overdue-management.md`, 입주자=`tenant-list.md`·`tenant-detail.md`·`tenant-app.md`, 건물=`building-list.md`·`building-detail.md`, 세입자앱/모바일=`mobile-*.md`, 문자·알림톡=`messaging.md`, 퇴실정산=`moving-settlement.md`, 셋업=`setup.md`, 대시보드=`dashboard.md`, 직원=`staff-management.md`, 영수/민원=`receipt-management.md`.

- 전체를 매번 읽지 말고 **수정 대상 화면의 문서만** 참조한다. 구현이 PRD와 어긋나면 진행 전 사용자에게 확인한다.
- codex에 구현을 위임할 때는 위임 프롬프트에 해당 PRD 문서 경로를 포함해 워커가 직접 읽게 한다.

## 퍼블리싱 시 공용 컴포넌트 우선 사용
화면을 퍼블리싱하거나 UI를 수정할 때는 **Tailwind CSS로 구현**하고, 기존 공용 컴포넌트를 먼저 확인해 우선 재사용한다. 동일하거나 유사한 UI를 페이지 내부에 중복 구현하지 말고, 필요한 경우 기존 공용 컴포넌트의 props나 variant를 확장한다. 새 컴포넌트가 여러 화면에서 재사용될 수 있다면 페이지 전용으로 만들지 말고 공용 컴포넌트로 구현한다.

## API 서버 상태는 React Query 우선 사용
API에서 가져오거나 변경하는 서버 상태는 **`@tanstack/react-query`를 단일 기준으로 사용**한다. 조회는 `useQuery`, 변경은 `useMutation`을 우선 사용하고, API 응답을 컴포넌트의 `useState`·`useEffect`나 별도 전역 스토어에 중복 저장하지 않는다. API 모듈은 HTTP 요청 함수만 담당하고, 캐시·로딩·에러·재조회·동기화는 React Query에서 관리한다. 동일한 데이터의 API 호출이나 Query가 중복되어 있다면 공용 query key와 query hook으로 통합하며, mutation 이후에는 필요한 캐시를 갱신하거나 무효화한다. 화면 표시만을 위한 로컬 UI 상태는 컴포넌트 상태로 관리할 수 있다.

## Codex 우선 위임 (토큰 절감·빠른 개발)
무거운 컨텍스트 작업은 **codex CLI(headless 워커)에 우선 위임**해 Claude 컨텍스트를 가볍게 유지한다. Claude=오케스트레이터, codex=워커.

- **codex에 넘길 것**: 대량 파일 읽기·분석(탐색), 파일 작성·수정(구현), `tsc`/`vitest` 실행·반복. 결과는 요약/디프로만 회수한다.
- **Claude가 직접**: 오케스트레이션, 최종 판단·설계, 디프 리뷰, git 커밋, 의존성 설치(`npm install`). ← codex는 샌드박스라 git·네트워크 불가.
- **검증된 실행법**(이 외 방식은 hang 위험): `"" | codex exec -s <read-only|workspace-write> -c approval_policy="never" '<프롬프트>'`. 파일 쓰면 `workspace-write`, 읽기 전용이면 `read-only`. 빈 stdin 파이프로 즉시 EOF가 필수이며, `codex exec`엔 `-a`가 없고 `--dangerously-bypass-approvals-and-sandbox`는 쓰지 않는다.
- **가드레일**: 한두 줄짜리 사소한 편집은 위임 오버헤드(기동 ~11s·~16k토큰)가 더 크므로 Claude가 직접 처리한다. 위임 결과는 커밋 전 반드시 Claude가 리뷰한다.
- 유용 플래그: `-C <dir>`(워크트리별 워크루트), `--output-last-message <file>`(결과 회수), `--json`(진행 스트림).

## WBS 동기화 규칙
커밋을 만든 직후, 그 커밋이 건드린 화면을 `wbs-commit-sync` 스킬로 동기화한다(고신뢰 자동 반영, 애매하면 질문). **주택관리ERP 버킷만** 대상이며, 개발 트랙(dev)만 갱신하고 `완료`는 자동으로 바꾸지 않는다.

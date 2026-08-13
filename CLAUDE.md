@AGENTS.md

## Codex 우선 위임 (토큰 절감·빠른 개발)
무거운 컨텍스트 작업은 **codex CLI(headless 워커)에 우선 위임**해 Claude 컨텍스트를 가볍게 유지한다. Claude=오케스트레이터, codex=워커.

- **codex에 넘길 것**: 대량 파일 읽기·분석(탐색), 파일 작성·수정(구현), `tsc`/`vitest` 실행·반복. 결과는 요약/디프로만 회수한다.
- **Claude가 직접**: 오케스트레이션, 최종 판단·설계, 디프 리뷰, git 커밋, 의존성 설치(`npm install`). ← codex는 샌드박스라 git·네트워크 불가.
- **검증된 실행법**(이 외 방식은 hang 위험): `"" | codex exec -s <read-only|workspace-write> -c approval_policy="never" '<프롬프트>'`. 파일 쓰면 `workspace-write`, 읽기 전용이면 `read-only`. 빈 stdin 파이프로 즉시 EOF가 필수이며, `codex exec`엔 `-a`가 없고 `--dangerously-bypass-approvals-and-sandbox`는 쓰지 않는다.
- **가드레일**: 한두 줄짜리 사소한 편집은 위임 오버헤드(기동 ~11s·~16k토큰)가 더 크므로 Claude가 직접 처리한다. 위임 결과는 커밋 전 반드시 Claude가 리뷰한다.
- 유용 플래그: `-C <dir>`(워크트리별 워크루트), `--output-last-message <file>`(결과 회수), `--json`(진행 스트림).

## WBS 동기화 규칙
커밋을 만든 직후, 그 커밋이 건드린 화면을 `wbs-commit-sync` 스킬로 동기화한다(고신뢰 자동 반영, 애매하면 질문). **주택관리ERP 버킷만** 대상이며, 개발 트랙(dev)만 갱신하고 `완료`는 자동으로 바꾸지 않는다.

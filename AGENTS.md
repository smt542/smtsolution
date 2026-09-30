<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## WBS 관리 (wbs-scheduler)

일정·진행 상태의 기준은 WBS 원격 보드의 **주택관리ERP 버킷**(`9514ec1f-cb2d-4cfa-9ee6-6aff04127c73`)이다. 조회·수정은 `wbs-scheduler` 스킬(MCP `get_project_status`·`update_page_wbs`·`update_pages_wbs`·`update_bucket_schedule`)로 하고, 다른 버킷은 건드리지 않는다. 목적은 WBS와 실제 업무 상태가 어긋나지 않게 하는 것이다.

1. **작업 시작 전**: `get_project_status`로 대상 화면의 현재 일정(목표일)과 상태를 확인한다.
2. **신규 요청을 받으면**: 그 요청이 기존 일정(목표일·진행 중인 다른 작업)에 주는 영향을 판단해 사용자에게 알린다.
3. **우선순위**: 기존 작업과 겹치거나 일정이 모자라면 무엇을 먼저 할지 추천안과 함께 사용자에게 확인한다.
4. **변경은 생긴 시점에 반영**: 완료 예정일 변경·작업 지연·우선순위 변경·추가 이슈가 생기면 나중에 몰아서 고치지 않고 그때 바로 WBS(상태·목표일·비고)에 반영하고 사용자에게 보고한다. 목표일·완료 처리처럼 사용자가 정할 값은 추천안과 함께 묻고, 정해지면 바로 반영한다.

- 커밋 직후 개발 트랙 자동 동기화는 CLAUDE.md의 `wbs-commit-sync` 규칙을 따른다. 이 절은 그 밖의 일정·상태 변경 전반이다.
- 비고(`remarks`)는 쓸 때마다 통째로 교체되고 여러 세션이 같은 화면에 쓴다. 쓰기 직전에 다시 읽어 그 값 끝에 덧붙이고, 쓴 뒤 다시 읽어 내용이 그대로인지 확인한다.
- WBS 도구가 없는 환경(Codex 등 샌드박스 워커)에서는 바뀐 일정·상태를 결과 보고에 적어 오케스트레이터가 반영하게 한다.

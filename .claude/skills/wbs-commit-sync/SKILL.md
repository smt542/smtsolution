---
name: wbs-commit-sync
description: git 커밋을 읽어 주택관리ERP WBS의 화면(page)에 유사도로 매칭하고 개발 트랙(dev) 상태·비고를 자동 반영한다. "WBS 동기화", "커밋 WBS 반영", "wbs sync", "개발현황 커밋 반영", "WBS 백필", 커밋 직후 화면 상태 갱신 요청에 사용. 주택관리ERP 버킷 전용이며, 쓰기는 wbs 원격 MCP(update_page_wbs/update_pages_wbs)를 재사용한다.
---

# WBS Commit Sync

내가 만든 git 커밋을 읽어 **주택관리ERP** 버킷의 화면(page)에 유사도로 매칭하고,
매칭된 화면의 **개발 트랙(dev)** 상태·비고를 WBS에 반영하는 스킬이다.
쓰기 도구는 기존 `wbs-scheduler` 원격 MCP를 재사용한다.

## 절대 규칙 (안전장치)
- **버킷 잠금**: `config.json`의 `bucket_id`만 대상. 쓰기 전 `list_buckets`로 그 id가 이름 `주택관리ERP`인지 재확인하고, 다르면 즉시 중단한다. 다른 버킷은 어떤 경우에도 건드리지 않는다.
- **개발 트랙만**: `dev_status`·`dev_done`·`remarks`만 쓴다. `design_*`/`pub_*`는 절대 건드리지 않는다.
- **완료 자동 금지**: `dev_status`를 `완료`로 자동 전환하지 않는다. `완료`는 사용자가 명시할 때만.
- **다운그레이드 금지**: 이미 `진행중`/`완료`인 화면을 낮추지 않는다.
- **애매하면 질문**: 매칭이 애매하면 추측하지 말고 후보를 제시해 물어본다.
- 상태 값은 정확히 `예정`|`진행중`|`완료`, 날짜는 `YYYY-MM-DD`.

## 파일
- `config.json` — 버킷 잠금·스캔 브랜치·플래그
- `map.json` — 커밋신호→page_id 학습 매핑(시드 포함, 자동 성장)
- `.wbs/state.json` — 워터마크(gitignore). 없으면 최초 = 백필로 간주.

## 재사용 MCP 도구
- 읽기: `list_buckets`, `list_pages(bucket_id)`, `get_project_status(bucket_id)` — 화면별 `dev_status`·`remarks`를 **모두 포함**해 반환한다(한 번 호출로 전 화면 상태 취득). `get_page`는 WBS 필드가 아니라 마크다운 본문이므로 사용하지 않는다.
- 쓰기: `update_page_wbs(page_id, …)`, `update_pages_wbs(page_ids|bucket_id, …)`

## 절차 A — 매칭 미리보기 (읽기 전용, 항상 안전)
1. **가드**: `config.json`을 읽는다. `list_buckets` 호출 → `bucket_id`가 이름 `주택관리ERP`인지 확인. 불일치 시 중단하고 사용자에게 알린다.
2. **커밋 수집**: `.wbs/state.json`이 있으면 `git log <last_synced_sha>..HEAD`, 없으면 전체 이력(백필). 대상 브랜치는 `config.branches`의 현재 체크아웃 브랜치. 각 커밋에 대해:
   - `git show -s --format=%H%n%s%n%b <sha>` → 해시·제목·본문
   - `git show --name-only --format= <sha>` → 변경 파일 경로
3. **신호 추출**: 제목/본문의 영문 kebab 토큰(예: vendor-management)과 한국어 명사(거래처·구분·건물·입주자·계정·권한·직원 등), 변경 경로의 디렉터리명. 커밋 scope `(p1a)`는 단계이므로 화면 신호에서 제외한다.
4. **매칭**: 신뢰도는 별도 임베딩/점수 없이 정성 밴드(고신뢰/애매)로 판단한다.
   - (a) `map.json`의 각 규칙에 대해 `keywords`/`paths` 중 하나라도 신호에 포함되면 그 `page_id` = **고신뢰**.
   - (b) 규칙 미스면 `get_project_status(bucket_id)`로 화면 목록을 받아 제목과 신호를 대조한다.
   - (c) 제목/키워드가 뚜렷이 일치하는 **단일 후보** → 고신뢰(수용).
   - (d) 후보가 복수이거나 뚜렷한 일치가 없음 → **"애매"** 표시.
   - (e) 화면과 무관한 커밋(`docs`/`chore`/순수 설정 등 화면 구현이 아님) → **"스킵"** 표시.
5. **미리보기 표 출력**: 각 커밋에 대해 `커밋(short sha·type) → 화면 | 판정(고신뢰/애매/스킵) | 제안 dev_status | remarks 요약`. 이 절차는 읽기 전용이며 어떤 `update_*`도 호출하지 않는다.

## 절차 B — 반영 (쓰기)
절차 A로 미리보기를 만든 뒤 **고신뢰 항목만** 반영한다.

1. **애매 항목 질문**: `config.ask_when_ambiguous`가 true면, "애매" 목록의 각 커밋에 대해 상위 후보 화면을 제시하고 사용자 선택을 받는다. 선택 결과를 `map.json`에 규칙으로 추가한다(keywords = 그 커밋의 대표 신호, page_id/page_title = 선택 화면).
2. **현재 상태 읽기(멱등)**: 대상 화면들의 현재 `dev_status`·`remarks`를 모두 `get_project_status(bucket_id)`의 해당 page 항목에서 읽는다(한 번 호출로 전 화면).
3. **dev_status 계산**:
   - 현재 `예정` → `진행중`.
   - 현재 `진행중`/`완료` → 변경하지 않는다(다운그레이드·완료 자동 금지).
4. **remarks 계산(사람 글 보존, 자동 블록만 갱신)**:
   - 마커 라인: `—— [자동 동기화] ——`
   - 기존 `remarks`에서 마커 라인부터 끝까지를 잘라낸 나머지 = **사람 텍스트(보존)**.
   - 새 자동 블록:
     ```
     —— [자동 동기화] ——
     착수 <해당 화면 최초 커밋일> · 최근 <최신 커밋일> · 커밋 <해당 화면 커밋 수> · 최신: <최신 커밋 제목 요약>
     ```
   - 최종 `remarks` = 사람 텍스트(있으면) + 개행 + 자동 블록. (사람 텍스트가 없으면 자동 블록만.)
5. **쓰기**:
   - 화면 1개: `update_page_wbs(page_id, dev_status?, remarks?)` — 변경할 필드만 넘긴다.
   - 여러 화면에 **동일한** `dev_status`를 넣는 경우에 한해 `update_pages_wbs(page_ids=[…], dev_status=…)`로 일괄. (remarks는 화면마다 다르므로 보통 화면별 `update_page_wbs`.)
6. **워터마크 갱신**: `.wbs/state.json`에 `last_synced_sha`=대상 브랜치의 현재 HEAD sha, 처리한 sha들을 `processed_shas`에 추가, `updated_at`=오늘 날짜(`YYYY-MM-DD`)를 기록한다. 파일/디렉터리가 없으면 생성한다. 스키마:
   ```json
   { "last_synced_sha": "<sha>", "processed_shas": ["<sha>", "..."], "updated_at": "YYYY-MM-DD" }
   ```
7. **리포트**: 실제로 바뀐 화면과 필드(이전값→새값)를 표로 요약한다.

## 멱등성
동기화를 연속 두 번 실행하면 두 번째는 **변경 0건**이어야 한다: 상태는 이미 `진행중`, `remarks` 자동 블록 내용 동일, 워터마크 이후 새 커밋 없음.

## 트리거
- **요청 시**: 사용자가 "WBS 동기화"라고 하면 절차 A→B 실행.
- **내 커밋 직후**: `CLAUDE.md` 규칙에 따라, 세션에서 커밋을 만든 직후 그 커밋을 절차 A→B로 동기화한다.
- **주기적**: 활성 세션에서 `/loop`로 절차 A→B를 반복. 클라우드 헤드리스 cron은 이 MCP가 미연결일 수 있으므로 **세션 내 loop 또는 요청 시**를 1차로 권장.

## 백필 (최초 1회)
`.wbs/state.json`이 없으면 절차 A를 **전체 이력**에 적용해 미리보기만 만들고, 사용자 승인 후 절차 B로 반영한다. 애매 항목은 이 단계에서 함께 질문·확정하여 `map.json`을 채운다.

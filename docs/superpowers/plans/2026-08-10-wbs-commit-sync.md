# wbs-commit-sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** git 커밋을 읽어 주택관리ERP WBS의 화면(page)에 유사도로 매칭하고, 매칭된 화면의 개발 트랙 상태·비고를 자동 반영하는 repo-로컬 Claude 스킬을 만든다.

**Architecture:** Claude가 런타임인 `SKILL.md` + JSON 설정(`config.json`/`map.json`/`.wbs/state.json`)으로 구성한다. 별도 실행 코드·의존성 없음. 쓰기는 기존 `wbs-scheduler` 원격 MCP(`update_page_wbs`/`update_pages_wbs`)를 재사용한다. **읽기 전용 미리보기(절차 A)로 안전을 먼저 검증한 뒤 쓰기(절차 B)** 를 붙이는 순서로 만든다.

**Tech Stack:** Claude Code Skill(`SKILL.md` frontmatter+본문), JSON, git CLI, wbs 원격 MCP 도구, Node.js(JSON 검증용, 이미 프로젝트에 존재).

**검증 방식(중요):** 실행 코드가 없는 Claude-런타임 스킬이므로 유닛테스트 프레임워크를 쓰지 않는다. 각 태스크는 다음 중 해당하는 방식으로 검증한다 — (1) `node`로 JSON 파싱·필드 검증, (2) 라이브 MCP 읽기(`list_pages` 등)와 대조, (3) 읽기 전용 드라이런 + 멱등 재실행(두 번째 실행 = 변경 0건).

## Global Constraints

- 대상 버킷: **주택관리ERP `9514ec1f-cb2d-4cfa-9ee6-6aff04127c73` 만.** 쓰기 전 `list_buckets`로 이름 재검증, 불일치 시 즉시 중단. 다른 버킷(PickleKR·자수 등) 절대 금지.
- **개발 트랙만 쓴다**: `dev_status`·`dev_done`·`remarks`. `design_*`/`pub_*`는 절대 건드리지 않는다.
- `dev_status` 자동 전환은 **`예정→진행중`만**. `완료` 자동 금지(사용자 명시 시에만). 다운그레이드 금지.
- 상태 값은 정확히 `예정`|`진행중`|`완료`, 날짜는 `YYYY-MM-DD`.
- `remarks`: 사람 텍스트 보존, `—— [자동 동기화] ——` 마커 아래 자동 블록만 갱신.
- 애매하면 질문(추측 금지).
- 쓰기 MCP: `update_page_wbs`/`update_pages_wbs`만. 읽기: `list_buckets`/`list_pages`/`get_project_status`/`get_page`.
- 커밋 scope `(p1a)` 등은 **단계**이지 화면이 아니다. 화면 신호는 설명문의 영문 kebab 토큰·한국어 명사·변경 경로에서 뽑는다.

---

### Task 1: 스킬 디렉터리 + config.json + .gitignore

**Files:**
- Create: `.claude/skills/wbs-commit-sync/config.json`
- Modify: `.gitignore` (없으면 Create)

**Interfaces:**
- Produces: `config.json` — 필드 `bucket_id`(string, UUID), `bucket_name`(string), `branches`(string[]), `ask_when_ambiguous`(bool), `tracks`(string[]), `auto_complete`(bool). 이후 모든 절차가 이 파일을 읽는다.

- [ ] **Step 1: `config.json` 작성**

파일 `.claude/skills/wbs-commit-sync/config.json`:
```json
{
  "bucket_id": "9514ec1f-cb2d-4cfa-9ee6-6aff04127c73",
  "bucket_name": "주택관리ERP",
  "branches": ["angelshark", "main"],
  "ask_when_ambiguous": true,
  "tracks": ["dev"],
  "auto_complete": false
}
```

- [ ] **Step 2: `.gitignore`에 `.wbs/` 추가**

`.gitignore` 끝에 아래 두 줄을 추가한다(이미 있으면 생략):
```
# wbs-commit-sync 로컬 워터마크(커밋 안 함)
.wbs/
```

- [ ] **Step 3: JSON 파싱·필드 검증 (실패→통과 확인)**

Run:
```bash
node -e "const j=require('./.claude/skills/wbs-commit-sync/config.json'); if(j.bucket_id!=='9514ec1f-cb2d-4cfa-9ee6-6aff04127c73') throw new Error('bucket_id mismatch'); if(!Array.isArray(j.branches)) throw new Error('branches'); if(j.auto_complete!==false) throw new Error('auto_complete must be false'); console.log('OK', j.bucket_name)"
```
Expected: `OK 주택관리ERP` (오타/필드 누락 시 예외로 실패)

- [ ] **Step 4: 버킷 잠금 라이브 확인**

MCP `list_buckets` 호출 → 결과에서 `id == 9514ec1f-cb2d-4cfa-9ee6-6aff04127c73` 항목의 `name`이 `주택관리ERP`인지 확인.
Expected: 일치. (불일치면 config의 id가 틀린 것 → 수정)

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/wbs-commit-sync/config.json .gitignore
git commit -m "feat(wbs): wbs-commit-sync config + gitignore

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: map.json 시드 매핑

**Files:**
- Create: `.claude/skills/wbs-commit-sync/map.json`

**Interfaces:**
- Produces: `map.json` — `version`(number), `rules`(배열). 각 rule = `{page_id:string, page_title:string, keywords:string[], paths:string[]}`. 절차 A의 매칭 단계가 이 규칙을 신호에 대조한다.

- [ ] **Step 1: `map.json` 작성 (시드 3건)**

파일 `.claude/skills/wbs-commit-sync/map.json`:
```json
{
  "version": 1,
  "rules": [
    {
      "page_id": "4d7cdba4-a331-4d33-99d0-3340238abb6d",
      "page_title": "현장관리자_협력업체 관리",
      "keywords": ["vendor-management", "vendor", "협력업체", "거래처", "구분"],
      "paths": ["vendor", "vendors"]
    },
    {
      "page_id": "da78a684-9202-44b9-837c-bbfdcc2a5af9",
      "page_title": "현장관리자_건물·입주자 관리",
      "keywords": ["building-list", "building", "건물", "호실", "입주자", "입주민"],
      "paths": ["building", "buildings"]
    },
    {
      "page_id": "58325ff2-e84d-4768-8e8a-8c5e849a6cdd",
      "page_title": "현장관리자_프로필_계정·직원",
      "keywords": ["staff-management", "staff", "계정", "권한", "직원"],
      "paths": ["staff", "account", "accounts"]
    }
  ]
}
```
(로그인/p0 등 불확실한 매핑은 시드에 넣지 않는다 — Task 5 백필 미리보기에서 "애매"로 떠서 사용자 확인 후 학습된다.)

- [ ] **Step 2: JSON 파싱·UUID 형식 검증**

Run:
```bash
node -e "const j=require('./.claude/skills/wbs-commit-sync/map.json'); if(!Array.isArray(j.rules)||j.rules.length<3) throw new Error('rules'); j.rules.forEach(r=>{ if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.page_id)) throw new Error('bad uuid: '+r.page_title); if(!r.keywords.length) throw new Error('no keywords: '+r.page_title); }); console.log('OK rules', j.rules.length)"
```
Expected: `OK rules 3`

- [ ] **Step 3: 라이브 페이지 존재 확인**

MCP `list_pages`(bucket_id=`9514ec1f-cb2d-4cfa-9ee6-6aff04127c73`) 호출 → `map.json`의 세 `page_id`가 결과에 존재하고 `title`이 `page_title`과 일치하는지 확인.
Expected: 세 건 모두 존재·일치.
- `4d7cdba4-…` = 현장관리자_협력업체 관리
- `da78a684-…` = 현장관리자_건물·입주자 관리
- `58325ff2-…` = 현장관리자_프로필_계정·직원

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/wbs-commit-sync/map.json
git commit -m "feat(wbs): wbs-commit-sync 시드 매핑(map.json)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: SKILL.md — 읽기 전용 엔진(절차 A: 수집·매칭·미리보기)

**Files:**
- Create: `.claude/skills/wbs-commit-sync/SKILL.md`

**Interfaces:**
- Consumes: `config.json`(Task 1), `map.json`(Task 2).
- Produces: **절차 A** — 읽기 전용. `git log`로 커밋 수집 → 신호 추출 → `map.json`+의미대조로 매칭 → `커밋→화면|판정(고신뢰/애매/스킵)|제안 dev_status|remarks 요약` 미리보기 표. 어떤 쓰기도 하지 않는다. Task 4가 이 표를 입력으로 쓰기(절차 B)를 붙인다.

- [ ] **Step 1: SKILL.md 작성(프론트매터 + 절대규칙 + 절차 A)**

파일 `.claude/skills/wbs-commit-sync/SKILL.md`:
````markdown
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
- 읽기: `list_buckets`, `list_pages(bucket_id)`, `get_project_status(bucket_id)`, `get_page(page_id)`
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
````

- [ ] **Step 2: 프론트매터·MCP 참조 정합성 검증**

Run:
```bash
node -e "const fs=require('fs'); const t=fs.readFileSync('./.claude/skills/wbs-commit-sync/SKILL.md','utf8'); if(!/^---[\s\S]*name:\s*wbs-commit-sync[\s\S]*---/.test(t)) throw new Error('frontmatter'); ['design_status','design_target','pub_status','pub_target'].forEach(f=>{ if(t.includes('update_page_wbs('+f)) throw new Error('writes forbidden track: '+f); }); if(!t.includes('절차 A')) throw new Error('missing 절차 A'); console.log('OK')"
```
Expected: `OK` (프론트매터 존재 + 금지 트랙 쓰기 언급 없음 + 절차 A 존재)

- [ ] **Step 3: 읽기 전용 드라이런 (핵심 검증)**

절차 A를 **최근 커밋들**(예: `git log --oneline -8`)에 대해 실행하여 미리보기 표를 만든다.
사용 도구: `git show …`(읽기), `list_buckets`/`get_project_status`(읽기)만. **`update_*` 절대 호출 금지.**
Expected(현재 이력 기준 기대 판정):
- `feat(...) vendor-management …` → **현장관리자_협력업체 관리** · 고신뢰 · 제안 dev_status=`진행중`
- `feat(...) building-list …` → **현장관리자_건물·입주자 관리** · 고신뢰 · `진행중`
- `docs(...) …(staff-management) 설계 스펙` → **스킵**(docs, 화면 구현 아님)
- 다중 영역 `fix(...)` 커밋 중 최소 1건 → **애매**(후보 제시 대상)
검증 포인트: (1) vendor/building이 시드 페이지에 고신뢰로 붙음, (2) docs 커밋은 스킵, (3) `update_*` 호출 0건.

- [ ] **Step 4: 버킷 잠금 가드 검증 (spec §11)**

`config.json`의 `bucket_id`를 임시로 틀린 값(예: `00000000-0000-0000-0000-000000000000`)으로 바꾼 뒤 절차 A의 1단계(가드)만 실행한다.
Expected: `list_buckets` 결과에 그 id가 없어 **중단**되고 사용자에게 알림. 확인 후 `bucket_id`를 원래 값(`9514ec1f-…`)으로 원복한다.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/wbs-commit-sync/SKILL.md
git commit -m "feat(wbs): wbs-commit-sync 읽기전용 엔진(절차 A)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: SKILL.md — 쓰기 경로(절차 B) + 단일 화면 검증

**Files:**
- Modify: `.claude/skills/wbs-commit-sync/SKILL.md` (절차 B·멱등성 섹션 추가)

**Interfaces:**
- Consumes: 절차 A의 미리보기(Task 3).
- Produces: **절차 B** — 고신뢰 항목을 반영. `dev_status` `예정→진행중`(다운그레이드/완료자동 금지), `remarks` 자동 블록 갱신(사람 글 보존), 화면별 `update_page_wbs`(동일 값 다건은 `update_pages_wbs`), `.wbs/state.json` 워터마크 갱신. 멱등(재실행 시 변경 0건).

- [ ] **Step 1: SKILL.md에 절차 B·멱등성 섹션 추가(파일 끝에 append)**

`.claude/skills/wbs-commit-sync/SKILL.md` 끝에 아래 내용을 추가한다:
````markdown

## 절차 B — 반영 (쓰기)
절차 A로 미리보기를 만든 뒤 **고신뢰 항목만** 반영한다.

1. **애매 항목 질문**: `config.ask_when_ambiguous`가 true면, "애매" 목록의 각 커밋에 대해 상위 후보 화면을 제시하고 사용자 선택을 받는다. 선택 결과를 `map.json`에 규칙으로 추가한다(keywords = 그 커밋의 대표 신호, page_id/page_title = 선택 화면).
2. **현재 상태 읽기(멱등)**: 대상 화면들의 현재 `dev_status`는 `get_project_status(bucket_id)`에서, `remarks`는 `get_page(page_id)`에서 읽는다.
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
````

- [ ] **Step 2: SKILL.md 정합성 재검증(금지 트랙 미기입)**

Run:
```bash
node -e "const t=require('fs').readFileSync('./.claude/skills/wbs-commit-sync/SKILL.md','utf8'); if(!t.includes('절차 B')) throw new Error('missing 절차 B'); if(!t.includes('다운그레이드')) throw new Error('missing no-downgrade'); ['design_status','pub_status','design_target','pub_target'].forEach(f=>{ if(new RegExp('update_page_wbs\\\\([^)]*'+f).test(t)) throw new Error('forbidden write: '+f); }); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: 단일 화면 쓰기 검증 (실 데이터, 고신뢰 1건만)**

vendor 커밋 1건에 대해 절차 A→B를 **협력업체 관리 화면에만** 실행한다.
1. 사전 상태: `get_project_status(bucket_id)`로 `현장관리자_협력업체 관리`의 현재 `dev_status` 기록.
2. 절차 B 실행 → `update_page_wbs(page_id=4d7cdba4-…, dev_status='진행중'(현재 예정일 때만), remarks=<자동 블록>)`.
3. 사후 확인: `get_project_status`로 재조회.
Expected:
- `dev_status`가 `진행중`(사전이 `예정`이었으면 전환, 이미 `진행중`/`완료`였으면 그대로).
- `get_page(4d7cdba4-…)`의 `remarks`에 `—— [자동 동기화] ——` 블록 존재.

- [ ] **Step 4: remarks 사람 글 보존 검증**

1. 테스트로 사람 remark 주입: `update_page_wbs(page_id=4d7cdba4-…, remarks='사람메모: 확정 대기')`.
2. 절차 B 재실행(같은 화면).
3. `get_page(4d7cdba4-…)` 확인.
Expected: `remarks`가 `사람메모: 확정 대기` + 개행 + `—— [자동 동기화] ——` 블록 형태. 사람 텍스트가 마커 위에 보존됨.

- [ ] **Step 5: 멱등성 검증**

같은 화면 대상 절차 A→B를 한 번 더 실행.
Expected: 변경 0건 리포트(상태 그대로, remarks 자동 블록 동일).

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/wbs-commit-sync/SKILL.md
git commit -m "feat(wbs): wbs-commit-sync 쓰기 경로(절차 B)+멱등

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 트리거 + CLAUDE.md 규칙 + 전체 백필 실행

**Files:**
- Modify: `.claude/skills/wbs-commit-sync/SKILL.md` (트리거·백필 섹션 추가)
- Modify: `CLAUDE.md` (커밋 후 동기화 규칙 1줄)
- Modify: `.claude/skills/wbs-commit-sync/map.json` (백필 중 확정된 규칙 학습)

**Interfaces:**
- Consumes: 절차 A(Task 3)·절차 B(Task 4).
- Produces: 3종 트리거 문서화 + 커밋 후 자동 동기화 규칙 + 실제 백필로 WBS를 현재 이력과 동기화, 워터마크 최초 세팅.

- [ ] **Step 1: SKILL.md에 트리거·백필 섹션 추가(파일 끝에 append)**

`.claude/skills/wbs-commit-sync/SKILL.md` 끝에 추가:
````markdown

## 트리거
- **요청 시**: 사용자가 "WBS 동기화"라고 하면 절차 A→B 실행.
- **내 커밋 직후**: `CLAUDE.md` 규칙에 따라, 세션에서 커밋을 만든 직후 그 커밋을 절차 A→B로 동기화한다.
- **주기적**: 활성 세션에서 `/loop`로 절차 A→B를 반복. 클라우드 헤드리스 cron은 이 MCP가 미연결일 수 있으므로 **세션 내 loop 또는 요청 시**를 1차로 권장.

## 백필 (최초 1회)
`.wbs/state.json`이 없으면 절차 A를 **전체 이력**에 적용해 미리보기만 만들고, 사용자 승인 후 절차 B로 반영한다. 애매 항목은 이 단계에서 함께 질문·확정하여 `map.json`을 채운다.
````

- [ ] **Step 2: CLAUDE.md에 규칙 추가**

`CLAUDE.md`는 현재 `@AGENTS.md` 한 줄만 있다. 그 아래에 추가:
```markdown

## WBS 동기화 규칙
커밋을 만든 직후, 그 커밋이 건드린 화면을 `wbs-commit-sync` 스킬로 동기화한다(고신뢰 자동 반영, 애매하면 질문). **주택관리ERP 버킷만** 대상이며, 개발 트랙(dev)만 갱신하고 `완료`는 자동으로 바꾸지 않는다.
```

- [ ] **Step 3: SKILL.md 트리거 섹션 검증**

Run:
```bash
node -e "const t=require('fs').readFileSync('./.claude/skills/wbs-commit-sync/SKILL.md','utf8'); ['요청 시','내 커밋 직후','주기적','백필'].forEach(k=>{ if(!t.includes(k)) throw new Error('missing: '+k); }); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 4: CLAUDE.md 규칙 검증**

Run:
```bash
node -e "const t=require('fs').readFileSync('./CLAUDE.md','utf8'); if(!t.includes('@AGENTS.md')) throw new Error('lost @AGENTS.md include'); if(!t.includes('wbs-commit-sync')) throw new Error('missing rule'); console.log('OK')"
```
Expected: `OK` (기존 `@AGENTS.md` 인클루드 유지 + 규칙 추가됨)

- [ ] **Step 5: 전체 백필 실행(미리보기→승인→반영)**

`.wbs/state.json`이 없는 상태에서 절차 A를 **전체 이력**(`git log --oneline`)에 적용 → 미리보기 표 제시 → 사용자 승인 → 절차 B 반영.
- 애매 커밋(예: p0 auth/login, 다중영역 fix)은 후보 제시 후 사용자 확정 → `map.json`에 학습.
- 반영 후 `.wbs/state.json` 워터마크를 HEAD로 세팅.

- [ ] **Step 6: 백필 결과 + 멱등 검증**

Run/확인:
- `get_project_status(bucket_id)` → vendor/building(및 확정된 화면)들이 `진행중`, 각 `remarks`에 자동 블록.
- `node -e "const s=require('./.wbs/state.json'); if(!s.last_synced_sha) throw new Error('watermark'); console.log('watermark', s.last_synced_sha)"` → HEAD sha 출력.
- 절차 A→B 재실행 → **변경 0건**.
Expected: 위 3가지 모두 충족.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/wbs-commit-sync/SKILL.md CLAUDE.md .claude/skills/wbs-commit-sync/map.json
git commit -m "feat(wbs): wbs-commit-sync 트리거+CLAUDE.md 규칙, 백필 반영

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
(주의: `.wbs/state.json`은 gitignore 대상이라 커밋되지 않는다.)

---

## 참고: 실행 순서·안전
- Task 3까지는 **읽기 전용**이라 WBS에 영향 없음. 첫 쓰기는 Task 4의 단일 화면 검증부터.
- 모든 쓰기 전 버킷 잠금 가드가 선행되어야 한다(절차 A 1단계).
- Task 4·5의 검증은 실제 주택관리ERP 데이터를 갱신한다(사용자가 승인한 고신뢰 자동 반영 동작). 다른 버킷은 절대 대상 아님.

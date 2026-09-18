# 개인정보 보호 트랙 (공개링크 30일 · 연락처 마스킹 · 열람 로깅)

- 2026-09-18 작업. **구현은 전부 끝났고 커밋됨. 마이그레이션 적용과 master 병합만 남음.**
- 발단: 개인정보 보안 현황 점검 → 약점 7건 도출 → 사용자가 **4·5·6번만** 착수 지시.

## 1. 확정 방침 (재논의 불필요)

| # | 항목 | 방침 |
|---|---|---|
| 4 | 무로그인 공개 링크 | **발급일 + 30일** (고지서 HMAC 링크, 공지·정산 공유 토큰) |
| 5 | 연락처 마스킹 | **목록만 서버 마스킹**, 단건 상세는 UI 마스킹, [원문]은 서버 권한검증 + 감사 기록 |
| 6 | 열람 로깅 | **민감 이벤트만** (원문 보기·반출·인쇄·발송·공개링크 접근). 목록 조회는 기록 안 함 |

### 마스킹 판단 3축

마스킹의 목적은 "직원에게 숨기기"가 아니라 **한 번에 많이 퍼가는 표면 줄이기**다.

1. **누구 번호인가** — 제3자(입주자·민원인·거래처)만. org 소유 발신번호는 법인 자산이라 제외.
2. **읽기냐 입력이냐** — 편집 폼 input 제외. 마스킹된 값이 저장되면 DB에 `010-****-5678`이 들어가 **데이터가 파괴**된다.
3. **한 번에 몇 건인가** — 목록·표·엑셀이 유출 표면. 단건 상세는 정당한 업무 열람.

| 위치 | 처리 |
|---|---|
| 목록·표·집계 / 단건 상세 읽기 / 발송 이력 | 마스킹 + [원문] |
| 편집 폼 input | **원문** (마스킹 저장 = 데이터 파괴) |
| org 발신번호 · 본인 정보 · 발송 직전 확인 화면 | **원문** |
| 엑셀·인쇄물·고지서·지로·팩스 | **원문** (반출 자체를 로깅) |

대상 필드는 **휴대폰·전화·팩스만**. 계좌번호·예금주·입주자명·차량번호는 범위에서 제외됨.
`lib/privacy/mask.ts`와 SQL `mask_phone()`은 확장 가능하게 만들어 뒀다.

## 2. 구현 상태 — 전부 커밋 완료

| 단계 | 내용 | 커밋 | 브랜치 |
|---|---|---|---|
| A | `access_log` + `lib/audit/accessLog.ts` (마이그 0174) | `b6596ae0` | **이미 origin/master** |
| B | 공개링크 30일 + 공개 조회 로깅 (마이그 0175) | `c539bd2c` | `PracLee/discus` |
| B' | 배포 순서 안전장치 | `8967dede` | `PracLee/discus` |
| C1 | 마스킹 유틸 · `/api/pii/reveal` · `MaskedPhone` | `e324a78e` | `PracLee/triggerfish` |
| C2 | 마스킹 롤아웃 (마이그 0176) | `3d6f23e9` | `PracLee/triggerfish` |
| D | 민감 이벤트 로깅 + 0176 헬퍼 단일화 | `3b8ce7bd` | `PracLee/triggerfish` |

검증: 전 단계 `tsc --noEmit` 0 에러, eslint clean. 빌드·E2E는 미수행.

### 브랜치가 둘로 나뉜 이유

처음 `discus`를 유휴로 판단해 A·B를 거기서 했는데 **다른 세션이 동시에 쓰던 워크트리**였다.
그 세션이 master로 머지하면서 커밋 A가 같이 올라갔다. 이후 C·D는 유휴였던 `triggerfish`로 옮겼다.
→ 월요일에 전용 워크트리를 하나 만들어 모으는 걸 권장한다. 워크트리 생성은 사용자(Orca) 몫이다.

## 3. ⚠️ 마스킹 보장 수준 — 화면마다 다르다

"목록만 서버 마스킹"이 **staff 목록에는 대부분 적용되지 못했다.** payload가 발송·편집·엑셀과
공유돼서 서버에서 자르면 그 기능들이 깨지기 때문이다.

**서버 마스킹 성공** (원문이 브라우저에 아예 안 내려감) — 마이그 0176:
`partner_search_tenants`, `partner_list_building_vendors`, `list_message_logs`, `list_occupancy_history`

**UI 마스킹에 그침** (응답에는 원문이 있어 개발자도구로 보임). 괄호 안이 원문을 요구하는 소비자:
직원 계정 목록(편집·발송) · 입주자 목록(발송·편집·정산·입주자카드) · 건물 소유주 목록(엑셀) ·
민원 목록(편집·발송·CSV·인쇄) · 미납 목록(발송·반출·인쇄) · 거래처 목록(편집) ·
수납 검색(수납이력 발송·고지서 출력) · 통합관리자 계정 목록(편집) · 예약 발송 목록(예약 수정·취소)

즉 **대량 수집을 실제로 막는 효과는 파트너 화면과 이력 화면에만** 생겼다. 나머지까지 서버로
내리려면 payload를 읽기용/작업용으로 분리하는 별도 작업이 필요하다. **이건 제품 판단거리다.**

## 4. 남은 일 — 마이그 적용 → 스모크 → 병합

### 4-1. 왜 내가 못 했나

프로덕션 DB 쓰기가 **Claude Code auto 모드 분류기에 차단**됐다(2회 시도 후 중단).
Supabase MCP는 **무관한 다른 프로젝트**(`ggymsdimvuvtowmmatps`, 미술품 마켓)만 붙어 있어
쓰면 엉뚱한 라이브 DB를 건드리게 되므로 쓰지 않았다.
읽기 전용 점검은 통과했고, 라이브 상태는 **0174·0175·0176 전부 미적용**으로 확인했다.

### 4-2. ⚠️ 순서를 반드시 지킬 것

**마이그 적용 전에 C·D를 master로 병합하지 말 것.**
`access_log`가 없으면 `logAccess`가 실패하고 `/api/pii/reveal`은 **fail-closed 설계라 503**을 낸다.
직원이 [원문]을 눌러도 연락처를 못 봐서 업무가 막힌다. 병합 = Amplify 프로덕션 자동 배포다.

B(공개링크)만은 예외적으로 안전하다. `8967dede`에서 `issued_day`가 없으면 URL에 `d`를 안 붙이고
검증기의 4-arg 레거시 경로를 타게 해뒀다. 코드가 먼저 배포돼도 현행 동작을 유지한다.

### 4-3. 적용 명령 (프롬프트에 `!` 붙여 직접 실행)

`scripts/db-query.mjs`에 ref 가드가 있다. 프로젝트 ref가 `amhtprmapxlizdnsgbeg`가 아니면 중단한다.
출력이 `[]`면 성공이다. **아래 순서대로**:

```
! cd C:/Users/leebj/orca/projects/home_erp && node --env-file=.env.local scripts/db-query.mjs supabase/migrations/0174_pii_access_log.sql

! cd C:/Users/leebj/orca/workspaces/home_erp/discus && node --env-file=C:/Users/leebj/orca/projects/home_erp/.env.local C:/Users/leebj/orca/projects/home_erp/scripts/db-query.mjs supabase/migrations/0175_public_link_30d.sql

! cd C:/Users/leebj/orca/workspaces/home_erp/triggerfish && node --env-file=C:/Users/leebj/orca/projects/home_erp/.env.local C:/Users/leebj/orca/projects/home_erp/scripts/db-query.mjs supabase/migrations/0176_list_phone_masking.sql
```

(0174는 master에 이미 있고, `scripts/db-query.mjs`는 이 브랜치에서 추가됐다.
병합 전에는 master 체크아웃에 없으니 위처럼 절대경로로 호출한다.)

### 4-4. 적용 후 확인

1. **PostgREST 오버로드** — 0175가 `public_bill_by_signed`를 4-arg/5-arg 두 개로 만든다.
   PostgREST는 인수 **이름 집합**으로 함수를 고르는데 모호하면 `PGRST203`이 난다. DB 없이는 검증 불가.
   → **레거시 링크(`?s=...`, `d` 없음)**와 **신규 링크(`?s=...&d=...`)** 각 1건을 실제로 열어볼 것.
2. **[원문] 버튼** — 사무실 직원·현장 파트너로 각각 눌러보고, 파트너가 **담당 건물 밖** 입주자는
   못 여는지(RLS) 확인.
3. **감사 행 적재** — `select * from access_log order by id desc limit 5`.
4. **업무 무회귀** — 편집 폼 저장 / 발신번호 설정 / 발송 직전 확인 화면 / 고지서·지로 인쇄 /
   팩스 / 엑셀 6종 / 세입자 본인 정보 / 파트너 본인 프로필에 마스킹이 새지 않았는지.
   (코드상 무변경은 확인했고, 실제 화면 확인이 남았다.)

### 4-5. 병합

마이그 적용·스모크가 끝나면:
`git -C C:/Users/leebj/orca/projects/home_erp merge --no-ff PracLee/triggerfish` → push.
`discus`의 B는 그 세션이 머지하거나, 전용 워크트리로 cherry-pick해서 정리한다.

## 5. 미결 정책 (사용자 결정 필요)

- **감사 로그 보존기간** — 미정. 개인정보보호법상 접속기록 최소 1년(규모에 따라 2년). purge 잡 없음.
  `access_log.created_at` 인덱스는 미리 깔아 뒀다.
- **UI 마스킹에 그친 목록을 서버까지 내릴지** — 3절 참고. payload 분리 작업이 필요하다.
- **계좌번호·예금주·입주자명·차량번호 마스킹** — 이번 범위에서 제외됨.

## 6. 작업 환경 함정

- **워크트리엔 node_modules가 없다.** master 것을 정션 연결해서 쓴다:
  `New-Item -ItemType Junction -Path <worktree>\node_modules -Target C:\Users\leebj\orca\projects\home_erp\node_modules`
  검증은 `node ./node_modules/typescript/bin/tsc --noEmit` (npm run·npx는 전역으로 끌려가 실패).
  **`rm -rf`로 지우면 master의 실제 node_modules가 날아간다.** 지울 땐 `cmd //c "rmdir node_modules"`.
- 이번 세션에서 **정션이 호출 사이에 반복적으로 사라졌다.** 다른 세션이 같은 워크트리에서
  정션을 만들고 지우기 때문으로 보인다. → Codex 위임 시 **정션 생성을 같은 명령에 묶고**,
  프롬프트에 "정션을 절대 삭제·재생성하지 말라"를 넣을 것.
- `triggerfish`의 `_notes/`는 **다른 사람 것**이다. 건드리지 말 것.
- Codex 위임 프롬프트에 큰따옴표를 넣지 말 것(argv 인코딩). heredoc + stdin으로 넘길 것.

## 7. 재개 프롬프트 (복사해서 붙여넣기)

```
docs/superpowers/plans/2026-09-18-pii-privacy-track.md 를 읽고 개인정보 보호 트랙을 마무리해줘.

구현(A~D)은 전부 커밋돼 있고, 남은 건 마이그 적용 → 스모크 → master 병합이다.
마이그 0174·0175·0176은 전부 DB 미적용이고, 프로덕션 DB 쓰기는 네 권한으로 막히니
문서 4-3절 명령을 내가 ! 로 직접 실행하겠다. 실행할 명령을 하나씩 알려줘.

적용이 끝나면:
1. 문서 4-4절 확인 항목을 SQL 인트로스펙션으로 검증할 수 있는 건 네가 검증해줘.
2. 내가 브라우저로 확인해야 하는 건 URL과 클릭 순서로 정리해줘.
3. 문제 없으면 PracLee/triggerfish 를 master로 병합·push 해줘.
4. PracLee/discus 에 있는 B 커밋(c539bd2c·8967dede)도 정리 방법을 제안해줘.

문서 3절의 "UI 마스킹에 그친 목록"을 서버까지 내릴지는 아직 미결이다. 지금 하라는 말은 아니고,
비용과 방법만 정리해서 보여줘.
```

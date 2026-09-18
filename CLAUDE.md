@AGENTS.md

## 프로젝트 구조 및 경로 가이드

작업을 시작할 때는 요청된 사용자 유형과 도메인에 해당하는 대표 경로부터 확인한다. 아래 경로는 전체 파일 목록이 아니라, 각 작업의 시작점을 찾기 위한 안내다.

### 사용자 유형별 화면 영역

- `app/(staff)/staff/(app)/`: 관리사무소 직원용 내부 화면. 건물, 입주자, 고지서, 수납, 메시지 등 업무 기능이 위치한다.
- `app/(resident)/resident/(app)/`: 입주민용 모바일 화면. 홈, 고지서, 공지, 내 정보, 알림 등이 위치한다.
- `app/(partner)/partner/(app)/`: 협력업체·현장 담당자용 화면. 건물, 세대, 검침, AS, 이사정산 등이 위치한다.
- `app/(platform-admin)/platform-admin/(app)/`: 플랫폼 운영자용 화면. 계정, 조직, 포인트, 청구, 플랫폼 설정 등이 위치한다.

`(staff)`, `(resident)`, `(partner)`, `(platform-admin)`처럼 괄호로 감싼 폴더는 Next.js route group이며 실제 URL에는 포함되지 않는다. 각 화면의 `page.tsx`가 라우트 진입점이고, `layout.tsx`는 해당 영역의 공통 레이아웃이다.

### 공용 코드 및 도메인 로직

- `components/common/`: 여러 화면에서 재사용하는 기본 UI 컴포넌트
- `components/shell/`: Sidebar, Topbar, PageHeader 등 앱 공통 외곽 레이아웃
- `components/forms/schema/`: 폼 검증 스키마
- `app/*/_components/`: 특정 사용자 유형 또는 화면 영역에서만 사용하는 공용 컴포넌트
- `lib/auth/`, `lib/supabase/`: 인증, 권한, Supabase 접근 및 세션 처리
- `lib/billing/`, `lib/bill/`: 청구 계산, 고지서 데이터 및 출력 문서 처리
- `lib/messaging/`, `lib/messenger/`, `lib/popbill/`: 메시지 작성·발송, 메신저 상태, Popbill 연동
- `supabase/migrations/`: 데이터베이스 스키마 및 함수 변경
- `supabase/verify/`, `supabase/tests/`: 데이터베이스 검증 및 테스트
- `docs/superpowers/specs/`, `docs/superpowers/plans/`: 도메인 설계 문서와 구현 계획

### 작업별 첫 탐색 위치

- 화면 수정: 해당 사용자 유형의 `app/.../(app)/` 아래 도메인 폴더의 `page.tsx`와 `components/`부터 확인한다.
- 공통 UI 수정: `components/common/`과 `components/shell/`을 먼저 확인해 기존 컴포넌트를 재사용한다.
- 서버 데이터·API 수정: 해당 화면의 `data.ts` 또는 API 호출부를 확인한 뒤 관련 `lib/<domain>/`을 확인한다.
- DB 변경: `supabase/migrations/`에 새 migration을 추가하고 관련 `supabase/verify/` 또는 `supabase/tests/`를 확인한다.

화면 폴더의 `loading.tsx`는 로딩 UI, `data.ts`는 화면 데이터 조회·변환, `*Classes.ts`는 Tailwind 클래스 조합을 담당하는 경우가 많다. 단, 실제 책임은 작업 대상 파일의 구현을 우선해서 판단한다.

### 경로 가이드 유지 규칙

- 이 문서는 전체 파일 목록이 아니라 주요 진입 경로와 디렉터리 역할만 기록한다.
- 새로운 사용자 유형·도메인·최상위 공용 디렉터리가 추가되거나 기존 구조가 변경될 때만 갱신한다.
- 일회성 기능 파일이나 세부 파일 목록은 이 문서에 추가하지 않는다.
- 경로 설명이 실제 코드와 다를 경우 실제 코드 구조를 우선하고 이 문서를 갱신한다.

## 퍼블리싱 시 공용 컴포넌트 우선 사용
화면을 퍼블리싱하거나 UI를 수정할 때는 **Tailwind CSS로 구현**하고, 기존 공용 컴포넌트를 먼저 확인해 우선 재사용한다. 동일하거나 유사한 UI를 페이지 내부에 중복 구현하지 말고, 필요한 경우 기존 공용 컴포넌트의 props나 variant를 확장한다. 새 컴포넌트가 여러 화면에서 재사용될 수 있다면 페이지 전용으로 만들지 말고 공용 컴포넌트로 구현한다.

## API 서버 상태는 React Query 우선 사용
API에서 가져오거나 변경하는 서버 상태는 **`@tanstack/react-query`를 단일 기준으로 사용**한다. 조회는 `useQuery`, 변경은 `useMutation`을 우선 사용하고, API 응답을 컴포넌트의 `useState`·`useEffect`나 별도 전역 스토어에 중복 저장하지 않는다. API 모듈은 HTTP 요청 함수만 담당하고, 캐시·로딩·에러·재조회·동기화는 React Query에서 관리한다. 동일한 데이터의 API 호출이나 Query가 중복되어 있다면 공용 query key와 query hook으로 통합하며, mutation 이후에는 필요한 캐시를 갱신하거나 무효화한다. 화면 표시만을 위한 로컬 UI 상태는 컴포넌트 상태로 관리할 수 있다.

## Codex 우선 위임 (토큰 절감·빠른 개발)
무거운 컨텍스트 작업은 **codex CLI(headless 워커)에 우선 위임**해 Claude 컨텍스트를 가볍게 유지한다. Claude=오케스트레이터, codex=워커.

- **codex에 넘길 것**: 대량 파일 읽기·분석(탐색), 파일 작성·수정(구현), `tsc`/`lint`/`build` 실행·반복. 결과는 요약/디프로만 회수한다.
- **Claude가 직접**: 오케스트레이션, 최종 판단·설계, 디프 리뷰, git 커밋, 의존성 설치(`npm install`). ← codex는 샌드박스라 git·네트워크 불가.
- **검증된 실행법**(이 외 방식은 hang 위험): `"" | codex exec -s <read-only|workspace-write> -c approval_policy="never" '<프롬프트>'`. 파일 쓰면 `workspace-write`, 읽기 전용이면 `read-only`. 빈 stdin 파이프로 즉시 EOF가 필수이며, `codex exec`엔 `-a`가 없고 `--dangerously-bypass-approvals-and-sandbox`는 쓰지 않는다.
- **가드레일**: 한두 줄짜리 사소한 편집은 위임 오버헤드(기동 ~11s·~16k토큰)가 더 크므로 Claude가 직접 처리한다. 위임 결과는 커밋 전 반드시 Claude가 리뷰한다.
- 유용 플래그: `-C <dir>`(워크트리별 워크루트), `--output-last-message <file>`(결과 회수), `--json`(진행 스트림).

## WBS 동기화 규칙
커밋을 만든 직후, 그 커밋이 건드린 화면을 `wbs-commit-sync` 스킬로 동기화한다(고신뢰 자동 반영, 애매하면 질문). **주택관리ERP 버킷만** 대상이며, 개발 트랙(dev)만 갱신하고 `완료`는 자동으로 바꾸지 않는다.

## 워크트리 작업 완료 → master 병합
워크트리 브랜치(`PracLee/<name>`, `orca/workspaces/home_erp/<name>`)에서 작업할 때는 **사용자에게 완료 보고를 하기 전에 master 병합·push까지 끝내놓는다.** "로컬 마스터로 병합해줘"라는 지시를 기다리지 않는다. dev 서버는 master 체크아웃(`orca/projects/home_erp`, localhost:3000)에서만 돌기 때문에, 병합 전에는 사용자가 결과를 눈으로 확인할 수 없다.

- **병합 조건**(전부 충족해야 병합): 요청 범위 구현 완료 + 커밋됨 + `tsc --noEmit`·lint 통과 + Claude 디프 리뷰 완료. 하나라도 미달이면 병합하지 말고 그 사실을 보고한다.
- **워크트리 검증법**: 워크트리엔 node_modules가 없다. master 것을 정션 연결해 쓴다 — `New-Item -ItemType Junction -Path <worktree>\node_modules -Target C:\Users\leebj\orca\projects\home_erp\node_modules` → `node ./node_modules/typescript/bin/tsc --noEmit`(`npm run`·`npx`는 전역으로 끌려가 실패) → **끝나면 반드시 제거**(`cmd /c rmdir node_modules`, Git Bash에선 `cmd //c "rmdir node_modules"`). 정션을 남긴 채 워크트리에서 `npm install` 하면 master의 node_modules를 덮어쓴다. 정션은 검증 전용이며 `next dev` 실행용이 아니다.
- **절차**: ① `git fetch` ② 마이그레이션을 추가했으면 `git ls-tree origin/master supabase/migrations/`로 번호 재확인(병렬 세션이 선점했을 수 있다) ③ master 체크아웃에서 병합 — `git -C C:/Users/leebj/orca/projects/home_erp merge --no-ff PracLee/<name> -m "Merge PracLee/<name>: <요약>"` ④ `git push origin master` ⑤ 서버 처리(아래) ⑥ 병합 커밋 해시와 **확인할 URL**(`http://localhost:3000/...`)을 함께 보고한다.
- **서버**: 소스 변경만이면 Turbopack HMR이 자동 반영하므로 서버를 건드리지 않는다. `next.config*`·`package.json`·`.env*`·`proxy.ts`처럼 재시작이 필요한 변경일 때만 dev 서버를 재시작하고 그 사실을 보고한다.
- **멈추고 물어볼 때**: 검증 실패, 병합 충돌, 다른 세션의 미커밋 변경 때문에 merge가 거부될 때. ⚠️ master는 여러 세션이 공유하는 라이브 트리다 — `git checkout -- .`·`git restore`·`git reset --hard` 같은 블랭킷 되돌리기 금지, 커밋은 내가 만든 파일만 `git add`로 스테이징한다.
- **경계**: 워크트리 생성·삭제는 사용자(Orca) 몫이다. Claude는 `git worktree add`로 새로 만들지 않고, 병합 후 워크트리·브랜치도 지우지 않는다. 작업이 아직 중간 단계이거나 사용자가 병합하지 말라고 했으면 이 규칙을 적용하지 않는다.

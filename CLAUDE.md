@AGENTS.md

## 프로젝트 구조 및 경로 가이드

작업을 시작할 때는 요청된 사용자 유형과 도메인에 해당하는 대표 경로부터 확인한다. 아래 경로는 전체 파일 목록이 아니라, 각 작업의 시작점을 찾기 위한 안내다.

### 사용자 유형별 화면 영역

- `app/(staff)/staff/(app)/`: 관리사무소 직원용 내부 화면. 건물, 입주자, 고지서, 수납, 메시지 등 업무 기능이 위치한다.
- `app/(resident)/resident/(app)/`: 입주민용 모바일 화면. 홈, 고지서, 공지, 내 정보, 알림 등이 위치한다.
- `app/(resident)/share/`: 로그인 없이 여는 공개 공유 링크(공지·정산·고지서). proxy matcher 밖이라 인증을 거치지 않는다.
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
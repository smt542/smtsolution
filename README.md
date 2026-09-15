# 관리비서 (home_erp)

주택·건물 관리비 통합 관리 ERP.

관리비 부과·고지서 발행부터 수납·미납 관리, 공과금 검침, 문자·알림톡·팩스 발송, 세입자 모바일 앱, 현장 파트너 앱, 통합관리자(HQ) 콘솔까지 건물관리 업무 전반을 하나의 플랫폼에서 처리한다.

기존 레거시 시스템을 Next.js + Supabase 기반으로 현대화한 프로젝트다.

---

## 서비스 구성

서비스는 4개 사용자군을 기준으로 구성한다.


| 페르소나      | 경로                  | 설명                              |
| --------- | ------------------- | ------------------------------- |
| 사무실 관리자   | `/staff/*`          | 관리비 부과·고지·수납·미납·공과금·발송 등 핵심 ERP |
| 세입자       | `/resident/*`       | 관리비 내역·공지·정산 확인, 퇴실 신청 등 모바일 웹  |
| 현장 파트너    | `/partner/*`        | 현장 담당자용 A/S·검침·조회 모바일 웹         |
| 통합관리자(HQ) | `/platform-admin/*` | 테넌트·계정·포인트·청구·설정 관리 콘솔          |


루트 `/`는 공개 마케팅 및 사업자정보 랜딩 페이지로 사용한다.

---

## 기술 스택

- **프레임워크**: Next.js 16 (App Router) · React 19
- **백엔드 / DB**: Supabase (`@supabase/ssr`, service role)
  - 별도 API 서버를 두지 않고 Next.js Route Handler와 Supabase를 조합한 풀스택 구조
  - 자세한 내용은 [아키텍처 결정 및 조직 프론트엔드 표준과의 차이](#아키텍처-결정-및-조직-프론트엔드-표준과의-차이) 참고
- **서버 상태**: TanStack React Query 5
  - 조회: `useQuery`
  - 변경: `useMutation`
- **폼 / 검증**: react-hook-form + zod (`@hookform/resolvers`)
- **UI**: Tailwind CSS v4 + 자체 공통 컴포넌트 (`components/common`, `components/shell`)
- **토스트**: sonner
- **외부 발송**: Popbill
  - SMS/LMS
  - 알림톡
  - 팩스
- **문서 / 출력**
  - `@react-pdf/renderer`: A4 고지서
  - tiptap: 공지 에디터
  - exceljs: Excel export
  - qrcode
- **테스트**
  - vitest + Testing Library
  - playwright 기반 픽셀 정합 하네스
- **언어 / 린트**: TypeScript 5 · ESLint 9

---

## 디렉터리 구조

```text
app/
  (staff)/staff/(app)/…        사무실 관리자 ERP
  (resident)/resident/(app)/…  세입자 모바일 앱
  (partner)/partner/(app)/…    현장 파트너 모바일 앱
  (platform-admin)/…           통합관리자 콘솔
  api/…                         서버 전용 Route Handler
  page.tsx                      공개 랜딩

hooks/
  reactquery/[도메인]/          apis · keys · queries · mutations · index
  common/                       공용 훅
                                useAppToast · useDebouncedValue · useAsyncAction …

components/
  common/                       공통 UI
                                Modal · DataTable · FormField · Badge · Pagination …
  shell/                        앱 셸
                                AppShell · Sidebar · Topbar · A/S 레일
  messenger/                    빠른 발송 FAB / 패널
  icons/
  notices/
  vendors/
  …

lib/
  supabase/                     client · server · admin · middleware
  providers/                    QueryProvider
  billing/
  payments/
  messaging/
  popbill/
  bill/
  auth/
  format/
  attachments/
  …

supabase/migrations/            번호순 SQL 마이그레이션
docs/prototype/prd/             화면별 기획 정본(PRD) — 참조 전용

```

### 컨벤션

- `page.tsx`에는 페이지 진입점과 조합 로직을 두고, 실제 화면 로직은 가능한 한 형제 `components/` 디렉터리의 컴포넌트로 분리한다.
- 서버 상태는 React Query를 단일 기준으로 관리한다.
- API 응답을 `useState` / `useEffect` 또는 별도 전역 스토어에 중복 저장하지 않는다.
- 타입은 각 도메인의 `apis.ts`에 정의하며 별도 `models/` 디렉터리는 두지 않는다.
- UI는 Tailwind CSS를 기준으로 구현한다.
- 신규 UI를 작성하기 전에 `components/common` 및 기존 도메인 공통 컴포넌트의 재사용 가능 여부를 먼저 확인한다.

---

## 개발 환경

```bash
npm install

cp .env.example .env.local
# .env.local 환경 변수 설정

npm run dev

```

개발 서버:

```text
http://localhost:3000

```

### 주요 스크립트


| 스크립트                 | 설명              |
| -------------------- | --------------- |
| `npm run dev`        | 개발 서버 실행        |
| `npm run build`      | 프로덕션 빌드         |
| `npm run start`      | 프로덕션 서버 실행      |
| `npm run lint`       | ESLint 실행       |
| `npm test`           | vitest 전체 실행    |
| `npm run test:watch` | vitest watch 모드 |


---

## 환경 변수

`.env.example`을 복사해 `.env.local`에 필요한 값을 설정한다.

`NEXT_PUBLIC_` 접두사가 없는 환경 변수는 서버 전용 값이다.  
서비스 롤 키, Popbill 인증정보, 카카오 시크릿 등은 **절대 저장소에 커밋하거나 클라이언트 번들에 노출하지 않는다.**

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Supabase 공개 연결 정보.

- `SUPABASE_SERVICE_ROLE_KEY`

서버 전용 Service Role Key.

계정 발급 스크립트, 관리자성 작업, Route Handler 등 서버 환경에서만 사용한다.

### Staff

- `NEXT_PUBLIC_STAFF_EMAIL_DOMAIN`

스태프 계정 이메일 도메인.

### Resident

- `NEXT_PUBLIC_RESIDENT_WEB_ORIGIN`

알림톡 등 외부 발송 메시지의 세입자 상세 링크 생성에 사용한다.

### Kakao

- `KAKAO_*`
- `NEXT_PUBLIC_KAKAO_LOGIN_ENABLED`

세입자 카카오 로그인 및 OAuth 연동에 사용한다.

### Popbill

- `POPBILL_*`

SMS/LMS, 알림톡, 팩스 발송에 사용한다.

Popbill 설정이 없는 환경에서는 발송 요청을 성공으로 처리하지 않는다.  
발송 경로는 `PROVIDER_NOT_CONFIGURED` 오류를 명시적으로 반환하며 fake success stub은 사용하지 않는다.

### Worker / Cron

- `CRON_SECRET`

예약 발송 워커 및 발송 결과 재조회 API 인증에 사용한다.

---

## 데이터베이스

DB 스키마는 `supabase/migrations/`의 번호순 SQL 마이그레이션으로 관리한다.

마이그레이션은 호스팅된 Supabase 프로젝트에 순서대로 적용한다.

RLS(Row Level Security)는 대상 테이블에 적용하며, 데이터 접근 정책은 조직(`org`) 스코프를 기준으로 격리한다.

---

## 배포

AWS Amplify를 사용한다.

`master` 브랜치에 반영된 변경사항은 Amplify를 통해 자동 빌드 및 배포된다.

---

## 아키텍처 결정 및 조직 프론트엔드 표준과의 차이

이 프로젝트는 `generate-frontend-projects`로 대표되는 조직 프론트엔드 표준의 주요 기술 스택과 개발 관습을 따른다.

다만 이 시스템은 다음 특성을 가진다.

- 4개의 명확한 사용자 페르소나를 가진 다중 애플리케이션 구조
- Next.js가 UI뿐 아니라 BFF 및 서버 전용 로직도 담당하는 풀스택 구조
- Supabase RLS를 중심으로 한 직접 데이터 접근
- 기존 프로토타입을 기준으로 구축된 자체 디자인 시스템
- 외부에 노출되는 OAuth·알림톡·서명 URL 등과 연결된 고정 경로

이러한 특성 때문에 일부 디렉터리 구성과 인프라 패턴은 조직의 기본 프론트엔드 템플릿과 다르게 구성되어 있다.

아래에는 유지보수 및 신규 개발 시 참고가 필요한 주요 차이를 기록한다.

### 표준과 공통으로 사용하는 구조

다음 항목은 조직 프론트엔드 표준과 동일하거나 동일한 설계 원칙을 사용한다.

- Next.js App Router
- Supabase
- TanStack React Query
- react-hook-form + zod
- sonner
- `hooks/reactquery/[도메인]/{apis,keys,queries,mutations,index}.ts` 패턴
- 타입을 각 도메인의 `apis.ts`에 정의
- `page.tsx`와 형제 `components/` 디렉터리를 함께 사용하는 화면 구조
- `lib/supabase/{client,server}.ts`
- `lib/providers/QueryProvider.tsx`
- `components/common` 기반 공통 UI
- `hooks/common` 기반 공용 훅

### 프로젝트별 아키텍처 결정


| 조직 기본 구조                                                 | 현재 프로젝트                                                             | 결정 근거                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(client)` / `(provider)` / `(admin)` 중심의 3개 Route Group | `(staff)` / `(resident)` / `(partner)` / `(platform-admin)` 4개 페르소나 | 인증·권한·레이아웃 경계가 실제 4개 사용자군과 일치한다. 일부 경로는 로그인, 외부 발송 링크, 서명 고지서 URL, 카카오 OAuth 등 외부 인터페이스에서도 사용되므로 현재 페르소나 기반 경로 구조를 유지한다.                              |
| 별도 외부 백엔드 API 호출                                         | `app/api/` Route Handler + Supabase                                 | 별도 API 서버 없이 Next.js가 BFF 역할을 담당한다. OAuth callback, Popbill 발송, Service Role 작업, 파일 export, HMAC 서명 등 브라우저에서 수행할 수 없는 서버 전용 로직을 Route Handler에서 처리한다. |
| axios 기반 HTTP Client                                     | Supabase SDK + native `fetch`                                       | 주요 데이터 접근은 Supabase SDK를 사용하며, 서버 전용 작업은 내부 Route Handler를 호출한다. 현재 통신 구조에서는 별도의 axios abstraction이 필요하지 않다.                                          |
| shadcn/ui 기반 UI                                          | 자체 Tailwind 공통 컴포넌트                                                 | 프로토타입 디자인을 기준으로 한 공통 컴포넌트 체계가 이미 구축되어 있다. 동일한 역할의 별도 UI 시스템을 병행하기보다 기존 디자인 시스템을 단일 기준으로 유지한다.                                                         |
| `app/page.tsx`에서 애플리케이션 내부 경로로 이동                        | 공개 마케팅·사업자정보 랜딩                                                     | 루트 페이지는 서비스 소개 및 사업자정보를 공개하는 외부 진입점으로 사용한다. 카카오 채널 등 외부 서비스 심사에서도 공개 페이지가 사용된다.                                                                       |
| `components/layout/{Header,Footer}`                      | `components/shell/{AppShell,Sidebar,Topbar}`                        | 관리자 ERP와 모바일 앱 등 페르소나별 내비게이션 구조가 다르기 때문에 단순 Header/Footer보다 Application Shell 단위가 현재 UI 구조에 적합하다.                                                     |


### Route Handler 사용 기준

`app/api/`는 일반적인 데이터 조회를 위한 별도 REST Backend 계층으로 사용하지 않는다.

일반 데이터 조회·변경은 가능한 범위에서 Supabase와 RLS를 통해 처리한다.

Route Handler는 다음과 같이 **서버 실행이 필요한 작업**에 사용한다.

- Supabase Service Role이 필요한 작업
- OAuth callback
- 외부 사업자 API 연동
- Popbill SMS/LMS·알림톡·팩스 발송
- HMAC 또는 서버 비밀키 기반 서명
- CSV / XLSX 등 서버 생성 파일
- 예약 작업 및 Cron endpoint
- 클라이언트에 노출해서는 안 되는 인증정보가 필요한 처리

즉, `app/api/`는 별도의 범용 Backend 계층이라기보다 Next.js 애플리케이션의 서버 경계(Server Boundary)로 취급한다.

### 데이터 접근 원칙

클라이언트에서 접근 가능한 데이터는 Supabase RLS를 기본 보안 경계로 사용한다.

```text
Client
  ↓
React Query
  ↓
Supabase Client
  ↓
RLS
  ↓
Database

```

서버 권한이 필요한 작업은 다음 경로를 사용한다.

```text
Client
  ↓
React Query
  ↓
Next.js Route Handler
  ↓
Supabase Admin / External API

```

Service Role Key 또는 외부 서비스 Secret이 브라우저로 전달되는 구조는 허용하지 않는다.

### 현재 유지 원칙

현재 구조는 조직 표준과 다른 별도의 기술 방향을 추구하기 위한 것이 아니라, 프로젝트의 사용자 구조와 서버 구성에 맞춰 동일한 설계 원칙을 적용한 결과다.

신규 기능은 기존 구조와 일관성을 유지하는 것을 기본으로 한다.

구조 변경이 필요한 경우에는 단순히 기본 템플릿과 형태를 일치시키는 것을 목표로 하기보다 다음 항목을 기준으로 판단한다.

- 유지보수성 개선 여부
- 보안 경계 명확화 여부
- 중복 코드 감소 여부
- 개발 생산성 개선 여부
- 기존 외부 인터페이스와의 호환성
- 마이그레이션 비용 대비 실질적인 개선 효과

현재 요구사항과 운영 구조에서는 위 기준에 따른 별도의 전면 구조 변경은 필요하지 않으며, 기존 아키텍처를 유지한다.
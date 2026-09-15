# 관리비서 (home_erp)

주택·건물 관리비 통합 관리 ERP. 관리비 부과·고지서 발행부터 수납·미납관리·공과금 검침·문자/알림톡/팩스 발송, 세입자 모바일 앱, 현장 파트너 앱, 통합관리자(HQ) 콘솔까지 — 건물관리 업무 전체를 하나의 플랫폼에서 처리한다.

레거시 시스템을 Next.js + Supabase 기반으로 현대화한 프로젝트다.

---

## 서비스 구성 (4개 페르소나)


| 페르소나      | 경로                  | 설명                                       |
| --------- | ------------------- | ---------------------------------------- |
| 사무실 관리자   | `/staff/*`          | 관리비 부과·고지·수납·미납·공과금·발송 등 핵심 ERP (최대 화면군) |
| 세입자       | `/resident/*`       | 관리비 내역·공지·정산 확인, 퇴실 신청 (모바일 웹)           |
| 현장 파트너    | `/partner/*`        | 현장 담당자용 A/S·검침·조회 (모바일 웹)                |
| 통합관리자(HQ) | `/platform-admin/*` | 테넌트·계정·포인트·청구·설정 관리 콘솔                   |


루트 `/`는 공개 마케팅·사업자정보 랜딩 페이지다.

---

## 기술 스택

- **프레임워크**: Next.js 16 (App Router) · React 19
- **백엔드/DB**: Supabase (`@supabase/ssr`, service role) — 이 앱은 자체 백엔드를 포함한 풀스택 앱이다 (아래 [아키텍처 노트](#아키텍처-노트--조직-프론트엔드-표준-대비-편차) 참고)
- **서버 상태**: TanStack React Query 5 (조회 `useQuery`, 변경 `useMutation` 단일 기준)
- **폼/검증**: react-hook-form + zod (`@hookform/resolvers`)
- **UI**: Tailwind CSS v4 + 자체 공통 컴포넌트 (`components/common`, `components/shell`)
- **토스트**: sonner
- **외부 발송**: Popbill (SMS/LMS·알림톡·팩스 통합)
- **문서/출력**: `@react-pdf/renderer` (A4 고지서), tiptap (공지 에디터), exceljs (엑셀 export), qrcode
- **테스트**: vitest + Testing Library, playwright (픽셀 정합 하네스)
- **언어/린트**: TypeScript 5, ESLint 9

---

## 디렉터리 구조

```
app/
  (staff)/staff/(app)/…        사무실 관리자 ERP
  (resident)/resident/(app)/…  세입자 모바일 앱
  (partner)/partner/(app)/…    현장 파트너 모바일 앱
  (platform-admin)/…           통합관리자 콘솔
  api/…                        서버 전용 route handler
  page.tsx                     공개 랜딩
hooks/
  reactquery/[도메인]/         apis · keys · queries · mutations · index (도메인별 RQ 훅)
  common/                      공용 훅 (useAppToast · useDebouncedValue · useAsyncAction …)
components/
  common/                      공통 UI (Modal · DataTable · FormField · Badge · Pagination …)
  shell/                       앱 셸 (AppShell · Sidebar · Topbar · A/S 레일)
  messenger/                   빠른 발송 FAB/패널
  icons/ · notices/ · vendors/ …
lib/
  supabase/                    client · server · admin · middleware
  providers/                   QueryProvider
  billing/ · payments/ · messaging/ · popbill/ · bill/ · auth/ · format/ · attachments/ …
supabase/migrations/           번호순 SQL 마이그레이션
docs/prototype/prd/            화면별 기획 정본 (PRD) — 참조 전용
```

**컨벤션**

- 페이지 로직은 `page.tsx`에서 직접 구현하기보다 형제 `components/` 폴더의 컴포넌트를 조합한다.
- 서버 상태는 React Query를 단일 기준으로 관리한다. API 응답을 `useState`/`useEffect`나 별도 스토어에 중복 저장하지 않는다.
- 타입은 각 도메인의 `apis.ts` 안에 정의한다 (별도 `models/` 폴더 없음).
- UI는 Tailwind로 구현하고, 기존 공통 컴포넌트를 먼저 재사용한다.

---

## 개발 환경

```bash
npm install          # 의존성 설치
cp .env.example .env.local   # 환경 변수 채우기 (아래 참고)
npm run dev          # 개발 서버 (http://localhost:3000)
```


| 스크립트                 | 설명           |
| -------------------- | ------------ |
| `npm run dev`        | 개발 서버        |
| `npm run build`      | 프로덕션 빌드      |
| `npm run start`      | 프로덕션 서버      |
| `npm run lint`       | ESLint       |
| `npm test`           | vitest 전체 실행 |
| `npm run test:watch` | vitest 워치 모드 |


---

## 환경 변수

`.env.example`을 복사해 `.env.local`에 값을 채운다. `NEXT_PUBLIC_` 접두사가 없는 키(서비스 롤, Popbill, 카카오 시크릿 등)는 **절대 커밋하거나 클라이언트에 노출하지 않는다.**

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase 공개 연결
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용 (계정 발급 스크립트·route handler)
- `NEXT_PUBLIC_STAFF_EMAIL_DOMAIN` — 스태프 계정 이메일 도메인
- `NEXT_PUBLIC_RESIDENT_WEB_ORIGIN` — 알림톡 상세 링크 생성용 세입자 웹 오리진
- `KAKAO_*` / `NEXT_PUBLIC_KAKAO_LOGIN_ENABLED` — 세입자 카카오 로그인
- `POPBILL_*` — SMS/알림톡/팩스 발송 (미설정 시 발송 경로가 `PROVIDER_NOT_CONFIGURED`로 명시 실패, 가짜 성공 stub 없음)
- `CRON_SECRET` — 예약 발송 워커·결과 재조회 API 인증

---

## 데이터베이스

DB 스키마는 `supabase/migrations/`의 번호순 SQL로 관리하며, 호스팅된 Supabase 프로젝트에 적용한다. RLS는 전 테이블에 적용되어 있고, 정책은 조직(org) 스코프로 격리된다.

---

## 배포

AWS Amplify로 배포한다 (`master` 브랜치 자동 빌드).

---

## 아키텍처 노트 — 조직 프론트엔드 표준 대비 편차

> **이 섹션의 목적**: auraworks 조직에는 `generate-frontend-projects` 스킬로 대표되는 프론트엔드 프로젝트 표준 골격이 있다. 이 프로젝트는 그 표준의 **핵심 관습은 채택**하되, 일부 규칙과는 **의도적으로 다르다**. 그 차이와 이유를 여기 기록해 두는 이유는 두 가지다.
>
> 1. **일관성**: 신규 합류자가 이 차이를 "표준 위반/방치"가 아니라 "다른 아키타입에서 비롯된 의도적 결정"으로 이해하도록.
> 2. **미래 대비**: 나중에 "표준에 맞춰 리팩터링해야 하나?"라는 재논의를 방지하도록. 결론은 **하지 않는다**이며, 그 근거를 아래에 남긴다.

### 핵심 전제: 아키타입이 다르다

**표준이 상정한 프로젝트 종류와 이 앱의 종류가 다르다.** 표준의 좋은 관습은 그대로 따르고, 아키타입에서 필연적으로 갈리는 지점만 다르게 간다.

### 이미 표준을 따르는 부분

- Next.js App Router + Supabase + React Query
- react-hook-form + zod, sonner
- `hooks/reactquery/[도메인]/{apis,keys,queries,mutations,index}.ts` 도메인 훅 패턴
- 타입을 각 도메인 `apis.ts`에 정의 (별도 `models/` 없음)
- `page.tsx` + 형제 `components/` 공존
- `lib/supabase/{client,server}.ts` (SSR), `lib/providers/QueryProvider.tsx`
- `components/common` 공통 UI, `hooks/common` 공용 훅

### 의도적으로 다른 부분과 그 이유


| 조직 표준 규칙                                      | 이 프로젝트                                                            | 이유                                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| route 그룹 `(client)`/`(provider)`/`(admin)` 3개 | `(staff)`/`(resident)`/`(partner)`/`(platform-admin)` **4개 페르소나** | 실제 사용자군이 4개다. 3개 제네릭 버킷에 우겨넣으면 구조가 오히려 모호해진다. 또한 이 경로들은 로그인·서명 고지서 URL·카카오 OAuth 콜백·외부 발송 링크에 물려 있어, 이름 변경은 파괴적 변경이 된다.               |
| route handler 없음, 외부 백엔드(`:8000`)에 직접 호출      | `app/api/` route handler = **이 앱이 곧 백엔드**                         | 서버 전용 로직(4개 페르소나 로그인·카카오 OAuth 콜백·Popbill 발송·service_role 작업·CSV/xlsx export·HMAC 서명)은 브라우저에 둘 수 없다. 붙일 외부 백엔드 서버가 없고, 별도로 만들 이유도 없다. |
| HTTP 클라이언트 = axios (`lib/axios/client.ts`)    | `@supabase/ssr` + 내부 `fetch`                                      | 데이터는 Supabase(RLS)로 직접, 서버 전용 작업은 내부 route handler로 처리한다. 붙일 외부 REST 백엔드가 없어 axios는 죽은 의존성이 된다.                                       |
| UI = shadcn/ui                                | 자체 Tailwind 디자인 시스템                                               | 프로토타입 정본(청록 `#14A497`)에 픽셀 정합된 자체 공통 컴포넌트 체계가 이미 있다. shadcn(Radix) 도입은 병행 시스템을 만들어 기존 체계와 충돌한다.                                       |
| `app/page.tsx` → `/root` 리다이렉트                | 공개 마케팅·사업자정보 랜딩                                                   | 사업자정보 공개는 법적 표기 의무이며 카카오 채널 심사에도 필요하다.                                                                                                |
| `components/layout/{Header,Footer}`           | `components/shell/{AppShell,Sidebar,Topbar}`                      | 페르소나별 셸 구조가 단순 헤더/푸터보다 요구에 맞는다 (동등 대체).                                                                                               |





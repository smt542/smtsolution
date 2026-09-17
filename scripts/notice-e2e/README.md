# notice-e2e 하네스

공지(Notice) Tiptap 편집기·본문 이미지, 그리고 공용 첨부 업로드 경로의 **실 브라우저 E2E** 검증 도구.
Playwright(Chromium, 헤드리스)로 로컬 dev(`localhost:3000`)에서 **라이브 Supabase**를 대상으로 실 렌더·네트워크·DOM 근거를 수집한다. jsdom(vitest)로 불가능한 편집기 상호작용·이미지 업로드→signed URL 왕복·3경로 동일 렌더를 확인한다.

결과 요약과 시나리오별 근거는 `docs/frontend-standardization-checklist.md` §7.4 참조.

## 준비

```bash
# 1) dev 서버(master 체크아웃). 입주자 경로 검증 시 스텁 플래그 필요:
RESIDENT_STUB_ENABLED=true NEXT_PUBLIC_RESIDENT_WEB_ORIGIN=http://localhost:3000 npm run dev
# 2) 이미지 픽스처 생성(.gitignore, 재생성 가능)
node scripts/notice-e2e/make-fixtures.mjs
```

Playwright 브라우저 spawn이 샌드박스에 막히면 **샌드박스를 끈 상태**로 실행한다(브라우저 구동은 정당한 작업).

## 스크립트

| 파일 | 용도 |
| --- | --- |
| `staff.mjs` | 스태프측: 편집기·a11y(S1)·링크정책(S2)·이미지 라이프사이클(S3)·스태프 읽기(S4a)·번들격리(S8) |
| `server.mjs` | 서버측: 입주자(S4b)·공유(S4c)·레거시(S5)·보안(S6)·3경로 일치(S4)·읽기라우트 번들격리(S8) |
| `vendor.mjs` | 비-공지 엔티티(업체) 첨부 업로드 스모크 — 공용 `uploadAttachment` blast-radius 확인 |
| `probe.mjs` | 최소 재현(프레시 로그인→평문 공지 생성) — 세션/저장 경로 격리 진단용 |
| `db.mjs` | 라이브 DB read/introspection (Management API `/database/query`, ref 가드) |
| `seed.mjs` | 서버측 시나리오용 시드(입주자 링크·공유토큰·레거시 공지) — 멱등 |
| `cleanup.mjs` | E2E 산출물 정리(공지·업체·토큰·링크·Storage) — 실데이터 무영향 |
| `make-fixtures.mjs` | 테스트 이미지 생성(정상 PNG·>10MB·잘못된 MIME) |

## 실행

```bash
# 스태프측 (fresh inline 로그인 내장)
MARKER="E2E-$(date +%H%M%S)" node scripts/notice-e2e/staff.mjs

# 서버측 — 시드는 classifier가 에이전트 프로덕션 쓰기를 막으므로 사용자가 ! 로 직접 실행
node scripts/notice-e2e/seed.mjs
IMAGE_NOTICE_ID=<id> LEGACY_NOTICE_ID=<id> node scripts/notice-e2e/server.mjs

# 업체 첨부 스모크
node scripts/notice-e2e/vendor.mjs

# 정리(마지막)
node scripts/notice-e2e/cleanup.mjs
```

산출물: `out/{*.png, staff-results.json, server-results.json, vendor-results.json}`.
기본 계정 `admin`/`erp!12345`(org_owner). DB 토큰은 `.env.local`의 `SUPABASE_ACCESS_TOKEN`을 읽는다.

## 주의(함정)

- **세션 staleness**: 스태프 세션은 Supabase refresh-token 회전으로 저장된 storageState가 수분 내 무효화된다. 각 하네스는 **매 실행 인라인 로그인**한다(`scripts/pixel-diff/.auth` 재사용 금지).
- **프로덕션 쓰기 게이트**: `seed.mjs`/`cleanup.mjs`는 라이브 DB에 쓰므로 에이전트 auto 모드에서 차단된다 → 사용자가 `!`로 실행.
- **라이브 대상**: dev가 라이브 Supabase에 붙으므로 생성물은 실 org에 남는다 → 반드시 `cleanup.mjs`로 정리.

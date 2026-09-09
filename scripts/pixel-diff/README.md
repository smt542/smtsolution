# pixel-diff 하네스

prototype 원본(staging)과 앱(localhost)을 **동일 프레임**으로 캡처해 오버레이 diff를 산출한다.
prototype 픽셀 퍼펙트 정합의 검증 수단.

## 준비

1. dev 서버 실행: `npm run dev` (→ `http://localhost:3000`)
2. 앱 로그인 세션 저장(1회, staff 계정):
   ```bash
   STAFF_ID=<아이디> STAFF_PW=<비번> node scripts/pixel-diff/save-auth.mjs
   ```
   → `scripts/pixel-diff/.auth/staff.json` 생성(git 무시).
3. 의존성: `playwright` · `pixelmatch` · `pngjs` (+ chromium). `npm i` 후 `npx playwright install chromium`.

## 사용

```bash
# 캡처 (origin=staging 원본, app=localhost)
node scripts/pixel-diff/capture.mjs <id|all> [--side=origin|app|both]
# 오버레이 diff + 불일치 비율
node scripts/pixel-diff/diff.mjs <id|all>
```
산출물: `scripts/pixel-diff/out/{origin,app,diff}/<id>.png`

## targets.json

```jsonc
{
  "id": "staff-receipt-management",
  "originUrl": "https://staging.d2h12382xiksft.amplifyapp.com/staff/receipt-management/receipt-management.dc.html",
  "originSelector": ".hf-app",      // 원본 프레임(데스크톱 .hf-app / 모바일 .phone .screen)
  "appPath": "/staff/receipts",     // 앱 라우트
  "appSelector": null,              // null이면 뷰포트 전체 캡처
  "viewport": { "w": 1340, "h": 880 },
  "device": "desktop"
}
```

## 뷰포트 규약

- **데스크톱**: 원본 `.hf-app`(`1340×880`) 크롭 ↔ 앱 뷰포트 `1340×880` 풀 캡처. DPR=1. 사이드바 240 / 상단 62 정합.
- **모바일**: 원본 `.phone .screen` ↔ 앱 모바일 뷰포트 폭 매칭(~380). DPR=1.

## 수렴 기준 (완전 픽셀 퍼펙트)

- 기본 뷰포트 오버레이에서 **구조적 불일치 0**(여백·정렬·크기·색·타이포·컴포넌트 형태).
- 시각 픽스처 적용 시 diff 픽셀 비율 **≤ 0.5%**.
- **데이터 텍스트 값 차이(실데이터 vs 원본 더미)는 대상 제외** — 셀 치수·스타일만 판정.

## 화면별 정합 워크플로우 (파일럿에서 확립 · 서브에이전트 위임 템플릿)

1. `targets.json`에 대상 추가(원본 URL·앱 경로·셀렉터).
2. 원본 소스에서 px 사양 추출:
   `grep -oE '(height|width|padding|margin|gap|border-radius|font-size|font-weight|flex|line-height):[^;"]+' docs/prototype/staff/<id>/<id>.dc.html`
3. baseline 캡처·diff → `out/diff/<id>.png`에서 불일치 영역 식별.
4. **원본 px를 앱 컴포넌트에 이식**(Tailwind arbitrary 값 `[48px]` 등). 데이터/로직 불변.
5. 재캡처(`--side=app`)·diff 반복 → 수렴 기준 충족.
6. `npx tsc --noEmit` · `npm run lint` 그린 → 커밋.

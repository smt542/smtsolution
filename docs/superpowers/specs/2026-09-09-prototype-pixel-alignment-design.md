# prototype 픽셀 퍼펙트 정합 — 설계 (2026-09-09)

## 1. 목표

`docs/prototype`(및 staging 배포본)의 **최신 디자인 원본**과 실제 Next.js 앱 화면을
**완전 픽셀 퍼펙트**로 정합한다. 동시에 앱의 모든 라우터가 원본 화면에 올바르게
매핑되는지 전수 감사한다. 착수 우선순위는 **사무실(staff)** persona.

- 정합 기준: **완전 픽셀 퍼펙트** — 스크린샷 오버레이 기준 시각적 완전 일치(레이아웃·여백·색·타이포·컴포넌트, 더미데이터 상태 포함).
- 감사 범위: 4개 persona(staff / 통합관리자 HQ / 현장 partner / 세입자 resident) + 공개 랜딩 전수.
- 정합 착수 순서: staff → (감사 결과에 따라) HQ / resident / partner.

## 2. 정본(Source of Truth) 정의

| 구분 | 상태 | 비고 |
|---|---|---|
| ✅ 최신 개별 `.dc.html` | **정본** | 청록 `#14A497`·브랜드 "관리비서"·`x-dc`/`DCLogic` 런타임. **모든 px가 인라인 스타일에 박혀 있음** |
| ❌ `docs/prototype/_design-system.css` | **폐기** | 구버전 — 파랑 `#3182F6`·브랜드 "홈지기"·`sc-if`/`sc-camel` 문법. 참조 금지 |

**원본 위치**
- staging 전량: `https://staging.d2h12382xiksft.amplifyapp.com/<persona>/<screen>/<screen>.dc.html` (200 확인)
  - `support.js`·`logo-mark.png` 등 런타임/애셋이 루트·각 디렉토리에서 모두 200 → 헤드리스로 열면 폰트·런타임 포함 완벽 렌더.
- 로컬 vendored: 17개만 존재(`admin` 7·`resident` 7·`staff` 2·허브 1). 나머지는 staging에서 확보.

**전역 토큰 정본**(최신 `.dc.html` `:root` 통합값)

```
--blue:#14A497; --blue-d:#0E8677; --blue-t:#E2F5F1; --blue-t2:#EFFBF8;
--bg:#F2F4F6; --surface:#fff; --line:#E8EBEE; --line2:#F1F3F5;
--t1:#191F28; --t2:#4E5968; --t3:#8B95A1; --t4:#B0B8C1;
--green:#12B886; --green-t:#E6F8F1; --red:#F04452; --red-t:#FDECEE;
--amber:#FF922B; --amber-t:#FFF3E6
```
폰트: `'Pretendard Variable','Pretendard',-apple-system,system-ui,sans-serif`

## 3. 접근 — 두 축

1. **구현의 왕도 = 원본 소스 px 직접 이식.**
   원본 `.dc.html`에는 모든 치수가 인라인 스타일로 존재한다
   (`height:48px`·`border-radius:13px`·`font-size:14.5px`·`flex:0 0 480px` 등).
   스크린샷 눈대중이 아니라 **소스의 수치를 앱 컴포넌트에 그대로 옮긴다.**
2. **검증 = 스크린샷 오버레이 diff.**
   원본(staging) ↔ 앱(localhost:3000)을 동일 뷰포트에서 캡처해 pixelmatch로
   불일치 히트맵/비율을 산출, 1px 수렴을 확인한다.

## 4. 픽셀 대조 하네스

헤드리스 브라우저(gstack 스킬 우선, 필요 시 Playwright)로 원본·앱을 캡처하고
diff 이미지를 생성하는 재사용 스크립트. `scripts/pixel-diff/`에 둔다.

- **원본 캡처**: staging URL을 로드 → 데스크톱 화면은 `.hf-app` 프레임(고정 `1340×880`) 요소를 크롭 캡처. 모바일 화면은 `.phone .screen`(고정 `380` 폭 프레임) 크롭.
- **앱 캡처**: 동일 콘텐츠 영역·동일 뷰포트로 캡처. staff 데스크톱은 원본 `.hf-app`과 동일하게 사이드바 `240` / 상단 `62` 정합.
- **diff**: pixelmatch로 `diff.png` + 불일치 픽셀 비율 리포트.
- **데이터 처리**: 원본은 더미데이터(예: "그린빌라 101호·홍길동·85,000원"). 텍스트 셀 값 차이가 레이아웃 판정을 오염시키지 않도록 **시각 비교용 픽스처**(원본 더미값 재현) 또는 데이터 셀 마스킹을 사용. 스타일/치수 판정은 픽스처 기준으로 수행.

## 5. 실행 파이프라인

### Phase 0 — 기반
- **staff 원본 vendoring**: staging에서 staff 화면 전량을 `docs/prototype/staff/`로 확보(+`support.js`·애셋). 감사·오프라인 대조용.
- **하네스 구축**: `scripts/pixel-diff/` 캡처·diff 스크립트. 원본 1화면·앱 1화면으로 동작 확인.
- **전역 토큰 정합("설정")**: `app/globals.css`의 `:root`·폰트·그림자 토큰을 §2 정본값으로 통일. 알려진 shadow 토큰 드리프트 포함. 앱 전역 회귀는 스냅샷으로 확인.

### Phase 1 — 매핑 감사 (전수)
- 앱 라우터(~63개, `app/**/page.tsx`)를 원본 화면과 1:1 매핑.
- staging 사이트맵(허브·각 화면 네비 링크)에서 원본 화면 목록을 수집해 대조.
- 각 행: `앱 라우트 | 대응 원본 | 원본 위치(로컬/staging/없음) | 현 정합상태 | px갭 요약 | 작업량`.
- 3방향 갭 표기: (a) 원본 없는 앱 화면(추가 구현), (b) 앱 없는 원본(미구현), (c) 매핑되나 px 불일치.
- **산출물**: `docs/audit/prototype-pixel-map-2026-09-09.md`.

### Phase 2 — 픽셀 정합 (staff 먼저)
1. **파일럿 1화면**으로 하네스+워크플로우(원본 px 이식 → 오버레이 diff → 수렴)를 검증. 후보: `receipt-management`(원본 staff 첫 화면) 또는 대시보드.
2. 확립 후 staff 나머지 화면을 **병렬**(Codex 워커, 화면별 git 워크트리)로 정합. 각 워커: 담당 화면 원본 소스 이식 → diff 그린 → PR.
3. staff 완료 후 HQ / resident / partner로 확대(동일 워크플로우).

## 6. 수렴 기준 (완전 픽셀 퍼펙트)

한 화면이 "정합 완료"로 판정되려면:
- 기본 뷰포트에서 오버레이 diff의 **구조적 불일치 0** (여백·정렬·크기·색·타이포·컴포넌트 형태).
- 시각 비교용 픽스처 적용 시 diff 픽셀 비율 **≤ 0.5%** (안티에일리어싱·서브픽셀 렌더 잔차 허용).
- 데이터 텍스트 값 차이(실데이터 vs 원본 더미)는 정합 대상 아님 — 셀의 **치수·스타일**만 일치하면 통과.

## 7. 뷰포트/스케일 규약

- **staff·HQ 데스크톱**: 원본 `.hf-app` = `min(1340px,96vw) × min(880px,86vh)`. 캡처 뷰포트를 충분히 크게(예: `1440×960`) 잡아 프레임을 고정 `1340×880`으로 만든 뒤 프레임 크롭. 앱은 동일 유효폭으로 캡처.
- **partner·resident 모바일**: 원본 `.phone .screen` = 폭 `380`(내부) · 높이 `800`. 앱은 폭 `~380` 모바일 뷰포트로 캡처.
- 스케일 1:1(디바이스 픽셀 비율 1)로 고정해 오차를 배제.

## 8. 리스크 & 완화

| 리스크 | 완화 |
|---|---|
| 원본 x-dc 런타임 상태(탭·모달)별 화면 다수 → 캡처 상태 누락 | 감사에서 화면별 주요 상태 열거, 상태별 캡처 |
| 실데이터/더미 텍스트 차이가 diff 오염 | 시각 픽스처·셀 마스킹(§4) |
| staff 원본이 24 라우트와 1:1 아닐 수 있음(탭 통합 등) | Phase 1 감사로 실제 대응관계 확정 후 착수 |
| 병렬 워커 마이그레이션/전역 CSS 충돌 | 화면별 워크트리 격리, 전역 토큰은 Phase 0에서 선(先)확정 |
| staging 브랜치 변동 가능성 | Phase 0에서 staff 원본을 로컬 vendoring해 고정 |

## 9. 범위 밖 (YAGNI)

- 원본에 없는 신규 화면/기능 추가.
- 백엔드·데이터 모델 변경(순수 표현 정합만; 로직·데이터는 현 앱 유지).
- CI 자동 비주얼 리그레션 게이트 구축(이번엔 로컬 하네스로 충분; 필요 시 후속 트랙).

## 10. 산출물

- `scripts/pixel-diff/` — 캡처·diff 하네스.
- `app/globals.css` — 전역 토큰 정합.
- `docs/audit/prototype-pixel-map-2026-09-09.md` — 라우터↔원본 매핑 감사 매트릭스.
- `docs/prototype/staff/**` — vendored staff 원본.
- 화면별 픽셀 정합 PR(staff 우선).

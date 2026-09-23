# button-audit

공통 버튼(`components/common/Button`, `app/(partner)/_components/PartnerButton`, `app/(resident)/_components/ResidentButton`)으로 raw `<button>`을 옮길 때 쓰는 분석 도구. 배경과 결정은 `docs/superpowers/plans/2026-09-17-button-consolidation.md`(§13·§14)에 있다.

**tsc·lint는 표시 변경을 못 잡는다.** 치환 사양은 사전 검증으로, 결과는 재분석으로 확인한다. 전부 읽기 전용이고 repo 루트에서 실행한다.

| 도구 | 사용법 | 하는 일 |
|---|---|---|
| `btn-safe.mjs` | `node scripts/button-audit/btn-safe.mjs [-v]` | 웹(`app/`·`components/`) raw 버튼 중 공통 `Button`으로 옮길 수 있는 곳을 값 기준으로 분류한다. 결정된 제외 대상은 `EXCLUDE`에 사유와 함께 따로 표시 |
| `btn-preflight.mjs` | `node scripts/button-audit/btn-preflight.mjs <specs.json> [defs/partner.json\|defs/resident.json] [-v]` | 치환 사양의 "원래 className"과 "컴포넌트가 내보낼 클래스 + 새 className"을 속성 단위로 대조한다(추가·소실·명시도 충돌). defs를 안 주면 웹 Button 기준 |
| `mobile-btn-survey.mjs` | `node scripts/button-audit/mobile-btn-survey.mjs [-v]` | 현장·세입자 앱 `<button>`을 **클래스맵(`styles.x`)까지 따라가** 규격별로 모은다. `btn-safe`는 클래스맵을 못 읽는다 |
| `canon-btn-rules.mjs` | `node scripts/button-audit/canon-btn-rules.mjs <정본폴더> <파일접두사>` | 정본 `.dc.html`의 높이 40px 이상 버튼 CSS 규칙을 규격별로 뽑는다 |
| `canon-find.mjs` | `node scripts/button-audit/canon-find.mjs <정본파일> <라벨>` | 라벨 주변 요소의 class·style과 CSS 규칙(휴리스틱) |
| `open-tags.mjs` | `node scripts/button-audit/open-tags.mjs <file:line>…` | 해당 줄 `<button>` 여는 태그 원문(사양 작성용) |

- `examples/`: 실제로 검증에 쓴 사양(웹 배치 3, 현장·세입자 1차). 사양 형식 예시다.
- **컴포넌트 규격을 바꾸면 여기도 같이 바꾼다**: `Button.tsx` ↔ `btn-safe.mjs`의 `SIZES`·`VARIANTS`, `PartnerButton.tsx` ↔ `defs/partner.json`, `ResidentButton.tsx` ↔ `defs/resident.json`. 양보 규칙은 `components/common/buttonOverride.ts` ↔ `btn-safe.mjs`의 `dropOverridden`.

## 함정

- **이름이 아니라 값으로 비교한다.** `rounded-[11px]`=`rounded-btn`, `bg-blue`=`bg-teal`=`bg-brand`, `bg-surface`=`bg-white`, `shadow-hf-btn`=`shadow-pri`처럼 이름만 다른 경우가 많다.
- **컴포넌트가 새로 얹는 속성도 본다.** 호출부에 그림자가 없던 버튼에 `shadow-pri`가 붙어도 "충돌"은 아니라서 놓치기 쉽다(배치 1·2 회귀 3건).
- **양보 규칙이 기본값을 지울 수 있다.** `disabled:hover:bg-teal`처럼 "hover:bg-"가 들어간 클래스가 있으면 hover 기본값이 빠진다 → 활성 hover를 호출부에 남긴다.
- **부모의 `[&>button]`·`[&_button]` 규칙은 공용 버튼을 명시도로 이긴다.** 치환할 때 부모 규칙도 걷어낸다.
- **`${base} ${variant}`처럼 클래스를 이어 붙이면** 같은 속성 클래스가 둘 남아 CSS 생성 순서로 승자가 갈린다. 세입자 앱에서 이 구조 때문에 hover가 회색이 되고, 연청록 배경에 흰 글자가 나오는 버그가 있었다.
- 태그 끝은 첫 `>`가 아니다. `onClick={() => …}`의 `>`를 건너뛰어야 className을 읽는다(도구는 문자열·중괄호를 인식한다).

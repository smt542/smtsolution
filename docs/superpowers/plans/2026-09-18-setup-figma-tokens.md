# /staff/setup Figma 실측 사양

노드 `72:71689`(고지서 설정 본문) `get_design_context` 실측값. 폰트는 전부 Pretendard.
`2026-09-18-setup-figma-alignment.md`의 Phase 0 입력 사양이다.

## 색 매핑

| Figma | 앱 토큰 | 용도 |
|---|---|---|
| `#14a497` | `brand` | 스위치 on, 라디오 선택 |
| `#191f28` | `t1` | 카드 제목, 인풋 값, 선택된 세그먼트 |
| `#4e5968` | `t2` | 연체칸 라벨, 단위(`%`·`개월부터`) |
| `#8b95a1` | `t3` | 부제, 미선택 세그먼트/라디오 라벨 |
| `#b0b8c1` | `t4` | placeholder, 문자수 카운터 |
| `#f2f4f6` | `bg` | 행 래퍼 배경(계좌행·연체칸) |
| `#e8ebee` | `line` | 인풋/textarea 테두리 |
| `#f1f3f5` | `line2` | 행 구분선, 행 래퍼 테두리 |
| `#dce1e7` | **없음 → arbitrary** | 카드 테두리 |
| `#edf0f3` | **없음 → arbitrary** | 세그먼트 트랙 배경 |
| `#c9d0d8` | **없음 → arbitrary** | 미선택 라디오 테두리 |

토큰이 없는 3개는 `moving-settlement`·`platform-admin`·`management-fee`가 이미 arbitrary 값으로 쓰고 있다. 이번에 토큰화하면 그 화면들까지 건드리게 되므로 **arbitrary 유지**한다.

## 레이아웃

```
본문 컨테이너   pt-[22px] pb-[30px] px-[24px]
카드 그리드     grid-cols-[770.47px_847.53px] gap-[14px] w-[1632px]
                1행 col-span-2 h-216 / 2행 2칸 h-351 / 3행 col-span-2 h-202
```

## 카드 (Panel 확장)

```
컨테이너  bg-white border border-[#dce1e7] rounded-[16px] overflow-clip
헤더      pt-[16px] px-[18px]
  제목    ExtraBold 15px t1 tracking-[-0.15px]
  부제    Medium 12.5px t3 · 래퍼 h-[18px] pt-[3px]
  우측    액션(스위치·카운터)은 헤더 행에 justify-between
본문      pt-[14px] pb-[18px] px-[18px]
```

`Panel`의 현재 기본형은 `rounded-2xl border-line p-6` — Figma와 다르다. `subtitle` prop과 함께 Figma 규격 변형을 추가한다.

## Text Input

```
bg-white border border-[#e8ebee] rounded-[11px] px-[12px]
값 텍스트 Bold 14px t1
높이  38px(계좌) / 40px(단전·단수 개월) / 36px(연체 %)
폭    229px(은행·예금주) / flex(계좌번호) / 78px(개월) / 70px(%)
숫자 인풋은 text-right
```

현재 `Input`은 `h-11`(44) `rounded-xl`(12) 고정 → size 변형 필요.

## 행 래퍼

```
공통      bg-bg border border-line2 rounded-[12px]
계좌행    px-[12px] py-[10px] gap-[12px] · 내부 인풋 gap-[8px]
연체칸    pl-[13px] pr-[10px] py-[8px] · h-54 · justify-between
```

## Radio (신규)

```
19×19 border-2 rounded-[9.5px]
선택    border-brand + 내부 9×9 bg-brand rounded-[4.5px] (left/top 3px)
미선택  border-[#c9d0d8] · 내부 없음
라벨    Bold 13px · 선택 t1 / 미선택 t3 · gap-[8px]
```

## SegmentedControl (신규)

```
트랙      bg-[#edf0f3] rounded-[10px] p-[3px] gap-[2px]
세그먼트  h-[34px] px-[16px] rounded-[8px] · Bold 13.5px
선택      bg-white drop-shadow-[0px_2px_3px_rgba(23,31,40,0.1)] text-t1
미선택    투명 text-t3
```

2택 전용이 아니다 — 출력/미출력, 반영/안함, 수동/자동에 모두 쓴다.

## Switch (신규)

```
트랙  44×26 rounded-[999px] · on bg-brand / off bg-[#c9d0d8] (off 색은 미실측 — 알림 탭에서 확인)
노브  20×20 bg-white rounded-[10px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.2)]
      top-[3px] · on left-[21px] / off left-[3px]
```

## Textarea + 카운터

```
textarea  bg-white border border-line rounded-[12px] px-[13px] py-[12px]
          placeholder Medium 14px t4 leading-[22.4px]
카운터    SemiBold 12px t4 · 우측 정렬 · 위 요소와 gap-[10px]
```

## 설정 행 (출력 옵션 · 정산 기준)

```
행       flex gap-[16px] items-center
구분선   border-b border-line2 · 중간 행 py-[12px]
         첫 행 pb-[12px] / 마지막 행 pt-[12px] + 구분선 없음
라벨     Bold 14px t1 (h-[16px] 래퍼)
부제     Medium 12.5px t3 (h-[18px] pt-[3px] 래퍼)
```

## 연체 12칸 그리드

```
grid-cols-8 gap-[8px] grid-rows-[54px_54px] w-[1594px]
라벨     Bold 13px t2
단위 %   SemiBold 13.5px t2 · 인풋과 gap-[8px]
12번째   라벨이 `12개월차 이후`로 길어 gap-[10px] (justify-between 아님)
```

## 정산 체크 항목 그리드 (노드 `72:70542`)

```
5열 · 셀 312.39×52 · gap-[8px]
번호     좌측 · 셀 안 x=11 w=22
인풋     x=41 w=226.39 h=36
삭제     28×28 버튼 · 아이콘 14×14 · x=275.39
추가버튼 101×38 `＋ 항목 추가`
```

## 셸 — 헤더 (노드 `72:69556`)

```
h-[62px] bg-white border-b border-line flex items-center gap-[12px] px-[24px]
  햄버거   래퍼 pr-[2px] · 버튼 36×36 rounded-[10px] · 아이콘 20×20
  제목     ExtraBold 19px t1 tracking-[-0.38px]
  spacer   flex-1
  저장     bg-brand h-[40px] px-[15px] rounded-[11px] Bold 13.5px white
           drop-shadow-[0px_6px_7px_rgba(20,164,151,0.5)]
```

**기존 `components/shell/Topbar.tsx`와 픽셀 단위로 동일하다.** 다른 점은 둘뿐이다.
- 제목이 `셋업 설정` (navItems 라벨은 `셋업·기타 설정`)
- 우측 `저장` 버튼 — 공용 `Button`의 `size="std" variant="primary"`와 정확히 일치
  (`h-10 rounded-btn px-[15px] text-[13.5px]` + `bg-brand text-white shadow-pri`)

`--shadow-pri: 0 6px 14px -4px rgba(20,164,151,.5)`는 Figma의 `drop-shadow 0 6px 7px`와 같은 값이다
(Figma blur 14 → CSS drop-shadow blur 7).

### 헤더 구현 방침 — 공용 `PageHeader`

`AppShell.hasIntegratedHeader` 선례를 따르되, **62px 헤더 마크업을 또 복제하지 않는다.**
`notices`·`buildings`·`buildings/new-v2`가 이미 햄버거+제목+액션 헤더를 손으로 복제해 뒀고,
`NoticesWorkspace`는 같은 파일 안에서 두 번 복제했다. 여기에 네 번째를 추가하는 대신
`components/shell/PageHeader.tsx`를 만들어 setup이 쓴다.

```
PageHeader: { title: string; actions?: React.ReactNode }
```
햄버거는 기존과 같이 `window.dispatchEvent(new Event('app-shell:toggle-sidebar'))`.
기존 3개 화면의 이관은 이번 범위 밖 — 별건 정리로 남긴다.

## 셸 — 탭바 (노드 `72:69569`)

```
컨테이너  bg-white border-b border-line px-[24px]
탭 행     flex gap-[4px] w-full · 탭 높이 42px (컨테이너 border 포함 43px)
탭        px-[16px] py-[12px] border-b-2 · Bold 14px
활성      border-brand text-brand
비활성    border-transparent text-t3
```

탭 폭은 내용에 따라 87 / 100 / 113 / 87 / 87 / 100 — 고정폭이 아니라 텍스트 폭이다.

### 탭바 구현 방침 — `Tabs`에 size 변형 추가

공용 `Tabs`의 현재 값은 `px-4 py-2`이고 비활성에 `border-b-2`가 없다(활성 탭만 2px 더 높아지는 차이가 있다).
Figma는 `py-[12px]` + 비활성도 `border-b-2 border-transparent`다.

`Tabs`는 **9개 호출부**(partner 모바일·accounts·fee-items·management-fee·messaging·receipts 등)가 쓰고
그 중 여럿은 이미 픽셀 정합이 끝난 화면이다. 공용 기본값을 바꾸면 전부 틀어진다.
→ `size?: 'default' | 'page'`를 추가하고 **기본값은 현재 동작 그대로** 둔다. setup만 `size="page"`.

## 알림 설정 탭 (노드 `72:69596`)

이 탭만 카드 모양이 다르다 — `Panel variant="titlebar"`. 정본 그대로 둔다(2026-09-18 사용자 결정).
**위 모서리가 각지고 아래만 radius 14인 것도 정본 그대로다**(노드 렌더로 확인).

```
카드  Panel variant=titlebar · title=알림 설정 · 부제 없음
본문  flex flex-col gap-[10px]
행    border border-line rounded-[12px] px-[16px] py-[14px] flex items-center justify-between
  좌  라벨 Bold 14px t1 / 부제 Medium 12.5px t3 (h-[18px] pt-[3px] 래퍼)
  우  1행: Switch
      2행: gap-[10px] → [gap-[6px]: `만료` + 드롭다운 + `전부터`] + Switch
          `만료`·`전부터` Bold 12.5px t2
드롭다운  bg-white border border-line h-[34px] w-[64px] min-w-[64px] rounded-[9px] px-[10px]
          justify-between · 값 Bold 13.5px t1 · chevron 13×13
```

행 배경이 `bg-bg`가 아니라 **흰색 + 테두리**다. 고지서 탭의 계좌행(`bg-bg border-line2`)과 다르다.

## 데이터 이관 탭 (노드 `72:68428`)

카드는 고지서·이사정산과 같은 `compact` 계열 테두리(`#dce1e7`/16)지만 **Panel을 쓰지 않는다** —
헤더가 카드 밖 별도 행이고, 카드 헤더는 번호 뱃지가 붙은 그룹 헤더다.

```
컨테이너  flex flex-col gap-[16px] w-full

화면 헤더행  flex gap-[12px] items-start
  좌  제목 `데이터 이관` ExtraBold 16px t1 tracking-[-0.32px]
      부제 Medium 13px t3 leading-[20.15px] (h-[26px] pt-[5px] 래퍼)
  우  `진행 기록 초기화` bg-white border border-line h-[40px] px-[15px] rounded-[11px] Bold 13.5px t2

그룹 카드  bg-white border border-[#dce1e7] rounded-[16px] overflow-clip
  그룹 헤더  border-b border-line2 px-[18px] py-[15px] gap-[11px] items-center
    번호 뱃지  22×22 bg-brand rounded-[11px] · Bold 12px white leading-[12px] 가운데 정렬
    제목  ExtraBold 14px t1 tracking-[-0.14px]
    부제  Medium 12.5px t3 (h-[18px] pt-[3px] 래퍼)
  행  px-[18px] py-[14px] gap-[10px] items-center · border-b border-line2 (그룹 마지막 행은 없음)
    이름  Bold 14px t1 tracking-[-0.14px] · flex-1 min-w-[200px]
    설명  Medium 12.5px t3 (h-[18px] pt-[3px] 래퍼)
    선행 칩  bg-bg rounded-[7px] px-[8px] py-[4px] Bold 11.5px t4
    상태  min-w-[120px] text-right Bold 12.5px t4 (`미실행` 또는 `{건수}건 · {날짜}`)
    양식  bg-white border border-line h-[34px] px-[13px] rounded-[11px] Bold 12.5px t2
    업로드  bg-brand h-[34px] px-[13px] rounded-[11px] Bold 12.5px white
            drop-shadow-[0px_6px_7px_rgba(20,164,151,0.5)]
```

**잠김(선행 미충족) 표현은 요소마다 값이 다르다.** 한 덩어리에 opacity를 걸면 안 된다.
- 이름·설명 블록 / 선행 칩 / 상태 → `opacity-55`
- 업로드 버튼 → `opacity-40`
- 양식 버튼 → 흐려지지 않는다(선행과 무관하게 언제나 받을 수 있다)

## 회사 정보 탭 (노드 `72:72964`)

```
카드  Panel variant=compact
      title=관리업체 정보
      subtitle=세입자 앱과 고지서·알림톡에 표기되는 대표 정보예요
```

행은 `출력 옵션`과 같은 패턴이다 — `flex items-center gap-[16px]`,
첫 행 `pb-[12px] border-b border-line2` / 중간 행 `py-[12px] border-b border-line2` /
마지막 행 `pt-[12px]` 구분선 없음. 라벨 블록이 `flex-1`, 인풋이 고정폭으로 우측에 붙는다.

| 필드 | 부제 | 인풋 폭 |
|---|---|---|
| 상호 | 세입자 앱과 고지서에 표기되는 회사명 | 240 |
| 대표 전화 | 세입자 문의 안내에 노출돼요. 건물별 담당 연락처가 없을 때 이 번호가 표기됩니다 | 180 |
| 팩스 | — | 180 |
| 사업자등록번호 | — | 180 |
| 대표자 | — | 140 |
| 주소 | — | 360 |
| 운영 시간 | 세입자 안내 문구에 함께 표기돼요 | 240 |

인풋은 전부 `Input size="38"`. 라벨 `Bold 14px t1`, 부제 `Medium 12.5px t3`(h-[18px] pt-[3px] 래퍼).

**SMS·팩스 발신번호 행은 정본에 없다 → 제거한다**(D2). `useSaveSetupSender`·`/api/setup/sender`·
`setup_config.sms_sender`/`fax_sender` 컬럼은 남긴다.

## A/S 설정 탭

```
카드  Panel variant=compact
      title=A/S 접수 유형
      subtitle=A/S 접수 화면의 유형 선택에 노출돼요 · 최대 6개
      action=`{개수} / 6`  (SemiBold 12px t4)
본문  NumberedTagList columns=5 max=6 addLabel=＋ 유형 추가
```

데이터·훅·MAX=6은 이미 정본과 같다. **표현만 교체**한다.
목록이므로 헤더 저장 버튼에 등록하지 않는다(추가·수정·삭제 즉시 저장 유지).

## 이사정산 설정 탭 — 카드 3장

```
1) Panel variant=compact
   title=이사정산 입금 계좌 · subtitle=이사정산 내역서에 인쇄돼요
   행: bg-bg border border-line2 rounded-[12px] px-[12px] py-[10px]
       인풋 3개 gap-[8px] — 은행 229 / 계좌번호 flex / 예금주 229, 전부 size=38
       고지서 탭의 계좌행과 달리 라디오가 없다

2) Panel variant=compact
   title=정산 체크 항목 · subtitle=이사정산 입력의 정산 체크에 노출돼요 · 최대 24개
   action=`{개수} / 24`
   본문: NumberedTagList columns=5 max=24 addLabel=＋ 항목 추가

3) Panel variant=compact
   title=정산 기준 · subtitle=이사정산 계산에 적용되는 기본 규칙이에요
   행 3개 — `출력 옵션`과 같은 행 패턴 + SegmentedControl
```

정산 기준 3행은 **편집 가능하게 유지**한다(2026-09-18 사용자 결정). 정본 부제의 `· 변경 불가`
접미는 빼고 앞부분만 쓴다 — 편집되는데 변경 불가라고 적으면 거짓말이 되기 때문이다.

| 라벨 | 부제(접미 제거 후) | 세그먼트 | 컬럼 |
|---|---|---|---|
| 수도 단가 반영 | 정산 시 수도 단가를 금액에 반영 | 반영 / 안함 | `water_unit_reflect` |
| 전기 단가 반영 | 정산 시 전기 단가를 금액에 반영 | 반영 / 안함 | `electric_unit_reflect` |
| 공실 수납 처리 | 퇴실 후 공실 세대의 수납 처리 방식 | 수동 / 자동 | `vacancy_payment_mode` |

`이사정산 입금 계좌`는 현재 `계좌 설정` 탭에 있다. 이 탭으로 옮기고, 원래 자리는 Phase 2에서 지운다.

## 고지서 설정 탭 — 카드 4장 (노드 `72:71689`)

배치는 `레이아웃` 절의 카드 그리드 그대로 — 1행 전폭(216) / 2행 2칸(770.47 · 847.53, 351) / 3행 전폭(202).

```
1) Panel variant=compact
   title=관리비 입금 계좌 · subtitle=최대 2개 등록하고, 고지서에 인쇄할 계좌 1개를 선택해요
   행 2개: bg-bg border border-line2 rounded-[12px] px-[12px] py-[10px] gap-[12px]
     인풋 3개 gap-[8px] — 은행 229 / 계좌번호 flex / 예금주 229, 전부 size=38
     우측 Radio(label=고지서 출력) — 2개 중 정확히 1개만 선택

2) Panel variant=compact
   title=고객 안내사항 · subtitle=고지서 하단에 인쇄되는 안내 문구예요
   Textarea variant=compact showCount maxLength=250 (min-h-[92px], 카드 높이에 맞춰 늘어남)

3) Panel variant=compact
   title=출력 옵션 · subtitle=고지서에 표기할 항목을 선택해요
   `설정 행` 패턴 4행 + SegmentedControl(출력 / 미출력)
   1행 `단전·단수 출력`은 세그먼트 앞에 Input size=40 w-[78px] text-right + `개월부터`(SemiBold 13.5px t2), 둘 사이 gap-[8px], 그룹과 세그먼트 사이 gap-[10px]

4) Panel variant=compact
   title=관리비 연체 설정 · subtitle=미납 개월 수에 따른 다른 요율 적용합니다. (단리)
   action=Switch
   본문: `연체 12칸 그리드` 절 그대로
```

| 정본 행 | 컬럼 |
|---|---|
| 단전·단수 출력 (+개월) | `print_utility_cutoff` (+ `cutoff_months`) |
| 수도 단가 출력 | `print_water_unit_price` |
| 관리비 기간 출력 | `print_billing_period` |
| 증감량 표시 | `print_delta` |
| 연체 설정 on/off | `setup_config.late_fee_enabled` (마이그 0170) |

`관리비 입금 계좌`는 현재 `계좌 설정` 탭에 있다. 이 탭으로 옮기고 원래 자리는 Phase 2에서 지운다.

**정본에 자리가 없어 UI에서 빼는 필드 3개** — `세대 표기 방식`(`unitLabelDefault`) ·
`연체료 합산`(`lateFeeMerge`) · `AS현황 메인표시`(`showAsOnMain`). 컬럼·매퍼·폼 스키마는 남긴다.

### 연체 12단계 ↔ `late_fee_rate_tiers` 어댑터

값의 원장은 0031의 `late_fee_rate_tiers`다(`/staff/overdue`와 공유). 구간은
`from_month` 미포함 ~ `to_month` 포함이다.

```
읽기  n = 1..11  → from_month < n <= to_month 인 구간의 monthly_rate
      12개월차 이후 → to_month is null 인 구간의 monthly_rate
      해당 구간이 없으면 0
쓰기  정확히 12행으로 교체(useReplaceLateFeeRateTiers)
      tier_order 1..12
      n = 1..11    → from_month = n-1, to_month = n
      12번째       → from_month = 11, to_month = null
```

overdue 화면에서 임의 구간(예: 1~3개월 5%)을 정의해 뒀으면 이 화면에서 저장하는 순간
12구간으로 평탄화된다. 2026-09-18 사용자가 이 손실을 알고 단일 원장을 선택했다.

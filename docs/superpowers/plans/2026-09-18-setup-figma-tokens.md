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

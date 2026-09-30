"use client";

/**
 * 공용 날짜 달력 본체(월 이동 머리·요일·날짜 칸). DpDatePicker 팝업이 이것을 그리고, 화면에 달력을 펼쳐 두는 곳은
 * 같은 부품을 `look`만 바꿔 그대로 놓는다 — 날짜 선택 코드는 이 파일 하나다.
 * - `popup`: DpDatePicker 팝업(원본 `.dp`)
 * - `sheet`: 세입자 퇴실 신청 바텀시트에 펼친 달력(원본 resident-home `.cal`: 테두리 상자·38px 칸·일요일 빨강)
 * - `bottomSheet`: 현장 앱 날짜 바텀시트 본체(원본 partner `.cal`, PartnerDateSheet가 시트를 그린다)
 * 값은 "YYYY-MM-DD"로 주고받는다. 보이는 달(view)은 호출부가 들고 있다(팝업은 열 때 선택 값의 달로 맞춘다).
 */
export type DpCalendarView = { y: number; m: number }; // m: 0-based

type DpCalendarProps = {
  view: DpCalendarView;
  onViewChange: (view: DpCalendarView) => void;
  value: string; // "YYYY-MM-DD" | ""
  onPick: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  look?: "popup" | "sheet" | "bottomSheet";
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

// 값은 "YYYY-MM-DD"로 내보내지만, 점 구분("YYYY.MM.DD")으로 들어온 값도 읽는다(기존 화면 전용 달력 호환)
export function parseDpDate(value: string): number[] | null {
  const parts = value.split(/[.-]/).map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? parts : null;
}

type DayState = { off: boolean; selected: boolean; sunday: boolean };

const koreanMonth = ({ y, m }: DpCalendarView) => `${y}년 ${m + 1}월`;

const LOOKS = {
  popup: {
    root: undefined,
    head: "mb-[10px] flex items-center justify-between",
    nav: "grid size-[30px] place-items-center rounded-[8px] text-[17px] text-t2 hover:bg-bg disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
    title: "text-[14px] font-extrabold text-t1",
    label: koreanMonth,
    week: "mb-[4px] grid grid-cols-7",
    weekday: "py-[4px] text-center text-[11px] font-bold text-t4",
    grid: "grid grid-cols-7 gap-[2px]",
    empty: "h-[32px]",
    day: ({ off, selected }: DayState) => `grid h-[32px] place-items-center rounded-[8px] text-[13px] font-semibold ${
      off ? "cursor-default text-t4 opacity-45" : selected ? "bg-blue font-bold text-white" : "text-t1 hover:bg-blue-t2"
    }`,
  },
  // 원본 `.cal` — 막힌 일요일도 빨강(원본 `.sun`이 `:disabled` 뒤에 선언돼 이김)에 흐림 .45.
  // 선택 칸은 원본에서 hover 회색이 청록을 덮지만(명시도) 렌더 결함이라 옮기지 않는다.
  sheet: {
    root: "rounded-2xl border border-line px-3 pb-2 pt-3",
    head: "flex items-center gap-1.5 px-0.5 pb-2.5 pt-0.5",
    nav: "flex size-8 items-center justify-center rounded-[10px] text-t2 hover:bg-bg disabled:cursor-not-allowed disabled:text-line disabled:hover:bg-transparent [&_svg]:size-[17px]",
    title: "flex-1 text-center text-[14.5px] font-extrabold tracking-[-0.02em]",
    label: koreanMonth,
    week: "grid grid-cols-7",
    weekday: "pb-1 text-center text-[11.5px] font-bold text-t4",
    grid: "grid grid-cols-7",
    empty: "h-[38px]",
    day: ({ off, selected, sunday }: DayState) => `h-[38px] rounded-[11px] text-[13.5px] font-bold tabular-nums ${
      off ? "cursor-not-allowed opacity-45" : selected ? "" : "hover:bg-bg"
    } ${selected ? "bg-blue text-white" : sunday ? "text-red" : off ? "text-t4" : "text-t1"}`,
  },
  // 원본 partner `.cal`(mobile-as·mobile-as-new·mobile-ms-new 세 파일 CSS 동일): 머리 `‹ 2026.08 ›`·36px 이동 버튼,
  // 요일 12px/700, 42px 칸·gap 3·15px/700. 날짜 칸 hover·일요일 빨강은 원본에 없다.
  bottomSheet: {
    root: undefined,
    head: "mb-3 flex items-center justify-between",
    nav: "flex size-9 items-center justify-center rounded-[11px] text-[20px] text-t2 hover:bg-bg disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
    title: "text-[16px] font-extrabold",
    label: ({ y, m }: DpCalendarView) => `${y}.${pad(m + 1)}`,
    week: "mb-1 grid grid-cols-7",
    weekday: "py-1.5 text-center text-[12px] font-bold text-t4",
    grid: "grid grid-cols-7 gap-[3px]",
    empty: "h-[42px]",
    day: ({ off, selected }: DayState) => `flex h-[42px] items-center justify-center rounded-[12px] text-[15px] font-bold ${
      off ? "cursor-default text-t4 opacity-45" : selected ? "bg-blue text-white" : "text-t1"
    }`,
  },
} as const;

function SheetChevron({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function DpCalendar({
  view,
  onViewChange,
  value,
  onPick,
  minDate,
  maxDate,
  look = "popup",
}: DpCalendarProps) {
  const classes = LOOKS[look];
  const minimumDate = minDate || undefined;
  const maximumDate = maxDate || undefined;
  const selected = value ? parseDpDate(value) : null; // [y, m(1-based), d]
  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const viewMonth = `${view.y}-${pad(view.m + 1)}`;
  const minimumMonth = minimumDate?.slice(0, 7);
  const maximumMonth = maximumDate?.slice(0, 7);
  const previousMonthDisabled = Boolean(minimumMonth && viewMonth <= minimumMonth);
  const nextMonthDisabled = Boolean(maximumMonth && viewMonth >= maximumMonth);
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const keyOf = (day: number) => `${view.y}-${pad(view.m + 1)}-${pad(day)}`;
  const isOff = (key: string) => Boolean((minimumDate && key < minimumDate) || (maximumDate && key > maximumDate));

  const shiftMonth = (delta: number) => {
    if (minimumMonth && delta < 0 && viewMonth <= minimumMonth) return;
    if (maximumMonth && delta > 0 && viewMonth >= maximumMonth) return;
    const next = view.m + delta;
    onViewChange({ y: view.y + Math.floor(next / 12), m: ((next % 12) + 12) % 12 });
  };
  const pick = (day: number) => {
    const nextValue = keyOf(day);
    if (isOff(nextValue)) return;
    onPick(nextValue);
  };

  return (
    <div className={classes.root}>
      <div className={classes.head}>
        <button type="button" aria-label="이전 달" disabled={previousMonthDisabled} onClick={() => shiftMonth(-1)} className={classes.nav}>
          {look === "sheet" ? <SheetChevron d="M15 5l-7 7 7 7" /> : "‹"}
        </button>
        <span className={classes.title}>{classes.label(view)}</span>
        <button type="button" aria-label="다음 달" disabled={nextMonthDisabled} onClick={() => shiftMonth(1)} className={classes.nav}>
          {look === "sheet" ? <SheetChevron d="M9 5l7 7-7 7" /> : "›"}
        </button>
      </div>
      <div className={classes.week}>
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className={classes.weekday}>{weekday}</span>
        ))}
      </div>
      <div className={classes.grid}>
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} className={classes.empty} />;
          const key = keyOf(day);
          const off = isOff(key);
          return (
            <button
              key={day}
              type="button"
              disabled={off}
              onClick={() => pick(day)}
              className={classes.day({
                off,
                selected: Boolean(selected && selected[0] === view.y && selected[1] === view.m + 1 && selected[2] === day),
                sunday: (firstDow + day - 1) % 7 === 0,
              })}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

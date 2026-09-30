/**
 * 정본 partner/mobile-meter.dc.html 규격. 정본은 줄높이를 정하지 않아(normal) 루트에서 normal로 맞추고,
 * 글자 크기는 줄높이까지 정하는 text-sm·text-base 대신 px로 준다.
 * 상태가 바뀌는 칸(칩·화살표·달 칸)은 상태마다 클래스 한 벌을 따로 둔다 — 이어 붙이면 같은 속성끼리 충돌한다.
 */
const STEP = "flex size-[34px] flex-none items-center justify-center rounded-[11px] border-0 [&_svg]:size-[17px]";
const CHIP = "flex-none rounded-[7px] px-2 py-1 text-[11.5px] font-extrabold";
const COUNT = "ml-auto flex-none rounded-full px-[11px] py-1.5 text-[12.5px] font-bold";
const CHEV = "ml-auto size-[19px] flex-none text-t4 transition-transform duration-[180ms] ease-[ease]";
const HIST = "ml-auto whitespace-nowrap text-[11.5px] font-medium tracking-[-0.01em] [&_b]:font-semibold";
const FIN = "h-[46px] w-full flex-none rounded-xl border px-[13px] text-right text-[15.5px] font-semibold tabular-nums outline-none";
const ROW_LABEL = "flex-none text-[13.5px] font-semibold text-t3";
const NAV = "flex size-[34px] items-center justify-center rounded-[11px] border-0 bg-bg hover:bg-[#e4e8ec] [&_svg]:size-4";
const CELL = "flex h-[46px] items-center justify-center rounded-xl border-0 text-[14.5px] font-bold";

export const meterClasses = {
  root: "flex min-h-0 flex-1 flex-col bg-white leading-[normal]",
  header: "flex items-center gap-2.5 px-4 pb-2.5 pt-3.5",
  back: "flex size-[38px] flex-none items-center justify-center rounded-xl text-t2 hover:bg-bg [&_svg]:size-[22px]",
  titleWrap: "min-w-0 flex-1",
  title: "text-[20px] font-extrabold tracking-[-0.02em]",
  sub: "mt-0.5 text-[13px] font-semibold text-t3",

  // 월 이동 막대(.mbar)
  bar: "flex items-center gap-2.5 bg-white px-5 pb-3.5 pt-0.5",
  step: `${STEP} cursor-pointer bg-blue text-white hover:bg-blue-d`,
  stepOff: `${STEP} cursor-not-allowed bg-bg text-t4`,
  pick: "flex flex-none cursor-pointer items-center gap-1.5 border-0 bg-transparent px-1 text-[22px] font-extrabold tracking-[-0.03em] text-t1 [&_svg]:size-4 [&_svg]:text-t4",
  count: `${COUNT} bg-blue-t text-blue-d`,
  countZero: `${COUNT} bg-bg text-t3`,

  scroll: "min-h-0 flex-1 overflow-auto border-t border-line bg-[#f7f8fa] px-4 pb-6 pt-3.5",
  none: "px-5 py-10 text-center text-[14px] font-semibold text-t3",

  // 세대 카드(.ucell)
  ucell: "mb-2.5 overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgba(23,31,40,0.06)]",
  uhead: "flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-4 py-[17px] text-left",
  uho: "flex-none text-[16px] font-extrabold tabular-nums tracking-[-0.01em] text-t1",
  unm: "flex-none text-[14px] font-semibold text-t2",
  chipNew: `${CHIP} bg-blue text-white`,
  chipOff: `${CHIP} bg-bg text-t3`,
  chipOn: `${CHIP} bg-blue-t text-blue-d`,
  uchev: CHEV,
  uchevOpen: `${CHEV} rotate-180`,
  ubody: "border-t border-line2 px-4 pb-[18px]",

  // 공과금 묶음(.grp)
  grp: "border-b border-line2 py-[13px]",
  grpT: "flex items-center gap-2 pb-[9px] text-[14px] font-bold text-t1",
  grpUnit: "text-[11.5px] font-semibold not-italic text-t3",
  hist: `${HIST} text-t3 [&_b]:text-t4`,
  histUp: `${HIST} text-red [&_b]:text-red [&_b]:opacity-70`,
  g2: "grid grid-cols-2 gap-[9px]",
  fld: "flex min-w-0 flex-col gap-1.5",
  fldLabel: "text-[12px] font-semibold text-t3",
  fin: `${FIN} border-line bg-white text-t1 focus:border-blue focus:ring-[3px] focus:ring-blue-t`,
  finRo: `${FIN} pointer-events-none border-transparent bg-bg text-t2`,
  warn: "mt-[9px] flex items-center gap-[7px] rounded-[11px] bg-red-t px-[11px] py-[9px] text-[12.5px] font-bold text-red [&_svg]:size-[15px] [&_svg]:flex-none",

  // 입주 정보 행(.row)
  row: "flex items-center gap-3 border-b border-line2 py-3",
  rowCol: "flex flex-col items-stretch gap-[7px] border-b border-line2 py-3",
  rowLabel: `${ROW_LABEL} w-[92px]`,
  rowLabelAuto: ROW_LABEL,
  rov: "min-w-0 flex-1 text-right text-[14.5px] font-semibold tabular-nums text-t1",
  memo: "min-w-0 flex-1 whitespace-pre-wrap break-all text-left text-[14.5px] font-semibold leading-[1.5] text-t1",
  tels: "flex flex-1 flex-wrap justify-end gap-[7px]",
  telNone: "text-[13.5px] font-semibold text-t3",
  dues: "mt-[11px] grid grid-cols-2 gap-[9px]",
  sum: "mt-3 flex items-center justify-between gap-2.5 rounded-[13px] bg-blue-t2 px-3.5 py-[13px] text-[13.5px] font-bold text-blue-d",
  sumValue: "text-[17px] font-extrabold tabular-nums tracking-[-0.02em]",

  // 년월 선택 시트(.mm)
  sheet: "fixed inset-0 z-[90] flex items-end justify-center bg-scrim",
  sheetBody: "w-full max-w-[440px] rounded-t-[20px] bg-white px-5 pb-[22px] pt-2 leading-[normal]",
  sheetGrab: "mx-auto mb-3.5 h-1 w-9 rounded-[2px] bg-line",
  sheetTitle: "mb-3.5 text-[16px] font-extrabold tracking-[-0.02em]",
  sheetHead: "mb-3.5 flex items-center justify-between gap-2.5",
  sheetYear: "text-[17px] font-extrabold tracking-[-0.02em]",
  sheetNav: `${NAV} cursor-pointer text-t2`,
  sheetNavOff: `${NAV} cursor-not-allowed text-t4`,
  sheetGrid: "grid grid-cols-3 gap-2",
  sheetCell: `${CELL} cursor-pointer bg-bg text-t1 hover:bg-[#e4e8ec]`,
  sheetCellOn: `${CELL} cursor-pointer bg-blue text-white`,
  sheetCellOff: `${CELL} cursor-not-allowed bg-[#f7f8fa] text-t4`,
  sheetNote: "mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-t3",
  sheetNoteSwatch: "inline-block size-[11px] rounded-[4px] border border-line bg-[#f7f8fa]",
} as const;

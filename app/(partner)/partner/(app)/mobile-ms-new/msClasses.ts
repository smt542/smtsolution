// 정본 `partner/mobile-ms-new/mobile-ms-new.dc.html` 규격.
// 줄높이는 정본 normal이다 — 루트 `leading-[normal]`을 상속하도록 글자 크기는 px로 쓴다(text-sm·text-xs는 줄높이까지 정한다).
// 입력칸은 놓인 자리마다 정본 규칙이 달라(`.row .fin`·`.fld>.fin`·`.feer .fin`·`.etcr .fin`) 자리별로 완성된 한 벌을 둔다.
// 같은 속성 유틸 두 개를 이어 붙이면 class 순서가 아니라 CSS 생성 순서가 이긴다.
const FIN =
  "min-w-0 rounded-[12px] border border-line bg-white px-[13px] font-semibold text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t";
const NUM = "text-right tabular-nums";
const LABEL = "text-[13.5px] font-semibold text-t3";
const XBTN = "flex size-[34px] flex-none items-center justify-center rounded-[10px] bg-bg text-t3 [&_svg]:size-[15px]";

export const msClasses = {
  root: "flex min-h-0 flex-1 flex-col bg-white leading-[normal]",
  header: "flex items-center gap-2.5 px-4 pb-3 pt-3.5",
  back: "flex size-[38px] flex-none items-center justify-center rounded-xl border-0 bg-transparent text-t2 hover:bg-bg [&_svg]:size-[22px]",
  titleWrap: "min-w-0 flex-1",
  title: "text-[20px] font-extrabold tracking-[-0.02em]",
  sub: "mt-0.5 truncate text-[13px] font-semibold text-t3",
  doc: "inline-flex h-9 flex-none items-center gap-[5px] rounded-[11px] bg-blue px-3 text-[13px] font-bold text-white hover:bg-blue-d [&_svg]:size-[15px]",
  scroll: "min-h-0 flex-1 overflow-auto px-5 pb-6 pt-0.5",

  // 섹션 `.sec`·`.sec-t`
  sec: "mb-3 rounded-[16px] border border-line px-4 pb-3.5 pt-1",
  secHead: "flex cursor-pointer select-none items-center gap-2 pb-1 pt-3.5 text-[15px] font-semibold text-t1",
  secToggle: "flex min-w-0 flex-1 items-center gap-2 text-left",
  secHint: "font-bold text-t4",
  chev: "size-[18px] flex-none text-t1 transition-transform duration-[180ms] ease-[ease]",
  chevFold: "-rotate-90",

  // 행 `.row`
  row: "flex items-center gap-3 border-b border-line2 py-[11px] last:border-b-0",
  rowCol: "flex flex-col items-stretch gap-2 border-b border-line2 py-[11px] last:border-b-0",
  rowLabel: `w-[96px] flex-none ${LABEL}`,
  rowColLabel: LABEL,
  checkLabel: `w-[118px] flex-none ${LABEL}`,
  rowInput: `${FIN} h-12 w-full flex-1 text-[16px]`,
  rowNum: `${FIN} h-12 w-full flex-1 text-[16px] ${NUM}`,
  textarea: `${FIN} h-[92px] w-full flex-none resize-y py-3 text-[16px] leading-[1.6]`,

  // 공과금 카드 `.ucard`(항목은 한 줄에 하나)
  ucard: "mt-2.5 rounded-[14px] border border-line px-[13px] pb-3 pt-2.5",
  ucardTitle: "flex items-center gap-2 pb-0.5 pt-1 text-[14px] font-extrabold",
  ucardFields: "mt-2 grid grid-cols-1 gap-2.5",
  fld: "flex min-w-0 flex-col gap-1.5",
  fldPayDate: "mt-2 flex min-w-0 flex-col gap-1.5",
  fldLabel: "text-[12px] font-bold text-t3",
  fldInput: `${FIN} h-12 w-full flex-none text-[16px]`,
  // 입금계좌: 은행·계좌번호·예금주가 한 줄에 다 보이게 글자를 조금 줄이고, 오른쪽에 복사 버튼 자리를 둔다.
  fldAcctWrap: "relative",
  fldAcctInput: `${FIN} h-12 w-full flex-none pr-[64px] text-[14.5px] tabular-nums`,
  fldCopy:
    "absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-[9px] bg-blue-t px-3 text-[13px] font-bold text-blue-d disabled:opacity-40",
  fldNum: `${FIN} h-12 w-full flex-none text-[16px] ${NUM}`,
  calc: "mt-2.5 flex items-center justify-between gap-2.5 border-t border-line px-px pb-0.5 pt-[11px] text-[13px] font-bold text-t2",
  calcValue: "text-[14.5px] font-extrabold tabular-nums text-t1",
  calcAmount: "whitespace-nowrap text-[14.5px] font-extrabold tabular-nums text-t1",
  calcSub: "mt-3.5 flex items-center justify-center gap-[9px] border-t border-line px-px pb-0.5 pt-3.5 text-[13.5px] font-bold text-t2",
  calcSubValue: "text-[16px] font-extrabold tabular-nums text-blue-d",

  // 관리비 항목 `.feer`
  feer: "flex items-center gap-2 border-b border-line2 py-[9px] last:border-b-0",
  feerName: "flex min-w-0 flex-1 items-center gap-1.5 text-[13.5px] font-semibold text-t1",
  tag: "rounded-[5px] bg-blue-t px-[5px] py-0.5 text-[10.5px] font-extrabold not-italic text-blue-d",
  feerInput: `${FIN} h-11 w-[112px] flex-none text-[15px] ${NUM}`,
  feerVal: "flex w-[88px] flex-none items-center justify-end text-right text-[14px] font-bold tabular-nums text-t2",
  feeExtra: "mt-3 grid grid-cols-2 gap-2",

  // 기타 `.etcr` — [항목 추가]는 섹션 머리에 있다
  mini: "h-[30px] flex-none rounded-[9px] border border-line bg-white px-[11px] text-[12.5px] font-bold text-t2 hover:border-t4 disabled:opacity-50",
  etcr: "flex items-center gap-2 py-2",
  etcName: `${FIN} h-11 w-full flex-1 text-[15px]`,
  etcAmount: `${FIN} h-11 w-[112px] flex-none text-[15px] ${NUM}`,
  xbtn: XBTN,
  // 정본: 항목이 하나뿐이면 삭제 버튼 자리만 남기고 숨긴다(visibility:hidden)
  xbtnHidden: `invisible ${XBTN}`,
  emptyHint: "px-0.5 py-4 text-center text-[13.5px] font-semibold text-t3",

  // 합계 `.sec.tot`
  tot: "mb-3 rounded-[16px] border border-blue bg-blue px-4 pb-3.5 pt-1",
  totHead: "flex cursor-default items-center gap-2 pb-1 pt-3.5 text-[15px] font-semibold text-white",
  srow: "flex items-center justify-between gap-2.5 border-b border-white/20 py-2.5 text-[13.5px] font-medium text-white",
  srowValue: "text-[15px] font-extrabold tabular-nums text-white",
  stot: "mt-3 flex items-center justify-between gap-2.5 rounded-[14px] bg-white px-[15px] py-3.5 text-[14px] font-bold text-blue-d",
  stotValue: "text-[19px] font-extrabold tabular-nums tracking-[-0.02em] text-blue-d",
  // 음수 = 빨강(정본 `.sec.tot .stot b.neg`)
  stotValueNeg: "text-[19px] font-extrabold tabular-nums tracking-[-0.02em] text-red",

  none: "px-5 py-10 text-center text-[14px] font-semibold text-t3",
  // 내역서 바텀시트(정본 `.rc`·`.sheet`)
  statementScrim: "fixed inset-0 z-[140] flex flex-col bg-scrim",
  statementStage: "flex min-h-0 flex-1 items-center justify-center p-[18px]",
  statementCard: "flex max-h-full w-[396px] max-w-full flex-col overflow-hidden rounded-2xl bg-white",
  statementBody: "min-h-0 flex-1 overflow-auto",
  statementSheet: "w-full bg-white px-6 pb-6 pt-[22px]",
  statementBrand: "flex items-center gap-2 pb-4",
  statementMark: "flex size-6 flex-none items-center justify-center",
  statementMarkImage: "block size-6 object-contain",
  statementWordmark: "text-[15px] font-extrabold tracking-[-0.02em] text-[#16375a]",
  statementWordmarkAccent: "not-italic text-[#17a493]",
  statementHeader: "flex items-start justify-between gap-3 border-b-2 border-t1 pb-4",
  statementTitle: "m-0 text-[19px] font-extrabold tracking-[-0.02em]",
  statementLocation: "mt-1.5 text-[13px] font-semibold text-t2",
  statementDate: "text-right text-xs font-semibold leading-[1.6] text-t3",
  statementDateValue: "text-[13px] text-t1",
  statementGroup: "mt-[18px] mb-1.5 text-[13px] font-bold text-t3",
  statementRow: "flex items-center justify-between gap-2.5 border-b border-line2 py-[9px] text-[13.5px] font-medium text-t2",
  statementRowLabel: "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
  statementRowMeta: "text-t4",
  statementRowValue: "whitespace-nowrap text-[14px] font-bold tabular-nums text-t1",
  statementSum: "mt-4 flex items-center justify-between gap-2.5 rounded-[13px] bg-blue px-4 py-[15px] text-[14px] font-bold text-white",
  statementSumNegative: "bg-[#FDECEE] text-red",
  statementSumValue: "text-[19px] font-extrabold tracking-[-0.02em] tabular-nums",
  statementNote: "mt-3.5 whitespace-pre-wrap text-xs font-medium leading-[1.7] text-t3",
  statementAccount: "mt-3.5 rounded-xl border border-line bg-[#F7F9FA] px-3.5 py-3",
  statementAccountLabel: "block text-xs font-bold text-t3",
  statementAccountValue: "mt-1.5 block break-all text-[13.5px] font-extrabold leading-[1.45] tabular-nums text-t1",
  statementFooter: "mt-[18px] border-t border-line pt-3.5 text-[11.5px] font-medium leading-[1.6] text-t4",
  statementActions: "flex flex-none gap-[9px] border-t border-line bg-white px-3.5 pb-3.5 pt-3",
} as const;

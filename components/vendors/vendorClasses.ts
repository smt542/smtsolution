/** Tailwind class recipes for the vendor management workspace. */
export const vendorClasses = {
  workspace:
    "flex h-full min-h-0 items-stretch gap-4 max-md:h-auto max-md:min-h-full max-md:flex-col max-md:overflow-visible",
  categories:
    "flex w-[230px] min-h-0 flex-none flex-col overflow-hidden rounded-2xl bg-surface shadow-card max-md:w-full max-md:max-h-[280px]",
  categoryHeader: "flex items-center gap-2 border-b border-line2 px-4 py-3.5",
  categoryTitle: "text-sm font-extrabold leading-[normal] text-t1",
  categoryList: "flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto p-2",
  // 색·배경은 상태별 클래스에만 둔다. 기본에 text-t2를 두고 선택 클래스(text-blue)를 이어 붙이면
  // Tailwind 출력 순서상 text-t2가 이겨 선택 항목 글자가 회색으로 남는다(정본 .vm-cat.on은 청록).
  categoryItem:
    "relative flex w-full items-center gap-2 rounded-[10px] px-[11px] py-[9px] text-left text-[13.5px] font-bold leading-[normal] transition-colors duration-100 focus-visible:outline-none",
  categoryItemIdle: "text-t2 hover:bg-bg focus-visible:bg-bg",
  categoryItemActive: "bg-blue-t text-blue",
  categoryLabel: "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
  categoryCount:
    "ml-auto min-w-[22px] rounded-pill px-[9px] py-px text-center text-xs font-bold leading-[normal] transition-opacity duration-100",
  categoryCountIdle: "bg-bg text-t2",
  categoryCountActive: "bg-surface text-blue",
  panel:
    "flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-surface shadow-card max-md:min-h-[480px]",
  panelHeader:
    "flex flex-none flex-wrap items-center gap-2.5 gap-y-2 border-b border-line2 px-[18px] py-[15px]",
  panelTitle: "text-[15px] font-extrabold leading-[normal] text-t1",
  countBadge: "inline-flex items-center rounded-[7px] bg-bg px-[9px] py-[3px] text-xs font-bold leading-[1.4] text-t3",
  panelSpacer: "flex-1 max-md:hidden",
  search:
    "h-9 max-w-[260px] flex-1 rounded-[10px] border border-line bg-surface px-3 text-[13.5px] font-semibold leading-[normal] text-t1 outline-none placeholder:text-[#757575] focus:border-blue max-md:order-3 max-md:max-w-none",
  addButton:
    "inline-flex h-10 flex-none items-center gap-1.5 whitespace-nowrap rounded-btn bg-blue px-[15px] text-[13.5px] font-bold leading-[normal] text-white shadow-hf-btn hover:bg-blue-d focus-visible:bg-blue-d focus-visible:outline-none",
  tableWrap: "min-h-0 flex-1 overflow-auto",
  table:
    "w-full min-w-[560px] border-collapse [&_th]:border-b [&_th]:border-line [&_th]:bg-[#fbfcfd] [&_th]:px-4 [&_th]:py-[11px] [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_th]:leading-[normal] [&_th]:text-t3 [&_th]:whitespace-nowrap [&_th:first-child]:w-[150px] [&_td]:border-b [&_td]:border-line2 [&_td]:px-4 [&_td]:py-3 [&_td]:text-[13.5px] [&_td]:font-semibold [&_td]:leading-[normal] [&_td]:text-t2 [&_td]:whitespace-nowrap [&_tbody_tr:last-child_td]:border-b-0",
  vendorRow:
    "cursor-pointer transition-colors duration-100 hover:[&_td]:bg-row-hover focus-visible:[&_td]:bg-row-hover focus-visible:outline-2 focus-visible:outline-blue focus-visible:outline-offset-[-2px]",
  vendorName: "!font-bold !text-t1",
  stateCell: "h-[72px] !text-center !font-medium !text-t4",
  loadingCell: "flex h-full min-h-[240px] items-center justify-center text-center",
  dialog:
    "relative max-w-[520px] overflow-visible rounded-modal! p-0! shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)] [&>h2]:flex [&>h2]:h-[68px] [&>h2]:items-center [&>h2]:border-b [&>h2]:border-line [&>h2]:px-[22px] [&>h2]:pr-14 [&>h2]:text-[17px] [&>h2]:font-extrabold [&>h2]:tracking-[-0.02em] [&>div]:mt-0!",
  closeButton:
    "absolute right-4 top-[18px] z-[1] size-8 rounded-[9px] text-t3 hover:bg-bg hover:text-t1 focus-visible:bg-bg focus-visible:text-t1 focus-visible:outline-none",
  formCategory: "px-[22px] pb-0.5 pt-[18px]",
  formBody: "overflow-visible px-[22px] pb-5 pt-3",
  formFields: "h-[439px] overflow-y-auto",
  categoryHelp: "px-0 py-2 text-[13px] font-semibold text-t4",
  formGrid: "grid grid-cols-2 gap-x-3.5 gap-y-3 max-md:grid-cols-1",
  fullField: "col-span-full max-md:col-auto",
  fieldLabel: "mb-[5px] block text-xs font-bold text-t2",
  fieldInput:
    "h-10 w-full rounded-[9px] border border-line bg-surface px-[11px] text-[13.5px] font-semibold text-t1 outline-none placeholder:font-medium placeholder:text-t3 focus:border-blue",
  fieldTextarea:
    "min-h-[58px] w-full resize-y rounded-[9px] border border-line bg-surface px-[11px] py-[9px] text-[13.5px] font-semibold text-t1 outline-none placeholder:font-medium placeholder:text-t3 focus:border-blue",
  fieldError: "mt-[5px] text-xs font-semibold text-red",
  categoryDropdown: "relative w-full",
  categoryControl:
    "flex h-11 w-full items-center justify-between gap-2 rounded-[9px] border border-line bg-surface px-[11px] text-[13.5px] font-bold text-t1 outline-none focus-visible:border-blue",
  categoryValue: "overflow-hidden text-ellipsis whitespace-nowrap",
  categoryChevron: "flex-none text-t3 transition-transform duration-150",
  categoryMenu:
    "absolute left-0 right-0 top-[calc(100%+5px)] z-[90] max-h-[240px] overflow-auto rounded-xl border border-line bg-surface p-1.5 shadow-[0_14px_34px_-10px_rgba(23,31,40,0.28)]",
  categoryOption:
    "block w-full whitespace-nowrap rounded-lg px-[11px] py-[9px] text-left text-[13px] font-semibold text-t2 hover:bg-bg focus-visible:bg-bg focus-visible:outline-none",
  categoryOptionSelected: "bg-blue-t font-bold text-blue hover:bg-blue-t focus-visible:bg-blue-t",
  formFooter: "flex gap-[9px] border-t border-line px-[22px] py-[14px]",
  footerButton:
    "inline-flex h-10 items-center justify-center gap-[7px] rounded-btn px-5 text-[13.5px] font-bold tracking-[-0.01em]",
  submitButton: "flex-1 bg-blue text-white hover:bg-blue-d disabled:cursor-default disabled:opacity-60",
  // 정본 파일의 .fmpc-btn.danger는 연빨강이지만 뒤에 붙는 공용 메신저 CSS가 솔리드 빨강으로 덮는다(렌더 실측).
  deleteButton: "flex-none bg-red text-white hover:bg-[#d63a46]",
} as const;

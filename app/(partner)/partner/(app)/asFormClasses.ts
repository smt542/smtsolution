export const asFormClasses = {
  // 정본은 줄높이를 정하지 않아 normal이다. 앱 기본(1.5)을 물려받으면 글자 행이 4~5px 커진다.
  root: "flex min-h-0 flex-1 flex-col bg-white leading-[normal]",
  scroll: "min-h-0 flex-1 overflow-auto px-5 pb-6 pt-0.5",
  // 정본 `.sec`: 테두리 없는 흰 카드 안에 제목과 행이 함께 들어간다.
  sec: "mb-3 rounded-[18px] bg-white px-4 py-1.5",
  secTitle: "pb-1.5 pt-3.5 text-[13px] font-extrabold text-t3",
  req: "ml-0.5 text-red",
  ro: "min-w-0 flex-1 text-right text-[15px] font-semibold text-t1",
  // 담당 건이 아닐 때 접수 내용·처리결과 내용(정본 `.ro` + 인라인 왼쪽 정렬·줄바꿈 보존)
  roText: "min-w-0 flex-1 whitespace-pre-wrap break-all text-left text-[15px] font-semibold leading-[1.55] text-t1",
  control: "h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-[15px] font-semibold text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t disabled:bg-bg disabled:text-t2 disabled:[-webkit-text-fill-color:var(--t2)] disabled:opacity-100",
  pickerRoot: "min-w-0 flex-1",
  picker: "h-11 w-full rounded-xl border border-line bg-white px-3 text-[15px] font-semibold text-t1 outline-none flex items-center gap-2 text-left cursor-pointer disabled:cursor-default disabled:bg-bg disabled:text-t2 disabled:[-webkit-text-fill-color:var(--t2)] disabled:opacity-100",
  pickerOpen: "border-blue ring-[3px] ring-blue-t",
  // 정본 `.fin`(48px) + 인라인 `flex:1;text-align:right`
  time: "h-12 min-w-0 flex-1 rounded-[13px] border border-line bg-white px-3.5 text-right text-[15px] font-semibold text-t1 outline-none placeholder:text-[#757575] focus:border-blue focus:ring-[3px] focus:ring-blue-t",
  // 정본 `.fin.ta`
  textarea: "h-28 w-full resize-y rounded-[13px] border border-line bg-white px-3.5 py-[13px] text-[15px] font-semibold leading-[1.6] text-t1 outline-none placeholder:text-[#757575] focus:border-blue focus:ring-[3px] focus:ring-blue-t",
  note: "flex-1 self-center text-center text-[13px] font-semibold leading-[1.5] text-t3",
  none: "px-5 py-10 text-center text-sm font-semibold text-t3",
} as const;

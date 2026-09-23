export const profileClasses = {
  root: "flex min-h-0 flex-1 flex-col bg-white",
  header: "px-5 pb-4 pt-[22px] text-[22px] font-extrabold tracking-[-0.02em]",
  scroll: "min-h-0 flex-1 overflow-auto px-5 pb-6 pt-0.5",
  card: "flex flex-col items-center gap-3.5 rounded-[20px] border border-line px-[18px] py-7 text-center",
  avatar: "flex size-[72px] flex-none items-center justify-center rounded-full bg-blue-t text-[25px] font-extrabold text-blue-d",
  name: "text-[19px] font-extrabold tracking-[-0.01em]",
  phone: "mt-[5px] text-[14.5px] font-semibold tabular-nums text-t3",
  rows: "flex w-full flex-col gap-2.5 border-t border-line2 pt-3.5",
  row: "flex items-center justify-between gap-3",
  rowLabel: "text-[13.5px] font-semibold text-t3",
  rowValue: "text-[14.5px] font-bold tabular-nums",
} as const;

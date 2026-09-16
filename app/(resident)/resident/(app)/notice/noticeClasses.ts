export const noticeClasses = {
  page: "flex min-h-0 flex-1 flex-col bg-bg",
  scroll: "min-h-0 flex-1 overflow-auto px-5 pb-7 pt-4",
  list: "block overflow-hidden rounded-[18px] bg-white shadow-[0_1px_3px_rgba(25,31,40,0.06)] [&>a]:relative [&>a]:block [&>a]:min-h-[86px] [&>a]:border-b [&>a]:border-line2 [&>a]:px-[46px] [&>a]:py-[17px] [&>a]:text-t1 [&>a]:no-underline [&>a:last-child]:border-b-0 [&_strong]:mt-[9px] [&_strong]:block [&_strong]:text-[15px] [&_strong]:leading-[1.45]",
  rowTop: "flex items-center gap-[9px] [&_time]:text-[11px] [&_time]:font-bold [&_time]:text-t3",
  badge: "rounded-[7px] px-2 py-1 text-[10px] font-black",
  normal: "bg-bg text-t2",
  important: "bg-amber-t text-amber",
  urgent: "bg-red-t text-red",
  chevron: "absolute right-[17px] top-1/2 w-[18px] -translate-y-1/2 fill-none stroke-t4 stroke-2 stroke-linecap-round stroke-linejoin-round",
  center: "flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center text-[13px] text-t3 [&_b]:text-[17px] [&_b]:text-t1 [&_button]:mt-4 [&_button]:h-[42px] [&_button]:rounded-xl [&_button]:border-0 [&_button]:bg-blue [&_button]:px-[17px] [&_button]:font-extrabold [&_button]:text-white",
  empty: "flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center text-[13px] text-t3 [&_b]:text-[17px] [&_b]:text-t1 [&_span]:mt-[7px]",
  spinner: "mb-3 size-[27px] animate-[spin_0.8s_linear_infinite] rounded-full border-[3px] border-blue-t border-t-blue",
} as const;

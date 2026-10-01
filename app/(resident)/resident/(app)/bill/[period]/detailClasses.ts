export const billDetailPageClasses = {
  page: "flex min-h-0 flex-1 flex-col bg-[#f7f8fa] leading-[normal]",
  scroll: "min-h-0 flex-1 overflow-auto px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-4",
  center: "flex min-h-[260px] flex-1 flex-col items-center justify-center px-6 py-10 text-center text-[14px] text-t3 [&_b]:text-[18px] [&_b]:text-t1 [&_button]:mt-4 [&_button]:min-h-[42px] [&_button]:rounded-xl [&_button]:border-0 [&_button]:bg-blue [&_button]:px-[18px] [&_button]:font-extrabold [&_button]:text-white",
  empty: "flex min-h-[260px] flex-1 flex-col items-center justify-center px-6 py-10 text-center text-[14px] text-t3 [&_b]:text-[18px] [&_b]:text-t1 [&_span]:mt-2",
} as const;

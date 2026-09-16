export const noticeDetailClasses = {
  page: "flex min-h-0 flex-1 flex-col bg-white",
  scroll: "min-h-0 flex-1 overflow-auto",
  article: "px-[22px] pb-12 pt-7",
  badge: "inline-block rounded-lg px-[9px] py-[5px] text-[10px] font-black",
  normal: "bg-bg text-t2",
  important: "bg-amber-t text-amber",
  urgent: "bg-red-t text-red",
  metadata: "mt-2.5 flex gap-1.5 text-xs font-bold text-t3",
  content: "mt-[26px] border-t border-line2 pt-6 text-[15px] leading-[1.8] text-t2 [overflow-wrap:anywhere]",
  center: "flex min-h-0 flex-1 flex-col items-center justify-center gap-[13px] px-6 py-10 text-center text-[13px] text-t3 [&_b]:text-[17px] [&_b]:text-t1 [&_a]:inline-flex [&_a]:h-[42px] [&_a]:items-center [&_a]:rounded-xl [&_a]:bg-blue [&_a]:px-[17px] [&_a]:font-extrabold [&_a]:text-white [&_a]:no-underline",
} as const;

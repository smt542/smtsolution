export const noticeDetailClasses = {
  page: "flex min-h-0 flex-1 flex-col bg-white leading-[normal]",
  scroll: "min-h-0 flex-1 overflow-auto px-6 pt-[22px] pb-[calc(env(safe-area-inset-bottom)+78px)]",
  tag: "inline-flex items-center gap-[5px] rounded-lg px-2.5 py-[5px] text-[11.5px] font-extrabold animate-[rise10_0.45s_cubic-bezier(0.22,0.61,0.36,1)_both] [animation-delay:0s]",
  normal: "bg-bg text-t3",
  important: "bg-amber-t text-amber",
  urgent: "bg-red text-white",
  title: "mt-3 text-[22px] font-extrabold leading-[1.4] tracking-[-0.03em] animate-[rise10_0.45s_cubic-bezier(0.22,0.61,0.36,1)_both] [animation-delay:0.04s]",
  metadata: "mt-2.5 flex items-center gap-[7px] border-b border-line2 pb-[18px] text-[12.5px] font-semibold text-t4 animate-[rise10_0.45s_cubic-bezier(0.22,0.61,0.36,1)_both] [animation-delay:0.08s]",
  content: "pt-[18px] text-[14.5px] font-medium leading-[1.8] text-t2 [text-wrap:pretty] [overflow-wrap:anywhere] animate-[rise10_0.45s_cubic-bezier(0.22,0.61,0.36,1)_both] [animation-delay:0.12s]",
  center: "flex min-h-0 flex-1 flex-col items-center justify-center gap-[13px] px-6 py-10 text-center text-[13px] text-t3 [&_b]:text-[17px] [&_b]:text-t1 [&_a]:inline-flex [&_a]:h-[42px] [&_a]:items-center [&_a]:rounded-xl [&_a]:bg-blue [&_a]:px-[17px] [&_a]:font-extrabold [&_a]:text-white [&_a]:no-underline",
} as const;

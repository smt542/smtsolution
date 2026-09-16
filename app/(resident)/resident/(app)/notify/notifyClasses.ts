export const notifyClasses = {
  items: "mt-6 animate-[rise_0.5s_120ms_cubic-bezier(0.22,0.61,0.36,1)_both]",
  item: "flex items-start gap-[13px] border-b border-line2 py-[17px] last:border-b-0",
  icon: "flex size-[42px] flex-none items-center justify-center rounded-[14px] bg-blue-t2 text-blue-d [&_svg]:size-[21px]",
  text: "min-w-0 flex-1 [&_b]:block [&_b]:text-[15.5px] [&_b]:font-bold [&_b]:tracking-[-0.01em] [&_span]:mt-1 [&_span]:block [&_span]:text-[13px] [&_span]:font-medium [&_span]:leading-[1.6] [&_span]:text-t3",
  note: "mt-[18px] rounded-[13px] bg-bg px-[15px] py-3.5 text-[12.5px] font-semibold leading-[1.65] text-t3 animate-[rise_0.5s_180ms_cubic-bezier(0.22,0.61,0.36,1)_both]",
  primaryButton: "h-14 w-full rounded-2xl bg-blue text-[16.5px] font-bold tracking-[-0.02em] text-white transition-transform hover:bg-blue-d active:scale-[0.985]",
} as const;

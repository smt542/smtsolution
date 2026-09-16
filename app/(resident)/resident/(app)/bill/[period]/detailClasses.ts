export const billDetailPageClasses = {
  page: "flex min-h-0 flex-1 flex-col bg-bg",
  header: "grid min-h-[58px] flex-none grid-cols-[44px_1fr_44px] items-center bg-white px-3.5 pb-2 pt-[calc(env(safe-area-inset-top)+8px)] [&_button]:flex [&_button]:size-10 [&_button]:items-center [&_button]:justify-center [&_button]:rounded-xl [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-t2 [&_button:hover]:bg-blue-t2 [&_button:hover]:text-blue-d [&_svg]:size-[22px] [&_h1]:m-0 [&_h1]:text-center [&_h1]:text-[17px]",
  scroll: "min-h-0 flex-1 overflow-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-4",
  center: "flex min-h-[260px] flex-1 flex-col items-center justify-center px-6 py-10 text-center text-sm text-t3 [&_b]:text-lg [&_b]:text-t1 [&_button]:mt-4 [&_button]:min-h-[42px] [&_button]:rounded-xl [&_button]:border-0 [&_button]:bg-blue [&_button]:px-[18px] [&_button]:font-extrabold [&_button]:text-white",
  empty: "flex min-h-[260px] flex-1 flex-col items-center justify-center px-6 py-10 text-center text-sm text-t3 [&_b]:text-lg [&_b]:text-t1 [&_span]:mt-2",
} as const;

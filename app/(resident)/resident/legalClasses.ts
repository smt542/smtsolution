export const legalClasses = {
  lead: "border-b border-line2 pb-[18px] text-[13px] font-semibold leading-[1.7] text-t3 [&_b]:font-bold [&_b]:text-t2",
  table: "my-[10px] overflow-hidden rounded-[13px] border border-line",
  row: "flex border-b border-line2 last:border-b-0 [&>div]:break-keep [&>div]:px-[13px] [&>div]:py-[11px] [&>div]:text-[12.5px] [&>div]:font-medium [&>div]:leading-[1.6] [&>div]:text-t2 [&>div:first-child]:w-[110px] [&>div:first-child]:flex-none [&>div:first-child]:bg-[#fafbfc] [&>div:first-child]:font-bold [&>div:first-child]:text-t1 [&>div:last-child]:min-w-0 [&>div:last-child]:flex-1",
  headerRow: "[&>div]:bg-bg [&>div]:text-xs [&>div]:font-extrabold [&>div]:text-t1",
  box: "my-[10px] rounded-[13px] bg-bg px-[15px] py-3.5 [&_li]:mb-1",
  tail: "mt-[30px] border-t border-line2 pt-4 text-[12.5px] font-semibold leading-[1.7] text-t4",
} as const;

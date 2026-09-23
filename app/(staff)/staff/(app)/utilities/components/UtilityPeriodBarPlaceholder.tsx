import { Button } from "@/components/common";

interface UtilityPeriodBarPlaceholderProps {
  period: string;
}

export function UtilityPeriodBarPlaceholder({ period }: UtilityPeriodBarPlaceholderProps) {
  const [year, month] = period.split("-").map(Number);

  return (
    <section className="sticky top-0 z-[4] flex min-h-[52px] shrink-0 flex-wrap items-center gap-2.5 rounded-[12px] border border-line bg-white px-[14px] py-[10px] shadow-[0_1px_3px_rgba(23,31,40,0.05)]">
      <div className="mr-auto min-w-[150px]">
        <p className="truncate text-[12.5px] font-bold text-t3">건물 미선택</p>
        <p className="mt-px text-[11.5px] font-medium text-t3">{year}년 {month}월분 부과 편집</p>
      </div>
      <div className="flex items-center gap-1.5 opacity-55">
        <span className="mr-1 text-[11.5px] font-bold text-t2">부과기준일</span>
        <span className="flex h-7 min-w-[106px] items-center justify-center rounded-[8px] border border-line2 bg-bg px-[10px] text-[12px] font-medium text-t4">시작일</span>
        <span className="text-[12px] font-bold text-t2">~</span>
        <span className="flex h-7 min-w-[106px] items-center justify-center rounded-[8px] border border-line2 bg-bg px-[10px] text-[12px] font-medium text-t4">종료일</span>
      </div>
      <span className="mx-1 hidden h-[26px] w-px bg-line lg:block" />
      <Button variant="ghost" size="sm" type="button" disabled className="cursor-default">수정</Button>
    </section>
  );
}

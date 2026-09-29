import { Button } from "@/components/common";

interface UtilityPeriodBarPlaceholderProps {
  period: string;
}

export function UtilityPeriodBarPlaceholder({ period }: UtilityPeriodBarPlaceholderProps) {
  const [year, month] = period.split("-").map(Number);

  return (
    <section className="sticky top-0 z-[4] flex min-h-[52px] shrink-0 flex-wrap items-center gap-2.5 rounded-[12px] border border-line bg-white px-[14px] py-[10px] shadow-[0_1px_3px_rgba(23,31,40,0.05)]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold leading-[normal] text-t1">건물 미선택</p>
        <p className="mt-px text-[11.5px] font-medium leading-[normal] text-t3">{year}년 {month}월분 부과 편집</p>
      </div>
      <div className="flex flex-wrap items-center gap-[6px]">
        <span className="text-[11.5px] font-bold text-t2">부과기준일</span>
        <span className="flex h-7 min-w-[106px] items-center justify-center rounded-[8px] border border-line2 bg-bg px-[10px] text-[12px] font-medium text-t4">시작일</span>
        <span className="text-[12px] font-bold text-t2">~</span>
        <span className="flex h-7 min-w-[106px] items-center justify-center rounded-[8px] border border-line2 bg-bg px-[10px] text-[12px] font-medium text-t4">종료일</span>
      </div>
      <span aria-hidden="true" className="flex items-start px-1"><span className="h-[26px] w-px bg-line" /></span>
      {/* 정본처럼 평소 모양 그대로 두고, 건물이 없으니 눌러도 아무 동작을 하지 않는다. */}
      <Button variant="ghost" size="sm" type="button">수정</Button>
    </section>
  );
}

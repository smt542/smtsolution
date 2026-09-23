"use client";

interface BillingSectionToolbarProps {
  hasBuildings: boolean;
  pending?: boolean;
  onCarryBuilding: () => void;
  onCarryAll: () => void;
}

const miniClass =
  "h-[26px] rounded-[8px] border border-line bg-white px-[10px] text-[11.5px] font-bold text-t2 transition-[border-color,background-color] duration-[120ms] hover:border-[#C9D0D8] hover:bg-[#F7F9FA] disabled:cursor-not-allowed disabled:opacity-55";

export function BillingSectionToolbar({
  hasBuildings,
  pending = false,
  onCarryBuilding,
  onCarryAll,
}: BillingSectionToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-[10px] gap-y-[8px] border-b border-line2 px-[18px] py-[15px]">
      <h2 className="text-[15px] font-extrabold text-t1">세대별 관리비 항목</h2>
      <div className="ml-[10px] flex flex-none items-center gap-[6px]">
        <button type="button" className={miniClass} disabled={pending} onClick={onCarryBuilding}>
          빌라자료추가
        </button>
        <button type="button" className={miniClass} disabled={!hasBuildings || pending} onClick={onCarryAll}>
          전체자료추가
        </button>
      </div>

      <div className="ml-auto flex flex-none items-center gap-[12px]">
        <span className="inline-flex items-center gap-[5px] whitespace-nowrap text-[11.5px] font-medium text-t3">
          <i className="h-[12px] w-[3px] flex-none rounded-[2px] bg-red" />공실 사용량
        </span>
        <span className="inline-flex items-center gap-[5px] whitespace-nowrap text-[11.5px] font-medium text-t3">
          <i className="h-[12px] w-[3px] flex-none rounded-[2px] bg-green" />최근 입주
        </span>
      </div>
    </div>
  );
}

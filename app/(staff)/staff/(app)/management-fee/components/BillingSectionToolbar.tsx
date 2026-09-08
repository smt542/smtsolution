"use client";

interface BillingSectionToolbarProps {
  buildingSelected: boolean;
  hasBuildings: boolean;
  pending?: boolean;
  onCarryBuilding: () => void;
  onCarryAll: () => void;
  onCalculateUtilities: () => void;
}

const actionClass =
  "h-[32px] rounded-[9px] border border-line bg-white px-[12px] text-[12px] font-bold text-t2 transition-colors hover:border-teal hover:text-teal disabled:cursor-not-allowed disabled:bg-bg disabled:text-t4";

export function BillingSectionToolbar({
  buildingSelected,
  hasBuildings,
  pending = false,
  onCarryBuilding,
  onCarryAll,
  onCalculateUtilities,
}: BillingSectionToolbarProps) {
  return (
    <div className="flex h-[57px] shrink-0 items-center border-b border-line2 px-[18px]">
      <h2 className="mr-[14px] text-[14px] font-extrabold text-t1">세대별 관리비</h2>
      <div className="flex items-center gap-[6px]">
        <button type="button" className={actionClass} disabled={!buildingSelected || pending} onClick={onCarryBuilding}>
          빌라자료추가
        </button>
        <button type="button" className={actionClass} disabled={!hasBuildings || pending} onClick={onCarryAll}>
          전체자료추가
        </button>
        <button type="button" className={actionClass} disabled={!buildingSelected || pending} onClick={onCalculateUtilities}>
          공과금 계산
        </button>
      </div>

      <div className="ml-auto flex items-center gap-[16px] text-[11.5px] font-semibold text-t3">
        <span className="flex items-center gap-[6px]"><i className="size-[8px] rounded-full bg-[#f5b544]" />공실 사용량</span>
        <span className="flex items-center gap-[6px]"><i className="size-[8px] rounded-full bg-[#5c89f2]" />최근 입주</span>
      </div>
    </div>
  );
}

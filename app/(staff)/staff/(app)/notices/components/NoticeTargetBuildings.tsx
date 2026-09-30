"use client";

import type { Building } from "@/hooks/reactquery/buildings";
import { isAllNoticeTargets, type NoticeTargetSelection } from "../utils";
import { NoticeTargetChip } from "./NoticeTargetChip";

/**
 * 공지 대상 건물 칩 묶음(정본 notice-management `.nc-blds`). 상세 모달·등록 폼이 공유한다.
 * 전체 건물을 켜고 끄면 건물이 모두 따라가고, 건물이 모두 켜지면 전체 건물도 켜진다.
 */
export function NoticeTargetBuildings({
  buildings,
  value,
  onChange,
}: {
  buildings: Building[];
  value: NoticeTargetSelection;
  onChange: (next: NoticeTargetSelection) => void;
}) {
  const allChecked = isAllNoticeTargets(value, buildings);
  const toggleBuilding = (id: number) => {
    const ids = value === "all" ? buildings.map((building) => building.id) : value;
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };

  return (
    <div className="flex flex-col gap-[9px]">
      <span className="text-[12.5px] font-bold leading-[normal] text-[#8b95a1]">대상 건물</span>
      <div className="flex flex-wrap gap-[8px]">
        <NoticeTargetChip label="전체 건물" checked={allChecked} onClick={() => onChange(allChecked ? [] : "all")} />
        {buildings.map((building) => (
          <NoticeTargetChip
            key={building.id}
            label={building.name}
            checked={value === "all" || value.includes(building.id)}
            onClick={() => toggleBuilding(building.id)}
          />
        ))}
      </div>
    </div>
  );
}

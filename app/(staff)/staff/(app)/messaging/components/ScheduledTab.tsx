"use client";

import { DrainScheduledButton } from "./DrainScheduledButton";

export function ScheduledTab() {
  return (
    <div className="overflow-hidden rounded-[16px] bg-white shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)]">
      <div className="flex items-center gap-[8px] border-b border-[#f1f3f5] px-[18px] py-[15px]">
        <span className="text-[15px] font-extrabold text-[#191f28]">발송 예약</span>
        <div className="flex-1" />
        <DrainScheduledButton />
      </div>
      <div className="flex flex-col items-center gap-[12px] py-[60px]">
        <p className="text-[14px] text-[#8b95a1]">예약된 발송이 없습니다.</p>
      </div>
    </div>
  );
}

"use client";
import React from "react";
import { FormSection } from "../ui/FormSection";
import { EmptyState } from "@/components/common";
import { MaskedPhone } from "@/components/common/MaskedPhone";
import type { OccupancyHistory } from "@/hooks/reactquery/occupancyHistory";

const dash = (v: string | null) => (v && v.length > 0 ? v : "—");

export function MoveOutHistorySection({ history }: { history: OccupancyHistory[] }) {
  return (
    <FormSection index={6} title="전출정보" bodyPadded={false}>
      {history.length === 0 ? (
        <div className="p-[17px]">
          <EmptyState message="전출자 이력이 없습니다." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr>
                <th className="whitespace-nowrap border-b border-line bg-[#fbfcfd] px-[16px] py-[11px] text-[12px] font-bold text-t3">이사일</th>
                <th className="whitespace-nowrap border-b border-line bg-[#fbfcfd] px-[16px] py-[11px] text-[12px] font-bold text-t3">이름</th>
                <th className="whitespace-nowrap border-b border-line bg-[#fbfcfd] px-[16px] py-[11px] text-[12px] font-bold text-t3">집전화</th>
                <th className="whitespace-nowrap border-b border-line bg-[#fbfcfd] px-[16px] py-[11px] text-[12px] font-bold text-t3">전화번호(주)</th>
                <th className="whitespace-nowrap border-b border-line bg-[#fbfcfd] px-[16px] py-[11px] text-[12px] font-bold text-t3">전화번호(부)</th>
                <th className="whitespace-nowrap border-b border-line bg-[#fbfcfd] px-[16px] py-[11px] text-[12px] font-bold text-t3">입주일</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="cursor-pointer text-[13.5px] font-normal text-t1 hover:bg-row-hover [&:last-child>td]:border-b-0">
                  <td className="whitespace-nowrap border-b border-line2 px-[16px] py-[12px]">{dash(h.moveOutDate)}</td>
                  <td className="whitespace-nowrap border-b border-line2 px-[16px] py-[12px]">{dash(h.tenantName)}</td>
                  <td className="whitespace-nowrap border-b border-line2 px-[16px] py-[12px]">
                    {h.phone3 ? <MaskedPhone value={h.phone3} kind="phone" alreadyMasked reveal={{ targetKind: "occupancy_history", targetId: h.id, field: "phone3" }} /> : dash(h.phone3)}
                  </td>
                  <td className="whitespace-nowrap border-b border-line2 px-[16px] py-[12px]">
                    {h.phone ? <MaskedPhone value={h.phone} kind="phone" alreadyMasked reveal={{ targetKind: "occupancy_history", targetId: h.id, field: "phone" }} /> : dash(h.phone)}
                  </td>
                  <td className="whitespace-nowrap border-b border-line2 px-[16px] py-[12px]">
                    {h.phone2 ? <MaskedPhone value={h.phone2} kind="phone" alreadyMasked reveal={{ targetKind: "occupancy_history", targetId: h.id, field: "phone2" }} /> : dash(h.phone2)}
                  </td>
                  <td className="whitespace-nowrap border-b border-line2 px-[16px] py-[12px]">{dash(h.moveInDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FormSection>
  );
}

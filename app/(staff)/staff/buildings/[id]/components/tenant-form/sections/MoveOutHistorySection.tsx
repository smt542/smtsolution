"use client";
import React from "react";
import { FormSection } from "../ui/FormSection";
import { EmptyState } from "@/components/common";
import type { OccupancyHistory } from "@/hooks/reactquery/occupancyHistory";

const dash = (v: string | null) => (v && v.length > 0 ? v : "—");

export function MoveOutHistorySection({ history }: { history: OccupancyHistory[] }) {
  return (
    <FormSection index={6} title="전출정보">
      {history.length === 0 ? (
        <EmptyState message="전출자 이력이 없습니다." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[12px] font-semibold text-t3">
                <th className="py-[10px] pr-[12px]">이사일</th>
                <th className="py-[10px] pr-[12px]">이름</th>
                <th className="py-[10px] pr-[12px]">집전화</th>
                <th className="py-[10px] pr-[12px]">전화번호(주)</th>
                <th className="py-[10px] pr-[12px]">전화번호(부)</th>
                <th className="py-[10px]">입주일</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-line2 text-[13px] text-t1">
                  <td className="py-[10px] pr-[12px]">{dash(h.moveOutDate)}</td>
                  <td className="py-[10px] pr-[12px]">{dash(h.tenantName)}</td>
                  <td className="py-[10px] pr-[12px]">{dash(h.phone3)}</td>
                  <td className="py-[10px] pr-[12px]">{dash(h.phone)}</td>
                  <td className="py-[10px] pr-[12px]">{dash(h.phone2)}</td>
                  <td className="py-[10px]">{dash(h.moveInDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FormSection>
  );
}

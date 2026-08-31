"use client";

import { useState } from "react";
import { EmptyState, Input, Spinner } from "@/components/common";
import {
  useSettlementList,
  type SettlementStatus,
} from "@/hooks/reactquery/movingSettlement";
import { formatWon } from "@/lib/format";

const STATUS: Record<SettlementStatus, string> = {
  draft: "작성중",
  saved: "저장",
  mid_moveout: "중도퇴실",
  completed: "정산완료",
};

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const monthText = String(month).padStart(2, "0");

  return {
    from: `${year}-${monthText}-01`,
    to: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function SettlementHistory({
  buildingId,
}: {
  buildingId: number | null;
}) {
  const [initial] = useState(currentMonthRange);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const query = useSettlementList(buildingId, from, to);
  const rows = query.data ?? [];

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="mr-auto text-base font-extrabold text-t1">이사정산 이력</h2>
        <label>
          <span className="mb-1 block text-xs font-bold text-t2">시작일</span>
          <Input
            aria-label="이력 시작일"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold text-t2">종료일</span>
          <Input
            aria-label="이력 종료일"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>

      {buildingId === null && (
        <EmptyState message="건물을 선택하면 이력을 조회합니다." />
      )}
      {buildingId !== null && query.isLoading && <Spinner />}
      {buildingId !== null && query.error && (
        <EmptyState message="정산 이력을 불러오지 못했습니다." />
      )}
      {buildingId !== null &&
        !query.isLoading &&
        !query.error &&
        rows.length === 0 && (
          <EmptyState message="조회 기간의 정산 이력이 없습니다." />
        )}

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-bg">
                <th className="px-3 py-2 text-left">퇴실일</th>
                <th className="px-3 py-2 text-left">호실</th>
                <th className="px-3 py-2 text-left">입주자</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-right">정산금</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.settlementId} className="border-b border-line2">
                  <td className="px-3 py-2">{row.moveOutDate ?? "-"}</td>
                  <td className="px-3 py-2">{row.unitNo}</td>
                  <td className="px-3 py-2">{row.tenantName ?? "-"}</td>
                  <td className="px-3 py-2">{STATUS[row.status]}</td>
                  <td className="px-3 py-2 text-right">
                    {formatWon(row.settlementAmount ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

"use client";
import React from "react";
import { Modal, Spinner } from "@/components/common";
import { useBillingHistory } from "@/hooks/reactquery/billing";
import { formatNumber } from "@/lib/format";

interface Props {
  open: boolean;
  unitId: number | null;
  unitNo: string;
  period: string;
  onClose: () => void;
}

const won = (n: number) => formatNumber(n);

export function BillingHistoryModal({ open, unitId, unitNo, period, onClose }: Props) {
  const { data = [], isLoading } = useBillingHistory(open ? unitId : null, period);
  return (
    <Modal open={open} onClose={onClose} title={`${unitNo} · 6개월 부과 이력`}>
      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line2 text-left text-xs text-t2">
              <th className="py-2">부과월</th>
              <th className="py-2 text-right">총액</th>
              <th className="py-2 text-right">전월대비</th>
            </tr>
          </thead>
          <tbody>
            {data.map((h, i) => {
              const prev = data[i + 1]; // data는 최신순(period desc)
              const delta = prev ? h.totalAmount - prev.totalAmount : null;
              return (
                <tr key={h.period} className="border-b border-line2 hover:bg-row-hover">
                  <td className="py-2">{h.period.slice(0, 7)}</td>
                  <td className="py-2 text-right font-bold">{won(h.totalAmount)}</td>
                  <td
                    className={`py-2 text-right ${
                      delta !== null && delta > 0
                        ? "text-red"
                        : delta !== null && delta < 0
                          ? "text-blue-d"
                          : "text-t3"
                    }`}
                  >
                    {delta === null ? "-" : `${delta > 0 ? "+" : ""}${won(delta)}`}
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-t3">
                  확정 이력이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

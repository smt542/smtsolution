"use client";

import { Button, EmptyState, Spinner } from "@/components/common";
import { useGiroPayments, type GiroPayment } from "@/hooks/reactquery/payments";
import { ComplaintDialog } from "../../receipts/components/ComplaintDialog";

interface GiroLedgerModalProps {
  open: boolean; buildingId: number; period: string;
  isPending: boolean; onClose: () => void; onCancel: (paymentId: number) => void;
}

export function GiroLedgerModal({ open, buildingId, period, isPending, onClose, onCancel }: GiroLedgerModalProps) {
  const { data: rows = [], isLoading } = useGiroPayments(buildingId, period);
  if (!open) return null;
  return (
    <ComplaintDialog open onClose={onClose} title="지로 원장" size="large">
      {isLoading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState message="지로 수납 내역이 없습니다" />
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs font-bold text-t3">
            <th className="px-3 py-2">호실</th><th className="px-3 py-2">입주자</th>
            <th className="px-3 py-2 text-right">금액</th><th className="px-3 py-2">처리일</th>
            <th className="px-3 py-2">상태</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {rows.map((r: GiroPayment) => (
              <tr key={r.id} className={`border-b border-line ${r.status === "canceled" ? "opacity-50" : ""}`}>
                <td className="px-3 py-2">{r.dong ? `${r.dong} ${r.unitNo}` : r.unitNo}</td>
                <td className="px-3 py-2">{r.tenantName ?? "-"}</td>
                <td className="num px-3 py-2 text-right">{r.amount.toLocaleString()}</td>
                <td className="px-3 py-2">{r.paidAt}</td>
                <td className="px-3 py-2">{r.status === "canceled" ? "취소" : "완료"}</td>
                <td className="px-3 py-2 text-right">
                  {r.status === "active" && (
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs"
                      disabled={isPending} onClick={() => onCancel(r.id)}>취소</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ComplaintDialog>
  );
}

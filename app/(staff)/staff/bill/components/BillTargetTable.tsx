"use client";
import { Button, Checkbox } from "@/components/common";
import { unitLabel } from "@/lib/bill/document";
import type { BillTarget } from "@/hooks/reactquery/bill";

export interface BillTargetTableProps {
  targets: BillTarget[];
  unitLabelMode: "code" | "name";
  selected: number[];
  onToggle: (unitId: number) => void;
  onToggleAll: () => void;
  onPrint: () => void;
  onSend: () => void;
}

export function BillTargetTable({
  targets,
  unitLabelMode,
  selected,
  onToggle,
  onToggleAll,
  onPrint,
  onSend,
}: BillTargetTableProps) {
  if (targets.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center text-t2">
        부과 확정된 세대가 없습니다 — 관리비 부과셋팅에서 확정 후 발행
      </div>
    );
  }

  const allChecked = selected.length === targets.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button variant="primary" onClick={onPrint} disabled={selected.length === 0}>
          A4 인쇄
        </Button>
        <Button variant="ghost" onClick={onSend} disabled={selected.length === 0}>
          문자 발송
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-t2">
            <th className="p-2">
              <Checkbox label="" aria-label="전체 선택" checked={allChecked} onChange={onToggleAll} />
            </th>
            <th className="p-2 text-left">호실</th>
            <th className="p-2 text-left">입주자명</th>
            <th className="p-2 text-right">총액</th>
            <th className="p-2">자동이체</th>
            <th className="p-2">발행상태</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((row) => (
            <tr key={row.unitId} className="border-t border-line">
              <td className="p-2">
                <Checkbox
                  label=""
                  aria-label={`${row.unitNo} 선택`}
                  checked={selected.includes(row.unitId)}
                  onChange={() => onToggle(row.unitId)}
                />
              </td>
              <td className="p-2">{unitLabel(unitLabelMode, row.unitNo, row.tenantName)}</td>
              <td className="p-2">{row.tenantName ?? "-"}</td>
              <td className="p-2 text-right">{row.totalAmount.toLocaleString()}원</td>
              <td className="p-2 text-center">{row.autoDebit ? "자동이체" : "-"}</td>
              <td className="p-2 text-center">{row.issuedAt ? "발행" : "미발행"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

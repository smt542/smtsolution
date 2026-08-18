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
  onWaterCutoffChange: (unitId: number, checked: boolean) => void;
  onPrint: () => void;
  onSend: () => void;
  onCancelSchedule: () => void;
  isCancellingSchedule?: boolean;
}

function formatScheduledAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16).replace("T", " ");
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}

function deliveryStatus(target: BillTarget): string {
  if (target.sendStatus === "scheduled") {
    return target.scheduledAt
      ? `예약 · ${formatScheduledAt(target.scheduledAt)}`
      : "예약";
  }
  if (target.sendStatus === "sent") return "발송 완료";
  if (target.sendStatus === "failed") return "발송 실패";
  if (target.issueType === "kakao" || target.issueType === "fax") return "미발송";
  return target.issuedAt ? "발행 완료" : "미발행";
}

export function BillTargetTable({
  targets,
  unitLabelMode,
  selected,
  onToggle,
  onToggleAll,
  onWaterCutoffChange,
  onPrint,
  onSend,
  onCancelSchedule,
  isCancellingSchedule = false,
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
          카톡 고지서 발송
        </Button>
        <Button
          variant="ghost"
          onClick={onCancelSchedule}
          disabled={isCancellingSchedule || !targets.some((target) => selected.includes(target.unitId) && target.sendStatus === "scheduled")}
        >
          {isCancellingSchedule ? "예약 취소 중…" : "예약 취소"}
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
            <th className="p-2">단수 표기</th>
            <th className="p-2">발송 상태</th>
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
              <td className="p-2 text-center">
                <Checkbox
                  label=""
                  aria-label={`${row.unitNo} 단수 표기`}
                  checked={row.waterCutoff}
                  onChange={(event) => onWaterCutoffChange(row.unitId, event.target.checked)}
                />
              </td>
              <td className="p-2 text-center">{deliveryStatus(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

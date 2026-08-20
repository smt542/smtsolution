"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import { useSettlementInquiry } from "@/hooks/reactquery/movingSettlement";
import type { ReceiptPaymentRow } from "@/hooks/reactquery/receipts";
import { formatCurrency, unitLabel } from "../receiptFormat";

type BuildingLite = Pick<Building, "id" | "name" | "ownerName" | "ownerPhone">;

interface JumpRow {
  key: string;
  buildingId: number;
  unitId: number | null;
  cells: string[];
}

function yearAgoRange(): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  const from = start.toISOString().slice(0, 10);
  return { from, to };
}

function ResultTable({
  title,
  headers,
  rows,
  onJump,
}: {
  title: string;
  headers: string[];
  rows: JumpRow[];
  onJump: (buildingId: number, unitId: number | null) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-extrabold text-t1">
        {title} <span className="text-t4">({rows.length})</span>
      </p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-bg px-3 py-3 text-xs text-t4">결과 없음</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-bg text-left text-xs font-bold text-t3">
                {headers.map((header) => (
                  <th key={header} className="px-3 py-2">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  onClick={() => onJump(row.buildingId, row.unitId)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-blue-t2"
                >
                  {row.cells.map((cell, index) => (
                    <td key={index} className="px-3 py-2.5 text-t1">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function UnifiedSearchModal({
  open,
  onClose,
  buildings,
  receiptRows,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  buildings: BuildingLite[];
  receiptRows: ReceiptPaymentRow[];
  onJump: (buildingId: number, unitId: number | null) => void;
}) {
  const [mode, setMode] = useState<"keyword" | "amount">("keyword");
  const [keyword, setKeyword] = useState("");
  const [amount, setAmount] = useState("");

  // 이사정산은 열려있을 때만 조회(최근 1년). range를 안정화해 재요청 루프 방지.
  const range = useMemo(() => (open ? yearAgoRange() : { from: "", to: "" }), [open]);
  const { data: settlementResult } = useSettlementInquiry({
    type: "all",
    from: range.from,
    to: range.to,
    pageSize: 200,
  });
  const settlements = settlementResult?.rows ?? [];

  const kw = keyword.trim().toLocaleLowerCase("ko-KR");
  const amountDigits = amount.replace(/[^0-9]/g, "");

  const matchKeyword = (parts: (string | null | undefined)[]) =>
    kw.length === 0
      ? true
      : parts.filter(Boolean).join(" ").toLocaleLowerCase("ko-KR").includes(kw);
  const matchAmount = (value: number | null | undefined) =>
    amountDigits.length > 0 && value != null && String(value).includes(amountDigits);

  const tenantRows: JumpRow[] =
    mode === "amount"
      ? []
      : receiptRows
          .filter((row) => matchKeyword([row.buildingName, unitLabel(row), row.tenantName, row.phone]))
          .slice(0, 50)
          .map((row) => ({
            key: `t-${row.buildingId}-${row.unitId}`,
            buildingId: row.buildingId,
            unitId: row.unitId,
            cells: [row.buildingName, unitLabel(row), row.tenantName ?? "-", row.phone ?? "-"],
          }));

  const chargeRows: JumpRow[] = receiptRows
    .filter((row) =>
      mode === "amount"
        ? matchAmount(row.charged)
        : matchKeyword([row.buildingName, unitLabel(row), row.tenantName]),
    )
    .slice(0, 50)
    .map((row) => ({
      key: `c-${row.buildingId}-${row.unitId}`,
      buildingId: row.buildingId,
      unitId: row.unitId,
      cells: [row.buildingName, unitLabel(row), row.tenantName ?? "-", formatCurrency(row.charged)],
    }));

  const settlementRows: JumpRow[] = settlements
    .filter((settlement) =>
      mode === "amount"
        ? matchAmount(settlement.settlementAmount)
        : matchKeyword([settlement.buildingName, unitLabel(settlement), settlement.tenantName]),
    )
    .slice(0, 50)
    .map((settlement) => ({
      key: `s-${settlement.settlementId}`,
      buildingId: settlement.buildingId,
      unitId: settlement.unitId,
      cells: [
        settlement.buildingName,
        unitLabel(settlement),
        settlement.tenantName ?? "-",
        formatCurrency(settlement.settlementAmount),
      ],
    }));

  const ownerRows: JumpRow[] =
    mode === "amount"
      ? []
      : buildings
          .filter((building) => matchKeyword([building.name, building.ownerName, building.ownerPhone]))
          .slice(0, 50)
          .map((building) => ({
            key: `o-${building.id}`,
            buildingId: building.id,
            unitId: null,
            cells: [building.name, building.ownerName ?? "-", building.ownerPhone ?? "-"],
          }));

  const handleJump = (buildingId: number, unitId: number | null) => {
    onJump(buildingId, unitId);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="통합 조회" className="max-w-4xl">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("keyword")}
          className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
            mode === "keyword" ? "bg-blue text-white" : "border border-line text-t2"
          }`}
        >
          입금자명·전화·동호로 찾기
        </button>
        <button
          type="button"
          onClick={() => setMode("amount")}
          className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
            mode === "amount" ? "bg-blue text-white" : "border border-line text-t2"
          }`}
        >
          금액으로 찾기
        </button>
      </div>

      {mode === "keyword" ? (
        <input
          autoFocus
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="입금자명·전화번호·동호 입력"
          aria-label="통합검색 키워드"
          className="mb-4 h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm text-t1 placeholder:text-t4"
        />
      ) : (
        <input
          autoFocus
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="금액 입력 (예: 150000)"
          aria-label="통합검색 금액"
          className="mb-4 h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm text-t1 placeholder:text-t4"
        />
      )}

      <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
        <ResultTable
          title="세입자"
          headers={["건물", "호실", "입주자", "전화"]}
          rows={tenantRows}
          onJump={handleJump}
        />
        <ResultTable
          title="청구금액"
          headers={["건물", "호실", "입주자", "부과금액"]}
          rows={chargeRows}
          onJump={handleJump}
        />
        <ResultTable
          title="이사정산"
          headers={["건물", "호실", "입주자", "정산금액"]}
          rows={settlementRows}
          onJump={handleJump}
        />
        <ResultTable
          title="건물주"
          headers={["건물", "건물주", "전화"]}
          rows={ownerRows}
          onJump={handleJump}
        />
      </div>
    </Modal>
  );
}

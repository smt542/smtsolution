import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";

export interface UtilityDraft {
  currentReading: string;
  manualCharge: string;
  note: string;
}

export interface UtilityTableRow extends UtilityUnitRow {
  fixedUsage: number | null;
}

interface UtilityTableProps {
  rows: UtilityTableRow[];
  drafts: Record<number, UtilityDraft>;
  referenceDate: string;
  onDraftChange: (unitId: number, patch: Partial<UtilityDraft>) => void;
  onRowClick: (row: UtilityUnitRow) => void;
  onDiscountClick?: (row: UtilityUnitRow) => void;
  onFixedUsageClick?: (row: UtilityTableRow) => void;
}

function discountLabel(type: string): string {
  return type === "recipient" ? "수급자" : type === "multichild" ? "다자녀" : "할인";
}

function isVacant(row: UtilityUnitRow): boolean {
  return row.occupancyStatus === "vacant" || row.occupancyId === null;
}

function isNewOccupancy(moveInDate: string | null, referenceDate: string): boolean {
  if (!moveInDate || !referenceDate) return false;
  const movedAt = Date.parse(`${moveInDate}T00:00:00`);
  const basedAt = Date.parse(`${referenceDate}T00:00:00`);
  if (Number.isNaN(movedAt) || Number.isNaN(basedAt)) return false;
  return Math.abs(movedAt - basedAt) <= 31 * 24 * 60 * 60 * 1000;
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("ko-KR");
}

function usageFor(row: UtilityTableRow, draft: UtilityDraft): number | null {
  if (row.fixedUsage !== null) return row.fixedUsage;
  const current = parseOptionalNumber(draft.currentReading);
  if (current === null || row.previousReading === null) return row.usage;
  return current - row.previousReading;
}

export function UtilityTable({
  rows,
  drafts,
  referenceDate,
  onDraftChange,
  onRowClick,
  onDiscountClick,
  onFixedUsageClick,
}: UtilityTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1360px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-[#FBFCFD] text-left text-xs font-bold text-t3">
            <th className="px-4 py-3">호실명</th>
            <th className="px-4 py-3">입주자명</th>
            <th className="px-4 py-3 text-right">전월 지침값</th>
            <th className="px-4 py-3 text-right">당월 지침값</th>
            <th className="px-4 py-3 text-right">사용량</th>
            <th className="px-4 py-3 text-right">단가</th>
            <th className="px-4 py-3 text-right">자동요금</th>
            <th className="px-4 py-3 text-right">수동 입력 요금</th>
            <th className="px-4 py-3">적요</th>
            <th className="px-4 py-3">부과 처리일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const vacant = isVacant(row);
            const isNew = !vacant && isNewOccupancy(row.moveInDate, referenceDate);
            const draft = drafts[row.unitId];
            const usage = usageFor(row, draft);
            const hasFixedUsage = row.fixedUsage !== null;
            const invalidUsage = !hasFixedUsage && usage !== null && usage < 0;
            const displayUnitPrice = row.unitPrice ?? row.resolvedUnitPrice;

            return (
              <tr
                key={row.unitId}
                onClick={() => onRowClick(row)}
                className={`cursor-pointer border-b border-line2 last:border-b-0 hover:bg-bg ${
                  vacant ? "bg-bg text-t3" : isNew ? "bg-blue-t2" : "bg-surface"
                }`}
              >
                <td className="px-4 py-3 align-top">
                  <div className="font-bold text-t1">
                    {row.dong ? `${row.dong} ` : ""}{row.unitNo}
                  </div>
                  <div className="mt-1 text-[11px] text-t3">
                    {row.customerNumber
                      ? `고객번호 ${row.customerNumber}`
                      : "고객번호 미등록"}
                    {row.meterNumber ? ` · 계량기 ${row.meterNumber}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{vacant ? "공실" : row.tenantName || "이름 미등록"}</span>
                    {vacant && (
                      <span className="rounded-md bg-line px-2 py-0.5 text-[11px] font-bold text-t3">
                        입력 제외
                      </span>
                    )}
                    {isNew && (
                      <span className="rounded-md bg-blue-t px-2 py-0.5 text-[11px] font-bold text-blue-d">
                        신규
                      </span>
                    )}
                    {row.discountType && row.discountAmount != null && (
                      <span className="rounded-md bg-blue-t px-2 py-0.5 text-[11px] font-bold text-blue-d">
                        {discountLabel(row.discountType)} −{row.discountAmount.toLocaleString("ko-KR")}
                      </span>
                    )}
                    {onDiscountClick && !vacant && (
                      <button
                        type="button"
                        aria-label={`${row.unitNo} 수도 할인 설정`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDiscountClick(row);
                        }}
                        className="rounded-md border border-line px-2 py-0.5 text-[11px] font-bold text-t2 hover:bg-bg"
                      >
                        할인
                      </button>
                    )}
                    {onFixedUsageClick && !vacant && (
                      <button
                        type="button"
                        aria-label={`${row.unitNo} 고정 사용량 설정`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onFixedUsageClick(row);
                        }}
                        className="rounded-md border border-line px-2 py-0.5 text-[11px] font-bold text-t2 hover:bg-bg"
                      >
                        고정량
                      </button>
                    )}
                  </div>
                </td>
                <td className="num px-4 py-3 text-right text-t3">
                  {formatNumber(row.previousReading)}
                </td>
                <td className="px-4 py-2" onClick={(event) => event.stopPropagation()}>
                  <input
                    aria-label={`${row.unitNo} 당월 지침값`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.currentReading}
                    disabled={vacant || hasFixedUsage}
                    placeholder={hasFixedUsage ? "고정" : "입력"}
                    onChange={(event) =>
                      onDraftChange(row.unitId, { currentReading: event.target.value })
                    }
                    className="num ml-auto block h-9 w-28 rounded-lg border border-line bg-surface px-3 text-right text-sm font-bold text-t1 placeholder:text-t4 focus:border-blue focus:outline-none disabled:cursor-not-allowed disabled:bg-line2"
                  />
                </td>
                <td
                  className={`num px-4 py-3 text-right font-semibold ${
                    invalidUsage ? "text-red" : "text-t1"
                  }`}
                >
                  <div className="flex items-center justify-end gap-2">
                    {hasFixedUsage && (
                      <span className="rounded-md bg-amber-t px-2 py-0.5 text-[11px] font-bold text-amber">
                        고정
                      </span>
                    )}
                    <span>{invalidUsage ? "확인 필요" : formatNumber(usage)}</span>
                  </div>
                </td>
                <td className="num px-4 py-3 text-right text-t3">
                  {formatNumber(displayUnitPrice)}
                </td>
                <td className="num px-4 py-3 text-right">
                  {formatNumber(row.automaticCharge)}
                </td>
                <td className="px-4 py-2" onClick={(event) => event.stopPropagation()}>
                  <input
                    aria-label={`${row.unitNo} 수동 입력 요금`}
                    type="number"
                    min="0"
                    step="1"
                    value={draft.manualCharge}
                    disabled={vacant}
                    placeholder="선택"
                    onChange={(event) =>
                      onDraftChange(row.unitId, { manualCharge: event.target.value })
                    }
                    className="num ml-auto block h-9 w-32 rounded-lg border border-line bg-surface px-3 text-right text-sm text-t1 placeholder:text-t4 focus:border-blue focus:outline-none disabled:cursor-not-allowed disabled:bg-line2"
                  />
                </td>
                <td className="px-4 py-2" onClick={(event) => event.stopPropagation()}>
                  <input
                    aria-label={`${row.unitNo} 적요`}
                    value={draft.note}
                    disabled={vacant}
                    placeholder="선택 입력"
                    onChange={(event) =>
                      onDraftChange(row.unitId, { note: event.target.value })
                    }
                    className="h-9 w-40 rounded-lg border border-line bg-surface px-3 text-sm text-t1 placeholder:text-t4 focus:border-blue focus:outline-none disabled:cursor-not-allowed disabled:bg-line2"
                  />
                </td>
                <td className="num px-4 py-3 text-t3">
                  {row.processedAt ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

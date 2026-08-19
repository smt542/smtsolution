import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Button, Checkbox, Modal, Spinner } from "@/components/common";
import {
  listUtilityRows,
  utilityKeys,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import { PROGRAM_COMPANY_NAME } from "@/lib/bill/document";

export interface GasLedgerBuilding {
  id: number;
  name: string;
  address?: string | null;
}

interface GasLedgerModalProps {
  open: boolean;
  buildings: GasLedgerBuilding[];
  currentBuildingId: number;
  period: string;
  onClose: () => void;
}

const ROWS_PER_PAGE = 24;

function chunkRows(rows: UtilityUnitRow[]): UtilityUnitRow[][] {
  if (rows.length === 0) return [[]];
  return Array.from(
    { length: Math.ceil(rows.length / ROWS_PER_PAGE) },
    (_, index) => rows.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE),
  );
}

function formatReading(value: number | null): string {
  return value === null
    ? "-"
    : value.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

function periodLabel(period: string): string {
  return `${period.slice(0, 4)}년 ${Number(period.slice(5, 7))}월`;
}

export function GasLedgerModal({
  open,
  buildings,
  currentBuildingId,
  period,
  onClose,
}: GasLedgerModalProps) {
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<number[]>([
    currentBuildingId,
  ]);
  const selectedBuildings = useMemo(
    () => buildings.filter((building) => selectedBuildingIds.includes(building.id)),
    [buildings, selectedBuildingIds],
  );
  const ledgerQueries = useQueries({
    queries: selectedBuildings.map((building) => ({
      queryKey: utilityKeys.rows(building.id, "gas", period),
      queryFn: () => listUtilityRows(building.id, "gas", period),
    })),
  });
  const isLoading = ledgerQueries.some((query) => query.isLoading);
  const hasError = ledgerQueries.some((query) => query.error);

  const toggleBuilding = (buildingId: number, checked: boolean) => {
    setSelectedBuildingIds((current) => checked
      ? [...current, buildingId]
      : current.filter((id) => id !== buildingId));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="가스 검침대장 출력"
      className="max-w-[96vw]"
    >
      <style>{`@media print {
        @page { size: A4 portrait; margin: 0; }
        body * { visibility: hidden !important; }
        [data-gas-ledger-print], [data-gas-ledger-print] * { visibility: visible !important; }
        [data-gas-ledger-print] { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; }
      }`}</style>

      <div data-gas-ledger-controls className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-line bg-bg/60 p-4">
          <h3 className="text-sm font-extrabold text-t1">출력 건물</h3>
          <p className="mt-1 text-xs text-t3">관리 중인 건물을 여러 개 선택할 수 있습니다.</p>
          <div className="mt-4 max-h-56 space-y-3 overflow-y-auto">
            {buildings.map((building) => (
              <Checkbox
                key={building.id}
                label={building.name}
                checked={selectedBuildingIds.includes(building.id)}
                onChange={(event) => toggleBuilding(building.id, event.target.checked)}
              />
            ))}
          </div>
        </aside>

        <div className="max-h-[72vh] overflow-auto rounded-xl border border-line bg-bg p-4">
          {selectedBuildings.length === 0 ? (
            <p className="py-16 text-center text-sm text-t3">출력할 건물을 선택해 주세요.</p>
          ) : isLoading ? (
            <div className="py-16">
              <Spinner />
              <p className="text-center text-sm text-t3">검침대장을 불러오는 중입니다.</p>
            </div>
          ) : hasError ? (
            <p className="rounded-xl border border-red/20 bg-red-t p-6 text-center text-sm font-semibold text-red">
              일부 건물의 검침대장을 불러오지 못했습니다.
            </p>
          ) : (
            <GasLedgerPrintView
              buildings={selectedBuildings.map((building, index) => ({
                building,
                rows: ledgerQueries[index]?.data ?? [],
              }))}
              period={period}
            />
          )}
        </div>
      </div>

      <div data-gas-ledger-controls className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
        <Button
          type="button"
          onClick={() => window.print()}
          disabled={selectedBuildings.length === 0 || isLoading || hasError}
        >
          인쇄
        </Button>
      </div>
    </Modal>
  );
}

export function GasLedgerPrintView({
  buildings,
  period,
}: {
  buildings: { building: GasLedgerBuilding; rows: UtilityUnitRow[] }[];
  period: string;
}) {
  const pages = buildings.flatMap(({ building, rows }) => (
    chunkRows(rows).map((pageRows, pageIndex) => ({
      building,
      pageIndex,
      pageRows,
    }))
  ));

  return (
    <div className="space-y-5 text-black print:space-y-0" data-gas-ledger-print data-testid="gas-ledger-print">
      {pages.map(({ building, pageIndex, pageRows }, globalPageIndex) => {
        const isLastPage = globalPageIndex === pages.length - 1;
        return (
            <article
              key={`${building.id}:${pageIndex}`}
              className={`relative mx-auto min-h-[277mm] w-[190mm] overflow-hidden bg-white p-[10mm] shadow-sm print:shadow-none ${
                isLastPage ? "print:break-after-auto" : "print:break-after-page"
              }`}
            >
              <div className="pointer-events-none absolute inset-0 flex rotate-[-28deg] items-center justify-center text-6xl font-black text-slate-100">
                {PROGRAM_COMPANY_NAME}
              </div>
              <div className="relative">
                <header className="flex items-end justify-between border-b-2 border-black pb-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.2em]">GAS METER LEDGER</p>
                    <h1 className="mt-1 text-2xl font-black">가스 검침대장</h1>
                    <p className="mt-1 text-xs font-bold">{building.name} · {periodLabel(period)}</p>
                  </div>
                  <div className="text-right text-[10px]">
                    <p>{building.address ?? "주소 미등록"}</p>
                    <p className="mt-1">{globalPageIndex + 1} / {pages.length} 페이지</p>
                  </div>
                </header>

                {pageRows.length === 0 ? (
                  <div className="mt-6 border border-dashed border-slate-400 p-12 text-center text-sm text-slate-500">
                    등록된 세대가 없습니다.
                  </div>
                ) : (
                  <table className="mt-5 w-full table-fixed border-collapse text-[9px]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="w-[16%] border border-black p-1.5">고객번호</th>
                        <th className="w-[12%] border border-black p-1.5">호실</th>
                        <th className="w-[14%] border border-black p-1.5">입주자</th>
                        <th className="w-[18%] border border-black p-1.5">계량기번호</th>
                        <th className="w-[13%] border border-black p-1.5 text-right">전월지침</th>
                        <th className="w-[13%] border border-black p-1.5 text-right">당월지침</th>
                        <th className="w-[14%] border border-black p-1.5 text-right">사용량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row) => (
                        <tr key={row.unitId}>
                          <td className="border border-black p-1.5">{row.customerNumber ?? "미지정"}</td>
                          <td className="border border-black p-1.5 font-bold">
                            {row.dong ? `${row.dong} ` : ""}{row.unitNo}
                          </td>
                          <td className="border border-black p-1.5">{row.tenantName ?? "-"}</td>
                          <td className={`border border-black p-1.5 ${row.meterNumber === null ? "font-bold text-red-700" : ""}`}>
                            {row.meterNumber ?? "계량기 없음"}
                          </td>
                          <td className="border border-black p-1.5 text-right tabular-nums">
                            {formatReading(row.previousReading)}
                          </td>
                          <td className="border border-black p-1.5 text-right tabular-nums">
                            {formatReading(row.currentReading)}
                          </td>
                          <td className="border border-black p-1.5 text-right tabular-nums">
                            {formatReading(row.usage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <footer className="mt-5 flex justify-between border-t border-black pt-2 text-[9px]">
                  <span>{building.name}</span>
                  <strong>{PROGRAM_COMPANY_NAME}</strong>
                </footer>
              </div>
            </article>
        );
      })}
    </div>
  );
}

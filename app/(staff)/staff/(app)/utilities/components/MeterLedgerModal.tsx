"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Spinner } from "@/components/common";
import { ChevronDownIcon, CloseIcon, PrinterIcon, SearchIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  listUtilityRows,
  utilityKeys,
  type UtilityType,
} from "@/hooks/reactquery/utilities";
import { MeterLedgerDocument } from "./MeterLedgerDocument";

interface MeterLedgerModalProps {
  open: boolean;
  buildings: Building[];
  currentBuildingId: number | null;
  period: string;
  utilityType?: UtilityType;
  onClose: () => void;
  onPrinted?: () => void;
}

export function MeterLedgerModal({
  open,
  buildings,
  currentBuildingId,
  period,
  utilityType = "electricity",
  onClose,
  onPrinted,
}: MeterLedgerModalProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(
    currentBuildingId !== null ? [currentBuildingId] : [],
  );
  const [search, setSearch] = useState("");
  const [printPeriod, setPrintPeriod] = useState(period);

  const selectedBuildings = useMemo(
    () => buildings.filter((building) => selectedIds.includes(building.id)),
    [buildings, selectedIds],
  );
  const filteredBuildings = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return buildings;
    return buildings.filter((building) => [building.code, building.name, building.address ?? ""]
      .join(" ")
      .toLocaleLowerCase("ko-KR")
      .includes(keyword));
  }, [buildings, search]);
  const queries = useQueries({
    queries: selectedBuildings.map((building) => ({
      queryKey: utilityKeys.rows(building.id, utilityType, printPeriod),
      queryFn: () => listUtilityRows(building.id, utilityType, printPeriod),
    })),
  });
  const previewBuilding = selectedBuildings[0] ?? null;
  const previewRows = queries[0]?.data ?? [];
  const isLedgerLoading = queries.some((query) => query.isLoading);
  const isLedgerRefreshing = queries.some((query) => query.isFetching && !query.isLoading);
  const isLedgerBusy = isLedgerLoading || isLedgerRefreshing;
  const hasError = queries.some((query) => query.error);
  const year = printPeriod.slice(0, 4);
  const month = printPeriod.slice(5, 7);

  if (!open) return null;

  const toggleBuilding = (buildingId: number, checked: boolean) => {
    setSelectedIds((current) => checked
      ? current.includes(buildingId) ? current : [...current, buildingId]
      : current.filter((id) => id !== buildingId));
  };

  return (
    <div data-meter-ledger-overlay className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim p-4" onMouseDown={onClose}>
      <style>{`@media print {
        @page { size: A4 portrait; margin: 0; }
        body * { visibility: hidden !important; }
        [data-meter-ledger-overlay], [data-meter-ledger-print], [data-meter-ledger-print] * { visibility: visible !important; }
        [data-meter-ledger-overlay] { position: static !important; display: block !important; padding: 0 !important; background: white !important; }
        [data-meter-ledger-dialog] { display: none !important; }
        [data-meter-ledger-print] { position: absolute !important; inset: 0 auto auto 0 !important; display: block !important; width: 100% !important; }
        [data-meter-ledger-document] { break-after: page; }
        [data-meter-ledger-document]:last-child { break-after: auto; }
      }`}</style>
      <section
        data-meter-ledger-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="meter-ledger-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-[660px] w-[1020px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-card bg-white shadow-pop"
      >
        <header className="flex h-[61px] flex-none items-center gap-2.5 border-b border-line px-5">
          <h2 id="meter-ledger-title" className="text-[15px] font-extrabold text-t1">검침대장 출력</h2>
          <span className="h-px flex-1 bg-line2" />
          <button type="button" aria-label="검침대장 닫기" onClick={onClose} className="flex size-[26px] items-center justify-center rounded-[7px] text-t3 hover:bg-bg hover:text-t1">
            <CloseIcon className="size-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-line">
            <div className="h-[99px] flex-none border-b border-line2 p-3">
              <div className="flex gap-2">
                <label className="relative flex-1">
                  <span className="sr-only">출력 연도</span>
                  <select
                    aria-label="출력 연도"
                    value={year}
                    onChange={(event) => setPrintPeriod(`${event.target.value}-${month}-01`)}
                    className="h-8 w-full appearance-none rounded-[8px] border border-line bg-white px-2.5 pr-7 text-[11px] font-bold text-t1 outline-none focus:border-teal"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((value) => <option key={value} value={value}>{value}년</option>)}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-2 top-2 size-4 text-t3" />
                </label>
                <label className="relative flex-1">
                  <span className="sr-only">출력 월</span>
                  <select
                    aria-label="출력 월"
                    value={month}
                    onChange={(event) => setPrintPeriod(`${year}-${event.target.value}-01`)}
                    className="h-8 w-full appearance-none rounded-[8px] border border-line bg-white px-2.5 pr-7 text-[11px] font-bold text-t1 outline-none focus:border-teal"
                  >
                    {Array.from({ length: 12 }, (_, index) => {
                      const value = String(index + 1).padStart(2, "0");
                      return <option key={value} value={value}>{index + 1}월분</option>;
                    })}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-2 top-2 size-4 text-t3" />
                </label>
              </div>
              <label className="relative mt-2 block">
                <span className="sr-only">코드·건물명·주소 검색</span>
                <SearchIcon className="pointer-events-none absolute left-2.5 top-2 size-4 text-t3" />
                <input
                  aria-label="코드·건물명·주소 검색"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="코드·건물명·주소 검색"
                  className="h-8 w-full rounded-[8px] border border-line bg-white pl-8 pr-3 text-[11px] font-medium outline-none placeholder:text-t4 focus:border-teal"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full table-fixed border-collapse text-[10px]">
                <thead className="sticky top-0 bg-[#fbfcfd] text-t3">
                  <tr className="h-8 border-b border-line2">
                    <th className="w-9 text-center"><span className="sr-only">선택</span></th>
                    <th className="w-[52px] px-1 text-left">코드</th>
                    <th className="w-[82px] px-1 text-left">건물명</th>
                    <th className="px-1 text-left">주소</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBuildings.map((building) => {
                    const checked = selectedIds.includes(building.id);
                    return (
                      <tr key={building.id} className={`h-[39px] border-b border-line2 ${checked ? "bg-teal-t" : "hover:bg-bg"}`}>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            aria-label={`${building.name} 출력 선택`}
                            checked={checked}
                            onChange={(event) => toggleBuilding(building.id, event.target.checked)}
                            className="size-3.5 accent-teal"
                          />
                        </td>
                        <td className="truncate px-1 font-semibold text-t3">{building.code}</td>
                        <td className="truncate px-1 font-bold text-t1">{building.name}</td>
                        <td className="truncate px-1 text-t3">{building.address ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </aside>

          <div className="relative min-h-0 overflow-auto bg-[#eef1f4] p-4">
            {previewBuilding ? (
              isLedgerLoading ? (
                <div role="status" aria-label="검침대장 불러오는 중" className="flex h-full items-center justify-center text-xs font-semibold text-t3">검침대장을 불러오는 중입니다.</div>
              ) : hasError ? (
                <div className="flex h-full items-center justify-center text-xs font-semibold text-red">검침대장을 불러오지 못했습니다.</div>
              ) : (
                <>
                  <div data-testid="meter-ledger-preview" className="w-[633px]">
                    <MeterLedgerDocument building={previewBuilding} period={printPeriod} rows={previewRows} utilityType={utilityType} />
                  </div>
                  {isLedgerRefreshing ? (
                    <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-surface/95 shadow-card">
                      <Spinner label="검침대장 갱신 중" size="small" showLabel className="px-3 py-2" />
                    </div>
                  ) : null}
                </>
              )
            ) : (
              <div className="flex h-full items-center justify-center text-xs font-semibold text-t3">출력할 건물을 선택해 주세요.</div>
            )}
          </div>
        </div>

        <footer className="flex h-[69px] flex-none items-center gap-2 border-t border-line px-5">
          <span className="text-[12px] font-semibold text-t2">{selectedIds.length}곳 선택</span>
          <span className="h-px flex-1 bg-line2" />
          <button
            type="button"
            onClick={() => {
              window.print();
              onPrinted?.();
            }}
            disabled={selectedIds.length === 0 || isLedgerBusy || hasError}
            className="flex h-10 items-center gap-[7px] rounded-btn bg-teal px-[18px] text-[13.5px] font-bold text-white hover:bg-teal-d disabled:cursor-not-allowed disabled:opacity-45"
          >
            <PrinterIcon className="size-4" />
            인쇄
          </button>
        </footer>
      </section>

      <div data-meter-ledger-print className="hidden print:block">
        {selectedBuildings.map((building, index) => (
          <MeterLedgerDocument key={building.id} building={building} period={printPeriod} rows={queries[index]?.data ?? []} utilityType={utilityType} />
        ))}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { CloseIcon, PrinterIcon, SearchIcon } from "@/components/icons";
import { Spinner } from "@/components/common";
import { listUtilityRows, utilityKeys } from "@/hooks/reactquery/utilities";
import {
  GasLedgerPrintView,
  type GasLedgerBuilding,
} from "./gas/GasLedgerPrintView";

export type { GasLedgerBuilding } from "./gas/GasLedgerPrintView";

interface GasLedgerModalProps {
  open: boolean;
  buildings: GasLedgerBuilding[];
  currentBuildingId: number;
  period: string;
  onClose: () => void;
}

const LEDGER_UTILITIES = ["electricity", "water", "gas"] as const;

export function GasLedgerModal({
  open,
  buildings,
  currentBuildingId,
  period,
  onClose,
}: GasLedgerModalProps) {
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<number[]>([currentBuildingId]);
  const [search, setSearch] = useState("");
  const [ledgerYear, setLedgerYear] = useState(Number(period.slice(0, 4)));
  const [ledgerMonth, setLedgerMonth] = useState(Number(period.slice(5, 7)));
  const ledgerPeriod = `${ledgerYear}-${String(ledgerMonth).padStart(2, "0")}-01`;
  const selectedBuildings = useMemo(
    () => buildings.filter((building) => selectedBuildingIds.includes(building.id)),
    [buildings, selectedBuildingIds],
  );
  const filteredBuildings = useMemo(() => buildings.filter((building) => {
    const query = search.trim().toLowerCase();
    return query === "" || building.name.toLowerCase().includes(query)
      || (building.address ?? "").toLowerCase().includes(query);
  }), [buildings, search]);
  const ledgerQueries = useQueries({
    queries: selectedBuildings.flatMap((building) => LEDGER_UTILITIES.map((utility) => ({
      queryKey: utilityKeys.rows(building.id, utility, ledgerPeriod),
      queryFn: () => listUtilityRows(building.id, utility, ledgerPeriod),
    }))),
  });
  const isLedgerInitialLoading = ledgerQueries.some((query) => query.isLoading);
  const isLedgerRefreshing = ledgerQueries.some(
    (query) => query.isFetching && !query.isLoading,
  );
  const isLedgerBusy = isLedgerInitialLoading || isLedgerRefreshing;
  const hasError = ledgerQueries.some((query) => query.error);
  const documents = selectedBuildings.map((building, index) => ({
    building,
    electricityRows: ledgerQueries[index * 3]?.data ?? [],
    waterRows: ledgerQueries[index * 3 + 1]?.data ?? [],
    gasRows: ledgerQueries[index * 3 + 2]?.data ?? [],
  }));

  if (!open) return null;

  const toggleBuilding = (buildingId: number, checked: boolean) => {
    setSelectedBuildingIds((current) => checked
      ? Array.from(new Set([...current, buildingId]))
      : current.filter((id) => id !== buildingId));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 print:static print:block print:bg-white print:p-0" role="presentation">
      <style>{`@media print {
        @page { size: A4 portrait; margin: 0; }
        body * { visibility: hidden !important; }
        [data-gas-ledger-print], [data-gas-ledger-print] * { visibility: visible !important; }
        [data-gas-ledger-print] {
          position: absolute !important;
          inset: 0 auto auto 0 !important;
          width: 633px !important;
          zoom: 1.254;
        }
      }`}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="gas-ledger-title" className="h-[660px] w-[1020px] overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_rgba(23,31,40,0.3)] print:h-auto print:w-auto print:overflow-visible print:rounded-none print:shadow-none">
        <header data-gas-ledger-controls className="flex h-[61px] items-center border-b border-line px-5">
          <h2 id="gas-ledger-title" className="text-[17px] font-extrabold text-t1">검침대장 출력</h2>
          <button type="button" aria-label="검침대장 닫기" onClick={onClose} className="ml-auto flex size-8 items-center justify-center rounded-lg text-t3 hover:bg-bg">
            <CloseIcon />
          </button>
        </header>

        <div data-gas-ledger-controls className="grid h-[530px] grid-cols-[340px_680px]">
          <aside className="flex min-h-0 flex-col border-r border-line bg-white">
            <div className="h-[99px] shrink-0 px-3 pt-3">
              <div className="flex gap-2">
                <label>
                  <span className="sr-only">출력 연도</span>
                  <select aria-label="출력 연도" value={ledgerYear} onChange={(event) => setLedgerYear(Number(event.target.value))} className="h-8 appearance-none rounded-[9px] border border-line bg-white px-3 pr-7 text-[12px] font-bold text-t2 outline-none focus:border-teal">
                    {[ledgerYear - 1, ledgerYear, ledgerYear + 1].map((value) => <option key={value} value={value}>{value}년</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">출력 월</span>
                  <select aria-label="출력 월" value={ledgerMonth} onChange={(event) => setLedgerMonth(Number(event.target.value))} className="h-8 appearance-none rounded-[9px] border border-line bg-white px-3 pr-7 text-[12px] font-bold text-t2 outline-none focus:border-teal">
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}월분</option>)}
                  </select>
                </label>
              </div>
              <label className="relative mt-3 block">
                <span className="sr-only">출력 건물 검색</span>
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-t3" />
                <input aria-label="출력 건물 검색" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="건물명·주소 검색" className="h-[42px] w-full rounded-[9px] border border-line bg-white pl-9 pr-3 text-[12px] text-t1 outline-none placeholder:text-t4 focus:border-teal" />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup><col className="w-[88px]" /><col className="w-[104px]" /><col className="w-[96px]" /><col className="w-[52px]" /></colgroup>
                <thead className="sticky top-0 h-9 bg-[#fbfcfd] text-[11px] font-bold text-t3">
                  <tr className="border-y border-line"><th className="pl-[11px] text-left">코드</th><th>건물명</th><th>주소</th><th className="pr-[11px] text-right">가스</th></tr>
                </thead>
                <tbody className="text-[11.5px] font-semibold text-t2">
                  {filteredBuildings.map((building) => {
                    const checked = selectedBuildingIds.includes(building.id);
                    return (
                      <tr key={building.id} className={`h-[41px] border-b border-line2 ${checked ? "bg-teal-t" : "hover:bg-bg"}`}>
                        <td className="pl-[11px]"><span className="flex items-center gap-2"><input aria-label={building.name} type="checkbox" checked={checked} onChange={(event) => toggleBuilding(building.id, event.target.checked)} className="size-4 shrink-0 accent-[#14a497]" /><span className="truncate text-t3">{building.code ?? building.id}</span></span></td>
                        <td className="truncate pr-2">{building.name}</td>
                        <td className="truncate pr-2 text-[10.5px] text-t3">{building.address ?? "-"}</td>
                        <td className="pr-[11px] text-right tabular-nums text-t3">{building.gasCustomerNumberCount ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </aside>

          <div className="relative overflow-auto bg-[#e8ebee] p-[16px]">
            {selectedBuildings.length === 0 ? (
              <p className="flex h-full items-center justify-center text-[12px] font-semibold text-t3">출력할 건물을 선택해 주세요.</p>
            ) : isLedgerInitialLoading ? (
              <div className="flex h-full flex-col justify-center"><Spinner label="검침대장 불러오는 중" /><p className="mt-2 text-center text-[12px] text-t3">검침대장을 불러오는 중입니다.</p></div>
            ) : hasError ? (
              <p className="flex h-full items-center justify-center text-[12px] font-semibold text-red">일부 검침대장을 불러오지 못했습니다.</p>
            ) : (
              <>
                <GasLedgerPrintView documents={documents} period={ledgerPeriod} />
                {isLedgerRefreshing ? (
                  <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-surface/95 shadow-card">
                    <Spinner label="검침대장 갱신 중" size="small" showLabel className="px-3 py-2" />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <footer data-gas-ledger-controls className="flex h-[69px] items-center border-t border-line px-5">
          <p className="text-[12px] font-bold text-t2"><strong className="text-teal">{selectedBuildings.length}곳</strong> 선택</p>
          <button type="button" onClick={() => window.print()} disabled={selectedBuildings.length === 0 || isLedgerBusy || hasError} className="ml-auto flex h-10 items-center gap-1.5 rounded-[10px] bg-teal px-5 text-[13px] font-bold text-white hover:bg-teal-d disabled:cursor-not-allowed disabled:opacity-45">
            <PrinterIcon className="size-4" />
            인쇄
          </button>
        </footer>
      </section>
    </div>
  );
}

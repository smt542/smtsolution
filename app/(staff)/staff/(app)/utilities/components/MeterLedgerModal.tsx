"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Button, IconButton } from "@/components/common";
import { CustomDropdown } from "@/components/common/CustomDropdown";
import { PrintSheet } from "@/components/common/PrintSheet";
import { CloseIcon, PrinterIcon, SearchIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  customerNumberKeys,
  listCustomerNumbersByBuilding,
} from "@/hooks/reactquery/buildingCustomerNumbers";
import {
  listUtilityRows,
  utilityKeys,
  type UtilityType,
} from "@/hooks/reactquery/utilities";
import {
  LEDGER_PAGE_WIDTH,
  METER_LEDGER_PRINT_CSS,
  MeterLedgerDocument,
  type MeterLedgerSource,
} from "./MeterLedgerDocument";

interface MeterLedgerModalProps {
  open: boolean;
  buildings: Building[];
  currentBuildingId: number | null;
  period: string;
  utilityType?: UtilityType;
  onClose: () => void;
}

const YEAR_OPTIONS = [2026, 2025, 2024].map((year) => ({ value: String(year), label: `${year}년` }));
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: `${index + 1}월분`,
}));

// 정본 `.lg-srch .uc-dd`: 메뉴 왼쪽 정렬·패딩 5·옵션 간격 10·옵션 hover #F5F7F9·버튼 hover 테두리만.
const LEDGER_DROPDOWN = [
  "[&_.uc-dd-btn_svg]:h-[14px]",
  "[&_.uc-dd-btn_svg]:w-[14px]",
  "[&_.uc-dd:not(.open)_.uc-dd-btn:hover]:border-[#C9D0D8]",
  "[&_.uc-dd:not(.open)_.uc-dd-btn:hover]:shadow-none",
  "[&_.uc-dd-menu]:left-0",
  "[&_.uc-dd-menu]:right-auto",
  "[&_.uc-dd-menu]:p-[5px]",
  "[&_.uc-opt]:gap-[10px]",
  "[&_.uc-opt:not(.on):hover]:bg-[#F5F7F9]",
].join(" ");

const LIST_TH = "sticky top-0 z-[2] border-b border-line bg-[#FBFCFD] py-[11px] text-left text-[12px] font-bold whitespace-nowrap text-t3";
const LIST_TD = "truncate border-b border-line2 py-3 text-[13.5px] font-medium text-t1";

function byCode(a: Building, b: Building): number {
  return String(a.code ?? "").localeCompare(String(b.code ?? ""), "en", { numeric: true });
}

/** 정본 `.lg-ck`: 17px 체크 상자. 행 체크는 행 클릭이 토글하므로 키보드만 여기서 받는다. */
function LedgerCheck({
  checked,
  label,
  onToggle,
  clickable = false,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  clickable?: boolean;
}) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onClick={clickable ? onToggle : undefined}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        onToggle();
      }}
      className={`flex size-[17px] flex-none cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] outline-none ${checked ? "border-blue bg-blue" : "border-line bg-white"}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`size-[11px] text-white ${checked ? "opacity-100" : "opacity-0"}`}
      >
        <path d="M4 12.5l5 5L20 6.5" />
      </svg>
    </span>
  );
}

/**
 * 검침대장 출력 모달. 정본 `utility-electric|water|gas.dc.html` 의 `#ucLedger` 모달(`.lg-*`)은
 * 세 파일이 같은 코드라 세 탭이 이 모달 하나를 쓴다. 검침 칸은 출력한 탭의 공과금만 채운다.
 */
export function MeterLedgerModal({
  open,
  buildings,
  currentBuildingId,
  period,
  utilityType = "electricity",
  onClose,
}: MeterLedgerModalProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(
    currentBuildingId !== null ? [currentBuildingId] : [],
  );
  const [search, setSearch] = useState("");
  const [printPeriod, setPrintPeriod] = useState(period);
  const [printing, setPrinting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const year = printPeriod.slice(0, 4);
  const month = printPeriod.slice(5, 7);

  const orderedBuildings = useMemo(() => [...buildings].sort(byCode), [buildings]);
  const selectedBuildings = useMemo(
    () => orderedBuildings.filter((building) => selectedIds.includes(building.id)),
    [orderedBuildings, selectedIds],
  );
  const filteredBuildings = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return orderedBuildings;
    return orderedBuildings.filter((building) => `${building.name}${building.code ?? ""}${building.address ?? ""}`
      .toLocaleLowerCase("ko-KR")
      .includes(keyword));
  }, [orderedBuildings, search]);

  const rowQueries = useQueries({
    queries: selectedBuildings.map((building) => ({
      queryKey: utilityKeys.rows(building.id, utilityType, printPeriod),
      queryFn: () => listUtilityRows(building.id, utilityType, printPeriod),
    })),
  });
  const numberQueries = useQueries({
    queries: selectedBuildings.map((building) => ({
      queryKey: customerNumberKeys.byBuilding(building.id),
      queryFn: () => listCustomerNumbersByBuilding(building.id),
    })),
  });
  const queries = [...rowQueries, ...numberQueries];
  const loading = queries.some((query) => query.isLoading);
  const failed = queries.some((query) => query.error);
  const sources: MeterLedgerSource[] = selectedBuildings.map((building, index) => {
    const numbers = numberQueries[index]?.data ?? [];
    return {
      building,
      rows: rowQueries[index]?.data ?? [],
      waterCustomerNumbers: numbers.filter((item) => item.kind === "water").map((item) => item.customerNo),
      // 건물 단위 전기 고객번호는 대부분 공용전기(common_elec)다 — 전기 탭 레일 '전기' 칸도 이 종류를 센다.
      electricityCustomerNumbers: numbers
        .filter((item) => item.kind === "elec" || item.kind === "common_elec")
        .map((item) => item.customerNo),
    };
  });
  const showPreview = selectedBuildings.length > 0 && !loading && !failed;
  const allSelected = orderedBuildings.length > 0 && selectedIds.length === orderedBuildings.length;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  // 정본 fitPages(): 794px 쪽 묶음을 미리보기 폭(패딩 16×2 제외)에 맞춰 축소하고 가운데 둔다.
  useLayoutEffect(() => {
    const panel = previewRef.current;
    const stack = stackRef.current;
    if (!panel || !stack) return;
    const fit = () => {
      const available = panel.clientWidth - 32;
      const scale = Math.min(1, available / LEDGER_PAGE_WIDTH);
      const height = stack.scrollHeight;
      stack.style.transform = `scale(${scale})`;
      stack.style.marginBottom = `${height * scale - height}px`;
      stack.style.marginLeft = `${Math.max(0, (available - LEDGER_PAGE_WIDTH * scale) / 2)}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(panel);
    observer.observe(stack);
    return () => observer.disconnect();
  }, [showPreview]);

  if (!open) return null;

  const toggleBuilding = (buildingId: number) => {
    setSelectedIds((current) => current.includes(buildingId)
      ? current.filter((id) => id !== buildingId)
      : [...current, buildingId]);
  };
  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : orderedBuildings.map((building) => building.id));
  };

  const previewMessage = selectedBuildings.length === 0
    ? <>출력할 건물을 선택해 주세요<br />선택한 건물의 검침대장이 여기에 표시돼요</>
    : loading
      ? "검침대장을 불러오는 중이에요"
      : failed
        ? "검침대장을 불러오지 못했어요"
        : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim p-6 leading-[normal]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="meter-ledger-title"
        className="flex h-[min(660px,92%)] w-[min(1020px,96%)] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_30px_70px_-20px_rgba(0,0,0,0.4)]"
      >
        <header className="flex flex-none items-center gap-2.5 border-b border-line px-5 py-[17px]">
          <h2 id="meter-ledger-title" className="text-[16px] font-extrabold tracking-[-0.02em] text-t1">검침대장 출력</h2>
          <span className="flex-1" />
          <IconButton
            aria-label="검침대장 닫기"
            onClick={onClose}
            className="size-[26px] rounded-[8px] border border-line bg-white text-t2 transition-[border-color,background-color] duration-[120ms] hover:border-[#C9D0D8] hover:bg-[#F7F9FA]"
          >
            <CloseIcon className="size-3.5 flex-none" />
          </IconButton>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-line">
            <div className="flex-none border-b border-line2 p-3">
              <div className={`mb-2 flex items-center gap-1.5 ${LEDGER_DROPDOWN}`}>
                <div className="[&_.uc-dd-menu]:min-w-[104px]">
                  <CustomDropdown
                    ariaLabel="출력 연도"
                    value={year}
                    compact
                    options={YEAR_OPTIONS}
                    onChange={(value) => setPrintPeriod(`${value}-${month}-01`)}
                  />
                </div>
                <div className="[&_.uc-dd-menu]:min-w-[112px]">
                  <CustomDropdown
                    ariaLabel="출력 월"
                    value={month}
                    compact
                    options={MONTH_OPTIONS}
                    onChange={(value) => setPrintPeriod(`${year}-${value}-01`)}
                  />
                </div>
              </div>
              <label className="relative block">
                <span className="sr-only">코드·건물명·주소 검색</span>
                <SearchIcon className="pointer-events-none absolute left-[11px] top-1/2 size-[15px] -translate-y-1/2 text-t3" />
                <input
                  aria-label="코드·건물명·주소 검색"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="코드·건물명·주소 검색"
                  className="h-[34px] w-full rounded-[9px] border border-line bg-white pl-[31px] pr-[11px] text-[13px] font-semibold text-t1 outline-none placeholder:text-t4"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr>
                    <th className={`${LIST_TH} w-[38px] pl-3 pr-0`}>
                      <LedgerCheck checked={allSelected} label="전체 건물 선택" onToggle={toggleAll} clickable />
                    </th>
                    <th className={`${LIST_TH} w-[70px] px-4`}>코드</th>
                    <th className={`${LIST_TH} w-[100px] px-4`}>건물명</th>
                    <th className={`${LIST_TH} px-4`}>주소</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBuildings.map((building) => {
                    const checked = selectedIds.includes(building.id);
                    return (
                      <tr
                        key={building.id}
                        aria-selected={checked}
                        onClick={() => toggleBuilding(building.id)}
                        className={`cursor-pointer [&:last-child>td]:border-b-0 ${checked ? "bg-blue-t" : "hover:bg-row-hover"}`}
                      >
                        <td className={`${LIST_TD} pl-3 pr-0`}>
                          <LedgerCheck checked={checked} label={`${building.name} 출력 선택`} onToggle={() => toggleBuilding(building.id)} />
                        </td>
                        <td className={`${LIST_TD} px-4 tabular-nums`}>{building.code}</td>
                        <td className={`${LIST_TD} px-4`}>{building.name}</td>
                        <td className={`${LIST_TD} px-4`}>{building.address?.trim() || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div ref={previewRef} className="min-h-0 overflow-y-auto overflow-x-hidden bg-[#E8EBEE] p-4">
            {showPreview ? (
              <div ref={stackRef} className="flex w-[794px] origin-top-left flex-col items-start">
                <MeterLedgerDocument sources={sources} period={printPeriod} utilityType={utilityType} />
              </div>
            ) : (
              <div className={`flex h-full items-center justify-center text-center text-[13px] font-medium leading-[1.6] ${failed ? "text-red" : "text-t3"}`}>
                {previewMessage}
              </div>
            )}
          </div>
        </div>

        <footer className="flex flex-none items-center gap-[9px] border-t border-line px-5 py-3.5">
          <span className="text-[12.5px] font-semibold text-t3">
            <b className="font-bold text-t1">{selectedIds.length}</b>곳 선택
          </span>
          <span className="flex-1" />
          <Button
            type="button"
            size="wide"
            className="shadow-none"
            disabled={!showPreview || printing}
            onClick={() => setPrinting(true)}
          >
            <PrinterIcon className="size-4 flex-none" />
            인쇄
          </Button>
        </footer>
      </section>

      {printing && (
        <PrintSheet id="meterLedgerPrint" css={METER_LEDGER_PRINT_CSS} onDone={() => setPrinting(false)}>
          <MeterLedgerDocument sources={sources} period={printPeriod} utilityType={utilityType} />
        </PrintSheet>
      )}
    </div>
  );
}

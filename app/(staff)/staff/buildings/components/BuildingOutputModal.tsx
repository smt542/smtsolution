"use client";

import { useEffect, useMemo, useState } from "react";

import type { BuildingDirectoryRow } from "@/hooks/reactquery/buildings";
import { useBilling } from "@/hooks/reactquery/billing";
import type { TenantListRow } from "@/hooks/reactquery/occupancies";
import { ChevronDownIcon, CloseIcon, PrinterIcon, UnitCardIcon } from "@/components/icons";
import { formatKrw } from "@/lib/messaging/vars";

type BuildingOutputModalProps = {
  open: boolean;
  buildings: BuildingDirectoryRow[];
  selectedBuildingId: number | null;
  tenants: TenantListRow[];
  tenantsLoading?: boolean;
  onSelectBuilding: (buildingId: number) => void;
  onClose: () => void;
};

function PeriodDropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 min-w-[92px] items-center justify-between gap-3 rounded-[9px] border border-line bg-white px-3 text-[12px] font-semibold text-t2 outline-none focus-visible:ring-2 focus-visible:ring-[#69C8C0]"
      >
        {value}
        <ChevronDownIcon className={`size-3 text-t3 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 top-10 z-10 max-h-52 min-w-full overflow-y-auto rounded-[9px] border border-line bg-white p-1 shadow-card">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              onClick={() => { onChange(option); setOpen(false); }}
              className={`block w-full rounded-[7px] px-3 py-2 text-left text-[12px] ${option === value ? "bg-[#E9F8F6] font-bold text-teal" : "text-t2 hover:bg-bg"}`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewTable({
  compact = false,
  tenants,
  confirmedAmounts,
}: {
  compact?: boolean;
  tenants: TenantListRow[];
  confirmedAmounts: ReadonlyMap<number, number>;
}) {
  const rows = compact ? 14 : 18;
  return (
    <div className="mt-3 overflow-hidden border border-[#5D6670]">
      <div className="grid grid-cols-4 bg-[#EEF1F3] text-[4px] font-bold text-[#333B43]">
        {['호실', '입주자', '입주일', compact ? '연락처' : '부과금액'].map((label) => (
          <div key={label} className="border-r border-[#8A9299] px-1 py-1 last:border-r-0">{label}</div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, index) => {
        const tenant = tenants[index];
        const confirmedAmount = tenant ? confirmedAmounts.get(tenant.unitId) : undefined;
        return (
          <div key={index} className="grid grid-cols-4 border-t border-[#A8AFB5] text-[3.5px] text-[#515A63]">
            <div className="border-r border-[#A8AFB5] px-1 py-1">{tenant?.unitNo ?? ""}</div>
            <div className="border-r border-[#A8AFB5] px-1 py-1">{tenant ? (tenant.tenantName ?? "공실") : ""}</div>
            <div className="border-r border-[#A8AFB5] px-1 py-1">{tenant?.moveInDate?.slice(0, 7) ?? ""}</div>
            <div className="px-1 py-1 text-right">
              {tenant
                ? compact
                  ? tenant.phone ?? "-"
                  : confirmedAmount === undefined
                    ? "-"
                    : `${formatKrw(confirmedAmount)}원`
                : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PrintSheet({
  kind,
  buildingName,
  tenants,
  period,
  confirmedAmounts,
}: {
  kind: "card" | "charge";
  buildingName: string;
  tenants: TenantListRow[];
  period: string;
  confirmedAmounts: ReadonlyMap<number, number>;
}) {
  return (
    <article className="aspect-[210/297] w-[250px] shrink-0 bg-white px-7 py-6 shadow-[0_2px_8px_rgba(25,31,40,0.12)] print:mx-auto print:min-h-[297mm] print:w-[210mm] print:break-after-page print:px-[18mm] print:py-[16mm] print:shadow-none print:last:break-after-auto">
      <div className="text-center text-[8px] font-extrabold tracking-[-0.3px] text-[#20262C]">
        {kind === "card" ? "입주자 카드" : "관리비 부과내역서"}
      </div>
      <div className="mt-2 flex items-end justify-between border-b border-[#626B73] pb-1 text-[4px] text-[#59616A]">
        <span>{buildingName}</span>
        <span>{period} · {tenants.length}세대</span>
      </div>
      <PreviewTable compact={kind === "card"} tenants={tenants} confirmedAmounts={confirmedAmounts} />
      <div className="mt-3 text-center text-[3.5px] text-[#8B949D]">관리비서 · 출력 미리보기</div>
    </article>
  );
}

export function BuildingOutputModal({
  open,
  buildings,
  selectedBuildingId,
  tenants,
  tenantsLoading = false,
  onSelectBuilding,
  onClose,
}: BuildingOutputModalProps) {
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("2026년");
  const [month, setMonth] = useState("08월");
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null;
  const billingPeriod = `${year.slice(0, -1)}-${month.slice(0, -1)}-01`;
  const billingQuery = useBilling(open ? selectedBuildingId : null, billingPeriod);
  const confirmedAmounts = useMemo(() => {
    const amounts = new Map<number, number>();
    for (const row of billingQuery.data ?? []) {
      if (row.totalAmount !== null) amounts.set(row.unitId, row.totalAmount);
    }
    return amounts;
  }, [billingQuery.data]);
  const outputLoading = tenantsLoading || billingQuery.isLoading;
  const filteredBuildings = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return buildings;
    return buildings.filter((building) =>
      `${building.code} ${building.name} ${building.address ?? ""}`.toLowerCase().includes(keyword),
    );
  }, [buildings, search]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-building-output-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#191F28]/60 p-8 print:z-[9999] print:block print:bg-white print:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="building-output-modal-title"
        className="flex h-[min(720px,calc(100vh-64px))] w-[min(1200px,calc(100vw-64px))] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_18px_50px_rgba(25,31,40,0.22)] print:h-auto print:w-full print:overflow-visible print:rounded-none print:shadow-none"
      >
        <header className="flex h-[66px] shrink-0 items-center justify-between border-b border-line px-6 print:hidden">
          <h2 id="building-output-modal-title" className="text-[18px] font-extrabold tracking-[-0.3px] text-t1">
            입주자카드 및 부과내역 출력
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="출력 모달 닫기"
            className="grid size-8 place-items-center rounded-lg text-t3 transition hover:bg-bg hover:text-t1"
          >
            <CloseIcon className="size-[16px]" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[314px_minmax(0,1fr)] print:block">
          <aside className="flex min-h-0 flex-col border-r border-line bg-white p-5 print:hidden">
            <label htmlFor="building-output-search" className="mb-2 text-[12px] font-bold text-t2">출력 건물</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-t4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
              <input
                id="building-output-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="건물명 또는 코드 검색"
                className="h-10 w-full rounded-[9px] border border-line bg-bg pl-9 pr-3 text-[12px] text-t1 outline-none placeholder:text-t4 focus:border-teal"
              />
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-t3">
              <span>건물 목록</span>
              <span>{filteredBuildings.length}곳</span>
            </div>
            <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {filteredBuildings.map((building) => {
                const selected = building.id === selectedBuildingId;
                return (
                  <button
                    key={building.id}
                    type="button"
                    onClick={() => onSelectBuilding(building.id)}
                    aria-pressed={selected}
                    className={`flex w-full items-center gap-3 rounded-[10px] border px-3 py-[10px] text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#69C8C0] ${
                      selected
                        ? "border-[#9BDDD7] bg-[#E9F8F6]"
                        : "border-transparent hover:border-line hover:bg-bg"
                    }`}
                  >
                    <span className={`grid size-8 shrink-0 place-items-center rounded-[8px] text-[10px] font-extrabold ${selected ? "bg-teal text-white" : "bg-bg text-t3"}`}>
                      {building.code.slice(-3)}
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-[12px] font-bold ${selected ? "text-[#0E8178]" : "text-t1"}`}>{building.name}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-t3">{building.address || "주소 미등록"}</span>
                    </span>
                  </button>
                );
              })}
              {filteredBuildings.length === 0 && (
                <p className="py-12 text-center text-[12px] text-t3">검색 결과가 없습니다.</p>
              )}
            </div>
          </aside>

          <div className="flex min-h-0 flex-col bg-white">
            <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-line px-5 print:hidden">
              <div>
                <p className="text-[12px] font-bold text-t2">출력 기준</p>
                <p className="mt-0.5 text-[10px] text-t3">입주자카드와 관리비 부과내역서를 함께 출력합니다.</p>
              </div>
              <div className="flex items-center gap-2">
                <PeriodDropdown value={year} options={["2024년", "2025년", "2026년", "2027년"]} onChange={setYear} />
                <PeriodDropdown value={month} options={Array.from({ length: 12 }, (_, index) => `${String(index + 1).padStart(2, "0")}월`)} onChange={setMonth} />
              </div>
            </div>

            <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#F2F4F6] p-5 print:block print:overflow-visible print:bg-white print:p-0">
              {!selectedBuilding ? (
                <div className="flex w-[744px] max-w-full flex-col items-center justify-center gap-[6px] self-stretch text-center">
                  <UnitCardIcon className="size-[26px] text-teal" />
                  <p className="text-[13px] font-bold text-t2">출력할 건물을 선택해 주세요</p>
                  <p className="text-[11px] text-t3">왼쪽 목록에서 건물을 선택하면 출력 미리보기를 확인할 수 있어요.</p>
                </div>
              ) : outputLoading ? (
                <div className="text-[12px] text-t3">출력 자료를 불러오는 중입니다.</div>
              ) : (
                <div className="flex min-w-max items-start justify-center gap-4 print:block" data-testid="building-output-previews">
                  <PrintSheet kind="card" buildingName={selectedBuilding.name} tenants={tenants} period={`${year} ${month}`} confirmedAmounts={confirmedAmounts} />
                  <PrintSheet kind="charge" buildingName={selectedBuilding.name} tenants={tenants} period={`${year} ${month}`} confirmedAmounts={confirmedAmounts} />
                </div>
              )}
            </main>
          </div>
        </div>

        <footer className="flex h-[66px] shrink-0 items-center justify-between border-t border-line px-6 print:hidden">
          <p className="text-[11px] text-t3">
            {selectedBuilding ? <><strong className="font-bold text-t2">{selectedBuilding.name}</strong> · 총 {tenants.length}세대</> : "건물을 선택하면 출력 버튼이 활성화됩니다."}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-[10px] border border-line bg-white px-5 text-[13px] font-bold text-t2 hover:bg-bg">취소</button>
            <button
              type="button"
              disabled={!selectedBuilding || outputLoading}
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-teal px-5 text-[13px] font-bold text-white shadow-[0_2px_6px_rgba(20,164,151,0.22)] hover:bg-[#118F84] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PrinterIcon className="size-4" />
              출력하기
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

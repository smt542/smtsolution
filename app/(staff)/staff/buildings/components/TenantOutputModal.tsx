"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, CloseIcon, PrinterIcon, UnitCardIcon } from "@/components/icons";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBillDocuments, useBillOrganizationName, useBillTargets } from "@/hooks/reactquery/bill";
import { useTenantList } from "@/hooks/reactquery/occupancies";
import { currentPeriod } from "@/lib/billing/period";
import { PROGRAM_COMPANY_NAME } from "@/lib/bill/document";
import { BuildingPickerList } from "./tenant-output/BuildingPickerList";
import { ChargeStatementDocument } from "./tenant-output/ChargeStatementDocument";
import { PreviewPane } from "./tenant-output/PreviewPane";
import { TenantCardDocument } from "./tenant-output/TenantCardDocument";
import { buildChargeStatement, paginate } from "./tenant-output/statement";

const YEARS = Array.from({ length: 8 }, (_, index) => 2019 + index);
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const UNITS_PER_PAGE = 14;

type PrintScope = "both" | "card" | "statement";

/** 입주자카드 및 부과내역 출력 모달 — 건물 선택 → 좌우 미리보기 → 개별/일괄 인쇄. */
export function TenantOutputModal({
  onClose,
  initialBuildingId,
  initialUnitId,
}: {
  onClose: () => void;
  /** 본 화면에서 이미 선택된 건물을 초기 선택값으로 사용(PRD §3.3). */
  initialBuildingId?: number | null;
  /** 입주민 행에서 열었을 때 해당 세대의 카드 페이지를 바로 표시한다. */
  initialUnitId?: number | null;
}) {
  const [initYear, initMonth] = useMemo(() => {
    const [rawYear, rawMonth] = currentPeriod().split("-").map(Number);
    return [Math.min(2026, Math.max(2019, rawYear)), rawMonth] as const;
  }, []);
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  const [search, setSearch] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(initialBuildingId ?? null);
  const [requestedCardPage, setRequestedCardPage] = useState<number | null>(null);
  const [statementPage, setStatementPage] = useState(0);
  const [printScope, setPrintScope] = useState<PrintScope | null>(null);

  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data: allBuildings = [] } = useBuildings();
  const buildings = useMemo(() => allBuildings.filter((building) => building.orgId === orgId), [allBuildings, orgId]);
  const { data: orgName } = useBillOrganizationName(orgId);
  const companyName = orgName ?? PROGRAM_COMPANY_NAME;

  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null;
  const period = `${year}-${String(month).padStart(2, "0")}-01`;

  const { data: tenants = [], isLoading: tenantsLoading } = useTenantList(selectedBuildingId ?? 0);
  const { data: targets = [] } = useBillTargets(selectedBuildingId, period);
  const unitIds = useMemo(() => targets.map((target) => target.unitId), [targets]);
  const { data: documents = [] } = useBillDocuments(selectedBuildingId, period, unitIds);
  const statement = useMemo(() => buildChargeStatement(documents), [documents]);
  const statementPages = useMemo(() => paginate(statement.rows, UNITS_PER_PAGE), [statement]);

  const cardCount = tenants.length;
  const statementCount = statementPages.length;
  const initialCardPage = useMemo(() => {
    if (initialUnitId == null) return 0;
    const page = tenants.findIndex((tenant) => tenant.unitId === initialUnitId);
    return Math.max(0, page);
  }, [initialUnitId, tenants]);
  const cardPage = requestedCardPage ?? initialCardPage;
  const cardIdx = Math.min(cardPage, Math.max(0, cardCount - 1));
  const statementIdx = Math.min(statementPage, Math.max(0, statementCount - 1));

  useEffect(() => {
    if (!printScope) return;
    const reset = () => setPrintScope(null);
    window.addEventListener("afterprint", reset, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", reset);
  }, [printScope]);

  // 모달 열림 동안: Esc 닫기 + 배경 스크롤 잠금.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const selectBuilding = (id: number) => {
    setSelectedBuildingId(id);
    setRequestedCardPage(0);
    setStatementPage(0);
  };

  const hasBuilding = !!selectedBuilding;
  const canPrintCards = hasBuilding && cardCount > 0;
  const canPrintStatement = hasBuilding && statementCount > 0;
  const canPrintBoth = canPrintCards || canPrintStatement;

  const footerText = hasBuilding
    ? `${selectedBuilding.name} 선택됨 · 카드 ${cardCount}장 · 내역서 ${statementCount}장`
    : "건물을 선택해 주세요";

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#171f28]/50 p-[28px] print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-output-title"
        onClick={onClose}
      >
        <div
          className="flex h-[760px] max-h-[calc(100vh-40px)] w-[1120px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0px_40px_90px_-24px_rgba(0,0,0,0.5)]"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex shrink-0 items-center gap-[10px] border-b border-line px-[22px] py-[18px]">
            <PrinterIcon className="h-5 w-5 text-teal" />
            <h2 id="tenant-output-title" className="text-[17px] font-extrabold tracking-[-0.34px] text-t1">
              입주자카드 및 부과내역 출력
            </h2>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="ml-auto flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-t3 hover:bg-bg"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1">
            <BuildingPickerList
              buildings={buildings}
              search={search}
              onSearch={setSearch}
              selectedId={selectedBuildingId}
              onSelect={selectBuilding}
            />

            <div className="flex min-w-0 flex-1 flex-col bg-bg">
              <div className="flex shrink-0 items-center gap-[8px] border-b border-line bg-surface px-[18px] py-[11px]">
                <span className="pr-[2px] text-[12.5px] font-bold text-t3">출력 기준</span>
                <div className="relative">
                  <select
                    aria-label="출력 연도"
                    value={year}
                    onChange={(event) => setYear(Number(event.target.value))}
                    className="h-[34px] appearance-none rounded-[9px] border border-line bg-surface pl-[12px] pr-[30px] text-[13px] font-bold text-t1 focus:border-brand focus:outline-none"
                  >
                    {YEARS.map((value) => (
                      <option key={value} value={value}>{value}년</option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-[10px] top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-t3" />
                </div>
                <div className="relative">
                  <select
                    aria-label="출력 월분"
                    value={month}
                    onChange={(event) => setMonth(Number(event.target.value))}
                    className="h-[34px] appearance-none rounded-[9px] border border-line bg-surface pl-[12px] pr-[30px] text-[13px] font-bold text-t1 focus:border-brand focus:outline-none"
                  >
                    {MONTHS.map((value) => (
                      <option key={value} value={value}>{value}월</option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-[10px] top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-t3" />
                </div>
              </div>

              {!hasBuilding ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-[6px] p-[18px] text-center">
                  <UnitCardIcon className="h-[26px] w-[26px] text-t3" />
                  <p className="text-[14px] font-semibold text-t2">왼쪽에서 건물을 선택해 주세요</p>
                  <p className="text-[12.5px] font-medium text-t3">입주자카드와 관리비부과내역서 미리보기가 좌우로 표시돼요</p>
                </div>
              ) : (
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-[16px] p-[18px]">
                  <PreviewPane
                    title="입주자카드"
                    count={cardCount}
                    page={cardIdx + 1}
                    onPrev={() => setRequestedCardPage(Math.max(0, cardIdx - 1))}
                    onNext={() => setRequestedCardPage(Math.min(cardCount - 1, cardIdx + 1))}
                    actionLabel="카드만 인쇄"
                    onAction={() => setPrintScope("card")}
                    actionDisabled={!canPrintCards}
                    emptyMessage={tenantsLoading ? "불러오는 중…" : "등록된 세대가 없습니다"}
                  >
                    {cardCount > 0 && (
                      <TenantCardDocument
                        building={selectedBuilding}
                        tenant={tenants[cardIdx]}
                        companyName={companyName}
                        year={year}
                        month={month}
                        pageIndex={cardIdx}
                        pageCount={cardCount}
                      />
                    )}
                  </PreviewPane>

                  <PreviewPane
                    title="관리비부과내역서"
                    count={statementCount}
                    page={statementIdx + 1}
                    onPrev={() => setStatementPage((page) => Math.max(0, page - 1))}
                    onNext={() => setStatementPage((page) => Math.min(statementCount - 1, page + 1))}
                    actionLabel="내역서만 인쇄"
                    onAction={() => setPrintScope("statement")}
                    actionDisabled={!canPrintStatement}
                    emptyMessage="확정된 부과 내역이 없습니다"
                    emptyHint="관리비 부과 확정(P5) 후 표시됩니다"
                  >
                    {statementCount > 0 && (
                      <ChargeStatementDocument
                        building={selectedBuilding}
                        companyName={companyName}
                        year={year}
                        month={month}
                        feeNames={statement.feeNames}
                        rows={statementPages[statementIdx]}
                        pageIndex={statementIdx}
                        pageCount={statementCount}
                        totals={statementIdx === statementCount - 1 ? statement.totals : undefined}
                        grandTotal={statementIdx === statementCount - 1 ? statement.grandTotal : undefined}
                      />
                    )}
                  </PreviewPane>
                </div>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 items-center gap-[10px] border-t border-line px-[22px] py-[14px]">
            <span className="text-[12.5px] font-semibold text-t3">{footerText}</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="h-[40px] rounded-[11px] border border-line bg-white px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => setPrintScope("both")}
              disabled={!canPrintBoth}
              className="h-[40px] rounded-[11px] bg-teal px-[15px] text-[13.5px] font-bold text-white shadow-[0px_6px_7px_rgba(20,164,151,0.5)] hover:bg-teal-d disabled:opacity-45 disabled:shadow-none"
            >
              둘 다 인쇄
            </button>
          </footer>
        </div>
      </div>

      {hasBuilding && printScope && (
        <div className="hidden print:block">
          <style>{"@media print { @page { size: A4; margin: 0; } }"}</style>
          {(printScope === "both" || printScope === "card") &&
            tenants.map((tenant, index) => (
              <TenantCardDocument
                key={`card-${tenant.unitId}`}
                building={selectedBuilding}
                tenant={tenant}
                companyName={companyName}
                year={year}
                month={month}
                pageIndex={index}
                pageCount={cardCount}
              />
            ))}
          {(printScope === "both" || printScope === "statement") &&
            statementPages.map((rows, index) => (
              <ChargeStatementDocument
                key={`statement-${index}`}
                building={selectedBuilding}
                companyName={companyName}
                year={year}
                month={month}
                feeNames={statement.feeNames}
                rows={rows}
                pageIndex={index}
                pageCount={statementCount}
                totals={index === statementCount - 1 ? statement.totals : undefined}
                grandTotal={index === statementCount - 1 ? statement.grandTotal : undefined}
              />
            ))}
        </div>
      )}
    </>
  );
}

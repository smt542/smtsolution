"use client";
import { useEffect, useMemo, useState } from "react";
import { CloseIcon, PrinterIcon, UnitCardIcon } from "@/components/icons";
import { Button, CustomDropdown } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBillDocuments, useBillOrganizationName, useBillTargets } from "@/hooks/reactquery/bill";
import { useTenantCardPrintData } from "@/hooks/reactquery/occupancies";
import { currentPeriod } from "@/lib/billing/period";
import { PROGRAM_COMPANY_NAME } from "@/lib/bill/document";
import { BuildingPickerList } from "./tenant-output/BuildingPickerList";
import { ChargeStatementDocument } from "./tenant-output/ChargeStatementDocument";
import { PreviewPane } from "./tenant-output/PreviewPane";
import { TenantCardDocument } from "./tenant-output/TenantCardDocument";
import { buildChargeStatement, paginate } from "./tenant-output/statement";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}월` }));
const UNITS_PER_PAGE = 14;

// 정본 `.pm-dd` 드롭다운. 트리거는 hover 효과 없이 열렸을 때만 청록 테두리, 옵션은 hover 시 --bg·선택 시
// --blue 글자+--blue-t 배경이고 체크표시가 없다. 공용 CustomDropdown 기본값은 여기서만 덮는다.
const PERIOD_DROPDOWN = [
  "[&_.uc-dd-btn]:h-[34px] [&_.uc-dd-btn]:gap-[8px] [&_.uc-dd-btn]:px-[12px] [&_.uc-dd-btn]:tracking-normal",
  "[&_.uc-dd-btn]:shadow-none [&_.uc-dd-btn]:transition-none [&_.uc-dd-btn]:hover:border-line [&_.uc-dd-btn]:hover:shadow-none",
  "[&_.uc-dd.open_.uc-dd-btn]:border-teal",
  "[&_.uc-dd-btn_svg]:h-[13px] [&_.uc-dd-btn_svg]:w-[13px] [&_.uc-dd-btn_svg]:text-t3 [&_.uc-dd-btn_svg]:transition-transform [&_.uc-dd-btn_svg]:duration-150 [&_.uc-dd.open_.uc-dd-btn_svg]:rotate-180",
  "[&_.uc-dd-menu]:top-[calc(100%_+_5px)] [&_.uc-dd-menu]:right-auto [&_.uc-dd-menu]:left-0 [&_.uc-dd-menu]:z-[90] [&_.uc-dd-menu]:max-h-[240px] [&_.uc-dd-menu]:shadow-[0_14px_34px_-10px_rgba(23,31,40,0.28)]",
  "[&_.uc-opt]:px-[11px] [&_.uc-opt]:py-[9px] [&_.uc-opt]:transition-none [&_.uc-opt_svg]:hidden [&_.uc-opt.on]:text-teal",
].join(" ");

type PrintScope = "both" | "card" | "statement";

/** 입주자카드 및 부과내역 출력 모달 — 건물 선택 → 좌우 미리보기 → 개별/일괄 인쇄. */
export function TenantOutputModal({
  onClose,
  initialBuildingId,
}: {
  onClose: () => void;
  /** 본 화면에서 이미 선택된 건물을 초기 선택값으로 사용(PRD §3.4). */
  initialBuildingId?: number | null;
}) {
  const [initYear, initMonth] = useMemo(() => {
    const [rawYear, rawMonth] = currentPeriod().split("-").map(Number);
    return [rawYear, rawMonth] as const;
  }, []);
  // 정본 `#pmYear`: 올해부터 4개 연도 내림차순(2026년 기준 2026·2025·2024·2023).
  const yearOptions = useMemo(
    () => Array.from({ length: 4 }, (_, index) => ({ value: String(initYear - index), label: `${initYear - index}년` })),
    [initYear],
  );
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  const [search, setSearch] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(initialBuildingId ?? null);
  const [cardPage, setCardPage] = useState(0);
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

  const { data: tenants = [], isLoading: tenantsLoading } = useTenantCardPrintData(selectedBuildingId ?? 0);
  const { data: targets = [] } = useBillTargets(selectedBuildingId, period);
  const unitIds = useMemo(() => targets.map((target) => target.unitId), [targets]);
  const { data: documents = [] } = useBillDocuments(selectedBuildingId, period, unitIds);
  const statement = useMemo(() => buildChargeStatement(documents), [documents]);
  const statementPages = useMemo(() => paginate(statement.rows, UNITS_PER_PAGE), [statement]);

  const cardCount = tenants.length;
  const statementCount = statementPages.length;
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
    setCardPage(0);
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-[28px] print:hidden"
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
              className="ml-auto flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-t2 hover:bg-bg"
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
                <div className={PERIOD_DROPDOWN}>
                  <CustomDropdown
                    ariaLabel="출력 연도"
                    value={String(year)}
                    options={yearOptions}
                    onChange={(value) => setYear(Number(value))}
                  />
                </div>
                <div className={PERIOD_DROPDOWN}>
                  <CustomDropdown
                    ariaLabel="출력 월분"
                    value={String(month)}
                    options={MONTH_OPTIONS}
                    onChange={(value) => setMonth(Number(value))}
                  />
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
                    onPrev={() => setCardPage(Math.max(0, cardIdx - 1))}
                    onNext={() => setCardPage(Math.min(cardCount - 1, cardIdx + 1))}
                    actionLabel="카드만 인쇄"
                    onAction={() => setPrintScope("card")}
                    actionDisabled={!canPrintCards}
                    loading={tenantsLoading}
                    emptyMessage="등록된 세대가 없습니다"
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
            <Button
              variant="ghost"
              type="button"
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={() => setPrintScope("both")}
              disabled={!canPrintBoth}
              className="disabled:opacity-45 disabled:shadow-none"
            >
              둘 다 인쇄
            </Button>
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

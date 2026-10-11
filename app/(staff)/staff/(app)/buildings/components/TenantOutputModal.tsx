"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, DocumentIcon, PrinterIcon } from "@/components/icons";
import { Button, CustomDropdown } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillOrganizationName } from "@/hooks/reactquery/bill";
import { useBuildings, useStaffOptions } from "@/hooks/reactquery/buildings";
import { useOrgContact } from "@/hooks/reactquery/org/useOrgContact";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { useTenantOutputData } from "@/hooks/reactquery/tenantOutput";
import { currentPeriod } from "@/lib/billing/period";
import { BuildingPickerList } from "./tenant-output/BuildingPickerList";
import { ChargeStatementSheet } from "./tenant-output/ChargeStatementSheet";
import type { CardOrgInfo } from "./tenant-output/cardSheet";
import { PreviewPane } from "./tenant-output/PreviewPane";
import { TenantCardSheet } from "./tenant-output/TenantCardSheet";
import { buildOutputPages, outputHint, printSequence, type PrintScope } from "./tenant-output/outputPages";

const FIRST_OUTPUT_YEAR = 2019;
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}월` }));

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

// 정본 doPrint: A4 세로 여백 11mm, 인쇄 시트만 남기고 나머지는 숨긴다(시트는 body 직속 포털 — D11).
// html·body 규칙은 마지막 쪽 빈자리에 앱 배경이 찍히는 것과 모달 스크롤 잠금(overflow:hidden)을 막는다.
const PRINT_CSS =
  "@media print { @page { size: A4 portrait; margin: 11mm; } html, body { background: #fff !important; height: auto !important; overflow: visible !important; } body > *:not([data-print-sheet]) { display: none !important; } }";

/** 입주자카드 및 부과내역 출력 모달(정본 building-list `#printModal`) — 건물 단일 선택 → 좌우 미리보기 → 개별/일괄 인쇄. */
export function TenantOutputModal({ onClose, initialBuildingId = null }: { onClose: () => void; initialBuildingId?: number | null }) {
  const [initYear, initMonth] = useMemo(() => {
    const [rawYear, rawMonth] = currentPeriod().split("-").map(Number);
    return [rawYear, rawMonth] as const;
  }, []);
  // 정책: 출력 연도는 2019년부터 현재 연도까지(최신 연도 먼저).
  const yearOptions = useMemo(() => {
    const count = Math.max(1, initYear - FIRST_OUTPUT_YEAR + 1);
    return Array.from({ length: count }, (_, index) => ({ value: String(initYear - index), label: `${initYear - index}년` }));
  }, [initYear]);
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  const [search, setSearch] = useState("");
  // 정책: 단일 선택. 본 화면에서 고른 건물이 있으면 초기 선택값으로 쓰고, 없으면 선택 없이 연다.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(
    () => new Set<number>(initialBuildingId != null ? [initialBuildingId] : []),
  );
  const [cardPage, setCardPage] = useState(0);
  const [statementPage, setStatementPage] = useState(0);
  const [printScope, setPrintScope] = useState<PrintScope | null>(null);

  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data: allBuildings = [] } = useBuildings();
  const buildings = useMemo(() => allBuildings.filter((building) => building.orgId === orgId), [allBuildings, orgId]);
  const { data: orgName } = useBillOrganizationName(orgId);
  const { data: setup } = useSetupConfig(orgId);
  const { data: orgContact } = useOrgContact();
  const { data: accounts = [] } = useStaffOptions();
  // 스펙 §4.1: 관리업체 = 설정 회사명 → 조직명, 전화번호 = 회사 대표전화 → 조직 전화.
  const org = useMemo<CardOrgInfo>(
    () => ({
      companyName: setup?.companyName?.trim() || orgName || "",
      companyPhone: setup?.companyPhone?.trim() || orgContact?.phone || "",
      cleaningManagerName: (userId) => (userId ? (accounts.find((account) => account.userId === userId)?.fullName ?? "") : ""),
    }),
    [setup, orgName, orgContact, accounts],
  );

  // 표시·조회·인쇄 순서는 항상 건물 목록 순서다(정본 selBlds).
  const selected = useMemo(() => buildings.filter((building) => selectedIds.has(building.id)), [buildings, selectedIds]);
  const period = `${year}-${String(month).padStart(2, "0")}-01`;
  const outputData = useTenantOutputData(selected, period);
  const pages = buildOutputPages(selected, outputData, org);

  const cardCount = pages.cards.length;
  const statementCount = pages.statements.length;
  // 연·월이 바뀌어 쪽수가 줄면 마지막 쪽으로 당긴다(정본 renderDocs clamp).
  const cardIdx = Math.min(cardPage, Math.max(0, cardCount - 1));
  const statementIdx = Math.min(statementPage, Math.max(0, statementCount - 1));
  const card = pages.cards[cardIdx];
  const statement = pages.statements[statementIdx];

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

  // 정본 syncSel: 선택이 바뀌면 두 미리보기를 1쪽으로 되돌린다.
  const resetPages = () => {
    setCardPage(0);
    setStatementPage(0);
  };
  const selectBuilding = (id: number) => {
    setSelectedIds(new Set([id]));
    resetPages();
  };

  const hasSelection = selected.length > 0;
  const canPrintCards = pages.cardStatus === "ready" && cardCount > 0;
  const canPrintStatement = pages.statementStatus === "ready" && statementCount > 0;
  // 조회가 끝나지 않았거나 실패가 있으면 일부 건물이 빠진 채 인쇄될 수 있어 막는다.
  const settled = pages.cardStatus === "ready" && pages.statementStatus === "ready";
  const canPrintBoth = hasSelection && settled && (cardCount > 0 || statementCount > 0);
  const printItems = printScope ? printSequence(printScope, pages) : [];

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
          className="flex h-[min(760px,92vh)] w-[min(1120px,96vw)] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0px_40px_90px_-24px_rgba(0,0,0,0.5)]"
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
              selectedIds={selectedIds}
              onToggle={selectBuilding}
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

              {!hasSelection ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-[6px] p-[18px] text-center leading-[normal]">
                  <DocumentIcon strokeWidth={1.8} className="h-[26px] w-[26px] text-teal" />
                  <p className="text-[14px] font-semibold text-t2">왼쪽에서 건물을 선택해 주세요</p>
                  <p className="text-[12.5px] font-medium text-t3">입주자카드와 관리비부과내역서 미리보기가 좌우로 표시돼요</p>
                </div>
              ) : (
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-[16px] p-[18px]">
                  <PreviewPane
                    kind="card"
                    count={cardCount}
                    page={cardIdx + 1}
                    buildingLabel={card ? `${card.building.code} · ${card.building.name}` : ""}
                    onPrev={() => setCardPage(Math.max(0, cardIdx - 1))}
                    onNext={() => setCardPage(Math.min(cardCount - 1, cardIdx + 1))}
                    actionLabel="카드만 인쇄"
                    onAction={() => setPrintScope("card")}
                    actionDisabled={!canPrintCards}
                    status={pages.cardStatus}
                    emptyMessage="등록된 세대가 없습니다"
                  >
                    {card && <TenantCardSheet page={card} year={year} month={month} />}
                  </PreviewPane>

                  <PreviewPane
                    kind="statement"
                    count={statementCount}
                    page={statementIdx + 1}
                    buildingLabel={statement ? `${statement.building.code} · ${statement.building.name}` : ""}
                    onPrev={() => setStatementPage(Math.max(0, statementIdx - 1))}
                    onNext={() => setStatementPage(Math.min(statementCount - 1, statementIdx + 1))}
                    actionLabel="내역서만 인쇄"
                    onAction={() => setPrintScope("statement")}
                    actionDisabled={!canPrintStatement}
                    status={pages.statementStatus}
                    emptyMessage="확정된 부과 내역이 없습니다"
                    emptyHint="관리비 부과 확정(P5) 후 표시됩니다"
                  >
                    {statement && <ChargeStatementSheet page={statement} year={year} month={month} />}
                  </PreviewPane>
                </div>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 items-center gap-[10px] border-t border-line px-[22px] py-[14px]">
            <span className="text-[12.5px] font-semibold text-t3">{outputHint(selected, cardCount, statementCount)}</span>
            <div className="flex-1" />
            <Button variant="ghost" type="button" onClick={onClose}>
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

      {printItems.length > 0 &&
        createPortal(
          <div data-print-sheet className="hidden bg-white text-black print:block">
            <style>{PRINT_CSS}</style>
            {printItems.map((item) => (
              <section key={item.page.key} className="break-after-page last:break-after-auto">
                {item.kind === "card" ? (
                  <TenantCardSheet page={item.page} year={year} month={month} />
                ) : (
                  <ChargeStatementSheet page={item.page} year={year} month={month} />
                )}
              </section>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

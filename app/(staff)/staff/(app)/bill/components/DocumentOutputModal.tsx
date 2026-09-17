"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Spinner } from "@/components/common";
import { billKeys, getBillDocuments, listBillTargets, useAdjustmentStatements, useIssueBills, useSendBillFaxes, type BillDocument, type BillTarget } from "@/hooks/reactquery/bill";
import { billingKeys, getBillingPeriodSetting } from "@/hooks/reactquery/billing";
import { cmsDownloadUrl } from "@/hooks/reactquery/payments";
import { currentPeriod } from "@/lib/billing/period";
import { displayUnitNo, type PrintableAccount } from "@/lib/bill/document";
import type { BillBuilding, OutputDocumentType } from "../types";
import type { GiroOutputDocument, GiroPrintViewProps, GiroStampOptions } from "./GiroPrintView";
import { AutoDebitTable, deriveAutoDebitCells } from "./output-modal/AutoDebitTable";
import { AdjustmentPreviewViewport, AdjustmentStatementPreview, AdjustmentStatementStyles } from "./output-modal/AdjustmentStatement";
import { CompactDocumentPreview } from "./output-modal/CompactDocumentPreview";
import { FaxConfirmationModal } from "./output-modal/FaxConfirmationModal";
import { ModalActionButton, ZoomControls } from "./output-modal/OutputModalPrimitives";
import { OutputSelectionPane } from "./output-modal/OutputSelectionPane";
import { GiroStampToolbar, type GiroStampKind, type GiroStampScope } from "./output-modal/GiroStampToolbar";

const GiroPrintView = dynamic<GiroPrintViewProps>(() => import("./GiroPrintView").then((module) => module.GiroPrintView), { loading: () => <div className="flex min-h-[420px] items-center justify-center bg-[#e8ebee]"><Spinner /></div> });

function formatOutputDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface DocumentOutputModalProps {
  type: OutputDocumentType;
  orgId: number;
  buildings: BillBuilding[];
  companyName: string;
  accounts: PrintableAccount[];
  customerNotice: string | null;
  onClose: () => void;
}

const TITLES: Record<OutputDocumentType, string> = { giro: "지로 고지서 출력", adjustment: "조정명세서 출력", autoDebit: "자동이체 세대 출력", fax: "팩스 발송" };
const YEARS = Array.from({ length: 8 }, (_, index) => 2019 + index);
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function initialYearMonth() {
  const [rawYear, rawMonth] = currentPeriod().split("-").map(Number);
  return { year: Math.min(2026, Math.max(2019, rawYear)), month: rawMonth };
}
function outputPeriod(year: number, month: number) { return `${year}-${String(month).padStart(2, "0")}-01`; }
function mergeGiroDocuments(building: BillBuilding, documents: BillDocument[], targets: BillTarget[], dueDate: string | null): GiroOutputDocument[] {
  return documents.flatMap((document) => {
    const target = targets.find((candidate) => candidate.unitId === document.unitId);
    return target ? [{ building, document, target, dueDate }] : [];
  });
}

export function DocumentOutputModal({ type, orgId, buildings, companyName, accounts, customerNotice, onClose }: DocumentOutputModalProps) {
  const initial = initialYearMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [outputDate] = useState(() => formatOutputDate(new Date()));
  const [search, setSearch] = useState("");
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<number[]>(
    type === "autoDebit" ? buildings.map((building) => building.id) : [],
  );
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [previewUnitId, setPreviewUnitId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(type === "adjustment" ? 55 : 100);
  const [group, setGroup] = useState(0);
  const [stamps, setStamps] = useState<GiroStampOptions>({ reissue: false, waterCutoffUnitIds: [], autoDebit: false });
  const [waterCutoffStamp, setWaterCutoffStamp] = useState(false);
  const [stampScope, setStampScope] = useState<GiroStampScope>("individual");
  const [faxConfirmOpen, setFaxConfirmOpen] = useState(false);
  const [faxRecipient, setFaxRecipient] = useState("");
  const [faxError, setFaxError] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const faxSelectionInitialized = useRef(false);
  const issueBills = useIssueBills();
  const sendFaxes = useSendBillFaxes();
  const handlePreviewReady = useCallback(() => setPreviewReady(true), []);

  const period = outputPeriod(year, month);
  const needsDocuments = type === "giro" || type === "fax";
  const selectedBuildings = useMemo(() => buildings.filter((building) => selectedBuildingIds.includes(building.id)), [buildings, selectedBuildingIds]);
  const normalizedSearch = search.trim().toLocaleLowerCase("ko-KR");
  const visibleBuildings = buildings.filter((building) => !normalizedSearch || `${building.code} ${building.name} ${building.address ?? ""}`.toLocaleLowerCase("ko-KR").includes(normalizedSearch));

  const currentTargetQueries = useQueries({ queries: selectedBuildings.map((building) => ({ queryKey: billKeys.targets(building.id, period), queryFn: () => listBillTargets(building.id, period) })) });
  const periodSettingQueries = useQueries({ queries: selectedBuildings.map((building) => ({ queryKey: billingKeys.periodSetting(building.id, period), queryFn: () => getBillingPeriodSetting(building.id, period), enabled: type === "giro" || type === "fax" })) });
  const currentTargetsByBuilding = selectedBuildings.map((building, index) => ({ building, targets: currentTargetQueries[index]?.data ?? [] }));
  const currentDocumentQueries = useQueries({ queries: currentTargetsByBuilding.map(({ building, targets }) => ({ queryKey: billKeys.documents(building.id, period, targets.map((target) => target.unitId)), queryFn: () => getBillDocuments(building.id, period, targets.map((target) => target.unitId)), enabled: needsDocuments && targets.length > 0 })) });

  const adjustment = useAdjustmentStatements({ buildings: selectedBuildings, period, orgId, companyName, outputDate, enabled: type === "adjustment" });

  const allGiroDocuments = currentTargetsByBuilding.flatMap(({ building, targets }, index) => mergeGiroDocuments(building, currentDocumentQueries[index]?.data ?? [], targets, periodSettingQueries[index]?.data?.dueDate ?? null));
  const validSelectedUnitIds = selectedUnitIds.filter((unitId) => allGiroDocuments.some(({ document }) => document.unitId === unitId));
  const effectiveIndividualId = previewUnitId !== null && validSelectedUnitIds.includes(previewUnitId)
    ? previewUnitId
    : validSelectedUnitIds[0] ?? null;
  const giroDocuments = allGiroDocuments.filter(({ document }) => validSelectedUnitIds.includes(document.unitId));
  const allTargets = currentTargetsByBuilding.flatMap(({ building, targets }) => targets.map((target) => ({ building, target })));
  const autoDebitRows = allTargets.filter(({ target }) => target.autoDebit);
  const faxReadyTargets = allTargets.filter(({ target }) => Boolean(target.faxNumber));
  const selectedFaxTargets = faxReadyTargets.filter(({ target }) => selectedUnitIds.includes(target.unitId));
  const selectedFaxBuilding = selectedFaxTargets[0]?.building;
  const selectedFaxTargetValues = selectedFaxTargets.map(({ target }) => target);
  const previewEntry = allGiroDocuments.find(({ document }) => document.unitId === effectiveIndividualId);
  const waterCutoffUnitIds = allGiroDocuments.filter(({ target }) => target.waterCutoff).map(({ document }) => document.unitId);
  const stampTargetIds = stampScope === "all"
    ? validSelectedUnitIds
    : effectiveIndividualId === null ? [] : [effectiveIndividualId];
  const printWaterCutoffUnitIds = [...new Set([
    ...waterCutoffUnitIds,
    ...(waterCutoffStamp ? stampTargetIds : []),
  ])];

  useEffect(() => {
    if (type !== "fax" || faxSelectionInitialized.current || faxReadyTargets.length === 0) return;
    const first = faxReadyTargets[0].target;
    faxSelectionInitialized.current = true;
    setSelectedUnitIds([first.unitId]);
    setPreviewUnitId(first.unitId);
    setFaxRecipient(first.faxNumber ?? "");
  }, [faxReadyTargets, type]);

  const allQueries = [...currentTargetQueries, ...(needsDocuments ? currentDocumentQueries : []), ...(type === "giro" || type === "fax" ? periodSettingQueries : [])];
  const isPreviewInitialLoading = (type === "adjustment" && adjustment.isLoading) || allQueries.some((query) => query.isLoading);
  const isPreviewRefreshing = (type === "adjustment" && adjustment.isRefreshing) || allQueries.some(
    (query) => query.isFetching && !query.isLoading,
  );
  const isPreviewBusy = isPreviewInitialLoading || isPreviewRefreshing;
  const isError = (type === "adjustment" && adjustment.isError) || allQueries.some((query) => query.isError);
  const hasPrintableData = type === "giro" ? giroDocuments.length > 0 : type === "adjustment" ? adjustment.hasData : false;

  const resetPeriodSelection = () => {
    setSelectedUnitIds([]);
    setPreviewUnitId(null);
    setStamps({ reissue: false, waterCutoffUnitIds: [], autoDebit: false });
    setWaterCutoffStamp(false);
    setStampScope("individual");
    setFaxConfirmOpen(false);
    setFaxRecipient("");
    faxSelectionInitialized.current = false;
  };
  const changeYear = (value: number) => { setYear(value); resetPeriodSelection(); };
  const changeMonth = (value: number) => { setMonth(value); resetPeriodSelection(); };
  const toggleBuilding = (buildingId: number) => { setSelectedBuildingIds((selected) => selected.includes(buildingId) ? selected.filter((id) => id !== buildingId) : [...selected, buildingId]); resetPeriodSelection(); };
  const toggleUnit = (unitId: number) => {
    setSelectedUnitIds((current) => {
      if (current.includes(unitId)) {
        const next = current.filter((id) => id !== unitId);
        setPreviewUnitId((preview) => preview === unitId ? next.at(-1) ?? null : preview);
        return next;
      }
      setPreviewUnitId(unitId);
      return [...current, unitId];
    });
    if (type === "fax") {
      const target = faxReadyTargets.find((entry) => entry.target.unitId === unitId)?.target;
      if (target?.faxNumber) setFaxRecipient(target.faxNumber);
      faxSelectionInitialized.current = true;
    }
  };
  const toggleAllBuildings = () => {
    const visibleIds = visibleBuildings.map((building) => building.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedBuildingIds.includes(id));
    setSelectedBuildingIds((selected) => allVisibleSelected
      ? selected.filter((id) => !visibleIds.includes(id))
      : [...new Set([...selected, ...visibleIds])]);
    resetPeriodSelection();
  };
  const toggleAllUnits = () => {
    const availableIds = type === "fax"
      ? faxReadyTargets.map(({ target }) => target.unitId)
      : allTargets.map(({ target }) => target.unitId);
    if (availableIds.length === 0) return;
    const selectedIds = selectedUnitIds;
    const allSelected = availableIds.every((id) => selectedIds.includes(id));
    setSelectedUnitIds(allSelected ? [] : availableIds);
    setPreviewUnitId(allSelected ? null : availableIds[0] ?? null);
    if (type === "fax") {
      setFaxRecipient(allSelected ? "" : faxReadyTargets[0]?.target.faxNumber ?? "");
      faxSelectionInitialized.current = true;
    }
  };
  const toggleStamp = (kind: GiroStampKind) => {
    if (stampTargetIds.length === 0) return;
    if (kind === "reissue") {
      setStamps((current) => ({ ...current, reissue: !current.reissue }));
    } else if (kind === "autoDebit") {
      setStamps((current) => ({ ...current, autoDebit: !current.autoDebit }));
    } else {
      setWaterCutoffStamp((current) => !current);
    }
  };

  const print = async () => {
    if (!hasPrintableData) return;
    if (type === "giro") {
      try {
        for (const [buildingIndex, building] of selectedBuildings.entries()) {
          const unitIds = giroDocuments.filter((entry) => entry.building.id === building.id).map((entry) => entry.document.unitId);
          if (unitIds.length > 0) await issueBills.mutateAsync({ buildingId: building.id, period, unitIds, issueType: "giro", dueDate: periodSettingQueries[buildingIndex]?.data?.dueDate ?? null, unitLabelMode: "name", waterCutoffUnitIds: printWaterCutoffUnitIds.filter((unitId) => unitIds.includes(unitId)) });
        }
      } catch (error) {
        toast.error(error, "지로 고지서 발행에 실패했습니다.");
        return;
      }
    }
    window.print();
  };
  const downloadAutoDebit = () => {
    selectedBuildings.forEach((building) => {
      const anchor = document.createElement("a");
      anchor.href = cmsDownloadUrl(building.id, period);
      anchor.download = "";
      anchor.click();
    });
  };
  const openFaxConfirmation = () => {
    if (selectedFaxTargets.length === 0) return;
    setFaxRecipient(selectedFaxTargets[0]?.target.faxNumber ?? "");
    setFaxError(false);
    setFaxConfirmOpen(true);
  };
  const sendFax = async () => {
    if (selectedFaxTargets.length === 0) { toast.info("팩스번호가 등록된 세대를 선택해 주세요."); return; }
    setFaxError(false);
    let hasError = false;
    let totalQueued = 0;
    let totalFailed = 0;
    for (const building of selectedBuildings) {
      const unitIds = selectedFaxTargets.filter((entry) => entry.building.id === building.id).map((entry) => entry.target.unitId);
      if (unitIds.length === 0) continue;
      try {
        const result = await sendFaxes.mutateAsync({ buildingId: building.id, period, unitIds });
        totalQueued += result.queued;
        totalFailed += result.failed;
      } catch { hasError = true; }
    }
    if (hasError || totalFailed > 0) {
      setFaxError(true);
      toast.error(totalQueued > 0 ? `일부만 접수되었습니다 · 접수 ${totalQueued} · 실패 ${totalFailed}` : "발송에 실패했습니다. 실패 세대를 다시 선택해 재발송해 주세요.");
    } else {
      toast.success("발송을 접수했습니다. 결과 확인 중입니다.");
      setFaxConfirmOpen(false);
    }
  };

  const printPreview = type === "giro" ? <GiroPrintView companyName={companyName} period={period} documents={giroDocuments} accounts={accounts} customerNotice={customerNotice} stamps={{ ...stamps, reissueUnitIds: stamps.reissue ? stampTargetIds : [], autoDebitUnitIds: stamps.autoDebit ? stampTargetIds : [], waterCutoffUnitIds: printWaterCutoffUnitIds }} onReady={handlePreviewReady} /> : null;
  const selectedUnitCount = selectedUnitIds.length;
  const stampFooterLabel = (type === "giro" || type === "fax") && stampTargetIds.length > 0
    ? stampScope === "all"
      ? "스탬프 · 전체"
      : `스탬프 · ${previewEntry ? displayUnitNo(previewEntry.target.unitNo) : "-"}`
    : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-3 print:hidden" role="dialog" aria-modal="true" aria-labelledby="output-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="flex h-[660px] w-[1020px] max-h-[calc(100vh-24px)] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_30px_70px_-20px_rgba(0,0,0,0.4)]">
          <header className="flex h-[61px] shrink-0 items-center justify-between border-b border-[#e8ebee] px-[20px]">
            <h2 id="output-modal-title" className="text-[16px] font-extrabold leading-[21px] tracking-[-0.02em] text-[#191f28]">{TITLES[type]}</h2>
            <button type="button" aria-label="출력 모달 닫기" onClick={onClose} className="flex size-[26px] items-center justify-center rounded-[8px] border border-[#e8ebee] bg-white hover:bg-[#f8f9fa]"><Image src="/figma-assets/bill/modal-close.svg" alt="" width={14} height={14} className="size-[14px]" /></button>
          </header>
          <div className="flex h-[530px] min-h-0 shrink-0">
            {type === "autoDebit" ? (
              <AutoDebitTable year={year} month={month} years={YEARS} months={MONTHS} group={group} rows={autoDebitRows} onYearChange={changeYear} onMonthChange={changeMonth} onGroupChange={setGroup} />
            ) : (
              <>
                <div className="w-[340px] shrink-0"><OutputSelectionPane type={type} year={year} month={month} years={YEARS} months={MONTHS} search={search} buildings={visibleBuildings} selectedBuildingIds={selectedBuildingIds} targetsByBuilding={currentTargetsByBuilding} selectedUnitIds={validSelectedUnitIds} onYearChange={changeYear} onMonthChange={changeMonth} onSearchChange={setSearch} onToggleBuilding={toggleBuilding} onToggleAllBuildings={toggleAllBuildings} onToggleUnit={toggleUnit} onToggleAllUnits={toggleAllUnits} /></div>
                <div className="relative flex min-w-0 flex-1 flex-col">
                  {(type === "giro" || type === "fax") && (
                    <GiroStampToolbar
                      stamps={{ reissue: stamps.reissue, waterCutoff: waterCutoffStamp, autoDebit: stamps.autoDebit }}
                      scope={stampScope}
                      disabled={stampTargetIds.length === 0}
                      onToggleStamp={toggleStamp}
                      onScopeChange={setStampScope}
                    />
                  )}
                  {selectedBuildingIds.length === 0 ? (
                    <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#e8ebee] text-center text-[12px] leading-[19px] text-[#8b95a1]">
                      <p><strong className="block font-semibold">출력할 건물을 선택해 주세요</strong><span>선택한 건물의 {type === "adjustment" ? "조정명세서" : "지로 고지서"}가 여기에 표시돼요</span></p>
                      <ZoomControls zoom={zoom} onZoom={setZoom} />
                    </div>
                  ) : isError ? (
                    <div role="alert" className="flex flex-1 items-center justify-center bg-[#e8ebee] text-[12px] font-bold text-[#f04452]">확정 부과 자료를 불러오지 못했습니다.</div>
                  ) : isPreviewInitialLoading ? (
                    <div className="flex min-h-[420px] flex-1 items-center justify-center bg-[#e8ebee]"><Spinner label="출력 미리보기 불러오는 중" /></div>
                  ) : (type === "giro" || type === "fax") && validSelectedUnitIds.length === 0 ? (
                    <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#e8ebee] text-[12px] text-[#8b95a1]">
                      출력할 호수를 선택해 주세요
                      <ZoomControls zoom={zoom} onZoom={setZoom} />
                    </div>
                  ) : type === "adjustment" ? (
                    adjustment.hasData ? (
                      <AdjustmentPreviewViewport pages={adjustment.pages} zoom={zoom} onZoom={setZoom} refreshing={isPreviewRefreshing} />
                    ) : (
                      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#e8ebee] text-[12px] text-[#8b95a1]">
                        표시할 조정 명세 자료가 없습니다.
                        <ZoomControls zoom={zoom} onZoom={setZoom} />
                      </div>
                    )
                  ) : (
                    <>
                      <CompactDocumentPreview companyName={companyName} period={period} pages={giroDocuments} accounts={accounts} customerNotice={customerNotice} stamps={{ ...stamps, reissueUnitIds: stamps.reissue ? stampTargetIds : [], autoDebitUnitIds: stamps.autoDebit ? stampTargetIds : [], waterCutoffUnitIds: printWaterCutoffUnitIds }} highlightedUnitIds={stampTargetIds} onSelectUnit={setPreviewUnitId} zoom={zoom} onZoom={setZoom} />
                      {isPreviewRefreshing ? (
                        <div className={`pointer-events-none absolute right-3 rounded-full bg-surface/95 shadow-card ${type === "giro" || type === "fax" ? "top-[60px]" : "top-3"}`}>
                          <Spinner label="출력 미리보기 갱신 중" size="small" showLabel className="px-3 py-2" />
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <footer className="flex h-[69px] shrink-0 items-center justify-between border-t border-[#e8ebee] px-[20px]">
            <div className="flex items-center gap-[14px]">
              <p className="text-[11.5px] font-semibold text-[#8b95a1]">{type === "autoDebit" ? "" : type === "adjustment" ? `${selectedBuildingIds.length}곳 선택` : `건물 ${selectedBuildingIds.length}개 / 호수 ${selectedUnitCount}개 선택`}</p>
              {stampFooterLabel && <span className="text-[11.5px] font-bold text-[#14a497]">{stampFooterLabel}</span>}
            </div>
            <div className="flex items-center gap-[8px]">
              {type === "autoDebit" && <><ModalActionButton variant="ghost" icon="/figma-assets/bill/download.svg" onClick={downloadAutoDebit} disabled={selectedBuildings.length === 0}>다운로드</ModalActionButton><ModalActionButton icon="/figma-assets/bill/print.svg" onClick={() => window.print()} disabled={autoDebitRows.length === 0}>인쇄</ModalActionButton></>}
              {(type === "giro" || type === "adjustment") && <ModalActionButton icon="/figma-assets/bill/print.svg" onClick={() => void print()} disabled={!hasPrintableData || isPreviewBusy || (type === "giro" && (!previewReady || issueBills.isPending))}>{type === "giro" && issueBills.isPending ? "발행 중…" : "인쇄"}</ModalActionButton>}
              {/* 발송 버튼 아이콘은 Figma export가 print.svg(흰색 16px)와 동일한 글리프다 — 카드용 document-fax.svg는 청록 22px라 버튼 위에서 보이지 않는다. */}
              {type === "fax" && <ModalActionButton icon="/figma-assets/bill/print.svg" onClick={openFaxConfirmation} disabled={selectedFaxTargets.length === 0 || sendFaxes.isPending}>{sendFaxes.isPending ? "발송 중…" : "발송"}</ModalActionButton>}
            </div>
          </footer>
        </div>
      </div>
      {type === "adjustment" && <AdjustmentStatementStyles />}
      {type === "giro" && hasPrintableData && <div className="hidden print:block" data-testid="document-output-print-root">{printPreview}</div>}
      {type === "adjustment" && adjustment.hasData && <div className="hidden print:block" data-testid="document-output-print-root"><AdjustmentStatementPreview pages={adjustment.pages} mode="print" /></div>}
      {type === "autoDebit" && autoDebitRows.length > 0 && (
        <table className="hidden w-full border-collapse text-xs print:table" data-testid="auto-debit-print-root"><thead><tr>{["#", "청구타입", "회원번호", "계약번호", "회원명", "청구월", "약정일", "결제일(결제시작일)", "상품", "기본금액", "수량", "회원구분"].map((label) => <th key={label} className="border p-2">{label}</th>)}</tr></thead><tbody>{autoDebitRows.map(({ building, target }, index) => {
          const cells = deriveAutoDebitCells(building, target, year, month);
          return (<tr key={`${building.id}-${target.unitId}`}><td className="border p-2 text-center">{index + 1}</td><td className="border p-2">{cells.billType}</td><td className="border p-2">{cells.memberNo}</td><td className="border p-2">{cells.contractNo}</td><td className="border p-2">{cells.memberName}</td><td className="border p-2">{cells.billMonth}</td><td className="border p-2">{cells.agreedDay}</td><td className="border p-2">{cells.paymentDate}</td><td className="border p-2">{cells.product}</td><td className="border p-2 text-right">{cells.baseAmount}</td><td className="border p-2 text-center">{cells.quantity}</td><td className="border p-2">{cells.memberGroup}</td></tr>);
        })}</tbody></table>
      )}
      {faxConfirmOpen && <FaxConfirmationModal building={selectedFaxBuilding} targets={selectedFaxTargetValues} period={period} senderLabel="등록 발신번호 · 본사" recipient={faxRecipient} isPending={sendFaxes.isPending} error={faxError} onCancel={() => setFaxConfirmOpen(false)} onSend={() => void sendFax()} />}
    </>
  );
}

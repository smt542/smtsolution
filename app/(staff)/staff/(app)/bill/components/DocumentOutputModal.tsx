"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Spinner } from "@/components/common";
import { billKeys, getBillDocuments, listBillTargets, useIssueBills, useSendBillFaxes, type BillDocument, type BillTarget } from "@/hooks/reactquery/bill";
import { billingKeys, getBillingPeriodSetting } from "@/hooks/reactquery/billing";
import { cmsDownloadUrl } from "@/hooks/reactquery/payments";
import { currentPeriod, prevPeriod } from "@/lib/billing/period";
import type { PrintableAccount } from "@/lib/bill/document";
import type { BillBuilding, OutputDocumentType } from "../types";
import type { AdjustmentBuildingDocuments, AdjustmentPrintViewProps } from "./AdjustmentPrintView";
import type { GiroOutputDocument, GiroPrintViewProps, GiroStampOptions } from "./GiroPrintView";
import { AutoDebitTable } from "./output-modal/AutoDebitTable";
import { CompactDocumentPreview } from "./output-modal/CompactDocumentPreview";
import { FaxConfirmationModal } from "./output-modal/FaxConfirmationModal";
import { ModalActionButton, ZoomControls } from "./output-modal/OutputModalPrimitives";
import { OutputSelectionPane } from "./output-modal/OutputSelectionPane";
import { GiroStampToolbar, type GiroStampKind, type GiroStampScope } from "./output-modal/GiroStampToolbar";

const AdjustmentPrintView = dynamic<AdjustmentPrintViewProps>(() => import("./AdjustmentPrintView").then((module) => module.AdjustmentPrintView), { loading: () => <Spinner /> });
const GiroPrintView = dynamic<GiroPrintViewProps>(() => import("./GiroPrintView").then((module) => module.GiroPrintView), { loading: () => <Spinner /> });

export interface DocumentOutputModalProps {
  type: OutputDocumentType;
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
function displayUnitNo(unitNo: string) { return unitNo.endsWith("호") ? unitNo : `${unitNo}호`; }
function mergeGiroDocuments(building: BillBuilding, documents: BillDocument[], targets: BillTarget[], dueDate: string | null): GiroOutputDocument[] {
  return documents.flatMap((document) => {
    const target = targets.find((candidate) => candidate.unitId === document.unitId);
    return target ? [{ building, document, target, dueDate }] : [];
  });
}

export function DocumentOutputModal({ type, buildings, companyName, accounts, customerNotice, onClose }: DocumentOutputModalProps) {
  const initial = initialYearMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [search, setSearch] = useState("");
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<number[]>(
    type === "autoDebit" ? buildings.map((building) => building.id) : type === "giro" ? [] : buildings[0] ? [buildings[0].id] : [],
  );
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [previewUnitId, setPreviewUnitId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100);
  const [group, setGroup] = useState(0);
  const [stamps, setStamps] = useState<GiroStampOptions>({ reissue: false, waterCutoffUnitIds: [], autoDebit: false });
  const [waterCutoffStamp, setWaterCutoffStamp] = useState(false);
  const [stampScope, setStampScope] = useState<GiroStampScope>("individual");
  const [selectedFaxUnitIds, setSelectedFaxUnitIds] = useState<number[]>([]);
  const [faxConfirmOpen, setFaxConfirmOpen] = useState(false);
  const [faxRecipient, setFaxRecipient] = useState("");
  const [faxError, setFaxError] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const faxSelectionInitialized = useRef(false);
  const issueBills = useIssueBills();
  const sendFaxes = useSendBillFaxes();
  const handlePreviewReady = useCallback(() => setPreviewReady(true), []);

  const period = outputPeriod(year, month);
  const previousPeriod = prevPeriod(period);
  const needsDocuments = type === "giro" || type === "adjustment";
  const selectedBuildings = useMemo(() => buildings.filter((building) => selectedBuildingIds.includes(building.id)), [buildings, selectedBuildingIds]);
  const normalizedSearch = search.trim().toLocaleLowerCase("ko-KR");
  const visibleBuildings = buildings.filter((building) => !normalizedSearch || `${building.code} ${building.name} ${building.address ?? ""}`.toLocaleLowerCase("ko-KR").includes(normalizedSearch));

  const currentTargetQueries = useQueries({ queries: selectedBuildings.map((building) => ({ queryKey: billKeys.targets(building.id, period), queryFn: () => listBillTargets(building.id, period) })) });
  const previousTargetQueries = useQueries({ queries: selectedBuildings.map((building) => ({ queryKey: billKeys.targets(building.id, previousPeriod), queryFn: () => listBillTargets(building.id, previousPeriod), enabled: type === "adjustment" })) });
  const periodSettingQueries = useQueries({ queries: selectedBuildings.map((building) => ({ queryKey: billingKeys.periodSetting(building.id, period), queryFn: () => getBillingPeriodSetting(building.id, period), enabled: type === "giro" })) });
  const currentTargetsByBuilding = selectedBuildings.map((building, index) => ({ building, targets: currentTargetQueries[index]?.data ?? [] }));
  const previousTargetsByBuilding = selectedBuildings.map((building, index) => ({ building, targets: previousTargetQueries[index]?.data ?? [] }));
  const currentDocumentQueries = useQueries({ queries: currentTargetsByBuilding.map(({ building, targets }) => ({ queryKey: billKeys.documents(building.id, period, targets.map((target) => target.unitId)), queryFn: () => getBillDocuments(building.id, period, targets.map((target) => target.unitId)), enabled: needsDocuments && targets.length > 0 })) });
  const previousDocumentQueries = useQueries({ queries: previousTargetsByBuilding.map(({ building, targets }) => ({ queryKey: billKeys.documents(building.id, previousPeriod, targets.map((target) => target.unitId)), queryFn: () => getBillDocuments(building.id, previousPeriod, targets.map((target) => target.unitId)), enabled: type === "adjustment" && targets.length > 0 })) });

  const allGiroDocuments = currentTargetsByBuilding.flatMap(({ building, targets }, index) => mergeGiroDocuments(building, currentDocumentQueries[index]?.data ?? [], targets, periodSettingQueries[index]?.data?.dueDate ?? null));
  const validSelectedUnitIds = selectedUnitIds.filter((unitId) => allGiroDocuments.some(({ document }) => document.unitId === unitId));
  const effectiveIndividualId = previewUnitId !== null && validSelectedUnitIds.includes(previewUnitId)
    ? previewUnitId
    : validSelectedUnitIds[0] ?? null;
  const giroDocuments = allGiroDocuments.filter(({ document }) => validSelectedUnitIds.includes(document.unitId));
  const adjustmentBuildings: AdjustmentBuildingDocuments[] = currentTargetsByBuilding.map(({ building, targets }, index) => ({ building, targets, current: currentDocumentQueries[index]?.data ?? [], previous: previousDocumentQueries[index]?.data ?? [] }));
  const allTargets = currentTargetsByBuilding.flatMap(({ building, targets }) => targets.map((target) => ({ building, target })));
  const autoDebitRows = allTargets.filter(({ target }) => target.autoDebit);
  const faxReadyTargets = allTargets.filter(({ target }) => Boolean(target.faxNumber));
  const selectedFaxTargets = faxReadyTargets.filter(({ target }) => selectedFaxUnitIds.includes(target.unitId));
  const selectedFaxBuilding = selectedFaxTargets[0]?.building;
  const selectedFaxTargetValues = selectedFaxTargets.map(({ target }) => target);
  const previewEntry = allGiroDocuments.find(({ document }) => document.unitId === effectiveIndividualId);
  const fallbackPreview = allTargets[0];
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
    setSelectedFaxUnitIds([first.unitId]);
    setFaxRecipient(first.faxNumber ?? "");
  }, [faxReadyTargets, type]);

  const allQueries = [...currentTargetQueries, ...(needsDocuments ? currentDocumentQueries : []), ...(type === "giro" ? periodSettingQueries : []), ...(type === "adjustment" ? [...previousTargetQueries, ...previousDocumentQueries] : [])];
  const isPreviewInitialLoading = allQueries.some((query) => query.isLoading);
  const isPreviewRefreshing = allQueries.some(
    (query) => query.isFetching && !query.isLoading,
  );
  const isPreviewBusy = isPreviewInitialLoading || isPreviewRefreshing;
  const isError = allQueries.some((query) => query.isError);
  const hasPrintableData = type === "giro" ? giroDocuments.length > 0 : adjustmentBuildings.some((bundle) => bundle.current.length > 0 || bundle.previous.length > 0);

  const resetPeriodSelection = () => {
    setSelectedUnitIds([]);
    setPreviewUnitId(null);
    setStamps({ reissue: false, waterCutoffUnitIds: [], autoDebit: false });
    setWaterCutoffStamp(false);
    setStampScope("individual");
    setSelectedFaxUnitIds([]);
    setFaxConfirmOpen(false);
    faxSelectionInitialized.current = false;
  };
  const changeYear = (value: number) => { setYear(value); resetPeriodSelection(); };
  const changeMonth = (value: number) => { setMonth(value); resetPeriodSelection(); };
  const toggleBuilding = (buildingId: number) => { setSelectedBuildingIds((selected) => selected.includes(buildingId) ? selected.filter((id) => id !== buildingId) : [...selected, buildingId]); resetPeriodSelection(); };
  const toggleUnit = (unitId: number) => {
    if (type === "fax") {
      setSelectedFaxUnitIds((current) => current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId]);
      const target = faxReadyTargets.find((entry) => entry.target.unitId === unitId)?.target;
      if (target?.faxNumber) setFaxRecipient(target.faxNumber);
      faxSelectionInitialized.current = true;
      return;
    }
    setSelectedUnitIds((current) => {
      if (current.includes(unitId)) {
        const next = current.filter((id) => id !== unitId);
        setPreviewUnitId((preview) => preview === unitId ? next.at(-1) ?? null : preview);
        return next;
      }
      setPreviewUnitId(unitId);
      return [...current, unitId];
    });
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
    const selectedIds = type === "fax" ? selectedFaxUnitIds : validSelectedUnitIds;
    const allSelected = availableIds.every((id) => selectedIds.includes(id));
    if (type === "fax") {
      setSelectedFaxUnitIds(allSelected ? [] : availableIds);
      setFaxRecipient(allSelected ? "" : faxReadyTargets[0]?.target.faxNumber ?? "");
      faxSelectionInitialized.current = true;
    } else {
      setSelectedUnitIds(allSelected ? [] : availableIds);
      setPreviewUnitId(allSelected ? null : availableIds[0] ?? null);
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

  const printPreview = type === "giro" ? <GiroPrintView companyName={companyName} period={period} documents={giroDocuments} accounts={accounts} customerNotice={customerNotice} stamps={{ ...stamps, reissueUnitIds: stamps.reissue ? stampTargetIds : [], autoDebitUnitIds: stamps.autoDebit ? stampTargetIds : [], waterCutoffUnitIds: printWaterCutoffUnitIds }} onReady={handlePreviewReady} /> : type === "adjustment" ? <AdjustmentPrintView companyName={companyName} period={period} buildings={adjustmentBuildings} onReady={handlePreviewReady} /> : null;
  const selectedUnitCount = type === "fax" ? selectedFaxUnitIds.length : selectedUnitIds.length;
  const stampFooterLabel = type === "giro" && stampTargetIds.length > 0
    ? stampScope === "all"
      ? "스탬프 · 전체"
      : `스탬프 · ${previewEntry ? displayUnitNo(previewEntry.target.unitNo) : "-"}`
    : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-3 print:hidden" role="dialog" aria-modal="true" aria-labelledby="output-modal-title">
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
                <div className="w-[340px] shrink-0"><OutputSelectionPane type={type} year={year} month={month} years={YEARS} months={MONTHS} search={search} buildings={visibleBuildings} selectedBuildingIds={selectedBuildingIds} targetsByBuilding={currentTargetsByBuilding} selectedUnitIds={type === "fax" ? selectedFaxUnitIds : validSelectedUnitIds} onYearChange={changeYear} onMonthChange={changeMonth} onSearchChange={setSearch} onToggleBuilding={toggleBuilding} onToggleAllBuildings={toggleAllBuildings} onToggleUnit={toggleUnit} onToggleAllUnits={toggleAllUnits} /></div>
                <div className="relative flex min-w-0 flex-1 flex-col">
                  {type === "giro" && (
                    <GiroStampToolbar
                      stamps={{ reissue: stamps.reissue, waterCutoff: waterCutoffStamp, autoDebit: stamps.autoDebit }}
                      scope={stampScope}
                      disabled={stampTargetIds.length === 0}
                      onToggleStamp={toggleStamp}
                      onScopeChange={setStampScope}
                    />
                  )}
                  {selectedBuildingIds.length === 0 ? (
                    <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#e9edf1] text-center text-[12px] leading-[19px] text-[#8b95a1]">
                      <p><strong className="block font-semibold">출력할 건물을 선택해 주세요</strong><span>선택한 건물의 지로 고지서가 여기에 표시돼요</span></p>
                      <ZoomControls zoom={zoom} onZoom={setZoom} />
                    </div>
                  ) : isError ? (
                    <div role="alert" className="flex flex-1 items-center justify-center bg-[#e9edf1] text-[12px] font-bold text-[#f04452]">확정 부과 자료를 불러오지 못했습니다.</div>
                  ) : isPreviewInitialLoading ? (
                    <div className="flex min-h-[420px] flex-1 items-center justify-center bg-[#e9edf1]"><Spinner label="출력 미리보기 불러오는 중" /></div>
                  ) : type === "giro" && validSelectedUnitIds.length === 0 ? (
                    <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#e9edf1] text-[12px] text-[#8b95a1]">
                      출력할 호수를 선택해 주세요
                      <ZoomControls zoom={zoom} onZoom={setZoom} />
                    </div>
                  ) : (
                    <>
                      <CompactDocumentPreview type={type} companyName={companyName} period={period} building={previewEntry?.building ?? fallbackPreview?.building ?? selectedBuildings[0]} target={previewEntry?.target ?? fallbackPreview?.target} document={previewEntry?.document ?? currentDocumentQueries[0]?.data?.[0]} zoom={zoom} onZoom={setZoom} />
                      {isPreviewRefreshing ? (
                        <div className={`pointer-events-none absolute right-3 rounded-full bg-surface/95 shadow-card ${type === "giro" ? "top-[60px]" : "top-3"}`}>
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
              {(type === "giro" || type === "adjustment") && <ModalActionButton icon="/figma-assets/bill/print.svg" onClick={() => void print()} disabled={!hasPrintableData || isPreviewBusy || !previewReady || issueBills.isPending}>{issueBills.isPending ? "발행 중…" : "인쇄"}</ModalActionButton>}
              {type === "fax" && <ModalActionButton onClick={openFaxConfirmation} disabled={selectedFaxUnitIds.length === 0 || sendFaxes.isPending}>{sendFaxes.isPending ? "발송 중…" : "발송"}</ModalActionButton>}
            </div>
          </footer>
        </div>
      </div>
      {(type === "giro" || type === "adjustment") && hasPrintableData && <div className="hidden print:block" data-testid="document-output-print-root">{printPreview}</div>}
      {type === "autoDebit" && autoDebitRows.length > 0 && (
        <table className="hidden w-full border-collapse text-xs print:table" data-testid="auto-debit-print-root"><thead><tr>{["건물", "호수", "회원명", "청구월", "결제일", "금액", "회원구분"].map((label) => <th key={label} className="border p-2">{label}</th>)}</tr></thead><tbody>{autoDebitRows.map(({ building, target }) => <tr key={`${building.id}-${target.unitId}`}><td className="border p-2">{building.name}</td><td className="border p-2">{target.unitNo}</td><td className="border p-2">{target.payerName || target.tenantName}</td><td className="border p-2">{year}.{String(month).padStart(2, "0")}</td><td className="border p-2">{target.dueDate}</td><td className="border p-2 text-right">{target.totalAmount.toLocaleString("ko-KR")}</td><td className="border p-2">자동이체</td></tr>)}</tbody></table>
      )}
      {faxConfirmOpen && <FaxConfirmationModal building={selectedFaxBuilding} targets={selectedFaxTargetValues} period={period} senderLabel="등록 발신번호 · 본사" recipient={faxRecipient} isPending={sendFaxes.isPending} error={faxError} onCancel={() => setFaxConfirmOpen(false)} onSend={() => void sendFax()} />}
    </>
  );
}

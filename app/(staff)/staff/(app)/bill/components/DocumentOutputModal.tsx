"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, IconButton, Spinner } from "@/components/common";
import { CloseIcon, PrinterIcon } from "@/components/icons";
import { billKeys, getBillDocuments, listBillTargets, useAdjustmentStatements, useIssueBills, useSendBillFaxes, type BillDocument, type BillTarget } from "@/hooks/reactquery/bill";
import { billingKeys, getBillingPeriodSetting, type BillingPeriodSetting } from "@/hooks/reactquery/billing";
import { cmsDownloadUrl } from "@/hooks/reactquery/payments";
import { useStaffSignedBillLinks } from "@/hooks/reactquery/residentBilling";
import { useSenderDefaults } from "@/hooks/reactquery/senderDefaults";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { formatPhone, normalizePhone } from "@/lib/format";
import { resolveDisplaySender } from "@/lib/messaging/senderDisplay";
import { currentPeriod } from "@/lib/billing/period";
import { matchesBuildingGroup } from "@/lib/buildings/groupType";
import { displayUnitNo, publicBillUrl, type BillPrintOptions, type PrintableAccount } from "@/lib/bill/document";
import type { BillBuilding, OutputDocumentType } from "../types";
import type { GiroOutputDocument, GiroPrintViewProps } from "./GiroPrintView";
import { AutoDebitTable, filterAutoDebitRowsByGroup, isBuildingInAutoDebitGroup } from "./output-modal/AutoDebitTable";
import { AdjustmentPreviewViewport, AdjustmentStatementPreview, AdjustmentStatementStyles } from "./output-modal/AdjustmentStatement";
import { AutoDebitPrintDocument } from "./output-modal/AutoDebitPrintDocument";
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
  printOptions: BillPrintOptions;
  onClose: () => void;
}

const TITLES: Record<OutputDocumentType, string> = { giro: "지로 고지서 출력", adjustment: "조정명세서 출력", autoDebit: "자동이체 세대 출력", fax: "팩스 발송" };
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function initialYearMonth() {
  const [year, month] = currentPeriod().split("-").map(Number);
  return { year, month };
}
// 정본 연도 목록 = 올해부터 8개 내림차순.
function outputYears(currentYear: number) {
  return Array.from({ length: 8 }, (_, index) => currentYear - index);
}
function outputPeriod(year: number, month: number) { return `${year}-${String(month).padStart(2, "0")}-01`; }
function mergeGiroDocuments(building: BillBuilding, documents: BillDocument[], targets: BillTarget[], periodSetting: BillingPeriodSetting | undefined): GiroOutputDocument[] {
  const dueDate = periodSetting?.dueDate ?? null;
  const chargeStartDate = periodSetting?.chargeStartDate ?? null;
  const chargeEndDate = periodSetting?.chargeEndDate ?? null;
  return documents.flatMap((document) => {
    const target = targets.find((candidate) => candidate.unitId === document.unitId);
    return target ? [{ building, document, target, dueDate, chargeStartDate, chargeEndDate }] : [];
  });
}

export function DocumentOutputModal({ type, orgId, buildings, companyName, accounts, customerNotice, printOptions, onClose }: DocumentOutputModalProps) {
  const initial = initialYearMonth();
  const [years] = useState(() => outputYears(initial.year));
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [outputDate] = useState(() => formatOutputDate(new Date()));
  const [search, setSearch] = useState("");
  const [buildingGroup, setBuildingGroup] = useState("");
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<number[]>(
    type === "autoDebit" ? buildings.map((building) => building.id) : [],
  );
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [previewUnitId, setPreviewUnitId] = useState<number | null>(null);
  // 정본 `.adj-zoom`: 100% = 용지 폭을 미리보기 폭에 맞춘 배율(지로·조정명세서 모두).
  const [zoom, setZoom] = useState(100);
  const [group, setGroup] = useState(0);
  const [reissueUnitIds, setReissueUnitIds] = useState<number[]>([]);
  const [waterCutoffStampUnitIds, setWaterCutoffStampUnitIds] = useState<number[]>([]);
  const [autoDebitUnitIds, setAutoDebitUnitIds] = useState<number[]>([]);
  const [stampScope, setStampScope] = useState<GiroStampScope>("individual");
  // 정본 syncBar: 대상 없이 스탬프를 누르면 다음 선택 전까지 푸터 안내가 바뀐다.
  const [stampHint, setStampHint] = useState<string | null>(null);
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
  const visibleBuildings = buildings.filter((building) => matchesBuildingGroup(building, buildingGroup) && (!normalizedSearch || `${building.code} ${building.name} ${building.address ?? ""}`.toLocaleLowerCase("ko-KR").includes(normalizedSearch)));

  const currentTargetQueries = useQueries({ queries: selectedBuildings.map((building) => ({ queryKey: billKeys.targets(building.id, period), queryFn: () => listBillTargets(building.id, period) })) });
  const periodSettingQueries = useQueries({ queries: selectedBuildings.map((building) => ({ queryKey: billingKeys.periodSetting(building.id, period), queryFn: () => getBillingPeriodSetting(building.id, period), enabled: type === "giro" || type === "fax" })) });
  const currentTargetsByBuilding = selectedBuildings.map((building, index) => ({ building, targets: currentTargetQueries[index]?.data ?? [] }));
  const currentDocumentQueries = useQueries({ queries: currentTargetsByBuilding.map(({ building, targets }) => ({ queryKey: billKeys.documents(building.id, period, targets.map((target) => target.unitId)), queryFn: () => getBillDocuments(building.id, period, targets.map((target) => target.unitId)), enabled: needsDocuments && targets.length > 0 })) });

  const adjustment = useAdjustmentStatements({ buildings: selectedBuildings, period, orgId, companyName, outputDate, enabled: type === "adjustment" });
  const { data: setupConfig } = useSetupConfig(orgId);
  const senderDefaults = useSenderDefaults();
  const faxSender = resolveDisplaySender(setupConfig, senderDefaults.isError ? null : senderDefaults.data, "fax");
  const faxSenderLabel = faxSender === undefined ? "" : faxSender ? formatPhone(faxSender) : "발신번호 미등록";

  const allGiroDocuments = currentTargetsByBuilding.flatMap(({ building, targets }, index) => mergeGiroDocuments(building, currentDocumentQueries[index]?.data ?? [], targets, periodSettingQueries[index]?.data));
  const validSelectedUnitIds = selectedUnitIds.filter((unitId) => allGiroDocuments.some(({ document }) => document.unitId === unitId));
  const effectiveIndividualId = previewUnitId !== null && validSelectedUnitIds.includes(previewUnitId)
    ? previewUnitId
    : validSelectedUnitIds[0] ?? null;
  const giroDocuments = allGiroDocuments.filter(({ document }) => validSelectedUnitIds.includes(document.unitId));
  // 지로 QR = 세대별 공개 고지서 서명 URL(발급일 기준 30일 유효). 부과 미확정 세대는 링크가 없어 QR을 생략한다.
  const signedLinksQuery = useStaffSignedBillLinks(period, validSelectedUnitIds, type === "giro");
  const giroQrUrls: Record<number, string> = Object.fromEntries((signedLinksQuery.data ?? [])
    .map((link) => [link.unitId, publicBillUrl({ ...link, period })] as const)
    .filter(([, url]) => Boolean(url)));
  const allTargets = currentTargetsByBuilding.flatMap(({ building, targets }) => targets.map((target) => ({ building, target })));
  const autoDebitRows = allTargets.filter(({ target }) => target.autoDebit);
  const autoDebitPrintRows = filterAutoDebitRowsByGroup(autoDebitRows, group);
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
    ...waterCutoffStampUnitIds.filter((unitId) => validSelectedUnitIds.includes(unitId)),
  ])];
  const isStampActiveForTarget = (unitIds: number[]) => stampTargetIds.length > 0 && (stampScope === "all"
    ? stampTargetIds.every((unitId) => unitIds.includes(unitId))
    : unitIds.includes(effectiveIndividualId ?? -1));
  const toolbarStamps: Record<GiroStampKind, boolean> = {
    reissue: isStampActiveForTarget(reissueUnitIds),
    waterCutoff: isStampActiveForTarget(waterCutoffStampUnitIds) || Boolean(stampScope === "individual" && previewEntry?.target.waterCutoff),
    autoDebit: isStampActiveForTarget(autoDebitUnitIds),
  };
  const lockedStampKinds: GiroStampKind[] = stampScope === "individual" && previewEntry?.target.waterCutoff ? ["waterCutoff"] : [];
  const outputStamps = {
    reissueUnitIds: reissueUnitIds.filter((unitId) => validSelectedUnitIds.includes(unitId)),
    waterCutoffUnitIds: printWaterCutoffUnitIds,
    autoDebitUnitIds: autoDebitUnitIds.filter((unitId) => validSelectedUnitIds.includes(unitId)),
  };

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
    setReissueUnitIds([]);
    setWaterCutoffStampUnitIds([]);
    setAutoDebitUnitIds([]);
    setStampScope("individual");
    setStampHint(null);
    setFaxConfirmOpen(false);
    setFaxRecipient("");
    faxSelectionInitialized.current = false;
  };
  const changeYear = (value: number) => { setYear(value); resetPeriodSelection(); };
  const changeMonth = (value: number) => { setMonth(value); resetPeriodSelection(); };
  const changeBuildingGroup = (value: string) => { setBuildingGroup(value); setSelectedBuildingIds([]); resetPeriodSelection(); };
  const toggleBuilding = (buildingId: number) => { setSelectedBuildingIds((selected) => selected.includes(buildingId) ? selected.filter((id) => id !== buildingId) : [...selected, buildingId]); resetPeriodSelection(); };
  const toggleUnit = (unitId: number) => {
    setStampHint(null);
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
    setStampHint(null);
    const selectedIds = selectedUnitIds;
    const allSelected = availableIds.every((id) => selectedIds.includes(id));
    setSelectedUnitIds(allSelected ? [] : availableIds);
    setPreviewUnitId(allSelected ? null : availableIds[0] ?? null);
    if (type === "fax") {
      setFaxRecipient(allSelected ? "" : faxReadyTargets[0]?.target.faxNumber ?? "");
      faxSelectionInitialized.current = true;
    }
  };
  // 정본 `#adjUnits tr.ugrp`: 건물 묶음 머리를 누르면 그 건물 호수를 모두 켜거나 끈다.
  const toggleUnits = (unitIds: number[]) => {
    if (unitIds.length === 0) return;
    setStampHint(null);
    const allSelected = unitIds.every((id) => selectedUnitIds.includes(id));
    const next = allSelected
      ? selectedUnitIds.filter((id) => !unitIds.includes(id))
      : [...new Set([...selectedUnitIds, ...unitIds])];
    setSelectedUnitIds(next);
    setPreviewUnitId((preview) => preview !== null && next.includes(preview) ? preview : next[0] ?? null);
    if (type === "fax") {
      const first = faxReadyTargets.find(({ target }) => next.includes(target.unitId))?.target;
      setFaxRecipient(first?.faxNumber ?? "");
      faxSelectionInitialized.current = true;
    }
  };
  const changeStampScope = (scope: GiroStampScope) => { setStampHint(null); setStampScope(scope); };
  const selectPreviewUnit = (unitId: number) => { setStampHint(null); setPreviewUnitId(unitId); };
  const toggleStamp = (kind: GiroStampKind) => {
    if (stampTargetIds.length === 0) {
      if (stampScope === "individual") setStampHint("고지서를 먼저 클릭하세요");
      return;
    }
    const toggleTargetIds = (current: number[]) => {
      if (stampScope === "individual") {
        const [unitId] = stampTargetIds;
        if (unitId === undefined) return current;
        return current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId];
      }
      const allTargetIdsStamped = stampTargetIds.every((unitId) => current.includes(unitId));
      return allTargetIdsStamped
        ? current.filter((unitId) => !stampTargetIds.includes(unitId))
        : [...new Set([...current, ...stampTargetIds])];
    };
    if (kind === "reissue") {
      setReissueUnitIds(toggleTargetIds);
    } else if (kind === "autoDebit") {
      setAutoDebitUnitIds(toggleTargetIds);
    } else {
      setWaterCutoffStampUnitIds(toggleTargetIds);
    }
  };

  const print = async () => {
    if (!hasPrintableData) {
      if (type === "giro") toast.info("출력할 호수를 선택해 주세요");
      return;
    }
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
  const printAutoDebit = () => {
    if (autoDebitPrintRows.length === 0) {
      toast.info("인쇄할 세대가 없어요.");
      return;
    }
    window.print();
  };
  const downloadAutoDebit = () => {
    // 정본 cmsDownload: 고른 부과 그룹의 건물만 내려받는다.
    const groupBuildings = selectedBuildings.filter((building) => isBuildingInAutoDebitGroup(building, group));
    if (groupBuildings.length === 0) {
      toast.info("내려받을 세대가 없어요");
      return;
    }
    // 선택 건물을 한 파일로 합쳐 받는다(건물별 개별 다운로드 X).
    const anchor = document.createElement("a");
    anchor.href = cmsDownloadUrl(groupBuildings.map((building) => building.id), period);
    anchor.download = "";
    anchor.click();
  };
  const openFaxConfirmation = () => {
    if (selectedFaxTargets.length === 0) { toast.info("발송할 호수를 선택해 주세요"); return; }
    setFaxRecipient(selectedFaxTargets[0]?.target.faxNumber ?? "");
    setFaxError(false);
    setFaxConfirmOpen(true);
  };
  const sendFax = async () => {
    if (selectedFaxTargets.length === 0) { toast.info("팩스번호가 등록된 세대를 선택해 주세요."); return; }
    setFaxError(false);
    // 자동 입력값(첫 선택 세대 번호)을 그대로 두면 세대별 등록 번호로, 고쳤으면 선택 세대 전부 고친 번호로 보낸다.
    const defaultRecipient = selectedFaxTargets[0]?.target.faxNumber ?? "";
    const recipientOverride = normalizePhone(faxRecipient) !== normalizePhone(defaultRecipient) ? faxRecipient : undefined;
    let hasError = false;
    let totalQueued = 0;
    let totalFailed = 0;
    for (const building of selectedBuildings) {
      const unitIds = selectedFaxTargets.filter((entry) => entry.building.id === building.id).map((entry) => entry.target.unitId);
      if (unitIds.length === 0) continue;
      try {
        const result = await sendFaxes.mutateAsync({ buildingId: building.id, period, unitIds, recipientOverride });
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

  const printPreview = type === "giro" ? <GiroPrintView companyName={companyName} period={period} documents={giroDocuments} accounts={accounts} customerNotice={customerNotice} printOptions={printOptions} stamps={outputStamps} qrUrls={giroQrUrls} onReady={handlePreviewReady} /> : null;
  const selectedUnitCount = selectedUnitIds.length;
  const hasStampBar = type === "giro" || type === "fax";
  // 정본 `#giroFoc`: 스탬프를 찍을 고지서(개별) 또는 전체 건수.
  const stampFooterLabel = hasStampBar
    ? stampHint ?? (stampScope === "all"
      ? `스탬프 · 전체 ${validSelectedUnitIds.length}건`
      : previewEntry ? `스탬프 · ${displayUnitNo(previewEntry.target.unitNo)}` : "스탬프 대상 미선택")
    : null;
  // 정본 `.lg-print`는 건물만 고르면 켜진다(`pb.disabled=!sel.size`). 호수가 없으면 누를 때 안내한다.
  const printDisabled = type === "giro"
    ? selectedBuildingIds.length === 0 || isPreviewBusy || isError || issueBills.isPending || (hasPrintableData && !previewReady) || signedLinksQuery.isLoading
    : !hasPrintableData || isPreviewBusy;
  // 정본 빈 상태 문구(`adjPreview`): 13px/500 t3, 줄 간격 1.6.
  const previewMessage = "relative flex min-h-0 flex-1 items-center justify-center text-center text-[13px] font-medium leading-[1.6]";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6 print:hidden" role="dialog" aria-modal="true" aria-labelledby="output-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="flex h-[min(660px,92%)] w-[min(1020px,96%)] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_30px_70px_-20px_rgba(0,0,0,0.4)]">
          <header className="flex flex-none items-center gap-2.5 border-b border-line px-5 py-[17px]">
            <h2 id="output-modal-title" className="text-[16px] font-extrabold leading-[normal] tracking-[-0.02em] text-t1">{TITLES[type]}</h2>
            <span className="flex-1" />
            <IconButton
              aria-label="출력 모달 닫기"
              title="닫기"
              onClick={onClose}
              className="size-[26px] rounded-[8px] border border-line bg-white text-t2 transition-[border-color,background-color] duration-[120ms] hover:border-[#C9D0D8] hover:bg-[#F7F9FA]"
            >
              <CloseIcon className="size-3.5 flex-none" />
            </IconButton>
          </header>
          <div className="flex min-h-0 flex-1">
            {type === "autoDebit" ? (
              <AutoDebitTable year={year} month={month} years={years} months={MONTHS} group={group} rows={autoDebitRows} onYearChange={changeYear} onMonthChange={changeMonth} onGroupChange={setGroup} />
            ) : (
              <>
                <div className="w-[340px] shrink-0"><OutputSelectionPane type={type} year={year} month={month} years={years} months={MONTHS} group={buildingGroup} search={search} buildings={visibleBuildings} selectedBuildingIds={selectedBuildingIds} targetsByBuilding={currentTargetsByBuilding} selectedUnitIds={validSelectedUnitIds} onYearChange={changeYear} onMonthChange={changeMonth} onGroupChange={changeBuildingGroup} onSearchChange={setSearch} onToggleBuilding={toggleBuilding} onToggleAllBuildings={toggleAllBuildings} onToggleUnit={toggleUnit} onToggleUnits={toggleUnits} onToggleAllUnits={toggleAllUnits} /></div>
                <div className="relative flex min-w-0 flex-1 flex-col bg-[#e8ebee]">
                  {hasStampBar && (
                    <GiroStampToolbar
                      stamps={toolbarStamps}
                      scope={stampScope}
                      lockedKinds={lockedStampKinds}
                      onToggleStamp={toggleStamp}
                      onScopeChange={changeStampScope}
                    />
                  )}
                  {/* 정본 `.giro-bar`(51px)는 미리보기 위에 떠 있고, 미리보기는 그 아래 52px부터 시작한다. */}
                  <div className={`relative flex min-h-0 flex-1 flex-col ${hasStampBar ? "mt-px" : ""}`}>
                    {selectedBuildingIds.length === 0 ? (
                      <div className={`${previewMessage} text-t3`}>
                        <p>출력할 건물을 선택해 주세요<br />선택한 건물의 {type === "adjustment" ? "조정명세서" : "지로 고지서"}가 여기에 표시돼요</p>
                        <ZoomControls zoom={zoom} onZoom={setZoom} />
                      </div>
                    ) : isError ? (
                      <div role="alert" className={`${previewMessage} text-red`}>확정 부과 자료를 불러오지 못했습니다.</div>
                    ) : isPreviewInitialLoading ? (
                      <div className="flex min-h-0 flex-1 items-center justify-center"><Spinner label="출력 미리보기 불러오는 중" /></div>
                    ) : hasStampBar && validSelectedUnitIds.length === 0 ? (
                      <div className={`${previewMessage} text-t3`}>
                        출력할 호수를 선택해 주세요
                        <ZoomControls zoom={zoom} onZoom={setZoom} />
                      </div>
                    ) : type === "adjustment" ? (
                      adjustment.hasData ? (
                        <AdjustmentPreviewViewport pages={adjustment.pages} zoom={zoom} onZoom={setZoom} refreshing={isPreviewRefreshing} />
                      ) : (
                        <div className={`${previewMessage} text-t3`}>
                          표시할 조정 명세 자료가 없습니다.
                          <ZoomControls zoom={zoom} onZoom={setZoom} />
                        </div>
                      )
                    ) : (
                      <>
                        <CompactDocumentPreview companyName={companyName} period={period} pages={giroDocuments} accounts={accounts} customerNotice={customerNotice} printOptions={printOptions} stamps={outputStamps} highlightedUnitIds={stampTargetIds} onSelectUnit={selectPreviewUnit} zoom={zoom} onZoom={setZoom} />
                        {isPreviewRefreshing ? (
                          <div className="pointer-events-none absolute right-3 top-2 rounded-full bg-surface/95 shadow-card">
                            <Spinner label="출력 미리보기 갱신 중" size="small" showLabel className="px-3 py-2" />
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <footer className="flex flex-none items-center gap-[9px] border-t border-line px-5 py-3.5 leading-[normal]">
            {type !== "autoDebit" && <span className="text-[12.5px] font-bold text-t3">{type === "adjustment" ? `${selectedBuildingIds.length}곳 선택` : `건물 ${selectedBuildingIds.length}개 / 호수 ${selectedUnitCount}개 선택`}</span>}
            {stampFooterLabel && <span className="ml-[9px] whitespace-nowrap border-l border-line pl-[9px] text-[12px] font-bold text-blue-d">{stampFooterLabel}</span>}
            <span className="flex-1" />
            {type === "autoDebit" && <><ModalActionButton variant="ghost" icon="/figma-assets/bill/download.svg" className="hover:!border-[#8B95A1] hover:!bg-white hover:!text-[#191F28]" onClick={downloadAutoDebit} disabled={selectedBuildings.length === 0}>다운로드</ModalActionButton><Button type="button" size="wide" className="shadow-none" onClick={printAutoDebit} disabled={isPreviewInitialLoading}><PrinterIcon className="size-4 flex-none" />인쇄</Button></>}
            {(type === "giro" || type === "adjustment") && <Button type="button" size="wide" className="shadow-none" onClick={() => void print()} disabled={printDisabled}><PrinterIcon className="size-4 flex-none" />{type === "giro" && issueBills.isPending ? "발행 중…" : "인쇄"}</Button>}
            {/* 정본 팩스 발송 버튼도 `.lg-print`(인쇄 아이콘)다. */}
            {type === "fax" && <Button type="button" size="wide" className="shadow-none" onClick={openFaxConfirmation} disabled={selectedBuildingIds.length === 0 || sendFaxes.isPending}><PrinterIcon className="size-4 flex-none" />{sendFaxes.isPending ? "발송 중…" : "발송"}</Button>}
          </footer>
        </div>
      </div>
      {type === "adjustment" && <AdjustmentStatementStyles />}
      {type === "giro" && hasPrintableData && <div className="hidden print:block" data-testid="document-output-print-root">{printPreview}</div>}
      {type === "adjustment" && adjustment.hasData && <div className="hidden print:block" data-testid="document-output-print-root"><AdjustmentStatementPreview pages={adjustment.pages} mode="print" /></div>}
      {type === "autoDebit" && <AutoDebitPrintDocument year={year} month={month} group={group} rows={autoDebitRows} />}
      {faxConfirmOpen && <FaxConfirmationModal building={selectedFaxBuilding} targets={selectedFaxTargetValues} period={period} senderLabel={faxSenderLabel} recipient={faxRecipient} onRecipientChange={(value) => { setFaxError(false); setFaxRecipient(value); }} isPending={sendFaxes.isPending} error={faxError} onCancel={() => setFaxConfirmOpen(false)} onSend={() => void sendFax()} />}
    </>
  );
}

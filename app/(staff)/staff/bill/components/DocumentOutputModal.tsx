"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Checkbox, SearchBar, Select, Spinner } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  billKeys,
  getBillDocuments,
  listBillTargets,
  useIssueBills,
  useSendBillFaxes,
  type BillDocument,
  type BillTarget,
} from "@/hooks/reactquery/bill";
import {
  billingKeys,
  getBillingPeriodSetting,
} from "@/hooks/reactquery/billing";
import { cmsDownloadUrl } from "@/hooks/reactquery/payments";
import { currentPeriod, prevPeriod } from "@/lib/billing/period";
import type { PrintableAccount } from "@/lib/bill/document";
import { AdjustmentPrintView, type AdjustmentBuildingDocuments } from "./AdjustmentPrintView";
import { GiroPrintView, type GiroOutputDocument, type GiroStampOptions } from "./GiroPrintView";
import type { OutputDocumentType } from "./DocumentCards";

interface DocumentOutputModalProps {
  type: OutputDocumentType;
  buildings: Building[];
  companyName: string;
  accounts: PrintableAccount[];
  customerNotice: string | null;
  onClose: () => void;
}

const TITLES: Record<OutputDocumentType, string> = {
  giro: "지로 고지서 출력",
  adjustment: "조정명세서 출력",
  autoDebit: "자동이체 세대 출력",
  fax: "팩스 발송",
};

const YEARS = Array.from({ length: 8 }, (_, index) => 2019 + index);
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function initialYearMonth() {
  const [rawYear, rawMonth] = currentPeriod().split("-").map(Number);
  return { year: Math.min(2026, Math.max(2019, rawYear)), month: rawMonth };
}

function outputPeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function sendStatusLabel(target: BillTarget) {
  if (target.faxSendStatus === "scheduled") return "예약";
  if (target.faxSendStatus === "queued") return "결과 확인 중";
  if (target.faxSendStatus === "sent") return "발송 완료";
  if (target.faxSendStatus === "partial") return "일부 성공";
  if (target.faxSendStatus === "failed") return "발송 실패";
  return "미발송";
}

function mergeGiroDocuments(
  building: Building,
  documents: BillDocument[],
  targets: BillTarget[],
  dueDate: string | null,
): GiroOutputDocument[] {
  return documents.flatMap((document) => {
    const target = targets.find((candidate) => candidate.unitId === document.unitId);
    return target ? [{ building, document, target, dueDate }] : [];
  });
}

export function DocumentOutputModal({
  type,
  buildings,
  companyName,
  accounts,
  customerNotice,
  onClose,
}: DocumentOutputModalProps) {
  const initial = initialYearMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [search, setSearch] = useState("");
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<number[]>(
    buildings[0] ? [buildings[0].id] : [],
  );
  const [scope, setScope] = useState<"individual" | "all">("all");
  const [individualUnitId, setIndividualUnitId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(80);
  const [stamps, setStamps] = useState<GiroStampOptions>({
    reissue: false,
    waterCutoffUnitIds: [],
    autoDebit: true,
  });
  const [waterCutoffOverrides, setWaterCutoffOverrides] = useState<Record<number, boolean>>({});
  const [selectedFaxUnitIds, setSelectedFaxUnitIds] = useState<number[]>([]);
  const [faxError, setFaxError] = useState(false);
  const issueBills = useIssueBills();
  const sendFaxes = useSendBillFaxes();

  const period = outputPeriod(year, month);
  const previousPeriod = prevPeriod(period);
  const needsCurrentBilling = type === "giro" || type === "adjustment" || type === "fax";
  const needsDocuments = type === "giro" || type === "adjustment";
  const selectedBuildings = useMemo(
    () => buildings.filter((building) => selectedBuildingIds.includes(building.id)),
    [buildings, selectedBuildingIds],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase("ko-KR");
  const visibleBuildings = buildings.filter((building) =>
    !normalizedSearch
    || `${building.code} ${building.name} ${building.address ?? ""}`
      .toLocaleLowerCase("ko-KR")
      .includes(normalizedSearch),
  );

  const currentTargetQueries = useQueries({
    queries: selectedBuildings.map((building) => ({
      queryKey: billKeys.targets(building.id, period),
      queryFn: () => listBillTargets(building.id, period),
      enabled: needsCurrentBilling,
    })),
  });
  const previousTargetQueries = useQueries({
    queries: selectedBuildings.map((building) => ({
      queryKey: billKeys.targets(building.id, previousPeriod),
      queryFn: () => listBillTargets(building.id, previousPeriod),
      enabled: type === "adjustment",
    })),
  });
  const periodSettingQueries = useQueries({
    queries: selectedBuildings.map((building) => ({
      queryKey: billingKeys.periodSetting(building.id, period),
      queryFn: () => getBillingPeriodSetting(building.id, period),
      enabled: type === "giro",
    })),
  });

  const currentTargetsByBuilding = selectedBuildings.map((building, index) => ({
    building,
    targets: currentTargetQueries[index]?.data ?? [],
  }));
  const previousTargetsByBuilding = selectedBuildings.map((building, index) => ({
    building,
    targets: previousTargetQueries[index]?.data ?? [],
  }));

  const currentDocumentQueries = useQueries({
    queries: currentTargetsByBuilding.map(({ building, targets }) => ({
      queryKey: billKeys.documents(building.id, period, targets.map((target) => target.unitId)),
      queryFn: () => getBillDocuments(building.id, period, targets.map((target) => target.unitId)),
      enabled: needsDocuments && targets.length > 0,
    })),
  });
  const previousDocumentQueries = useQueries({
    queries: previousTargetsByBuilding.map(({ building, targets }) => ({
      queryKey: billKeys.documents(building.id, previousPeriod, targets.map((target) => target.unitId)),
      queryFn: () => getBillDocuments(building.id, previousPeriod, targets.map((target) => target.unitId)),
      enabled: type === "adjustment" && targets.length > 0,
    })),
  });

  const allGiroDocuments = currentTargetsByBuilding.flatMap(({ building, targets }, index) =>
    mergeGiroDocuments(
      building,
      currentDocumentQueries[index]?.data ?? [],
      targets,
      periodSettingQueries[index]?.data?.dueDate ?? null,
    ),
  );
  const effectiveIndividualId = individualUnitId !== null
    && allGiroDocuments.some(({ document }) => document.unitId === individualUnitId)
    ? individualUnitId
    : allGiroDocuments[0]?.document.unitId ?? null;
  const giroDocuments = scope === "all"
    ? allGiroDocuments
    : allGiroDocuments.filter(({ document }) => document.unitId === effectiveIndividualId);
  const adjustmentBuildings: AdjustmentBuildingDocuments[] = currentTargetsByBuilding.map(
    ({ building, targets }, index) => ({
      building,
      targets,
      current: currentDocumentQueries[index]?.data ?? [],
      previous: previousDocumentQueries[index]?.data ?? [],
    }),
  );
  const allFaxTargets = currentTargetsByBuilding.flatMap(({ building, targets }) =>
    targets.map((target) => ({ building, target })),
  );
  const faxReadyTargets = allFaxTargets.filter(({ target }) => Boolean(target.faxNumber));
  const allFaxReadySelected = faxReadyTargets.length > 0
    && faxReadyTargets.every(({ target }) => selectedFaxUnitIds.includes(target.unitId));
  const waterCutoffUnitIds = allGiroDocuments
    .filter(({ target }) => waterCutoffOverrides[target.unitId] ?? target.waterCutoff)
    .map(({ document }) => document.unitId);

  const allQueries = [
    ...currentTargetQueries,
    ...(needsDocuments ? currentDocumentQueries : []),
    ...(type === "giro" ? periodSettingQueries : []),
    ...(type === "adjustment" ? [...previousTargetQueries, ...previousDocumentQueries] : []),
  ];
  const isLoading = needsCurrentBilling && allQueries.some((query) => query.isLoading || query.isFetching);
  const isError = needsCurrentBilling && allQueries.some((query) => query.isError);
  const hasPrintableData = type === "giro"
    ? giroDocuments.length > 0
    : adjustmentBuildings.some((bundle) => bundle.current.length > 0 || bundle.previous.length > 0);

  const toggleBuilding = (buildingId: number) => {
    setSelectedBuildingIds((selected) =>
      selected.includes(buildingId)
        ? selected.filter((id) => id !== buildingId)
        : [...selected, buildingId],
    );
    setIndividualUnitId(null);
    setSelectedFaxUnitIds([]);
  };

  const print = async () => {
    if (!hasPrintableData) return;
    if (type === "giro") {
      try {
        for (const [buildingIndex, building] of selectedBuildings.entries()) {
          const unitIds = giroDocuments
            .filter((entry) => entry.building.id === building.id)
            .map((entry) => entry.document.unitId);
          if (unitIds.length > 0) {
            await issueBills.mutateAsync({
              buildingId: building.id,
              period,
              unitIds,
              issueType: "giro",
              dueDate: periodSettingQueries[buildingIndex]?.data?.dueDate ?? null,
              // issue_bills records one legacy batch-wide mode; the rendered giro
              // uses each target's billNameDisplay independently.
              unitLabelMode: "name",
              waterCutoffUnitIds: waterCutoffUnitIds.filter((unitId) => unitIds.includes(unitId)),
            });
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "지로 고지서 발행에 실패했습니다.");
        return;
      }
    }
    window.print();
  };

  const sendFax = async () => {
    const selectedTargets = allFaxTargets.filter(({ target }) =>
      selectedFaxUnitIds.includes(target.unitId) && Boolean(target.faxNumber),
    );
    if (selectedTargets.length === 0) {
      toast.info("팩스번호가 등록된 세대를 선택해 주세요.");
      return;
    }
    setFaxError(false);
    let hasError = false;
    let totalQueued = 0;
    let totalFailed = 0;
    for (const building of selectedBuildings) {
      const unitIds = selectedTargets
        .filter((entry) => entry.building.id === building.id)
        .map((entry) => entry.target.unitId);
      if (unitIds.length === 0) continue;
      try {
        const result = await sendFaxes.mutateAsync({ buildingId: building.id, period, unitIds });
        totalQueued += result.queued;
        totalFailed += result.failed;
      } catch {
        // 접수 자체가 실패(설정 누락·네트워크 등). 상태 확정은 서버가 관리하므로 가짜 기록은 남기지 않는다.
        hasError = true;
      }
    }
    if (hasError || totalFailed > 0) {
      setFaxError(true);
      toast.error(
        totalQueued > 0
          ? `일부만 접수되었습니다 · 접수 ${totalQueued} · 실패 ${totalFailed}`
          : "발송에 실패했습니다. 실패 세대를 다시 선택해 재발송해 주세요.",
      );
    } else {
      // 접수 완료(결과 확인 중). 전송 완료로 표시하지 않는다.
      toast.success("발송을 접수했습니다. 결과 확인 중입니다.");
    }
  };

  const preview = type === "giro" ? (
    <GiroPrintView
      companyName={companyName}
      period={period}
      documents={giroDocuments}
      accounts={accounts}
      customerNotice={customerNotice}
      stamps={{ ...stamps, waterCutoffUnitIds }}
    />
  ) : type === "adjustment" ? (
    <AdjustmentPrintView companyName={companyName} period={period} buildings={adjustmentBuildings} />
  ) : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 print:hidden" role="dialog" aria-modal="true" aria-labelledby="output-modal-title">
        <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-surface shadow-pop">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p className="text-xs font-bold text-brand">서류 발행·출력</p>
              <h2 id="output-modal-title" className="mt-0.5 text-xl font-extrabold text-t1">{TITLES[type]}</h2>
            </div>
            <button type="button" aria-label="출력 모달 닫기" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-t3 hover:bg-bg">×</button>
          </header>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="overflow-y-auto border-r border-line bg-bg/70 p-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-xs font-bold text-t2">
                  출력 연도
                  <Select aria-label="출력 연도" value={String(year)} onChange={(event) => {
                    setYear(Number(event.target.value));
                    setSelectedFaxUnitIds([]);
                    setWaterCutoffOverrides({});
                  }} options={YEARS.map((value) => ({ value: String(value), label: `${value}년` }))} />
                </label>
                <label className="space-y-1.5 text-xs font-bold text-t2">
                  월분
                  <Select aria-label="월분" value={String(month)} onChange={(event) => {
                    setMonth(Number(event.target.value));
                    setSelectedFaxUnitIds([]);
                    setWaterCutoffOverrides({});
                  }} options={MONTHS.map((value) => ({ value: String(value), label: `${value}월` }))} />
                </label>
              </div>

              <div className="mt-5">
                <label className="text-xs font-bold text-t2" htmlFor="building-search">건물 검색</label>
                <div className="mt-1.5" id="building-search">
                  <SearchBar value={search} onChange={setSearch} placeholder="코드·건물명·주소 검색" />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <strong className="text-xs text-t2">건물 다중 선택</strong>
                <button type="button" className="text-xs font-bold text-brand" onClick={() => {
                  const visibleIds = visibleBuildings.map((building) => building.id);
                  const allVisibleSelected = visibleIds.every((id) => selectedBuildingIds.includes(id));
                  setSelectedBuildingIds(allVisibleSelected
                    ? selectedBuildingIds.filter((id) => !visibleIds.includes(id))
                    : [...new Set([...selectedBuildingIds, ...visibleIds])]);
                  setIndividualUnitId(null);
                  setSelectedFaxUnitIds([]);
                }}>
                  {visibleBuildings.every((building) => selectedBuildingIds.includes(building.id)) ? "검색 결과 해제" : "검색 결과 전체"}
                </button>
              </div>
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-line bg-surface p-2">
                {visibleBuildings.length === 0 ? <p className="p-3 text-center text-xs text-t3">검색 결과가 없습니다.</p> : visibleBuildings.map((building) => (
                  <Checkbox
                    key={building.id}
                    label={`${building.code} · ${building.name}${building.address ? ` · ${building.address}` : ""}`}
                    checked={selectedBuildingIds.includes(building.id)}
                    onChange={() => toggleBuilding(building.id)}
                    className="rounded-lg p-2 hover:bg-bg"
                  />
                ))}
              </div>

              {type === "giro" && (
                <div className="mt-5 space-y-4 border-t border-line pt-5">
                  <div>
                    <p className="text-xs font-bold text-t2">미리보기 스코프</p>
                    <div className="mt-2 grid grid-cols-2 rounded-xl bg-surface p-1 ring-1 ring-line">
                      {(["individual", "all"] as const).map((value) => (
                        <button key={value} type="button" onClick={() => setScope(value)} className={`h-9 rounded-lg text-xs font-bold ${scope === value ? "bg-brand text-white" : "text-t2"}`}>
                          {value === "individual" ? "개별" : "전체"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {scope === "individual" && (
                    <label className="block space-y-1.5 text-xs font-bold text-t2">
                      건물 → 세대(호수)
                      <select
                        aria-label="건물별 세대 선택"
                        value={effectiveIndividualId ?? ""}
                        onChange={(event) => setIndividualUnitId(event.target.value ? Number(event.target.value) : null)}
                        className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-t1 focus:border-brand focus:outline-none"
                      >
                        {selectedBuildings.map((building) => (
                          <optgroup key={building.id} label={building.name}>
                            {allGiroDocuments.filter((entry) => entry.building.id === building.id).map(({ document, target }) => (
                              <option key={document.unitId} value={document.unitId}>
                                {document.unitNo}호 · {target.payerName || target.tenantName || "이름 없음"} · {target.phone || "번호 없음"} · {target.autoDebit ? "자동이체" : "일반"}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                  )}
                  <div>
                    <p className="text-xs font-bold text-t2">스탬프 표시</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <Checkbox label="재발행" checked={stamps.reissue} onChange={(event) => setStamps((value) => ({ ...value, reissue: event.target.checked }))} />
                      <Checkbox label="자동이체" checked={stamps.autoDebit} onChange={(event) => setStamps((value) => ({ ...value, autoDebit: event.target.checked }))} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-t2">세대별 단수 표기</p>
                    <p className="mt-1 text-[11px] leading-4 text-t3">입주자 정보의 단수 출력 여부를 기본값으로 사용하며, 변경은 이번 회차에만 적용됩니다.</p>
                    <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-line bg-surface p-2">
                      {allGiroDocuments.map(({ building, document, target }) => {
                        const checked = waterCutoffOverrides[target.unitId] ?? target.waterCutoff;
                        return (
                          <Checkbox
                            key={`${building.id}-${document.unitId}`}
                            label={`${building.name} · ${document.unitNo}호`}
                            checked={checked}
                            onChange={(event) => setWaterCutoffOverrides((current) => ({
                              ...current,
                              [target.unitId]: event.target.checked,
                            }))}
                            className="rounded-lg p-2 hover:bg-bg"
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </aside>

            <main className="flex min-h-0 flex-col bg-slate-200/70">
              {(type === "giro" || type === "adjustment") && (
                <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2">
                  <span className="text-xs font-bold text-t3">미리보기 {zoom}%</span>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="미리보기 축소" onClick={() => setZoom((value) => Math.max(50, value - 10))} className="h-8 rounded-lg border border-line px-3 font-bold">−</button>
                    <button type="button" onClick={() => setZoom(80)} className="h-8 rounded-lg border border-line px-3 text-xs font-bold">맞춤</button>
                    <button type="button" aria-label="미리보기 확대" onClick={() => setZoom((value) => Math.min(140, value + 10))} className="h-8 rounded-lg border border-line px-3 font-bold">＋</button>
                  </div>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-auto p-5">
                {selectedBuildingIds.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-t3">출력할 건물을 선택해 주세요.</div>
                ) : isError ? (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-red">확정 부과 자료를 불러오지 못했습니다.</div>
                ) : isLoading ? (
                  <div className="flex h-full items-center justify-center"><Spinner /></div>
                ) : (type === "giro" || type === "adjustment") ? (
                  hasPrintableData ? (
                    <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}>{preview}</div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-t3">선택한 월에 확정된 부과 자료가 없습니다.</div>
                  )
                ) : type === "autoDebit" ? (
                  <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-6 shadow-card">
                    <h3 className="text-lg font-extrabold text-t1">기존 CMS 자동이체 엑셀</h3>
                    <p className="mt-2 text-sm leading-6 text-t2">수납 처리에서 사용 중인 CMS 다운로드를 그대로 연결합니다. 건물별 파일을 내려받아 주세요.</p>
                    <div className="mt-5 space-y-2">
                      {selectedBuildings.map((building) => (
                        <a key={building.id} href={cmsDownloadUrl(building.id, period)} download className="flex h-11 items-center justify-between rounded-xl border border-line px-4 text-sm font-bold text-t1 hover:border-brand hover:text-brand">
                          <span>{building.name}</span><span>엑셀 내려받기 ↓</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-6 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-extrabold text-t1">세대별 팩스 발송</h3>
                        <p className="mt-1 text-sm text-t2">입주자 정보에 등록된 팩스번호로 선택 세대를 일괄 발송합니다.</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={faxReadyTargets.length === 0}
                        onClick={() => setSelectedFaxUnitIds(allFaxReadySelected
                          ? []
                          : faxReadyTargets.map(({ target }) => target.unitId))}
                      >
                        {allFaxReadySelected ? "전체 해제" : "팩스 등록 세대 전체 선택"}
                      </Button>
                    </div>
                    {faxError && (
                      <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
                        <span>발송에 실패했습니다. 다시 시도해 주세요.</span>
                        <Button type="button" variant="ghost" onClick={() => void sendFax()}>재시도</Button>
                      </div>
                    )}
                    {allFaxTargets.length === 0 ? (
                      <p className="mt-6 rounded-xl bg-bg p-6 text-center text-sm text-t3">선택한 월에 확정된 부과 자료가 없습니다.</p>
                    ) : (
                      <div className="mt-5 max-h-[52vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
                        {allFaxTargets.map(({ building, target }) => (
                          <div key={`${building.id}-${target.unitId}`} className="grid grid-cols-[minmax(0,1fr)_140px_90px] items-center gap-3 p-3 text-sm">
                            <Checkbox
                              label={`${building.name} · ${target.unitNo}호 · ${target.tenantName ?? "입주자 미등록"}`}
                              checked={selectedFaxUnitIds.includes(target.unitId)}
                              disabled={!target.faxNumber}
                              onChange={() => setSelectedFaxUnitIds((current) => current.includes(target.unitId)
                                ? current.filter((unitId) => unitId !== target.unitId)
                                : [...current, target.unitId])}
                            />
                            <span className={target.faxNumber ? "text-t1" : "font-bold text-danger"}>{target.faxNumber ?? "팩스번호 미등록"}</span>
                            <span className="text-center text-xs font-bold text-t2">{sendStatusLabel(target)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>
          </div>

          <footer className="flex items-center justify-between border-t border-line px-5 py-3">
            <p className="text-xs text-t3">선택 {selectedBuildingIds.length}개 건물 · {year}년 {month}월분</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
              {(type === "giro" || type === "adjustment") && (
                <Button type="button" onClick={() => void print()} disabled={!hasPrintableData || isLoading || issueBills.isPending}>
                  {issueBills.isPending ? "발행 중…" : "인쇄"}
                </Button>
              )}
              {type === "fax" && (
                <Button type="button" onClick={() => void sendFax()} disabled={selectedFaxUnitIds.length === 0 || sendFaxes.isPending}>
                  {sendFaxes.isPending ? "팩스 발송 중…" : `선택 ${selectedFaxUnitIds.length}세대 팩스 발송`}
                </Button>
              )}
            </div>
          </footer>
        </div>
      </div>

      {(type === "giro" || type === "adjustment") && hasPrintableData && (
        <div className="hidden print:block" data-testid="document-output-print-root">
          {preview}
        </div>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Spinner } from "@/components/common";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import { useCustomerNumbers } from "@/hooks/reactquery/buildingCustomerNumbers";
import {
  useBilling,
  useBillingPeriodSetting,
  useChargeNewOccupancies,
  useConfirmBilling,
  useCopyPreviousBilling,
  useSaveBillingCharges,
  useUnchargedNewOccupancies,
} from "@/hooks/reactquery/billing";
import { useSaveBuildingNotes } from "@/hooks/reactquery/receipts";
import { useUtilityConfirmation, useUtilityRows } from "@/hooks/reactquery/utilities";
import { currentPeriod, isFuturePeriod, prevPeriod } from "@/lib/billing/period";
import { pivotBillingRows } from "@/lib/billing/pivot";
import { formatWon } from "@/lib/format";
import { BillingHistoryModal } from "./components/BillingHistoryModal";
import { BillingPeriodSettingsBar } from "./components/BillingPeriodSettingsBar";
import { BillingSectionToolbar } from "./components/BillingSectionToolbar";
import { BillingTable, type BillingChargeDraft, type BillingNoteDraft } from "./components/BillingTable";
import { BuildingDirectoryRail } from "./components/BuildingDirectoryRail";
import { ManagementFeeDialog, type ManagementFeeDialogKind } from "./components/ManagementFeeDialog";
import { NewTenantChargeModal } from "./components/NewTenantChargeModal";
import { UtilitySummaryPanel } from "./components/UtilitySummaryPanel";

const periodFrom = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`;

export function ManagementFeeWorkspace() {
  const buildingsQuery = useBuildings();
  const { data: buildingTypes = [] } = useBuildingTypes();
  const buildings = buildingsQuery.data ?? [];

  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState(() => currentPeriod());
  const [editing, setEditing] = useState(false);
  const [buildingNoteDraft, setBuildingNoteDraft] = useState("");
  const [chargeDrafts, setChargeDrafts] = useState<Record<number, Record<number, BillingChargeDraft>>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, BillingNoteDraft>>({});
  const [historyUnit, setHistoryUnit] = useState<{ id: number; no: string } | null>(null);
  const [dialog, setDialog] = useState<ManagementFeeDialogKind | null>(null);
  const [carriedBuildingCount, setCarriedBuildingCount] = useState(0);
  // 공과금 계산 때 부과액이 빠진 공과금(수도·전기·가스) 이름 — 안내 모달 문구에 쓴다.
  const [missingUtilityLabels, setMissingUtilityLabels] = useState<string[]>([]);

  const billingQuery = useBilling(buildingId, period);
  const saveCharges = useSaveBillingCharges();
  const confirmBilling = useConfirmBilling();
  const copyPrevious = useCopyPreviousBilling();
  const saveBuildingNotes = useSaveBuildingNotes();
  const newOccupanciesQuery = useUnchargedNewOccupancies(buildingId, period);
  const chargeNewOccupancies = useChargeNewOccupancies();
  const waterRows = useUtilityRows(buildingId, "water", period);
  const electricityRows = useUtilityRows(buildingId, "electricity", period);
  const gasRows = useUtilityRows(buildingId, "gas", period);
  const previousWaterRows = useUtilityRows(buildingId, "water", prevPeriod(period));
  const previousElectricityRows = useUtilityRows(buildingId, "electricity", prevPeriod(period));
  const previousGasRows = useUtilityRows(buildingId, "gas", prevPeriod(period));
  const customerNumbersQuery = useCustomerNumbers(buildingId ?? 0);
  const waterConfirmation = useUtilityConfirmation(buildingId, "water", period);
  const electricityConfirmation = useUtilityConfirmation(buildingId, "electricity", period);
  const gasConfirmation = useUtilityConfirmation(buildingId, "gas", period);
  const periodSettingQuery = useBillingPeriodSetting(buildingId, period);

  const selectedBuilding = buildings.find((building) => building.id === buildingId) ?? null;
  const { units, columns } = useMemo(() => pivotBillingRows(billingQuery.data ?? []), [billingQuery.data]);
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.unitId, unit])), [units]);
  const utilityRows = useMemo(() => ({
    water: waterRows.data ?? [],
    electricity: electricityRows.data ?? [],
    gas: gasRows.data ?? [],
  }), [electricityRows.data, gasRows.data, waterRows.data]);
  const utilityConfirmations = useMemo(() => ({
    water: waterConfirmation.data ?? null,
    electricity: electricityConfirmation.data ?? null,
    gas: gasConfirmation.data ?? null,
  }), [electricityConfirmation.data, gasConfirmation.data, waterConfirmation.data]);
  // 원본 mfNeedBasis: 미래월인데 부과기준일이 저장 안 됐으면 표 대신 "부과기준일 먼저 설정" 안내판.
  const needBasis = buildingId != null
    && isFuturePeriod(period)
    && !!periodSettingQuery.data
    && !periodSettingQuery.data.isSaved;

  const newOccupancies = newOccupanciesQuery.data ?? [];
  const selectionKey = buildingId ? `${buildingId}:${period}` : null;
  const [newTenantOpen, setNewTenantOpen] = useState(false);
  useEffect(() => {
    // 신규 입주 감지 결과는 비동기 쿼리 완료 후에만 알 수 있어 모달 상태를 동기화한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectionKey && newOccupancies.length > 0) setNewTenantOpen(true);
  }, [selectionKey, newOccupancies.length]);

  const resetDrafts = useCallback((note = "") => {
    setChargeDrafts({});
    setNoteDrafts({});
    setBuildingNoteDraft(note);
  }, []);

  const changeBuilding = (value: string) => {
    const nextId = value ? Number(value) : null;
    const nextBuilding = buildings.find((building) => building.id === nextId) ?? null;
    setBuildingId(nextId);
    setEditing(false);
    resetDrafts(nextBuilding?.billingNote ?? "");
  };

  const changePeriod = (year: number, month: number) => {
    setPeriod(periodFrom(year, month));
    setEditing(false);
    resetDrafts(selectedBuilding?.billingNote ?? "");
  };

  const onChargeChange = useCallback((unitId: number, feeItemId: number, patch: Partial<BillingChargeDraft>) => {
    setChargeDrafts((currentDrafts) => {
      const current = currentDrafts[unitId]?.[feeItemId]
        ?? unitsById.get(unitId)?.charges[feeItemId]
        ?? { charged: true, amount: 0 };
      return {
        ...currentDrafts,
        [unitId]: {
          ...currentDrafts[unitId],
          [feeItemId]: { ...current, ...patch },
        },
      };
    });
  }, [unitsById]);

  const onNoteChange = useCallback((unitId: number, patch: Partial<BillingNoteDraft>) => {
    setNoteDrafts((current) => {
      const unit = unitsById.get(unitId);
      const existing = current[unitId] ?? { billingNote: unit?.billingNote ?? "", unitNotice: unit?.unitNotice ?? "" };
      return { ...current, [unitId]: { ...existing, ...patch } };
    });
  }, [unitsById]);

  const saveAndConfirm = async () => {
    if (!buildingId || !selectedBuilding) return;
    const charges = Object.entries(chargeDrafts).flatMap(([unitIdText, rowDrafts]) => {
      const unitId = Number(unitIdText);
      const occupancyId = unitsById.get(unitId)?.occupancyId ?? null;
      return Object.entries(rowDrafts).map(([feeItemId, draft]) => ({
        unitId,
        feeItemId: Number(feeItemId),
        charged: draft.charged,
        amount: draft.amount,
        occupancyId,
      }));
    });
    const notes = Object.entries(noteDrafts).map(([unitId, value]) => ({
      unitId: Number(unitId),
      billingNote: value.billingNote || null,
      unitNotice: value.unitNotice || null,
    }));
    try {
      if (charges.length > 0 || notes.length > 0) {
        await saveCharges.mutateAsync({ buildingId, period, charges, notes });
      }
      if (buildingNoteDraft !== (selectedBuilding.billingNote ?? "")) {
        await saveBuildingNotes.mutateAsync({
          buildingId,
          memo: selectedBuilding.memo ?? "",
          billingNote: buildingNoteDraft,
        });
      }
      // 원본은 저장 시 무음(성공 토스트 없음) — 저장 후 편집바가 조회 모드로 전환되는 것이 완료 신호.
      if (units.length > 0) await confirmBilling.mutateAsync({ buildingId, period });
      setEditing(false);
      resetDrafts(buildingNoteDraft);
    } catch (error) {
      toast.error(error, "관리비 부과 내용을 저장하지 못했습니다.");
      throw error;
    }
  };

  // 공과금 확정 여부·0원 부과 항목으로 저장을 막거나 확인받지 않는다(2026-10-14 결정: 0원 경고 모달 제거).
  // 공과금 부과액 누락 안내는 '공과금 계산' 때만 한다.
  const requestSaveAndConfirm = saveAndConfirm;

  // 세대 부과액(수동 우선, 없으면 자동 계산). 공과금 관리에서 아직 입력하지 않은 세대는 null.
  const utilityCharge = (row: { manualCharge: number | null; automaticCharge: number | null }) =>
    row.manualCharge ?? row.automaticCharge;

  // 정책 3.6 공과금 계산(2026-10-14 변경): 공과금 관리의 이번 달 부과액을 세대별 관리비에 반영한다.
  // 대상 공과금(고객번호가 등록됐거나 부과액이 하나라도 입력된 공과금) 중 입주 세대의 부과액이
  // 하나라도 비어 있으면 반영하지 않고 「공과금 부과액이 아직 없어요」 모달로 누락된 공과금을 알린다.
  const calculateUtilities = () => {
    if (!buildingId) return;
    const utilityTypes = ["water", "electricity", "gas"] as const;
    const utilityLabels = { water: "수도", electricity: "전기", gas: "가스" } as const;
    const customerNumberKinds = { water: "water", electricity: "elec", gas: "gas" } as const;
    const registeredKinds = new Set((customerNumbersQuery.data ?? []).map((customer) => customer.kind));
    const targetTypes = utilityTypes.filter((type) =>
      registeredKinds.has(customerNumberKinds[type])
      || utilityRows[type].some((row) => utilityCharge(row) != null));
    const isOccupiedRow = (row: (typeof utilityRows)["water"][number]) =>
      row.occupancyId != null
      && row.occupancyStatus !== "vacant"
      && !(unitsById.get(row.unitId)?.isVacant ?? false);
    const missingTypes = targetTypes.length === 0
      ? [...utilityTypes]
      : targetTypes.filter((type) =>
        utilityRows[type].some((row) => isOccupiedRow(row) && utilityCharge(row) == null));
    if (missingTypes.length > 0) {
      setMissingUtilityLabels(missingTypes.map((type) => utilityLabels[type]));
      setDialog("utility-missing");
      return;
    }
    const readyTypes = targetTypes;
    // 공과금 항목은 필수 항목(수도료·전기·가스)이다. 같은 이름의 항목이 없으면 그 공과금은 반영하지 않는다.
    const columnByType = {
      water: columns.find((column) => column.isRequired && column.name === "수도료"),
      electricity: columns.find((column) => column.isRequired && column.name === "전기"),
      gas: columns.find((column) => column.isRequired && column.name === "가스"),
    };
    setChargeDrafts((current) => {
      const next = { ...current };
      readyTypes.forEach((type) => {
        const column = columnByType[type];
        if (!column) return;
        utilityRows[type].forEach((row) => {
          const unit = unitsById.get(row.unitId);
          const amount = utilityCharge(row);
          // 부과액이 없는 세대는 기존 입력값을 덮어쓰지 않는다.
          if (!unit || amount == null) return;
          next[row.unitId] = {
            ...next[row.unitId],
            [column.feeItemId]: {
              charged: !unit.isVacant,
              // 세대별 수동 부과액 우선, 없으면 자동 계산 부과액.
              amount,
            },
          };
        });
      });
      return next;
    });
    if (!editing) setBuildingNoteDraft(selectedBuilding?.billingNote ?? "");
    setEditing(true);
  };

  const openCarryBuilding = () => {
    if (!selectedBuilding) {
      setDialog("no-building");
      return;
    }
    setDialog(selectedBuilding.setupConfirmRequired ? "important-building" : "carry-building");
  };

  const confirmDialog = async () => {
    if (dialog === "no-building" || dialog === "carry-all-done") {
      setDialog(null);
      return;
    }
    if (dialog === "utility-missing") {
      setDialog(null);
      return;
    }
    if (dialog === "important-building") {
      setDialog("carry-building");
      return;
    }
    const buildingIds = dialog === "carry-all"
      ? buildings.map((building) => building.id)
      : buildingId ? [buildingId] : [];
    if (buildingIds.length === 0) return;
    try {
      const result = await copyPrevious.mutateAsync({ buildingIds, period });
      setEditing(true);
      if (dialog === "carry-all") {
        // 원본 runFillAll: 결과를 토스트가 아니라 안내창으로 알린다.
        setCarriedBuildingCount(result.buildingCount);
        setDialog("carry-all-done");
      } else {
        setDialog(null);
        // 세대·항목마다 저장된 가장 최근 달의 값을 가져오므로(전월에 없으면 그 이전) 특정 월을 적지 않는다.
        toast.success(result.unitCount > 0 ? "지난 자료를 반영했어요" : "가져올 지난 자료가 없어요");
      }
    } catch (error) {
      toast.error(error, "전월 자료를 반영하지 못했습니다.");
    }
  };

  const openHistory = useCallback((unitId: number) => {
    const unit = unitsById.get(unitId);
    if (unit) setHistoryUnit({ id: unitId, no: unit.unitNo });
  }, [unitsById]);

  const handleChargeNewTenants = async (unitIds: number[]) => {
    if (!buildingId) return;
    try {
      const result = await chargeNewOccupancies.mutateAsync({ buildingId, period, unitIds });
      toast.success(`신규 입주 ${result.unitCount}세대 당월 부과 완료 (${formatWon(result.total)})`);
      setNewTenantOpen(false);
    } catch (error) {
      toast.error(error, "신규 입주 세대 부과를 처리하지 못했습니다.");
    }
  };

  const isManagementFeeMutationPending =
    saveCharges.isPending ||
    confirmBilling.isPending ||
    copyPrevious.isPending ||
    saveBuildingNotes.isPending;
  const isManagementFeeDataRefreshing = [
    buildingsQuery,
    waterRows,
    electricityRows,
    gasRows,
    previousWaterRows,
    previousElectricityRows,
    previousGasRows,
    billingQuery,
  ].some((query) => query.isFetching && !query.isLoading);
  return (
    <div className="relative h-[calc(100dvh-62px)] min-h-[720px] overflow-hidden bg-bg px-[24px] pb-[24px] pt-[22px] leading-[normal]">
      {isManagementFeeDataRefreshing ? (
        <div className="absolute right-6 top-3 z-10 rounded-lg bg-white/95 shadow-card">
          <Spinner label="관리비 자료 갱신 중" size="small" showLabel className="px-3 py-2" />
        </div>
      ) : null}
      <div className="grid h-full min-h-0 grid-cols-[322px_minmax(0,1fr)] gap-[16px]">
        <BuildingDirectoryRail
          buildings={buildings}
          buildingTypes={buildingTypes}
          selectedBuildingId={buildingId}
          period={period}
          loading={buildingsQuery.isLoading}
          editing={editing}
          note={buildingNoteDraft}
          onNoteChange={setBuildingNoteDraft}
          onBuildingChange={changeBuilding}
          onPeriodChange={changePeriod}
        />

        <main className="grid min-h-0 grid-rows-[auto_196px_minmax(250px,1fr)] gap-[12px]">
          <BillingPeriodSettingsBar
            key={`${buildingId ?? "none"}:${period}`}
            buildingId={buildingId}
            buildingName={selectedBuilding?.name ?? ""}
            period={period}
            editing={editing}
            pending={isManagementFeeMutationPending}
            onEdit={() => {
              setBuildingNoteDraft(selectedBuilding?.billingNote ?? "");
              setEditing(true);
            }}
            onCancel={() => {
              setEditing(false);
              resetDrafts(selectedBuilding?.billingNote ?? "");
            }}
            onSave={requestSaveAndConfirm}
          />

          <UtilitySummaryPanel
            buildingSelected={buildingId !== null}
            rows={utilityRows}
            previousRows={{
              water: previousWaterRows.data ?? [],
              electricity: previousElectricityRows.data ?? [],
              gas: previousGasRows.data ?? [],
            }}
            customerNumbers={customerNumbersQuery.data ?? []}
            customerNumbersLoading={customerNumbersQuery.isLoading}
            confirmations={utilityConfirmations}
            loading={{ water: waterRows.isLoading, electricity: electricityRows.isLoading, gas: gasRows.isLoading }}
          />

          <section className="flex min-h-0 flex-col overflow-hidden rounded-[16px] bg-surface shadow-card">
            <BillingSectionToolbar
              hasBuildings={buildings.length > 0}
              pending={isManagementFeeMutationPending}
              onCarryBuilding={openCarryBuilding}
              onCarryAll={() => setDialog("carry-all")}
              buildingSelected={buildingId !== null}
              onCalculateUtilities={calculateUtilities}
            />

            <div className="min-h-0 flex-1">
              {!buildingId && (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-[4px] px-[20px] pb-[26px] pt-[22px] text-center">
                  <span className="mb-[4px] flex size-[56px] items-center justify-center rounded-[17px] bg-[#e2f5f1]"><Image src="/icons/management-fee-empty.svg" alt="" width={27} height={27} className="size-[27px]" /></span>
                  <p className="text-[16px] font-bold tracking-[-0.02em] text-t1">건물을 선택해 주세요</p>
                  <p className="text-[13.5px] font-normal leading-[1.6] text-t3">선택한 건물의 세대별 관리비 항목이 표시돼요</p>
                </div>
              )}
              {buildingId && billingQuery.isLoading && <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-2"><Spinner label="관리비 자료 불러오는 중" showLabel /></div>}
              {buildingId && billingQuery.error && (
                <div role="alert" className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 text-center">
                  <p className="text-[13px] font-semibold text-red">관리비를 불러오지 못했어요.</p>
                  <button type="button" onClick={() => billingQuery.refetch()} className="h-[32px] rounded-[9px] border border-line px-[12px] text-[12px] font-bold">다시 시도</button>
                </div>
              )}
              {buildingId && !billingQuery.isLoading && !billingQuery.error && needBasis && (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-[6px] px-[24px] pb-[48px] pt-[40px] text-center">
                  <span className="mb-[4px] flex size-[56px] items-center justify-center rounded-[17px] bg-[#e2f5f1] text-teal">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-[27px]"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 11h16" /></svg>
                  </span>
                  <p className="text-[16px] font-bold tracking-[-0.02em] text-t1">부과기준일을 먼저 설정해 주세요</p>
                  <p className="text-[13.5px] font-normal leading-[1.6] text-t3">아직 검침이 등록되지 않은 달이에요</p>
                  <button
                    type="button"
                    onClick={() => { setBuildingNoteDraft(selectedBuilding?.billingNote ?? ""); setEditing(true); }}
                    className="mt-[16px] h-[42px] rounded-[12px] bg-teal px-[22px] text-[14px] font-bold text-white hover:bg-teal-d"
                  >
                    부과기준일 설정
                  </button>
                </div>
              )}
              {buildingId && !billingQuery.isLoading && !billingQuery.error && !needBasis && units.length === 0 && (
                <div className="flex h-full items-center justify-center text-[13px] text-t3">등록된 세대가 없어요.</div>
              )}
              {buildingId && !billingQuery.isLoading && !billingQuery.error && !needBasis && units.length > 0 && (
                <BillingTable
                  units={units}
                  columns={columns}
                  period={period}
                  editing={editing}
                  utilities={utilityRows}
                  chargeDrafts={chargeDrafts}
                  noteDrafts={noteDrafts}
                  onChargeChange={onChargeChange}
                  onRowClick={openHistory}
                  onNoteChange={onNoteChange}
                />
              )}
            </div>
          </section>
        </main>
      </div>

      <ManagementFeeDialog
        kind={dialog}
        buildingName={selectedBuilding?.name ?? "선택한 건물"}
        period={period}
        pending={copyPrevious.isPending}
        missingUtilityLabels={missingUtilityLabels}
        carriedBuildingCount={carriedBuildingCount}
        onClose={() => setDialog(null)}
        onConfirm={() => void confirmDialog()}
      />
      <BillingHistoryModal open={Boolean(historyUnit)} unitId={historyUnit?.id ?? null} unitNo={historyUnit?.no ?? ""} period={period} onClose={() => setHistoryUnit(null)} />
      <NewTenantChargeModal open={newTenantOpen} units={newOccupancies} pending={chargeNewOccupancies.isPending} onConfirm={handleChargeNewTenants} onClose={() => setNewTenantOpen(false)} />
    </div>
  );
}

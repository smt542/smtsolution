"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import {
  useBilling,
  useChargeNewOccupancies,
  useConfirmBilling,
  useCopyPreviousBilling,
  useSaveBillingCharges,
  useUnchargedNewOccupancies,
} from "@/hooks/reactquery/billing";
import { useSaveBuildingNotes } from "@/hooks/reactquery/receipts";
import { useUtilityConfirmation, useUtilityRows } from "@/hooks/reactquery/utilities";
import { hasModule } from "@/lib/auth/permissions";
import { currentPeriod } from "@/lib/billing/period";
import { pivotBillingRows } from "@/lib/billing/pivot";
import { formatWon } from "@/lib/format";
import { BillingHistoryModal } from "./components/BillingHistoryModal";
import { BillingNoteModal } from "./components/BillingNoteModal";
import { BillingPeriodSettingsBar } from "./components/BillingPeriodSettingsBar";
import { BillingSectionToolbar } from "./components/BillingSectionToolbar";
import { BillingTable, type BillingChargeDraft, type BillingNoteDraft } from "./components/BillingTable";
import { BuildingDirectoryRail } from "./components/BuildingDirectoryRail";
import { ManagementFeeDialog, type ManagementFeeDialogKind } from "./components/ManagementFeeDialog";
import { NewTenantChargeModal } from "./components/NewTenantChargeModal";
import { UtilitySummaryPanel } from "./components/UtilitySummaryPanel";

const periodFrom = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`;

export default function ManagementFeePage() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const { data: buildingTypes = [] } = useBuildingTypes();
  const buildings = buildingsQuery.data ?? [];

  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState(() => currentPeriod());
  const [editing, setEditing] = useState(false);
  const [buildingNoteDraft, setBuildingNoteDraft] = useState("");
  const [chargeDrafts, setChargeDrafts] = useState<Record<number, Record<number, BillingChargeDraft>>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, BillingNoteDraft>>({});
  const [noteUnit, setNoteUnit] = useState<number | null>(null);
  const [historyUnit, setHistoryUnit] = useState<{ id: number; no: string } | null>(null);
  const [dialog, setDialog] = useState<ManagementFeeDialogKind | null>(null);

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
  const waterConfirmation = useUtilityConfirmation(buildingId, "water", period);
  const electricityConfirmation = useUtilityConfirmation(buildingId, "electricity", period);
  const gasConfirmation = useUtilityConfirmation(buildingId, "gas", period);

  const selectedBuilding = buildings.find((building) => building.id === buildingId) ?? null;
  const { units, columns } = useMemo(() => pivotBillingRows(billingQuery.data ?? []), [billingQuery.data]);
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.unitId, unit])), [units]);
  const zeroAmountSummary = useMemo(() => {
    let unitCount = 0;
    let itemCount = 0;

    units.forEach((unit) => {
      if (unit.isVacant) return;
      let unitItemCount = 0;
      columns.forEach((column) => {
        const charge = chargeDrafts[unit.unitId]?.[column.feeItemId]
          ?? unit.charges[column.feeItemId]
          ?? { charged: true, amount: 0 };
        if (charge.charged && charge.amount === 0) unitItemCount += 1;
      });
      if (unitItemCount > 0) unitCount += 1;
      itemCount += unitItemCount;
    });

    return { unitCount, itemCount };
  }, [chargeDrafts, columns, units]);
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
      toast.error(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  const requestSaveAndConfirm = async () => {
    if (zeroAmountSummary.itemCount > 0) {
      setDialog("zero-amount");
      return;
    }
    await saveAndConfirm();
  };

  const openCarryBuilding = () => {
    if (!selectedBuilding) return;
    setDialog(selectedBuilding.setupConfirmRequired ? "important-building" : "carry-building");
  };

  const confirmDialog = async () => {
    if (dialog === "utility-missing") {
      setDialog(null);
      return;
    }
    if (dialog === "important-building") {
      setDialog("carry-building");
      return;
    }
    if (dialog === "zero-amount") {
      try {
        await saveAndConfirm();
        setDialog(null);
      } catch {
        // saveAndConfirm에서 오류를 안내하고, 재시도를 위해 경고 모달을 유지한다.
      }
      return;
    }
    const buildingIds = dialog === "carry-all"
      ? buildings.map((building) => building.id)
      : buildingId ? [buildingId] : [];
    if (buildingIds.length === 0) return;
    try {
      const result = await copyPrevious.mutateAsync({ buildingIds, period });
      setDialog(null);
      setEditing(true);
      toast.success(`전월 자료를 반영했습니다. (${result.buildingCount}개 건물 · ${result.unitCount}세대)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
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
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  if (me === undefined) return null;
  if (!hasModule(me, "billing")) {
    return <div className="p-6"><EmptyState message="이 화면에 접근할 권한이 없습니다. (부과 확정 권한 필요)" /></div>;
  }

  const actionPending = saveCharges.isPending || confirmBilling.isPending || copyPrevious.isPending || saveBuildingNotes.isPending;
  return (
    <div className="h-[calc(100dvh-62px)] min-h-[720px] overflow-hidden bg-bg px-[24px] pb-[24px] pt-[22px]">
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
            pending={actionPending}
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
            confirmations={utilityConfirmations}
            loading={{ water: waterRows.isLoading, electricity: electricityRows.isLoading, gas: gasRows.isLoading }}
          />

          <section className="flex min-h-0 flex-col overflow-hidden rounded-[16px] bg-surface shadow-card">
            <BillingSectionToolbar
              buildingSelected={buildingId !== null}
              hasBuildings={buildings.length > 0}
              pending={actionPending}
              onCarryBuilding={openCarryBuilding}
              onCarryAll={() => setDialog("carry-all")}
            />

            <div className="min-h-0 flex-1">
              {!buildingId && (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-[4px] text-center">
                  <span className="mb-[4px] flex size-[56px] items-center justify-center rounded-[17px] bg-[#e2f5f1]"><Image src="/icons/management-fee-empty.svg" alt="" width={27} height={27} className="size-[27px]" /></span>
                  <p className="text-[16px] font-bold tracking-[-0.02em] text-t1">건물을 선택해 주세요</p>
                  <p className="text-[13.5px] font-normal leading-[1.6] text-t3">선택한 건물의 세대별 관리비 항목이 표시돼요</p>
                </div>
              )}
              {buildingId && billingQuery.isLoading && <div className="flex h-full flex-col items-center justify-center gap-2"><Spinner /><p className="text-[12px] text-t3">관리비를 불러오고 있어요.</p></div>}
              {buildingId && billingQuery.error && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="text-[13px] font-semibold text-red">관리비를 불러오지 못했어요.</p>
                  <button type="button" onClick={() => billingQuery.refetch()} className="h-[32px] rounded-[9px] border border-line px-[12px] text-[12px] font-bold">다시 시도</button>
                </div>
              )}
              {buildingId && !billingQuery.isLoading && !billingQuery.error && units.length === 0 && (
                <div className="flex h-full items-center justify-center text-[13px] text-t3">등록된 세대가 없어요.</div>
              )}
              {buildingId && !billingQuery.isLoading && !billingQuery.error && units.length > 0 && (
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
                  onNoteClick={(unitId) => editing && setNoteUnit(unitId)}
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
        pending={dialog === "zero-amount" ? actionPending : copyPrevious.isPending}
        zeroAmountUnitCount={zeroAmountSummary.unitCount}
        zeroAmountItemCount={zeroAmountSummary.itemCount}
        onClose={() => setDialog(null)}
        onConfirm={() => void confirmDialog()}
      />
      <BillingHistoryModal open={Boolean(historyUnit)} unitId={historyUnit?.id ?? null} unitNo={historyUnit?.no ?? ""} period={period} onClose={() => setHistoryUnit(null)} />
      <NewTenantChargeModal open={newTenantOpen} units={newOccupancies} pending={chargeNewOccupancies.isPending} onConfirm={handleChargeNewTenants} onClose={() => setNewTenantOpen(false)} />
      {(() => {
        const unit = noteUnit === null ? undefined : unitsById.get(noteUnit);
        const noteDraft = noteUnit === null ? undefined : noteDrafts[noteUnit];
        return (
          <BillingNoteModal
            open={noteUnit !== null}
            unitNo={unit?.unitNo ?? ""}
            billingNote={noteDraft?.billingNote ?? unit?.billingNote ?? ""}
            unitNotice={noteDraft?.unitNotice ?? unit?.unitNotice ?? ""}
            onClose={() => setNoteUnit(null)}
            onSave={(value) => {
              if (noteUnit !== null) setNoteDrafts((current) => ({ ...current, [noteUnit]: value }));
              setNoteUnit(null);
            }}
          />
        );
      })()}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  customerNumberKeys,
  listCustomerNumbersByBuilding,
} from "@/hooks/reactquery/buildingCustomerNumbers";
import {
  useBillingPeriod,
  useFixedValues,
  useSaveFixedValues,
  useSaveMeterReadings,
  useSaveUtilityCustomerBills,
  useUtilityCustomerBills,
  useUtilityRows,
  type FixedValueEntry,
  type UtilityAllocationResult,
  type UtilityType,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import { hasModule } from "@/lib/auth/permissions";
import { BuildingSelectionRail } from "./components/BuildingSelectionRail";
import {
  BillingBasisRequiredState,
  hasBillingBasis,
  isPrototypeFuturePeriod,
} from "./components/BillingBasisRequiredState";
import { CarryOverConfirmModal } from "./components/CarryOverConfirmModal";
import { MeterLedgerModal } from "./components/MeterLedgerModal";
import { UnitPriceModal } from "./components/UnitPriceModal";
import { UtilityAccountSummary } from "./components/UtilityAccountSummary";
import { defaultBillingDates } from "./components/BillingPeriodBar";
import { UtilityPeriodBarPlaceholder } from "./components/UtilityPeriodBarPlaceholder";
import { UtilityWorkspaceHeader } from "./components/UtilityWorkspaceHeader";
import { UtilityTable, type UtilityDraft } from "./components/UtilityTable";
import { UtilityWorkspaceBar } from "./components/UtilityWorkspaceBar";
import { customerBillChanges, notifyAllocationMismatch } from "./components/utilityAllocation";
import {
  fixedChangesFor,
  groupFixedValues,
  initialLockDraft,
  usageEditedForRow,
} from "./components/UtilityLock";
import { WaterDiscountModal } from "./components/WaterDiscountModal";

const TYPE_LABELS: Record<UtilityType, string> = {
  water: "수도",
  electricity: "전기",
  gas: "가스",
};

function utilityTypeFromLocation(): UtilityType {
  const type = new URLSearchParams(window.location.search).get("type");
  return type === "electricity" || type === "gas" ? type : "water";
}

function localDateString(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function periodDate(year: number, month: number): string {
  return localDateString(new Date(year, month - 1, 1));
}

function isVacant(row: UtilityUnitRow): boolean {
  return row.occupancyStatus === "vacant" || row.occupancyId === null;
}

function initialDraft(row: UtilityUnitRow, fixed: FixedValueEntry[] | undefined, period: string): UtilityDraft {
  return {
    previousReading: row.previousReading === null ? "" : String(row.previousReading),
    currentReading: row.currentReading === null ? "" : String(row.currentReading),
    usage: row.usage === null ? "" : String(row.usage),
    usageEdited: usageEditedForRow(row.previousReading, row.currentReading, row.usage),
    note: row.note ?? "",
    ...initialLockDraft(fixed, period, row.manualCharge),
  };
}

function UnselectedWorkspace({ period }: { period: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <UtilityPeriodBarPlaceholder period={period} />
      <section className="grid h-[150px] place-items-center rounded-[16px] bg-white shadow-card">
        <div className="text-center"><p className="text-[15px] font-semibold tracking-[-0.02em] text-t1">건물을 선택해 주세요</p><p className="mt-[5px] text-[13px] leading-[1.55] text-t3">선택한 건물의 고객번호가 여기에 표시돼요</p></div>
      </section>
      <section className="grid min-h-[360px] flex-1 place-items-center rounded-[16px] bg-white shadow-card">
        <div className="text-center"><p className="text-[16px] font-semibold tracking-[-0.02em] text-t1">건물을 선택해 주세요</p><p className="mt-1.5 text-[13px] leading-[1.55] text-t3">선택한 건물의 고객번호가 여기에 표시돼요</p></div>
      </section>
    </div>
  );
}

export function WaterUtilitiesScreen({ initialType = "water" }: { initialType?: UtilityType }) {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [utilityType, setUtilityType] = useState<UtilityType>(initialType);
  const [referenceDate, setReferenceDate] = useState("2026-07-01");
  const [drafts, setDrafts] = useState<Record<string, UtilityDraft>>({});
  const [selectedRow, setSelectedRow] = useState<UtilityUnitRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [carryOpen, setCarryOpen] = useState(false);
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [discountRow, setDiscountRow] = useState<UtilityUnitRow | null>(null);
  /** 고객번호 요약 부과액(고객번호×월 청구총액) 직접 입력값. key = `${scopeKey}:${customerNo}`. */
  const [billDrafts, setBillDrafts] = useState<Record<string, string>>({});

  const year = Number(referenceDate.slice(0, 4));
  const month = Number(referenceDate.slice(5, 7));
  const period = `${referenceDate.slice(0, 7)}-01`;
  const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
  const selectedBuilding = buildings.find((building) => building.id === buildingId) ?? null;
  const rowsQuery = useUtilityRows(buildingId, utilityType, period);
  const fixedValuesQuery = useFixedValues(buildingId, utilityType);
  const billingPeriodQuery = useBillingPeriod(buildingId, period);
  const saveMeter = useSaveMeterReadings();
  const saveFixedValues = useSaveFixedValues();
  const customerBillsQuery = useUtilityCustomerBills(buildingId, utilityType, period);
  const saveCustomerBills = useSaveUtilityCustomerBills();
  const customerNumberQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: customerNumberKeys.byBuilding(building.id),
      queryFn: () => listCustomerNumbersByBuilding(building.id),
    })),
  });
  const waterCustomerNumberCounts = Object.fromEntries(buildings.map((building, index) => [
    building.id,
    (customerNumberQueries[index]?.data ?? []).filter((item) => item.kind === "water").length,
  ]));

  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const fixedByUnit = useMemo(
    () => groupFixedValues(fixedValuesQuery.data ?? []),
    [fixedValuesQuery.data],
  );
  const scopeKey = `${buildingId ?? "none"}:${utilityType}:${period}`;
  const rowsById = useMemo(() => new Map(rows.map((row) => [row.unitId, row])), [rows]);
  const scopedDrafts = useMemo<Record<number, UtilityDraft>>(
    () => Object.fromEntries(rows.map((row) => [
      row.unitId,
      drafts[`${scopeKey}:${row.unitId}`] ?? initialDraft(row, fixedByUnit.get(row.unitId), period),
    ])),
    [drafts, fixedByUnit, period, rows, scopeKey],
  );
  const activeRows = useMemo(() => rows.filter((row) => !isVacant(row)), [rows]);
  const scopedBillDrafts = useMemo<Record<string, string>>(
    () => Object.fromEntries(Object.entries(billDrafts)
      .filter(([key]) => key.startsWith(`${scopeKey}:`))
      .map(([key, value]) => [key.slice(scopeKey.length + 1), value])),
    [billDrafts, scopeKey],
  );
  const clearBillDrafts = () => setBillDrafts((current) => Object.fromEntries(
    Object.entries(current).filter(([key]) => !key.startsWith(`${scopeKey}:`)),
  ));
  const effectiveSelectedRow = rows.find((row) => row.unitId === selectedRow?.unitId) ?? rows[0] ?? null;
  const isWaterWorkspaceLoading =
    rowsQuery.isLoading ||
    fixedValuesQuery.isLoading ||
    (buildingId !== null && billingPeriodQuery.isLoading);
  const rowsError = rowsQuery.error ?? fixedValuesQuery.error;
  const needsBasis = buildingId !== null
    && !billingPeriodQuery.isLoading
    && isPrototypeFuturePeriod(period)
    && !hasBillingBasis(
      billingPeriodQuery.data?.chargeStartDate,
      billingPeriodQuery.data?.chargeEndDate,
    );

  useEffect(() => {
    const handleTypeChange = (event: Event) => {
      const next = (event as CustomEvent<UtilityType>).detail;
      if (!TYPE_LABELS[next]) return;
      setUtilityType(next);
      setSelectedRow(null);
      setEditing(false);
    };
    window.addEventListener("utilities:type-change", handleTypeChange);
    const initialSync = window.setTimeout(() => {
      handleTypeChange(new CustomEvent("utilities:type-change", { detail: utilityTypeFromLocation() }));
    }, 0);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("utilities:type-change", handleTypeChange);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("utilities:type-change", { detail: utilityType }));
  }, [utilityType]);

  const updateDraft = useCallback((unitId: number, patch: Partial<UtilityDraft>) => {
    const row = rowsById.get(unitId);
    if (!row) return;
    const key = `${scopeKey}:${unitId}`;
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? initialDraft(row, fixedByUnit.get(unitId), period)), ...patch },
    }));
  }, [fixedByUnit, period, rowsById, scopeKey]);

  if (me === undefined) return null;
  if (!hasModule(me, "utilities")) {
    return <div className="p-6"><EmptyState message="이 화면에 접근할 권한이 없습니다. (지침·부과 권한 필요)" /></div>;
  }

  const selectBuilding = (id: number) => {
    setBuildingId(id);
    setSelectedRow(null);
    setEditing(false);
    setPriceModalOpen(false);
    setDiscountRow(null);
  };

  const saveReadings = async (finishEditing: boolean) => {
    if (buildingId === null) return;
    // 고정한 호실은 지침이 비어도 저장해야 이 달 부과에 고정값이 들어간다.
    // 고정 사용량은 이력값으로 서버가 계산하므로 usage 를 보내지 않는다.
    const payloadRows = activeRows
      .map((row) => ({ row, draft: scopedDrafts[row.unitId] }))
      .filter(({ row, draft }) => (
        draft.usageLocked
        || draft.manualLocked
        || draft.previousReading.trim() !== (row.previousReading === null ? "" : String(row.previousReading))
        || draft.currentReading.trim() !== ""
        || draft.usage.trim() !== ""
        || draft.usageEdited
        || draft.manualCharge.trim() !== ""
        || draft.note.trim() !== ""
      ))
      .map(({ row, draft }) => ({
        unit_id: row.unitId,
        ...(draft.previousReading.trim() === "" ? {} : { previous_reading: draft.previousReading.trim() }),
        ...(draft.currentReading.trim() === "" ? {} : { current_reading: draft.currentReading.trim() }),
        ...(draft.usageLocked || !draft.usageEdited || draft.usage.trim() === "" ? {} : { usage: draft.usage.trim() }),
        manual_charge: draft.manualCharge.trim(),
        note: draft.note.trim(),
      }));
    const fixedChanges = activeRows.flatMap((row) => fixedChangesFor(
      row.unitId,
      scopedDrafts[row.unitId],
      fixedByUnit.get(row.unitId),
      period,
    ));
    let bills: { customer_number_id: number; amount: number | null }[];
    try {
      // 요약표 부과액 → 고객번호×월 청구총액(옵트인: 직접 고친 고객번호만).
      bills = utilityType === "gas" ? [] : customerBillChanges((customerBillsQuery.data ?? []).map((bill) => ({
        customerNumberId: bill.customerNumberId,
        savedAmount: bill.amount,
        draft: scopedBillDrafts[bill.customerNo],
      })));
    } catch (error) {
      toast.error(error, "부과액을 확인해 주세요.");
      return;
    }
    if (payloadRows.length === 0 && fixedChanges.length === 0 && bills.length === 0) {
      if (finishEditing) {
        setEditing(false);
        clearBillDrafts();
        return;
      }
      toast.error("입력된 검침 정보가 없습니다.");
      return;
    }
    try {
      // 고정값을 먼저 써야 save_meter_readings 가 바뀐 고정 사용량으로 량을 계산한다.
      if (fixedChanges.length > 0) {
        await saveFixedValues.mutateAsync({ buildingId, utilityType, period, changes: fixedChanges });
      }
      let allocation: UtilityAllocationResult[] = [];
      let message = "고정값을 저장했습니다.";
      if (payloadRows.length > 0) {
        const result = await saveMeter.mutateAsync({ buildingId, utilityType, period, rows: payloadRows });
        allocation = result.allocation;
        message = `${result.saved}개 호실의 검침을 저장했습니다.`;
      }
      // 청구총액은 지침 저장 뒤에 써야 그 달 호실 전체를 총액 기준으로 배분한다(0274).
      if (bills.length > 0) {
        allocation = (await saveCustomerBills.mutateAsync({ buildingId, utilityType, period, bills })).allocation;
        if (payloadRows.length === 0) message = "고객번호 부과액을 저장하고 호실별로 배분했습니다.";
      }
      if (!notifyAllocationMismatch(allocation)) toast.success(message);
      if (finishEditing) {
        setEditing(false);
        clearBillDrafts();
      }
    } catch {
      toast.error("검침 저장에 실패했습니다.");
    }
  };

  const carryOver = () => {
    if (buildingId !== null) {
      const target = new Date(year, month, 1);
      const nextPeriod = periodDate(target.getFullYear(), target.getMonth() + 1);
      const nextScope = `${buildingId}:${utilityType}:${nextPeriod}`;
      setDrafts((current) => {
        const next = { ...current };
        activeRows.forEach((row) => {
          const source = scopedDrafts[row.unitId];
          const carried = source.currentReading.trim() || (row.previousReading === null ? "" : String(row.previousReading));
          next[`${nextScope}:${row.unitId}`] = {
            ...initialLockDraft(fixedByUnit.get(row.unitId), nextPeriod, null),
            previousReading: carried,
            currentReading: carried,
            usage: "0",
            usageEdited: false,
            note: "",
          };
        });
        return next;
      });
      setReferenceDate(nextPeriod);
    }
    setCarryOpen(false);
    setEditing(false);
    toast.success(`${year}년 ${month}월분을 다음 달로 이월했습니다.`);
  };

  return (
    <div className="utility-reference-font flex min-h-screen flex-col bg-bg">
      <UtilityWorkspaceHeader
        utilityLabel={TYPE_LABELS[utilityType]}
        onOpenLedger={() => setLedgerOpen(true)}
        onOpenCarryOver={() => setCarryOpen(true)}
      />

      <main className="grid min-h-[calc(100dvh-62px)] grid-cols-1 items-stretch gap-4 p-4 min-[1101px]:h-[calc(100dvh-62px)] min-[1101px]:min-h-0 min-[1101px]:grid-cols-[minmax(0,322px)_minmax(0,1fr)] min-[1101px]:grid-rows-[minmax(0,1fr)] min-[1101px]:overflow-hidden min-[1101px]:p-[22px_24px_24px]">
        <BuildingSelectionRail
          buildings={buildings}
          buildingId={buildingId}
          selectedRow={effectiveSelectedRow}
          utilityType={utilityType}
          period={period}
          year={year}
          month={month}
          customerNumberCounts={waterCustomerNumberCounts}
          disabled={editing}
          loading={buildingsQuery.isLoading}
          onBuildingChange={selectBuilding}
          onPeriodChange={(nextYear, nextMonth) => {
            setReferenceDate(periodDate(nextYear, nextMonth));
            setSelectedRow(null);
            setEditing(false);
          }}
        />

        {!buildingId ? <UnselectedWorkspace period={period} /> : (
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            {selectedBuilding && (
              <UtilityWorkspaceBar
                key={`${buildingId}:${period}`}
                buildingId={buildingId}
                buildingName={selectedBuilding.name}
                period={period}
                editing={editing}
                canEdit
                saving={saveMeter.isPending || saveCustomerBills.isPending}
                onEditingChange={(next) => {
                  setEditing(next);
                  if (!next) clearBillDrafts();
                }}
                onCalculate={() => void saveReadings(false)}
                onSave={() => void saveReadings(true)}
              />
            )}

            {isWaterWorkspaceLoading ? (
              <section className="grid min-h-[360px] flex-1 place-items-center rounded-xl border border-line bg-white"><Spinner label="수도 호실 정보 불러오는 중" showLabel /></section>
            ) : rowsError || billingPeriodQuery.error ? (
              <section role="alert" className="grid min-h-[360px] flex-1 place-items-center rounded-xl border border-red/20 bg-red-t text-center"><div><p className="text-[13px] font-bold text-red">호실 정보를 불러오지 못했습니다.</p><button type="button" onClick={() => { rowsQuery.refetch(); fixedValuesQuery.refetch(); billingPeriodQuery.refetch(); }} className="mt-3 h-8 rounded-lg border border-line bg-white px-3 text-[11px] font-bold text-t2">다시 시도</button></div></section>
            ) : (
              <>
                <UtilityAccountSummary
                  rows={rows}
                  selectedRow={effectiveSelectedRow}
                  editing={editing}
                  onSelect={setSelectedRow}
                  customerBills={customerBillsQuery.data}
                  chargeDrafts={scopedBillDrafts}
                  onChargeDraftChange={(customerNo, value) => setBillDrafts((current) => ({
                    ...current,
                    [`${scopeKey}:${customerNo}`]: value,
                  }))}
                />
                <section className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card min-[1101px]:min-h-0">
                  <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
                    <h2 className="text-[15px] font-extrabold text-t1">호실별 {TYPE_LABELS[utilityType]} 지침</h2>
                    <div className="ml-auto flex items-center gap-3 text-[11.5px] font-medium text-t3">
                      <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-blue2" />퇴실 예정</span>
                      <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-red" />공실 사용량</span>
                      <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-green" />최근 입주</span>
                      {editing && <button type="button" onClick={() => setPriceModalOpen(true)} className="ml-1 rounded-md border border-line px-2 py-1 text-t2 hover:bg-bg">단가 설정</button>}
                    </div>
                  </div>
                  {needsBasis ? (
                    <BillingBasisRequiredState onEdit={() => setEditing(true)} />
                  ) : rows.length === 0 ? <div className="grid flex-1 place-items-center text-[13px] text-t3">등록된 호실이 없어요.</div> : (
                    <UtilityTable
                      rows={rows}
                      drafts={scopedDrafts}
                      referenceDate={referenceDate}
                      chargeStartDate={billingPeriodQuery.data?.chargeStartDate ?? (isPrototypeFuturePeriod(period) ? undefined : defaultBillingDates(period).chargeStartDate)}
                      chargeEndDate={billingPeriodQuery.data?.chargeEndDate ?? (isPrototypeFuturePeriod(period) ? undefined : defaultBillingDates(period).chargeEndDate)}
                      editing={editing}
                      selectedRowId={effectiveSelectedRow?.unitId}
                      onDraftChange={updateDraft}
                      onRowClick={setSelectedRow}
                      onDiscountClick={utilityType === "water" ? setDiscountRow : undefined}
                    />
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {ledgerOpen && (
        <MeterLedgerModal
          open
          buildings={buildings}
          currentBuildingId={buildingId}
          period={period}
          utilityType="water"
          onClose={() => setLedgerOpen(false)}
        />
      )}
      <CarryOverConfirmModal open={carryOpen} year={year} month={month} onCancel={() => setCarryOpen(false)} onConfirm={carryOver} />
      <UnitPriceModal open={priceModalOpen} buildingId={buildingId} utilityType={utilityType} onClose={() => setPriceModalOpen(false)} />
      {discountRow && <WaterDiscountModal open buildingId={buildingId as number} period={period} row={discountRow} onClose={() => setDiscountRow(null)} />}
    </div>
  );
}

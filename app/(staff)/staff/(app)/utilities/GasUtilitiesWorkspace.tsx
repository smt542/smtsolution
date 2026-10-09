"use client";

import { useCallback, useMemo, useState } from "react";
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
  useSaveBillingPeriod,
  useSaveFixedValues,
  useSaveMeterReadings,
  useUtilityRows,
  type FixedValueEntry,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import { hasModule } from "@/lib/auth/permissions";
import { CarryOverDialog } from "./components/gas/CarryOverDialog";
import {
  BillingBasisRequiredState,
  hasBillingBasis,
  isPrototypeFuturePeriod,
} from "./components/BillingBasisRequiredState";
import { defaultBillingDates } from "./components/BillingPeriodBar";
import { GasAccountSummary } from "./components/gas/GasAccountSummary";
import { GasBillingToolbar } from "./components/gas/GasBillingToolbar";
import { UtilityBuildingRail } from "./components/UtilityBuildingRail";
import { GasReadingsTable } from "./components/gas/GasReadingsTable";
import { GasWorkspaceHeader } from "./components/gas/GasWorkspaceHeader";
import type { GasUtilityDraft } from "./components/gas/types";
import { MeterLedgerModal } from "./components/MeterLedgerModal";
import { UtilityPeriodBarPlaceholder } from "./components/UtilityPeriodBarPlaceholder";
import {
  fixedChangesFor,
  groupFixedValues,
  initialLockDraft,
  usageEditedForRow,
  usageTextFromReadings,
} from "./components/UtilityLock";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthEnd(year: number, month: number): string {
  return `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
}

function initialDraft(row: UtilityUnitRow, fixed: FixedValueEntry[] | undefined, period: string): GasUtilityDraft {
  const previousReading = row.previousReading === null ? "" : String(row.previousReading);
  const currentReading = row.currentReading === null ? "" : String(row.currentReading);
  const usageEdited = usageEditedForRow(row.previousReading, row.currentReading, row.usage);
  return {
    previousReading,
    currentReading,
    // 직접 넣은 량이 아니면 칸에는 화면 계산값(가스는 0 보정)을 보여 준다 — 저장된 음수(검토 표시)가 칸에 뜨지 않게.
    usage: usageEdited ? String(row.usage) : usageTextFromReadings(previousReading, currentReading, true),
    usageEdited,
    note: row.note ?? "",
    ...initialLockDraft(fixed, period, row.manualCharge),
  };
}

function SelectionPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center text-center ${compact ? "h-[150px]" : "min-h-0 flex-1"}`}>
      <div>
        <p className={`${compact ? "text-[15px]" : "text-[16px]"} font-semibold tracking-[-0.02em] text-t1`}>건물을 선택해 주세요</p>
        <p className="mt-[5px] text-[13px] font-normal leading-[1.55] text-t3">선택한 건물의 고객번호가 여기에 표시돼요</p>
      </div>
    </div>
  );
}

export default function GasUtilitiesWorkspace() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(7);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [drafts, setDrafts] = useState<Record<string, GasUtilityDraft>>({});
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [carryOverOpen, setCarryOverOpen] = useState(false);

  const period = `${year}-${pad(month)}-01`;
  const referenceDate = monthEnd(year, month);
  const rowsQuery = useUtilityRows(buildingId, "gas", period);
  const fixedValuesQuery = useFixedValues(buildingId, "gas");
  const billingPeriodQuery = useBillingPeriod(buildingId, period);
  const saveMeter = useSaveMeterReadings();
  const saveBillingPeriod = useSaveBillingPeriod();
  const saveFixedValues = useSaveFixedValues();
  const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
  const customerNumberQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: customerNumberKeys.byBuilding(building.id),
      queryFn: () => listCustomerNumbersByBuilding(building.id),
    })),
  });
  const gasCustomerNumberCounts = Object.fromEntries(buildings.map((building, index) => [
    building.id,
    (customerNumberQueries[index]?.data ?? []).filter((item) => item.kind === "gas").length,
  ]));
  const selectedBuilding = buildings.find((building) => building.id === buildingId) ?? null;
  const scopeKey = `${buildingId ?? "none"}:gas:${period}`;

  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const fixedByUnit = useMemo(
    () => groupFixedValues(fixedValuesQuery.data ?? []),
    [fixedValuesQuery.data],
  );

  const rowsById = useMemo(() => new Map(rows.map((row) => [row.unitId, row])), [rows]);
  const scopedDrafts = useMemo<Record<number, GasUtilityDraft>>(
    () => Object.fromEntries(rows.map((row) => [
      row.unitId,
      drafts[`${scopeKey}:${row.unitId}`] ?? initialDraft(row, fixedByUnit.get(row.unitId), period),
    ])),
    [drafts, fixedByUnit, period, rows, scopeKey],
  );
  const isGasWorkspaceLoading =
    rowsQuery.isLoading || fixedValuesQuery.isLoading || billingPeriodQuery.isLoading;
  const isGasSavePending = saveFixedValues.isPending || saveMeter.isPending || saveBillingPeriod.isPending;
  const rowsError = rowsQuery.error ?? fixedValuesQuery.error;
  const defaults = useMemo(() => defaultBillingDates(period), [period]);
  const useDefaultBasis = !isPrototypeFuturePeriod(period);
  const chargeStartDate = editing
    ? editStartDate
    : billingPeriodQuery.data?.chargeStartDate ?? (useDefaultBasis ? defaults.chargeStartDate : "");
  const chargeEndDate = editing
    ? editEndDate
    : billingPeriodQuery.data?.chargeEndDate ?? (useDefaultBasis ? defaults.chargeEndDate : "");
  const needsBasis = buildingId !== null
    && !billingPeriodQuery.isLoading
    && isPrototypeFuturePeriod(period)
    && !hasBillingBasis(chargeStartDate, chargeEndDate);

  const updateDraft = useCallback((unitId: number, patch: Partial<GasUtilityDraft>) => {
    const row = rowsById.get(unitId);
    if (!row) return;
    const key = `${scopeKey}:${unitId}`;
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? initialDraft(row, fixedByUnit.get(unitId), period)), ...patch },
    }));
  }, [fixedByUnit, period, rowsById, scopeKey]);

  if (me === undefined) return null;

  const selectBuilding = (id: number) => {
    if (editing) return;
    setBuildingId(id);
  };

  const resetScopeDrafts = () => {
    setDrafts((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !key.startsWith(`${scopeKey}:`)),
    ));
  };

  /** 고정한 호실은 지침이 비어도 저장해야 이 달 부과에 고정값이 들어간다. */
  const buildPayloadRows = () => rows
    .filter((row) => {
      const draft = scopedDrafts[row.unitId];
      return draft.usageLocked
        || draft.manualLocked
        || draft.previousReading.trim() !== (row.previousReading === null ? "" : String(row.previousReading))
        || draft.currentReading.trim() !== ""
        || draft.usageEdited
        || draft.manualCharge.trim() !== ""
        || draft.note.trim() !== ""
        // 저장된 수동입력을 지운 경우도 보내야 서버에서 수동값이 해제된다.
        || (row.manualCharge !== null && draft.manualCharge.trim() === "");
    })
    .map((row) => ({
      unit_id: row.unitId,
      ...(scopedDrafts[row.unitId].previousReading.trim() === "" ? {} : { previous_reading: scopedDrafts[row.unitId].previousReading.trim() }),
      current_reading: scopedDrafts[row.unitId].currentReading.trim(),
      ...(scopedDrafts[row.unitId].usageLocked || !scopedDrafts[row.unitId].usageEdited || scopedDrafts[row.unitId].usage.trim() === ""
        ? {}
        : { usage: scopedDrafts[row.unitId].usage.trim() }),
      manual_charge: scopedDrafts[row.unitId].manualCharge.trim(),
      note: scopedDrafts[row.unitId].note.trim(),
    }));

  /** 고정값 → 지침 순으로 저장해 서버(save_meter_readings)가 요금을 다시 계산하게 한다. */
  const persistGasReadings = async () => {
    if (buildingId === null) return null;
    const payloadRows = buildPayloadRows();
    const fixedChanges = rows.flatMap((row) => fixedChangesFor(
      row.unitId,
      scopedDrafts[row.unitId],
      fixedByUnit.get(row.unitId),
      period,
    ));
    // 고정값을 먼저 써야 save_meter_readings 가 바뀐 고정 사용량으로 량을 계산한다.
    if (fixedChanges.length > 0) {
      await saveFixedValues.mutateAsync({ buildingId, utilityType: "gas", period, changes: fixedChanges });
    }
    return payloadRows.length > 0
      ? saveMeter.mutateAsync({ buildingId, utilityType: "gas", period, rows: payloadRows })
      : null;
  };

  const calculate = async () => {
    if (!hasBillingBasis(chargeStartDate, chargeEndDate)) {
      toast.error("부과기준일을 먼저 설정해 주세요.");
      return;
    }
    if (rows.every((row) => !scopedDrafts[row.unitId].usageLocked && scopedDrafts[row.unitId].currentReading.trim() === "")) {
      toast.error("입력된 당월 지침이 없습니다.");
      return;
    }
    try {
      // 편집 상태·초안은 유지하고 서버 계산 요금만 다시 불러온다(수도 「계산」과 같은 방식).
      await persistGasReadings();
      toast.success("가스 요금을 계산했습니다.");
    } catch {
      toast.error("가스 요금을 계산하지 못했습니다.");
    }
  };

  const startEditing = () => {
    setEditStartDate(billingPeriodQuery.data?.chargeStartDate ?? (useDefaultBasis ? defaults.chargeStartDate : ""));
    setEditEndDate(billingPeriodQuery.data?.chargeEndDate ?? (useDefaultBasis ? defaults.chargeEndDate : ""));
    setEditing(true);
  };

  const save = async () => {
    if (buildingId === null) return;
    if (!chargeStartDate || !chargeEndDate || chargeStartDate > chargeEndDate) {
      toast.error("부과 시작일과 종료일을 확인해 주세요.");
      return;
    }

    try {
      const [, meterResult] = await Promise.all([
        saveBillingPeriod.mutateAsync({
          buildingId,
          period,
          chargeStartDate,
          chargeEndDate,
        }),
        persistGasReadings(),
      ]);
      toast.success(meterResult
        ? `${meterResult.saved}개 호실의 가스 지침과 부과기준을 저장했습니다.`
        : "부과기준일을 저장했습니다.");
      setEditing(false);
    } catch {
      toast.error("가스 지침과 부과기준을 저장하지 못했습니다.");
    }
  };

  const confirmCarryOver = () => {
    if (buildingId === null) {
      toast.info("이월할 건물을 먼저 선택해 주세요.");
      setCarryOverOpen(false);
      return;
    }
    const carryRows = rows.filter((row) => (
      !scopedDrafts[row.unitId].usageLocked
      && row.previousReading !== null
      && scopedDrafts[row.unitId].currentReading.trim() === ""
    ));
    setDrafts((current) => {
      const next = { ...current };
      carryRows.forEach((row) => {
        const key = `${scopeKey}:${row.unitId}`;
        next[key] = {
          ...(current[key] ?? initialDraft(row, fixedByUnit.get(row.unitId), period)),
          currentReading: String(row.previousReading),
        };
      });
      return next;
    });
    startEditing();
    setCarryOverOpen(false);
    toast.success(`${carryRows.length}개 호실을 이월했습니다.`);
  };

  return (
    <div className="utility-reference-font flex min-h-screen flex-col overflow-hidden bg-bg min-[1101px]:h-screen min-[1101px]:min-h-[700px]">
      <GasWorkspaceHeader
        onOpenLedger={() => {
          if (buildings.length === 0) toast.info("출력할 건물이 없습니다.");
          else setLedgerOpen(true);
        }}
        onOpenCarryOver={() => setCarryOverOpen(true)}
      />

      {!hasModule(me, "utilities") ? (
        <div className="p-6">
          <EmptyState message="이 화면에 접근할 권한이 없습니다. (지침·부과 권한 필요)" />
        </div>
      ) : (
        <main className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 overflow-auto p-4 min-[1101px]:grid-cols-[minmax(0,322px)_minmax(0,1fr)] min-[1101px]:grid-rows-[minmax(0,1fr)] min-[1101px]:overflow-hidden min-[1101px]:p-[22px_24px_24px]">
          <UtilityBuildingRail
            buildings={buildings}
            selectedBuildingId={buildingId}
            period={period}
            utilityLabel="가스"
            customerNumberCounts={gasCustomerNumberCounts}
            search={search}
            disabled={editing}
            onSearchChange={setSearch}
            onPeriodChange={(value) => {
              if (!editing) {
                setYear(Number(value.slice(0, 4)));
                setMonth(Number(value.slice(5, 7)));
              }
            }}
            onSelectBuilding={selectBuilding}
          />

          {/* 행을 minmax(0,1fr)로 묶고 min-h-0을 줘야 호실 표가 칸 안에서 스크롤된다(수도와 같음).
              없으면 건물을 고를 때 표 높이만큼 칸이 늘어나 화면 아래로 잘린다. */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            {selectedBuilding ? (
              <GasBillingToolbar
                buildingName={selectedBuilding.name}
                periodLabel={`${year}년 ${month}월분`}
                chargeStartDate={chargeStartDate}
                chargeEndDate={chargeEndDate}
                editing={editing}
                pending={isGasSavePending}
                onChargeStartDateChange={setEditStartDate}
                onChargeEndDateChange={setEditEndDate}
                onEdit={startEditing}
                onCalculate={() => void calculate()}
                onSave={() => void save()}
                onCancel={() => {
                  resetScopeDrafts();
                  setEditing(false);
                }}
              />
            ) : (
              <UtilityPeriodBarPlaceholder period={period} />
            )}

            {!selectedBuilding ? (
              <>
                <section className="h-[150px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-card">
                  <SelectionPlaceholder compact />
                </section>
                <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-card">
                  <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
                    <h2 className="text-[15px] font-extrabold text-t1">호실별 가스 지침</h2>
                    <div className="ml-auto flex items-center gap-4 text-[11.5px] font-medium text-t3">
                      <span className="flex items-center gap-1.5"><i className="h-3 w-[3px] rounded-[2px] bg-blue2" />퇴실 예정</span>
                      <span className="flex items-center gap-1.5"><i className="h-3 w-[3px] rounded-[2px] bg-red" />공실 사용량</span>
                      <span className="flex items-center gap-1.5"><i className="h-3 w-[3px] rounded-[2px] bg-green" />최근 입주</span>
                    </div>
                  </div>
                  <SelectionPlaceholder />
                </section>
              </>
            ) : isGasWorkspaceLoading ? (
              <section className="flex min-h-[360px] flex-1 flex-col justify-center rounded-2xl bg-white shadow-card">
                <Spinner label="가스 지침 불러오는 중" showLabel />
              </section>
            ) : rowsError || billingPeriodQuery.error ? (
              <section role="alert" className="flex min-h-[360px] flex-1 items-center justify-center rounded-2xl border border-red/20 bg-red-t text-[13px] font-bold text-red">
                가스 지침을 불러오지 못했습니다.
              </section>
            ) : (
              <>
                <GasAccountSummary rows={rows} drafts={scopedDrafts} editing={editing} />
                {needsBasis ? (
                  <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
                    <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
                      <h2 className="text-[15px] font-extrabold text-t1">호실별 가스 지침</h2>
                      <div className="ml-auto flex items-center gap-3 text-[11.5px] font-medium text-t3">
                        <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-blue2" />퇴실 예정</span>
                        <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-red" />공실 사용량</span>
                        <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-green" />최근 입주</span>
                      </div>
                    </div>
                    <BillingBasisRequiredState onEdit={startEditing} />
                  </section>
                ) : (
                  <GasReadingsTable
                    rows={rows}
                    drafts={scopedDrafts}
                    editing={editing}
                    referenceDate={referenceDate}
                    chargeStartDate={chargeStartDate}
                    chargeEndDate={chargeEndDate}
                    onDraftChange={updateDraft}
                  />
                )}
              </>
            )}
          </div>
        </main>
      )}

      <CarryOverDialog
        open={carryOverOpen}
        year={year}
        month={month}
        onClose={() => setCarryOverOpen(false)}
        onConfirm={confirmCarryOver}
      />

      {ledgerOpen && buildings.length > 0 && (
        <MeterLedgerModal
          open
          buildings={buildings}
          currentBuildingId={buildingId}
          period={period}
          utilityType="gas"
          onClose={() => setLedgerOpen(false)}
        />
      )}
    </div>
  );
}

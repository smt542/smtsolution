"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useCustomerNumberLookup } from "@/hooks/reactquery/buildingCustomerNumbers";
import {
  useBillingPeriod,
  useFixedUsages,
  useSaveBillingPeriod,
  useSaveMeterReadings,
  useSaveUtilityUnitPrices,
  useUtilityPrices,
  useUtilityRows,
  type UtilityType,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import { hasModule } from "@/lib/auth/permissions";
import { defaultBillingDates } from "./components/BillingPeriodBar";
import { CarryOverDialog } from "./components/CarryOverDialog";
import {
  BillingBasisRequiredState,
  hasBillingBasis,
  isPrototypeFuturePeriod,
} from "./components/BillingBasisRequiredState";
import { ElectricityBuildingRail } from "./components/ElectricityBuildingRail";
import {
  ElectricityCustomerSummary,
  type ElectricityCustomerSummaryDraft,
  type ElectricityCustomerSummaryRow,
} from "./components/ElectricityCustomerSummary";
import { ElectricityPeriodBar } from "./components/ElectricityPeriodBar";
import {
  ElectricityReadingsTable,
  type ElectricityDraft,
} from "./components/ElectricityReadingsTable";
import { MeterLedgerModal } from "./components/MeterLedgerModal";
import { UtilityWorkspaceHeader } from "./components/UtilityWorkspaceHeader";

const INITIAL_PERIOD = "2026-07-01";

function draftFor(row: UtilityUnitRow): ElectricityDraft {
  return {
    currentReading: row.currentReading === null ? "" : String(row.currentReading),
    manualCharge: row.manualCharge === null ? "" : String(row.manualCharge),
    note: row.note ?? "",
  };
}

function parsedNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ElectricityUtilitiesWorkspace() {
  const { data: me } = useMe();
  const buildingsQuery = useBuildings();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState(INITIAL_PERIOD);
  const [utilityType, setUtilityType] = useState<UtilityType>("electricity");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [carryOverOpen, setCarryOverOpen] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [drafts, setDrafts] = useState<Record<string, ElectricityDraft>>({});
  const [summaryDrafts, setSummaryDrafts] = useState<Record<string, ElectricityCustomerSummaryDraft>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  const rowsQuery = useUtilityRows(buildingId, utilityType, period);
  const fixedUsagesQuery = useFixedUsages(buildingId, utilityType);
  const pricesQuery = useUtilityPrices(buildingId, utilityType);
  const customerNumbersQuery = useCustomerNumberLookup({ kind: "common_elec", pageSize: 100 });
  const billingPeriodQuery = useBillingPeriod(buildingId, period);
  const saveMeterReadings = useSaveMeterReadings();
  const saveBillingPeriod = useSaveBillingPeriod();
  const saveUtilityPrices = useSaveUtilityUnitPrices();

  const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const fixedUsageByUnit = useMemo(
    () => new Map((fixedUsagesQuery.data ?? []).map((row) => [row.unitId, row.fixedUsage])),
    [fixedUsagesQuery.data],
  );
  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.id === buildingId) ?? null,
    [buildingId, buildings],
  );
  const customerNumberCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    const numberRows = customerNumbersQuery.data?.rows ?? [];
    numberRows.forEach((row) => {
      counts[row.buildingId] = (counts[row.buildingId] ?? 0) + 1;
    });
    return counts;
  }, [customerNumbersQuery.data?.rows]);
  const draftScope = `${buildingId ?? "none"}:${utilityType}:${period}`;
  const scopedDrafts = useMemo<Record<number, ElectricityDraft>>(
    () => Object.fromEntries(rows.map((row) => [
      row.unitId,
      drafts[`${draftScope}:${row.unitId}`] ?? draftFor(row),
    ])),
    [draftScope, drafts, rows],
  );

  const defaults = useMemo(() => defaultBillingDates(period), [period]);
  const savedPeriod = billingPeriodQuery.data;
  const useDefaultBasis = !isPrototypeFuturePeriod(period);
  const startDate = editing
    ? editStartDate
    : savedPeriod?.chargeStartDate ?? (useDefaultBasis ? defaults.chargeStartDate : "");
  const endDate = editing
    ? editEndDate
    : savedPeriod?.chargeEndDate ?? (useDefaultBasis ? defaults.chargeEndDate : "");

  const customerSummaryRows = useMemo<ElectricityCustomerSummaryRow[]>(() => {
    const prices = pricesQuery.data ?? [];
    const groups = new Map<string, UtilityUnitRow[]>();
    rows.forEach((row) => {
      const key = row.customerNumber ?? "미등록";
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
    prices.forEach((price) => {
      if (!groups.has(price.customerNo)) groups.set(price.customerNo, []);
    });

    return [...groups.entries()].map(([customerNumber, groupRows], index) => {
      const price = prices.find((item) => item.customerNo === customerNumber);
      const chargeAmount = groupRows.reduce((total, row) => total + (row.manualCharge ?? row.automaticCharge ?? 0), 0);
      const usage = groupRows.reduce((total, row) => total + (row.usage ?? 0), 0);
      const currentReading = groupRows.reduce((total, row) => total + (row.currentReading ?? 0), 0);
      const previousReading = groupRows.reduce((total, row) => total + (row.previousReading ?? 0), 0);
      const discountAmount = groupRows.reduce((total, row) => total + (row.discountAmount ?? 0), 0);
      const baseUnitPrice = price?.unitPrice ?? groupRows.find((row) => row.unitPrice !== null)?.unitPrice ?? null;
      const draftedPrice = price ? parsedNumber(priceDrafts[price.customerNumberId] ?? "") : null;
      return {
        id: price?.customerNumberId ?? -(index + 1),
        customerNumber,
        chargeAmount,
        // 고지금액: 실제 청구액 저장 필드가 없어 현재는 부과액과 동일값으로 파생(후속: 스태프 입력 배선)
        billedAmount: chargeAmount,
        usage,
        unitPrice: draftedPrice ?? baseUnitPrice,
        currentReading,
        previousReading,
        meterDifference: discountAmount === 0 ? 0 : -discountAmount,
        movingCharge: 0,
      };
    });
  }, [priceDrafts, pricesQuery.data, rows]);

  const scopedSummaryDrafts = useMemo<Record<number, ElectricityCustomerSummaryDraft>>(
    () => Object.fromEntries(customerSummaryRows.map((row) => [
      row.id,
      summaryDrafts[`${draftScope}:summary:${row.id}`] ?? {
        customerNumber: row.customerNumber,
        chargeAmount: String(row.chargeAmount),
      },
    ])),
    [customerSummaryRows, draftScope, summaryDrafts],
  );

  const updateDraft = useCallback((unitId: number, patch: Partial<ElectricityDraft>) => {
    const row = rows.find((item) => item.unitId === unitId);
    if (!row) return;
    const key = `${draftScope}:${unitId}`;
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? draftFor(row)), ...patch },
    }));
  }, [draftScope, rows]);

  const updateSummaryDraft = useCallback((id: number, patch: Partial<ElectricityCustomerSummaryDraft>) => {
    const row = customerSummaryRows.find((item) => item.id === id);
    if (!row) return;
    const key = `${draftScope}:summary:${id}`;
    setSummaryDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {
          customerNumber: row.customerNumber,
          chargeAmount: String(row.chargeAmount),
        }),
        ...patch,
      },
    }));
  }, [customerSummaryRows, draftScope]);

  useEffect(() => {
    const openLedger = () => setLedgerOpen(true);
    const openCarryOver = () => setCarryOverOpen(true);
    const changeUtilityType = (event: Event) => {
      const utility = (event as CustomEvent<UtilityType>).detail;
      if (utility === "electricity" || utility === "water" || utility === "gas") {
        setUtilityType(utility);
        setEditing(false);
        setPriceDrafts({});
      }
    };
    window.addEventListener("utilities:print", openLedger);
    window.addEventListener("utilities:carry-over", openCarryOver);
    window.addEventListener("utilities:type-change", changeUtilityType);
    return () => {
      window.removeEventListener("utilities:print", openLedger);
      window.removeEventListener("utilities:carry-over", openCarryOver);
      window.removeEventListener("utilities:type-change", changeUtilityType);
    };
  }, []);

  if (me === undefined) return null;
  if (!hasModule(me, "utilities")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (지침·부과 권한 필요)" />
      </div>
    );
  }

  const selectBuilding = (selectedId: number | null) => {
    setBuildingId(selectedId);
    setEditing(false);
    setSummaryDrafts({});
    setPriceDrafts({});
  };

  const startEditing = () => {
    setEditStartDate(savedPeriod?.chargeStartDate ?? (useDefaultBasis ? defaults.chargeStartDate : ""));
    setEditEndDate(savedPeriod?.chargeEndDate ?? (useDefaultBasis ? defaults.chargeEndDate : ""));
    setPriceDrafts(Object.fromEntries((pricesQuery.data ?? []).map((price) => [
      price.customerNumberId,
      price.unitPrice === null ? "" : String(price.unitPrice),
    ])));
    setDrafts((current) => ({
      ...current,
      ...Object.fromEntries(rows.map((row) => [`${draftScope}:${row.unitId}`, draftFor(row)])),
    }));
    setSummaryDrafts((current) => ({
      ...current,
      ...Object.fromEntries(customerSummaryRows.map((row) => [
        `${draftScope}:summary:${row.id}`,
        { customerNumber: row.customerNumber, chargeAmount: String(row.chargeAmount) },
      ])),
    }));
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDrafts((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !key.startsWith(`${draftScope}:`)),
    ));
    setSummaryDrafts((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !key.startsWith(`${draftScope}:summary:`)),
    ));
    setPriceDrafts({});
  };

  const calculate = () => {
    toast.info("입력값으로 사용량과 부과액을 계산했습니다.");
  };

  const save = async () => {
    if (buildingId === null) return;
    if (!editStartDate || !editEndDate || editStartDate > editEndDate) {
      toast.error("부과 시작일과 종료일을 확인해 주세요.");
      return;
    }

    const meterRows = rows
      .map((row) => ({ row, draft: scopedDrafts[row.unitId] }))
      .filter(({ row, draft }) => fixedUsageByUnit.has(row.unitId)
        || draft.currentReading.trim() !== ""
        || draft.manualCharge.trim() !== ""
        || draft.note.trim() !== "")
      .map(({ row, draft }) => ({
        unit_id: row.unitId,
        ...(fixedUsageByUnit.has(row.unitId) ? {} : { current_reading: draft.currentReading.trim() }),
        manual_charge: draft.manualCharge.trim(),
        note: draft.note.trim(),
      }));
    const prices = (pricesQuery.data ?? [])
      .map((price) => ({
        customer_number_id: price.customerNumberId,
        unit_price: parsedNumber(priceDrafts[price.customerNumberId] ?? "") ?? price.unitPrice,
      }))
      .filter((price): price is { customer_number_id: number; unit_price: number } => price.unit_price !== null);

    try {
      await Promise.all([
        saveBillingPeriod.mutateAsync({
          buildingId,
          period,
          chargeStartDate: editStartDate,
          chargeEndDate: editEndDate,
        }),
        ...(meterRows.length > 0 ? [saveMeterReadings.mutateAsync({ buildingId, utilityType, period, rows: meterRows })] : []),
        ...(prices.length > 0 ? [saveUtilityPrices.mutateAsync({ buildingId, utilityType, prices })] : []),
      ]);
      const label = utilityType === "water" ? "수도" : utilityType === "gas" ? "가스" : "전기";
      toast.success(`${label} 지침과 부과기준을 저장했습니다.`);
      setEditing(false);
      setSummaryDrafts({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "전기 지침을 저장하지 못했습니다.");
    }
  };

  const carryOver = () => {
    if (buildingId === null) {
      setCarryOverOpen(false);
      toast.error("이월할 건물을 먼저 선택해 주세요.");
      return;
    }
    const targets = rows.filter((row) => (
      row.occupancyId !== null
      && row.occupancyStatus !== "vacant"
      && !fixedUsageByUnit.has(row.unitId)
      && scopedDrafts[row.unitId].currentReading.trim() === ""
      && row.previousReading !== null
    ));
    targets.forEach((row) => updateDraft(row.unitId, { currentReading: String(row.previousReading) }));
    setCarryOverOpen(false);
    if (targets.length > 0) setEditing(true);
    toast.success(`${targets.length}개 호실의 이월값을 준비했습니다.`);
  };

  const referenceDate = `${period.slice(0, 7)}-15`;
  const utilityLabel = utilityType === "water" ? "수도" : utilityType === "gas" ? "가스" : "전기";
  const rowsLoading = rowsQuery.isLoading || fixedUsagesQuery.isLoading;
  const saving = saveMeterReadings.isPending || saveBillingPeriod.isPending || saveUtilityPrices.isPending;
  const needsBasis = buildingId !== null
    && !billingPeriodQuery.isLoading
    && isPrototypeFuturePeriod(period)
    && !hasBillingBasis(startDate, endDate);

  return (
    <>
      <UtilityWorkspaceHeader
        utilityLabel="전기"
        onOpenLedger={() => setLedgerOpen(true)}
        onOpenCarryOver={() => setCarryOverOpen(true)}
      />

      <div className="relative min-h-[calc(100vh-62px)] bg-bg p-4 sm:p-[22px_24px_24px]">
      <label className="sr-only">
        건물 선택
        <select
          aria-label="건물 선택"
          value={buildingId ?? ""}
          onChange={(event) => selectBuilding(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">건물을 선택해 주세요</option>
          {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
        </select>
      </label>

      <div className="mx-auto grid min-h-[803px] max-w-[1632px] grid-cols-1 items-stretch gap-4 min-[1101px]:h-[calc(100vh-110px)] min-[1101px]:grid-cols-[minmax(0,322px)_minmax(0,1fr)]">
        <ElectricityBuildingRail
          buildings={buildings}
          selectedBuildingId={buildingId}
          search={search}
          period={period}
          utilityLabel={utilityLabel}
          customerNumberCounts={customerNumberCounts}
          disabled={editing}
          onSearchChange={setSearch}
          onPeriodChange={(value) => {
            setPeriod(value);
            setEditing(false);
          }}
          onSelectBuilding={selectBuilding}
        />

        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <ElectricityPeriodBar
            buildingName={selectedBuilding?.name ?? null}
            period={period}
            startDate={startDate}
            endDate={endDate}
            editing={editing}
            saving={saving}
            onStartDateChange={setEditStartDate}
            onEndDateChange={setEditEndDate}
            onEdit={startEditing}
            onCalculate={calculate}
            onSave={() => void save()}
            onCancel={cancelEditing}
          />

          <ElectricityCustomerSummary
            rows={buildingId === null ? [] : customerSummaryRows}
            drafts={scopedSummaryDrafts}
            editing={editing}
            onDraftChange={updateSummaryDraft}
          />

          {rowsLoading || (buildingId !== null && billingPeriodQuery.isLoading) ? (
            <section className="flex min-h-[360px] flex-1 items-center justify-center rounded-card bg-white text-xs font-semibold text-t3 shadow-card">
              호실별 전기 지침을 불러오는 중입니다.
            </section>
          ) : rowsQuery.error || billingPeriodQuery.error ? (
            <section className="flex min-h-[360px] flex-1 flex-col items-center justify-center rounded-card bg-white text-center shadow-card">
              <p className="text-sm font-bold text-red">호실별 전기 지침을 불러오지 못했습니다.</p>
              <button type="button" onClick={() => rowsQuery.refetch()} className="mt-3 h-8 rounded-lg border border-line px-3 text-xs font-bold text-t2">다시 시도</button>
            </section>
          ) : needsBasis ? (
            <section className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
              <div className="flex h-[49px] flex-none items-center gap-2.5 border-b border-line2 px-[18px]">
                <h2 className="whitespace-nowrap text-[15px] font-extrabold text-t1">호실별 {utilityLabel} 지침</h2>
              </div>
              <BillingBasisRequiredState detailed={false} onEdit={startEditing} />
            </section>
          ) : (
            <ElectricityReadingsTable
              rows={buildingId === null ? [] : rows}
              drafts={scopedDrafts}
              referenceDate={referenceDate}
              utilityLabel={utilityLabel}
              editing={editing}
              onDraftChange={updateDraft}
            />
          )}
        </main>
      </div>

      <button type="button" aria-label="화면 도우미 열기" className="fixed right-0 top-1/2 hidden h-[70px] w-4 -translate-y-1/2 rounded-l-md bg-t2 text-[8px] font-bold text-white xl:block" style={{ writingMode: "vertical-rl" }}>
        화면도움
      </button>
      <button type="button" aria-label="도움말" className="fixed bottom-5 right-5 flex size-11 items-center justify-center rounded-full bg-teal text-lg font-extrabold text-white shadow-pop">?</button>

      {ledgerOpen && (
        <MeterLedgerModal
          open
          buildings={buildings}
          currentBuildingId={buildingId}
          period={period}
          onClose={() => setLedgerOpen(false)}
        />
      )}
      <CarryOverDialog
        open={carryOverOpen}
        period={period}
        onCancel={() => setCarryOverOpen(false)}
        onConfirm={carryOver}
      />
      </div>
    </>
  );
}
